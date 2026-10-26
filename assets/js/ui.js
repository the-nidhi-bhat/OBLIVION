/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — interface: typography, evidence, journal, choices, endings
   Every control here performs the action it names. No decorative buttons.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  FRAGMENTS, ORDER, ENDINGS, has, recover, count, snapshot,
  setChoice, confirmEnding, reset, echoLine, journalEcho,
  record, markSeen, journalState, contradiction, linkPair, isLinked, proven, eggSeen,
  ECHO_FIRST_WRITE,
} from './story.js';
import { setEnding } from './scene.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const evidencePanel = $('[data-evidence-panel]');
const journal = $('[data-journal]');
const endingScreen = $('[data-ending-screen]');
const echoStrip = $('[data-echo]');
const echoLineEl = $('[data-echo-line]');

const ui = { split: 0, opened: null, journalOpen: false, ending: null, echoTimer: 0 };
window.__ui = ui;

/* ── typography: split a title into animatable letters ─────────────── */

$$('[data-split]').forEach((el) => {
  const source = el.dataset.split || '';
  const frag = document.createDocumentFragment();
  [...source].forEach((char, i) => {
    if (char === ' ') {
      const space = document.createElement('span');
      space.className = 'ltr';
      space.style.setProperty('--i', String(i));
      space.innerHTML = '&nbsp;';
      space.setAttribute('aria-hidden', 'true');
      frag.appendChild(space);
      return;
    }
    const span = document.createElement('span');
    span.className = 'ltr';
    span.textContent = char;
    span.style.setProperty('--i', String(i));
    // deterministic variation: no Math.random, so every load animates the same way
    span.style.setProperty('--dir', i % 2 === 0 ? '1' : '-1');
    span.style.setProperty('--rot', `${((i * 7) % 11) - 5}deg`);
    span.setAttribute('aria-hidden', 'true');
    frag.appendChild(span);
  });
  el.appendChild(frag);
  ui.split += 1;
});

/* stagger metadata for the transcript and the reconstructed timeline */
$$('.transcript__list li').forEach((li, i) => li.style.setProperty('--at', (0.2 + i * 0.075).toFixed(3)));
$$('.timeline__list li').forEach((li, i) => li.style.setProperty('--at', (0.16 + i * 0.09).toFixed(3)));

/* ── the photograph ────────────────────────────────────────────────── */

const photo = $('[data-photo]');
const photoCap = $('[data-photo-cap]');
const photoBtn = $('[data-photo-flip]');

let autoFlipped = false;

function setPhoto(flipped, auto = false) {
  if (!photo) return;
  // the scroll beat may turn the photograph once; a human can always turn it back
  if (!flipped && auto) return;
  if (auto) autoFlipped = true;
  photo.classList.toggle('is-flipped', flipped);
  photo.style.setProperty('--flip', flipped ? '1' : '0');
  if (photoCap) photoCap.classList.toggle('is-flipped', flipped);
  if (photoBtn) photoBtn.setAttribute('aria-pressed', flipped ? 'true' : 'false');
}

photoBtn?.addEventListener('click', () => setPhoto(!photo.classList.contains('is-flipped')));

/* ── evidence panel ────────────────────────────────────────────────── */

