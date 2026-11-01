# Cutscene workbench

A page for watching every cinematic in Kingdom of the Fairies in a big viewer and giving
notes on the choreography. Serve the `kingdomofthefairies/` folder and open
`workbench/` (`python3 -m http.server`, then `/workbench/`). It uses the game's
own acts and renderer, and loads the art from `../assets/`. Pick a scene in the
dropdown (the choice is in the URL hash, `#act1-ending`, and `#act1-ending@12.5`
opens at 12.5 s). Controls: play/pause, restart, speed, frame stepping, a scrub
slider (it re-simulates from the start at a fixed 1/60 s step and seed, so it is
deterministic), sound effects, HUD, film look, and **Extra Animations**
(remembered between visits), which plays the jellyfish loop and the people's old-film
idle frames as the game's setting does. The last scene, *Extra Animations ·
everything* (`#extra-animations`), shows the jellyfish loop and each person's
old-film idle frames side by side whatever that box says. Keys: Space, R, Left/Right
(Shift for one second). The timeline lists each phase with the time it begins.

**Add a cutscene:** add an entry to `SCENES` in `workbench.js`: an `id`, a
`title`, the `act` number (or `null`), a `note`, `create()` (build the act state
with `act.create({ seed, carry, from: { scene } })`), `input({ t, f, st, at,
beat })` (the scripted player, with `at(sec)` true on one frame), and `end(st,
t)` (when it is over). `max` is a safety limit in seconds.

**Set up directly in the workbench,** because the act has no scene for it:
Act III whale (sailor put just short of the pedestal, whale started), Act IV shore (sailor
put on the lip), Act V storm (climber put on the top hold, phase set to
`storm`). The curtain call is drawn by a copy of `drawCurtainCall` from
`src/main.js`, so keep the two in step.

The default viewer shows the film edition. Add `?widowsbay=on` for the preserved cast and title, or `?widowsbay=partial` for the classic acts without the band. Story continuity for future revisions is in `../design/film-story.md`.
