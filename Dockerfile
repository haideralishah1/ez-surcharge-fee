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
# su-exec drops from root to the "node" user after the entrypoint fixes
# /data's ownership — see docker-entrypoint.sh for why that has to happen
# at container start, not at build time.
RUN apk add --no-cache openssl su-exec
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=build /app/build ./build
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Stay root here on purpose — the entrypoint needs root to chown /data,
# then it execs the real process as the non-root "node" user itself.

EXPOSE 3000
# No `VOLUME` instruction here on purpose: Railway's build rejects the
# Dockerfile VOLUME directive outright ("use Railway Volumes" instead) —
# persistence at /data comes from attaching a Railway Volume to this
# service in the dashboard (see RAILWAY_SETUP.md), not from this file.

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
# "docker-start" runs `prisma generate && prisma migrate deploy` (NOT
# `migrate dev`) before starting the server, so a fresh container boots
# into a migrated DB. Defined in package.json's "docker-start"/"setup" scripts.
CMD ["npm", "run", "docker-start"]
