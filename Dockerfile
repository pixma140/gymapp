# Keep this version aligned with actions/setup-node in the release workflow.
ARG NODE_VERSION=24.20.0

# Stage 1: Build architecture-independent assets once on the native platform.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_GIT_COMMIT
ARG VITE_RELEASE_TAG
RUN npm run build

# Stage 2: Install native SQLite dependencies for each target platform.
FROM node:${NODE_VERSION}-alpine
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
