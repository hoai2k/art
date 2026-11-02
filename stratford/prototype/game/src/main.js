// Stratford Squirrel: the shell. Boots the renderer, loads the town (or a
// stand-in) and the player's creature, runs the title, play, pause and map
// screens and the render loop, and wires the exploration rules, input, audio
// and UI together. The world and creatures are plug-ins loaded dynamically;
// anything missing falls back to something small that works.

import * as THREE from 'three';
import { createInput, zeroControls } from './input.js';
import { createAudio } from './audio.js';
import { createMenus } from './ui/menus.js';
import { createHud } from './ui/hud.js';
import { createMap } from './ui/map.js';
import { bindSettings } from './ui/settings-ui.js';
import { createTouch } from './ui/touch.js';
import { createChrome, requestFullscreen, exitFullscreen, fullscreenElement } from './ui/chrome.js';
import { createCreatureSelect } from './ui/creature-select.js';
import { CREATURE_INFO } from './creatures/index.js';
import { loadSettings, writeSettings } from './game/save.js';
import { createExploration } from './game/exploration.js';
import { placeNuts } from './game/nuts.js';
import { createNutView } from './game/nutview.js';
import { createMinimalWorld, createCapsuleCreature, createCapsuleCamera } from './game/fallback.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEFAULT_CREATURE = 'squirrel';
const STEP = 1 / 30; // the rules run on a fixed step

const settings = loadSettings();
const state = {
  zoomSave: 0, // s until the changed camera zoom is written to the settings
  paused: false, pauseReason: '', transitioning: false, expectUnlock: false,
  heading: 0, time: 0, acc: 0, idle: 0, stride: 0, climbTick: 0, lastFrame: 0, size: '',
};
let renderer; let scene; let camera; let world; let creature; let camCtl; let exploration; let nutView; let townData = null;
let menus; let hud; let map; let audio; let input; let touchUi; let chrome;
let creatureKind = q.get('creature') || settings.creature || DEFAULT_CREATURE;
let creatureSelect = null;
const tmp = new THREE.Vector3();
const down = new THREE.Vector3(0, -1, 0);
const ray = new THREE.Raycaster();

// ---- Loading the plug-ins ----------------------------------------------------

function progress(p, text) {
  const pct = Math.round(Math.max(0, Math.min(1, p > 1 ? p / 100 : p)) * 100);
  $('.leaf-fill').style.width = `${pct}%`;
  $('.leaf-bar').setAttribute('aria-valuenow', pct);
  if (text) $('#loading-text').textContent = text;
}

async function loadWorld() {
  const forced = q.get('world');
  const opts = (sc) => ({ THREE, renderer, scene: sc, quality: settings.quality, onProgress: progress });
  if (forced !== 'standin' && forced !== 'minimal') {
    try {
      const mod = await import('./town/index.js');
      return await mod.createTown(opts(scene));
    } catch (e) { console.warn('[shell] the town is not available, using the stand-in world:', e?.message || e); }
  }
  if (forced !== 'minimal') {
    try {
      scene = new THREE.Scene();
      const mod = await import('./stand-in-world.js');
      return await mod.createStandInWorld(opts(scene));
    } catch (e) { console.warn('[shell] the stand-in world is not available:', e?.message || e); }
  }
  scene = new THREE.Scene();
  return createMinimalWorld({ THREE, scene });
}

// The registry of creatures (src/creatures/index.js); the squirrel module
// directly if there is none; a capsule if neither loads.
async function loadCreatureModule(kind) {
  try {
    const reg = await import('./creatures/index.js');
    const loader = reg.CREATURES?.[kind];
    if (loader) {
      const mod = await loader();
      return mod;
    }
    console.warn(`[shell] no creature "${kind}" in the registry`);
  } catch (e) { console.warn('[shell] creature registry missing, trying the squirrel module:', e?.message || e); }
  if (kind === DEFAULT_CREATURE) {
    try { return await import('./squirrel/index.js'); } catch (e) { console.warn('[shell] squirrel module missing, using a capsule:', e?.message || e); }
  }
  return null;
}

