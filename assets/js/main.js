/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — wiring
   One render loop (the renderer's), one scroll rAF (on demand), one state
   store. No framework, no competing tickers.
   ═══════════════════════════════════════════════════════════════════════ */

import './intro.js';
import './system.js';
import { setScroll, setEnding } from './scene.js';
import { initScroll, goToScene, scrollState } from './scroll.js';
import { initUi, showEnding, openJournal, restart } from './ui.js';
import { snapshot, setChoice, confirmEnding, reset } from './story.js';

const fpsCell = document.querySelector('[data-meta-fps]');

/* the scroll engine calls this once per animation frame, and only on change */
window.__onScrollFrame = (total, chapterFloat, chapter) => {
  setScroll(total, chapterFloat);
  const scene = document.querySelector(`[data-scene="${chapter}"]`);
  const p = scene ? Number(scene.dataset.progress || 0) : 0;
  window.dispatchEvent(new CustomEvent('__oblivion:progress', { detail: { chapter, p } }));
};

initScroll();
const ui = initUi();

/* measured frame rate — reported, never invented */
let lastFrames = window.__scene ? window.__scene.frames : 0;
let lastSample = performance.now();
let fpsTimer = window.setInterval(() => {
  if (!window.__scene || document.hidden) return;
  const now = performance.now();
  const frames = window.__scene.frames;
  const delta = frames - lastFrames;
  const seconds = (now - lastSample) / 1000;
  lastFrames = frames;
  lastSample = now;
  if (!fpsCell) return;
  if (!window.__scene.running) {
    fpsCell.textContent = 'renderer paused';
  } else if (seconds > 0.2) {
    fpsCell.textContent = `${Math.round(delta / seconds)} fps measured`;
  }
}, 1000);
window.addEventListener('pagehide', () => clearInterval(fpsTimer));
document.addEventListener('visibilitychange', () => {
  lastFrames = window.__scene ? window.__scene.frames : 0;
  lastSample = performance.now();
});

/* a small, honest public API: the harness uses the same surface a human does */
window.__oblivion = {
  version: 3,
  goToScene,
  openJournal,
  showEnding,
  restart,
  choose: (key) => { setChoice(key); return snapshot(); },
  confirm: () => {
    const ending = confirmEnding();
    if (ending) showEnding(ending);
    return ending;
  },
  reset: () => { reset(); setEnding('none'); document.body.dataset.ending = ''; },
  state: () => ({
    ...snapshot(),
    chapter: scrollState().chapter,
    total: Number(scrollState().total.toFixed(3)),
    system: {
      session: window.__system?.clocks.session,
      record: window.__system?.clocks.record,
      anomaly: window.__system?.anomaly,
      anomalies: window.__system?.anomalies,
      corruption: window.__system?.corruption,
      fast: window.__system?.fast,
    },
    ui: {
      ending: ui.ending,
      opened: ui.opened,
      split: ui.split,
      ghost: ui.ghost,
      hold: ui.hold,
      compare: ui.compare,
    },
  }),
};
