# Architecture

OBLIVION is a static document with seven ES modules, two stylesheets and a
canvas. There is no build step, no bundler, no framework and no runtime
dependency. This document describes how the pieces actually talk to each other.

---

## 1. Loading

```text
index.html
├─ assets/css/main.css        base design system, scene layout, responsive rules
├─ assets/css/upgrade.css     archive instrumentation layer (loaded second)
└─ assets/js/main.js          <script type="module">
   ├─ imports intro.js        boot sequence (side effects)
   ├─ imports system.js       clocks, anomaly, fringe, watches (side effects)
   ├─ imports audio.js        optional synthesised room tone (side effects)
   ├─ imports scene.js        WebGL1 renderer + setScroll/setEnding
   ├─ imports scroll.js       chapter/progress engine
   ├─ imports ui.js           evidence, journal, ECHO, hold, ending chrome
   ├─ imports story.js        records, contradictions, endings, session state
   └─ exposes window.__oblivion (debug + test surface)
```

All modules are native ES modules. Serving over HTTP is mandatory; `file://`
will not load them.

---

## 2. Responsibilities

| Module | Owns | Does not own |
|---|---|---|
| `index.html` | Markup, all authored copy outside `story.js`, ARIA structure | Behaviour |
| `main.js` | Wiring, renderer callback, public API, FPS counter | Any domain logic |
| `intro.js` | Boot overlay lifecycle, skip, release of the story | Story state |
| `scroll.js` | Chapter measurement, dominant chapter, progress, `scroll:chapter`, navigation, focus on jump | Visual composition |
| `scene.js` | WebGL1 context, shaders, geometry, per-chapter uniforms, fallback surface, DPR cap | DOM UI |
| `story.js` | Records, contradictions, ending copy, session snapshot, sanitisation, persistence | DOM, timing |
| `system.js` | Session/archive clocks, one-time anomaly, corruption level, scroll velocity, watch proximity | Story decisions |
| `audio.js` | Web Audio drone, per-chapter tuning, discovery chime, ending cues, consent toggle | Story decisions, DOM |
| `ui.js` | Evidence dialog, journal, compare, scrubber, ECHO strip, ghost beat, hold engine, seam, ending presentation | Renderer |

The split is deliberate: `story.js` is pure data plus storage, so the narrative
can be edited without touching presentation; `ui.js` is the only module that
mutates the story DOM.

---

## 3. Event flow

```text
scroll (rAF, on demand)
  └─ scroll.js #update()
       ├─ measures per-chapter visibility → dominant chapter, float progress
       ├─ scene.dataset.progress = p
       ├─ window.dispatchEvent('scroll:chapter', {chapter, name})   // on change only
       └─ window.__onScrollFrame(total, float, chapter)
            └─ main.js → scene.setScroll(...)
                       → window.dispatchEvent('__oblivion:progress', {chapter, p})

scroll:chapter
  └─ ui.js
       ├─ chapter 4 → ghost sequence or corrupted lie line
       ├─ other chapters → say(ECHO_LINES[chapter])
       ├─ chapter 3 → photograph auto-flip past its beat
       └─ navigation rail + HUD chapter cell updated by scroll.js itself

pointermove / scroll / resize
  └─ system.js → watch proximity, velocity fringe, corruption level

click / keydown on evidence, journal, compare, scrub, hold
  └─ ui.js → story.js (recover, markSeen, record, linkPair, setChoice, confirmEnding)
            → syncEvidenceUi() → DOM + body[data-proven] + inert states
```

Only `scroll:chapter` and `__oblivion:progress` cross module boundaries as DOM
events. Everything else is a direct import, which keeps the graph small.

---

## 4. Session state

Key: `oblivion.v3.session` (sessionStorage; tab-scoped, cleared with the tab).

```js
{
  evidence: string[],   // recovered fragment ids, in click order
  seen:     string[],   // inspected fragment ids
  links:    string[],   // "f1|f5" comparison pairs, language-independent
  choice:   'restore' | 'erase' | 'rewrite' | null,
  ending:   'restore' | 'erase' | 'rewrite' | null,
  egg:      boolean     // the seam has been found
}
```

`read()` treats storage as hostile input:

- unknown fragment ids are dropped (`Object.hasOwn`, not truthiness);
- unknown choices/endings are dropped;
- `links` accepts both `"a|b"` strings and `[a, b]` pairs, re-sorts and
  re-sanitises them;