async function makeCreature(kind) {
  const mod = await loadCreatureModule(kind);
  let c; let makeCam;
  try {
    if (mod) {
      const create = mod.createCreature || mod.createSquirrel;
      c = await create({ THREE, coat: settings.coat, world });
      makeCam = mod.createCamera || mod.createSquirrelCamera;
      c.__makeCam = makeCam;
    }
  } catch (e) { console.warn('[shell] creature failed, using a capsule:', e?.message || e); c = null; }
  if (!c) { c = createCapsuleCreature({ THREE }); c.setCoat(settings.coat); c.__makeCam = createCapsuleCamera; }
  c.kind ||= kind;
  c.scale ||= 0.25;
  return c;
}

function setProjection(c) {
  const s = c.scale;
  camera.near = s >= 0.1 ? 0.05 : Math.max(0.0005, 0.02 * s);
  camera.far = s >= 0.1 ? 2500 : Math.max(60, 6000 * s);
  camera.updateProjectionMatrix();
}

function attachCreature(c) {
  creature = c;
  scene.add(c.object);
  setProjection(c);
  try { c.setCoat?.(settings.coat); } catch { /* fine */ }
  camCtl = c.__makeCam({ THREE, camera, creature: c, squirrel: c, world, zoom: settings.zoom });
  if ('zoom' in camCtl) camCtl.zoom = settings.zoom;
  const on = (e, fn) => { try { c.on?.(e, fn); } catch { /* optional */ } };
  on('jump', () => audio.play('jump'));
  on('land', (e) => {
    const v = typeof e === 'number' ? e : e?.speed ?? e?.impact ?? e?.strength ?? 4;
    const a = Math.min(1, Math.abs(v) / 9);
    audio.play('land', a);
    if (a > 0.45) input.rumble(0.25 + a * 0.5, 140);
  });
  on('climb', () => audio.play('climb'));
  on('dig', () => audio.play('dig'));
  on('splash', () => { audio.play('splash'); input.rumble(0.2, 100); });
}

// ---- Collision probe for placing nuts ---------------------------------------------

function surfaceOfHit(hit) {
  const attr = hit.object?.geometry?.attributes?.surface;
  if (!attr || !hit.face) return 0;
  return attr.getX(hit.face.a);
}
function probe(x, z, fromY) {
  try {
    if (world.raycast) {
      const h = world.raycast(new THREE.Vector3(x, fromY, z), down, 80);
      if (h) return { y: h.point.y, surface: h.surface ?? 0 };
    } else if (world.collider) {
      ray.set(new THREE.Vector3(x, fromY, z), down);
      ray.far = 80;
      const bt = world.collider.geometry?.boundsTree;
      const h = bt?.raycastFirst ? bt.raycastFirst(ray.ray, THREE.DoubleSide) : ray.intersectObject(world.collider, false)[0];
      if (h) return { y: h.point.y, surface: surfaceOfHit({ ...h, object: world.collider }) };
    }
  } catch { /* fall through to the terrain */ }
  const g = world.groundAt?.(x, z);
  return Number.isFinite(g) ? { y: g, surface: 0 } : null;
}

// ---- Screens and actions -------------------------------------------------------------

function applySettings(key) {
  if (!key || key === 'coat') try { creature?.setCoat?.(settings.coat); } catch { /* fine */ }
  if (!key || key === 'volume') audio.setVolume(settings.volume);
  if (!key || key === 'hints') hud.setHintsEnabled(settings.hints);
  if (!key || key === 'quality') {
    resize(true);
    const can = typeof world?.setQuality === 'function';
    if (can && key) world.setQuality(settings.quality);
    $('#quality-note').hidden = can || !key;
  }
  if (key) {
    if (key in settings && !settings.changed.includes(key)) settings.changed.push(key);
    writeSettings(settings);
  }
}

function syncSoundButton() {
  for (const b of document.querySelectorAll('.sound-btn')) {
    const on = settings.sound;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    b.title = on ? 'Sound on' : 'Sound off';
    b.classList.toggle('is-off', !on);
    const l = b.querySelector('.btn-label'); if (l) l.textContent = on ? 'Sound on' : 'Sound off';
  }
}
function toggleSound() {
  settings.sound = !settings.sound;
  if (!settings.changed.includes('sound')) settings.changed.push('sound');
  audio.setEnabled(settings.sound);
  writeSettings(settings);
  syncSoundButton();
  if (settings.sound) audio.play('click');
}

