#!/usr/bin/env bash
# After the games are built (build-game.sh): fail the deploy only if not one
# game built, and say in the job summary which ones did not.
set -u -o pipefail
state="${RUNNER_TEMP:-/tmp}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stderr}"
built=$(cat "$state/built" 2>/dev/null | wc -l)
failed=$(cat "$state/restored" "$state/missing" 2>/dev/null | wc -l)
echo "$built built, $failed failed"
if [ "$built" -eq 0 ]; then
  echo "::error::No game built, so nothing is deployed."
  echo "**No game built, so nothing was deployed.**" >> "$summary"
  exit 1
fi
if [ "$failed" -eq 0 ]; then
  echo "All $built games and sites built." >> "$summary"
fi