- storage exceptions are caught and degrade to an empty state.

`window.__oblivion.state()` returns the snapshot plus derived values and the
live UI state (`ghost`, `hold`, `compare`, `ending`). The acceptance harness uses
exactly this surface, so tests read the same state a visitor produces.

---

## 5. Rendering

- One `WebGL1` context on `#world` (or equivalent canvas in the markup).
- Points, lines and simple instanced shapes only; approximately 19,200 points.
- Uniforms are driven per frame from `scene.js` state, which is set by
  `setScroll(total, chapterFloat)`.
- DPR is capped at 2; the backing store is resized on demand, not per frame.
- Rendering pauses when the document is hidden; no work is scheduled while
  `document.visibilityState !== 'visible'`.
- If context creation fails, `scene.js` raises the static fallback surface and
  stops trying; the DOM story remains fully operable (verified by the harness).

No textures, fonts, images or external shader files are loaded.

---

## 6. Presentation layering

1. `main.css` — tokens, reset, typography, HUD, scenes, dialogs, ending base,
   responsive breakpoints, reduced-motion overrides for base motion.
2. `upgrade.css` — archive instrumentation: clocks, scene words, watches, seam,
   corruption, fringe, journal density, compare panel, scrubber, hold fill,
   ending chrome, phone adjustments.
3. Reduced-motion overrides at the end of each layer, so they win without
   `!important`.

Rules of thumb:

- new visual work goes in `upgrade.css` unless it replaces a base primitive;
- state lives in `data-*` attributes on `body`, scenes or controls;
- no JS writes inline styles except the numerics that must animate per frame
  (`--p`, `--hold`, `--corrupt`, `--i`).

---

## 7. Focus and modality

- Evidence and journal are native `<dialog>` opened with `showModal()`; closing
  returns focus to the opener.
- The ending is a full-screen `role="dialog" aria-modal="true"` section. While it
  is visible, `#story` and `.colophon` are `inert`, and Tab stays inside the
  ending. "Revisit the evidence" opens the journal above the ending without
  destroying it.
- The hold control exposes progress with `--hold`, `data-holding`, and a
  described alternative (`[data-confirm-quick]`).

---

## 8. Failure behaviour

| Failure | Behaviour |
|---|---|
| WebGL unavailable | Static fallback; story, evidence, choice and endings still work |
| sessionStorage blocked | In-memory state for the tab; no crash |
| Corrupt storage payload | Sanitised to empty/known values |
| Reduced motion | No pinning, no scrubbed transforms, no typing, no fringe |
| Narrow viewport | Pinning dropped, scene words hidden, ECHO beat re-shown as text |
| JavaScript disabled | The document remains readable as a long-form story (no interaction) |

---

## 9. Extension points

- **Add a record:** add to `FRAGMENTS` in `story.js`, add markup to the evidence
  list, add an entry to `ORDER`, and (optionally) authored contradictions.
- **Add a chapter:** add a `<section class="scene" id="chN" data-scene="N">`
  with a heading and lede, add ECHO lines for `N`, and extend the renderer's
  chapter uniforms. The scroll engine discovers scenes by `data-scene`.
- **Add an ending:** add to `ENDINGS` with `label`, `title`, `body`, `ledger`,
  `echo`; add a choice button in chapter 6; `showEnding()` and the ledger
  renderer handle the rest.
- **Add a check:** use `record(name, ok, detail, viewport)` in `tools/qa.py`;
  the harness aggregates counts and writes `reports/results.json`.

Keep these invariants:

1. one writer per animated element;
2. chapter events are the only scroll signal UI listens to;
3. storage is untrusted input;
4. every new interactive control gets an accessible name and a keyboard path;
5. every new animation gets a reduced-motion branch.
## Audio path (v4)

`audio.js` is a side-effect module imported after `system.js`. It constructs
nothing until the visitor presses Sound, so no `AudioContext` exists on load and
nothing can autoplay. It listens for `scroll:chapter` (retunes the drone two
semitones darker per chapter), `story:discovery` (one chime per newly collected
record) and `story:ending` (restore warms the tone, erase fades and suspends the
context, rewrite retunes). The context is closed on `pagehide`.

There are no audio assets and no network requests: three sine oscillators feed a
lowpass filter and a master gain. `window.__audio` exposes the same state the
harness asserts (supported, constructed, enabled, context state, chapter, cue
counts, reduced-motion flag).