function toggleFullscreen() { if (fullscreenElement()) exitFullscreen(); else requestFullscreen(); }

const focusPos = () => creature?.position ?? world.spawn;

// Fade out, run `work`, wait for the world to be ready around the creature, fade in.
// The loop keeps running meanwhile, so input, audio and world streaming stay alive.
async function transition(work, label = 'Finding the way…') {
  if (state.transitioning) return;
  state.transitioning = true;
  const fade = $('#fade');
  $('#fade-text').textContent = label;
  fade.classList.add('on');
  await sleep(reduceMotion ? 20 : 300);
  try {
    await work();
    world.setScale?.(creature.scale);
    world.update?.(0, camera, focusPos());
    await Promise.race([Promise.resolve(world.ready?.(focusPos())), sleep(20000)]);
    camCtl.update?.(0.016, zeroControls());
  } catch (e) { console.error(e); }
  fade.classList.remove('on');
  await sleep(reduceMotion ? 20 : 300);
  state.transitioning = false;
}

// ---- creature select: switch with the transition (fade, setScale, ready, fade in), keeping the
// place: the nearest safe ground, the water for a swimmer, the nearest wadeable spot for a wader
function pickCreature(kind) {
  if (!kind || state.transitioning) return;
  audio.play('click');
  settings.creature = kind;
  if (!settings.changed.includes('creature')) settings.changed.push('creature');
  writeSettings(settings);
  creatureSelect?.setCurrent(kind);
  if (kind === creature?.kind) { menus.closeModal(); return; }
  const playing = menus.ui.screen === 'play';
  if (playing) menus.closeAll(true);
  else menus.closeModal();
  switchCreature(kind).then(() => { if (playing && state.paused) resume(); });
}

function switchCreature(kind) {
  return transition(async () => {
    const p = creature.position.clone(), yaw = state.heading;
    scene.remove(creature.object);
    try { creature.dispose?.(); } catch { /* fine */ }
    const c = await makeCreature(kind);
    creatureKind = kind;
    attachCreature(c);
    resetCreature(safeSpot(c, p.x, p.z, yaw));
  }, 'Changing shape…');
}

function safeSpot(c, x, z, yaw) {
  const T = c.tuning || {};
  const deep = (px, pz) => {
    const wl = world.waterAt?.(px, pz);
    if (wl == null) return false;
    if (T.canSwim !== false) return false;               // a swimmer is fine in the water
    const g = probe(px, pz, wl + 1);
    return !g || wl - g.y > (T.wadeDepth || 0);
  };
  if (deep(x, z)) {
    for (const r of [2, 4, 8, 16, 32, 64]) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      if (!deep(px, pz)) return { x: px, z: pz, y: undefined, yaw };
    }
  }
  return { x, z, y: undefined, yaw };
}

function resetCreature(sp = world.spawn) {
  const y = sp.y ?? probe(sp.x, sp.z, (world.groundAt?.(sp.x, sp.z) ?? 0) + 2)?.y ?? world.groundAt?.(sp.x, sp.z) ?? 0;
  creature.reset({ x: sp.x, y, z: sp.z, yaw: sp.yaw || 0 });
  state.heading = (sp.yaw || 0);
}

function teleport(x, z, yaw = 0) {
  return transition(() => resetCreature({ x, z, y: world.groundAt?.(x, z), yaw }), 'Hopping over…');
}

function start() {
  if (menus.ui.screen !== 'title' || state.transitioning) return;
  audio.unlock();
  audio.setEnabled(settings.sound);
  requestFullscreen();
  menus.setScreen('play');
  input.lockHeld();
  document.activeElement?.blur?.();
  state.paused = false;
  hud.startPlay();
  hud.setKind(input.kind);
  touchUi.show(input.kind === 'touch' || matchMedia('(pointer: coarse)').matches);
  $('#hud').classList.toggle('touch', input.kind === 'touch' || matchMedia('(pointer: coarse)').matches);
  audio.ambience(true);
  transition(() => resetCreature(), 'Into the leaves…');
}

