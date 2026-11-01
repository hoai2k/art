// Bronze Drum sound workbench: audition each chapter's ambience against its
// alternate takes, every sound effect take, and the music, and mark what works.
// The catalogue (sounds.json) is written by design/source/build_audio.py; the
// chapters come from the game's own stages.js.
//
// Paths: published, the game sits one level up (/bronzedrum/assets, /src);
// served from the repository, it is in ../game/.

const $ = (s) => document.querySelector(s);
const STORE = 'bronzedrum.workbench';
const TARGET_DB = -30; // the RMS level every bed plays at with "Match loudness"
const AMB_GAIN = 0.45 * 0.6; // a bed's in-game level: its gain times the default ambience setting

let root = '../';
let audioManifest = { sfx: {}, music: {} };
let catalogue = { sfx: [], music: [], alternates: [] };
let chapters = [];
let marks = {};
try {
  marks = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
} catch {
  marks = {};
}

// ---------------------------------------------------------------- audio

let ctx = null;
let master = null;
const buffers = new Map(); // url -> Promise<AudioBuffer>
const levels = new Map(); // url -> RMS dBFS
let bed = null; // { key, src, gain, row }
let oneShot = null; // { src, el }
let track = null; // { key, src, gain, row }

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = Number($('#volume').value) / 100;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function load(url) {
  if (!buffers.has(url)) {
    buffers.set(url, fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.arrayBuffer();
      })
      .then((b) => audio().decodeAudioData(b))
      .then((buf) => {
        levels.set(url, rmsDb(buf));
        return buf;
      }));
  }
  return buffers.get(url);
}

/** Average level of a buffer, in dB below full scale. */
function rmsDb(buf) {
  let sum = 0;
  let n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i += 4) {
      sum += d[i] * d[i];
      n += 1;
    }
  }
  return 10 * Math.log10(sum / Math.max(1, n) + 1e-12);
}

function fade(gain, to, dur) {
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(to, t + dur);
}

function stopNode(node, dur = 0.4) {
  if (!node) return;
  fade(node.gain, 0, dur);
  setTimeout(() => {
    try {
      node.src.stop();
    } catch {
      /* already stopped */
    }
  }, dur * 1000 + 50);
  if (node.row) node.row.classList.remove('playing');
  if (node.button) setIcon(node.button, false);
}

/** The level a bed plays at: matched to the others, or as it is in the game. */
function bedLevel(url) {
  if (!$('#match').checked) return AMB_GAIN;
  const db = levels.get(url) ?? TARGET_DB;
  return Math.min(4, 10 ** ((TARGET_DB - db) / 20));
}

async function toggleBed(key, url, row, button) {
  audio();
  if (bed && bed.key === key) {
    stopNode(bed);
    bed = null;
    return;
  }
  stopNode(bed);
  stopNode(track);
  track = null;
  status('Loading…');
  let buf;
  try {
    buf = await load(url);
  } catch (e) {
    status(`Could not load ${url}`);
    return;
  }
  status('');
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(master);
  src.start();
  fade(gain, bedLevel(url), 0.4);
  bed = { key, src, gain, row, button, url };
  row.classList.add('playing');
  setIcon(button, true);
  showLevel(row, url);
}

