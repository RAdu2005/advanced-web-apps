#!/usr/bin/env bash
set -euo pipefail

cd /var/www/cloud-drive

git fetch origin docker-deploy
git checkout docker-deploy
git pull --ff-only origin docker-deploy

IMAGE_NAME="${IMAGE_NAME:-cloud-drive:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-cloud-drive}"
API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-4173}"
VITE_API_URL="${VITE_API_URL:-}"
ENV_FILE="${ENV_FILE:-/var/www/cloud-drive/apps/api/.env}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-cloud-drive-uploads}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

if [[ -z "${VITE_API_URL}" ]]; then
  echo "Missing VITE_API_URL (set it to your API tunnel URL, e.g. https://api.example.com)"
  exit 1
fi

docker build \
  --pull \
  --build-arg "VITE_API_URL=${VITE_API_URL}" \
  -t "${IMAGE_NAME}" \
  .

docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --env-file "${ENV_FILE}" \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e WEB_PORT=4173 \
  -p "127.0.0.1:${API_PORT}:4000" \
  -p "127.0.0.1:${WEB_PORT}:4173" \
  -v "${UPLOADS_VOLUME}:/app/apps/api/uploads" \
  "${IMAGE_NAME}"
