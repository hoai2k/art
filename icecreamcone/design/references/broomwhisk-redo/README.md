# Broomwhisk pose redelivery

IC-M06f and IC-M06g replace the two older pose sheets. Full generated originals
are in `originals/`; the game uses fitted 2048×1024 and 3072×1024 RGBA atlases.
The original portrait remains the reference.

Each whole pose was isolated with its detached bristles, fitted into its own
1024-pixel cell and uniformly normalized to the portrait. SIFT/ORB checks of
the head and twine binding are recorded in `verification.json`; their mean
scales are within 2.5% of the portrait after fitting. No separate head or body
resizing was used. `placement.json` records the measured foot anchors.

The five new poses cover sweeping, flicking, pushing, bracing and pleased.
The standing portrait supplies the sixth state. The existing Broomwhisk game
checks pass, including its six-state sprite-size rig. Prompts, references and
generation ids are in `manifest.json`.

Rebuild from the repository root with
`python3 icecreamcone/design/source/prepare_broomwhisk_redos.py`
(requires Pillow, NumPy and OpenCV). The placement file is regenerated; copy its anchors into
`game/src/games/broomwhisk.js` if changing the preparation.
