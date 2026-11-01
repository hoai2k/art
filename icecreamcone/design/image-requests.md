# The Ice-Cream Cone Coot: image requests

Artwork still wanted for the Ice-Cream Cone Coot game in `icecreamcone/`. Only open requests are listed here; delivered and retired ones move to [`image-requests-history.md`](image-requests-history.md). Generated from `source/build_requests.py`; edit the data there and rerun it, which also rewrites the history and `icecreamcone/game/src/asset-list.js`.

## How to use this list

1. Each prompt is complete on its own: paste it as it stands. The shared style text is already in every prompt.
2. Save each image under the file name in its **File** line and drop it in `icecreamcone/intake/`. On integration it moves to that path under `icecreamcone/game/`, its status flips to `delivered`, the game loads it in place of its stand-in and the request moves to the history.
3. Images that need transparency say so in their prompts. If the generator cannot produce alpha, use a flat pure magenta `#FF00FF` background as the prompts say; it is keyed out on integration.
4. Opaque images are listed as `.webp`; PNG or JPEG is fine too, they are converted on integration.
5. Nothing here blocks the game: every image has a stand-in drawn in code until it arrives.
6. Prompts that name a reference photo of the book in `icecreamcone/reference/`, or an earlier painting, link to it. Give that image to the image generator along with the prompt where it can take an image.

## Status

0 requested, 228 delivered, 1 retired, 229 in total.

Nothing is waiting: every request has been delivered.
