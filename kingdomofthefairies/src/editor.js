// ?edit=local: a panel for setting how far each edition is unlocked on this
// machine. Each edition keeps its own save (STORAGE_PREFIXES); the panel
// reads and writes all three, so they can be set independently. The choice
// runs from "nothing unlocked" (only the first act can be played) through
// each act by name (it and every act before it open) to "everything
// unlocked" (every act and every scene in the scene select). Nothing here
// leaves this browser.
import { STORAGE_PREFIXES, EDITION } from './theme.js';

const EDITIONS = [
  { id: 'film', name: 'The film edition (default)', query: '', acts: ['Prologue · The Betrothal', 'Act I · The Royal Crossing', 'Act II · The Water Fairy', "Act III · Neptune's Court", "Act IV · The Whale's Passage", 'Act V · The Enchanted Tower', 'Act VI · The Burning Tower'] },
  { id: 'partial', name: 'Kingdom of the Fairies, classic', query: '?widowsbay=partial', acts: ['Act I · The Crossing', "Act II · The Sleepers' Grotto", "Act III · The Sea King's Court", "Act IV · The Whale's Road", 'Act V · The Enchanted Tower'] },
  { id: 'widowsbay', name: "Widow's Bay", query: '?widowsbay=on', acts: ['Act I · The Crossing', "Act II · The Sleepers' Grotto", "Act III · The Sea King's Court", "Act IV · The Whale's Road", "Act V · Widow's Bay"] },
];
// The dropdown's levels for an edition: value = how many acts are open
// (1 = nothing unlocked), plus 'all' for every act and every scene.
const levels = (ed) => [
  { value: '1', label: `Nothing unlocked (only ${ed.acts[0]})` },
  ...ed.acts.slice(1).map((a, i) => ({ value: String(i + 2), label: `Up to ${a}` })),
  { value: 'all', label: 'Everything unlocked (every act and every scene)' },
];
function describe(ed, v) {
  const n = ed.acts.length;
  if (v === 'all') return `All ${n} acts can be chosen on the playbill, and every scene of each in the scene select.`;
  const k = +v;
  if (k === 1) return `Only ${ed.acts[0]} can be played; the others open as each is finished. Scenes open as they are reached.`;
  return `${ed.acts[0]} to ${ed.acts[k - 1]} can be chosen on the playbill (${k} of ${n}); the rest stay locked. Scenes open as they are reached.`;
}
const ALL_SCENES = 99;   // more than any act has

const keyOf = (id) => STORAGE_PREFIXES[id] + '.save.v1';
function read(id) {
  try { const s = JSON.parse(localStorage.getItem(keyOf(id)) || 'null'); if (s && s.v === 1) return s; } catch { /* storage unavailable */ }
  return { v: 1, unlocked: 1, results: {}, best: {} };
}
function write(id, save) { try { localStorage.setItem(keyOf(id), JSON.stringify(save)); return true; } catch { return false; } }
const allScenes = (save) => Object.keys(save.scenes || {}).length > 0 && Object.values(save.scenes).every((v) => v >= ALL_SCENES);

export function editorWanted() { return new URLSearchParams(location.search).get('edit') === 'local'; }

// Builds and opens the panel; `onChange(id)` runs after an edition's save is
// written (the game reloads its own save when that edition is the one open).
export function openEditor(onChange = () => {}) {
  const dlg = document.createElement('dialog');
  dlg.id = 'unlock-editor';
  dlg.className = 'unlock-editor';
  dlg.setAttribute('aria-labelledby', 'unlock-h');
  dlg.innerHTML = `<button type="button" class="card-x" aria-label="Close">×</button><h2 id="unlock-h">Unlocked acts on this machine</h2>
    <p class="unlock-note">Each version of the game keeps its own progress. Choose how far each one is open; it is saved in this browser only.</p>
    <div class="unlock-list"></div>
    <div class="unlock-row"><button type="button" data-close data-focus>Done</button></div>`;
  const list = dlg.querySelector('.unlock-list');
  for (const ed of EDITIONS) {
    const save = read(ed.id), n = ed.acts.length;
    const now = allScenes(save) && save.unlocked >= n ? 'all' : String(Math.max(1, Math.min(save.unlocked, n)));
    const box = document.createElement('section');
    box.className = 'unlock-edition' + (ed.id === EDITION ? ' current' : '');
    const opts = levels(ed).map((o) => `<option value="${o.value}"${o.value === now ? ' selected' : ''}>${o.label}</option>`).join('');
    box.innerHTML = `<h3>${ed.name}${ed.id === EDITION ? ' <small>(this page)</small>' : ''}</h3>
      <p class="unlock-q"><a href="./${ed.query ? ed.query + '&' : '?'}edit=local">${ed.query || 'no parameter'}</a></p>
      <label>Unlocked <select data-ed="${ed.id}">${opts}</select></label>
      <p class="unlock-what" aria-live="polite"></p>
      <ol>${ed.acts.map((a, i) => `<li data-i="${i}">${a}</li>`).join('')}</ol>`;
    list.append(box);
    const sel = box.querySelector('select'), what = box.querySelector('.unlock-what');
    const paint = () => {
      const k = sel.value === 'all' ? n : +sel.value;
      box.querySelectorAll('li').forEach((li) => { const open = +li.dataset.i < k; li.classList.toggle('open', open); li.title = open ? 'open' : 'locked'; });
      what.textContent = describe(ed, sel.value);
    };
    sel.addEventListener('change', () => {
      const s = read(ed.id), all = sel.value === 'all';
      s.unlocked = all ? n : +sel.value;
      s.scenes = { ...(s.scenes || {}) };
      for (let a = 1; a <= n; a++) {
        if (all) s.scenes[a] = ALL_SCENES;
        else if (s.scenes[a] >= ALL_SCENES) delete s.scenes[a];
      }
      write(ed.id, s); paint(); onChange(ed.id);
    });
    paint();
  }
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('.card-x').addEventListener('click', () => dlg.close());
  // a tap on the backdrop, outside the panel, closes it
  const outside = (e) => { const r = dlg.getBoundingClientRect(); return e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); };
  let downOut = false;
  dlg.addEventListener('pointerdown', (e) => { downOut = outside(e); });
  dlg.addEventListener('click', (e) => { if (downOut && outside(e)) dlg.close(); downOut = false; });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}
