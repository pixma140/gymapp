# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run app server with SQLite
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
RUN apk add --no-cache sqlite && mkdir -p /app/data && touch /app/data/gymapp.db
ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "server/index.js"]
