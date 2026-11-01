# Kingdom of the Fairies intake

Drop files for Kingdom of the Fairies here and ask for them to be integrated. Nothing in
this folder is published or loaded by the game.

- **Art:** name each image by its request id from
  [`../design/image-requests.md`](../design/image-requests.md), for example
  `ship.png` or `keepsake-tea.png`. The PNG is kept as
  `../design/generated/<id>-original.png`, the game gets a WebP copy in
  `../assets/`, and its slot in `../assets/manifest.json` is set to
  `delivered`.
- **Animation loops (Part D of the image requests):** a folder per loop,
  `anims/<id>/`, holding the source clip and `notes.txt` (where it came
  from), plus the prepared sheet and JSON if you made them. See
  [`../design/image-requests.md`](../design/image-requests.md), Part D.
- **Video stills and other references:** put them in `references/`, named
  `video-<mm>m<ss>s-<subject>.jpg`. They move to `../design/references/`.
- **The song or its stems:** any common audio format. The song moves to
  `../assets/audio/`, and the manifest's `audio.song` entry is set to
  `delivered`.

Each file is checked before it lands: images are opened and compared with
their request, audio is decoded, and the game is played with the file in
place. Afterwards the folder is emptied, leaving only this README. The
repository-wide rules are under "Intake" in [`CLAUDE.md`](../../CLAUDE.md).
