# Claude working agreement

## Native alpha first

Generate cutouts directly with genuine alpha transparency whenever available.
Verify usable alpha, clean edges and transparent gaps; preserve it in PNG/WebP.
Only try a flat-colour background and keying after native-alpha generation has
been attempted and fails to work properly. Never key already transparent art.
This supersedes older keying instructions and prompt fallbacks below.

## Deploy state: **ENABLED**

Deploy branch: `deploy`

This repository deploys from the `deploy` branch, not from `main`. Pushing to
`main` runs no workflow and costs nothing; the site is published only when
`deploy` is moved forward to `main`. This switch overrides every other
instruction in this file about deploying.

- **ENABLED** means deploy after every change, exactly as before the deploy
  branch existed: commit, push `main` as the rest of this file says, then
  publish it with `git push origin main:deploy`. That push deploys. A deploy
  that is already running always finishes, and pushes waiting behind it
  collapse into the newest one.
- **DISABLED** means deploys are off to save GitHub Actions minutes. Commit and
  push `main` as usual, so finished work still lands on `main`, but never push,
  merge or fast-forward `deploy`. End every change with this warning to the
  owner:
  > ⚠️ Deploys are disabled for this repo: the change is on `main` but NOT
  > deployed. The live site is still whatever `deploy` holds.
- **Turning deploys on** happens only when the owner explicitly asks to deploy,
  to enable deploys, or for a push to `main` that should go live. Change the
  heading above to `**ENABLED**`, commit and push `main`, then
  `git push origin main:deploy`. If the owner disabled the deploy workflow in
  the Actions tab, remind them to re-enable it.
- **Turning deploys off**, when the owner asks: change the heading to
  `**DISABLED**`, commit and push `main`. It costs nothing.
- `git push origin main:deploy` is always a fast-forward. Never force-push
  `deploy`. If the push is refused, `deploy` has commits `main` lacks: merge
  `origin/deploy` into `main` first, then push both.
- `.claude/hooks/deploy-guard.sh` enforces this for Claude sessions: while the
  heading says DISABLED it refuses any push to `deploy`. It reads the heading
  at the moment of the push, so flipping it to ENABLED is all it takes to let
  the push through.

Repository-wide instructions for Claude Code sessions in this repository.

## Repository layout: one folder per game

`art` is a collection of art games, moved here from the `mini` repository (the
four were mini's largest published games; mini's own copies stay there until
the move is finished and every link points here). **Each top-level folder is a
separate game**, apart from `shared/` (code more than one game uses: today the
browser-check helper `shared/test/lib.mjs`, and the library page's
controller check `node shared/test/library-gamepad.test.mjs`) and `local/` (ignored by Git:
dependencies, caches and build output).

