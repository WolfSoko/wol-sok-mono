#!/bin/bash
# Setup script for the "wol-sok-mono" cloud environment on claude.ai/code.
# It is not run from the repo: paste it into the environment's "Setup script"
# field. It runs as root before Claude Code starts, and its result is cached
# for about seven days. Environment variables are not available here; the
# per-session work (PATH, GCP key, npm ci) is in session-start.sh.
set -euo pipefail

NODE_VERSION=24.21.0 # keep in sync with .nvmrc

curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" | tar -xJ -C /opt
ln -sfn "/opt/node-v$NODE_VERSION-linux-x64" /opt/node24

# Native build deps for gl (gpu.js), same list as .github/actions/install-deps
export DEBIAN_FRONTEND=noninteractive
{ apt-get update -y && apt-get install -y \
  build-essential pkg-config python3 python-is-python3 \
  libx11-dev libxext-dev libxi-dev libxrandr-dev libxfixes-dev libxcursor-dev libxinerama-dev \
  libgl1-mesa-dev libglu1-mesa-dev mesa-common-dev xserver-xorg-dev \
  libgtk-4-1 libgraphene-1.0-dev; } || echo "apt install failed, gl will not build" >&2

# npm starts through `env node`, which has to find Node 24, not the image's
export PATH="/opt/node24/bin:$PATH"
npm install -g firebase-tools || echo "firebase-tools install failed" >&2

curl -fsSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz \
  | tar -xz -C /opt || echo "gcloud install failed" >&2
