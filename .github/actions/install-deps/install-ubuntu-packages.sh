#!/usr/bin/env bash
# Purpose: Install native build dependencies needed for node-gyp modules (gl, re2, etc.) on Ubuntu runners.
# The pipeline failed building `gl` due to missing pkg-config entries for x11/xi/xext.
# This script ensures all required dev packages are present.
#
# See failure: pkg-config --libs-only-L --libs-only-other x11 xi xext returned exit status 1.
# We therefore need the *-dev packages and pkg-config.
#
# Notes:
# - Use DEBIAN_FRONTEND=noninteractive to avoid prompts.
# - Include build-essential instead of separate gcc/g++/make for completeness.
# - Add libgl1-mesa-dev & libglu1-mesa-dev for OpenGL headers beyond mesa-common-dev.
# - Add libx11-dev (instead of non-existing package 'x11'), libxi-dev, libxext-dev, plus helpful related X11 libs.
# - Add pkg-config so node-gyp can resolve .pc files.
# - Add python3 + python-is-python3 for node-gyp Python invocation.
# - Add a verification step to fail fast if packages still not resolvable.
# - Safe re-run: apt-get update each run; install is idempotent.
#
# If builds keep failing for module `gl`, consider pinning Node to a version with prebuilt binaries or
# making the dependency optional for CI (e.g. npm ci --omit=optional if `gl` is optional).

set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "[install-deps] Updating apt package index"
sudo apt-get update -y

echo "[install-deps] Installing build essentials and dev libraries for X11 + OpenGL"
sudo apt-get install -y \
  build-essential \
  pkg-config \
  python3 python-is-python3 \
  libx11-dev libxext-dev libxi-dev libxrandr-dev libxfixes-dev libxcursor-dev libxinerama-dev \
  libgl1-mesa-dev libglu1-mesa-dev mesa-common-dev \
  xserver-xorg-dev \
  libgtk-4-1 libgraphene-1.0-dev

# Optional extras sometimes needed by native modules (left commented; uncomment if future errors reference them)
# sudo apt-get install -y libdrm-dev libudev-dev libegl1-mesa-dev libgbm-dev

echo "[install-deps] Verifying pkg-config entries for x11 xi xext"
if ! pkg-config --exists x11 xi xext; then
  echo "[install-deps][ERROR] pkg-config could not find one of: x11 xi xext. Dumping pkg-config paths for debugging." >&2
  echo "PKG_CONFIG_PATH=$PKG_CONFIG_PATH" >&2
  pkg-config --list-all | grep -E '(^x11$|^xi$|^xext$)' || true
  exit 1
fi

echo "[install-deps] Success: X11 and OpenGL development packages installed and detectable via pkg-config."
