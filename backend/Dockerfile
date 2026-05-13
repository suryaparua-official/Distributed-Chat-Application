FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Frontend dist copy
COPY ../frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["node", "app.js"]