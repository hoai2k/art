# Bronze Drum intake

Drop files for Bronze Drum here and ask for them to be integrated. Nothing in
this folder is published or loaded by the game.

Save each image under the file name given in its **File** line in
[`../design/image-requests.md`](../design/image-requests.md). On integration it
moves to that path (`../game/assets/art/` for game art, `../design/references/`
for direction pieces). Its status is then set to `delivered` in
`../design/source/build_requests.py`, and the script is rerun. Images on a flat
`#FF00FF` background have the magenta keyed out.

Afterwards the folder is emptied, leaving only this README. The
repository-wide rules are under "Intake" in [`CLAUDE.md`](../../CLAUDE.md).
