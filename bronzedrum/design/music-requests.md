# Bronze Drum: music requests

Prompts for the score, ready to paste into a music generator (Suno, Udio, ElevenLabs Music or similar). Generated from `source/build_audio.py`; edit the data there and rerun it.

## How to use this list

- **Each prompt is complete on its own.** Paste the prompt as it stands; nothing needs combining. The style tags are a short version for generators with a separate style field, and are optional.
- Save each finished track as `bronzedrum/game/assets/music/<id>.mp3` (or drop it in `bronzedrum/intake/`). The game plays a track as soon as its file is there.
- Tracks marked *loops* must loop seamlessly: trim any silence at the start and end. The beds must stay beatless; if a generator adds a beat, regenerate.

## Why most of the music has no beat

Bronze Drum is a rhythm game: the player drums at any speed they like (about 45 to 200 BPM) and the army's drums answer at that speed. A second, fixed beat under the drumming would fight it, so the music that plays during a chapter is beatless: free time, no pulse, no percussion keeping time. Themes with melody and metre play only where nobody is drumming: on the title, the chapter select, the results and the ending.

**When each kind plays**

- **Themes:** the title screen and the chapter select.
- **Beds:** under each chapter, quietly, beneath the ambience.
- **Swell:** once over the bed when the drum wakes.
- **Stings and the ending:** on the results screens.
- **Song:** trailer and credits.

## What to make first

**Core (needed now):** `mu-title`, `mu-select`, `mu-bed-battle`, `mu-bed-story`, `mu-ending`. These five cover every screen: the two themes on the menus, the battle bed under every battle, the story bed under every story chapter, and the ending under the epilogue and the final screen.

**Maybe:** `mu-bed-oath` (its own bed for the funeral, instead of the story bed).

**Optional, for later:** everything else. A chapter's own bed replaces the shared bed when it is delivered; without the swell and the stings the game uses its sound effects (the waking drum and the cheer, the victory and defeat gongs).

## Summary

| Id | Title | Priority | Kind | When it plays | Length | Loops | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `mu-title` | Trống Đồng (title theme) | core | theme | Under chapter 4, The Villages Answer, until its own bed arrives (it was the title theme; the anthem took the menus). Its quan họ call and answer suits the chapter, and measured its pulse is no stronger than the shared beds'. | about 90 s | yes | delivered |
| `mu-select` | Two Sisters (chapter select) | core | theme | Under chapter 1, the Garden, until its own bed arrives (it was the chapter-select theme; the anthem took the menus): the two sisters practising. Measured, its pulse is no stronger than the shared beds'. Also on Drum Practice's screen of modes. | about 90 s | yes | delivered |
| `mu-bed-battle` | Battle bed (all battles) | core | bed | Under every battle chapter (the Garden, the Outpost, Luy Lâu, Mã Viện Returns) unless that chapter has its own bed. | about 2 min | yes | delivered |
| `mu-bed-story` | Story bed (all story chapters) | core | bed | Under every story chapter (the Oath, Casting the Drums, the Villages, the Coronation) unless that chapter has its own bed. | about 2 min | yes | delivered |
| `mu-ending` | The Drums Are Melted (ending) | core | piece | Under the epilogue (unless it has its own bed) and on the final results screen. | about 3 min | no | delivered |
| `mu-bed-oath` | The Oath (bed) | maybe | bed | Under chapter 2, the father's funeral, while the mourning drum calls. | about 2 min | yes | requested |
| `mu-bed-garden` | The Garden at Mê Linh (bed) | optional | bed | Under chapter 1, the training battle, quietly under the ambience. | about 2 min | yes | requested |
| `mu-bed-foundry` | Casting the Drums (bed) | optional | bed | Under chapter 3, in the foundry, while the player holds a steady hammer rhythm. | about 2 min | yes | requested |
| `mu-bed-villages` | The Villages Answer (bed) | optional | bed | Under chapter 4, at night along the river, while village drummers call and the player answers. | about 2 min | yes | requested |
| `mu-bed-river` | The Outpost on the Hát River (bed) | optional | bed | Under chapter 5, the river battle. | about 2 min | yes | requested |
| `mu-bed-luylau` | The Citadel at Luy Lâu (bed) | optional | bed | Under chapter 6, the night attack on the citadel with the war elephant. | about 2 min | yes | requested |
| `mu-bed-coronation` | The Coronation at Mê Linh (bed) | optional | bed | Under chapter 7, the festival, while festival drummers call and the player answers. | about 2 min | yes | requested |
| `mu-bed-mavien` | Mã Viện Returns (bed) | optional | bed | Under chapter 8, holding the ford against Mã Viện's army. | about 2 min | yes | requested |
| `mu-bed-elegy` | The Drums Are Melted (bed) | optional | bed | Under chapter 9, the epilogue, while the drums fall silent one by one. | about 2 min | yes | requested |
| `mu-wake` | The drum wakes (swell) | optional | swell | Once, over the chapter's bed, when four commands chain and the drum wakes. | 15–20 s | no | requested |
| `mu-victory` | Victory sting | optional | sting | Results screen after a battle chapter is won. | about 8 s | no | requested |
| `mu-complete` | Chapter complete sting | optional | sting | Results screen after a story chapter (no battle) is completed. | about 8 s | no | requested |
| `mu-defeat` | Defeat sting | optional | sting | Results screen after a battle chapter is lost. | about 8 s | no | requested |
| `mu-anthem` | Song of the Two Queens: Trống Đồng Vang Dới Đất Trời (vocal song) | optional | song | The menus (title and chapter select), round and round, and the Coronation's success moment (the two queens crowned); later the trailer and end credits. | about 3 min 30 s | no | delivered |

