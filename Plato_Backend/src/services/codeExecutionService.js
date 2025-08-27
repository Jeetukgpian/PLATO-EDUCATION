const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const tempDir = os.tmpdir();

// Configuration
const DOCKER_IMAGES = {
  python: 'python:3-slim',
  javascript: 'node:18-slim',
  java: 'openjdk:17-jdk-slim',
  cpp: 'gcc:latest'
};

const EXECUTION_TIMEOUT = 10000; // 10 seconds

exports.execute = async (code, language, input = '') => {
  const lang = language.toLowerCase();
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const tempFile = path.join(tempDir, `code_${uniqueId}`);
  
  try {
    fs.writeFileSync(tempFile, code);
    
    const { command, args } = buildDockerCommand(lang, tempFile);
    const result = await runDockerContainer(command, args, input);
    
    return { output: result };
  } catch (error) {
    throw new Error(error.message);
  } finally {
    cleanup([tempFile]);
  }
};

function buildDockerCommand(lang, filePath) {
  const volumeMount = `-v ${filePath}:/code`;
  
  switch(lang) {
    case 'python':
      return {
        command: 'docker',
        args: ['run', '--rm', volumeMount, DOCKER_IMAGES.python, 'python', '/code']
      };
      
    case 'javascript':
    case 'js':
      return {
        command: 'docker',
        args: ['run', '--rm', volumeMount, DOCKER_IMAGES.javascript, 'node', '/code']
      };
      
    case 'java':
      return {
        command: 'docker',
        args: [
          'run', '--rm', volumeMount,
          DOCKER_IMAGES.java,
          'sh', '-c', 'javac /code && java -cp / $(basename /code .java)'
        ]
      };
      
    case 'cpp':
    case 'c++':
      return {
        command: 'docker',
        args: [
          'run', '--rm', volumeMount,
          DOCKER_IMAGES.cpp,
          'sh', '-c', 'g++ -o /app /code && /app'
        ]
      };
      
    default:
      throw new Error(`Unsupported language: ${lang}`);
  }
}

async function runDockerContainer(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let error = '';
    let timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Execution timed out'));
    }, EXECUTION_TIMEOUT);

    // Handle input
    if (input) {
      child.stdin.write(input + '\n');
      child.stdin.end();
    }

    // Collect output
    child.stdout.on('data', (data) => output += data.toString());
    child.stderr.on('data', (data) => error += data.toString());

    // Handle completion
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(error || 'Container execution failed'));
      } else {
        resolve(output.trim());
      }
    });
  });
}

function cleanup(files) {
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });
}