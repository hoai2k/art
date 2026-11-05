// Only copied into the CrazyGames distribution. No website dependency.
let sdk;
let playing = false, loading = false;
let soundChanged = () => {};
export const platform = {
  muted: false,
  onSoundChange(fn) { soundChanged = fn; fn(); },
  async init() {
    sdk = window.CrazyGames?.SDK;
    if (!sdk) throw new Error('CrazyGames SDK did not load');
    await sdk.init();
    const settings = (value) => { this.muted = value.muteAudio === true; soundChanged(); };
    settings(sdk.game.settings || {});
    sdk.game.addSettingsChangeListener(settings);
    this.loading(true);
  },
  loading(value) {
    if (loading === value) return;
    sdk.game[value ? 'loadingStart' : 'loadingStop']();
    loading = value;
  },
  sync({ active, waiting }) {
    // CrazyGames handles focus loss itself. Report actual in-game breaks
    // when foregrounded, while allowing an automatic first start in an iframe.
    if (!active && playing && !document.hidden && document.hasFocus()) { sdk.game.gameplayStop(); playing = false; }
    this.loading(waiting);
    if (active && !playing) { sdk.game.gameplayStart(); playing = true; }
  },
  storage: {
    getItem(key) { return sdk.data.getItem(key); },
    setItem(key, value) { sdk.data.setItem(key, value); },
  },
};