## mu-title · Trống Đồng (title theme)

Under chapter 4, The Villages Answer, until its own bed arrives (it was the title theme; the anthem took the menus). Its quan họ call and answer suits the chapter, and measured its pulse is no stronger than the shared beds'.

- **Priority:** core · **Kind:** theme · **Length:** about 90 s · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-title.mp3`
- **Style tags (optional):** `vietnamese quan ho, sao truc flute, dan tranh zither, bronze gong, female voice, soft cinematic strings, 72 bpm, folk theme`

**Prompt:**

> A slow, proud and tender title theme for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre. Traditional northern Vietnamese style rooted in quan họ folk song from Bắc Ninh: a bamboo flute (sáo trúc) states the main melody in D minor pentatonic over rippling 16-string zither (đàn tranh) arpeggios; a soft bronze gong marks each phrase; halfway through a solo woman's voice sings the melody back on wordless vocables (à ơi) in quan họ manner; a quiet bed of modern cinematic strings swells underneath without taking over. 72 BPM in 4/4. About 90 seconds, built to loop: the last bar leads back into the first, no fade-out. No lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-select · Two Sisters (chapter select)

Under chapter 1, the Garden, until its own bed arrives (it was the chapter-select theme; the anthem took the menus): the two sisters practising. Measured, its pulse is no stronger than the shared beds'. Also on Drum Practice's screen of modes.

- **Priority:** core · **Kind:** theme · **Length:** about 90 s · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-select.mp3`
- **Style tags (optional):** `vietnamese folk duet, dan tranh and sao truc, two intertwining themes, gentle, light ambient pad, 66 bpm`

**Prompt:**

> A tender theme about two sisters for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre. Traditional Vietnamese folk duet: the elder sister's theme on the 16-string zither (đàn tranh) is steady, dignified and on the beat; the younger sister's theme on the bamboo flute (sáo trúc) is quick, playful and bends around the beat; they take turns, tease each other, then play together in harmony in C major pentatonic. A light modern ambient pad gives warmth underneath. 66 BPM, gentle and a little bittersweet. About 90 seconds, built to loop seamlessly with no fade-out. No percussion, no lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-battle · Battle bed (all battles)

Under every battle chapter (the Garden, the Outpost, Luy Lâu, Mã Viện Returns) unless that chapter has its own bed.

- **Priority:** core · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-battle.mp3`
- **Style tags (optional):** `beatless vietnamese tense heroic ambient, dan nhi, dan nguyet tremolo, quan ho low choir, bronze gongs, cinematic drone, no drums`

**Prompt:**

> A tense, heroic, completely beatless background score for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre. It plays under battles while the player drums commands at any speed, so it must have no pulse, no metre and no drums or percussion keeping time. Traditional northern Vietnamese colour: a two-string fiddle (đàn nhị) plays long, resolute phrases in D minor pentatonic; a moon lute (đàn nguyệt) shivers in unmeasured tremolo; a low women's choir holds long notes in the manner of quan họ; large bronze gongs are struck softly now and then and left to ring, never in a pattern; the bamboo flute (sáo trúc) recalls a proud folk melody in fragments. Underneath, a deep modern cinematic drone and low strings rise and fall like wind over a river. Urgent and brave but never rhythmic. About 2 minutes, looping seamlessly: end where it began, with no fade-out and no silence at either end. No lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-story · Story bed (all story chapters)

Under every story chapter (the Oath, Casting the Drums, the Villages, the Coronation) unless that chapter has its own bed.

- **Priority:** core · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-story.mp3`
- **Style tags (optional):** `beatless vietnamese reflective ambient, two sao truc flutes, dan bau hat ru, dan tranh harmonics, quan ho humming, warm pad`