| Folder | What it is | Published at |
| --- | --- | --- |
| `icecreamcone/` | The Ice-Cream Cone Coot (a field guide of rare birds from Arnold Lobel's book, with a minigame for each) | https://games.hoai.net/art/icecreamcone/ |
| `bronzedrum/` | Bronze Drum | https://games.hoai.net/art/bronzedrum/ |
| `kingdomofthefairies/` | Kingdom of the Fairies (includes the preserved Widow's Bay edition) | https://games.hoai.net/art/kingdomofthefairies/ |
| `fibreart/` | Fibre Art (a shifting collage after the fibre art, paintings and drawings of Hanneke de Neve: controllers move, stretch, swirl and dissolve the parts of her pictures) | https://games.hoai.net/art/fibreart/ |
| `stratford/` | Stratford (the prototype *Stratford Squirrel*: exploring a 3D model of downtown Stratford, Ontario as small creatures; unlisted, no library card or `/stratford/` page until the game proper) | https://games.hoai.net/art/stratford/prototype/ |

The site is published at https://games.hoai.net/art/ (the owner's
`hoai2k.github.io` user site serves every repository's Pages under its custom
domain, so this repository's site lives at `/art/`).

- **Keep each game inside its own folder.** Its code, design documents, asset
  requests, art, audio, tests, publish script and intake drop box all live
  there. Never put one game's files in another game's folder.
- **A new game gets a new top-level folder** with a `README.md`, an `intake/`
  folder (holding only its README), and a `publish.sh` that copies the
  playable build into `local/pages/<folder>/`. Add a build step for it to
  `.github/workflows/pages.yml` (through `.github/scripts/build-game.sh`, with
  its tests as `tests: full` steps), its unread `design/` or `reference/`
  folders to that workflow's sparse-checkout list, a link in the root
  `README.md`, a card on the game library page (`index.html`, in the owner's
  order: Kingdom of the Fairies, Bronze Drum, Fibre Art, The Ice-Cream Cone
  Coot; a new game goes at the top unless the owner says otherwise) and a row in the table above.
- **The root holds only what is shared.** `README.md` is a list of links to
  the games and nothing more; each game's details belong in its own README.
  `index.html` is the game library published at https://games.hoai.net/art/,
  one card per game. `GAME_GUIDELINES.md` applies to every game.
- **Which games deploy is the root `deploy_config.json`.** A folder set to
  `false` under `"games"` is not built or published (`build-game.sh` skips it
  without restoring a live copy) and its card is left out of the published
  library (`.github/scripts/deploy-config.py library`, run by the "Shared root
  files" step); games not listed deploy, and a missing or unreadable file
  deploys every game.
- **A game with a heavy workbench carries `<game>/deploy_config.json`**
  (`{"includeWorkbenches": true}`), read by its `publish.sh`: `false` leaves the
  workbench out of the deployed site (it still works locally), and a missing or
  unreadable file means `true`. Bronze Drum's sound workbench (about 10 MB of
  alternative takes) is the one today.
- **`kingdomofthefairies/deploy_config.json`** has `includeWidowsBay`, read by
  its `publish.sh`: `false` strips the Widow's Bay edition (its song, band art,
  title and icons) out of the deployed site and the published page plays the
  film edition for `?widowsbay=on`; a missing or unreadable file means `true`.
- **The deploy is optimised for Actions minutes and storage, and the
  optimisations are load-bearing:** it runs only on pushes to `deploy`, skips
  pushes that change nothing the site is built from (`paths-ignore`), checks
  out sparsely (the games' `design/` and `reference/` folders, about 2 GB, are
  never downloaded), never cancels a running deploy, carries a
  `timeout-minutes` on every job, and deletes the uploaded site artifact once
  Pages has it. A game whose build fails keeps its live copy
  (`build-game.sh`). Keep all of it when editing the workflow.
- **The Pages site is public even while this repository is private**, and
  GitHub Pages refuses a site over 1 GB. Each game's `publish.sh` copies only
  what the game loads; keep it that way.

## Always commit finished work to `main`

Every task ends on `main`. When a task is complete, do not leave the work
sitting on a feature branch or uncommitted: commit it, merge it into `main`,
push `main`, and say so in the final message with the resulting commit. This
applies to documents and asset requests as much as to code, because the user
generates art from the request documents on `main`.

1. Commit the work on the session's development branch as each piece is
   finished, and push the branch (pushes to a working branch run nothing).
2. Verify the change by running the checks of each game it touched. Each game's
   README lists them. This is the only place the tests run: a
   deploy builds and publishes without them (see "Tests and deploys" below).
   For changes that affect a published build, confirm the deployed page still
   plays.
3. Merge that branch into `main` and push `main`, once, at the end of the task,
   then (while deploys are ENABLED, see "Deploy state" above) publish it with
   `git push origin main:deploy`. The GitHub Pages workflow
   (`.github/workflows/pages.yml`) then builds and deploys every game;
   a game whose build fails keeps its live copy and the run says so in a
   warning.
4. Report the merge and the resulting `main` commit.

Open a pull request only when the user explicitly asks for one; otherwise merge
directly. Never merge work that is unfinished, untested, or known to be broken —
finish it or say plainly what is blocking, rather than merging a broken `main`.
When a task produces several independently useful pieces (a document, a request
list, a working feature), commit each as soon as it is finished and verified,
and push them to `main` together at the end of the task.

**Image and asset requests go first.** They are the one exception to a single
push at the end: when a task needs new artwork, write the request entries (and
regenerate the request documents) and push them to `main` before building the
feature that uses them (a push to `main` deploys nothing, so this costs no
Actions minutes), so the user can start generating
while the rest is written. The game keeps drawing its stand-ins until the art
arrives.

## Intake

Each game has its own drop box at `<game>/intake/` (`kingdomofthefairies/intake/`, `bronzedrum/intake/`, `icecreamcone/intake/`, `fibreart/intake/`, `stratford/intake/`). The user drops files there for
integration: artwork, audio, models, exported data, notes from another agent.
A file belongs to the game whose intake it was dropped in. If it plainly
belongs to a different game, move it there; if that is unclear, ask.

Process a drop rather than leaving it: verify each file against what it claims
to be, integrate what holds up, and empty the folder, keeping only its README.
Take artwork and machine-readable data as delivered, but rewrite accompanying
prose from what the files actually show — a drop's write-up is intent, not
repository documentation, and it may carry another machine's paths or a status
the repository has since moved past. Treat "done" or "verified" as a claim to
test; run the check where one can be run, and record the result either way.
Each intake README says where that game's files land; `kingdomofthefairies/intake/README.md` describes that game's processing steps.

## Agents

Use subagents where they save effort, and pick the model by the work (see
"Models" below): `sonnet` for mechanical edits, lookups, file-by-file chores,
well-specified implementation, tests and reviews with a clear contract; `opus`,
or the model left unset so it inherits, for design, architecture, gameplay
feel and anything open-ended. Give an agent the exact files, interfaces and
checks it must satisfy so a cheaper model can finish the job without guessing.

## No Git LFS

Don't use Git LFS anywhere in this repository: don't track any file with it. GitHub never frees LFS storage: a deleted or replaced LFS file keeps
counting against the account's 10 GiB until the whole repository is deleted
and recreated, and the allowance is shared by every project. Files over
GitHub's 100 MB limit go somewhere else (a GitHub Release, which the owner
creates), or ask.

