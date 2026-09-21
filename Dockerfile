# Keep this version aligned with actions/setup-node in the release workflow.
ARG NODE_VERSION=26.8.1

# Normalize only release metadata. Copying these outputs into independent stages
# lets BuildKit reuse npm ci when the original files differ only by app version.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS dependency-manifests
WORKDIR /manifests
COPY package.json package-lock.json ./
RUN node --input-type=module -e '\
    import fs from "node:fs"; \
    for (const file of ["package.json", "package-lock.json"]) { \
        const manifest = JSON.parse(fs.readFileSync(file, "utf8")); \
        manifest.version = "0.0.0"; \
        if (file === "package-lock.json") manifest.packages[""].version = "0.0.0"; \
        fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n"); \
    }'

# Build architecture-independent assets once on the native platform.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY --from=dependency-manifests /manifests/ ./
RUN npm ci
# Restore real package metadata before compiling the app.
COPY . .
ARG VITE_GIT_COMMIT
ARG VITE_RELEASE_TAG
RUN npm run build

# Install native SQLite dependencies for each target platform.
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY --from=dependency-manifests /manifests/ ./
RUN npm ci --omit=dev
# Ship original manifests, never the normalized installation inputs.
COPY package.json package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY shared ./shared
RUN apk add --no-cache sqlite && mkdir -p /app/data
ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "server/index.js"]
