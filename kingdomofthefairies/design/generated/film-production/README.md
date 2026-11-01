# Film edition production artwork

[Browse the searchable gallery](index.html).

This delivery follows the 100 production requests in [image-requests.md](../../image-requests.md), using the canonical [character sheets and tableaux](../../references/film-planning/index.html). Native imagegen originals and one generation record per request are retained here. Each record includes the full submitted prompt, reference paths and the generator's native file path.

Prepared WebP files live in the game's `assets/` directory, at their requested dimensions and anchors. `deliveries.json` records native sizes, sprite crops and placement. The source PNGs remain unchanged. The fitter aligns painted bounds; custom anatomical anchors, such as the swimming shoulder position and pull-up ledge line, need alignment review when these sprites are wired into gameplay. Preparation reuses the existing sprite-fitting routine; backcloths are resized to the requested full frame. Delivered film slots are marked in `assets/manifest.json`. Legacy sprites and images are retained.

The original 100 production requests from 11 October 2026 have been generated and prepared. The requests and manifest track delivery status; any future pending requests remain marked `requested`. The hourly request check additionally delivered `witch-storm` (520 × 340) and `playbill-film` (1400 × 2000), with seven blank act panels plus its title banner. Their native originals and submitted prompts are retained alongside the earlier 80 deliveries. The next hourly check delivered 13 additions: a distinct bosun, a second sleeping crewman, two idle frames each for four crew members and the Water Fairy, and a seated sailor without his guitar for the partial edition. The rejected mirrored bosun frame is retained under `progress/rejected/`; its replacement preserves the lantern and rope sides. A further hourly check delivered the five playable-prologue requests: `prince-court-walk-a`, `prince-court-walk-b`, `prince-bound`, `armour-helmet`, and `armour-shield`. They follow the delivered court-dress prince and canonical Bel-Azor character sheet. New images are available under their film asset IDs; this delivery does not change gameplay, remap legacy asset IDs, or implement the future story chapters.

To prepare saved results and update delivery status:

```sh
python3 kingdomofthefairies/design/source/prepare_film_production.py
python3 kingdomofthefairies/design/source/build_film_assets.py
python3 kingdomofthefairies/design/source/build_film_production_gallery.py
python3 kingdomofthefairies/design/source/build_film_assets.py --check
```

Generation runs keep full-resolution images on disk and print only progress metadata to avoid exceeding the conversation's image-content limit.

The film-witch correction pass replaced `witch-hooded`, `witch-cloud`, `witch-storm`, `witch-swoop`, and `witch-barrel` with the F7 briefs using the two source frames in `references/film-witch/`. All five were generated with built-in imagegen and reviewed for the visible old face, intact heavy sea-green hooded robe, bare old hands, plain staff where requested, and scene-specific pose. Native originals, full prompts, reference paths, generation IDs and review notes are saved in the per-asset records. Earlier spectre originals and their generation records are preserved under `progress/superseded-witch-spectre/`; their game sprites remain in `assets/interim/witch-*-spectre.webp`. Prepared replacements retain the requested dimensions, anchors and transparency.

## F8: tinted cast alternates

All 64 F8 alternates have been generated with built-in imagegen, reviewed and prepared at the original sprites’ dimensions and anchors. The existing sprite is the pose reference; the three source frames named in each brief guide the soft photographic stage finish and sparse stencil washes. Simplified gowns, plain armour and the gift fairies’ pointed hennins follow the character audit. Court-dress prince poses remain bareheaded and unarmoured. Crew idle frames additionally reference their accepted tinted standing sprite for costume and prop consistency. Native PNGs, full submitted prompts, references, generation IDs and review notes are retained in each `*-tinted.json` record. `progress/f8-requests.json` preserves the initial prompt set and `progress/f8-state.json` records completion. The man-at-arms’ idle-C head direction was corrected; the rejected take and its record remain under `progress/rejected/`.

