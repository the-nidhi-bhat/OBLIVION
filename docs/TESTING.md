# Testing

The acceptance harness is a single Playwright script: `tools/qa.py`. It serves
nothing itself — start the static server first — and it drives the real page in
Chromium, with real clicks, pointer holds, keyboard holds, reloads, reduced
motion and WebGL disabled.

---

## Run it

```powershell
# terminal 1, repository root
python -m http.server 4190 --bind 127.0.0.1

# terminal 2, repository root
python tools\qa.py
```

Requirements: Python 3.8+, Playwright for Python, and its Chromium build.

```powershell
python -m pip install playwright
python -m playwright install chromium
```

These are test-time tools. The application itself has no dependency on them.

Outputs:

- console: one line per check plus a summary;
- `reports/results.json`: machine-readable evidence (checks, viewports,
  screenshots with hashes, CLS, DPR, frame count, limitations);
- `reports/screens/*.png`: regenerated on every run (not committed; curated
  copies live in `docs/screenshots/`).

Exit status is non-zero when any check fails or is not tested.

---

## Latest run

```
checks 139 | PASS 139 | FAIL 0 | NOT TESTED 0
```

- 26 October 2026, Chromium 153.0.8010.12 (Playwright Python), headless,
  `--enable-gpu --ignore-gpu-blocklist --use-angle=d3d11`.
- CLS **0.0176** (positive control 0.2083, budget 0.1).
- DPR device 3 → capped at 2 (780 px canvas at 390 CSS px).
- Frame rate sample: **35 fps** (single 1-second count on Intel UHD via
  ANGLE/D3D11).
- 51 screenshots captured; no console errors, page errors, failed requests or
  4xx/5xx in any pass.

The previous build (v2) passed 110 checks; the v3 additions are listed below.

---

## What is covered (139 checks)

| Group | Count | What it proves |
|---|---|---|
| delivery | 4 | Server responds; boot overlay announces, holds, completes and can be skipped |
| story | 6 | Six chapters exist in order, each with heading/name; desktop pinning |
| mobile-320 | 10 | No overflow; accessible names; skip link; focus rings; heading order; contrast; pinning dropped; no console errors; WebGL draws |
| mobile-390 | 10 | Same contract at 390 px |
| tablet-768 | 10 | Same contract at 768 px |
| laptop-1024 | 10 | Same contract, wide layout keeps pinning |
| desktop-1440 | 10 | Same contract at 1440 px |
| ch1…ch6 | 12 | Per-chapter progress tracking and the chapter's own visual transitions (split headline, depth, transcript, fold, core, choice) |
| reverse | 1 | Scrolling up reverses state instead of sticking |
| nav | 3 | Rail links reach their chapter; rail marks the actual chapter; focus moves into the chapter |
| evidence | 4 | Fragment dialog content, count update, recovered state, no duplicates |
| journal | 2 | Journal lists recovered memories; ECHO's journal line tracks count |
| v3 | 19 | Clocks, one-time anomaly, velocity fringe, ghost beat and its error-free run, scene words, pointer-proximity windows, compare (contradiction + no-thread), scrubber (keyboard, window, predates), seam (uncounted, focus, persistence), corruption + proof cleanup, hold cancel/commit/keyboard/alternative |
| v3-mobile | 3 | HUD counters fit; withheld transmission visible; no console errors |
| ending-restore / erase / rewrite | 6 each | Title/body/ledger; world state; focus containment; review without losing the ending; focus return; restart clears and replays |
| endings | 1 | Three endings are substantially different outcomes |
| reduced | 8 | No decorative loop; no long animations; pinning and scrubbed transforms removed; all lines readable; smooth scroll off; withheld shown without typing and no fringe; a decision still works; no errors |
| no-webgl | 3 | Static fallback; the whole story, evidence and choice still work; no errors |
| keyboard | 2 | Skip link; journal open/close with focus return |
| metrics | 3 | CLS within budget (with a proven positive control); DPR capped; frame rate actually measured |

The harness also asserts zero entries in its console, page-error, failed-request
and 4xx/5xx buckets for every viewport pass.

---

## Not tested

These are stated as gaps, not as passes:

- **Firefox and WebKit.** Chromium only.
- **axe-core / Lighthouse.** No rule engine was available; contrast and names are
  computed directly.
- **Real screen readers** (NVDA, JAWS, VoiceOver, TalkBack).
- **forced-colors mode**, **200% zoom**, **landscape phones** (844×390).
- **INP, LCP**, real-device touch latency, phone GPUs.
- **Visual judgement.** Screenshots are captured but were not inspected by a
  vision model; composition claims rest on measured geometry, contrast and copy.
- **Animation libraries.** None are installed or used (GSAP, ScrollTrigger,
  Three.js, Lenis). Anything attributed to them is out of scope.
- **Audio.** The project ships no sound.

Additional limits of the harness itself:

- Contrast is computed from `getComputedStyle` over blended ancestors for the
  tested selectors only. It does not model the WebGL canvas behind large text.
- The frame-rate number is one 1-second sample.
- Accessible names are derived from roles/labels/`aria-label`, not from an
  accessibility tree snapshot.

---

## Flakiness notes

The only recurring source of instability has been **scroll settlement**, not
product behaviour:

- `goToScene()` uses smooth scrolling. A check that jumps between chapters must
  wait for the dominant chapter to become the target, not merely for a timeout.
  `await_chapter(page, n)` in `tools/qa.py` does exactly that and is the correct
  helper for any new cross-chapter assertion.
- Instant page jumps used only for measurement use `scroll_frac()` with
  `behavior: 'instant'`; do not mix the two styles in one flow.
- The ending's chrome uses a CSS visibility transition; checks wait 1,300 ms
  after the ending appears before asserting hidden HUD/ECHO.
- Velocity checks require an instant scroll burst; smooth scrolling cannot
  produce the threshold.

When a check fails, read `reports/results.json` for the captured detail object
before changing anything — the failure usually names the exact state.

---

## Adding a check

```python
record(
    "v3: what this proves",
    condition,          # bool
    detail,             # dict, printed and stored on failure
    "v3",               # viewport / group label
)
```

Guidelines:

- assert observable state (DOM, computed style, stored state, focus), not
  implementation details;
- prefer real interaction (click, key, pointer move) over calling internals;
- when timing matters, wait for a condition, never a fixed sleep longer than
  necessary;
- do not weaken an existing assertion to make a run green — fix the product or
  the setup;
- every new visual feature needs a reduced-motion assertion and, if it is
  interactive, a keyboard path assertion.

---

## Evidence policy

- `reports/results.json` is committed as the latest machine-readable run.
- `reports/acceptance-report.md` is the human summary.
- `reports/screens/` is regenerated locally; only the curated
  `docs/screenshots/` set is committed so the repository stays small and the
  README images always exist.
