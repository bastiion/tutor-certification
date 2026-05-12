#!/usr/bin/env bash
set -euo pipefail

IMAGE="ghcr.io/bastiion/tutor-certification:staging"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 user@host" >&2
  exit 1
fi

SSH_TARGET="$1"

echo "▸ Building production image as ${IMAGE} …"
docker build -t "$IMAGE" -f docker/production/Dockerfile .

echo "▸ Transferring image to ${SSH_TARGET} …"
docker save "$IMAGE" | ssh -C "$SSH_TARGET" 'docker load'

echo "✓ Done – ${IMAGE} is now available on ${SSH_TARGET}"