async function playOnce(url, gainValue, el) {
  audio();
  if (oneShot) {
    try {
      oneShot.src.stop();
    } catch {
      /* finished */
    }
    if (oneShot.el) oneShot.el.classList.remove('playing');
  }
  let buf;
  try {
    buf = await load(url);
  } catch {
    status(`Could not load ${url}`);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  src.connect(gain).connect(master);
  src.start();
  if (el) el.classList.add('playing');
  oneShot = { src, el };
  src.onended = () => {
    if (el) el.classList.remove('playing');
  };
}

async function toggleTrack(key, url, loop, row, button) {
  audio();
  if (track && track.key === key) {
    stopNode(track);
    track = null;
    return;
  }
  stopNode(track);
  stopNode(bed);
  bed = null;
  status('Loading…');
  let buf;
  try {
    buf = await load(url);
  } catch {
    status(`Could not load ${url}`);
    return;
  }
  status('');
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (loop && loop.loopEnd) {
    src.loop = true;
    src.loopStart = loop.loopStart || 0;
    src.loopEnd = loop.loopEnd;
  }
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(master);
  src.start();
  fade(gain, 0.6, 0.3);
  track = { key, src, gain, row, button };
  row.classList.add('playing');
  setIcon(button, true);
}

function stopAll() {
  stopNode(bed);
  stopNode(track);
  bed = null;
  track = null;
  $('#along').checked = false;
}

// ---------------------------------------------------------------- drumming over a bed

const drumUrls = () => ({ L: `${root}assets/sfx/drum-tung-1.mp3`, R: `${root}assets/sfx/drum-cac-1.mp3` });
const ALONG = ['L', 'R', 'L', 'R', 'L', 'RR', 'L', 'R']; // two bars: plain, then a pair
let alongNext = 0;
let alongBeat = 0;

async function hit(drum, when = 0, level = 0.8) {
  audio();
  let buf;
  try {
    buf = await load(drumUrls()[drum]);
  } catch {
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = level;
  src.connect(gain).connect(master);
  src.start(Math.max(ctx.currentTime, when));
}

function tickAlong() {
  if (!$('#along').checked || !ctx) return;
  const u = 60 / Number($('#bpm').value);
  if (alongNext < ctx.currentTime) alongNext = ctx.currentTime + 0.1;
  while (alongNext < ctx.currentTime + 0.25) {
    const beat = ALONG[alongBeat % ALONG.length];
    [...beat].forEach((d, i) => hit(d, alongNext + (i * u) / beat.length, 0.7));
    alongNext += u;
    alongBeat += 1;
  }
}
setInterval(tickAlong, 50);

// ---------------------------------------------------------------- marks

function markKey(kind, id) {
  return `${kind}:${id}`;
}

function saveMarks() {
  try {
    localStorage.setItem(STORE, JSON.stringify(marks));
  } catch {
    /* storage unavailable: marks last for this visit */
  }
  renderSummary();
}

/** Keep / Maybe / No buttons and a note field for one take. */
function markControls(key, label) {
  const m = marks[key] || {};
  const box = document.createElement('div');
  box.className = 'marks';
  for (const [v, text] of [['keep', 'Keep'], ['maybe', 'Maybe'], ['no', 'No']]) {
    const b = document.createElement('button');
    b.className = 'mark';
    b.dataset.v = v;
    b.textContent = text;
    b.setAttribute('aria-pressed', String(m.v === v));
    b.setAttribute('aria-label', `${text}: ${label}`);
    b.addEventListener('click', () => {
      const cur = marks[key] || { label };
      cur.label = label;
      cur.v = cur.v === v ? undefined : v;
      marks[key] = cur;
      for (const o of box.querySelectorAll('.mark')) o.setAttribute('aria-pressed', String(cur.v === o.dataset.v));
      saveMarks();
    });
    box.appendChild(b);
  }
  return box;
}

function noteField(key, label) {
  const input = document.createElement('input');
  input.className = 'note';
  input.type = 'text';
  input.placeholder = 'Note (optional)';
  input.setAttribute('aria-label', `Note on ${label}`);
  input.value = (marks[key] && marks[key].note) || '';
  input.addEventListener('input', () => {
    const cur = marks[key] || { label };
    cur.label = label;
    cur.note = input.value;
    marks[key] = cur;
    saveMarks();
  });
  return input;
}

function renderSummary() {
  const lines = [];
  const words = { keep: 'KEEP', maybe: 'maybe', no: 'no' };
  for (const [key, m] of Object.entries(marks)) {
    if (!m.v && !m.note) continue;
    lines.push(`- ${m.label}: ${m.v ? words[m.v] : '(no mark)'}${m.note ? ` — ${m.note}` : ''}`);
  }
  $('#summary').textContent = lines.length ? `Bronze Drum sound workbench notes\n\n${lines.join('\n')}` : 'Nothing marked yet.';
}

// ---------------------------------------------------------------- building the page

const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
const STOP = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" fill="currentColor"/></svg>';

function setIcon(button, playing) {
  if (!button) return;
  button.innerHTML = playing ? STOP : PLAY;
  button.setAttribute('aria-label', `${playing ? 'Stop' : 'Play'} ${button.dataset.label}`);
}

function showLevel(row, url) {
  const db = levels.get(url);
  const el = row.querySelector('.level');
  if (el && db !== undefined) el.textContent = ` · level ${db.toFixed(0)} dB`;
}

function bedRow({ key, name, tag, tagClass, url, prompt, label, measured }) {
  const row = document.createElement('div');
  row.className = 'row';
  const button = document.createElement('button');
  button.className = 'play';
  button.dataset.label = label;
  setIcon(button, false);
  button.addEventListener('click', () => toggleBed(key, url, row, button));
  const info = document.createElement('div');
  info.innerHTML = `<span class="name"></span><span class="tag ${tagClass}"></span><div class="meta"><span class="file"></span><span class="level"></span></div>`;
  info.querySelector('.name').textContent = name;
  info.querySelector('.tag').textContent = tag;
  info.querySelector('.file').textContent = url.split('/').slice(-2).join('/');
  if (measured) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = `Measured: ${measured}`;
    info.appendChild(m);
  }
  row.append(button, info, markControls(key, label));
  if (prompt) {
    const d = document.createElement('details');
    d.innerHTML = '<summary>Prompt</summary><p></p>';
    d.querySelector('p').textContent = prompt;
    row.appendChild(d);
  }
  row.appendChild(noteField(key, label));
  // Measure the level in the background so it shows before playing.
  load(url).then(() => showLevel(row, url)).catch(() => {
    info.querySelector('.level').textContent = ' · missing';
  });
  return row;
}

function buildChapters() {
  const box = $('#chapters');
  box.innerHTML = '';
  const promptOf = (id) => (catalogue.sfx.find((s) => s.id === id) || {}).prompt;
  for (const ch of chapters) {
    const card = document.createElement('article');
    card.className = 'chapter';
    card.innerHTML = '<header><h3></h3><span class="scene"></span></header><div class="chapter-body"><div class="looks"></div><div class="rows"></div></div>';
    card.querySelector('h3').textContent = ch.title;
    card.querySelector('.scene').textContent = ch.scene;
    // What the chapter looks like while its bed plays (scenes/, from
    // make-scenes.mjs), and its card art: judge the sound against the light.
    const looks = card.querySelector('.looks');
    const cardArt = `${root}assets/web/card-${ch.id === 'practice' ? 'practice-free' : ch.id}.webp`;
    for (const [src, alt, cls] of [[`scenes/${ch.id}.webp`, `${ch.title}: the scene in the game`, 'shot'], [cardArt, `${ch.title}: chapter card art`, 'art']]) {
      const a = document.createElement('a');
      a.href = src;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = cls;
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      img.loading = 'lazy';
      img.addEventListener('error', () => a.remove());
      a.appendChild(img);
      looks.appendChild(a);
    }
    const rows = card.querySelector('.rows');
    if (!ch.ambience) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No ambience in the game: the music alone carries this chapter. The takes below are kept in case.';
      rows.appendChild(p);
    }
    if (ch.ambience) {
      rows.appendChild(bedRow({
        key: markKey('bed', `${ch.id}:${ch.ambience}`),
        name: ch.ambience,
        tag: 'in use',
        tagClass: 'inuse',
        url: `${root}assets/sfx/${ch.ambience}.mp3`,
        prompt: promptOf(ch.ambience),
        label: `${ch.title} — current bed ${ch.ambience}`,
      }));
    }
    const alts = catalogue.alternates.filter((a) => a.chapter === ch.id);
    for (const a of alts) {
      rows.appendChild(bedRow({
        key: markKey('alt', a.id),
        name: a.id,
        tag: /-clean$/.test(a.id) ? 'de-buzzed copy' : /-2$/.test(a.id) ? 'new · round 2' : 'alternate',
        tagClass: 'alt',
        url: a.file,
        prompt: a.prompt,
        label: `${ch.title} — alternate ${a.id}`,
        measured: a.measured,
      }));
    }
    if (!alts.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No alternate takes yet.';
      rows.appendChild(p);
    }
    box.appendChild(card);
  }
}

