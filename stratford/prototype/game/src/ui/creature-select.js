// The creature select: a card per creature (portrait, name, one line) in the #creatures panel,
// opened from Settings and the pause menu. Cards carry data-action="pick-creature" and
// data-creature; main.js switches creature (fade, setScale, ready, fade in) and saves the choice.
// Portraits: the delivered ui/creatures.png (R9.10: five medallions in a row on transparency, in
// CREATURE_INFO order), each cropped to its own alpha bounds (the medallions nearly touch, so the
// strip is cut at the column of least alpha near each fifth first); a painted stand-in drawn here
// until the strip loads, or if it can't.

const $ = (s, r = document) => r.querySelector(s);

export function createCreatureSelect({ info, portraitUrl = null }) {
  const grid = $('#creature-grid');
  const cards = new Map();
  for (const [i, c] of info.entries()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'creature-card';
    b.dataset.nav = '';
    b.dataset.action = 'pick-creature';
    b.dataset.creature = c.kind;
    b.setAttribute('aria-pressed', 'false');
    const pic = paintedPortrait(c.kind);
    pic.classList.add('creature-pic');
    pic.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span'); name.className = 'creature-name'; name.textContent = c.name;
    const blurb = document.createElement('span'); blurb.className = 'creature-blurb'; blurb.textContent = c.blurb;
    b.append(pic, name, blurb);
    b.setAttribute('aria-label', `${c.name}: ${c.blurb}`);
    grid.append(b);
    cards.set(c.kind, b);
  }
  if (portraitUrl) {
    medallions(portraitUrl, info.length).then((crops) => {
      if (!crops) return;
      for (const [i, c] of info.entries()) {
        const pic = cards.get(c.kind)?.querySelector('.creature-pic');
        if (!pic || !crops[i]) continue;
        const g = pic.getContext('2d');
        g.clearRect(0, 0, pic.width, pic.height);
        g.drawImage(...crops[i], 0, 0, pic.width, pic.height);
        pic.dataset.portrait = 'delivered';
      }
    });
  }
  function setCurrent(kind) {
    for (const [k, b] of cards) { b.setAttribute('aria-pressed', String(k === kind)); b.classList.toggle('current', k === kind); }
    const cur = info.find((c) => c.kind === kind);
    const lbl = $('#creature-current');
    if (lbl && cur) lbl.textContent = cur.name;
  }
  return { setCurrent, cards };
}

// The strip's medallions as drawImage source rects [img, sx, sy, sw, sh] (square, centred on each
// medallion's alpha bounds), or null if the image can't be read.
async function medallions(url, n) {
  try {
    const img = new Image();
    img.decoding = 'async'; img.src = url;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const a = g.getImageData(0, 0, W, H).data;
    const cov = new Uint32Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[(y * W + x) * 4 + 3] > 16) cov[x]++;
    // cuts: the emptiest column within a tenth of the strip either side of each k/n
    const cuts = [0];
    for (let k = 1; k < n; k++) {
      const c = Math.round(k * W / n), r = Math.round(W / n / 5);
      let best = c;
      for (let x = c - r; x <= c + r; x++) if (cov[x] < cov[best]) best = x;
      cuts.push(best);
    }
    cuts.push(W);
    const out = [];
    for (let k = 0; k < n; k++) {
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let x = cuts[k]; x < cuts[k + 1]; x++) {
        if (cov[x] < 3) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        for (let y = 0; y < H; y++) if (a[(y * W + x) * 4 + 3] > 16) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      if (x1 < 0) { out.push(null); continue; }
      const side = Math.max(x1 - x0, y1 - y0) + 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      out.push([img, cx - side / 2, cy - side / 2, side, side]);
    }
    return out;
  } catch {
    return null;
  }
}

