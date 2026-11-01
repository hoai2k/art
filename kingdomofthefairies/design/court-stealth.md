# Neptune’s court stealth

Film edition, 31 October 2026. Legacy editions keep their original controls and sentries.

Hall Doors uses a shared floor baseline at y=652. Its entry mark leaves room for both passed guards to stand visibly at x=240 and x=340, clear of the masking curtain. Both lobsters enter from the right. The first approaches while the second waits back; holding X bows and stops the prince immediately. The first passes and remains at the left. Advancing beyond its encounter position releases the second. A jumps for pearls. Each catch holds a connected lobster/prince capture pose before releasing the prince with brief protection.

In the court, X holds a stationary bow. Lobsters respect the bow anywhere; human guards and the scrying eye require a pink, blue or green courtier on the same groove. Human and lobster guards patrol continuously. A jumps upward one groove (or in place on the top groove); nearby people recoil briefly, then resume their paths. Down descends a groove. Touch retains a persistent Hide button and taps jump.

The red eye beam has an extended trailing edge shared by its drawing and collision geometry. Its source meets the painted iris at y=300. A warning precedes a full outward and return crossing, with both endpoints following the camera; only then does it fade. Masking by the whale/fish continues to work.

Four generated transparent capture pairs preserve the painted and tinted cast. Their native PNGs and generation prompts are in `generated/film-production/prince-caught-*.json` and `*-original.png`; delivered WebPs are in `assets/`. The prince’s head is calibrated against `prince-stand` separately in each look through `person_sizes.py` and `drawPerson`. Composite pairs replace both the standalone player and the capturing guard while the grab is held.

Verification: `qa/court-film.test.mjs` covers the guard sequence, locked bows, jumps/recoil, each guard/cover combination, captures and terminal captures, spotlight coverage and full sweep/fade. `qa/court-browser.mjs` renders both art looks × three film treatments × extra animation on/off, including both capture types, Hall Doors, bow, jump, beam directions and standing/capture scale comparisons. Review evidence is under `generated/film-production/progress/court-review`. The existing film and legacy Act III suites also run.
