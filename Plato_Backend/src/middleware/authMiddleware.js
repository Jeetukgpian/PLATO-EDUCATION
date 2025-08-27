const admin = require('../config/firebaseAdmin');
const apiResponse = require('../utils/apiResponse');

const authMiddleware = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json(apiResponse.error('No token provided'));
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.userId = decodedToken.uid;
    next();
  } catch (error) {
    return res.status(401).json(apiResponse.error('Invalid token'));
  }
};

module.exports = authMiddleware;
