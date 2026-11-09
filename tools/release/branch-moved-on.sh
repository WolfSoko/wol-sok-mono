#!/usr/bin/env bash
# Usage: branch-moved-on.sh <branch> <validated sha>
#
# Exits 0 when <branch> on origin no longer points at <validated sha>, after
# writing a notice and, in GitHub Actions, the step summary: the release job
# then stands down, since the run for the branch's newer commit releases this
# commit's changes too (or already did). Exits 1 while the branch still points
# at the commit, and 2 on wrong usage or a failed fetch.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <branch> <validated sha>" >&2
  exit 2
fi
branch="$1"
validated_sha="$2"

git fetch --quiet origin "$branch" || exit 2
if [[ "$(git rev-parse FETCH_HEAD)" == "$validated_sha" ]]; then
  exit 1
fi

echo "::notice::$branch moved on since this run started, the run for its newest commit releases instead."
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "No release: \`$branch\` moved on since this run started, the run for its newest commit releases instead." >> "$GITHUB_STEP_SUMMARY"
fi