The alternates are separate `assets/*-tinted.webp` files. Compare them in the film edition with **Settings › Cast look › Tinted**, or `?widowsbay=off&look=tinted`. Every existing original sprite remains unchanged. The production gallery links to both native originals and prepared files.

For a batch that only changes selected sprites, use `prepare_film_production.py --ids <id> ...`; it validates cached deliveries for the other sprites, preserving their existing encoding and refreshing review metadata.

F8 verification: all 64 originals and prepared sprites checked for readable image data, target dimensions, anchors, alpha, local references and accepted review records; all original game sprite files unchanged. A local browser loaded all 64 tinted sprites and rendered 36 film scenes with no page errors. The film gameplay, theme, animation and generated request checks passed.

The lobster anatomy review corrected both poses in both original and tinted looks. Each guard now has two shoulder-to-pincer arms and two legs. The closed pincers visibly enclose the halberd shaft; in the snap pose one pincer grips the upright weapon while the other opens. Enlarged grip/shoulder details were checked. Prior native PNGs, prepared WebPs and generation records are preserved in `progress/rejected/lobster-anatomy/`. The source briefs now state these anatomy and grip constraints explicitly.

## F9: the remaining film-edition tinted sprites

All 31 F9 requests are generated with built-in imagegen, reviewed and prepared: Neptune and attendants, the seahorse guard, dragon, sea spirit and idle frames, jellyfish and fish, four whale pieces, gifts, keepsakes, armour, sword, star pickup, tower window and pearl. Existing sprites supplied pose and framing; the three named film frames supplied photographic texture and stencil-colour references. Performers’ arms, hands and grips were additionally inspected in enlarged previews. The sea-spirit idle-B hair wash was corrected to match the grey-white standing/idle-C hair; its first take is preserved under `progress/rejected/`. Native originals and each submitted prompt, reference set, generation ID and review are retained per asset. The prompt set and completed state are in `progress/f9-requests.json` and `progress/f9-state.json`. Original-look sprites remain unchanged.

The user-marked sword hand in `prince-leap-tinted` was separately corrected: a coherent right gauntlet with distinct curled fingers enclosing the hilt and a naturally aligned wrist. The enlarged grip was reviewed. Its earlier native original, prepared sprite and record are retained in `progress/rejected/prince-leap-hand/`.

F9 verification: all 31 originals and prepared images passed dimension, anchor, alpha, reference-file and accepted-review checks; original-look sprite files stayed unchanged. The film gameplay, theme, animation and generated-request checks passed.

The browser check exposed a pre-existing asset-URL shadowing bug in the new tinted-fitting loader. Renaming the local original-slot variable preserves the caller’s base URL. After the fix, the browser loaded all 95 tinted sprites and rendered 36 film scenes with no page errors. `qa/assets-loader.test.mjs` covers original/tinted URLs, the opening load wave, and preservation of legacy fitting.

## Complete walking cycles (F10–F13)

Delivered 38 new images: 12 stride frames from the latest F10/F11 briefs, 14 normal passing poses, and 12 carrying-cycle frames. Each walk uses contact A → passing A → contact B → passing B through `src/walking.js`. Armed/court-dress Bel-Azor and Azurine have both looks; the shared sailor frames also load in the partial and Widow’s Bay editions. Carrying keeps the held woman and supporting arms in the frame throughout the cycle. Stair and slope walking insert passing phases between step poses; idle, airborne and climbing/swimming actions use their own selectors. Body scaling for carrying phases inherits the calibrated carrying pose.

Standing references fixed costume colours; prince stride-B attempts that copied A too closely were rejected and regenerated with clearer knee/foot placement. The sailor passing-A extra hand was removed after anatomy review. Rejected originals/records are preserved under `progress/rejected/`. Each accepted image has its native original, full submitted prompt, references, generation ID and review record. `progress/f10-f11-requests.json` and `progress/passing-requests.json` retain the prompt sets; their state files record completion.