function openEvidence(id) {
  const data = record(id);
  if (!data || !evidencePanel) return;
  if (FRAGMENTS[id] && !has(id)) recover(id);
  if (FRAGMENTS[id]) markSeen(id);

  $('[data-evidence-tag]').textContent = data.tag;
  $('[data-evidence-title]').textContent = data.title;
  $('[data-evidence-date]').textContent = data.date;
  $('[data-evidence-body]').textContent = data.body;
  $('[data-evidence-impl]').textContent = data.impl;

  ui.opened = id;
  if (!evidencePanel.open) evidencePanel.showModal();
  const closeBtn = evidencePanel.querySelector('button[value="close"]');
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

const journalList = $('[data-journal-list]');
const journalEmpty = $('[data-journal-empty]');
const compareToggle = $('[data-compare-toggle]');
const compareLink = $('[data-compare-link]');
const compareClear = $('[data-compare-clear]');
const compareResult = $('[data-compare-result]');
const scrub = $('[data-scrub]');
const scrubOut = $('[data-scrub-out]');

const compare = { mode: false, selected: [] };

const pad2 = (n) => String(n).padStart(2, '0');

function scrubDate(value) {
  return `${Math.floor(value / 12) + 2189}-${pad2((value % 12) + 1)}`;
}

const stampOf = (id) => FRAGMENTS[id]?.stamp || null;

function applyScrub() {
  if (!scrub) return;
  const date = scrubDate(Number(scrub.value));
  if (scrubOut) scrubOut.textContent = date;
  scrub.setAttribute('aria-valuetext', date);
  $$('[data-journal-item]').forEach((btn) => {
    const stamp = stampOf(btn.dataset.journalItem);
    btn.dataset.inWindow = String(!stamp || stamp.slice(0, 7) <= date);
    btn.dataset.predates = String(Boolean(stamp && stamp < ECHO_FIRST_WRITE));
  });
}

function renderSelection() {
  $$('[data-journal-item]').forEach((btn) => {
    const on = compare.selected.includes(btn.dataset.journalItem);
    btn.dataset.selected = String(on);
    if (compare.mode) btn.setAttribute('aria-pressed', String(on));
    else btn.removeAttribute('aria-pressed');
  });
  if (compareLink) compareLink.disabled = compare.selected.length !== 2;
  if (compareClear) compareClear.hidden = !compare.mode;
  if (compareToggle) compareToggle.setAttribute('aria-pressed', String(compare.mode));
  ui.compare = { mode: compare.mode, selected: [...compare.selected] };
}

function syncEvidenceUi() {
  const n = count();
  $$('[data-evidence-count]').forEach((el) => { el.textContent = String(n); });

  ORDER.forEach((id) => {
    const state = document.querySelector(`[data-fragment-state="${id}"]`);
    if (state) state.textContent = has(id) ? 'recovered' : 'inspect';
    const btn = document.querySelector(`[data-fragment="${id}"]`);
    if (btn) btn.dataset.recovered = has(id) ? 'true' : 'false';
  });

  const isProven = proven();
  document.body.dataset.proven = isProven ? 'true' : 'false';
  const ch4 = document.getElementById('ch4');
  if (ch4) ch4.dataset.proven = isProven ? 'true' : 'false';
  const resolved = $('[data-lie-resolved]');
  if (resolved) resolved.hidden = !isProven;
  if (isProven && echoLineEl) {
    echoLineEl.classList.remove('is-corrupt');
    echoLineEl.removeAttribute('data-ghost');
  }

  if (journalList) {
    journalList.textContent = '';
    snapshot().evidence.forEach((id) => {
      const data = FRAGMENTS[id];
      const state = journalState(id) || 'discovered';
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'journal__item';
      btn.dataset.journalItem = id;
      btn.dataset.state = state;
      const tag = document.createElement('span');
      tag.textContent = data.tag.split('·')[0].trim();
      const name = document.createElement('span');
      name.textContent = data.title;
      const date = document.createElement('time');
      date.textContent = data.date.split('·')[0].trim();
      const badge = document.createElement('span');
      badge.className = 'journal__badge';
      badge.textContent = state;
      btn.append(tag, name, date, badge);
      btn.addEventListener('click', () => {
        if (compare.mode) { toggleCompare(id); return; }
        journal?.close();
        openEvidence(id);
      });
      li.appendChild(btn);
      journalList.appendChild(li);
    });
    if (journalEmpty) journalEmpty.hidden = snapshot().evidence.length > 0;
    applyScrub();
    renderSelection();
  }

  const je = $('[data-journal-echo]');
  if (je) je.textContent = journalEcho();
}

function toggleCompare(id) {
  const at = compare.selected.indexOf(id);
  if (at >= 0) compare.selected.splice(at, 1);
  else {
    // exactly two at a time: a third pick replaces the oldest
    if (compare.selected.length >= 2) compare.selected = [compare.selected[1]];
    compare.selected.push(id);
  }
  if (compareResult) { compareResult.hidden = true; compareResult.textContent = ''; }
  renderSelection();
}

function setCompareMode(on) {
  compare.mode = on;
  compare.selected = [];
  if (compareResult) { compareResult.hidden = true; compareResult.textContent = ''; }
  renderSelection();
}

function drawThread() {
  if (compare.selected.length !== 2 || !compareResult) return;
  const [a, b] = compare.selected;
  const found = linkPair(a, b);
  compareResult.hidden = false;
  compareResult.textContent = '';
  const head = document.createElement('b');
  const body = document.createElement('span');
  if (found) {
    compareResult.dataset.verdict = 'contradiction';
    head.textContent = `THREAD DRAWN · ${found.title}`;
    body.textContent = `${found.body} (${a.toUpperCase()} ↔ ${b.toUpperCase()})`;
  } else {
    compareResult.dataset.verdict = 'none';
    head.textContent = 'NO THREAD';
    body.textContent = 'These two records agree with each other. Nothing contradicts, so nothing connects.';
  }
  compareResult.append(head, body);
  compare.selected = [];
  syncEvidenceUi();
}

compareToggle?.addEventListener('click', () => setCompareMode(!compare.mode));
compareClear?.addEventListener('click', () => setCompareMode(false));
compareLink?.addEventListener('click', drawThread);
scrub?.addEventListener('input', applyScrub);

$$('[data-fragment]').forEach((btn) => {
  btn.addEventListener('click', () => openEvidence(btn.dataset.fragment));
});

const seamBtn = $('[data-seam]');
seamBtn?.addEventListener('click', () => {
  eggSeen();
  openEvidence('seam');
});

/* ── journal ───────────────────────────────────────────────────────── */

function openJournal() {
  if (!journal) return;
  syncEvidenceUi();
  if (!journal.open) {
    journal.showModal();
    ui.journalOpen = true;
    const first = journal.querySelector('[data-journal-item]');
    const closeBtn = journal.querySelector('button[value="close"]');
    (first || closeBtn)?.focus({ preventScroll: true });
  }
}

$('[data-journal-open]')?.addEventListener('click', openJournal);
$('[data-review]')?.addEventListener('click', openJournal);
$('[data-ending-review]')?.addEventListener('click', openJournal);

journal?.addEventListener('close', () => { ui.journalOpen = false; });
evidencePanel?.addEventListener('close', () => {
  // return keyboard focus to the control that opened the record
  const trigger = document.querySelector(`[data-fragment="${ui.opened}"]`)
    || (ui.opened === 'seam' ? seamBtn : null);
  if (trigger) trigger.focus({ preventScroll: true });
  ui.opened = null;
});

/* ── choices and endings ───────────────────────────────────────────── */

const choiceButtons = $$('[data-ending-choice]');
const confirmBtn = $('[data-confirm]');
const confirmQuick = $('[data-confirm-quick]');
const preview = $('[data-commit-preview]');

const PREVIEW = {
  restore: 'You will <b>restore every memory</b>, including the ones that destroyed people. The archive becomes whole and unstable.',
  erase: 'You will <b>erase OBLIVION</b> and release everything still inside it. Nothing is preserved. ECHO ends with it.',
  rewrite: 'You will <b>rewrite the preservation rule</b>. ECHO survives without authority. The universe stays unfinished.',
};

function syncChoice() {
  const chosen = snapshot().choice;
  choiceButtons.forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.dataset.endingChoice === chosen ? 'true' : 'false');
  });
  if (confirmBtn) confirmBtn.disabled = !chosen;
  if (confirmQuick) confirmQuick.disabled = !chosen;
  if (!chosen) stopHold();
  if (preview) {
    preview.innerHTML = chosen
      ? `Selected — <b>${ENDINGS[chosen].label.split('·')[1].trim()}</b>. ${PREVIEW[chosen]}`
      : 'No course selected.';
  }
}

choiceButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    stopHold();
    setChoice(btn.dataset.endingChoice);
    syncChoice();
    confirmBtn?.focus({ preventScroll: true });
  });
});

/* ── hold to commit: 1.5 s, cancellable, with a single-press alternative ── */

const HOLD_MS = 1500;
let holding = false;
let holdStart = 0;
let holdRaf = 0;

function holdProgress(p) {
  confirmBtn?.style.setProperty('--hold', p.toFixed(3));
  ui.hold = Math.round(p * 100) / 100;
}

function stopHold() {
  if (holdRaf) cancelAnimationFrame(holdRaf);
  holdRaf = 0;
  holding = false;
  ui.holding = false;
  if (confirmBtn) {
    confirmBtn.dataset.holding = 'false';
    confirmBtn.style.setProperty('--hold', '0');
  }
  ui.hold = 0;
}

function commitChoice() {
  if (!snapshot().choice) return;
  stopHold();
  const ending = confirmEnding();
  if (ending) showEnding(ending);
}

function startHold() {
  if (holding || !confirmBtn || confirmBtn.disabled) return;
  holding = true;
  ui.holding = true;
  holdStart = performance.now();
  confirmBtn.dataset.holding = 'true';
  const tick = () => {
    if (!holding) return;
    const p = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
    holdProgress(p);
    if (p >= 1) { commitChoice(); return; }
    holdRaf = requestAnimationFrame(tick);
  };
  tick();
}

