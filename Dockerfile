# Stage 1: Build the application
FROM node:25.8.2-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_GIT_COMMIT
ARG VITE_RELEASE_TAG
RUN npm run build

# Stage 2: Run app server with SQLite
FROM node:25.8.2-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY shared ./shared
RUN apk add --no-cache sqlite && mkdir -p /app/data
ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "server/index.js"]