The repository’s `GAME_GUIDELINES.md` and the character audit now document passing phases as a required part of walking sprite requests. Unit tests cover phase order, cadence, reverse positions, carrying names, stair phases and complete asset sets; the walking browser test checks both film looks and both older editions.

Verification passed: all 38 new originals/prepared files, transparency, dimensions, bottom anchors and references; complete walking sets in each look; all gameplay suites in the older editions plus the film suite; animation, motion, loader, walking and generated-request checks. The browser exercised contact/passing selection and actual passing draws in both film looks and both older editions, rendering all scenes without page errors. Existing sprite files remain unchanged.

## F14: stride repairs

All four F14 requests are delivered with built-in imagegen. The two Original-look prince stride-B redo images retain stride A’s costume and moderate stride span. Their prepared painted bounds match A (head top y=4 and ground y=360); export alignment needed about 2% vertical normalization, capped at 3%, with native PNGs unchanged. `install_as` makes preparation reinstall the reviewed redo files at `assets/prince-stride-b.webp` and `assets/prince-court-stride-b.webp`. Earlier native originals, prepared sprites and generation records are in `progress/superseded-f14/`; historical gallery records link to the archived art and identify the replacement.

The shared sailor strides retain his cap, coat, scarf, trousers, boots and sack, with one hand on the sack strap. Both head tops match the passing frames at y=0, and all four phases meet the ground at y=360. Delivering both strides activates the existing four-phase sailor resolver in the partial and Widow’s Bay editions. The tinted prince sprites stay as previously delivered. Native originals, full prompts, reference paths, generation IDs and accepted reviews are retained; `progress/f14-requests.json` and `progress/f14-state.json` record the batch.

Verification: requested dimensions, transparency, ground lines and head tolerances passed; runtime replacement bytes match the redo files. Walking, motion, theme, asset-loader, film gameplay and generated-document checks passed. Browser checks rendered every scene and exercised actual passing-frame selection in both film looks and both older editions without page errors.

## F15–F16: gifts and tinted walk repairs

Delivered all ten new requests with built-in imagegen: six empty-handed fairies in both looks and four tinted prince stride repairs. Original sprites supplied identity, pose and costume references; the passing poses supplied walking scale. The gifts are drawn separately until collected, then removed while the fairy remains. Crown prop anchors were adjusted to the delivered empty palms.

The walking repairs now have opposite contact legs and a natural 8 px head dip from the passing frames. Native originals are unchanged; proportional export sizing and at most 3% alignment place the feet on the ground and the head at the intended height. The audit reports no remaining canvas/ground or walking dip problems, and runtime WALK_FIT no longer needs compensation. Earlier strides and rejected duplicated-leg takes are preserved in progress/superseded-f16/ and progress/rejected/f16-duplicated-legs/. Per-image records retain complete submitted prompts, references, generation IDs and accepted reviews. progress/f15-f16-requests.json and f15-f16-state.json record the batch.

Verification: all ten deliveries passed size, alpha, references and accepted-review checks; replacement bytes match runtime files. Walking, asset loader, theme, film gameplay and generated-request checks passed. Headless Chrome exercised walking selection and rendered every scene in both film looks and both older editions without page errors.

## F17–F18: distinct crew and consistent lobster

All seven requests delivered with built-in imagegen. The man-at-arms standing and both idle frames in both looks now have an unplumed iron kettle-hat, short green/ochre cloak and striped red/ochre heater shield without the prince's star. Crew livery and the prince's contrasting design supplied references; each accepted standing redo supplied identity for its head-turn idles. The original-look red tunic take was corrected to blue/gold stripes and is retained under progress/rejected/f17-red-livery/.

