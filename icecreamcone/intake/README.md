# Ice-Cream Cone Coot intake

Drop files for the Ice-Cream Cone Coot game here and ask for them to be
integrated. Nothing in this folder is published or loaded by the game.

Save each image under the file name given in its **File** line in
[`../design/image-requests.md`](../design/image-requests.md). On integration it
moves to that path under `icecreamcone/game/`, its status is set to `delivered`
in `../design/source/build_requests.py`, and the script is rerun, which moves the
request to [`../design/image-requests-history.md`](../design/image-requests-history.md). Images on a
flat `#FF00FF` background have the magenta keyed out.

For a request kept in `../design/source/more/<bird>.json` (the new birds'
games), set `"status": "delivered"` on its entry there instead.

**A bird's painting (a portrait, `assets/subjects/<bird>.png`, or a pose).**
Check it against its request and the book before taking it: the object reads
at a glance, it faces left, the framing matches the other portraits, and it
is a bird in Lobel's manner. Then:

1. Show it to whoever builds or keeps that bird's game, so the game is
   matched to it: where its head, beak and feet are, the boxes the game uses,
   how its poses line up.
2. Check the poses again against the painting: every state the game shows
   the bird in that needs a differently drawn pose has its own variant
   request, citing the delivered portrait. Push any new requests to `main`
   at once.

**Music.** A track goes to `../game/assets/music/` (trimmed of silence at each
end, 112 kbps MP3) and is listed in [`../design/music.md`](../design/music.md)
with where it plays; `game/src/audio.js` and the `GAME_MUSIC` table in
`game/src/main.js` choose it.

Every round of new image requests goes to `main` as soon as it is written,
before the feature that uses it is finished, so the art can be started.

Reference material about the book goes in [`../reference/`](../reference/README.md)
instead, with a line in its README saying where it came from.

Afterwards the folder is emptied, leaving only this README. The
repository-wide rules are under "Intake" in [`CLAUDE.md`](../../CLAUDE.md).
