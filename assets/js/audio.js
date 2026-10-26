/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — the room tone
   Sound is OFF until the visitor switches it on. Nothing is downloaded:
   the drone and the discovery cue are generated with the Web Audio API,
   so there is no asset, no network request and no autoplay.
   ═══════════════════════════════════════════════════════════════════════ */

const supported = typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function';

const state = {
  supported,
  constructed: false,
  enabled: false,
  ctx: null,
  master: null,
  drone: [],
  chapter: Number(document.body?.dataset.chapter || 1) || 1,
  cues: { discovery: 0, ending: 0 },
};

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function build() {
  if (state.constructed || !supported) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  filter.Q.value = 0.4;

  // three detuned partials: a room, not a melody
  const spec = [[55, 0.5], [82.5, 0.22], [110, 0.1]];
  const drone = spec.map(([freq, level]) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(gain).connect(filter);
    osc.start();
    return { osc, base: freq };
  });
  filter.connect(master).connect(ctx.destination);

  state.ctx = ctx;
  state.master = master;
  state.drone = drone;
  state.constructed = true;
  tune(state.chapter, 0.4);
}

function tune(chapter, seconds = 1.4) {
  if (!state.ctx) return;
  const steps = Math.max(0, Math.min(6, chapter)) * 2; // two semitones darker per chapter
  const ratio = Math.pow(2, -steps / 12);
  const now = state.ctx.currentTime;
  state.drone.forEach(({ osc, base }) => {
    osc.frequency.cancelScheduledValues(now);
    osc.frequency.setTargetAtTime(base * ratio, now, seconds);
  });
}

function cueDiscovery() {
  state.cues.discovery += 1;
  if (!state.enabled || !state.ctx) return;
  const ctx = state.ctx;
  const now = ctx.currentTime;
  [[740, 0.12], [1480, 0.05]].forEach(([freq, level], i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (i ? 0.55 : 0.8));
    osc.connect(gain).connect(state.master);
    osc.start(now);
    osc.stop(now + 0.9);
  });
}

function cueEnding(key) {
  state.cues.ending += 1;
  if (!state.ctx || !state.enabled) return;
  const ctx = state.ctx;
  const now = ctx.currentTime;
  if (key === 'erase') {
    // the archive deletes its room tone, then the tab is allowed to be silent
    state.master.gain.cancelScheduledValues(now);
    state.master.gain.setTargetAtTime(0.0001, now, 0.45);
    window.setTimeout(() => { if (state.ctx) state.ctx.suspend().catch(() => {}); }, 1800);
    return;
  }
  state.master.gain.setTargetAtTime(key === 'restore' ? 0.075 : 0.06, now, 0.8);
  tune(key === 'restore' ? 1 : 5, 2.2);
}

function setEnabled(on, fromEvent = false) {
  if (!supported) return false;
  build();
  if (!state.ctx) return false;
  state.enabled = Boolean(on);
  const ctx = state.ctx;
  if (state.enabled) {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    state.master.gain.cancelScheduledValues(ctx.currentTime);
    state.master.gain.setTargetAtTime(0.05, ctx.currentTime, 0.6);
  } else {
    state.master.gain.cancelScheduledValues(ctx.currentTime);
    state.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    window.setTimeout(() => { if (state.ctx && !state.enabled) state.ctx.suspend().catch(() => {}); }, 600);
  }
  if (fromEvent) dispatchUi();
  return state.enabled;
}

const toggle = document.querySelector('[data-sound-toggle]');
const label = document.querySelector('[data-sound-label]');

function dispatchUi() {
  if (!toggle) return;
  toggle.setAttribute('aria-pressed', String(state.enabled));
  if (label) label.textContent = state.enabled ? 'on' : 'off';
  toggle.setAttribute('aria-label', `Sound ${state.enabled ? 'on' : 'off'} — generated in your browser`);
}

toggle?.addEventListener('click', () => {
  const on = setEnabled(!state.enabled, true);
  if (!supported) {
    toggle.setAttribute('aria-pressed', 'false');
    if (label) label.textContent = 'unsupported';
  }
  return on;
});

if (toggle) {
  toggle.hidden = false;
  dispatchUi();
}

window.addEventListener('scroll:chapter', (event) => {
  state.chapter = event.detail.chapter;
  tune(state.chapter);
});
window.addEventListener('story:discovery', () => cueDiscovery());
window.addEventListener('story:ending', (event) => cueEnding(event.detail.ending));

window.addEventListener('pagehide', () => {
  if (state.ctx) state.ctx.close().catch(() => {});
});

// a deliberately small debug surface: the harness asserts the same state a visitor hears
window.__audio = {
  get supported() { return state.supported; },
  get constructed() { return state.constructed; },
  get enabled() { return state.enabled; },
  get state() { return state.ctx ? state.ctx.state : 'none'; },
  get chapter() { return state.chapter; },
  get cues() { return { ...state.cues }; },
  get reduced() { return reduced(); },
};
