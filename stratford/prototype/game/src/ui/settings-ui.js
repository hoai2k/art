// Binds the Settings panel rows to the settings object.

const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function bindSettings(settings, { onChange, onReset }) {
  const rows = $$('#settings [data-setting]');
  const scale = { camSens: 100, volume: 100 };
  const label = (k, v) => {
    if (k === 'camSens' || k === 'volume') return `${Math.round(v * 100)}%`;
    return String(v);
  };
  function sync() {
    for (const el of rows) {
      const k = el.dataset.setting;
      const v = settings[k];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'range') {
        el.value = Math.round(v * scale[k]);
        el.nextElementSibling.textContent = label(k, v);
      } else if (el.classList.contains('choice')) {
        el.textContent = v;
        el.setAttribute('aria-label', `${el.closest('.row').firstElementChild.textContent}: ${v}`);
      }
    }
  }
  for (const el of rows) {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') el.addEventListener('change', () => { settings[k] = el.checked; onChange(k); });
    else if (el.type === 'range') {
      el.addEventListener('input', () => {
        settings[k] = Number(el.value) / scale[k];
        el.nextElementSibling.textContent = label(k, settings[k]);
        onChange(k);
      });
    } else if (el.classList.contains('choice')) {
      const opts = el.dataset.choices.split('|');
      const step = (d) => {
        settings[k] = opts[(opts.indexOf(settings[k]) + d + opts.length) % opts.length];
        sync();
        onChange(k);
      };
      el.addEventListener('click', () => step(1));
      el.addEventListener('step', (e) => step(e.detail));
    }
  }
  sync();
  return { sync };
}
