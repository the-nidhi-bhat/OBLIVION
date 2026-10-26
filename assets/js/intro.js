/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — the opening sequence
   The counter is not decoration: it only advances when a real milestone
   completes (fonts resolved, renderer ready or explicitly failed, layout
   measured twice). It cannot sit at 97% pretending to load textures that do
   not exist. The visitor can leave at any moment.
   ═══════════════════════════════════════════════════════════════════════ */

const root = document.querySelector('[data-intro]');
const story = document.getElementById('story');
const hud = document.querySelector('[data-hud]');
const bar = document.querySelector('[data-boot-bar]');
const barFill = bar ? bar.firstElementChild : null;
const pctCell = document.querySelector('[data-boot-pct]');
const reasonCell = document.querySelector('[data-boot-reason]');
const stepEls = [...document.querySelectorAll('[data-boot-step]')];
const echoes = [...document.querySelectorAll('.boot__echo')];
const enterBtn = document.querySelector('[data-enter]');
const skipBtn = document.querySelector('[data-intro-skip]');
const title = document.querySelector('[data-boot-title]');

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = { done: false, pct: 0, reason: 'initialising', steps: 0, skipped: false, source: null };
window.__intro = state;

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function paint(pct, reason) {
  state.pct = Math.round(pct);
  state.reason = reason;
  if (pctCell) pctCell.textContent = String(state.pct).padStart(3, '0');
  if (reasonCell) reasonCell.textContent = reason;
  if (bar) {
    bar.setAttribute('aria-valuenow', String(state.pct));
    bar.setAttribute('aria-valuetext', `${state.pct}% — ${reason}`);
  }
  if (barFill) barFill.style.width = `${state.pct}%`;
}

function unlock(focusTarget) {
  if (state.done) return;
  state.done = true;
  state.source = state.source || 'auto';

  document.body.classList.remove('is-booting');
  if (story) story.removeAttribute('inert');
  if (hud) hud.removeAttribute('inert');
  if (root) {
    root.classList.add('is-done');
    root.setAttribute('aria-hidden', 'true');
    setTimeout(() => { root.hidden = true; }, 950);
  }
  paint(100, 'visitor admitted');

  const target = focusTarget || document.getElementById('ch1-title') || document.querySelector('main');
  if (target) {
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  window.dispatchEvent(new CustomEvent('intro:done', { detail: { ...state } }));
}

/** The four milestones are real. Nothing here is a timer pretending to load. */
async function run() {
  // the boot owns the page while it is up
  document.body.classList.add('is-booting');
  if (story) story.setAttribute('inert', '');
  if (hud) hud.setAttribute('inert', '');

  if (reduceQuery.matches) {
    // no typing, no glitch, no staged reveal — everything is present at once
    stepEls.forEach((el) => el.classList.add('is-on'));
    echoes.forEach((el) => el.classList.add('is-on'));
    state.steps = 4;
    paint(100, 'reduced motion — sequence held still');
    if (title) title.focus({ preventScroll: true });
    await wait(2200);
    unlock(enterBtn);
    return;
  }

  paint(0, 'opening recovery shell');
  if (title) title.focus({ preventScroll: true });
  await wait(420);

  // 1 — the document is parsed (we are running)
  state.steps = 1;
  stepEls[0]?.classList.add('is-on');
  paint(25, 'signal acquired');
  await wait(520);

  // 2 — typography is resolved
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (err) { /* keep going */ }
  }
  state.steps = 2;
  stepEls[1]?.classList.add('is-on');
  paint(52, 'type resolved · memory sectors mapped');
  await wait(480);

  // 3 — the renderer reports ready (or an explicit backend failure)
  const deadline = performance.now() + 4000;
  while (!(window.__scene && window.__scene.ready) && performance.now() < deadline) {
    await wait(60);
  }
  state.steps = 3;
  stepEls[2]?.classList.add('is-on');
  paint(76, window.__scene && window.__scene.backend === 'webgl' ? 'portal compiled' : 'portal unavailable — static world');
  await wait(520);

  // 4 — layout measured over two frames, so scroll geometry is trustworthy
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  state.steps = 4;
  stepEls[3]?.classList.add('is-on');
  paint(97, 'visitor located');

  // the transmission
  await wait(360);
  if (echoes[0]) echoes[0].classList.add('is-on');
  await wait(1150);
  if (echoes[1]) echoes[1].classList.add('is-on');
  await wait(1500);

  paint(100, 'visitor admitted');
  if (state.done) return;

  // hold the title long enough to read it, then let the story begin on its own
  await wait(900);
  unlock();
}

enterBtn?.addEventListener('click', () => unlock(enterBtn));
skipBtn?.addEventListener('click', () => {
  state.skipped = true;
  state.source = 'skipped';
  unlock(skipBtn);
});

document.addEventListener('keydown', (event) => {
  if (state.done) return;
  if (event.key === 'Escape') {
    state.source = 'escape';
    unlock(skipBtn);
  }
});

// a hard cap: no bug, slow device or blocked font load may keep the visitor here
const cap = setTimeout(() => {
  if (!state.done) {
    state.source = 'cap';
    unlock(skipBtn);
  }
}, 12000);
window.addEventListener('pagehide', () => clearTimeout(cap));

run().catch(() => {
  // if the sequence itself fails, the story must still be reachable
  unlock(skipBtn);
});

export { unlock as finishIntro };