function buildEffects() {
  const box = $('#groups');
  box.innerHTML = '';
  const groups = [];
  for (const s of catalogue.sfx) if (!groups.includes(s.group)) groups.push(s.group);
  for (const gname of groups) {
    const sec = document.createElement('div');
    sec.className = 'group';
    sec.innerHTML = '<h3></h3><div class="rows"></div>';
    sec.querySelector('h3').textContent = gname;
    const rows = sec.querySelector('.rows');
    for (const s of catalogue.sfx.filter((x) => x.group === gname)) {
      const row = document.createElement('div');
      row.className = 'row';
      const takes = document.createElement('div');
      takes.className = 'takes';
      if (!s.files.length) takes.innerHTML = '<span class="muted">none</span>';
      s.files.forEach((f, i) => {
        const b = document.createElement('button');
        b.className = `take${f.rejected ? ' rejected' : ''}`;
        b.textContent = String(i + 1);
        b.title = f.rejected ? `Rejected: ${f.rejected}` : f.file;
        b.setAttribute('aria-label', `Play ${s.id} take ${i + 1}${f.rejected ? ' (rejected)' : ''}`);
        const url = `${root}assets/${f.file}`;
        b.addEventListener('click', () => {
          if (s.kind === 'loop') toggleBed(markKey('sfx', s.id), url, row, null);
          else playOnce(url, s.gain, b);
        });
        takes.appendChild(b);
      });
      const info = document.createElement('div');
      info.innerHTML = '<span class="name"></span><div class="meta"></div>';
      info.querySelector('.name').textContent = s.id;
      info.querySelector('.meta').textContent = s.use;
      const label = `effect ${s.id}`;
      row.append(takes, info, markControls(markKey('sfx', s.id), label));
      const d = document.createElement('details');
      d.innerHTML = '<summary>Prompt</summary><p></p>';
      d.querySelector('p').textContent = s.prompt;
      row.appendChild(d);
      row.appendChild(noteField(markKey('sfx', s.id), label));
      rows.appendChild(row);
      // Candidate takes waiting to replace this effect: each its own row to mark.
      for (const c of s.candidates || []) {
        const crow = document.createElement('div');
        crow.className = 'row candidate';
        const b = document.createElement('button');
        b.className = 'take';
        b.textContent = '▶';
        b.setAttribute('aria-label', `Play candidate ${c.id}`);
        b.addEventListener('click', () => playOnce(c.file, s.gain, b));
        const cinfo = document.createElement('div');
        cinfo.innerHTML = '<span class="name"></span><span class="tag alt">candidate</span><div class="meta"></div>';
        cinfo.querySelector('.name').textContent = c.id;
        cinfo.querySelector('.meta').textContent = `A possible replacement for ${s.id}`;
        const clabel = `candidate ${c.id} (for ${s.id})`;
        crow.append(b, cinfo, markControls(markKey('cand', c.id), clabel), noteField(markKey('cand', c.id), clabel));
        rows.appendChild(crow);
      }
    }
    box.appendChild(sec);
  }
}

