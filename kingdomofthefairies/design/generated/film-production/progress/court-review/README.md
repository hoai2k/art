# Court gameplay and sprite review

31 October 2026. Built-in imagegen created four connected capture pairs, installed as transparent WebPs. Each look is calibrated separately against the standing prince’s head. Foot anchors preserve his position when the guard/prince pair replaces both actors.

| Asset | Delivery | Native PNG | Generation prompt / references |
| --- | --- | --- | --- |
| Lobster | [WebP](../../../../../assets/prince-caught-lobster.webp) | [PNG](../../prince-caught-lobster-original.png) | [Record](../../prince-caught-lobster.json) |
| Lobster, tinted | [WebP](../../../../../assets/prince-caught-lobster-tinted.webp) | [PNG](../../prince-caught-lobster-tinted-original.png) | [Record](../../prince-caught-lobster-tinted.json) |
| Human | [WebP](../../../../../assets/prince-caught-human.webp) | [PNG](../../prince-caught-human-original.png) | [Record](../../prince-caught-human.json) |
| Human, tinted | [WebP](../../../../../assets/prince-caught-human-tinted.webp) | [PNG](../../prince-caught-human-tinted-original.png) | [Record](../../prince-caught-human-tinted.json) |

132 screenshots passed through the actual renderer: two cast looks × three film treatments × extra animation on/off × eleven scene/scale cases. The browser also sends actual X, right-arrow and Space keyboard events through the game’s input path, checking stationary bow, release-to-walk and jumping upward. No page errors.

| Look / film | Extra animation off | Extra animation on |
| --- | --- | --- |
| Original / off | [Sheet](original-off-still.webp) | [Sheet](original-off-animated.webp) |
| Original / gentle | [Sheet](original-gentle-still.webp) | [Sheet](original-gentle-animated.webp) |
| Original / full | [Sheet](original-full-still.webp) | [Sheet](original-full-animated.webp) |
| Tinted / off | [Sheet](tinted-off-still.webp) | [Sheet](tinted-off-animated.webp) |
| Tinted / gentle | [Sheet](tinted-gentle-still.webp) | [Sheet](tinted-gentle-animated.webp) |
| Tinted / full | [Sheet](tinted-full-still.webp) | [Sheet](tinted-full-animated.webp) |

[Measured sizes and actual sprite draws](review.json). [Original scale comparison](original-off-still-scale.webp); [tinted scale comparison](tinted-off-still-scale.webp). [Passed guards stay onstage](original-off-still-hall-parked.webp). [Hall capture](original-gentle-animated-hall-capture.webp); [human capture](tinted-full-animated-human-capture.webp).

Reproduce: `CHROMIUM_PATH=... node kingdomofthefairies/qa/court-browser.mjs OUTPUT_DIR`. Gameplay checks: `KOTF_EDITION=film node kingdomofthefairies/qa/court-film.test.mjs` (11), existing film suite (33), and Act III suites in each older edition (27 each) pass. Asset request and person-size checks pass. The sprite audit reports no redraws; its existing unrelated bosun template tie was retained unchanged.