function pause(reason = '') {
  if (menus.ui.screen !== 'play' || state.paused) return;
  state.paused = true;
  state.pauseReason = reason;
  state.expectUnlock = true;
  input.unlockPointer();
  menus.openModal('pause');
}
function resume() {
  state.paused = false;
  state.pauseReason = '';
  input.lockHeld();
  document.activeElement?.blur?.();
}
function openMap() {
  if (menus.ui.screen !== 'play' || menus.ui.modals.includes('map') || state.transitioning) return;
  if (!state.paused) { state.paused = true; state.expectUnlock = true; input.unlockPointer(); }
  menus.openModal('map');
}
function quitToTitle() {
  menus.closeAll(true);
  state.paused = false;
  input.unlockPointer();
  hud.hideDiscovery();
  audio.ambience(false);
  menus.setScreen('title');
  input.lockHeld();
}

function confirmDialog({ title, text, yes, onYes }) {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-yes').textContent = yes;
  confirmDialog.onYes = onYes;
  menus.openModal('confirm');
}
const hasProgress = () => exploration && (exploration.landmarksFound > 0 || exploration.nutsFound > 0 || exploration.buriedCount > 0);

function pauseStats() {
  $('#pause-reason').textContent = state.pauseReason;
  $('#pause-stats').textContent = exploration ? `Landmarks ${exploration.landmarksFound} / ${exploration.landmarkTotal} · Nuts ${exploration.nutsFound} / ${exploration.nutTotal}` : '';
}

function wire() {
  document.addEventListener('click', (e) => {
    if (e.target.matches?.('.modal') && e.target.id === menus.ui.modals.at(-1) && e.target.id !== 'map') return menus.closeModal();
    const el = e.target.closest('[data-action], [data-open]');
    if (!el) return;
    audio.unlock();
    if (el.dataset.open) return menus.openModal(el.dataset.open);
    switch (el.dataset.action) {
      case 'start': return start();
      case 'fullscreen': return toggleFullscreen();
      case 'sound': return toggleSound();
      case 'pause': return pause();
      case 'resume': menus.closeAll(); return audio.play('click');
      case 'close': return menus.closeModal();
      case 'map': return menus.ui.modals.length ? menus.openModal('map') : openMap();
      case 'quit-title':
        if (hasProgress()) return confirmDialog({ title: 'Quit to title?', text: 'Your landmarks and nuts are saved. Carry on from the title screen any time.', yes: 'Quit', onYes: quitToTitle });
        return quitToTitle();
      case 'reset-progress':
        return confirmDialog({ title: 'Reset progress?', text: 'This forgets every landmark you found and every nut you gathered or buried. It cannot be undone.', yes: 'Reset', onYes: () => { exploration.reset(); nutDirty(); hud.toast('Progress reset'); } });
      case 'pick-creature': return pickCreature(el.dataset.creature);
      case 'confirm-no': return menus.closeModal();
      case 'confirm-yes': { const f = confirmDialog.onYes; menus.closeModal(); f?.(); return undefined; }
      default: return undefined;
    }
  });
  addEventListener('keydown', (e) => {
    if (menus.ui.screen === 'title' && !menus.ui.modals.length && (e.code === 'Enter' || e.code === 'Space')) {
      const a = document.activeElement;
      if (!a || a === document.body || a.id === 'press-start') { e.preventDefault(); start(); }
    }
  });
  const canvas = $('#gl');
  const app = $('#app');
  app.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (e.pointerType === 'mouse' && menus.ui.screen === 'play' && !state.paused && !menus.ui.modals.length && !state.transitioning && e.target === canvas) input.lockPointer(canvas);
    if (e.pointerType === 'mouse') revealPause();
  });
  app.addEventListener('mousemove', revealPause);
  input.on('lock', (locked) => {
    if (!locked && menus.ui.screen === 'play' && !state.paused && !state.expectUnlock) pause('The mouse was released.');
    state.expectUnlock = false;
  });
  input.on('kind', (k) => {
    hud.setKind(k);
    menus.refreshFocus();
    if (k === 'controller') input.unlockPointer();
    const touch = k === 'touch';
    $('#hud').classList.toggle('touch', touch);
    touchUi.show(touch);
  });
  input.on('padlost', (_i, wasActive) => {
    if (wasActive && !input.hasPad() && menus.ui.screen === 'play') pause('The controller was disconnected. Reconnect it to carry on, or use the keyboard.');
    menus.updateNotes();
  });
  input.on('padfound', () => {
    menus.updateNotes();
    if (state.paused && state.pauseReason.includes('disconnected')) { state.pauseReason = 'Controller connected. Choose Resume to carry on.'; pauseStats(); }
  });
  addEventListener('gamepadconnected', () => input.poll());
  addEventListener('gamepaddisconnected', () => input.poll());
  const syncAudio = () => audio.setActive(!document.hidden && document.hasFocus());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause('Paused while the page was hidden.'); syncAudio(); });
  addEventListener('blur', () => { pause('Paused while the window was in the background.'); audio.setActive(false); });
  addEventListener('focus', syncAudio);
  addEventListener('pageshow', syncAudio);
  document.addEventListener('fullscreenchange', () => { resize(true); });
}