The tinted lobster closed pose retains its crouch and halberd grip, with warm shaded red shell, dense sea-green/rose weed and pearl trim matching the open pose. Anatomy review confirmed two claw arms and a visible weapon grip. Prepared redo files are installed at the canonical runtime paths; previous native originals, prepared sprites and records remain under progress/superseded-f17-f18/. Act II's existing delivery gate now selects the corrected man-at-arms. Full submitted prompts, references, generation IDs and accepted reviews are saved per image and in progress/f17-f18-requests.json; the state file records completion.

Verification: all seven files passed requested dimensions, transparency, ground line, reference and installation checks. Sprite audit reports no outstanding redraws. Film gameplay (22 tests), walking, loader, theme and generated-document checks passed. Headless Chrome rendered every scene in both film looks and both older editions without page errors.

## F19–F20 generation batches

Batch 1 delivers `prince-wall-up-a`, `prince-wall-up-b` and their tinted variants. Native originals, full prompts, references, generation IDs and accepted reviews are retained per image. The rejected first A raised the wrong knee and is retained in `progress/rejected/f19-wrong-knee/`; the accepted rear view raises the right hand and left knee. `progress/f19-f20-requests.json` records all 100 active requests and `progress/f19-f20-state.json` checkpoints delivery between small batches.

Batch 2: `prince-wall-up-c`, `prince-wall-up-c-tinted`, `prince-wall-up-d`, `prince-wall-up-d-tinted`. Reviewed poses, costumes and transparency; prepared dimensions and bottom anchors passed.

Batch 3: `prince-wall-side-a`, `prince-wall-side-a-tinted`, `prince-wall-side-b`, `prince-wall-side-b-tinted`. Reviewed poses, costumes and transparency; prepared dimensions and bottom anchors passed.

Batch 4: `prince-wall-side-c`, `prince-wall-side-c-tinted`, `prince-wall-side-d`, `prince-wall-side-d-tinted`. Reviewed poses, costumes and transparency; prepared dimensions and bottom anchors passed.

Batch 5: `prince-wall-idle`, `prince-wall-idle-tinted`. Reviewed poses, costumes and transparency; prepared dimensions and bottom anchors passed.

Batch 5: `prince-wall-idle-b`, `prince-wall-idle-b-tinted`. Reviewed poses, costumes and transparency; prepared dimensions and bottom anchors passed.

Batch 6: `prince-wall-leap`, `prince-wall-leap-tinted`, `prince-wall-catch`, `prince-wall-catch-tinted`. Reviewed poses, costumes and transparency; prepared dimensions and bottom anchors passed.

## F19–F20 completion, 16 October 2026

Delivered the remaining 76 film sprites with built-in imagegen: ten climbing transitions plus 66 scene poses, in both Original and Tinted looks. The prior 24 climbing frames remain intact. Every native PNG, submitted prompt, reference set, generation ID and accepted review is retained; progress/f19-f20-requests.json contains the complete 100-image prompt set, and f19-f20-remaining-requests.json records this 76-image completion. Both progress states now show no remaining requests.

The poses cover wall impact and ledge mantling, crawling and rising, lying face up/down, tumbling, diving and underwater swimming, collar lifting, kneeling and lifting, ladder carrying, court-dress actions, crew crawling/tumbling/waking, and attendant tumbles. Existing cast sprites supplied identity and style references; phase B used accepted phase A references where a paired action required it. The existing wall-frame resolver can select all delivered F19 transitions. F20 images are prepared under their requested scene-pose IDs in the asset manifest.

User-marked anatomy errors were corrected with imagegen: the near right hand of prince-lying-front-tinted and the oversized head/long neck of prince-kneel-rise-tinted. The hand was reviewed in an enlarged crop and the head proportions checked against the standing prince. Pull-up arms, alternate crawl placement and a hidden ladder-carry grip were also corrected during review. Prior takes are preserved under progress/rejected/ in the named correction folders. Native originals are unchanged during ordinary proportional sizing to the requested transparent game canvases.

