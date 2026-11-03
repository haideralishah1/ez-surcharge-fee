# syntax=docker/dockerfile:1

#############################################
# Build stage — needs devDependencies (vite,
# @react-router/dev, typescript, …) to run
# `npm run build`, so we install everything
# here and prune before shipping.
#############################################
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# Copy the whole repo (not just package.json) before `npm ci`: this is an
# npm workspaces project (root + extensions/*), so npm needs every
# workspace's package.json present to resolve the lockfile correctly.
COPY . .

RUN npm ci

# Prisma's generated client is imported by app/db.server.ts, so it must
# exist before the app is bundled — otherwise the build fails trying to
# resolve "@prisma/client".
RUN npx prisma generate

RUN npm run build

# Drop devDependencies now that build output exists, to keep the
# runtime image small.
RUN npm prune --omit=dev

#############################################
# Runtime stage
#############################################
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# /data is the persistent volume mount point on Railway. SQLite's file and
# any future uploaded files must live here — everything else in the image
# is read-only at runtime.
RUN mkdir -p /data && chown -R node:node /data /app

COPY --chown=node:node --from=build /app/build ./build
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/prisma ./prisma

# Run as a non-root user (the "node" user ships built into this base image).
USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" || exit 1

# "docker-start" runs `prisma generate && prisma migrate deploy` (NOT
# `migrate dev`) before starting the server, so a fresh container boots
# into a migrated DB. Defined in package.json's "docker-start"/"setup" scripts.
CMD ["npm", "run", "docker-start"]
