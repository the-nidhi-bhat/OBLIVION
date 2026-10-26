/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — the archive's own accounting
   A session clock the visitor can trust next to a record clock that is
   fiction. One impossible timestamp, once, at the beat that names it.
   No analytics, no network, no invented "live" data.
   ═══════════════════════════════════════════════════════════════════════ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

import { count } from './story.js';

const sessionEl = $('[data-session-clock]');
const archiveEl = $('[data-archive-clock]');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

const pad = (n) => String(n).padStart(2, '0');
const started = performance.now();

const api = {
  started,
  anomaly: false,
  anomalies: 0,
  corruption: 0,
  fast: false,
  clocks: { session: '00:00', record: '09Y 000D' },
};
window.__system = api;

/* ── the clocks ────────────────────────────────────────────────────── */

function tickClock() {
  const s = Math.floor((performance.now() - started) / 1000);
  api.clocks.session = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  if (sessionEl) sessionEl.textContent = api.clocks.session;
}

function setRecord(text) {
  api.clocks.record = text;
  if (archiveEl) archiveEl.textContent = text;
}

tickClock();
const clockTimer = window.setInterval(tickClock, 1000);

/* ── the impossible timestamp ──────────────────────────────────────── */

let anomalyTimer = 0;

function impossibleRecord() {
  if (api.anomalies) return false;
  api.anomalies = 1;
  api.anomaly = true;
  setRecord('09Y 000D 00:00:11');
  document.body.dataset.anomaly = 'true';
  clearTimeout(anomalyTimer);
  anomalyTimer = window.setTimeout(() => {
    api.anomaly = false;
    setRecord('09Y 000D');
    document.body.dataset.anomaly = 'false';
  }, 1800);
  return true;
}

window.addEventListener('__oblivion:progress', (event) => {
  const { chapter, p } = event.detail;
  if (chapter === 1 && p >= 0.88) impossibleRecord();
});

/* ── corruption level: no number is ever shown ─────────────────────── */

function setCorruption(level) {
  api.corruption = level;
  document.body.style.setProperty('--corrupt', String(level));
}

window.addEventListener('story:change', (event) => {
  const n = event.detail.count;
  setCorruption(n <= 1 ? 0 : n <= 3 ? 1 : n === 4 ? 2 : 3);
});
setCorruption(count() <= 1 ? 0 : count() <= 3 ? 1 : count() === 4 ? 2 : 3);

/* ── scroll velocity: a brief fringe at the edges only ─────────────── */

let lastY = window.scrollY;
let lastT = performance.now();
let fastTimer = 0;
let frameScheduled = false;

function edgeFringe(y, t) {
  const dy = Math.abs(y - lastY);
  const dt = Math.max(16, t - lastT);
  lastY = y;
  lastT = t;
  if (reduce.matches || document.body.classList.contains('is-ending')) return;
  if (dy / dt <= 0.9) return; // ~900 px per second
  if (!api.fast) {
    api.fast = true;
    document.body.classList.add('is-fast');
  }
  clearTimeout(fastTimer);
  fastTimer = window.setTimeout(() => {
    api.fast = false;
    document.body.classList.remove('is-fast');
  }, 240);
}

window.addEventListener('scroll', () => {
  if (frameScheduled) return;
  frameScheduled = true;
  requestAnimationFrame(() => {
    frameScheduled = false;
    edgeFringe(window.scrollY, performance.now());
  });
}, { passive: true });

/* ── windows that watch, on fine pointers only ─────────────────────── */

const watches = $$('[data-watch]');
let watchX = 0;
let watchY = 0;
let watchFrame = 0;

function updateWatches() {
  watchFrame = 0;
  if (!fine.matches || !watches.length) return;
  let best = null;
  let bestD = Infinity;
  watches.forEach((w) => {
    const r = w.getBoundingClientRect();
    const d = Math.hypot(watchX - (r.left + r.width / 2), watchY - (r.top + r.height / 2));
    if (d < bestD) { bestD = d; best = w; }
  });
  watches.forEach((w) => w.classList.toggle('is-watching', w === best && bestD < 130));
}

window.addEventListener('pointermove', (event) => {
  if (!fine.matches) return;
  watchX = event.clientX;
  watchY = event.clientY;
  if (!watchFrame) watchFrame = requestAnimationFrame(updateWatches);
}, { passive: true });

window.addEventListener('pagehide', () => {
  clearInterval(clockTimer);
  clearTimeout(anomalyTimer);
  clearTimeout(fastTimer);
  cancelAnimationFrame(watchFrame);
});