**Prompt:**

> A warm, reflective, completely beatless background score for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre. It plays under quiet story chapters (a funeral, a bronze foundry, villages answering along a river at night, a coronation festival) while drummers call rhythms and the player answers at any speed, so it must have no pulse, no metre and no percussion keeping time. Traditional Vietnamese colour: one bamboo flute (sáo trúc) calls a short free-time phrase and a second, nearer flute answers; the monochord (đàn bầu) sings slow bending lines in the manner of a hát ru lullaby; 16-string zither (đàn tranh) harmonics glint like lantern light; now and then a woman's voice hums a phrase in the quan họ style; a soft bronze bell rings rarely and is left to decay. A gentle modern ambient pad gives warmth underneath. G major pentatonic, tender and hopeful with a thread of sadness. About 2 minutes, looping seamlessly: end where it began, with no fade-out and no silence at either end. No lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-ending · The Drums Are Melted (ending)

Under the epilogue (unless it has its own bed) and on the final results screen.

- **Priority:** core · **Kind:** piece · **Length:** about 3 min · **Loops:** no
- **File:** `bronzedrum/game/assets/music/mu-ending.mp3`
- **Style tags (optional):** `vietnamese lament, solo dan bau, quan ho female duet, ca tru colour, free rubato, no percussion, bronze bell ending`

**Prompt:**

> A sparse, mournful ending piece for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre. It plays as the bronze drums of the uprising are gathered to be melted down, and through the final screen. The monochord (đàn bầu) plays alone at first, bending each note like a voice holding back tears; two women's voices enter in the quan họ call-and-response style with a touch of ca trù ornament, singing a lament on wordless vocables (à ơi); a faint modern string pad joins near the end; finally a single bronze bell is struck and left to ring into silence. Entirely free and rubato, with no beat, no percussion and no steady tempo, so slow drumming can sit on top. A minor pentatonic. About 3 minutes. It should feel like dawn on a river after a loss. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-oath · The Oath (bed)

Under chapter 2, the father's funeral, while the mourning drum calls.

- **Priority:** maybe · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-oath.mp3`
- **Style tags (optional):** `beatless vietnamese funeral lament, dan bau monochord, ca tru female voice, low drone, soft bronze bell, sparse`

**Prompt:**

> A sparse, grieving beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for the funeral of the sisters' father. Traditional northern Vietnamese mourning colour: the monochord (đàn bầu) bends slow lamenting phrases in A minor pentatonic over a low drone; now and then a woman's voice in the restrained, ornamented manner of ca trù hums a few notes; a soft bronze bell rings rarely and is left to decay; a faint modern low string pad sits underneath. Very quiet, lots of space for a slow mourning drum on top. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. No words. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-garden · The Garden at Mê Linh (bed)

Under chapter 1, the training battle, quietly under the ambience.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-garden.mp3`
- **Style tags (optional):** `beatless vietnamese ambient, dan tranh harmonics, sao truc free phrases, dawn garden, warm pad, no percussion`

**Prompt:**

> A warm, hopeful beatless ambient bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for the sisters' training in their father's garden at dawn. Traditional Vietnamese colour: a bamboo flute (sáo trúc) plays short free-time phrases in G major pentatonic like birdsong, 16-string zither (đàn tranh) harmonics shimmer and fade, a low warm modern synth pad holds a slowly changing chord. Morning light, green and gold, unhurried. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. No lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-foundry · Casting the Drums (bed)

Under chapter 3, in the foundry, while the player holds a steady hammer rhythm.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-foundry.mp3`
- **Style tags (optional):** `beatless vietnamese work song humming, ho, low drone, metallic bronze resonance, dan nguyet tremolo, foundry ambient`

**Prompt:**

> A warm, glowing beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for a night in an ancient bronze foundry where the war drums are cast. Traditional Vietnamese colour: men's and women's voices hum a free-time work song in the manner of hò, long notes rising and falling; a moon lute (đàn nguyệt) adds soft tremolo phrases; struck bronze bars and bowls ring and are left to resonate; a deep modern drone like the furnace's breath holds it together. Orange and bronze, patient and strong. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. No lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-villages · The Villages Answer (bed)

Under chapter 4, at night along the river, while village drummers call and the player answers.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-villages.mp3`
- **Style tags (optional):** `beatless vietnamese night ambient, two sao truc flutes call and answer, ho song river song, dan tranh harmonics, pad`

