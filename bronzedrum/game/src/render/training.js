import { T, txt } from '../text_config.js';
import { PALETTE as P } from '../palette.js';
import { parsePattern } from '../rhythm.js';
import { usesText } from '../training.js';

// Training's screen (Drum Practice): the levels as tabs across the top and
// the chosen level's rhythms down the left, numbered, each with its dots and
// where the chapters use it. The tabs and the rows are also tap and click
// targets (trainingTarget).
// Nine levels: the tabs are numbers; the list's head names the level and says what is in it.
const TABS = { y: 14, h: 40, w: 52, gap: 8, yTouch: 64 }; // below the pause button on touch
const LIST = { x: 16, y: 120, w: 452, head: 62, rowH: 62, foot: 50 };

function tabX(i, n) {
  const total = n * TABS.w + (n - 1) * TABS.gap;
  return 640 - total / 2 + i * (TABS.w + TABS.gap);
}

export const training = {
  /**
   * What a tap or click at (x, y) chooses: 'level:N' (1-based), 'rhythm:i'
   * (0-based), or null. Measured against the panel as last drawn.
   */
  trainingTarget(x, y, current) {
    const tr = current && this.lastTraining;
    if (!tr) return null;
    const n = tr.levels.length;
    const ty = tr.touch ? TABS.yTouch : TABS.y;
    if (y >= ty && y <= ty + TABS.h) {
      for (let i = 0; i < n; i++) {
        const tx = tabX(i, n);
        if (x >= tx && x <= tx + TABS.w) return `level:${i + 1}`;
      }
    }
    const top = LIST.y + LIST.head;
    if (x >= LIST.x && x <= LIST.x + LIST.w && y >= top) {
      const i = Math.floor((y - top) / LIST.rowH);
      if (i >= 0 && i < tr.entries.length) return `rhythm:${i}`;
    }
    return null;
  },

  trainingPanel(view) {
    const g = this.ctx;
    const tr = view.training;
    const t = view.songTime;
    const n = tr.levels.length;
    this.lastTraining = tr;
    const ty = tr.touch ? TABS.yTouch : TABS.y;
    g.save();
    // The levels.
    g.font = '700 16px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'center';
    tr.levels.forEach((lv, i) => {
      const x = tabX(i, n);
      const on = i + 1 === tr.level;
      g.fillStyle = on ? P.bronzeLight : 'rgba(22,21,26,0.62)';
      g.beginPath();
      g.roundRect(x, ty, TABS.w, TABS.h, 8);
      g.fill();
      if (!on) {
        g.strokeStyle = 'rgba(242,232,213,0.25)';
        g.lineWidth = 1;
        g.stroke();
      }
      g.fillStyle = on ? P.ink : P.paper;
      g.fillText(`${i + 1}`, x + TABS.w / 2, ty + 26);
    });
    // The level's rhythms.
    const rows = tr.entries.length;
    const h = LIST.head + rows * LIST.rowH + LIST.foot;
    g.fillStyle = 'rgba(22,21,26,0.66)';
    g.beginPath();
    g.roundRect(LIST.x, LIST.y, LIST.w, h, 10);
    g.fill();
    const lv = tr.levels[tr.level - 1];
    g.textAlign = 'left';
    g.font = '700 15px "Be Vietnam Pro", system-ui, sans-serif';
    g.fillStyle = P.paper;
    g.fillText(txt('training.levelHeading', { level: tr.level, name: lv.name }), LIST.x + 14, LIST.y + 22);
    // What the level holds, on up to two lines.
    g.font = '500 12px "Be Vietnam Pro", system-ui, sans-serif';
    g.fillStyle = P.paperShade;
    const lines = [''];
    for (const word of lv.about.split(' ')) {
      const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (g.measureText(next).width > LIST.w - 28 && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = next;
    }
    lines.slice(0, 2).forEach((l, k) => g.fillText(l, LIST.x + 14, LIST.y + 40 + k * 15));
    tr.entries.forEach((e, i) => {
      const y = LIST.y + LIST.head + i * LIST.rowH;
      const cur = i === tr.current;
      if (cur) {
        const pulse = tr.calling ? 0.12 * (0.5 + 0.5 * Math.sin(t * 8)) : 0;
        g.fillStyle = `rgba(217,165,91,${0.22 + pulse})`;
        g.fillRect(LIST.x + 4, y + 2, LIST.w - 8, LIST.rowH - 4);
        g.fillStyle = P.bronzeLight;
        g.fillRect(LIST.x + 4, y + 2, 4, LIST.rowH - 4);
      }
      // Its number, large, to name it by. (pattern() leaves the alignment centred.)
      g.textAlign = 'left';
      g.font = '700 20px "Be Vietnam Pro", system-ui, sans-serif';
      g.fillStyle = cur ? P.bronzeLight : P.paper;
      g.fillText(`${e.n}`, LIST.x + 18, y + 26);
      this.pattern(LIST.x + 62, y + 20, { strokes: parsePattern(e.text) }, 8, 30, Infinity, cur);
      // Played well and missed, this visit.
      const tl = tr.tally[e.n];
      if (tl) {
        g.font = '600 13px "Be Vietnam Pro", system-ui, sans-serif';
        g.textAlign = 'right';
        g.fillStyle = P.bronzeLight;
        g.fillText(`✓ ${tl.ok}`, LIST.x + LIST.w - 56, y + 24);
        g.fillStyle = '#E07A6E';
        g.fillText(`✗ ${tl.miss}`, LIST.x + LIST.w - 14, y + 24);
        g.textAlign = 'left';
      }
      // Where the chapters use it.
      g.textAlign = 'left';
      g.font = '500 12px "Be Vietnam Pro", system-ui, sans-serif';
      g.fillStyle = 'rgba(242,232,213,0.72)';
      let uses = usesText(e);
      const room = LIST.w - 62 - 14;
      if (g.measureText(uses).width > room) {
        while (uses.length > 4 && g.measureText(`${uses}…`).width > room) uses = uses.slice(0, -1);
        uses = `${uses}…`;
      }
      g.fillText(uses, LIST.x + 62, y + 54);
    });
    // The controls.
    g.font = '600 13px "Be Vietnam Pro", system-ui, sans-serif';
    g.fillStyle = P.paperShade;
    this.richText(tr.keys, LIST.x + LIST.w / 2, LIST.y + h - 30);
    // The catalogue is the rhythms as designed: Difficulty and Number of beats
    // reshape them in the chapters, not here (the numbers stay put).
    g.font = '500 12px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(242,232,213,0.6)';
    g.fillText(T.training.asDesigned, LIST.x + LIST.w / 2, LIST.y + h - 10);
    g.restore();
  },
};