confirmBtn?.addEventListener('pointerdown', (event) => {
  if (event.button === 0) startHold();
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((name) => {
  confirmBtn?.addEventListener(name, stopHold);
});
confirmBtn?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (!event.repeat) startHold();
});
confirmBtn?.addEventListener('keyup', (event) => {
  if (event.key === 'Enter' || event.key === ' ') stopHold();
});
confirmBtn?.addEventListener('blur', stopHold);
confirmQuick?.addEventListener('click', commitChoice);
window.addEventListener('keydown', (event) => {
  if (holding && event.key === 'Escape') {
    event.preventDefault();
    stopHold();
  }
});

function showEnding(key) {
  const data = ENDINGS[key];
  if (!data || !endingScreen) return;
  ui.ending = key;
  $('[data-ending-eyebrow]').textContent = data.label;
  $('[data-ending-title]').textContent = data.title;
  $('[data-ending-body]').textContent = data.body;
  const ledger = $('[data-ending-ledger]');
  ledger.textContent = '';
  data.ledger.forEach(([k, v], i) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', String(i));
    const b = document.createElement('b');
    b.textContent = k;
    const span = document.createElement('span');
    span.textContent = v;
    li.append(b, span);
    ledger.appendChild(li);
  });
  $('[data-ending-echo]').textContent = data.echo;

  document.body.dataset.ending = key;
  document.body.classList.add('is-ending');
  setEnding(key);
  endingScreen.hidden = false;
  document.getElementById('story')?.setAttribute('inert', '');
  document.querySelector('.colophon')?.setAttribute('inert', '');
  $('[data-ending-title]').focus({ preventScroll: true });
  window.dispatchEvent(new CustomEvent('story:ending', { detail: { ending: key } }));
}

/* ── restart / replay ──────────────────────────────────────────────── */

function restart() {
  reset();
  setEnding('none');
  document.body.dataset.ending = '';
  // a clean load is the honest reset: no half-restored scroll state, no stale intro
  window.location.replace(`${window.location.pathname}${window.location.search}`);
}

$('[data-restart]')?.addEventListener('click', restart);
$('[data-replay]')?.addEventListener('click', restart);

/* ── ECHO strip ────────────────────────────────────────────────────── */

function say(text, hold = 6200, opts = {}) {
  // while ECHO's ghost beat is running, it owns the strip: a stale chapter
  // event must not overwrite it mid-typing
  if (ghost.stage === 'typing' || ghost.stage === 'withheld') return;
  if (!echoStrip || !echoLineEl) return;
  echoLineEl.textContent = text;
  echoStrip.classList.add('is-live');
  echoStrip.classList.remove('is-typing', 'is-withheld');
  const lie = Boolean(opts.lie);
  echoLineEl.classList.toggle('is-corrupt', lie);
  if (lie) echoLineEl.setAttribute('data-ghost', ghostText(text));
  else echoLineEl.removeAttribute('data-ghost');
  clearTimeout(ui.echoTimer);
  ui.echoTimer = window.setTimeout(() => echoStrip.classList.remove('is-live'), hold);
}

/* ECHO's own glyphs, swapped in a decorative layer. The readable text is untouched. */
function ghostText(text) {
  return [...text].map((c, i) => (i === 11 || i === 26 ? (i % 2 ? '#' : '@') : c)).join('');
}

const ghost = { played: false, stage: 'idle' };

