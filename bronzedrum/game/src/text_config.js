// Every word Bronze Drum shows, in one place: edit the text here.
//
// - Keys name where the text appears (title.pressStart, hints.attackComing…).
// - {name} marks a value the game fills in, such as {n} for a chapter number
//   or {rhythm} for the dots of a rhythm; keep the braces and the name.
// - Rich-text marks in hints and labels: ⟨k:F⟩ shows a key, ⟨A⟩ a controller
//   button, ⟨d:L⟩ and ⟨d:R⟩ the drum's centre and rim marks.
// - Text shown on the page (menus, instructions, credits) may use HTML tags
//   such as <strong> and <em>; text drawn on the game canvas is plain.
// - Vietnamese names keep their diacritics (Trưng Trắc, Mê Linh).
//
// Text with a value in it is read through txt('key', { name: value }); the
// page's own text (index.html, marked data-text) is filled in by applyPageText().

export const T = {
  // The game itself: its name, the browser tab, the page description.
  game: {
    name: 'Bronze Drum',
    canvasLabel: 'Battlefield',
    pageTitle: 'Bronze Drum',
    description: 'Two sisters, one bronze drum. Command an army of women by drumming on the beat.',
  },

  // The title screen.
  title: {
    hintSideways: 'Best played with the device sideways',
    hintSidewaysAddToHome: 'Best played sideways · tip: Add to Home Screen to play full screen',
    logoVietnamese: 'Trống Đồng',
    logoEnglish: 'Bronze Drum',
    pressStart: 'Press Start',
    drumPractice: 'Drum Practice',
    cornerButtons: {
      instructions: 'Instructions',
      settings: 'Settings',
      fullscreen: 'Fullscreen',
      soundOn: 'Sound on',
      soundOff: 'Sound off',
    },
  },

  // The chapter list.
  chapterSelect: {
    chapterNumber: 'Chapter {n}',
    locked: 'Win the chapter before to unlock.',
    title: 'Choose a chapter',
    back: 'Back to title',
  },

  // Each chapter, by its id: its card (title, subtitle), its opening card (story, goal) and its ending (successTitle, resultText).
  chapters: {
    garden: {
      title: 'The Garden at Mê Linh',
      subtitle: 'Training years',
      story: 'Mê Linh, in the years before the war. In their father’s garden Trưng Trắc and Trưng Nhị learn the language of the bronze drum, and the women of the village drill to its call among the straw targets.',
      goal: 'Trắc keeps the deep centre, Nhị the rim. Teach the women to march and strike, then cut down the straw targets.',
      successTitle: 'The targets fall',
      resultText: 'The straw targets are down. The women know the drum.',
    },
    oath: {
      title: 'The Oath',
      subtitle: 'The father’s funeral',
      story: 'The Han governor has put the sisters’ father to death for defying him. At his funeral the mourning drum sounds through the dusk, and the sisters answer it beat for beat, vowing to drive the Han from their land.',
      goal: 'Answer each call of the mourning drum evenly; with each answer an incense stick is lit for him.',
      successTitle: 'The oath is sworn',
      resultText: 'The incense burns for your father. The sisters swear to drive out the Han.',
    },
    casting: {
      title: 'Casting the Drums',
      subtitle: 'The foundry of Nhật Nam',
      story: 'A rising needs a voice that carries from valley to valley. In the foundries of Nhật Nam the smiths pour bronze for new war drums, and every hammer stroke must keep the bellows’ pace.',
      goal: 'Drum the hammer rhythm with the bellows, round after round without stopping. Keep in time and the bronze rises, drum by drum; rush, drag or stumble and it spills back to the last drum cast.',
      successTitle: 'Three drums, cast true',
      resultText: 'Three bronze drums, cast true. They will carry across the delta.',
    },
    villages: {
      title: 'The Villages Answer',
      subtitle: 'A call along the river',
      story: 'Night falls on the Red River. The sisters’ drum calls from village to village, and in each one a drummer steps out with a rhythm of their own, waiting to hear whether the call is true.',
      goal: 'Echo each village drummer’s rhythm back evenly, at about their speed, and the village lights its lanterns and joins you.',
      callers: ['Phong Châu', 'Chu Diên', 'Cửu Chân', 'Hợp Phố', 'Nhật Nam', 'Giao Chỉ'],
      successTitle: 'The river is lit',
      resultText: 'Lanterns burn along the river from Phong Châu to Giao Chỉ. The villages will fight.',
    },
    outpost: {
      title: 'The Outpost on the Hát River',
      subtitle: 'The drums answer',
      story: 'The rising begins at the Hát River, where a Han outpost guards the ford. For the first time the sisters’ army marches to the drum, straight at the crossbows on the palisade.',
      goal: 'Break the Han outpost that guards the ford. When a crossbow takes aim, guard just before the bolts land.',
      successTitle: 'The ford is ours',
      resultText: 'The drum carries across the water. The ford is yours.',
    },
    luylau: {
      title: 'The Citadel at Luy Lâu',
      subtitle: 'Gold armour, war elephants',
      story: 'Word of the victory runs ahead of the army to Luy Lâu, the Han governor’s seat, where soldiers in gold armour man the walls. The sisters ride into battle on a war elephant, the great drum on its back.',
      goal: 'Wake the drum, then strike: the elephant charges.',
      successTitle: 'Luy Lâu is free',
      resultText: 'Luy Lâu falls and the governor flees north. Sixty-five citadels are free.',
    },
    coronation: {
      title: 'The Coronation at Mê Linh',
      subtitle: 'Two queens',
      story: 'The governor has fled north, and sixty-five citadels have opened their gates. At Mê Linh the people proclaim Trưng Trắc and Trưng Nhị their queens, and the festival drummers play into the night.',
      goal: 'The festival drummers call ever richer rhythms: answer them, as evenly as you can, for the crowd.',
      successTitle: 'Two queens',
      resultText: 'Trưng Trắc and Trưng Nhị are queens of the Lạc Việt.',
    },
    mavien: {
      title: 'Mã Viện Returns',
      subtitle: 'Hold the ford',
      story: 'Three years on, the Han emperor sends his general Mã Viện south with a great army. At the ford the last of the sisters’ soldiers must hold the line while Mê Linh empties behind them.',
      goal: 'Hold the ford for ninety seconds: strike the columns, and raise the shields against every volley.',
      successTitle: 'The line held',
      resultText: 'The ford held until Mê Linh was empty. The sisters’ army withdraws, still unbroken.',
    },
    elegy: {
      title: 'The Drums Are Melted',
      subtitle: 'Epilogue',
      story: 'Mã Viện gathers the bronze drums of the Lạc Việt to melt them down, so their voices can never again call the people to rise. Before the fire takes them, the last drummers play them one final time.',
      goal: 'Answer each drum’s rhythm one last time: each one you answer falls silent, until none are left.',
      successTitle: 'The drums remember',
      resultText: 'The last drum falls silent. They will be cast into a bronze horse — but the rhythm is remembered.',
    },
  },

  // The card that opens each chapter.
  opening: { chapterNumber: 'Chapter {n}', begin: 'Begin' },

  // The end of a chapter: won, lost, and the buttons.
  results: {
    evenness: ' Evenness {even}%.',
    chapters: 'Chapters',
    continue: 'Continue',
    chapterComplete: 'Chapter complete',
    victory: 'Victory',
    defeat: 'The line breaks',
    defeatText: 'The women fall back to regroup. Raise the shields while the bolts are in the air.',
    nextChapter: 'Next chapter',
    playAgain: 'Play again',
    chaptersButton: 'Chapters',
  },

  // The pause menu.
  pause: {
    drumPractice: 'Drum Practice',
    chapterNumber: 'Chapter {n}',
    startOver: 'Start over',
    restartChapter: 'Restart chapter',
    practiceModes: 'Practice modes',
    chapters: 'Chapters',
    title: 'Paused',
    resume: 'Resume',
    instructions: 'Instructions',
    settings: 'Settings',
    returnToTitle: 'Return to title',
  },

  // The screen asking for a phone held upright to be turned sideways.
  rotate: {
    title: 'Turn your device sideways',
    text: 'The drum and the battle above work best in landscape.',
    menu: 'Menu',
  },

  // Settings: the labels, the (i) tips and the choices in the dropdowns and sliders.
  settings: {
    drumsticksChoices: ['Carved', 'Folk', 'Ceremonial'],
    styleChoices: ['Shadow puppets', 'Water puppets'],
    difficultyChoices: ['Easy', 'Medium', 'Hard'],
    title: 'Settings',
    labels: {
      style: 'Style',
      difficulty: 'Difficulty',
      beats: 'Number of beats',
      volume: 'Volume',
      echo: 'Army drums',
      music: 'Music',
      ambience: 'Ambience',
      offset: 'Audio offset (ms)',
      hints: 'Show hints',
      vibration: 'Vibration',
      reduceMotion: 'Reduce motion',
      sticks: 'Drumsticks',
    },
    tips: {
      style: 'Shadow puppets: backlit cut-paper figures. Water puppets: lacquered wooden puppets wading in a village pond (múa rối nước).',
      difficulty: 'Easy: plain beats and pairs, no triplets. Medium: as designed. Hard: rests, inside pairs and triplets too. Takes effect when a chapter starts.',
      beats: 'How long every command and call is: four by default. Fewer is easier to remember, more is harder. Takes effect when a chapter starts.',
      sticks: 'The sisters’ sticks seen close up over the drum, in the battle chapters and in Drum Practice. Carved: a carved beater and a slim stick. Folk: a pestle-like pole and a bamboo stick. Ceremonial: a lacquered beater and a horn-tipped stick.',
    },
    credits: 'Credits',
    done: 'Done',
  },

  // Credits: one entry per line, a role and who (HTML allowed).
  credits: {
    title: 'Credits',
    entries: [
      {
        role: 'Story and inspiration',
        who: 'The novel <em>Bronze Drum</em>, written by Phong Nguyen (2022)',
      },
      { role: 'Principal Game Designer', who: 'Hoai Nguyen' },
      {
        role: 'Music',
        who: 'Emulated Vietnamese folk by Hoai Nguyen, made using Suno',
      },
      { role: 'Sound effects', who: 'Made with ElevenLabs' },
      { role: 'Artwork', who: 'Made with ChatGPT ImageGen' },
      { role: 'Coding Agent', who: 'Claude Code' },
      {
        role: 'Fonts',
        who: 'Cormorant Garamond by Christian Thalmann; Be Vietnam Pro by Lâm Bảo, Tony Le and Việt Anh Nguyễn. Both under the SIL Open Font License.',
      },
      {
        role: 'History',
        who: 'The uprising of the Trưng sisters against the Han, <span class="nowrap">40–43 CE</span>',
      },
    ],
    close: 'Close',
  },

  // Instructions (How to drum). HTML allowed: <strong>, <em>, the dot glyphs <span class="g-l"></span> (tùng) and <span class="g-r"></span> (cắc), and the controller buttons <span class="xb xb-a">A</span>.
  instructions: {
    commandTable: {
      command: 'Command',
      tier1: 'I',
      tier2: 'II · ×1.4',
      tier3: 'III · ×1.96',
    },
    commandEffects: {
      march: 'Advance. Tiers II and III go further and crash into the enemy line.',
      strike: 'Spears and archers attack the front enemy. At Luy Lâu, with the drum awake, the war elephant charges instead.',
    },
    title: 'How to drum',
    objective: '<strong>Goal.</strong> Drum commands to lead the army to its target.',
    twoDrummers: '<strong>Two sounds.</strong> <span class="g-l"></span> <em>tùng</em> is the drum’s centre (Trưng Trắc). <span class="g-r"></span> <em>cắc</em> is the rim (Trưng Nhị).',
    commands: '<strong>Commands.</strong> Each command is a short rhythm. Play it at any speed, but keep the beats even. Two joined dots are two quick strokes in one beat; a 3 marks three. A wrong stroke starts the rhythm over. Each new rhythm is played for you first.',
    strongerRhythms: '<strong>Tiers.</strong> Each command has three tiers. Tiers II and III are harder and hit harder. Playing evenly adds strength too.',
    armyAnswers: '<strong>The army acts</strong> for four beats while the crew drums your rhythm back. Start the next command when the drum glows.',
    shield: '<strong>Shield.</strong> When bolts are in the air or a spearman lunges, press shield (<span class="xb xb-a">A</span>, Space) to block. It also clears the rhythm you were drumming.',
    controllerHeading: 'Xbox controller',
    controllerDiagram: {
      deep: 'X · Trắc · tùng',
      rim: 'B · Nhị · cắc',
      shield: 'A · shield + clear',
      stick: 'Menus: move',
      dpad: 'D-pad: menus',
      menu: 'Menu · pause',
    },
    controlsTable: `
            <tr><th>Action</th><th>Controller</th><th>Keyboard</th><th>Mouse</th><th>Touch</th></tr>
            <tr><td><em>Tùng</em> (centre)</td><td><span class="xb xb-x">X</span></td><td>F, D, A or ←</td><td>Left half</td><td>Drum centre, or left side</td></tr>
            <tr><td><em>Cắc</em> (rim)</td><td><span class="xb xb-b">B</span></td><td>J, K, L or →</td><td>Right half</td><td>Drum rim, or right side</td></tr>
            <tr><td>Shield / clear</td><td><span class="xb xb-a">A</span></td><td>Space</td><td>Click the drum</td><td>Tap the battle; swipe the drum to clear</td></tr>
            <tr><td>Pause</td><td>Menu</td><td>Esc or P</td><td>—</td><td>Pause button</td></tr>
          `,
    phones: '<strong>Phones and tablets.</strong> Hold the device sideways. Use several fingers for quick pairs and triplets.',
    audioOffset: 'If your strokes sound late, adjust <em>Audio offset</em> in Settings.',
    close: 'Close',
  },

  // The hint line above the drum in the chapters.
  hints: {
    answerTouch: 'Now answer it: the same rhythm, evenly (● centre = tùng, ○ rim = cắc)',
    answerKeys: 'Now answer it: the same rhythm, evenly ({deepKey} = tùng, {rimKey} = cắc)',
    listenToCall: 'Listen to the call — answer as soon as you know it',
    drumWithBellows: 'Drum with the bellows, at their pace: {rhythm}',
    keepBellowsPace: 'Keep the bellows’ pace — every phrase in time with them',
    guardKeyLessons: {
      keyboard: 'Space',
      gamepad: '⟨A⟩',
      pointer: 'click the drum',
      touch: 'the Shield button',
    },
    inReach: 'In reach — {rhythm}',
    inReachOr: 'In reach — {rhythm}  or  {stronger}',
    guardKey: {
      keyboard: 'Space',
      gamepad: '⟨A⟩',
      pointer: 'tap the drum',
      touch: 'the Shield button',
    },
    attackComing: 'Attack coming — shield ({key}) while it is in the air',
    thirdTier: 'The third tier hits hardest — {rhythm}',
    drumAwakeCharge: 'The drum is awake — strike and the elephant charges: {rhythm}',
    chainToWake: 'Chain four commands to wake the drum — then a strike becomes the elephant charge',
    holdTheFord: 'Hold the ford — strike the columns, shield every volley',
  },

  // The first chapter (the Garden): its list of lessons, their hints and the praise when each is done.
  lessons: {
    praise: {
      march: 'The women march!',
      march2: 'Two quick strokes in one beat: a stronger march!',
      strike: 'A strike! Spears and arrows fly.',
      targets: 'The targets are down!',
      block: 'Blocked! The children run off, laughing.',
    },
    hints: {
      marchTouch: 'Tap the drum evenly (● centre, ○ rim) — {rhythm}',
      march: 'Drum evenly, at any speed — {rhythm}',
      block: 'Stones! Block with {key} while a stone is in the air',
      march2: 'Stronger: two quick strokes share a beat — {rhythm}',
      marchToTargets: 'March on to the targets — {rhythm}',
      marchToNextTarget: 'March on to the next target — {rhythm}',
    },
    childrenCome: 'Village children come running…',
    blockedOnceMore: 'Blocked! Once more',
    stoneHit: 'Ouch! Block the stones while they fly',
    names: {
      march: 'March',
      march2: 'A stronger march',
      strike: 'Strike',
      targets: 'Cut down the targets',
      block: 'Block the stones',
    },
    panelTitle: 'LESSONS',
  },

  // Words flashed during a battle.
  battle: {
    elephantCharges: 'Voi! The elephant charges',
    drumWakes: 'Trống thức — the drum wakes!',
    cleared: 'Cleared',
    chainBroken: 'Chain broken',
    paceQuick: 'quick',
    paceSteady: 'steady',
    paceSlow: 'slow',
    commandEven: 'Even!  {command} · {pace}',
    commandGood: 'Good  {command} · {pace}',
    defended: 'Defended',
    marchHit: 'Into the line!',
  },

  // The answering chapters (a caller plays, the player answers).
  answering: {
    callerCalls: '{caller} calls',
    yourTurn: 'Your turn',
    again: 'Again — listen',
    answered: {
      other: 'Answered',
      mourning: 'An incense stick is lit',
      village: '{caller} answers',
      festival: 'The crowd roars',
      elegy: 'A drum falls silent',
    },
    tooFast: 'Too fast — match their speed',
    tooSlow: 'Too slow — match their speed',
    theVillage: 'The village',
  },

  // Casting the Drums.
  casting: {
    drumIsCast: 'Drum {n} is cast',
    drumCast: 'Drum {n} cast!',
    rushing: 'Rushing — some bronze spills',
    dragging: 'Dragging — the bronze cools',
    spills: 'A little bronze spills',
    hammerRhythm: 'The hammer rhythm',
  },

  // When the game plays a rhythm for the player.
  demonstration: {
    listenAgain: 'Listen again — {rhythm}: ',
    listen: 'Listen — {rhythm}: ',
    theRhythm: 'The rhythm',
  },

  // The on-screen labels: bars, the line above the dots, the command rows.
  hud: {
    listen: 'Listen…',
    yourTurnAnswer: 'Your turn — answer it',
    pouring: 'Pouring…',
    answered: 'Answered',
    elephantCharges: 'Voi! — the elephant charges',
    commandPlayed: '{command} {tier}! — {meaning}',
    armyKeepsRhythmTouch: 'The army keeps your rhythm',
    armyKeepsRhythm: 'The army keeps your rhythm — drum the next command',
    drumAwake: 'Trống thức — the drum wakes ×{count}',
    chain: 'Chain ×{count}',
    progress: {
      mourning: 'Incense lit',
      village: 'Villages answering',
      festival: 'Rhythms answered',
      elegy: 'Drums silent',
      other: 'Answered',
      training: 'Answered',
    },
    progressCount: '{what} · {done} of {total}',
    keepBellowsPace: 'Keep the bellows’ pace',
    armyBar: 'Nghĩa quân · the army',
    holdTheFord: 'Hold the ford · {seconds} s',
    hanFort: 'Han fort',
    strawTargets: 'Straw targets',
    drumsCast: 'Drums cast · {done} of {total}',
    commandRow: '{command} · {meaning}',
  },

  // The touch drum and its buttons.
  touch: { centre: 'tùng', rim: 'cắc', shield: 'Shield', reset: 'Reset' },

  // The drum commands: their Vietnamese names and what they mean.
  commands: {
    march: { name: 'Tiến', meaning: 'March' },
    strike: { name: 'Đánh', meaning: 'Strike' },
  },

  // Drum Practice: its screen, the three modes, the drums and the on-screen words.
  practice: {
    modes: {
      free: {
        title: 'Free drumming',
        subtitle: 'Drum anything; the crew plays it back',
        intro: 'Drum any rhythm of four beats (or as many as you set), one, two or three strokes a beat. The drum crew plays it back again and again, and dancers gather at the fire. Drum along with it as long as you like; it keeps going until you clear it with A (Space, or a swipe), and then the next rhythm you drum takes its place. Pairs, triplets, pauses: anything goes.',
      },
      call: {
        title: 'Call and answer',
        subtitle: 'Trade rhythms with a partner',
        intro: 'Your partner drums a call and you answer with any rhythm of the same number of beats. The call and your answer then play together, again and again, and you can drum along. Clear it with A (Space, or a swipe) and it is your turn to call: your partner answers with a riff on your rhythm. Each clear hands the call to the other side.',
      },
      training: {
        title: 'Training',
        subtitle: 'The chapters’ rhythms, level by level',
        intro: 'Every rhythm the chapters ask for, numbered and sorted into nine levels, from steady beats to pairs and triplets switching drums. Choose a level (◀ ▶) and a rhythm (▲ ▼); your partner plays it and you play it back, judged as in the game. Each rhythm you play well leads on to the next.',
      },
    },
    cardLabel: 'Drum Practice',
    partner: 'Partner',
    you: 'You',
    exchangeLoopsPartner: 'Call and answer, again and again',
    exchangeLoopsYou: 'Your call and its answer, again and again',
    yourCall: 'Your call…',
    yourTurnToCall: 'Your turn: call any {beats} beats',
    listen: 'Listen…',
    yourAnswer: 'Your answer…',
    answerWith: 'Answer with any {beats} beats',
    partnerAboutToCall: 'Your partner is about to call…',
    hintFree: 'Drum any {beats} beats — {deepKey} tùng, {rimKey} cắc, one to three strokes a beat — and the crew plays them back',
    hintCall: 'Listen to your partner, then answer with any {beats} beats',
    againAndAgain: 'Again and again',
    listening: 'Listening…',
    yourRhythmLoops: 'Your rhythm, again and again',
    drumAny: 'Drum any {beats} beats',
    controls: {
      beats: '{fewerKey} fewer · {beats} beats · more {moreKey}',
      secondDrum: '{strikeKey} {drum} · {chooseKey} another',
      clearFree: '{key} clear and stop the loop',
      clear: '{key} clear',
    },
    kits: {
      bronze: { name: 'Bronze drum', vn: 'Trống đồng' },
      temple: { name: 'Barrel drum and mõ', vn: 'Trống chầu · mõ' },
      rice: { name: 'Rice drum', vn: 'Trống cơm' },
      gongs: { name: 'Gongs', vn: 'Cồng chiêng' },
      bamboo: { name: 'Bamboo', vn: 'Đàn t’rưng' },
      lion: { name: 'Lion-dance drum', vn: 'Trống lân · chũm chọe' },
    },
    secondDrums: {
      chau: { name: 'Barrel drum', vn: 'Trống chầu' },
      mo: { name: 'Slit drum', vn: 'Mõ' },
      com: { name: 'Rice drum', vn: 'Trống cơm' },
      gong: { name: 'Low gong', vn: 'Cồng' },
      chieng: { name: 'High gong', vn: 'Chiêng' },
      bamboo: { name: 'Bamboo', vn: 'Đàn t’rưng' },
      lan: { name: 'Lion-dance drum', vn: 'Trống lân' },
      choe: { name: 'Cymbals', vn: 'Chũm chọe' },
    },
    screenTitle: 'Drum Practice',
    back: 'Back to title',
  },

  // Drum Practice, Training: the levels and the words on its screen.
  training: {
    missReasons: {
      uneven: 'uneven',
      timeout: 'too slow to finish',
      'no-pattern': 'not this rhythm',
      other: 'not quite',
    },
    miss: 'Not quite ({why}) — try again',
    listen: 'Rhythm {n} — listen',
    wellPlayed: 'Rhythm {n}: well played · {even}% even',
    levelDone: 'Level {level} · {name}: every rhythm played. Again from the top.',
    title: 'Training',
    subtitle: 'The chapters’ rhythms, level by level',
    goal: 'Play each rhythm back after your partner. The levels run from steady beats to pairs and triplets together.',
    controls: {
      gamepad: '⟨k:◀⟩ ⟨k:▶⟩ level · ⟨k:▲⟩ ⟨k:▼⟩ rhythm · ⟨A⟩ hear it again',
      touch: 'Tap a level or a rhythm · swipe the drum to hear it again',
      pointer: 'Click a level or a rhythm · Space: hear it again',
      keyboard: '⟨k:←⟩ ⟨k:→⟩ level · ⟨k:↑⟩ ⟨k:↓⟩ rhythm · Space: hear it again',
    },
    levels: [
      { name: 'Steady', about: 'one stroke on every beat' },
      { name: 'A pair', about: 'one pair, everything on one drum' },
      {
        name: 'Switching',
        about: 'one pair on one drum; the drums switch between beats',
      },
      {
        name: 'Turns',
        about: 'one triplet on one drum, or one pair that switches drums inside; no switch just before or after it',
      },
      {
        name: 'Around',
        about: 'one triplet, or a pair that switches inside, with a switch beside it; or two pairs or more',
      },
      {
        name: 'Runs',
        about: 'two triplets or more, or pairs back to back (not together)',
      },
      { name: 'Mixed triplets', about: 'a triplet that switches drums inside' },
      {
        name: 'Pairs and triplets',
        about: 'pairs and triplets together, each on one drum',
      },
      {
        name: 'Everything',
        about: 'pairs and triplets together, switching drums inside them',
      },
    ],
    trainingOnly: 'Training only',
    usedIn: '{what} · ch {chapters}',
    levelHeading: 'Level {level} · {name}',
    asDesigned: 'As designed: Medium, four beats, whatever the settings',
  },

  // Messages that pop up (toasts) and other notices.
  messages: {
    fullscreenUnavailable: 'Fullscreen is not available here',
    controllerDisconnected: 'Controller disconnected — reconnect it or use the keyboard.',
    controllerConnected: 'Controller connected',
    safariBars: 'Swipe up to hide Safari’s bars · or Share → Add to Home Screen',
  },
};

