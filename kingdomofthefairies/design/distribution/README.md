# Distribution materials

Promotional assets and submission paperwork live here. This directory is
inside `design/`, which the website publication script does not copy and
the Pages build excludes from its sparse checkout. These materials are
separate from the actual playable game distribution.

## CrazyGames

- `crazygames/covers/v13/`: current covers with generated calligraphic titles, text-free
  masters, transparent title-only layers, and exact-size PNG exports.
- `crazygames/submission.json`: draft online submission text and settings.
- `crazygames/covers/v1/` through `v12/`: preserved design iterations and prompts.
- `crazygames/archives/`: older promotional asset packages.
- `crazygames/kingdom-of-the-fairies-covers.zip`: current cover pack.

The playable ZIP stays at `../../dist/crazygames.zip`. The SDK integration,
build script and checks stay at `../../distribution/crazygames/`. None of
the promotional files are added to the playable ZIP.
