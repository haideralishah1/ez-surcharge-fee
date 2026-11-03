#!/bin/sh
# Runs as root (the container's default user) so it can fix ownership of
# /data, which Railway mounts fresh at container start — it overwrites
# whatever ownership was baked into the image at build time, so a
# build-time `chown` on /data has no effect at runtime. Then drops to the
# non-root "node" user before exec'ing the real start command.
set -e

mkdir -p /data
chown -R node:node /data

exec su-exec node "$@"
