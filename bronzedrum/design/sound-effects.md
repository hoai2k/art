# Bronze Drum: sound effects

Every sound effect in the game, generated with ElevenLabs' sound-effects model from the prompts below. Generated from `source/build_audio.py`; edit the data there. `build_audio.py --generate` makes any effect whose file is missing, and `--force <id>` remakes one. The key is read from `ELEVENLABS_API_KEY` (or `~/.config/elevenlabs.key`) and never stored in the repository.

Processing: hits are trimmed so the sound starts on its transient (the drum strokes must land exactly when the player presses), one-shots get a short fade-out, every file is peak-normalised to -1 dBFS, and the game balances them with the per-sound gain. Effects with several variants are picked at random so repeated strokes do not sound mechanical.

Sound direction: real, acoustic and close — bronze, wood, bamboo, water, paper, voices. No synth tones, no music in the effects. Hits are paper tearing, never gore.

**69 of 71 files in use.**

Each generated file was checked by measuring its length, peak, level over time (50 ms windows) and the balance of energy below 200 Hz and above 2 kHz: a drum stroke must start on its loudest moment and be one stroke, a rim click must be bright and short. Takes that failed are kept out of the game:

- `sfx/kit-bamboo-high-1.mp3`: two takes, both with a second bounce of the beater; the other take, trimmed, is clean.
- `sfx/drum-tung-2.mp3`: eight takes, none both a single stroke and deep (more energy under 200 Hz than over 2 kHz); the model drifts to a bright metallic hit, and two good deep strokes give enough variety.

## The drum

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `drum-tung` | Trưng Trắc's centre stroke (tùng), played on every left-hand input. (hit) | 2.0 s | 2/3 | One strong stroke with a padded wooden beater on the centre of a large ancient Vietnamese bronze kettle drum: a deep round boom followed by a shimmering metallic bronze ring. A single hit, close-miked, dry room, no music. |
| `drum-cac` | Trưng Nhị's rim stroke (cắc), played on every right-hand input and flourish. (hit) | 0.7 s | 3/3 | One sharp stroke of a hardwood stick on the rim of a bronze kettle drum: a bright, dry, metallic click with a short ring. A single hit, close-miked, no music. |
| `drum-chau` | The shield: a stroke on the big hide barrel drum beside the bronze drum, under the shields locking (A / Space / the Shield drum). (hit) | 1.2 s | 2/2 | One heavy stroke of a padded wooden beater on the centre of a large Vietnamese barrel drum (trống chầu) with a thick buffalo-hide head: a deep, warm, dry thud with a short low boom, no metal ring. A single hit, close-miked, dry room, no music. |
| `drum-mo` | Reset the rhythm: a knock on the wooden slit drum (Y / R / the Reset drum). (hit) | 0.5 s | 2/2 | One knock of a wooden mallet on a hollow Vietnamese wooden slit drum (mõ, a temple block): a round, dry, woody 'tok' with a tiny hollow resonance. A single hit, close-miked, no music. |
| `drum-wake` | The drum wakes: four commands chained. (sting) | 4.0 s | 1/1 | A huge bronze gong struck softly and swelling: a rising shimmering bronze resonance that blooms and slowly fades, ceremonial and awe-struck. |
| `stumble` | A stroke during the army's answer, or off the beat. (hit) | 0.5 s | 1/1 | A dull, slightly off-key wooden knock, clumsy and muted, very short. |

