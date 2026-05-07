# Schat

A simple chat application with frontend and backend components. The backend uses Express, Socket.io, Redis, and MongoDB, while the frontend is built with React and Vite.

## Repository structure

- `backend/`
  - `app.js` - Express backend service entrypoint
  - `models/` - Mongoose schemas
  - `routes/` - API route handlers
  - `Dockerfile` - Backend Docker image definition
  - `docker-compose.yml` - Docker Compose stack for backend, Redis, MongoDB, and HAProxy
  - `haproxy/` - HAProxy configuration for load balancing backend instances
- `frontend/`
  - React app built with Vite

## Local development

### Frontend

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://localhost:5173` in your browser.

### Backend (Docker)

```powershell
cd backend
docker compose up --build -d
```

The backend cluster is available through HAProxy at `http://localhost:3000`.

## Features

- group chat
- broadcast chat
- direct messages (unicast)
- Redis-based pub/sub across backend instances
- MongoDB persistence for chat history

## Notes

- The frontend expects the backend to be available at `http://localhost:3000`.
- If you want to run the backend without Docker, start the service from the `backend` folder with Node.js after installing dependencies.

```powershell
cd backend
npm install
node app.js
```

- The application uses `SChat` naming for the database and backend channel topics.
