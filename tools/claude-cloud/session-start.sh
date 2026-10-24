#!/usr/bin/env bash
# SessionStart hook for Claude Code on the web. Local sessions exit right away.
#
# The cloud environment's setup script (tools/claude-cloud/setup.sh, pasted into
# the environment settings on claude.ai/code) installs Node 24, gcloud and the
# Firebase CLI into the cached image. This hook does the per-session part: it
# puts that toolchain on PATH, writes the service-account key from the
# GCP_SA_KEY_B64 environment variable and runs `npm ci` on the fresh clone.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0

env_file="${CLAUDE_ENV_FILE:-/dev/null}"
toolchain_path="/opt/node24/bin:/opt/google-cloud-sdk/bin"
export PATH="$toolchain_path:$PATH"
export CXXFLAGS='-include stdint.h' # gl's bundled ANGLE needs it under GCC 13+, as in CI
{
  echo "export PATH=\"$toolchain_path:\$PATH\""
  echo "export CXXFLAGS='$CXXFLAGS'"
} >> "$env_file"

wanted_node="v$(cat .nvmrc)"
if [ "$(node --version 2>/dev/null)" != "$wanted_node" ]; then
  echo "Node $(node --version 2>/dev/null || echo missing) is on PATH, .nvmrc wants $wanted_node: update NODE_VERSION in the environment's setup script." >&2
fi

if [ -n "${GCP_SA_KEY_B64:-}" ]; then
  key_file="$HOME/.config/gcloud/claude-code-dev.json"
  mkdir -p "$(dirname "$key_file")"
  (umask 077 && printf '%s' "$GCP_SA_KEY_B64" | base64 -d > "$key_file")
  echo "export GOOGLE_APPLICATION_CREDENTIALS=\"$key_file\"" >> "$env_file"
  gcloud auth activate-service-account --key-file "$key_file" --quiet > /dev/null 2>&1 \
    || echo "gcloud could not activate the service account (is gcloud installed?)." >&2
fi

if [ ! -d node_modules ]; then
  if ! npm ci --no-audit --no-fund > /tmp/npm-ci.log 2>&1; then
    echo "npm ci failed, see /tmp/npm-ci.log" >&2
  fi
fi
exit 0
