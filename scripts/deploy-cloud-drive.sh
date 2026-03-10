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
USE_DOCKER_MONGO="${USE_DOCKER_MONGO:-1}"
MONGO_IMAGE="${MONGO_IMAGE:-mongo:7}"
MONGO_CONTAINER_NAME="${MONGO_CONTAINER_NAME:-cloud-drive-mongo}"
MONGO_VOLUME="${MONGO_VOLUME:-cloud-drive-mongo-data}"
MONGO_DB="${MONGO_DB:-cloud_drive}"
NETWORK_NAME="${NETWORK_NAME:-cloud-drive-net}"
USE_HOST_NETWORK="${USE_HOST_NETWORK:-1}"

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

if [[ "${USE_DOCKER_MONGO}" == "1" ]]; then
  docker pull "${MONGO_IMAGE}"
  docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1 || docker network create "${NETWORK_NAME}"
  docker rm -f "${MONGO_CONTAINER_NAME}" >/dev/null 2>&1 || true

  docker run -d \
    --name "${MONGO_CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${NETWORK_NAME}" \
    -v "${MONGO_VOLUME}:/data/db" \
    "${MONGO_IMAGE}"

  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${NETWORK_NAME}" \
    --env-file "${ENV_FILE}" \
    -e NODE_ENV=production \
    -e PORT=4000 \
    -e WEB_PORT=4173 \
    -e MONGO_URI="mongodb://${MONGO_CONTAINER_NAME}:27017/${MONGO_DB}" \
    -p "127.0.0.1:${API_PORT}:4000" \
    -p "127.0.0.1:${WEB_PORT}:4173" \
    -v "${UPLOADS_VOLUME}:/app/apps/api/uploads" \
    "${IMAGE_NAME}"
elif [[ "${USE_HOST_NETWORK}" == "1" ]]; then
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network host \
    --env-file "${ENV_FILE}" \
    -e NODE_ENV=production \
    -e PORT="${API_PORT}" \
    -e WEB_PORT="${WEB_PORT}" \
    -v "${UPLOADS_VOLUME}:/app/apps/api/uploads" \
    "${IMAGE_NAME}"
else
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --add-host host.docker.internal:host-gateway \
    --env-file "${ENV_FILE}" \
    -e NODE_ENV=production \
    -e PORT=4000 \
    -e WEB_PORT=4173 \
    -p "127.0.0.1:${API_PORT}:4000" \
    -p "127.0.0.1:${WEB_PORT}:4173" \
    -v "${UPLOADS_VOLUME}:/app/apps/api/uploads" \
    "${IMAGE_NAME}"
fi
