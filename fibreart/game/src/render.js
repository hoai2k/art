// WebGL2 drawing of the collage: the ground's panels, the pieces as bendable
// meshes, one shared field (swirls, tide, ripple) that moves them all like one
// cloth, mask dissolves for morphs, scene changes, pours and unravelling, the
// small life of every piece (life.js), and leaves blown across on a gust.

import { W, H } from './collage.js';
import { life, groundRipple } from './life.js';

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aUV;
uniform vec2 uCenter;
uniform vec2 uSize;
uniform float uRot;
uniform float uFlip;
uniform float uBloom;
uniform float uSeed;
uniform float uTime;
uniform float uSway;  // wind: sideways bend at the top, anchored at the base
uniform vec3 uWave;   // amplitude, cycles along the piece, speed
uniform vec4 uSwirl[4];
uniform int uSwirls;
uniform float uTide;
uniform float uRipple;
uniform vec4 uView; // world -> clip: scale xy, offset xy
out vec2 vUV;
out vec2 vWorld;
void main() {
  vUV = aUV;
  vec2 p = (aUV - 0.5) * uSize;
  // Cloth wobble: stronger toward the edges, so a blooming piece ruffles.
  float edge = length(aUV - 0.5) * 2.0;
  p += uBloom * 0.05 * uSize * edge * vec2(sin(aUV.y * 9.0 + uTime * 2.3 + uSeed), cos(aUV.x * 8.0 + uTime * 1.9 + uSeed));
  float up = 1.0 - aUV.y;
  p.x += uSway * up * up;
  p.y += uWave.x * sin(aUV.x * uWave.y * 6.2832 - uTime * uWave.z + uSeed) * (0.35 + 0.65 * abs(aUV.x - 0.5) * 2.0);
  p.x *= uFlip;
  float c = cos(uRot), s = sin(uRot);
  vec2 w = uCenter + vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  for (int i = 0; i < 4; i++) {
    if (i >= uSwirls) break;
    vec4 sw = uSwirl[i];
    vec2 d = w - sw.xy;
    float f = max(0.0, 1.0 - length(d) / sw.z);
    float a = sw.w * f * f;
    float ca = cos(a), sa = sin(a);
    w = sw.xy + vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  }
  w.x += uTide * (0.6 + 0.4 * sin(w.y * 0.7 + uTime * 0.8));
  w.y += uRipple * 0.18 * sin(w.x * 1.3 + uTime * 2.2);
  vWorld = w;
  gl_Position = vec4(w * uView.xy + uView.zw, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vWorld;
uniform sampler2D uTex;
uniform sampler2D uFrom;   // the image a morph is leaving
uniform sampler2D uMask;   // dissolve map for this draw
uniform sampler2D uPourMask;
uniform sampler2D uBack;   // fabric on the back of a turned panel
uniform vec4 uUVRect;      // sub-rectangle of uTex (panels)
uniform float uMorph;      // 1: fully uTex; below: growing out of uFrom
uniform float uHasFrom;
uniform float uAlpha;
uniform float uBackMix;
uniform float uDissolve;   // scene change: 0 shows all, 1 gone
uniform vec2 uDissolveAt;
uniform vec3 uEdge;        // thread colour at dissolving edges
uniform float uPour;
uniform vec2 uPourAt;
uniform vec3 uPourColour;
uniform float uUnravel;
uniform vec2 uUnravelAt;
uniform float uTint;       // how much to pull toward uPourColour for a held piece
out vec4 outColour;
void main() {
  vec2 uv = uUVRect.xy + vUV * uUVRect.zw;
  vec4 col = texture(uTex, uv);
  if (uHasFrom > 0.5 && uMorph < 1.0) {
    vec4 from = texture(uFrom, vUV);
    float m = texture(uMask, vUV * 0.9 + 0.05).r;
    float t = uMorph * 1.2 - 0.1;
    float k = smoothstep(t - 0.06, t + 0.06, m);
    col = mix(col, from, k);
    float band = 1.0 - smoothstep(0.0, 0.05, abs(m - t));
    col.rgb = mix(col.rgb, uEdge * col.a, band * 0.8 * col.a);
  }
  if (uBackMix > 0.5) {
    vec4 back = texture(uBack, vUV * vec2(2.0, 1.4));
    col = vec4(back.rgb, 1.0);
  }
  vec2 wuv = vWorld / vec2(${W.toFixed(1)}, ${H.toFixed(1)});
  if (uPour > 0.001) {
    float m = texture(uPourMask, wuv * vec2(1.6, 0.9)).r;
    float d = length(vWorld - uPourAt) / 14.0;
    float reach = uPour * 1.5 - d;
    float k = smoothstep(m - 0.08, m + 0.08, reach);
    col.rgb = mix(col.rgb, uPourColour * col.a, k * 0.72);
  }
  if (uUnravel > 0.001) {
    float m = texture(uMask, wuv * vec2(1.0, 1.0)).r;
    float d = length(vWorld - uUnravelAt) / 14.0;
    float t = uUnravel * 1.4 - d;
    float k = smoothstep(m - 0.04, m + 0.04, t);
    float band = 1.0 - smoothstep(0.0, 0.05, abs(m - t));
    col.rgb = mix(col.rgb, uEdge * col.a, band * col.a);
    col *= 1.0 - k * 0.85;
  }
  if (uDissolve > 0.001) {
    float m = texture(uMask, wuv).r;
    float d = length(vWorld - uDissolveAt) / 16.0;
    float t = uDissolve * 1.35 - d * 0.35;
    float k = smoothstep(m - 0.03, m + 0.03, t);
    float band = 1.0 - smoothstep(0.0, 0.035, abs(m - t));
    col.rgb = mix(col.rgb, uEdge * col.a, band * 0.9 * col.a);
    col *= 1.0 - k;
  }
  col.rgb = mix(col.rgb, uPourColour * col.a, uTint);
  outColour = col * uAlpha;
}`;

const BACK_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec3 uWash;
uniform vec2 uRepeat;
out vec4 outColour;
void main() {
  vec3 t = texture(uTex, vUV * uRepeat).rgb;
  float v = 1.0 - 0.55 * length(vUV - 0.5);
  outColour = vec4(mix(uWash, t * uWash * 2.2, 0.35) * v, 1.0);
}`;

const BACK_VS = `#version 300 es
layout(location = 0) in vec2 aUV;
out vec2 vUV;
void main() { vUV = aUV; gl_Position = vec4(aUV * 2.0 - 1.0, 0.0, 1.0); }`;

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

// Which fabric shows behind each scene and on the backs of its panels.
const BACKING = {
  viriditas: 'green-silk', 'night-quilt': 'indigo-batik', 'golden-lady': 'gold-damask', 'black-tree': 'rust-paisley',
  'two-moons': 'turquoise-satin', dancers: 'black-lace', 'man-and-woman': 'rust-paisley', 'blue-lady': 'ultramarine-canvas',
  crowd: 'brown-netting', 'silk-bird': 'turquoise-satin',
};
// Back to front: sky things behind, everything else in the scene's own order.
const DEPTH = { band: -3, cloud: -2, sun: -1 };
const MASK_FOR = ['torn-paper', 'watercolour-bloom', 'seams', 'unravel', 'swirl', 'stitch-line'];

export function createRenderer(canvas, base = 'web/') {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL2 is not available');
  const prog = compile(gl, VS, FS);
  const back = compile(gl, BACK_VS, BACK_FS);
  const N = 24;
  const verts = [];
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) verts.push(x / N, y / N);
  const idx = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const a = y * (N + 1) + x;
      idx.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1);
    }
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const count = idx.length;

  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const textures = new Map();
  const blank = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, blank);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

  function upload(img, repeat) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  // How many images have been asked for and how many have arrived (the loading bar).
  const progress = { asked: 0, done: 0 };
  function load(file, repeat = false) {
    if (textures.has(file)) return textures.get(file).ready;
    const entry = { tex: null, ready: null };
    progress.asked++;
    entry.ready = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        entry.tex = upload(img, repeat);
        progress.done++;
        resolve(entry);
      };
      img.onerror = () => {
        console.warn('missing image', file);
        progress.done++;
        resolve(entry);
      };
      img.src = base + file;
    });
    textures.set(file, entry);
    return entry.ready;
  }
  const tex = (file) => textures.get(file)?.tex || blank;

  const shared = Promise.all([
    ...MASK_FOR.map((m) => load(`masks/${m}.webp`, true)),
    ...Object.values(BACKING).map((t) => load(`textures/${t}.webp`, true)),
  ]);

  function loadScene(scene, chains, drift = []) {
    const files = [scene.ground, scene.composition, ...scene.pieces.map((p) => p.file), ...drift.map((d) => d.file)];
    for (const p of scene.pieces) files.push(...(p.blink ? [p.blink] : []), ...(p.poses || []));
    for (const p of scene.pieces) if (p.chain && chains[p.chain]) for (const s of chains[p.chain]) files.push(s.file);
    return Promise.all([shared, ...files.map((f) => load(f))]);
  }

  let view = [1, 1, 0, 0];
  let frame = { x: 0, y: 0, w: 1, h: 1 };
  // The point of the picture at the middle of the screen. Only matters when the
  // picture is larger than the screen (a phone held upright): then the view
  // pans across it, clamped to its edges.
  const centre = { x: W / 2, y: H / 2 };
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    // Fit the 16:9 picture inside the screen with a small margin of backing cloth.
    // On a tall, narrow screen that would leave a thin strip, so the picture
    // keeps at least half the screen's height and the view pans across it.
    const margin = 0.965;
    const s = Math.max(Math.min(cw / W, ch / H) * margin, Math.min((ch * 0.5) / H, cw / W * 2.2));
    const pw = W * s;
    const ph = H * s;
    const hw = cw / 2 / s;
    const hh = ch / 2 / s;
    centre.x = pw <= cw ? W / 2 : Math.max(hw, Math.min(W - hw, centre.x));
    centre.y = ph <= ch ? H / 2 : Math.max(hh, Math.min(H - hh, centre.y));
    const x0 = cw / 2 - centre.x * s;
    const y0 = ch / 2 - centre.y * s;
    frame = { x: x0 / dpr, y: y0 / dpr, w: pw / dpr, h: ph / dpr, scale: s / dpr, pans: pw > cw || ph > ch };
    view = [(2 * s) / cw, (-2 * s) / ch, (2 * x0) / cw - 1, 1 - (2 * y0) / ch];
    gl.viewport(0, 0, cw, ch);
  }

  function setCommon(field, time) {
    const u = prog.u;
    gl.uniform4fv(u.uView, view);
    gl.uniform1f(u.uTime, time);
    const sw = new Float32Array(16);
    const list = field ? field.swirls.slice(0, 4) : [];
    list.forEach((s, i) => sw.set([s.x, s.y, s.r, s.a], i * 4));
    gl.uniform4fv(u.uSwirl, sw);
    gl.uniform1i(u.uSwirls, list.length);
    gl.uniform1f(u.uTide, field ? field.tide : 0);
    gl.uniform1f(u.uRipple, field ? field.ripple + (field.lifeRipple || 0) : 0);
  }

  function bind(unit, t, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(loc, unit);
  }

  function drawQuad(o) {
    const u = prog.u;
    gl.uniform2f(u.uCenter, o.x, o.y);
    gl.uniform2f(u.uSize, o.w, o.h);
    gl.uniform1f(u.uRot, o.rot || 0);
    gl.uniform1f(u.uFlip, o.flip ?? 1);
    gl.uniform1f(u.uBloom, o.bloom || 0);
    gl.uniform1f(u.uSeed, o.seed || 0);
    gl.uniform4fv(u.uUVRect, o.uv || [0, 0, 1, 1]);
    gl.uniform1f(u.uAlpha, o.alpha ?? 1);
    gl.uniform1f(u.uMorph, o.morph ?? 1);
    gl.uniform1f(u.uHasFrom, o.from ? 1 : 0);
    gl.uniform1f(u.uBackMix, o.backMix || 0);
    gl.uniform1f(u.uTint, o.tint || 0);
    gl.uniform1f(u.uSway, o.sway || 0);
    gl.uniform3fv(u.uWave, o.wave || [0, 1, 1]);
    bind(0, o.tex, u.uTex);
    bind(1, o.from || blank, u.uFrom);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
  }

  function stageFile(chains, p, stage) {
    if (stage < 0) return p.file;
    return chains[p.chain]?.[stage]?.file || p.file;
  }

  function drawScene(game, sceneData, pieces, panels, field, opts) {
    const u = prog.u;
    const time = game.time;
    const scene = sceneData;
    const backing = `textures/${BACKING[scene.key] || 'indigo-batik'}.webp`;
    const edge = hex(scene.thread);
    gl.uniform3fv(u.uEdge, edge);
    gl.uniform3fv(u.uPourColour, hex(opts.pourColour || scene.wash));
    gl.uniform1f(u.uPour, opts.pour || 0);
    gl.uniform2f(u.uPourAt, field.pourX, field.pourY);
    gl.uniform1f(u.uUnravel, opts.unravel || 0);
    gl.uniform2f(u.uUnravelAt, field.unravelX, field.unravelY);
    gl.uniform1f(u.uDissolve, opts.dissolve || 0);
    gl.uniform2f(u.uDissolveAt, opts.dissolveX ?? W / 2, opts.dissolveY ?? H / 2);
    bind(2, tex(`masks/${MASK_FOR[opts.mask ?? 0]}.webp`), u.uMask);
    bind(3, tex('masks/watercolour-bloom.webp'), u.uPourMask);
    bind(4, tex(backing), u.uBack);
    setCommon(field, time);
    // Ground panels: a 3 x 2 patchwork, each a little larger than its cell so
    // there are no gaps when one slides.
    const groundTex = tex(scene.ground);
    for (const pn of panels) {
      const cw = W / 3;
      const ch = H / 2;
      const ox = 0.02;
      drawQuad({
        x: cw * (pn.c + 0.5) + pn.x, y: ch * (pn.r + 0.5) + pn.y, w: cw * (1 + ox), h: ch * (1 + ox), rot: pn.rot,
        flip: pn.flip, backMix: pn.flip < 0 ? 1 : 0, tex: groundTex,
        uv: [(pn.c - ox / 2) / 3, (pn.r - ox / 2) / 2, (1 + ox) / 3, (1 + ox) / 2], seed: pn.i,
      });
    }
    const motion = game.reduceMotion ? 0.3 : 1;
    for (const p of [...pieces].sort((a, b) => (DEPTH[a.kind] || 0) - (DEPTH[b.kind] || 0))) {
      const L = opts.still ? null : life(game, p, motion);
      let file = stageFile(game.chains, p, p.stage);
      if (L && L.swap >= 0 && p.stage < 0) file = p.blink || p.poses?.[L.swap] || file;
      const t = tex(file);
      const from = p.morph < 1 ? tex(p.fromFile || stageFile(game.chains, p, p.fromStage)) : null;
      const sw = p.stage >= 0 ? Math.max(p.w, p.h) : p.w;
      const stage = p.stage >= 0 ? game.chains[p.chain]?.[p.stage] : null;
      const w = stage ? sw * 0.9 : p.w;
      const h = stage ? w * stage.aspect : p.h;
      drawQuad({
        x: p.x + (L?.dx || 0), y: p.y + (L?.dy || 0), w: w * p.sx * (L?.sx ?? 1) * (1 + p.bloom * 0.35), h: h * p.sy * (L?.sy ?? 1) * (1 + p.bloom * 0.35),
        rot: p.rot + (L?.drot || 0), flip: p.flip, bloom: p.bloom, seed: p.i * 1.7, alpha: p.alpha, tex: t, from, morph: p.morph, tint: 0,
        sway: L?.sway || 0, wave: L?.wave,
      });
    }
    // Loose leaves on the wind.
    if (opts.drift && opts.drift.length && game.driftFiles?.length) {
      for (const d of opts.drift) {
        const f = game.driftFiles[d.tex % game.driftFiles.length];
        const fade = Math.min(1, d.age * 2, (14 - d.age) / 2);
        drawQuad({ x: d.x, y: d.y, w: d.size, h: d.size * (f.aspect || 1), rot: d.rot, flip: d.flip, tex: tex(f.file), alpha: fade, seed: d.seed });
      }
    }
  }

  function render(game) {
    resize();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // Backing cloth around the picture.
    gl.useProgram(back.p);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex(`textures/${BACKING[game.scene.key] || 'indigo-batik'}.webp`));
    gl.uniform1i(back.u.uTex, 0);
    gl.uniform3fv(back.u.uWash, hex(game.scene.wash));
    gl.uniform2f(back.u.uRepeat, canvas.width / 512, canvas.height / 512);
    // A full-screen quad: reuse the grid with an identity mapping in BACK_VS.
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);

    gl.useProgram(prog.p);
    const f = game.field;
    const tr = game.transition;
    const nextPour = game.scenes[(game.index + 1) % game.scenes.length].wash;
    f.lifeRipple = groundRipple(game, game.reduceMotion ? 0.3 : 1);
    drawScene(game, game.scene, game.pieces, game.panels, f, { pour: f.pour, unravel: f.unravel, pourColour: nextPour, mask: 3, drift: game.drift });
    if (tr) {
      const ease = tr.t * tr.t * (3 - 2 * tr.t);
      drawScene(game, tr.from.scene, tr.from.pieces.filter((p) => !game.travellers.some((t) => t.from === p)), tr.from.panels, tr.from.field, {
        dissolve: ease, dissolveX: tr.x, dissolveY: tr.y, mask: tr.mask, still: true,
      });
    }
  }

  return { gl, load, loadScene, render, resize, centre, progress, get frame() { return frame; }, BACKING };
}
