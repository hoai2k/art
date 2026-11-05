// ============================================================================
// THE GAME'S WORDING: the one place to edit every piece of text the game
// shows or speaks to screen readers, and the one file to translate.
//
//  - Plain strings are used as written.
//  - Where a sentence needs a value from the game (a number, a name, a
//    button), the entry is a small function, e.g. hit: (n) => `Hit. ${n}
//    lanterns left.`; keep the argument names and change only the words.
//    Placeholders for buttons stay as written: [CONFIRM], [A], [B], [X], [MENU], [LS]
//    are drawn as the player's own controller glyphs.
//  - A "\n" inside a string is a line break on the card.
//  - Entries ending in Classic, Legacy or Widowsbay (and everything under
//    `widowsbay`) belong to the preserved Widow's Bay edition; the film
//    edition (the default) uses the others.
//  - In the film edition, words() in src/theme.js still swaps "guitar" for
//    "sword" in the entries that pass through it (Act II's).
//  - `html` holds the text of index.html (title screen, pause menu, settings,
//    the Instructions pages, credits). Its values are HTML, so keep any
//    <strong>, <em> and <span class="xb …"> tags; the page keeps the same text
//    as its fallback if scripts fail.
//
// This file imports nothing, so every module can import it.
// ============================================================================
export const TEXT = {
  // ---------------------------------------------------------------------------
  // Titles (src/theme.js picks one by edition)
  // ---------------------------------------------------------------------------
  titles: {
    film: 'Kingdom of the Fairies',
    widowsbay: "Widow's Bay",
    tower: 'The Enchanted Tower',   // the last act's title in the film edition (BAY_TITLE)
    stageLabel: (title) => `${title} stage`,   // screen-reader name of the stage in the Widow's Bay edition
  },

  // ---------------------------------------------------------------------------
  // The keepsakes' names on the plaque (src/art.js LABEL)
  // ---------------------------------------------------------------------------
  hud: {
    keepsakes: { leaf: "Aurora's star", tea: "Aurora's stars", pearl: "Neptune's seal", rose: "The Water Fairy's blessing", guitar: 'The enchanted sword', stone: "Aurora's lamp" },
    keepsakesClassic: { leaf: 'Tea leaf', tea: 'Tea leaves', pearl: 'Her pearl', rose: 'Sea rose', guitar: 'The guitar', stone: 'The stone' },
  },

  // ---------------------------------------------------------------------------
  // The placeholder act (src/acts/rehearsal.js)
  // ---------------------------------------------------------------------------
  rehearsal: { action: 'A: continue', banner: 'IN REHEARSAL', continue: 'Press [CONFIRM] to continue the story' },

  // ---------------------------------------------------------------------------
  // The shell: everything around the acts (src/main.js, src/touch.js, src/art.js)
  // ---------------------------------------------------------------------------
  shell: {
    // Settings dialog values
    settings: {
      on: 'On', off: 'Off', follow: 'Follow', wholeStage: 'Whole stage', tinted: 'Tinted', original: 'Original',
      film: { full: 'Full', gentle: 'Gentle', off: 'Off' },
    },
    sound: { on: 'Sound on', off: 'Sound off' },
    controllerConnected: 'Controller connected.',
    curtainCall: 'Curtain call.',
    // The act card shown before each act
    card: {
      sceneSub: (retry, sceneName) => `${retry ? 'Carrying on from' : 'Scene'}: ${sceneName}`,
      tapToBegin: 'Tap to begin',
      tapToBeginWith: (hint) => `Tap to begin · ${hint}`,
      pressToBegin: 'Press [CONFIRM] to begin',
      announceAct: (kicker, title, sceneName) => `${kicker}, ${title}.${sceneName ? ' ' + sceneName + '.' : ''}`,
    },
    // Waiting for the song and the scenery
    loading: {
      orchestra: 'Tuning the orchestra',
      band: 'Tuning up the band',
      cardOrchestra: 'TUNING THE ORCHESTRA',
      cardBand: 'TUNING UP THE BAND',
      tuning: (what, pct) => `${what}… ${pct}%`,
      musicFailed: 'The music could not be loaded',
      ready: 'Ready',
      announceReady: 'Ready.',
      // an act's card, A pressed before its art is in
      stage: 'SETTING THE STAGE',
      announceStage: 'Setting the stage.',
      sceneryFailed: 'The scenery could not load. Please reload.',
    },
    // The retry card after a lost act (an act's own lostTitle and lostSub override these)
    lost: {
      title: 'The Sea Keeps\nHer Own',
      tryAgain: 'try again',
      tryAgainFrom: (sceneName) => `try again from ${sceneName}`,
      promptTouch: (again) => `Tap right to ${again} · tap left for the playbill`,
      promptOther: (again) => `[CONFIRM] ${again[0].toUpperCase() + again.slice(1)} · [B] The playbill`,
      announce: (again) => `The act is lost. Press [CONFIRM] to ${again}.`,
    },
    pause: {
      controllerLost: 'Controller disconnected — reconnect it, or carry on with keys or touch.',
      rotate: 'Turn the device sideways to carry on.',
    },
    playbill: {
      announce: 'The playbill. Choose an act.',
      hint: {
        touch: 'Tap an act to begin · tap outside for the title',
        pad: '[LS] Choose · [CONFIRM] Begin · [B] The title',
        key: 'Click an Act · Tab / [CONFIRM] · Esc menu',
      },
      subtitleFilm: 'A TOY THEATRE IN A PROLOGUE AND SIX ACTS',
      subtitle: 'A TOY THEATRE IN FIVE ACTS',
      best: (n) => 'best ' + n,
      locked: '· · ·',
    },
    scenes: {
      label: (n) => `SCENE ${n}`,
      note: 'Play on to open more scenes.',
    },
    title: {
      leftStick: 'left stick',
      hintTouch: 'Tip: Add to Home Screen to play full screen',
      hintPadNav: (glyph) => `${glyph('A')} Select · ${glyph('MENU')} Start`,
      hintPad: (glyph) => `Move ${glyph('LS')} for options · ${glyph('A')} Start`,
      hintKey: 'Press Space to start · Tab for options',
    },
  },

  // ---------------------------------------------------------------------------
  // Touch controls: button names and drag hints
  // ---------------------------------------------------------------------------
  touch: {
    verb: { leap: 'Leap', jump: 'Jump', light: 'Light', take: 'Take', swim: 'Swim', hide: 'Hide', action: 'Action', refuse: 'Refuse', wake: 'Wake', bow: 'Bow', skip: 'Skip', dive: 'Dive', gift: 'Gift', title: 'Title', strike: 'Strike' },
    // The hint on the act card (Tap to begin · ...)
    actHint: {
      1: 'drag to sail, swipe to change row, tap to leap',
      2: 'drag to swim, tap Swim to kick; on the moon boat, drag to sail, swipe to change row, tap to leap',
      3: 'drag to walk, swipe to change groove, tap to hide',
      4: 'drag to walk, swipe up or tap to leap',
      5: 'drag to climb, tap Leap to leap',
    },
    actHintDefault: 'drag to move',
    // The hint shown over the stage while playing
    scheme: {
      tapOnBeat: 'Tap on the beat',
      sailFilm: 'Drag ↔ to sail · swipe ↕ to change row',
      sail: 'Drag ↔ to sail · swipe ↕ to change row · tap to leap',
      swim: 'Drag to swim',
      walkLeap: 'Drag ↔ to walk · tap to leap',
      walkGroove: 'Drag ↔ to walk · swipe ↕ to change groove · tap to hide',
      walkSwipeUp: 'Drag ↔ to walk · swipe up or tap to leap',
      climb: 'Drag to climb',
    },
  },
  // ---------------------------------------------------------------------------
  // ?edit=local: the panel for choosing unlocked acts (src/editor.js)
  // ---------------------------------------------------------------------------
  editor: {
    unlocksButton: 'Unlocks',
    unlocksLabel: 'Unlocked acts',
    close: 'Close',
    heading: 'Unlocked acts on this machine',
    note: 'Each version of the game keeps its own progress. Choose how far each one is open; it is saved in this browser only.',
    done: 'Done',
    thisPage: '(this page)',
    noParameter: 'no parameter',
    unlocked: 'Unlocked',
    open: 'open',
    locked: 'locked',
    filmName: 'The film edition (default)',
    filmActs: ['Prologue · The Betrothal', 'Act I · The Royal Crossing', 'Act II · The Water Fairy', "Act III · Neptune's Court", "Act IV · The Whale's Passage", 'Act V · The Enchanted Tower', 'Act VI · The Burning Tower'],
    widowsbayName: "Widow's Bay",
    widowsbayActs: ['Act I · The Crossing', "Act II · The Sleepers' Grotto", "Act III · The Sea King's Court", "Act IV · The Whale's Road", "Act V · Widow's Bay"],
    nothing: (first) => `Nothing unlocked (only ${first})`,
    upTo: (act) => `Up to ${act}`,
    everything: 'Everything unlocked (every act and every scene)',
    describeAll: (n) => `All ${n} acts can be chosen on the playbill, and every scene of each in the scene select.`,
    describeOne: (first) => `Only ${first} can be played; the others open as each is finished. Scenes open as they are reached.`,
    describeSome: (first, last, k, n) => `${first} to ${last} can be chosen on the playbill (${k} of ${n}); the rest stay locked. Scenes open as they are reached.`,
  },

  // ---------------------------------------------------------------------------
  // Button glyphs inside prompts ([A], [B], [X], [MENU], [LS], src/art.js)
  // ---------------------------------------------------------------------------
  glyphs: {
    // the key cap drawn for each button on a keyboard
    keys: { A: 'Space', B: 'Backspace', X: 'X', MENU: 'Esc', LS: '← →' },
    // the pill drawn for each button on a touch screen (A and X take the scene's own verb)
    touch: { A: 'Tap', X: 'Action', B: 'Back', MENU: '❚❚', LS: 'Drag' },
  },

  // ---------------------------------------------------------------------------
  // Prologue: The Betrothal (film edition; src/acts/prologue.js, prologue-art.js)
  // ---------------------------------------------------------------------------
  prologue: {
    kicker: 'Prologue',
    title: 'The Betrothal',
    sub: 'Receive the fairies’ gifts for your bride.',
    action: 'X: take, give · A: leap',
    scenes: ['The Betrothal', 'The Abduction', 'The Arming'],
    touchHint: 'drag to walk, tap to leap',
    lostTitle: 'The Chariot\nGets Away',
    lostSub: 'Leap the fire it drops: touching it costs a lantern.',
    fairies: { flower: 'Aurora', ring: 'the fairy of the ring', crown: 'the fairy of the crown', gold: 'the fairy of gold' },
    receive: 'Receive',
    takeHand: 'Take Princess Azurine’s hand',
    // each gift: the prompt over the fairy, what the screen reader says, the words that burst when taken
    gift: {
      flower: { receive: 'Receive the flower', gives: 'the flower', burst: 'The flower!' },
      ring: { receive: 'Receive the ring', gives: 'the ring', burst: 'The ring!' },
      crown: { receive: 'Receive the crown', gives: 'the crown', burst: 'The crown!' },
      gold: { receive: 'Receive the gold', gives: 'gold', burst: 'Gold!' },
    },
    arm: {
      helmet: { take: 'Take the helmet', announce: 'The helmet.', burst: 'The helmet!' },
      shield: { take: 'Take the shield', announce: 'The shield.', burst: 'The shield!' },
      sword: { take: 'Take the sword', announce: 'The sword.', burst: 'The enchanted sword!' },
    },
    skipKey: 'BACKSPACE · SKIP SCENE',
    skipPad: '[B] SKIP SCENE',
    // the silent-film cards: [title, subtitle]
    captions: {
      court: ['The Betrothal', 'Receive the fairies’ gifts for Princess Azurine'],
      curse: ['The Uninvited', 'The witch curses the betrothal and carries Azurine off'],
      rampart: ['The Abduction', 'Run after the chariot · press [A] to jump'],
      escape: ['The Abduction', 'The chariot is gone into the night'],
      bind: ['The Armoury', 'The witch binds the prince'],
      free: ['The Arming', 'Aurora, the princess’ fairy godmother, breaks the spell.'],
      armoury: ['The Arming', 'Press [X] to take the helmet, shield and enchanted sword'],
      toShip: ['The Arming', 'Now to your ship'],
    },
    announce: {
      scene: {
        court: 'The betrothal court. Walk to each fairy and press [X] to receive her gift for Princess Azurine.',
        curse: 'The witch, uninvited, curses the betrothal.',
        rampart: 'Her demons bear Azurine away in a chariot of fire. Run after it along the rampart. Press [A] to jump over the fire it drops.',
        bind: 'In the armoury the witch binds the prince, and laughs at him.',
        free: 'Aurora, the princess’ fairy godmother, breaks the spell.',
        armoury: 'Press [X] to take the helmet, shield and enchanted sword Aurora gives you.',
      },
      gift: (from, gift) => `${from} gives ${gift}.`,
      betrothed: 'The prince takes Azurine’s hand.',
      witchFlees: 'The witch flees from Aurora.',
      seized: 'The witch and her demons seize the princess.',
      carriedOff: 'They carry Azurine away.',
      armed: 'Armed for the rescue.',
      toShip: 'Go to your ship.',
    },
  },

  // ---------------------------------------------------------------------------
  // Act I: The Royal Crossing (film) / The Crossing (Widow's Bay)
  // (src/acts/act1.js, act1-art.js). Keys ending in Classic, Legacy or the
  // like are the Widow's Bay edition's wording.
  // ---------------------------------------------------------------------------
  crossing: {
    kicker: 'Act I',
    title: 'The Royal Crossing',
    titleClassic: 'The Crossing',
    sub: "Sail for the witch's tower; she will turn the wind.\nGather Aurora's three stars on the way.",
    subClassic: 'The witch will turn the wind.\nGather the three tea leaves for the reading.',
    action: 'change row to dodge',
    actionClassic: 'A: leap',
    revelryBurst: 'Revelry!',
    scenes: {
      sail: 'Setting Sail',
      secondStar: 'Toward the Second Star',
      secondLeaf: 'Toward the Second Leaf',
      thirdStar: 'Toward the Third Star',
      thirdLeaf: 'Toward the Third Leaf',
      lastStretch: 'The Last Stretch',
      tempest: 'The Tempest',
      celebration: 'The Celebration',
      witchStrikes: 'The Witch Strikes',
      witchTurn: "The Witch's Turn",
    },
    announce: {
      hit: (n) => `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`,
      mended: (n) => `A lantern mended: ${n} whole.`,
      starFilm: (n) => `Aurora's star ${n} of 3.`,
      leaf: (n) => `Tea leaf ${n} of 3.`,
      windBehind: 'The wind is turning behind you.',
      windAgainst: 'The wind is turning against you.',
      arriveLegacy: "Widow's Bay in sight.",
      arriveFilm: "The sky blackens: the witch's tempest.",
      arrive: 'The enchanted tower in sight.',
      cheerFilm: "The witch's tempest! The crew light the ship's lanterns against the dark.",
      cheer: 'A celebration on deck! Press [A] on the beat to light the lanterns.',
      revelryFilm: 'Every lantern lit: they hold against the storm.',
      revelry: 'Every lantern lit.',
      strike: 'The witch strikes the mast.',
      shipBreakFilm: 'The royal ship breaks on the rocks.',
      shipBreak: 'The ship breaks apart.',
      swordSinks: "Aurora's sword sinks into the deep.",
    },
  },

  // ---------------------------------------------------------------------------
  // Act II: The Water Fairy (film) / The Sleepers' Grotto (Widow's Bay)
  // (src/acts/act2.js, act2-art.js). Wording that mentions the guitar is
  // turned into the enchanted sword in the film edition by words() in
  // src/theme.js.
  // ---------------------------------------------------------------------------
  grotto: {
    kicker: 'Act II',
    title: 'The Water Fairy',
    titleClassic: "The Sleepers' Grotto",
    sub: 'Follow the sinking sword down.\nGrab pearls with [X] and get air from the bubbles.',
    subClassic: 'Follow the sinking guitar down.\nSound the conch horns to wake the drowned.',
    action: 'A: kick',
    scenes: {
      wreck: 'The Wreck',
      grotto: 'Into the Grotto',
      caves: 'The Deep Caves',
      dragon: "The Dragon's Floor",
      waterFairy: 'The Water Fairy',
      witchOffer: "The Witch's Offer",
      procession: 'The Marine Procession',
      moonBoat: 'The Moon-Boat Ride',
    },
    // words that rise from the figure
    burst: {
      followGuitar: 'Follow the guitar down',
      conch: 'The conch sings! Wake the sleepers',
      awake: (n) => `Awake ${n}`,
      airOut: 'Out of air!',
      airLow: 'Air low: find a vent',
      air: 'Air!',
      airFull: 'Air full',
      guitar: 'The guitar!',
      sleepersRise: 'Every sleeper wakes!',
      witchLaugh: 'Her laugh rings through the grotto',
    },
    airWarning: 'AIR!',
    breathing: 'Breathing in',
    reach: { tapPearl: 'Tap to take the pearl', tapWake: 'Tap to wake him', takePearl: '[X] Take the pearl', wake: '[X] Wake him' },
    dive: { hintTouch: 'Tap an open clam for its pearl · get air from the bubbles', hint: '[X] Grab pearls · get air from the bubbles' },
    swimIntoConch: 'Swim into the conch',
    catchSword: 'Catch the sword',
    catchGuitar: 'Catch the guitar',
    offer: {
      title: 'The Water Fairy offers her blessing',
      titleClassic: 'She offers you the sea rose',
      hint: 'Swim to her to receive it',
      hintClassic: '[A] Take it · [B] Refuse, or swim away',
    },
    rideHint: 'Sail, change row and leap to gather the pearls.',
    announce: {
      sailorWake: 'The Water Fairy breathes life into the prince. He wakes among his drowned crew.',
      swimStart: 'Follow the sword down. Grab pearls with [X] and get air from the bubbles.',
      conchBlow: 'The conch sings. Swim close to your crew to wake them.',
      swordCatch: 'You catch the enchanted sword.',
      witchOffer: 'The Water Fairy waits by the wreck. Swim to her for her blessing.',
      roseTake: 'Her blessing revives the rest of your crew.',
      rideStart: 'The marine procession. Sail, change row and leap to gather the pearls.',
      drown: 'The prince sinks.',
      crewWake: (n) => `A crewman wakes. ${n} woken.`,
      // Widow's Bay edition
      sailorWakeClassic: 'The witch breathes life into the sailor. He wakes among the drowned.',
      swimStartClassic: 'Swim down after the guitar. Press [A] to kick. Sound the conch to wake the sleepers.',
      conchBlowClassic: 'The conch sings. Swim close to the sleepers to wake them.',
      sleeperWake: (n) => `A sleeper wakes. ${n} woken.`,
      hit: (n) => `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`,
      airLow: 'Air running low. Find a vent.',
      eelGlow: 'Eyes glow in a hole.',
      guitarCatchClassic: 'You catch the guitar.',
      witchOfferClassic: 'The witch offers the sea rose. [A] to take it, [B] to refuse.',
      roseTakeClassic: 'You take the sea rose. Every sleeper wakes.',
      witchLaugh: 'You refuse the rose. The witch laughs.',
      rideStartClassic: 'The moon boat. Sail, change row and leap to gather the pearls.',
      drownClassic: 'The sailor sinks.',
    },
  },

  // ---------------------------------------------------------------------------
  // Act III: Neptune's Court (film) / The Sea King's Court (Widow's Bay)
  // (src/acts/act3.js, act3-art.js)
  // ---------------------------------------------------------------------------
  court: {
    kicker: 'Act III',
    title: "Neptune's Court",
    titleClassic: "The Sea King's Court",
    sub: "Cross Neptune's hall to his seal of passage.\nThe witch is watching through her scrying eye.",
    subClassic: "Cross the Sea King's hall to the treasury\nand take her pearl from its pedestal.",
    // the silent-film intertitle after the act card (Widow's Bay only)
    intertitleClassic: "Hide beside a courtier\nfrom the Sea King's lantern.\n\nTake her pearl from the pedestal\nat the far end of the hall.",
    action: 'X: hide · A: jump',
    actionClassic: 'A: hide',
    touchHint: 'Drag to walk · hold Hide to hide · tap to jump up a level',
    touchScheme: 'Drag ↔ to walk · hold Hide to hide · tap to jump up',
    scenes: { doors: 'The Hall Doors', throne: 'Before the Throne', witchSide: "The Witch's Side", treasury: 'The Treasury Steps' },
    // the lobster palace tableau's card
    palace: { title: 'The Lobster Palace', sub: 'Hold [X] to bow and let each guard pass', subTouch: 'Hold [X] to bow and let each guard pass' },
    holdToBow: 'Hold [X] to bow',
    pearlsOf: (n, total) => `Pearls ${n} of ${total}`,
    leapForPearlsTouch: 'Tap to leap for the pearls',
    leapForPearls: 'Leap with [A] for the pearls',
    hideHintTouch: 'Hold Hide to hide behind a courtier from guards and from the witch’s eye',
    hideHint: 'Hold [X] to hide behind a courtier from guards and from the witch’s eye',
    burst: { bow: 'Bow to pass!', spotted: 'Spotted!', unseen: 'Unseen +25', whaleHides: 'The whale hides you: go!', pearl: 'Her pearl' },
    lost: {
      title: 'Seized by\nthe Court',
      sentry: 'The red sentries do not sleep for strangers.',
      lobster: 'Bow and let the lobster guard pass.',
      guard: 'Hide beside a courtier from the human guards.',
      eyeFilm: "Hide beside a courtier from the witch's eye.",
      eye: "The Sea King's lantern found you out.",
    },
    announce: {
      hit: (n) => `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`,
      spottedFilm: "Spotted by the witch's eye!",
      spotted: 'Spotted by the gaze lantern!',
      gazeFilm: "The witch's eye sweeps",
      gaze: "The Sea King's lantern turns",
      gazeTurn: (sweeps, fromLeft) => `${sweeps} ${fromLeft ? 'from the left' : 'from the right'}. Hide beside a courtier!`,
      whaleNearFilm: "Neptune's whale is coming.",
      whaleNear: 'The whale is coming.',
      whalePassFilm: "Neptune's whale passes.",
      whalePass: 'The whale masks the hall: the lantern cannot see you.',
      pearlTakenFilm: "Neptune's seal: he grants you passage on his whale.",
      pearlTaken: 'You take her pearl.',
      swallowFilm: 'The whale takes you aboard.',
      swallow: 'The whale swallows the court.',
    },
  },

  // ---------------------------------------------------------------------------
  // Act IV: The Whale's Passage (film) / The Whale's Road (Widow's Bay)
  // (src/acts/act4.js, act4-art.js, act4cavern.js, act4cavern-art.js)
  // ---------------------------------------------------------------------------
  whale: {
    kicker: 'Act IV',
    title: "The Whale's Passage",
    titleClassic: "The Whale's Road",
    sub: "Neptune's whale carries you toward the tower.\nRide the wreckage up on its breath to the daylight in its throat.",
    subClassic: "Swallowed whole. Ride the wreckage up on the whale's breath\nand climb to the daylight in its throat.",
    action: 'A: leap',
    scenes: {
      belly: 'The Belly',
      ribLedges: 'The Rib Ledges',
      wreckField: 'The Wreck Field',
      farWreckage: 'The Far Wreckage',
      ribcage: 'The Ribcage',
      caveMouth: 'The Cave Mouth',
      darkPools: 'The Dark Pools',
    },
    // the stage manager's cue board
    cue: { low: 'LOW TIDE', inhale: 'BREATHE', breath: 'BREATH' },
    burst: {
      lampFound: "Aurora's lamp!",
      stoneFound: 'The stone!',
      caveLamp: "Aurora's lamp lights the way",
      caveDark: 'Into the dark',
    },
    caveCaption: 'Through the cavern to the sea · leap the black pools · run from a shaking stalactite',
    lost: {
      swallowedTitle: 'Swallowed\nWhole',
      swallowedSub: 'The whale keeps what it takes.',
      darkTitle: 'Lost in\nthe Dark',
      darkSub: 'The cavern keeps the way to the tower.',
    },
    announce: {
      hit: (n) => `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`,
      breathCue: 'The whale is about to breathe in.',
      inhale: 'The whale breathes in. The water rises.',
      lowTide: 'Low tide. The stomach floor is bare.',
      lampFound: "Aurora's lamp.",
      stoneFound: 'The stone.',
      daylight: 'Daylight in the throat.',
      caveEnter: "Aurora points the prince to a cave in the cliff: the way to the witch's tower.",
      caveLamp: ' Her lamp lights the dark.',
      dropShake: 'A stalactite shakes loose above.',
      caveExit: 'Out of the cavern, onto the night sea.',
      beachSurfFilm: 'The whale sets you down on a rocky shore. Aurora points the way.',
      beachSurf: 'The whale lies beached on a rocky shore.',
    },
  },

  // ---------------------------------------------------------------------------
  // Act V: The Enchanted Tower (film edition; src/acts/act5film.js, act5film-art.js)
  // ---------------------------------------------------------------------------
  tower: {
    kicker: 'Act V',
    title: 'The Enchanted Tower',
    sub: 'Climb the cliff and dive for the witch’s tower.\nSwim the sea gap, then climb the tower to her window.',
    action: 'A: leap',
    touchHint: 'drag to climb, tap Leap to leap; in the sea, drag to swim, tap Dive to dive',
    touchSwim: 'Drag to swim · tap to dive',
    scenes: { cliffFoot: 'The Cliff Foot', halfway: 'Halfway Up the Cliff', seaGap: 'The Sea Gap', wall: 'The Tower Wall', top: 'Top of the Tower' },
    window: { title: 'Her Window', sub: 'Azurine is held inside' },
    swimHint: 'Swim right for the tower · [A] dives under her swoop',
    burst: { missed: 'Dodged!', auroraLight: "Aurora's light!" },
    lost: {
      seaTitle: 'The Sea Takes\nHim Down',
      towerTitle: 'The Tower\nThrows Him Off',
      cliffTitle: 'The Cliff\nGives Way',
      seaSub: 'When her shadow darkens the water, press [A] to dive.',
      cliffSub: 'Watch the dust: the stone falls where it gathers.',
    },
    announce: {
      hit: (n) => `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`,
      clifftop: 'The top. He dives for the tower.',
      swimStart: 'Swim for the tower. Press [A] to dive under the witch.',
      witchSwoop: 'The witch is swooping down! Dive!',
      auroraLight: "Aurora's light drives the witch away.",
      towerFoot: 'The tower. Climb to her window.',
      stoneWarn: 'Dust above: a stone is about to fall.',
      holdCrumble: 'The dry ivy tears away.',
    },
  },

  // ---------------------------------------------------------------------------
  // Act VI: The Burning Tower (film edition; src/acts/act5film.js, act5film-art.js)
  // ---------------------------------------------------------------------------
  burning: {
    giftTitles: {
      'wedding-gift-golden-goblet': 'Golden goblet',
      'wedding-gift-storybook': 'Storybook',
      'wedding-gift-hand-mirror': 'Hand mirror',
      'wedding-gift-jewel-casket': 'Jewel casket',
      'wedding-gift-perfume-flask': 'Perfume flask',
      'wedding-gift-harp': 'Harp',
      'wedding-gift-rose-basket': 'Rose basket',
      'wedding-gift-coin-purse': 'Coin purse',
      'wedding-gift-silk-fan': 'Silk fan',
      'wedding-gift-nightingale': 'Nightingale',
      'wedding-gift-feather-brooch': 'Feather brooch',
      'wedding-gift-star-pendant': 'Star pendant',
      'wedding-gift-silk-ribbons': 'Silk ribbons',
      'wedding-gift-porcelain-teacup': 'Porcelain teacup',
      'wedding-gift-candlestick': 'Candlestick',
      'wedding-gift-music-box': 'Music box',
      'wedding-gift-silver-bells': 'Silver bells',
      'wedding-gift-lute': 'Lute',
      'wedding-gift-shell-comb': 'Shell comb',
      'wedding-gift-golden-key': 'Golden key',
    },
    kicker: 'Act VI',
    title: 'The Burning Tower',
    sub: 'The witch’s demons set the tower alight.\nClimb to Azurine and carry her out before it falls.',
    action: 'A: leap',
    touchHint: 'drag to walk and climb, tap Leap to leap',
    touchWalk: 'Drag ↔ to walk',
    touchCelebrate: 'Drag ↔ to walk · tap to celebrate',
    touchStairs: 'Drag to walk · up and down on stairs and ladders',
    scenes: { inside: 'Inside the Tower', carrying: 'Carrying Her Down', cliff: 'Out on the Cliff', lastAttack: "The Witch's Last Attack", wedding: 'The Wedding' },
    lost: {
      fireTitle: 'The Fire Takes\nthe Tower',
      fireSub: 'The ceiling shudders before it falls.',
      flamesTitle: 'Engulfed\nin Flames',
      flamesSub: 'The witch engulfed you in flames. Try again.',
    },
    burst: { onceMore: 'Once more!', hit: 'A hit!', beaten: 'Beaten!', whirlpool: 'Into the whirlpool!', lamp: "Aurora's lamp!" },
    // the gold arrow's label over the way on
    waypointOut: 'Way out',
    waypointHer: 'To her',
    // on-stage hints
    climbHint: 'Climb the stairs and ladders to Azurine · [A] leaps the burnt gaps',
    duelHint: '[A] leaps her fire · [X] strikes with the sword',
    barrelHint: 'She still threatens you! Push her barrel over the edge',
    weddingHint: 'Dance with the guests · walk up the stairs and through the door',
    giftTouch: 'Tap Gift to accept the gift',
    giftKey: '[X] Accept the gift',
    jumpHint: '[A] Jump into the light beneath Aurora',
    returnTouch: 'Tap Title to return to the title screen',
    returnKey: 'Press [X] to return to the title screen',
    battleCaptions: {
      faceoff: 'Aurora holds the witch at bay',
      arrival: 'You bring Azurine to Aurora’s protection',
      setdown: 'You set Azurine gently down behind Aurora',
      rise: 'Azurine is safe behind Aurora',
      forward: 'Azurine is safe behind Aurora',
      settle: 'Face the witch',
    },
    endCard: { title: 'The Kingdom of the Fairies', sub: 'The end' },
    announce: {
      hit: (n) => `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`,
      beamWarn: 'The ceiling shudders.',
      liftHer: 'You lift Azurine. Carry her down and all the way to the right as the fires die away.',
      floorBreak: 'The way you came is gone. A ladder drops at the right.',
      houseFall: 'Out onto the clifftop. The tower is falling.',
      faceoff: 'Aurora holds the witch at bay.',
      battleArrival: 'You arrive with Azurine in your arms.',
      azurineSheltered: 'Azurine is safe behind Aurora.',
      battleReady: 'Face the witch. Leap her fire with [A] and strike with [X]; Azurine remains sheltered behind Aurora.',
      witchStruck: 'A hit! She pushes you back. Leap her next fire and approach again.',
      witchBeatenShort: 'The witch is beaten.',
      witchRepel: 'She drives you back.',
      witchBlast: 'She blasts you back.',
      witchBeaten: 'The witch is beaten. Aurora shuts her in a barrel.',
      witchInBarrel: 'Push the barrel over the cliff.',
      barrelFall: 'Into the whirlpool!',
      wedding: 'The wedding. Dance with the guests, climb the stairs and walk through the doorway.',
      apotheosis: 'Jump into the light beneath Aurora when you are ready.',
      ascend: 'The Kingdom of the Fairies.',
      floatDown: 'You float gently down.',
      demonArrives: 'A demon runs in behind you and sets the doorway alight.',
      leaveToTitle: 'Returning to the title screen.',
      giftFirst: 'The Water Fairy gives you a gift.',
      gift: (n, title) => `The Water Fairy gives you a gift: ${title}. Gift ${n}.`,
      finale: 'The end. Credits: principal game designer Hoai Nguyen; after Le Royaume des fées by Georges Méliès. Thank you for playing.',
    },
  },

  // ---------------------------------------------------------------------------
  // Widow's Bay edition only: Act V, the climb and the three endings
  // (src/acts/act5.js, act5-art.js). The act's title is BAY_TITLE (src/theme.js).
  // ---------------------------------------------------------------------------
  widowsbay: {
    kicker: 'Act V',
    sub: 'Climb the cliff to the stone house.\nCarry her out of the fire.',
    intertitle: "Climb anywhere on the rock:\nfastest up the ivy and the cracks.\nPush up into a ledge to haul yourself onto it.\n\nOnly the giant's boot lifts you over the lip:\nride it up on the beat.\nDust above means a stone is about to fall.",
    action: 'A: leap',
    scenes: {
      cliffFoot: 'The Cliff Foot',
      halfway: 'Halfway Up the Cliff',
      house: 'The Burning House',
      carrying: 'Carrying Her Down',
      quay: 'The Quay',
      ending: 'The Ending',
      pageant: 'The Pageant',
    },
    burst: { sheltered: 'Sheltered', stone: 'The stone!', shortcut: 'Shortcut!', locked: 'Locked fast' },
    lost: {
      cliffTitle: 'The Cliff\nGives Way',
      houseTitle: 'The Fire Takes\nthe House',
      cliffSub: 'Watch the dust: the stone falls where it gathers.',
      houseSub: 'The ceiling shudders before it falls.',
    },
    // the three endings' silent-film cards: [title, subtitle]
    captions: {
      witch: ["The Sea Witch's", 'She claims him for the sea. The beloved is safe on the quay.'],
      lamp: ['A Lamp in the Window', 'She waited. Her pearl is home on its chain.'],
      dark: ['The Window is Dark', 'Another waits in her doorway. The stone goes into the bay.'],
    },
    announce: {
      hit: (n) => `Hit. ${n} lantern${n === 1 ? '' : 's'} left.`,
      stoneWarn: 'Dust above: a stone is about to fall.',
      holdCrumble: 'The hold crumbles away.',
      clifftop: 'The clifftop. The stone house.',
      houseOpen: 'The house is burning. Its front swings open. Climb to her.',
      beamWarn: 'The ceiling shudders.',
      shutterLocked: 'The shutter is locked fast.',
      shutterSmash: 'The stone breaks the shutter. Climb the ivy.',
      liftHer: 'You lift her. Carry her down: no leaping now.',
      floorBreak: 'The way you came is gone. A ladder drops at the right.',
      houseFall: 'Out onto the quay. The house is falling.',
      ending: { witch: "The Sea Witch's. Her moon boat claims him.", lamp: 'A lamp in the window.', dark: 'The window is dark.' },
      pageant: 'The pageant.',
    },
  },

  // ---------------------------------------------------------------------------
  // The rolling credits (src/finale.js CREDITS; the sizes and positions stay there)
  // ---------------------------------------------------------------------------
  credits: {
    title: 'Kingdom of the Fairies',
    tagline: 'A hand-tinted toy theatre',
    designerRole: 'Principal Game Designer',
    designer: 'Hoai Nguyen',
    afterRole: 'After the film',
    film: 'Le Royaume des fées (1903)',
    director: 'Georges Méliès',
    songRole: 'Video game inspired by the song',
    song: "Widow's Bay",
    songBy: 'by Langan, Frost, and Wane',
    thanks: 'Thank you for playing',
  },

  // ---------------------------------------------------------------------------
  // index.html: every [data-text="html.…"] element is filled from here by
  // src/theme.js (fillText), before the Widow's Bay swaps. Values are HTML
  // (inline <strong>, <em> and the controller glyph <span class="xb …">);
  // the page keeps the same text as its fallback. Keys ending in Widowsbay
  // are the Widow's Bay edition's wording (plain text).
  // ---------------------------------------------------------------------------
  html: {
    title: {
      heading: 'Kingdom of the Fairies',
      headingWidowsbay: 'Widow’s Bay',
      by: 'by',
      band: 'After Georges Méliès · 1903',
      bandWidowsbay: 'Langan, Frost & Wane',
      pressStart: 'Press Start',
      loadbar: 'Tuning the orchestra…',
    },
    pause: {
      heading: 'Intermission',
      resume: 'Resume',
      settings: 'Settings',
      credits: 'Credits',
      restart: 'Restart Act',
      scenes: 'Scene Select',
      title: 'Return to Title',
    },
    scenes: {
      heading: 'Scene Select',
    },
    credits: {
      heading: 'Credits',
      show: 'Kingdom of the Fairies',
      showWidowsbay: 'Widow’s Bay',
      showSub: 'a toy theatre in six acts',
      showSubWidowsbay: 'a toy theatre in five acts',
      principalGameDesigner: 'Principal Game Designer',
      hoaiNguyen: 'Hoai Nguyen',
      mainThemeWidowsBay: 'Main theme, “Widow’s Bay”',
      langanFrostWane: 'Langan, Frost &amp; Wane',
      theMusicVideoThatInspired: 'The music video that inspired the game',
      directedAndEditedByNam: 'Directed and edited by Nam Nguyen',
      afterTheFilm: 'After the film',
      // (the dialog's own wording; the end roll's is credits.songRole)
      songRole: 'Inspired by the song',
      leRoyaumeDesFEs: '<em>Le Royaume des fées</em> (1903), Georges Méliès',
    },
    settings: {
      heading: 'Settings',
      sound: 'Sound:',
      music: 'Music',
      effects: 'Effects',
      periodAccompaniment: 'Period accompaniment:',
      filmLook: 'Film look:',
      castLook: 'Cast look:',
      mobileCamera: 'Mobile camera:',
      vibration: 'Vibration:',
      dragToMove: 'Drag to move',
    },
    chrome: {
      barsHint: 'Swipe up to hide Safari’s bars · or Share → Add to Home Screen',
    },
    rotate: {
      title: 'Turn the theatre sideways',
      sub: 'Kingdom of the Fairies plays in landscape.',
      subWidowsbay: 'Widow’s Bay plays in landscape.',
    },
  },

};
