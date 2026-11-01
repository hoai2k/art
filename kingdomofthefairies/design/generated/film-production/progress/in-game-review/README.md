# In-game art review, 31 October 2026

Reviewed the real renderer in all six cast/effect combinations. Each sheet contains a side-by-side standing/attack/witch size check, the actual fight states, the barrel dropping/landing/occupied handoff, and hanging/shaking/falling/shattered stalactites driven by the cavern physics.

| Cast | Off | Gentle | Full |
| --- | --- | --- | --- |
| Original | [Review](original-off.webp) | [Review](original-gentle.webp) | [Review](original-full.webp) |
| Tinted | [Review](tinted-off.webp) | [Review](tinted-gentle.webp) | [Review](tinted-full.webp) |

[Barrel handoff detail](barrel-handoff.jpg). [Measured per-look scales](scales.json) are identical across effect settings. The empty barrel's base and wooden rim height match the occupied barrel; body widths differ by under 8%. Native originals, correction prompts and generation IDs are in the parent production records.

The initial delivery did not connect the stalactite renderer to the delivered images. This review fixes that integration: the ceiling cap stays fixed while the spike shivers and falls, its painted tip follows the physics tip, and the painted fragments rest on the collision surface. Midair hits no longer leave floating rubble. The tinted strike now follows its own standing costume. Both barrel mouths have a shallow lower lip consistent with the view from above. Earlier art is retained under superseded-in-game-review/ and rejected/in-game-barrel-perspective/.

Reproduce with `CHROMIUM_PATH=... node kingdomofthefairies/qa/art-delivery-browser.mjs OUTPUT_DIR` (append `still` for Extra Animations off). All six combinations passed with no page errors; 132 scene captures passed across Extra Animations on and off. The main sheets and detail views show the animated path; [the still overview](still-overview.webp) checks the alternate path. [Still-path scales](scales-still.json) match the animated-path scales exactly. Seven film/art suites plus five legacy suites in each older edition passed. The sprite audit reports no redraws and the person-size fingerprint check passes.