function buildMusic() {
  const box = $('#tracks');
  box.innerHTML = '';
  // Experiments with ElevenLabs' music model, to judge whether it is worth pursuing.
  for (const t of catalogue.musicTrials || []) {
    const row = document.createElement('div');
    row.className = 'row';
    const button = document.createElement('button');
    button.className = 'play';
    button.dataset.label = t.id;
    setIcon(button, false);
    button.addEventListener('click', () => toggleTrack(markKey('trial', t.id), t.file, null, row, button));
    const info = document.createElement('div');
    info.innerHTML = '<span class="name"></span><span class="tag alt">ElevenLabs music trial</span><div class="meta"></div>';
    info.querySelector('.name').textContent = t.id;
    info.querySelector('.meta').textContent = `A try at the request ${t.request}: is the music model worth pursuing?`;
    const label = `music trial ${t.id}`;
    const d = document.createElement('details');
    d.innerHTML = '<summary>Prompt</summary><p></p>';
    d.querySelector('p').textContent = t.prompt;
    row.append(button, info, markControls(markKey('trial', t.id), label), d, noteField(markKey('trial', t.id), label));
    box.appendChild(row);
  }
  for (const m of catalogue.music) {
    const row = document.createElement('div');
    row.className = 'row';
    const button = document.createElement('button');
    button.className = 'play';
    button.dataset.label = m.title;
    setIcon(button, false);
    const loop = audioManifest.music[m.id];
    button.addEventListener('click', () => toggleTrack(markKey('music', m.id), `${root}assets/${m.file}`, loop, row, button));
    const info = document.createElement('div');
    info.innerHTML = '<span class="name"></span><div class="meta"></div>';
    info.querySelector('.name').textContent = m.title;
    info.querySelector('.meta').textContent = `${m.id} · ${m.kind}${loop && loop.loopEnd ? ' · loops' : ''}`;
    const label = `music ${m.id}`;
    row.append(button, info, markControls(markKey('music', m.id), label), noteField(markKey('music', m.id), label));
    box.appendChild(row);
  }
}