## Drum practice: the kits

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `kit-com-low` | Rice drum kit, low voice (Drum Practice). (hit) | 1.0 s | 2/2 | One stroke of the flat palm on the large head of a Vietnamese rice drum (trống cơm), a long two-headed wooden barrel drum tuned with rice paste: a warm, round, pitched low 'bùng' tone that sings briefly. A single hit, close-miked, dry room, no music. |
| `kit-com-high` | Rice drum kit, high voice (Drum Practice). (hit) | 0.6 s | 2/2 | One quick slap of the fingers on the small head of a Vietnamese rice drum (trống cơm): a bright, tight, pitched high 'tang' tone, short. A single hit, close-miked, dry room, no music. |
| `kit-gong-low` | Gong kit, low voice (Drum Practice). (hit) | 2.0 s | 2/2 | One strike of a padded mallet on a large flat bronze gong of the Vietnamese Central Highlands (cồng chiêng): a deep, warm, humming bronze tone that rings and fades. A single hit, close-miked, no music. |
| `kit-gong-high` | Gong kit, high voice (Drum Practice). (hit) | 1.4 s | 2/2 | One sharp strike of a hard mallet on the boss of a small bronze gong (chiêng): an instant, bright, clear, high-pitched bronze tone with a medium ring, loudest at the very start. A single hit, close-miked, no music. |
| `kit-bamboo-low` | Bamboo kit, low voice (Drum Practice). (hit) | 0.8 s | 2/2 | One strike of a soft wooden beater on a large bamboo tube of a Vietnamese bamboo xylophone (đàn t'rưng): a hollow, woody, pitched low 'tok' with a short resonant ring. A single hit, close-miked, dry room, no music. |
| `kit-bamboo-high` | Bamboo kit, high voice (Drum Practice). (hit) | 0.5 s | 1/2 | One sharp strike of a small hard wooden beater on the shortest, thinnest bamboo tube of a đàn t'rưng: a bright, hollow, high-pitched woody 'tik', very short, an octave above a large tube. Exactly one hit, close-miked, dry room, no music. |
| `kit-lan-drum` | Lion-dance kit, low voice (Drum Practice). (hit) | 1.0 s | 2/2 | One heavy stroke of a wooden stick on the centre of a big Vietnamese lion-dance drum (trống lân): a booming, punchy, low drum hit with a little buzz of the skin, no metal. A single hit, close-miked, dry room, no music. |
| `kit-lan-cymbal` | Lion-dance kit, high voice (Drum Practice). (hit) | 0.8 s | 2/2 | One clash of a pair of small brass hand cymbals (chũm chọe) in a lion dance: a bright, splashy, brassy crash, cut short. A single clash, close-miked, no music. |

## The army answers

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `call` | Beats 1 and 3 of every answer, under the command's own sound. (hit) | 0.9 s | 3/3 | A group of women warriors shouting one short unison battle cry, 'Hô!', outdoors, fierce and together, a single shout. |
| `cmd-march` | Tiến (march) answer. (one-shot) | 2.5 s | 1/1 | A company of barefoot soldiers marching in step through the shallow water of a rice paddy: rhythmic splashing and squelching footsteps. |
| `cmd-strike` | Đánh (strike) answer. (one-shot) | 2.5 s | 1/1 | Bronze-tipped spears thrusting and clashing against wooden shields and armour, a short fierce skirmish of a small group, no voices. |
| `cmd-shield` | The guard: shields thrown up against a blow (A / Space). (one-shot) | 1.5 s | 1/1 | Many round wooden and hide shields raised together and locked with one heavy hollow thump. |
| `cmd-rally` | The women cheer when the drum wakes (four commands chained). (one-shot) | 2.5 s | 1/1 | A group of women ululating and cheering together outdoors, a rallying cry rising and falling. |
| `cmd-charge` | The elephant charge: a strike on a waking drum in chapter 3. (one-shot) | 3.0 s | 1/1 | A war elephant trumpets loudly, then charges: heavy thundering footsteps that shake the ground. |

## Battle

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `volley` | The archers shoot on a strike. (one-shot) | 1.5 s | 1/1 | A volley of arrows released from several bows at once, whooshing away through the air. |
| `bolts` | Han crossbows and the fort fire. (one-shot) | 1.5 s | 1/1 | Several crossbow bolts fired and thudding into wooden shields, quick hollow thunks. |
| `hit-paper` | Every hit: in this game wounds are paper tearing. (hit) | 0.6 s | 3/3 | A sharp quick tear of thick handmade paper, a single rip. |
| `hit-straw` | Hits on the straw targets in chapter 1. (hit) | 0.7 s | 1/1 | A spear stabbing into a bundled straw training dummy: a dry rustling thud. |
| `defeat-han` | A Han soldier falls. (one-shot) | 1.2 s | 1/1 | A soldier's lamellar armour and halberd clattering to the ground, metal plates rattling. |
| `fort-break` | The fort falls. (one-shot) | 3.0 s | 1/1 | A wooden palisade of sharpened stakes splintering and collapsing, a long timber crash. |
| `trample` | The elephant charge lands. (hit) | 1.2 s | 1/1 | A heavy elephant stomp crushing wood, a deep ground-shaking impact. |
| `wound` | The army is hit while its shields are down. (one-shot) | 1.0 s | 1/1 | Arrows striking wooden shields and a few soft pained gasps from a group of women. |
| `blocked` | The army is hit with shields raised. (one-shot) | 1.0 s | 1/1 | Arrows glancing off raised bronze-studded shields, light metallic ticks. |

## Interface

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `ui-move` | Moving focus in menus. Halved (too prominent while browsing). (hit) | 0.5 s | 1/1 | A soft rustle of a single sheet of rice paper being turned, very short and quiet. |
| `ui-confirm` | Choosing a menu item. Its tail carried a hiss (heard on the workbench): denoised and cut short after the knock. Played quieter (too prominent while browsing). (hit) | 0.5 s | 1/1 | A small hardwood clapper knock, clean and single, like a temple woodblock. |
| `ui-back` | Closing a menu or dialog. Too prominent (heard on the workbench): shortened, softened and played quieter, then halved again (still too loud in play). (hit) | 0.5 s | 1/1 | A sheet of paper sliding softly across a wooden table, short. |
| `ui-start` | Press Start. It carries a faint static (heard on the workbench); three cleaner takes wait on the workbench as candidates. (sting) | 2.5 s | 1/1 | A single resonant strike on a small bronze gong, ringing out. |
| `village-wakes` | The Villages Answer: a village answers and lights its lanterns. (sting) | 3.0 s | 1/1 | A riverside village wakes at night: a bronze gong struck once in the distance, then a small crowd of villagers calling out joyfully together, and a hand drum rolling briefly in answer, all echoing over the water. |

## Stings

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `victory` | A chapter is won. (sting) | 4.5 s | 1/1 | A triumphant flourish on large bronze drums and gongs, building quickly and ending on one ringing gong stroke. |
| `defeat` | A chapter is lost. (sting) | 4.5 s | 1/1 | A low bronze gong struck softly once, fading slowly with sorrow, a breath of wind after. |

## Story chapters

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `pour` | Casting the Drums: a steady phrase pours bronze. (one-shot) | 2.5 s | 1/1 | Molten bronze poured from a clay crucible into a mould: a thick glugging pour with hissing steam and crackling. |
| `crack` | Casting the Drums: a phrase that drifts cracks the mould. (one-shot) | 1.5 s | 1/1 | A clay casting mould cracking from the heat: one sharp crack, then crumbling pieces and a hiss of steam. |
| `lantern` | The Oath and The Villages Answer: an answered call lights incense or lanterns. (one-shot) | 1.5 s | 1/1 | A paper lantern being lit at night: a soft whoosh of flame catching, then one small clear bronze bell. |
| `crowd-cheer` | The Coronation: the crowd answers each rhythm. (one-shot) | 3.0 s | 1/1 | A festival crowd in an ancient village square cheering and clapping with joy, a few small gongs ringing. |
| `dancer-join` | Drum Practice: a dancer walks in to join the dance. (one-shot) | 1.5 s | 2/2 | A single joyful shout of 'hey!' from a villager joining a dance by a fire, with two or three quick hand claps and a jingle of small ankle bells, outdoors at dusk. Short, no music, no drums. |
| `han-horn` | Mã Viện Returns: a new Han column arrives. (one-shot) | 3.0 s | 1/1 | Several ancient war horns made of buffalo horn blown together in the distance across a river, a low ominous call that swells and fades, an army approaching. |

## Ambience

| Id | Use | Length | Files | Prompt |
| --- | --- | ---: | --- | --- |
| `amb-garden` | Chapter 1 bed, looped. Its bird calls spiked up to 36 dB over the bed (heard as distortion through the master limiter); a fast compressor holds them to about 18 dB over it and a gentle low-pass softens their edge, the bed itself unchanged. (loop) | 20.0 s | 1/1 | Peaceful dawn in a northern Vietnamese garden by a lotus pond: songbirds, gentle trickling water, a distant rooster, a light breeze through bamboo. Continuous, no music. |
| `amb-river` | Chapter 2 bed, looped. (loop) | 20.0 s | 1/1 | Daytime on the bank of a wide slow river: flowing water, wind in tall reeds, distant herons and birds. Continuous, no music, no drums. |
| `amb-foundry` | Casting the Drums bed, looped. Chosen from six takes as the least tonal (the old take had a steady hum that read as a machine); looped with a 3 s crossfade and raised 7 dB under a soft limiter. (loop) | 20.0 s | 1/1 | Blacksmith's forge ambience recorded outdoors, traditional and hand-powered: crackling coal fire, slow leather bellows whooshing, hot metal hissing now and then, crickets far off. Natural, no machinery, no electrical hum, no music. |
| `amb-village` | The Villages Answer bed, looped: the workbench take villages-frogs, chosen over the old cricket bed (muffled and metallic). (loop) | 20.0 s | 1/1 | Night on the Red River delta: a loud chorus of rice-paddy frogs and toads croaking, crickets, water lapping against bamboo boats. Calm. |
| `amb-elegy` | The Drums Are Melted bed, looped: the workbench take elegy-dawn (the chapter used to borrow the river bed). (loop) | 20.0 s | 1/1 | A very quiet grey dawn by a still river: a single bird singing far away, soft wind, water barely lapping, the low distant roar of a furnace. Melancholy and sparse. |
| `amb-practice` | Drum Practice bed (the village green at dusk), looped: the workbench take practice-dusk-2. (loop) | 20.0 s | 1/1 | Dusk at the edge of a Vietnamese village: a soft breeze in bamboo, a water buffalo's wooden bell far off in the fields, a few birds settling for the night, a far-off frog. Peaceful. No insects. Real outdoor field recording, no music, no drums, no clear words. |
| `amb-fire` | Drum Practice: the bonfire on the green, a second layer over the bed whose level follows the fire (louder as the drumming builds): the workbench take practice-fire-2. (loop) | 20.0 s | 1/1 | A bonfire crackling gently in the open at dusk, a soft breeze through palm leaves, distant frogs. Warm and calm. No insects. Real outdoor field recording, no music, no drums, no clear words. |
| `amb-coronation` | The Coronation bed, looped: the workbench take coronation-crowd, a festival crowd (the chapter used to borrow the dawn garden bed). (loop) | 20.0 s | 1/1 | A festive crowd in a village square in Vietnam on a sunny day: the lively murmur of hundreds of people, children laughing, vendors calling in the distance, cloth banners flapping in the breeze. |
| `breeze` | The Oath: the breeze stirred by holding A or Y, faded with the wind. (loop) | 8.0 s | 1/1 | A soft, warm breeze blowing in gentle gusts through an open courtyard, rustling leaves lightly. Continuous, airy and natural, no whistling, no howling, no music. |
| `amb-night` | Chapter 3 bed, looped. (loop) | 20.0 s | 1/1 | Night in the countryside outside a walled town: crickets, frogs croaking in flooded rice paddies, distant torches crackling, a faint wind. Continuous, no music. |

## Alternate ambience takes

Candidate beds to audition on the workbench (`bronzedrum/workbench/`), each levelled to -22 LUFS and kept in `workbench/alt/`, not loaded by the game. `build_audio.py --alternates` makes any that are missing.

| Chapter | Id | File | Prompt |
| --- | --- | --- | --- |
| garden | `garden-birds` | yes; measured: very uneven: 43 dB between its quiet and loud moments; may have near-silent gaps | Dawn in a garden in northern Vietnam: red-whiskered bulbuls and magpie-robins singing close by, an Asian koel calling in the distance, a rooster far off, water trickling into a lotus pond. Real outdoor field recording, no music, no drums, no clear words. |
| garden | `garden-pond` | yes; measured: steady, nothing stands out | Early morning beside a lotus pond in a Vietnamese village: a frog plopping into the water now and then, dragonflies buzzing past, sparrows chirping in the eaves, bamboo creaking softly in a light breeze. Real outdoor field recording, no music, no drums, no clear words. |
| garden | `garden-buffalo` | yes; measured: steady, nothing stands out | A quiet dawn courtyard in the Vietnamese countryside: doves cooing softly, distant roosters, a water buffalo's wooden bell clonking far off in the fields, leaves rustling. Sparse and peaceful. Real outdoor field recording, no music, no drums, no clear words. |
| casting | `casting-furnace` | yes; measured: very even: a steady roar | Night at an ancient open-air bronze foundry: a big charcoal furnace roaring and crackling, embers popping, molten metal hissing on wet clay, workers' voices murmuring far away. No machinery, no hammering. Real outdoor field recording, no music, no drums, no clear words. |
| casting | `casting-charcoal` | yes; measured: steady, nothing stands out | A charcoal fire burning hot in a clay furnace outdoors at night: the deep steady roar of flames, the crackle and pop of charcoal, sparks, an occasional hiss of steam, crickets far off. No machinery, no rhythm. Real outdoor field recording, no music, no drums, no clear words. |
| outpost | `outpost-cicadas` | yes; measured: steady, nothing stands out | A hot afternoon on a riverbank: a loud shimmering chorus of cicadas in the trees, slow water flowing, wind in the reeds, a crow cawing far off. Real outdoor field recording, no music, no drums, no clear words. |
| coronation | `coronation-market` | yes; measured: uneven: 25 dB swings | A sunny festival morning in a market square: a gentle bustle of people, footsteps, laughter, a rooster, sparrows, a light wind. Cheerful. Real outdoor field recording, no music, no drums, no clear words. |
| mavien | `mavien-wind` | yes; measured: very even: steady wind and water | Evening wind over a wide river at dusk: fast-flowing water, gusts in the reeds, crows calling, the faint distant murmur of a large crowd across the water. Grave and tense. Real outdoor field recording, no music, no drums, no clear words. |
| oath | `oath-dusk-2` | yes; measured: steady, nothing stands out | A still dusk in a quiet countryside courtyard: a soft breeze through banana and bamboo leaves, a slow trickle of water from a stone basin, a distant bird calling once or twice. Calm and solemn. No insects, no hum. Real outdoor field recording, no music, no drums, no clear words. |
| oath | `oath-rain-2` | yes; measured: steady, nothing stands out | Light evening rain falling softly on a tiled roof and on broad leaves in a quiet courtyard, a few drips into a stone jar, gentle and steady. No thunder, no insects. Real outdoor field recording, no music, no drums, no clear words. |
| oath | `oath-pond-2` | yes; measured: steady, nothing stands out | Dusk beside a still lotus pond: an occasional frog calling softly, water barely moving, a soft breeze in the reeds, a far-off bird. Sparse and quiet. No insects. Real outdoor field recording, no music, no drums, no clear words. |
| luylau | `luylau-frogs-2` | yes; measured: steady, nothing stands out | Night beside the flooded rice paddies outside an old town: a chorus of frogs and toads croaking, a gentle wind, water lapping at the edge of a moat. Calm but watchful. No insects, no traffic. Real outdoor field recording, no music, no drums, no clear words. |
| luylau | `luylau-wind-2` | yes; measured: steady, nothing stands out | A warm night wind blowing across open fields and through tall grass by a river, distant frogs, leaves rustling. No insects, no rumble. Real outdoor field recording, no music, no drums, no clear words. |
| mavien | `mavien-river-2` | yes; measured: steady, nothing stands out | Dusk on the bank of a wide, slow river: calm flowing water, a cool wind through tall reeds, a few crows calling far off. Grave and quiet. No insects. Real outdoor field recording, no music, no drums, no clear words. |
| coronation | `coronation-crowd-2` | yes; measured: steady, nothing stands out | A large festive crowd murmuring happily at a distance in an open square on a sunny day, steady and even, no single voice standing out, flags flapping softly in the wind. No cheering bursts. Real outdoor field recording, no music, no drums, no clear words. |
| oath | `oath-gecko-clean` | yes; measured: steady, nothing stands out | De-buzzed copy of the turned-down take oath-gecko (heard as: almost, but synthetic and metallic): the 200 Hz comb notched out. |
| oath | `oath-temple-clean` | yes; measured: steady, nothing stands out | De-buzzed copy of the turned-down take oath-temple (heard as: insects good, then metallic sounds): the 200 Hz comb notched out. |
| luylau | `amb-night-clean` | yes; measured: steady, nothing stands out | De-buzzed copy of Luy Lâu's bed amb-night (heard as: a bit synthetic): the 200 Hz comb notched out. |
| luylau | `luylau-moat-clean` | yes; measured: steady, nothing stands out | De-buzzed copy of the turned-down take luylau-moat (heard as: a synthetic buzz): the 200 Hz comb notched out. |
| outpost | `outpost-cicadas-clean` | yes; measured: steady, nothing stands out | De-buzzed copy of the take outpost-cicadas (heard as: almost, but a bit synthetic): the 200 Hz comb notched out. |
| villages | `amb-village-clean` | yes; measured: steady, nothing stands out | De-buzzed copy of the Villages bed amb-village (frogs, kept) (heard as: kept): the 200 Hz comb notched out. |
| garden | `amb-garden-clean` | yes; measured: steady, nothing stands out | De-buzzed copy of the garden bed amb-garden (heard as: okay apart from loud birds (since tamed)): the 200 Hz comb notched out. |

Turned down on the workbench (and removed), with the reason heard:

- `oath-gecko`: almost, but synthetic and metallic.
- `oath-temple`: the insects were good, then metallic, synthetic sounds.
- `oath-wake`: just a low buzz.
- `casting-workshop`: too specific: events, not an ambience.
- `villages-boat`: muffled.
- `villages-geckos`: a metallic buzz.
- `outpost-ford`: something synthetic in it.
- `outpost-wind`: wind on a microphone.
- `luylau-torches`: sounds like driving in a car.
- `luylau-moat`: a synthetic buzz.
- `luylau-camp`: radio buzz.
- `coronation-gate`: too uneven: fire, children, random cheers.
- `mavien-army`: not ambient: mostly horses.
- `mavien-line`: not ambient: footsteps and carts.
- `elegy-embers`: a highway in the distance behind the fire.
- `elegy-lotus`: radio buzz.
- `practice-village`: AI artefacts; the laughter is not natural.
- `practice-festival`: not ambient: a person laughing close to the microphone.
- `amb-mourning-clean`: still a high-pitched synthetic sound, de-buzzed or not (the Oath now has no ambience).