let revealTimer = 0;
function revealPause() {
  const h = $('#hud'); h.classList.add('reveal');
  clearTimeout(revealTimer); revealTimer = setTimeout(() => h.classList.remove('reveal'), 1800);
}

// ---- Rendering ----------------------------------------------------------------------------

function resize(force = false) {
  const app = $('#app');
  const w = app.clientWidth; const h = app.clientHeight;
  const cap = { low: 1, medium: 1.5, high: 2 }[settings.quality] || 1.5;
  const dpr = Math.min(devicePixelRatio || 1, cap);
  const key = `${w}x${h}@${dpr}`;
  if (!force && key === state.size) return;
  state.size = key;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function createRenderer() {
  const canvas = $('#gl');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

let nutsDirty = true;
const nutDirty = () => { nutsDirty = true; };

function updateCounts() {
  hud.setCounts({ nuts: exploration.nutsFound, nutTotal: exploration.nutTotal, carried: exploration.carried, lm: exploration.landmarksFound, lmTotal: exploration.landmarkTotal });
}

// The hint line for what the creature can do right now.
function contextHint() {
  const k = input.kind === 'controller' ? { a: 'A', x: 'X', y: 'Y' } : { a: 'Space', x: 'E', y: 'F' };
  const st = creature.state;
  if (st === 'climb') return `Left stick: climb · ${k.a}: leap off`;
  if (st === 'air' || st === 'swim') return '';
  const grab = creature.canGrab ?? creature.nearClimbable ?? creature.nearWall;
  const g = typeof grab === 'function' ? grab.call(creature) : grab;
  if (g) return `${k.a}: grab on`;
  if (exploration.buried().some((b) => Math.hypot(b.x - creature.position.x, b.z - creature.position.z) < 1.3)) return `${k.y}: dig up the nut`;
  if (exploration.carried && st === 'idle') return `${k.y}: bury a nut · ${k.x}: eat it`;
  if (state.idle > 10) return `${k.x}: sit up and look around`;
  return '';
}

// Nuts are a squirrel thing; landmarks are found by every creature.
const nutsHere = () => creature.kind === 'squirrel' || creature.kind === 'capsule';

function playFrame(dt) {
  const controls = input.controls(dt);
  if (!state.transitioning) {
    creature.update(dt, controls, world, camera);
    camCtl.update(dt, controls);
    // the follow camera's zoom is a setting: keep it, written once the player stops zooming
    if (Number.isFinite(camCtl.zoom) && Math.abs(camCtl.zoom - settings.zoom) > 1e-4) {
      settings.zoom = camCtl.zoom; state.zoomSave = 0.6;
      if (!settings.changed.includes('zoom')) settings.changed.push('zoom');
    } else if (state.zoomSave > 0 && (state.zoomSave -= dt) <= 0) writeSettings(settings);
    state.acc += dt;
    let n = 0;
    while (state.acc >= STEP && n++ < 4) {
      state.acc -= STEP;
      exploration.update(creature.position, nutsHere());
    }
    if (controls.digPressed && nutsHere()) {
      const r = exploration.dig(creature.position);
      if (r.action === 'bury') { audio.play('bury'); hud.toast('Nut buried. Dig here again to find it.'); }
      else if (r.action === 'dig') { audio.play('dig'); hud.toast('You dug up a nut'); }
      else hud.toast('Nothing to bury. Find a nut first.');
      nutDirty();
    }
    if (controls.sitPressed && exploration.eat()) { audio.play('eat'); hud.toast('Crunch'); }
    // Footsteps and claws.
    const v = creature.velocity;
    const sp = Math.hypot(v.x, v.z);
    const sc = creature.scale / 0.25;
    if (creature.state === 'move') {
      state.stride += sp * dt;
      if (state.stride > 0.5 * sc) { state.stride = 0; audio.play('step', Math.min(1, sp / 5)); }
    } else if (creature.state === 'climb') {
      state.climbTick -= dt;
      if (Math.hypot(v.x, v.y, v.z) > 0.1 && state.climbTick <= 0) { state.climbTick = 0.17; audio.play('climb'); }
    }
    state.idle = creature.state === 'idle' && !controls.digPressed ? state.idle + dt : 0;
    if (sp > 0.4) state.heading = Math.atan2(v.x, -v.z);
  }
  hud.setContext(settings.hints ? contextHint() : '');
}

function titleFrame(dt) {
  const sp = world.spawn;
  const t = state.time * (reduceMotion ? 0.02 : 0.07);
  const r = Math.max(4, creature.scale * 112);
  const cx = sp.x; const cz = sp.z; const cy = (sp.y ?? 0);
  camera.position.set(cx + Math.sin(t + 0.6) * r, cy + r * 0.42, cz + Math.cos(t + 0.6) * r);
  tmp.set(cx, cy + r * 0.22, cz - r * 0.45);
  camera.lookAt(tmp);
  void dt;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0005, (now - (state.lastFrame || now)) / 1000));
  state.lastFrame = now;
  state.time += dt;
  resize();
  input.poll();
  const nav = input.nav();
  const screen = menus.ui.screen;
  const modals = menus.ui.modals.length;
  if (screen === 'play' && !modals && !state.paused) {
    if (nav.pause) pause();
    else if (input.mapPressed()) openMap();
    else playFrame(dt);
  } else if (screen === 'title' || modals) {
    menus.handle(nav, now);
  }
  if (screen === 'title') titleFrame(dt);
  const f = focusPos();
  world.update?.(dt, camera, f);
  if (nutView && exploration) {
    if (nutsDirty) { nutsDirty = false; updateCounts(); }
    nutView.update(state.time, exploration.lying(), exploration.buried(), f, reduceMotion);
  }
  if (screen === 'play') {
    camera.getWorldDirection(tmp);
    hud.update(dt, ((Math.atan2(tmp.x, -tmp.z) * 180) / Math.PI + 360) % 360);
  }
  renderer.render(scene, camera);
  input.endFrame();
}

