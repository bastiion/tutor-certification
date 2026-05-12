#!/usr/bin/env bash
# Run the production image's env-wizard with deploy/ mounted at /out.
#
# Usage:
#   ./env-wizard.sh              # interactive; writes deploy/.env
#   ./env-wizard.sh --auto       # non-interactive secrets + placeholders → deploy/.env
#   ./env-wizard.sh -- --help    # pass flags through to env-wizard
#
# Image: REGISTRY_IMAGE + IMAGE_TAG (defaults: ghcr.io/bastiion/tutor-certification + staging).
# If deploy/.env exists, it is sourced for consistent image tags with compose.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

REGISTRY_IMAGE="${REGISTRY_IMAGE:-ghcr.io/bastiion/tutor-certification}"
IMAGE_TAG="${IMAGE_TAG:-staging}"
IMAGE="${REGISTRY_IMAGE}:${IMAGE_TAG}"

has_out=false
needs_tty=true
for a in "$@"; do
  case "$a" in
    --out | --out=*) has_out=true ;;
    --auto) needs_tty=false ;;
    -h | --help) needs_tty=false ;;
  esac
done

w_args=("$@")
if [[ $# -eq 0 ]]; then
  w_args=(--out /out/.env)
elif [[ "$has_out" == false ]] && [[ "$*" != *"--help"* ]] && [[ "$*" != *"-h"* ]]; then
  w_args+=(--out /out/.env)
fi

docker_cmd=(docker run --rm)
if [[ "$needs_tty" == true ]]; then
  docker_cmd+=(-it)
fi
docker_cmd+=(
  -v "${SCRIPT_DIR}:/out"
  --entrypoint /usr/local/bin/env-wizard
  "$IMAGE"
  "${w_args[@]}"
)

echo "▸ env-wizard using ${IMAGE} (mount ${SCRIPT_DIR} → /out)" >&2
exec "${docker_cmd[@]}"
