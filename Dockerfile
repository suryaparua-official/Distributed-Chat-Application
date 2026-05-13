FROM node:18-alpine
WORKDIR /app

# Backend dependencies
COPY backend/package*.json ./
RUN npm install

# Backend code
COPY backend/ .

# Frontend dist
COPY frontend/dist ./frontend/dist

EXPOSE 8080
CMD ["node", "app.js"]