# Kingdom of the Fairies: development direction

- The film edition (the default, or `?widowsbay=off`) follows Georges Méliès’s 1903 silent-film direction.
  Read `design/film-story.md`, `design/acts.md` and `design/image-requests.md`.
  Aurora, the water fairy and the hostile witch are distinct characters.
- Preserve gameplay unless a requested update explicitly changes it. Existing
  adaptation mechanics must not be described as canonical film events.
- Three editions (README.md): the default (the film edition, also
  `?widowsbay=off`), `?widowsbay=partial` (the original five acts with no
  band, song or guitar) and
  `?widowsbay=on` (the preserved original). Run the original acts' suites under
  `KOTF_EDITION=widowsbay` and `KOTF_EDITION=partial`, and the film suite under
  `KOTF_EDITION=film`. `?edit=local` sets each edition's unlocks in the browser.
- Only delivered period music plays by default. The modern song and band art
  are reserved for `?widowsbay=on`; preserve that edition and its source assets.
- Generate new sound effects through `design/source/build_sfx.py` in the same
  period-stage-foley style. Read `ELEVENLABS_API_KEY` from the environment;
  never commit secrets. Retain the existing tuning and processing.
- New artwork uses theatrical painted sets, front-on cut-outs and hand-tinted
  film texture. Treat generated references as interpretations, not film stills.
- Audit every character-sprite delivery with `design/source/audit_sprites.py`
  before calling it integrated: canvas size, feet on the canvas bottom, and
  each walking cycle's head dip and body size. It writes
  `design/sprite-audit.md` and the walking compensation in
  `src/sprite-fit.js`; request redraws for whatever it lists. Look at the
  frames in play as well, side by side and animated.
- Every other character keeps one person size across their sprites:
  `design/source/person_sizes.py` measures each sprite against the
  character's reference by the head (checked by eye on its `--sheet`, with
  `BY_EYE` where the template misreads) into `src/person-size.js` and
  `design/person-sizes.md`. Draw a character's sprites with `drawPerson` (or
  `personPx` as a pose's `std`) at one person height per scene, never into
  boxes of their own; add new sprites to its `CAST` and rerun it.
