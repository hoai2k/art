# Wedding music and closing credits, 31 October 2026

The user supplied “Procession Royale”; the prepared MP3 is installed as period-wedding. The source in Downloads is unchanged. delivery.json records source/delivery hashes and measured audio metadata.

The final ascent now leads to a five-second sparkling celebration, a 30-second credit roll, an eight-second coordinated score/scene fade and two seconds of black. Completion is saved on reaching the finale. The same wedding audio source continues through the roll; it is stopped while silent before the menu score returns softly. Pause freezes the credits and fade clock.

[In-game credits review](credits-review.webp) shows the celebration and scrolling text in both cast looks. [All six look/effect combinations](render-modes.webp) were rendered, including the full-black ending. audio-and-timing.json records actual browser audio output, source continuity and fade levels. The browser test also checks completion saving, pause/resume and returning to the playbill.

Checks: qa/finale.test.mjs, the film/art suites, the original acts under widowsbay and partial, and qa/finale-browser.mjs (Chrome).