/** The value at a dotted path ('chapters.garden.title'), or undefined. */
function lookup(path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), T);
}

/** The text at a dotted path with its {name} placeholders filled from vars. */
export function txt(path, vars = {}) {
  const v = lookup(path);
  if (typeof v !== 'string') return path;
  return v.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/**
 * Fill the page's own text (index.html) from T: data-text sets an element's
 * content, data-text-label its aria-label (and a button's title), data-tip-text
 * a setting's (i) tip, data-credits the credits list.
 */
export function applyPageText(root = document) {
  for (const el of root.querySelectorAll('[data-text]')) {
    const v = lookup(el.dataset.text);
    if (typeof v !== 'string') continue;
    if (el instanceof SVGElement) el.textContent = v;
    else el.innerHTML = v;
  }
  for (const el of root.querySelectorAll('[data-text-label]')) {
    const v = lookup(el.dataset.textLabel);
    el.setAttribute('aria-label', v);
    if (el.tagName === 'BUTTON') el.setAttribute('title', v);
  }
  for (const el of root.querySelectorAll('[data-tip-text]')) el.dataset.tip = lookup(el.dataset.tipText);
  for (const el of root.querySelectorAll('[data-credits]')) {
    el.innerHTML = lookup(el.dataset.credits).map((e) => `<dt>${e.role}</dt><dd>${e.who}</dd>`).join('');
  }
  document.title = T.game.pageTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', T.game.description);
}
