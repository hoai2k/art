# Fibre Art checkpoint — 2026-10-08

## Requested stopping point

The Fibre Art chat was asked to commit its existing work to origin/main, then
pause and preserve its state in a document. This checkpoint was prepared by a
second chat after the original chat stopped showing progress. Its app status
still read active; no turn error was recorded. This document does not change
that chat's runtime status. Resume only when the user requests more work.

## Saved work

The project was renamed from hanneke to fibreart. All 60 image requests are
now marked delivered, including the twelve outstanding requests in this round:
HK-U02, HK-U05, HK-T01-B, HK-T02-C, HK-T06-C, HK-M02, HK-M04 and HK-A01–HK-A05.
Full-size files are in game/assets; prompts, references, image hashes, dimensions
and earlier rejected attempts are in design/image-deliveries.json.

The round adds the icon, control drawings, Viriditas ground, Moons and hearts
and Dancers piece sheets, tree and bird morph chains, loose leaves and petals,
and blink/wing animation assets. There are 82 extracted tableau pieces and ten
new extracted morph stages. Reviewed component selections are recorded in
tools/extract_pieces.py, which now supports --only to preserve existing cuts.

The web assets were rebuilt (378 images, about 22 MB). tools/build_web.py uses
the new delivered pieces, morph chains, icon and controls. game/src/overlay.js
uses control-specific glyphs with the existing drawings as fallback. The
browser-check script supports PLAYWRIGHT_EXECUTABLE_PATH for installed Chrome.

## Verification

The recovery chat reran these successfully:

- node --test fibreart/game/test/*.test.mjs (24 tests passed).
- python3 fibreart/design/source/build_requests.py --check.
- python3 fibreart/tools/build_web.py --check.
- git diff --check -- fibreart.
- SHA-256 and image integrity checks for all 60 delivery records.

The original chat's final browser check passed using installed Chrome:
title and logo, controller start and all inputs, swirl and scene changes,
pause/resume, control card, controller disconnect/reconnect, keyboard joining,
and no browser errors. It reported about 22 FPS under software WebGL.
Its screenshots were saved to /private/tmp/fibreart-round2-shots; these temporary
files are optional review material, not required to rebuild the project.

To rerun that check from fibreart/game in this environment:

```sh
PLAYWRIGHT_MODULE=/Users/hoai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node scripts/browser-check.mjs --shots /private/tmp/fibreart-checkpoint-shots
```

## Remaining review items

Generated layers and blink/wing replacements are approximate matches, not
pixel-identical edits of the composition. Review transitions and visual fit in
play. Fabric swatch seams may remain visible. Testing with real controllers and
other browsers is outstanding. No image requests remain outstanding.

During recovery, Git emitted non-monotonic-index errors for six AppleDouble
._pack-*.idx metadata sidecars on this volume. Their AppleDouble signatures
were verified, and they were moved to /private/tmp/fibre-git-appledouble-backup.
Git status and history then ran without these errors. No real pack/index files
were removed. The asset checkpoint commit is 4b4ec9d; it reached origin/main
through merge commit 1c11c09, preserving incoming Gliders and multiplayer work.


## Follow-up: pause-menu badges — 2026-10-08

Synced main to 7094130 and delivered the newly requested HK-U06 sheet:
game/assets/ui/pause-icons.png (2048 × 1024, alpha transparency). Eight badges
were generated with built-in image_gen using the existing icon, line drawings,
and two local artwork photos as references. The exact generation prompt and
image hash are stored in design/image-deliveries.json. All 61 requests are now
delivered. tools/build_web.py already integrates these eight badges through
ui.pause in game/web/scenes.json. Generated-data checks and badge alpha checks
passed. The web rebuild reused the committed encoded music because ffmpeg is
unavailable in this shell; existing animation encodings were preserved.

The installed-Chrome browser check passed after integration, including the
pause/resume flow, controller and keyboard input, music and all ten scenes,
with no browser errors. The pause screenshot was visually reviewed.


## Follow-up: fullscreen badge — 2026-10-08

Delivered HK-U07 at game/assets/ui/fullscreen-badge.png (512 × 512, RGBA).
Built-in image_gen used the pause badge sheet and Moons and hearts reference.
The exact prompt, dimensions and hash are in design/image-deliveries.json.
All 62 requests are delivered. The builder now maps this request to the
fullscreen icon; the title button loads it via data-icon. Only UI outputs were
rebuilt; existing art and music were preserved. Generated-data checks and a
focused installed-Chrome check passed. The title screenshot was reviewed:
the new badge loads, fits the button, and produces no browser errors.

Incoming main changes removed the resume and close picture badges and switched
the title buttons to the pause-badge style. The merge preserves these UI changes
and integrates fullscreen into their builder.