// A painted medallion: warm disc, cream ring, the animal's head and shoulders in silhouette.
function paintedPortrait(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const disc = { squirrel: ['#c9622d', '#7a2e17'], beaver: ['#b9852f', '#6b4313'], rabbit: ['#8f9a3e', '#4b5520'], swan: ['#4f8fb0', '#1f4a66'], heron: ['#c98a3a', '#6e4318'] }[kind] || ['#999', '#555'];
  const grad = g.createRadialGradient(70, 60, 10, 80, 80, 78);
  grad.addColorStop(0, disc[0]); grad.addColorStop(1, disc[1]);
  g.fillStyle = grad; g.beginPath(); g.arc(80, 80, 74, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(80, 80, 72, 0, Math.PI * 2); g.clip();
  const fill = (col, f) => { g.fillStyle = col; g.beginPath(); f(); g.fill(); };
  const eye = (x, y, r = 4, col = '#120c0a') => { fill(col, () => g.arc(x, y, r, 0, Math.PI * 2)); fill('rgba(255,255,255,.7)', () => g.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, Math.PI * 2)); };
  if (kind === 'squirrel') {
    fill('#1d1714', () => { g.ellipse(70, 150, 52, 40, 0, 0, Math.PI * 2); });
    fill('#2a211c', () => { g.ellipse(84, 92, 30, 25, -0.3, 0, Math.PI * 2); });
    fill('#2a211c', () => { g.moveTo(98, 98); g.quadraticCurveTo(128, 104, 124, 112); g.quadraticCurveTo(108, 118, 92, 112); });
    fill('#1d1714', () => { g.ellipse(68, 64, 8, 14, -0.3, 0, Math.PI * 2); g.ellipse(88, 62, 7, 13, 0.2, 0, Math.PI * 2); });
    fill('#3a2c22', () => g.arc(32, 70, 30, 0, Math.PI * 2));
    eye(96, 88, 5);
  } else if (kind === 'beaver') {
    fill('#5a3519', () => { g.ellipse(76, 150, 60, 45, 0, 0, Math.PI * 2); });
    fill('#6b4120', () => { g.ellipse(80, 92, 36, 30, 0, 0, Math.PI * 2); });
    fill('#5a3519', () => { g.ellipse(108, 104, 22, 16, 0.2, 0, Math.PI * 2); });
    fill('#e07a1e', () => g.rect(110, 112, 8, 10));
    fill('#3b2410', () => { g.arc(58, 66, 7, 0, Math.PI * 2); });
    eye(98, 84, 3.5);
  } else if (kind === 'rabbit') {
    fill('#7d6a52', () => { g.ellipse(74, 150, 50, 42, 0, 0, Math.PI * 2); });
    fill('#8a7559', () => { g.ellipse(86, 98, 28, 24, 0.1, 0, Math.PI * 2); });
    fill('#8a7559', () => { g.ellipse(70, 46, 9, 34, -0.25, 0, Math.PI * 2); g.ellipse(88, 44, 9, 32, 0.15, 0, Math.PI * 2); });
    fill('#c9a39a', () => { g.ellipse(70, 46, 4, 26, -0.25, 0, Math.PI * 2); });
    fill('#efe7da', () => g.ellipse(104, 108, 10, 7, 0, 0, Math.PI * 2));
    eye(98, 92, 5);
  } else if (kind === 'swan') {
    fill('#f4f2ec', () => { g.ellipse(64, 150, 64, 40, 0, 0, Math.PI * 2); });
    g.strokeStyle = '#f4f2ec'; g.lineWidth = 18; g.lineCap = 'round';
    g.beginPath(); g.moveTo(70, 130); g.bezierCurveTo(50, 90, 110, 80, 88, 50); g.stroke();
    fill('#f4f2ec', () => g.ellipse(94, 46, 14, 11, 0.2, 0, Math.PI * 2));
    fill('#e8721e', () => { g.moveTo(104, 44); g.lineTo(126, 54); g.lineTo(104, 54); });
    fill('#111', () => g.arc(104, 44, 4, 0, Math.PI * 2));
    eye(96, 42, 2.2);
  } else if (kind === 'heron') {
    fill('#7d8a98', () => { g.ellipse(60, 150, 50, 46, 0, 0, Math.PI * 2); });
    g.strokeStyle = '#8e9aa6'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(66, 120); g.bezierCurveTo(56, 92, 100, 88, 84, 56); g.stroke();
    fill('#eceae4', () => g.ellipse(88, 52, 12, 9, 0.1, 0, Math.PI * 2));
    fill('#1a1a1e', () => { g.moveTo(78, 46); g.lineTo(98, 46); g.lineTo(60, 36); });
    fill('#d6a640', () => { g.moveTo(98, 50); g.lineTo(140, 60); g.lineTo(98, 56); });
    eye(92, 50, 2.5, '#d8c040');
  }
  g.restore();
  g.strokeStyle = '#f3e7cc'; g.lineWidth = 5; g.beginPath(); g.arc(80, 80, 73, 0, Math.PI * 2); g.stroke();
  return c;
}