function ghostSequence() {
  if (!echoStrip || !echoLineEl || ghost.played) return;
  ghost.played = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  echoStrip.classList.add('is-live');
  echoStrip.classList.remove('is-withheld');
  echoLineEl.classList.remove('is-corrupt');
  echoLineEl.removeAttribute('data-ghost');
  clearTimeout(ui.echoTimer);

  if (!reduced) {
    echoStrip.classList.add('is-typing');
    echoLineEl.textContent = '';
    const dots = document.createElement('span');
    dots.className = 'echo__dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
    echoLineEl.appendChild(dots);
    ghost.stage = 'typing';
    ui.ghost = 'typing';
  }

  ui.echoTimer = window.setTimeout(() => {
    echoStrip.classList.remove('is-typing');
    echoStrip.classList.add('is-withheld');
    echoLineEl.textContent = '[signal withheld]';
    echoLineEl.classList.add('is-corrupt');
    echoLineEl.setAttribute('data-ghost', '[s!gn@l w#thheld]');
    ghost.stage = 'withheld';
    ui.ghost = 'withheld';
    ui.echoTimer = window.setTimeout(() => {
      echoStrip.classList.remove('is-live');
      ghost.stage = 'done';
      ui.ghost = 'done';
    }, 7000);
  }, reduced ? 400 : 2400);
}

/* ── cursor ring (fine pointers only, native cursor untouched) ─────── */

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let ring = null;

function enableCursor() {
  if (!finePointer.matches || ring) return;
  ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ring);

  let x = -100;
  let y = -100;
  let rx = -100;
  let ry = -100;
  let frame = 0;
  let running = false;

  const loop = () => {
    rx += (x - rx) * 0.22;
    ry += (y - ry) * 0.22;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    if (Math.abs(x - rx) > 0.3 || Math.abs(y - ry) > 0.3) {
      frame = requestAnimationFrame(loop);
    } else {
      running = false;
    }
  };

  const onMove = (event) => {
    x = event.clientX;
    y = event.clientY;
    ring.classList.add('is-on');
    if (!running) { running = true; frame = requestAnimationFrame(loop); }
  };
  const onOver = (event) => {
    const hot = event.target.closest('a, button, [role="button"], dialog, .fragment__btn');
    ring.classList.toggle('is-hot', Boolean(hot));
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
}

/* ── wiring that depends on scroll/story events ────────────────────── */

window.addEventListener('story:change', () => {
  syncEvidenceUi();
  const chosen = snapshot().choice;
  if (chosen) syncChoice();
});

window.addEventListener('scroll:chapter', (event) => {
  const chapter = event.detail.chapter;
  if (chapter === 4) {
    // one voice owns this beat: no later chapter event may overwrite the ghost
    if (!ghost.played) ghostSequence();
    else if (ghost.stage === 'done') say(echoLine(4), 6200, { lie: !proven() });
  } else {
    // leaving the beat ends it: the next chapter owns the strip again
    if (ghost.played && ghost.stage !== 'done') {
      ghost.stage = 'done';
      ui.ghost = 'done';
      clearTimeout(ui.echoTimer);
      echoStrip?.classList.remove('is-typing', 'is-withheld');
    }
    say(echoLine(chapter));
  }
  if (chapter === 3 && photo && !photo.classList.contains('is-flipped')) {
    // the photograph turns at its story beat, and can be turned back by hand
    const scene = document.getElementById('ch3');
    if (scene && !autoFlipped && Number(scene.dataset.progress) > 0.6) setPhoto(true, true);
  }
});

// the photo beat also fires while scrolling inside an already-active chapter
window.addEventListener('__oblivion:progress', (event) => {
  const { chapter, p } = event.detail;
  if (chapter === 3 && !autoFlipped && p > 0.62) setPhoto(true, true);
});

export function initUi() {
  syncEvidenceUi();
  syncChoice();
  enableCursor();
  ui.ghost = ghost.stage;
  const s = snapshot();
  if (s.ending) {
    // returning to a tab that already finished: show where the story stopped
    document.body.dataset.ending = s.ending;
    setEnding(s.ending);
  }
  if (s.ending) {
    const resume = document.querySelector('[data-commit-preview]');
    if (resume) resume.textContent = `Ending already chosen: ${ENDINGS[s.ending].title}. Replay to begin again.`;
  }
  return ui;
}

export { openEvidence, openJournal, showEnding, restart, say };