// ---- Boot -----------------------------------------------------------------------------------

async function loadTownData() {
  try {
    const res = await fetch('data/town.json');
    if (res.ok) return await res.json();
  } catch { /* no data yet */ }
  return null;
}

// The URL of a delivered image, or null while its stand-in is still in use.
// assets/manifest.json lists the delivered originals (`files`) and the small
// web copy the game loads for each (`web`, written by tools/build_web.py).
let manifestPromise = null;
async function deliveredUrl(path) {
  manifestPromise ??= fetch('assets/manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const m = await manifestPromise;
  if (!m) return null;
  const files = Array.isArray(m) ? m : m.files || [];
  if (!files.includes(path)) return null;
  return m.web?.[path] || `assets/${path}`;
}

async function boot() {
  input = createInput({ settings });
  audio = createAudio();
  audio.setVolume(settings.volume);
  audio.setEnabled(settings.sound);
  hud = createHud({ reduceMotion });
  hud.setHintsEnabled(settings.hints);
  chrome = createChrome({ app: $('#app'), isPlaying: () => menus?.ui.screen === 'play' && !menus.ui.modals.length, hintEl: $('#bars-hint') });
  void chrome;
  syncSoundButton();
  menus = createMenus({
    input, audio,
    hooks: {
      start,
      beforeOpen(id) { if (id === 'pause') pauseStats(); },
      afterOpen(id) { if (id === 'map') { document.activeElement?.blur?.(); map?.show(); } },
      afterClose(id) { if (id === 'map') map?.hide(); },
      onEmpty() { if (menus.ui.screen === 'play' && state.paused) resume(); },
      mapFrame(nav, dt) { map?.frame(nav, dt); },
    },
  });
  menus.setScreen('loading');
  bindSettings(settings, { onChange: applySettings });
  document.getElementById('sound-btn').addEventListener('click', () => {});
  try {
    renderer = createRenderer();
  } catch (e) {
    console.error(e);
    $('#loading-text').textContent = 'This browser cannot show the town: it needs WebGL.';
    return;
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.05, 2500);
  camera.position.set(0, 10, 20);
  state.size = '';
  resize(true);
  wire();
  touchUi = createTouch(input, { onMap: () => openMap() });

  progress(0.02, 'Raking the leaves…');
  const [dataP, w] = [loadTownData(), await loadWorld()];
  world = w;
  townData = await dataP;
  progress(0.9, 'Waking the squirrel…');
  creature = await makeCreature(creatureKind);
  attachCreature(creature);
  resetCreature();
  creature.update?.(0.016, zeroControls(), world, camera);
  world.setScale?.(creature.scale);
  world.update?.(0.016, camera, focusPos());
  try { await Promise.race([Promise.resolve(world.ready?.(focusPos())), sleep(20000)]); } catch { /* streams in as it goes */ }

  // Exploration: landmarks from the world (or the data), nuts placed on the trees.
  const landmarks = world.landmarks?.length ? world.landmarks : townData?.landmarks || [];
  const nuts = placeNuts({ trees: world.trees || [], buildings: townData?.buildings || [], probe, assumeRoofs: true });
  exploration = createExploration({ landmarks, nuts });
  exploration.on('discover', ({ landmark }) => { hud.showDiscovery(landmark); audio.play('chime'); input.rumble(0.3, 220); nutDirty(); });
  exploration.on('nut', () => { audio.play('nut'); input.rumble(0.35, 110); nutDirty(); });
  exploration.on('reset', () => nutDirty());
  nutView = createNutView({ THREE, scene: world.scene || scene });
  creatureSelect = createCreatureSelect({ info: CREATURE_INFO, portraitUrl: await deliveredUrl('ui/creatures.png') });
  creatureSelect.setCurrent(creatureKind);
  const parchment = await deliveredUrl('ui/map_parchment.png');
  map = createMap({
    input, exploration, parchmentUrl: parchment,
    getPlayer: () => ({ x: creature.position.x, z: creature.position.z, heading: state.heading }),
  });
  map.setTown(townData);
  // the town's credits (OpenStreetMap, Ontario open data, and the Mapillary street-level reference)
  const credit = world?.attribution || townData?.attribution || '';
  $('#credits-attr').textContent = credit; if (credit) $('#map-attr').textContent = credit;
  const logoUrl = await deliveredUrl('ui/logo.png');
  if (logoUrl) {
    const img = $('#logo-img'); img.src = logoUrl; img.alt = 'Stratford Squirrel';
    img.onload = () => { img.hidden = false; $('#logo-art').hidden = true; };
  }
  applySettings();
  updateCounts();
  progress(1, 'Ready');
  menus.setScreen('title');
  input.lockHeld();
  window.stratford = {
    state, settings, input, audio, hud, map, menus, ui: menus.ui,
    get world() { return world; }, get creature() { return creature; }, get exploration() { return exploration; },
    get camera() { return camera; }, get camCtl() { return camCtl; }, start, pause, teleport, openMap,
  };
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  const t = $('#loading-text'); if (t) t.textContent = 'Something went wrong loading the game. Please reload the page.';
});
