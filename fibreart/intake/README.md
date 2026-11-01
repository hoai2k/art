# Fibre Art intake

Drop files for Fibre Art (the `fibreart/` folder) here and ask for them to be integrated.
Nothing in this folder is published.

Photos of Hanneke de Neve's work go to [`../reference/`](../reference/README.md):
oriented, stripped of metadata, at most 1800 px on the long side, under a
descriptive name in `fibre/`, `paintings/`, `mixed-media/` or `photos/`, with a
row in the catalogue there giving what the piece is and where the photo came
from. Generated art is saved under the file name given in its **File** line in
[`../design/image-requests.md`](../design/image-requests.md). On integration it
moves to that path under `fibreart/game/`, its status is set to `delivered` in
`../design/source/build_requests.py`, the script is rerun, and the pieces on a
sheet are cut apart in the order the request lists them. Images on a flat
`#FF00FF` background have the magenta keyed out.

Afterwards the folder is emptied, leaving only this README. The
repository-wide rules are under "Intake" in [`CLAUDE.md`](../../CLAUDE.md).
