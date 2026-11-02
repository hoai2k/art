# Surface-swimming strokes

Delivered all four F35 requests: [stroke A](../../../assets/prince-swim-surface-a.webp), [stroke B](../../../assets/prince-swim-surface-b.webp), [tinted A](../../../assets/prince-swim-surface-a-tinted.webp) and [tinted B](../../../assets/prince-swim-surface-b-tinted.webp). Each runtime cutout is 360 × 240 with genuine alpha. The character, rather than a painted rectangle of sea, is the only visible subject. Native PNGs are preserved in source/; the rejected tinted draft with an opaque water rectangle is retained separately in source/rejected/.

Generated with the built-in image_gen tool from the canonical Bel-Azor sheet and existing swimming art, then used stroke A as the reference for stroke B. Exact prompts, references and native tool paths are in [generation.json](generation.json). The used character-sheet preview is preserved in source/character-reference.png; its original is design/references/film-planning/originals/char-bel-azor.png.

prepare_surface_swim.py resizes and positions the complete native cutouts without repainting their alpha. The reviewed neck point maps to (234, 96): the waterline is 40% down the canvas. Person-size measurements match the face against prince-stand in each look; the by-eye values avoid the matcher mistaking the submerged silhouette for a standing body. Both strokes share one person size in each look.

Runtime rendering is left exactly as delivered by the other agent. These images and their measured sizes are ready for that agent to review; regeneration decisions are deferred to their feedback.

Validation: focused head/waterline/scale unit check, both looks in Chrome (A, B, both underwater strokes and shore arrival), full coast route/artwork browser audit, 58 film tests, the preserved Widow’s Bay five-act suites, shared animation/motion/walking/theme/loading/finale checks, sprite audit and request/person-size freshness checks. Browser evidence and screenshots are saved beside this note. The sprite audit’s unrelated fluctuating bosun fit was preserved at its existing value.