**Prompt:**

> A hopeful night-time beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for villages along the Red River answering the sisters' call one by one. Traditional Vietnamese colour: one bamboo flute (sáo trúc) calls a short phrase from far away and a second, nearer flute answers, again and again; between them a man's voice drifts a line of a river boat song (hò sông) in free time; 16-string zither (đàn tranh) harmonics glint like lantern light; a soft modern pad and faint water textures underneath. G major pentatonic, sparse. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-river · The Outpost on the Hát River (bed)

Under chapter 5, the river battle.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-river.mp3`
- **Style tags (optional):** `beatless vietnamese tense ambient, dan nhi fiddle, dan nguyet tremolo, low cinematic drone, wind, battle tension, no drums`

**Prompt:**

> A tense, determined beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for a battle at a river ford against a Han outpost. Traditional Vietnamese colour: a two-string fiddle (đàn nhị) plays long resolute phrases in A minor pentatonic; a moon lute (đàn nguyệt) shivers in unmeasured tremolo; a deep modern cinematic drone and low strings rise and fall like wind over water. Urgent but never pulsing: the player's war drum is the only rhythm. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. No lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-luylau · The Citadel at Luy Lâu (bed)

Under chapter 6, the night attack on the citadel with the war elephant.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-luylau.mp3`
- **Style tags (optional):** `beatless vietnamese epic ambient, quan ho low female choir, cong chieng gong resonances, dan tranh tremolo, cinematic pad, night`

**Prompt:**

> A majestic, dark beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for the night assault on the Han citadel of Luy Lâu with the sisters on a war elephant. Traditional Vietnamese colour: a low women's choir holds long notes in the manner of quan họ; large bronze gongs (cồng chiêng) are struck softly and left to ring, never in a pattern; a 16-string zither (đàn tranh) trembles; the bamboo flute recalls the title theme in fragments; a wide modern cinematic pad under it all. Moonlit, D minor pentatonic. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. Wordless. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-coronation · The Coronation at Mê Linh (bed)

Under chapter 7, the festival, while festival drummers call and the player answers.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-coronation.mp3`
- **Style tags (optional):** `beatless vietnamese festive ambient, cheo theatre colours, dan nguyet flourishes, quan ho chorus swells, crowd joy, bright pad`

**Prompt:**

> A joyful, glowing beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for the festival when the two sisters are crowned queens at Mê Linh. Traditional Vietnamese colour from chèo folk theatre and quan họ: a moon lute (đàn nguyệt) plays bright unmeasured flourishes, a bamboo flute trills, a women's chorus swells on joyful vocables and fades, small bells shimmer; a bright modern pad carries it. D major pentatonic. Celebratory but without any beat: festival drummers and the player drum on top. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-mavien · Mã Viện Returns (bed)

Under chapter 8, holding the ford against Mã Viện's army.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-mavien.mp3`
- **Style tags (optional):** `beatless vietnamese grave cinematic, dan bau lament, dan nhi, distant war horns, low strings, last stand, no drums`

**Prompt:**

> A grave, urgent beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for the last stand at a river ford as the Han general Mã Viện arrives with a great army. Traditional Vietnamese colour: the monochord (đàn bầu) bends a broken, mournful form of the main theme; a two-string fiddle (đàn nhị) answers; distant war horns call and fade; deep modern cinematic low strings and a dark pad swell and recede like an approaching army. E minor pentatonic. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. No lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-bed-elegy · The Drums Are Melted (bed)

Under chapter 9, the epilogue, while the drums fall silent one by one.

- **Priority:** optional · **Kind:** bed · **Length:** about 2 min · **Loops:** yes
- **File:** `bronzedrum/game/assets/music/mu-bed-elegy.mp3`
- **Style tags (optional):** `beatless vietnamese lullaby hat ru, dan bau, hummed female voice, soft bronze bell, dawn, mournful, sparse`

**Prompt:**

> A quiet, mournful beatless bed for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for the epilogue at grey dawn when the bronze drums are gathered to be melted down. Traditional Vietnamese colour: a woman hums a melody in the manner of a hát ru lullaby, slow and tender; the monochord (đàn bầu) answers her with long bending notes; a single soft bronze bell rings now and then; a thin modern pad like morning mist underneath. A minor pentatonic. Completely beatless and in free time: no pulse, no metre, no drums or percussion keeping time, so a player can drum on top at any speed. It must loop seamlessly: end where it began, with no fade-out and no silence at either end. About 2 minutes. No words. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-wake · The drum wakes (swell)

