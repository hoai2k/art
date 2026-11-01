# Dialog overflow and outline audit

31 October 2026. The magenta rectangle was the shared `.scroll:focus-visible, .scroll.nav-focus` outline. Both Credits entry points explicitly focused that scrolling container, so opening static text selected and outlined the whole block. Its decorative font also extended below the original tight line boxes, creating unnecessary overflow.

Credits now uses a static definition list, focuses the Close action, and groups each credit for responsive columns. Looser script line spacing and compact layouts make all credits visible without scrolling or clipping. The longest legacy credits also fit a 320×480 window. No scrollbar is merely concealed over inaccessible text.

All game overflow surfaces use thin gold scrollbars on plum tracks, with WebKit fallback styling. The former magenta outline on shared scrolling areas is replaced by a quiet inset gold keyboard cue. Native controls and links have a gold focus fallback; intentional button highlights, pink decorative card rules and in-game danger effects remain.

The source audit covered the game stylesheet, shell/focus navigation, native editor controls and the workbench’s explicitly styled interactive focus states. The recurring content rectangle had one shared CSS cause; fixing that rule also prevents it on instructions and future `.scroll` content.

Verified through actual browser controls in all three editions at 1280×720, 800×360, 640×320, 390×844, 320×568 and 320×480, plus coarse-pointer phone layouts at 640×320 and 844×390 in film and legacy editions. Checks cover complete credit visibility, absence of scrollable/clipped credit content, initial Close focus, instructions/settings/scene/editor scrollbar colors, keyboard scrolling, dialog closing and absence of magenta/red content outlines. No page errors.

[Desktop credits](generated/ui-dialog-review/credits-desktop.webp) · [Phone credits](generated/ui-dialog-review/credits-phone.webp) · [Small legacy credits](generated/ui-dialog-review/credits-legacy-small.webp) · [Instructions](generated/ui-dialog-review/instructions.webp) · [Measurements](generated/ui-dialog-review/review.json).

Reproduce with `CHROMIUM_PATH=... node kingdomofthefairies/qa/dialogs-browser.mjs OUTPUT_DIR`.
