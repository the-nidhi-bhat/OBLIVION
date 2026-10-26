/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — scroll engine
   One measured pass per animation frame, and only when something moves.

   • geometry is cached and remeasured on resize / font load / scene change
   • each scene receives --p (0 → 1) from its own scroll span
   • pinning is CSS position: sticky, so wheel, touch, keyboard, scrollbar and
     browser find all keep working: nothing is hijacked
   • all writes are style-only (custom properties) — no layout thrash
   • reverses exactly: p is a pure function of scrollY, never an accumulator
   ═══════════════════════════════════════════════════════════════════════ */

const scenes = [...document.querySelectorAll('[data-scene]')].map((el, i) => ({
  el,
  index: i + 1,
  name: el.dataset.chapterName || `Chapter ${i + 1}`,
  top: 0,
  height: 1,
  pinned: true,
}));

const railLinks = [...document.querySelectorAll('[data-chapter-link]')];
const chapterCell = document.querySelector('[data-meta-chapter]');

const flowQuery = window.matchMedia('(max-width: 780px)');
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  scrollY: 0,
  maxScroll: 1,
  total: 0,
  chapter: 1,
  chapterFloat: 1,
  flow: false,
  reduced: reduceQuery.matches,
  updates: 0,
  lastActive: null,
};
window.__scroll = state;

let dirty = true;
let raf = 0;
let ro = null;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function measure() {
  const vh = window.innerHeight;
  const y = window.scrollY;

  scenes.forEach((scene) => {
    const rect = scene.el.getBoundingClientRect();
    scene.top = rect.top + y;
    scene.height = rect.height;
    // a pinned scene is taller than the viewport; its progress spans the surplus
    scene.pinned = rect.height > vh * 1.2;
  });

  state.maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  state.flow = flowQuery.matches;
  dirty = true;
  schedule();
}

function update() {
  raf = 0;
  if (!dirty) return;
  dirty = false;

  const vh = window.innerHeight;
  const y = window.scrollY;
  state.scrollY = y;
  state.total = clamp01(y / state.maxScroll);
  state.reduced = reduceQuery.matches;

  let weightSum = 0;
  let chapterWeight = 0;
  let active = null;
  let activeArea = -1;

  for (const scene of scenes) {
    let p;
    if (scene.pinned) {
      p = clamp01((y - scene.top) / Math.max(1, scene.height - vh));
    } else {
      p = clamp01((y + vh - scene.top) / Math.max(1, scene.height + vh));
    }
    scene.p = p;
    scene.el.style.setProperty('--p', p.toFixed(4));
    scene.el.dataset.progress = p.toFixed(2);

    // how much of this scene currently occupies the viewport
    const visible = Math.min(scene.top + scene.height, y + vh) - Math.max(scene.top, y);
    if (visible > 0) {
      weightSum += visible;
      chapterWeight += visible * scene.index;
    }
    if (visible > activeArea) {
      activeArea = visible;
      active = scene;
    }
  }

  state.chapterFloat = weightSum > 0 ? chapterWeight / weightSum : 1;
  state.chapter = active ? active.index : 1;
  state.updates += 1;

  if (state.chapter !== state.lastActive) {
    state.lastActive = state.chapter;
    document.body.dataset.chapter = String(state.chapter);
    railLinks.forEach((link) => {
      link.setAttribute('aria-current', link.dataset.chapterLink === String(state.chapter) ? 'true' : 'false');
    });
    if (chapterCell) chapterCell.textContent = `chapter 0${state.chapter} · ${active ? active.name : ''}`;
    window.dispatchEvent(new CustomEvent('scroll:chapter', { detail: { chapter: state.chapter, name: active ? active.name : '' } }));
  }

  window.__onScrollFrame?.(state.total, state.chapterFloat, state.chapter);

  // a coalesced or dropped scroll event must never leave a scene's --p stale
  if (Math.abs(window.scrollY - y) > 0.5) {
    dirty = true;
    schedule();
  }
}

function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(update);
}

function onScroll() {
  dirty = true;
  schedule();
}

/** Move the document to a scene's start, honouring sticky headers. */
export function goToScene(index, focus = true) {
  const scene = scenes.find((s) => s.index === index) || scenes[0];
  if (!scene) return;
  const reduce = reduceQuery.matches || flowQuery.matches;
  const top = Math.max(0, scene.top - (reduce ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 0));
  window.scrollTo({ top, behavior: reduceQuery.matches ? 'auto' : 'smooth' });
  const target = scene.el;
  if (focus) {
    // move keyboard focus to the chapter so screen readers and Tab follow the jump
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}

export function initScroll() {
  measure();
  update();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(measure);
    ro.observe(document.body);
  }
  if (flowQuery.addEventListener) {
    flowQuery.addEventListener('change', measure);
    reduceQuery.addEventListener('change', measure);
  }
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});
  // late layout shifts (images, fonts, dialog open) shouldn't leave stale geometry
  setTimeout(measure, 600);
  setTimeout(measure, 1800);

  railLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const index = Number(link.dataset.chapterLink);
      if (!index) return;
      event.preventDefault();
      goToScene(index);
    });
  });
}

export function scrollState() {
  return state;
}

export function disposeScroll() {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', measure);
  if (ro) { ro.disconnect(); ro = null; }
  if (raf) cancelAnimationFrame(raf);
}