Once, over the chapter's bed, when four commands chain and the drum wakes.

- **Priority:** optional · **Kind:** swell · **Length:** 15–20 s · **Loops:** no
- **File:** `bronzedrum/game/assets/music/mu-wake.mp3`
- **Style tags (optional):** `vietnamese quan ho chorus swell, bronze shimmer, cinematic rise, beatless, 15 seconds, triumphant`

**Prompt:**

> A 15 to 20 second rising swell for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, played when the sisters' war drum 'wakes' in battle. A women's chorus in the manner of quan họ rises on one joyful open vowel from soft to full, bronze bells and gongs shimmer upward with it, a modern cinematic string swell lifts underneath, and it all rings out and fades in the last few seconds. Beatless: no drums or pulse, so it sits over the player's drumming. D major pentatonic, triumphant. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-victory · Victory sting

Results screen after a battle chapter is won.

- **Priority:** optional · **Kind:** sting · **Length:** about 8 s · **Loops:** no
- **File:** `bronzedrum/game/assets/music/mu-victory.mp3`
- **Style tags (optional):** `short victory sting, vietnamese, sao truc run, dan tranh glissando, bronze gong, cinematic, 8 seconds`

**Prompt:**

> An 8-second victory fanfare for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre. Traditional Vietnamese instruments with a modern cinematic finish: a quick rising bamboo-flute (sáo trúc) run and a sweeping 16-string zither (đàn tranh) glissando land on one bright held chord with soft strings, closing with a ringing bronze gong. D major pentatonic, joyful. No drum kit, no lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-complete · Chapter complete sting

Results screen after a story chapter (no battle) is completed.

- **Priority:** optional · **Kind:** sting · **Length:** about 8 s · **Loops:** no
- **File:** `bronzedrum/game/assets/music/mu-complete.mp3`
- **Style tags (optional):** `short gentle sting, vietnamese, dan tranh, sao truc, soft bronze bell, warm pad, peaceful, 8 seconds`

**Prompt:**

> An 8-second gentle closing phrase for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre, for the end of a peaceful story chapter. A 16-string zither (đàn tranh) plays a short falling pentatonic phrase, a bamboo flute (sáo trúc) answers with one held note, a soft bronze bell rings, and a warm modern pad settles on a calm major chord. Peaceful and satisfied, no drums, no lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-defeat · Defeat sting

Results screen after a battle chapter is lost.

- **Priority:** optional · **Kind:** sting · **Length:** about 8 s · **Loops:** no
- **File:** `bronzedrum/game/assets/music/mu-defeat.mp3`
- **Style tags (optional):** `short defeat sting, vietnamese, dan bau falling phrase, low drone, sorrowful, 8 seconds`

**Prompt:**

> An 8-second defeat sting for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre: the monochord (đàn bầu) plays a single falling, bending phrase over a low drone and a dark modern string pad, ending unresolved. Sorrowful but not hopeless. A minor pentatonic. No percussion, no lyrics. Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.

## mu-anthem · Song of the Two Queens: Trống Đồng Vang Dới Đất Trời (vocal song)

The menus (title and chapter select), round and round, and the Coronation's success moment (the two queens crowned); later the trailer and end credits.

- **Priority:** optional · **Kind:** song · **Length:** about 3 min 30 s · **Loops:** no
- **File:** `bronzedrum/game/assets/music/mu-anthem.mp3`
- **Style tags (optional):** `vietnamese folk ballad, quan ho female duet, dan tranh, dan bau, bronze drums in chorus, modern cinematic folk, 84 bpm`

**Prompt:**

> A folk ballad in Vietnamese for a video game about the Trưng sisters, who led an army of women in an uprising against Han rule in ancient Vietnam around 40 CE, staged as a backlit paper-cut theatre: two queens who rode elephants and beat the bronze drum so the villages would rise. Traditional northern Vietnamese style with a modern cinematic folk production: verses sung by one woman over 16-string zither (đàn tranh); choruses by two women in close quan họ-style harmony with the full ensemble, deep bronze drums and soft strings; a monochord (đàn bầu) solo bridge; a final chorus; an outro that returns to the title melody on bamboo flute (sáo trúc). 84 BPM, D minor pentatonic. Lyrics are still to be written with the author; until then sing on vocables (à ơi, hò). Avoid Chinese or Japanese instrument colour (no guzheng, erhu, pipa, koto, shakuhachi), rock or trap drums, EDM drops and trailer-style braams.
