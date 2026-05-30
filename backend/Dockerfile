# Note: this file is for reference only — docker-compose uses the root Dockerfile.
# COPY ../frontend/dist is invalid here; the root Dockerfile handles the full build.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Frontend dist copy
COPY ../frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["node", "app.js"]