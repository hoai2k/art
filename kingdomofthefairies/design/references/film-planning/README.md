# Film adaptation planning artwork

[Browse the searchable gallery](index.html) for the ten character sheets and twenty scene concepts requested in [image-requests.md](../../image-requests.md). These interpretations follow the briefs in [the adaptation proposal](../../film-adaptation.md) and retain the existing painted toy-theatre aesthetic.

These are generated planning references for design review. They do not implement the proposal, replace runtime sprites, or change the playable chapters. They have not been approved as final production designs. The film itself and [film-story.md](../../film-story.md) remain the historical reference; gameplay inventions in the briefs, such as the sword retrieval and witch's scrying beam, remain adaptation ideas.

The character sheets were generated first. Each scene used the relevant delivered sheets as image references; named expanded-world scenery references were attached where requested. Neptune's seated shell-throne pose and the Water Fairy's revival vignette were added in generation revisions. Bel-Azor's betrothal costume was corrected to court dress before his enchanted arming.

Native imagegen PNG files are retained unchanged in `originals/`. The requested 2400 × 1600 character sheets and 2560 × 1440 tableaux are production targets; generated dimensions are recorded in the manifest and displayed in the gallery. No upscaling is applied. The gallery loads images lazily.

[manifest.json](manifest.json) records every original request brief, named scenery reference, revision notes and native/requested dimensions. Additional generation guidance is not fully retained; the prompts shown are the source request briefs. Character sheets also guided scene generation. The gallery links directly to each native PNG.

To rebuild the gallery and validate the originals:

```sh
python3 kingdomofthefairies/design/source/prepare_film_planning.py
python3 kingdomofthefairies/design/source/build_film_requests.py
python3 kingdomofthefairies/design/source/build_film_requests.py --check
```

The preparation script requires Pillow. All thirty request IDs, image decoding, native dimensions and gallery file targets are validated during preparation.
