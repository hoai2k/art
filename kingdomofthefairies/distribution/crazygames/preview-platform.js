// Standalone public preview of the portal build. No CrazyGames SDK, accounts,
// analytics or advertising. Storage is separate from the regular website.
let soundChanged = () => {};
const prefix = 'kotf.crazygames-preview.';
export const platform = {
  muted: false,
  onSoundChange(fn) { soundChanged = fn; fn(); },
  async init() {
    try { this.muted = localStorage.getItem(prefix + 'muted') === 'true'; } catch { /* unavailable */ }
    const controls = document.createElement('aside');
    controls.id = 'preview-controls';
    controls.setAttribute('aria-label', 'Preview host controls');
    const label = document.createElement('span'); label.textContent = 'CrazyGames preview';
    const sound = document.createElement('button');
    const sync = () => { sound.textContent = this.muted ? 'Unmute' : 'Mute'; sound.setAttribute('aria-pressed', String(this.muted)); };
    sound.addEventListener('click', () => { this.muted = !this.muted; try { localStorage.setItem(prefix + 'muted', String(this.muted)); } catch { /* unavailable */ } sync(); soundChanged(); });
    const full = document.createElement('button'); full.textContent = 'Fullscreen';
    full.hidden = !document.documentElement.requestFullscreen;
    full.addEventListener('click', () => {
      const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      action?.catch(() => {});
    });
    controls.append(label, sound, full); document.body.append(controls); sync();
  },
  loading() {},
  sync() {},
  storage: {
    getItem(key) { try { return localStorage.getItem(prefix + key); } catch { return null; } },
    setItem(key, value) { try { localStorage.setItem(prefix + key, value); } catch { /* unavailable */ } },
  },
};
