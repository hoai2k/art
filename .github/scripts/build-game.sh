#!/usr/bin/env bash
# Build one game into local/pages/<folder>/ without letting it take the rest of
# the deploy down with it (.github/workflows/pages.yml).
#
#   .github/scripts/build-game.sh <folder> '<build command>'
#
# The command runs from the repository root with `bash -e`, exactly as the
# workflow step used to. If it fails, the game's live copy is published
# instead, so one broken game never stops the others:
#   1. rebuild the game from the commit that is live now (the head of the
#      last successful run of this workflow), which reproduces the live copy
#      exactly when the fault is in the new commit;
#   2. failing that, crawl the folder off the live site (fetch-live.py; it can
#      miss files the code names only at run time);
#   3. failing that, leave the folder out.
# Each failure is a workflow warning and a line in the job summary. A game
# that built is listed in $RUNNER_TEMP/built; check-games.sh fails the deploy
# only when none did.
set -u -o pipefail
folder="$1"
cmd="$2"
root="$(pwd)"
out="$root/local/pages/$folder"
state="${RUNNER_TEMP:-/tmp}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stderr}"

# A game switched off in the root deploy_config.json is not built or
# published at all (and is not a failure, so no live copy is restored).
if ! python3 "$root/.github/scripts/deploy-config.py" enabled "$folder"; then
  echo "$folder is off in deploy_config.json; not deployed"
  echo "- **$folder** is off in deploy_config.json: not deployed." >> "$summary"
  exit 0
fi

if bash -e -c "$cmd"; then
  echo "$folder" >> "$state/built"
  exit 0
fi

echo "::group::$folder failed to build; restoring the live copy"
rm -rf "$out"
how=""

live_sha="$(gh run list --workflow pages.yml --status success --limit 1 \
  --json headSha --jq '.[0].headSha' 2>/dev/null || true)"
if [ -n "$live_sha" ]; then
  old="$(mktemp -d)"
  if git fetch --quiet --depth=1 origin "$live_sha" \
    && git archive "$live_sha" "$folder" multiplayer/client | tar -x -C "$old" \
    && (cd "$old" && bash -e -c "$cmd") \
    && [ -d "$old/local/pages/$folder" ]; then
    mkdir -p "$(dirname "$out")"
    mv "$old/local/pages/$folder" "$out"
    how="rebuilt from the live commit ${live_sha:0:7}"
  fi
  rm -rf "$old"
fi

if [ -z "$how" ]; then
  rm -rf "$out"
  if python3 "$root/.github/scripts/fetch-live.py" "$folder" "$out" "${LIVE_SITE:-https://games.hoai.net/art}"; then
    how="copied from the live site (crawled, may be incomplete)"
  else
    rm -rf "$out"
  fi
fi
echo "::endgroup::"

if [ -n "$how" ]; then
  echo "::warning::$folder failed to build; kept the live version ($how)"
  echo "- **$folder** failed to build; kept the live version: $how." >> "$summary"
  echo "$folder" >> "$state/restored"
else
  echo "::warning::$folder failed to build and its live copy could not be fetched; it is left out of this deploy"
  echo "- **$folder** failed to build and its live copy could not be fetched: **left out of this deploy** (its pages will 404)." >> "$summary"
  echo "$folder" >> "$state/missing"
fi
exit 0
