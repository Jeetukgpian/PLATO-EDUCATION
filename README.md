# Plato: AI-Powered Programming Education Platform

Plato is a full-stack, AI-driven educational platform designed to help users learn programming, practice Data Structures & Algorithms (DSA), and interact with a smart chat assistant. The project features a modern React frontend and a robust Node.js/Express backend, with MongoDB for data storage and Firebase for authentication.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Backend](#backend)
  - [Folder Structure](#backend-folder-structure)
  - [Main Features](#backend-main-features)
  - [API Endpoints](#backend-api-endpoints)
- [Frontend](#frontend)
  - [Folder Structure](#frontend-folder-structure)
  - [Main Features](#frontend-main-features)
  - [Routes & Pages](#frontend-routes--pages)
- [Setup Instructions](#setup-instructions)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview
Plato aims to provide an interactive, personalized, and AI-enhanced learning experience for programming and DSA. Users can:
- Chat with an AI assistant for help and explanations
- Practice DSA problems and track progress
- Generate personalized learning courses
- Write and execute code in-browser
- Authenticate securely with Google

---

## Architecture

```
graph TD
  A[Frontend (React)]--API Calls-->B[Backend (Node.js/Express)]
  B--DB Queries-->C[(MongoDB)]
  B--Auth-->D[Firebase]
  A--Static Assets-->A1[Public/Assets]
```

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Mongoose, Firebase Admin
- **Database:** MongoDB
- **Authentication:** Firebase (Google OAuth)

---

## Backend

### Backend Folder Structure
- `Plato_Backend/`
  - `server.js` — Entry point
  - `src/app.js` — Express app setup and middleware
  - `src/controllers/` — Business logic for authentication, chat, code execution, DSA, etc.
  - `src/models/` — Mongoose models for users, chats, code, topics, etc.
  - `src/routes/` — Express route definitions for API endpoints
  - `src/services/` — Services for caching, code execution, and AI integration
  - `src/middleware/` — Authentication, error handling, and API key checks
  - `src/config/` — Database and Firebase configuration
  - `src/utils/` — Utility functions and logging

### Backend Main Features
- RESTful API for chat, code execution, DSA practice, language learning, and authentication
- JWT-based session management
- CORS and security middleware (Helmet, CORS)
- Logging with Winston and Morgan
- Modular controller/service structure

### Backend API Endpoints
| Endpoint                | Method | Description                                      | Auth Required |
|-------------------------|--------|--------------------------------------------------|--------------|
| `/auth/login`           | POST   | Login or register user with Firebase ID token     | No           |
| `/auth/logout`          | POST   | Logout user (JWT/session cleanup)                 | Yes          |
| `/chat/send`            | POST   | Send a message to the AI chat assistant           | Yes          |
| `/code/execute`         | POST   | Execute code in a given language                  | Yes          |
| `/dsa/allproblemsets`   | GET    | Get all DSA problem sets for the user             | Yes          |
| `/language/...`         | GET    | Language learning endpoints (details in code)     | Yes          |
| `/test/ping`            | GET    | Health check: server running                      | No           |
| `/test/...`             | GET    | Additional test endpoints (auth/db check)         | No           |
| `/database-status`      | GET    | Check MongoDB connection status                   | No           |

> **Note:** All main feature endpoints are protected by JWT/Firebase authentication middleware except for login and test routes.

---

## Frontend

### Frontend Folder Structure
- `Plato_Frontend/`
  - `src/App.tsx` — Main app and route definitions
  - `src/components/` — UI components (chat, IDE, navigation, DSA, etc.)
  - `src/context/` — React context for authentication and app state
  - `src/services/` — API service wrappers, Firebase integration, and hooks
  - `src/utils/` — Utility functions for markdown, tokens, etc.
  - `src/Styles/` — CSS modules for styling

### Frontend Main Features
- Responsive UI with Tailwind CSS
- Google login and session management
- In-browser code editor (Monaco Editor)
- DSA practice and course generation flows
- AI chat interface
- Sidebar and navigation for seamless user experience

### Frontend Routes & Pages
| Route                | Component/Page                | Description                                              |
|----------------------|------------------------------|----------------------------------------------------------|
| `/`                  | `HomePage`                   | Landing page, Google login, intro, and demo sections      |
| `/login-redirect`    | `LoginRedirect`              | Handles login navigation and redirects                    |
| `/main`              | `ResizableContainer`         | Main workspace (IDE, chat, etc.)                          |
| `/home`              | `Language`                   | Language/topic selection and progress tracking            |
| `/practice`          | `Practice`                   | DSA practice interface                                   |
| `/course_generation` | `CourseGeneration`           | Personalized course generation for new users              |
| `/course`            | `NewPage`                    | Course content display                                    |
| `*`                  | Redirect to `/`              | Catch-all: redirects unknown routes to landing page       |

#### Key Components
- `Navbar`, `Sidebar`: Navigation and layout
- `Chat`, `IDE`, `Output`: Main learning and coding interfaces
- `HeroSectionWhimsical`, `DemoSectionWhimsical`, `FooterWhimsical`: Landing/marketing UI
- Contexts: `AuthContext`, `AppContext` for state management

---

## Setup Instructions

### Prerequisites
- Node.js (v16+ recommended)
- npm
- MongoDB instance (local or cloud)
- Firebase project (for Google Auth)

### Backend Setup
1. Navigate to `Plato_Backend/`:
   ```sh
   cd Plato_Backend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file with MongoDB URI, Firebase credentials, and other secrets as needed.
4. Start the backend server:
   ```sh
   npm run dev
   ```

### Frontend Setup
1. Navigate to `Plato_Frontend/`:
   ```sh
   cd Plato_Frontend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Configure Firebase:
   - Update `src/services/firebase.ts` with your Firebase project config.
4. Start the frontend:
   ```sh
   npm start
   ```

---

## Usage
- Visit the frontend (default: `http://localhost:3000`).
- Sign in with Google.
- Explore chat, DSA practice, code execution, and course generation features.

---

## Contributing
1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Commit your changes with clear messages.
4. Push to your fork and submit a pull request.

---

## License
This project is licensed under the ISC License.
