#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${ENV_FILE:-$repo_root/.env.verify}"

if [[ -f "$env_file" ]]; then
  set -a
  source "$env_file"
  set +a
fi

: "${POSTGRES_PASSWORD:=postgres}"
: "${DEV_AUTH_ENABLED:=true}"
: "${API_BASE_URL:=http://localhost:3001}"

cd "$repo_root"
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" DEV_AUTH_ENABLED="$DEV_AUTH_ENABLED" docker compose down -v
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" DEV_AUTH_ENABLED="$DEV_AUTH_ENABLED" docker compose up -d --build postgres redis backend

cd "$repo_root/backend"
API_BASE_URL="$API_BASE_URL" cargo run --bin api_verify
