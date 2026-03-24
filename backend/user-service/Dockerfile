FROM node:22-alpine AS builder

WORKDIR /app

# install deps (clean way)
COPY package*.json ./
RUN npm ci

# copy source
COPY tsconfig.json ./
COPY src ./src

# build
RUN npm run build


# ---- production image ----
FROM node:22-alpine

WORKDIR /app

# install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# copy build output only
COPY --from=builder /app/dist ./dist

# optional: reduce layer size
RUN npm cache clean --force

CMD ["node", "dist/index.js"]