function status(text) {
  const el = $('#status');
  el.textContent = text;
  el.classList.toggle('show', !!text);
}

// ---------------------------------------------------------------- start

async function findRoot() {
  for (const r of ['../', '../game/']) {
    try {
      const res = await fetch(`${r}assets/audio.json`);
      if (res.ok) {
        root = r;
        return res.json();
      }
    } catch {
      /* try the next */
    }
  }
  throw new Error('game assets not found');
}

// What each chapter's scene is, for judging its bed.
const SCENES = {
  garden: 'Dawn · the garden at Mê Linh, lotus pond, training targets',
  oath: 'Dusk · the father’s funeral, incense in a courtyard',
  casting: 'Night · an open-air bronze foundry',
  villages: 'Night · stilt villages along the river, lanterns lighting',
  outpost: 'Day · a river ford, battle',
  luylau: 'Night · outside a walled citadel, battle',
  coronation: 'Day · festival before the palace gate',
  mavien: 'Dusk · a river ford, the Han army arrives',
  elegy: 'Grey dawn · the drums melted, a river and lotus',
  practice: 'Dusk · a village green, a fire and dancers',
};

async function boot() {
  try {
    audioManifest = await findRoot();
    catalogue = await (await fetch('sounds.json')).json();
    const { STAGES } = await import(`${root}src/stages.js`);
    chapters = STAGES.map((s) => ({ id: s.id, title: s.title, ambience: s.ambience, scene: SCENES[s.id] || s.subtitle }));
    chapters.push({ id: 'practice', title: 'Drum Practice', ambience: 'amb-practice', scene: SCENES.practice });
  } catch (e) {
    status(`Could not load the sound catalogue: ${e.message}`);
    return;
  }
  buildChapters();
  buildEffects();
  buildMusic();
  renderSummary();
}

$('#volume').addEventListener('input', () => {
  if (master) master.gain.value = Number($('#volume').value) / 100;
});
$('#match').addEventListener('change', () => {
  if (bed) fade(bed.gain, bedLevel(bed.url), 0.3);
});
$('#bpm').addEventListener('input', () => {
  $('#bpm-out').textContent = $('#bpm').value;
});
$('#along').addEventListener('change', () => {
  audio();
  alongNext = 0;
  alongBeat = 0;
});
$('#stop').addEventListener('click', stopAll);
$('#stop-float').addEventListener('click', stopAll);
$('#copy').addEventListener('click', async () => {
  const text = $('#summary').textContent;
  try {
    await navigator.clipboard.writeText(text);
    $('#copied').textContent = 'Copied.';
  } catch {
    // Clipboard blocked: select the text so it can be copied by hand.
    const range = document.createRange();
    range.selectNodeContents($('#summary'));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    $('#copied').textContent = 'Selected: press Ctrl+C (⌘C) to copy.';
  }
  setTimeout(() => {
    $('#copied').textContent = '';
  }, 3000);
});
$('#clear').addEventListener('click', () => {
  if (!confirm('Clear every mark and note?')) return;
  marks = {};
  saveMarks();
  buildChapters();
  buildEffects();
  buildMusic();
});
// Drum yourself over a bed: F is tùng, J is cắc (not while typing a note).
window.addEventListener('keydown', (e) => {
  if (e.repeat || (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text')) return;
  if (e.code === 'KeyF') hit('L');
  if (e.code === 'KeyJ') hit('R');
});

boot();
