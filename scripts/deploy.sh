#!/usr/bin/env bash
# deploy.sh — stop the old container (if any) and run the new image.
# Called by Jenkinsfile's Deploy stage. Can also be run manually:
#   IMAGE_NAME=yourdockerhubuser/devops-demo-app IMAGE_TAG=latest ./scripts/deploy.sh

set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-yourdockerhubuser/devops-demo-app}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DEPLOY_CONTAINER="${DEPLOY_CONTAINER:-devops-demo-app}"
DEPLOY_PORT="${DEPLOY_PORT:-3000}"

echo "Deploying ${IMAGE_NAME}:${IMAGE_TAG} as container '${DEPLOY_CONTAINER}' on port ${DEPLOY_PORT}..."

# Pull in case this runs on a separate deploy host without a local build
docker pull "${IMAGE_NAME}:${IMAGE_TAG}" || true

# Stop and remove any existing container with the same name
if docker ps -a --format '{{.Names}}' | grep -q "^${DEPLOY_CONTAINER}$"; then
    echo "Stopping existing container..."
    docker stop "${DEPLOY_CONTAINER}" || true
    docker rm "${DEPLOY_CONTAINER}" || true
fi

docker run -d \
    --name "${DEPLOY_CONTAINER}" \
    -p "${DEPLOY_PORT}:3000" \
    -e APP_VERSION="${IMAGE_TAG}" \
    --restart unless-stopped \
    "${IMAGE_NAME}:${IMAGE_TAG}"

echo "Deployed. Container status:"
docker ps --filter "name=${DEPLOY_CONTAINER}"
