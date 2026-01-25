#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/generate-review-note.sh --background "..." [--plan "..."] [--base <sha>] [--head <sha>] [--out <path>]

Defaults:
  - If --base/--head are not provided, the note is generated for the current working tree vs HEAD
  - Output is written to: .agent/code-review/notes/<timestamp>.md
EOF
}

BACKGROUND=""
PLAN_REFERENCE=""
BASE_SHA=""
HEAD_SHA=""
OUT_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --background)
      BACKGROUND="${2:-}"
      shift 2
      ;;
    --plan)
      PLAN_REFERENCE="${2:-}"
      shift 2
      ;;
    --base)
      BASE_SHA="${2:-}"
      shift 2
      ;;
    --head)
      HEAD_SHA="${2:-}"
      shift 2
      ;;
    --out)
      OUT_PATH="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BACKGROUND" ]]; then
  echo "--background is required" >&2
  usage >&2
  exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT_DIR" ]]; then
  echo "Not a git repository (git rev-parse failed)" >&2
  exit 1
fi

cd "$ROOT_DIR"

TIMESTAMP="$(date +"%Y-%m-%d_%H%M%S")"
DEFAULT_OUT_DIR="$ROOT_DIR/.agent/code-review/notes"

if [[ -z "$OUT_PATH" ]]; then
  mkdir -p "$DEFAULT_OUT_DIR"
  OUT_PATH="$DEFAULT_OUT_DIR/$TIMESTAMP.md"
else
  mkdir -p "$(dirname "$OUT_PATH")"
fi

RANGE_LABEL=""
NAME_STATUS=""
DIFF_STAT=""

if [[ -n "$BASE_SHA" && -n "$HEAD_SHA" ]]; then
  RANGE_LABEL="$BASE_SHA..$HEAD_SHA"
  NAME_STATUS="$(git diff --name-status "$BASE_SHA..$HEAD_SHA" || true)"
  DIFF_STAT="$(git diff --stat "$BASE_SHA..$HEAD_SHA" || true)"
else
  RANGE_LABEL="WORKTREE vs HEAD"
  NAME_STATUS="$(git diff --name-status HEAD -- || true)
$(git diff --cached --name-status -- || true)
$(git ls-files --others --exclude-standard | sed 's/^/??\t/' || true)"

  DIFF_STAT="$(git diff --stat HEAD -- || true)
$(git diff --cached --stat -- || true)"
fi

{
  echo "# Code Review Note"
  echo
  echo "- Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- Range: $RANGE_LABEL"
  echo
  echo "## Background"
  echo
  echo "$BACKGROUND"
  echo
  if [[ -n "$PLAN_REFERENCE" ]]; then
    echo "## Plan/Requirements"
    echo
    echo "$PLAN_REFERENCE"
    echo
  fi
  echo "## Files Changed"
  echo
  echo '```'
  if [[ -n "$NAME_STATUS" ]]; then
    echo "$NAME_STATUS"
  else
    echo "(no file changes detected)"
  fi
  echo '```'
  echo
  echo "## Diff Stat"
  echo
  echo '```'
  if [[ -n "$DIFF_STAT" ]]; then
    echo "$DIFF_STAT"
  else
    echo "(no diff stat available)"
  fi
  echo '```'
  echo
  echo "## Review Commands"
  echo
  if [[ -n "$BASE_SHA" && -n "$HEAD_SHA" ]]; then
    echo '```bash'
    echo "git diff --stat $BASE_SHA..$HEAD_SHA"
    echo "git diff $BASE_SHA..$HEAD_SHA"
    echo '```'
  else
    echo '```bash'
    echo 'git status'
    echo 'git diff'
    echo 'git diff --cached'
    echo '```'
  fi
} > "$OUT_PATH"

echo "$OUT_PATH"