The older pending reveller-lady-idle-b veil repair is also delivered, with its original and full records in design/generated/round-4/. Its grey lace veil, skirt grips, costume, framing and opposite pointed toe were reviewed; the 220 × 420 WebP is installed for the legacy idle cycle.

Verification: all 76 new film originals and prepared sprites passed reference, accepted-review, dimensions and transparency checks. The manifest has no pending requests, including the repaired legacy idle. Gallery targets verified for all 354 film production images; generated-document checks and sprite audit passed. Animation, walking, sailor motion, asset-loader, theme and all 30 film tests passed. Headless Chrome rendered every scene in both film looks and both older editions without page errors; a separate browser check loaded the repaired lady and verified the A/B/A/C selection.

## F21–F23: sleeping crew, court gestures and abduction, 30 October 2026

Delivered all 22 pending images with built-in imagegen in both Original and Tinted looks: eight individual sleeping crew sprites, four Aurora glide phases, four bound-prince struggle phases, two Azurine swoons and four flying demon carriers. Game-sized alpha WebPs are installed in assets/ and all slots are delivered. Full-resolution native originals and per-image JSON retain the final submitted prompts, references, generation IDs and accepted reviews. progress/f21-f23-requests.json retains the request set; final correction prompts are in the individual records. Rejected drafts remain in progress/rejected/f21-f23/. The user-marked far-arm error on demon-teal-carry was regenerated and reviewed in an enlarged preview; both arms now connect visibly to their shoulders.

Verification: all 22 prepared files have the requested dimensions, transparent backgrounds and bottom anchors; native files and reference paths exist. The gallery verifies all 376 production deliveries. Film gameplay (31 tests), loader, walking, animation, movement, theme, board and Act V suites passed. Browser checks rendered all scenes in both film looks and both older editions without page errors. Legacy Act II/III/IV suites fail identically against the synced main manifest; no gameplay code was changed. progress/f21-f23-validation.json records the delivery checks.

## F24–F26: cavern hazards and the witch's last stand, 31 October 2026

Delivered all 12 requests with built-in imagegen in Original and Tinted looks: hanging and shattered stalactites, the prince striking, the witch casting and recoiling, and the empty upside-down barrel. Native PNGs are unchanged, with final submitted prompts, exact references, generation IDs and reviews in per-image JSON. The request set is in progress/f24-f26-requests.json; corrected final prompts are in the individual records. Rejected geometry, framing and costume drafts are retained in progress/rejected/f24-f26/. Prepared transparent WebPs are installed in assets/, marked delivered, and included in the 388-image production gallery.

The witch's fingers and staff grips were corrected. The later in-game review matches the tinted prince's costume to his own standing reference. Transparent composites were reviewed against a solid background. The strike and witch poses are registered in person_sizes.py so drawPerson retains the standing character's scale; the casting pose's wide silhouette and the recoil's slipped hood required by-eye checks on the character sheet. Sprite audit reports no redraws. Dimensions, transparency, anchor and reference checks are recorded in progress/f24-f26-validation.json. Film gameplay, animation, motion, loader, theme and walking suites pass; the original acts pass under both KOTF_EDITION=widowsbay and partial. Browser checks render all scenes in both film looks and older editions without page errors.

## In-game integration and visual review, 31 October 2026

[Review sheets for all six look/effect combinations](progress/in-game-review/README.md) cover standing-size comparisons, the fight, the barrel handoff and the full stalactite lifecycle. This review caught and fixed the missing painted-stalactite renderer integration, midair-hit rubble floating at the prince's height, the tinted strike's costume mismatch and the empty barrel's size/perspective mismatch. The fixed ceiling cap stays behind when the spike detaches; the painted tip follows the physics tip. Rubble rests on the impact surface. Barrel body/rim/base alignment and character scale are checked separately for each cast look. Earlier art remains archived; final per-image records contain the correction prompts.
