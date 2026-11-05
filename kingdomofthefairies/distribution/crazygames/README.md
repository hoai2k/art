# CrazyGames distribution

This is a separate release target for Kingdom of the Fairies. The builder
reads the current working tree and adapts copies under `dist/`; it does not
edit `src/`, `index.html`, `styles.css`, `publish.sh`, or deployment settings.
The existing website and its two editions retain their normal behavior.

From the repository root:

```sh
node kingdomofthefairies/distribution/crazygames/build.mjs
node kingdomofthefairies/distribution/crazygames/preflight.mjs
node kingdomofthefairies/distribution/crazygames/check.mjs
```

The check uses the repository's shared Playwright installation and a local
HTTP server. Output:

- `kingdomofthefairies/dist/crazygames.zip`: upload this ZIP; `index.html` is at its root.
- `kingdomofthefairies/dist/crazygames/`: unpacked release for local preview.
- `kingdomofthefairies/dist/crazygames/release-info.json`: size checks and release configuration.
- `kingdomofthefairies/dist/crazygames-preview.png`: screenshot produced by the integration check.
- `kingdomofthefairies/dist/crazygames-preflight.json`: static checks and remaining portal/manual checks.
- `kingdomofthefairies/dist/crazygames-browser-checks.json`: browser results and measured initial asset requests.

`../../design/distribution/crazygames/submission.json` contains draft descriptions, control
instructions, reviewer notes, suggested positioning, and portal settings.
Enter those online and upload covers/videos separately. The game ZIP does
not populate the portal's submission form.

`dist/` is ignored by Git. Rebuild after editing the game. Checked source
replacements fail with an adaptation error if an upstream change invalidates
one of the distribution's patches. Update that patch and rerun the checks;
do not edit the generated files as the permanent fix. Builds include local,
uncommitted changes, so coordinate a final rebuild with other game work.

## SDK-free website preview

The normal website publication script also rebuilds this target at
`https://games.hoai.net/art/kingdomofthefairies/crazygames-preview/`.
It has the same film/colorized locks, deferred loading and automatic opening,
with a separate host toolbar for mute and fullscreen. It never loads the
CrazyGames SDK. Saves use a separate browser-local namespace so previewing
cannot change progress on the ordinary website. This is a playtesting build;
it cannot verify the real platform's SDK, cloud saves or overlays.

```sh
node kingdomofthefairies/distribution/crazygames/build.mjs --preview
node kingdomofthefairies/distribution/crazygames/check-preview.mjs
```

`--preview --out <directory>` rebuilds another output location. No upload ZIP
is produced for this preview; use the default SDK build for submission.

## What this target changes

- Locks the film edition and hand-tinted cast, including saved settings and
  query overrides. Hides the cast-look selector and disables the unlock editor.
- Packages only recorded film/colorized act artwork plus shared shell art,
  effects, and period music. Original slot metadata is retained for fitting,
  with tinted images aliased to base IDs for cast and walking resolution.
  No Widow's Bay song, band, legacy title, untinted character alternatives,
  workbench, design files, or macOS metadata are included in the ZIP.
- Downloads the title and selected act's artwork only. Later acts load on
  demand, with the existing loading/error card protecting entry into play.
  The optional jellyfish animation waits for Act II. Music loads for the
  current mood rather than fetching the entire score in the background.
  Shared sound effects still load on the first user gesture.
  Per-act dependencies are generated from initial, idle, active and
  stop/start states, including event-driven poses. Regenerate them with
  `qa/build-act-art.mjs` when scene drawing changes: deferred loading cannot
  rely on the normal website's background downloads to fill missing entries.
- Uses the HTML5 v3 SDK. Initialization precedes game startup and saved-game
  reads. Failure displays a reload action rather than silently starting with
  an unrelated local save. Gameplay events follow playable states, with
  pauses, menus, curtains, and noninteractive sequences excluded; loading
  events cover startup and act-art waits. Events are sent on transitions,
  not every frame.
- Saves game progress exclusively through the SDK Data module. Settings
  remain local to this portal origin. CrazyGames owns mute: the corner sound
  button and Settings sound toggle are hidden; old local mute preferences
  are ignored. Music/effects volume sliders remain available, and platform
  mute takes priority over them and updates live.
- Leaves fullscreen to CrazyGames: hides the fullscreen button, makes all
  fullscreen helpers no-ops, and removes standalone installation metadata
  and the iPhone browser-bar workaround. Submit as **landscape**.
  Existing safe-area-aware stage fitting and controls are retained; no fixed
  empty strip is reserved for platform chrome. Verify real devices in the
  CrazyGames App for notch and rounded-corner insets.
- Opens directly on the opening act introduction without a title-screen
  confirmation. Act cards advance after a brief 1.5-second presentation once
  required art is ready (or sooner on confirmation), without intertitle gates.
  Sound unlocks on the first keyboard/pointer gesture if browser autoplay
  policy prevents it initially. Static cards are not reported as gameplay;
  the SDK gameplay signal starts at the first controllable scene.
- Omits GoatCounter from this target. No custom analytics or advertisements
  are introduced. The standard website retains its analytics.

## Submission and remaining verification

1. Upload the ZIP in the CrazyGames Developer Portal. Enable **SDK Data
   module** in Progress Save (not Automatic Progress Save); the Data module
   is disabled if that option is not configured. Set landscape orientation.
2. Run their preview/QA with the real SDK, guest and logged-in progress,
   reloads, mute changes, fullscreen, keyboard, gamepad and touch. The local
   automated check mocks the SDK to verify calls and storage timing; it
   cannot certify host permissions, real cloud sync, or platform acceptance.
3. Check measured initial download in their tool. The builder checks the
   250 MB / 1,500-file total limits and a conservative 50 MB startup budget.
   Its bound includes every score track even though music is mood-deferred.
   The browser check also checks requested initial game assets against the
   20 MB mobile target; that local figure excludes remotely loaded SDK/fonts
   and is not a substitute for the platform measurement.
4. Supply the description, controls, cover images and silent preview videos.
   Review artwork/music distribution rights and current submission policies.
5. This target prepares SDK integration and saves, without monetization.
   Basic Launch has no monetization. Before adding ads for Full Launch,
   implement pause/mute/recovery callbacks at appropriate act boundaries and
   test unavailable ads and ad blockers.

The platform still performs editorial/technical review and evaluates Basic
Launch engagement before inviting a Full Launch. This package is ready for
that preview process, not a guarantee of acceptance.

This release target assumes ordinary non-exclusive publishing. CrazyGames
allows games published elsewhere, and itch.io's distribution license is
non-exclusive. An optional exclusivity agreement would need separate review
before keeping browser versions live on itch.io or the existing website.
Use the separate website/itch.io target there, not this SDK-dependent ZIP.

Official references:

- https://docs.crazygames.com/sdk/intro/
- https://docs.crazygames.com/sdk/game/
- https://docs.crazygames.com/sdk/data/
- https://docs.crazygames.com/requirements/technical/
- https://docs.crazygames.com/requirements/gameplay/