## Tests and deploys

Deploys (pushes to `deploy`) build and publish only; they run no tests. Tests
are your job before you commit:

- Run the checks of each game your change touches (each game's README lists
  them; the `tests: full` steps of `.github/workflows/pages.yml` are the same
  commands). For a change to shared files (root `index.html`, `shared/`, the
  workflow or its scripts), run every game's checks.
- Say in the commit message what you ran and that it passed.
- The full tests can also be run on demand: Actions → Deploy games to GitHub
  Pages → Run workflow → tests: full.

Every deploy is paid for in GitHub Actions minutes while the repository is
private, so batch a task's work into one deploy at the end rather than
deploying after every small step. Pushes to `main` and to working branches run
nothing. A deploy
that is already running always finishes — never cancel one unless the owner asks
— and pushes waiting behind it collapse into the newest one. Pushes that only
change Markdown, `.claude/`, a game's `design/`, `intake/`, `research/`,
`reference/`, `qa/`, `tools/` or test folders, or `shared/test/` don't deploy
at all (`paths-ignore` in the deploy workflow; a new folder that
holds nothing the site is built from belongs in that list), and every workflow job carries a `timeout-minutes`, so a hung run
cannot bill for hours. Keep all three when editing a workflow.

## Models

- Only a session already running on Fable may start Fable subagents, workers or helper agents. Opus,
  Sonnet and every other model never pass model "fable"; they leave the model unset so it inherits, or
  pick Opus or Sonnet.
- Don't switch a session to Fable on your own. If a task seems to need Fable, ask me first and say why.
- This is enforced in `.claude/settings.json`: sessions in this repository default to Opus, and a
  PreToolUse hook (`.claude/hooks/block-fable.sh`) reads the calling model from the transcript and
  refuses a subagent or workflow call that asks for Fable unless the caller is itself Fable. When I ask
  for Fable, switch the main session with `/model`; don't edit the hook to get round it.
