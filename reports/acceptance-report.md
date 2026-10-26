# OBLIVION — v4 acceptance report

Generated against the isolated v3 working copy:
`C:\Users\theni\godmode-uiux-acceptance-test-oblivion-v3-20261025-190042`

Live now: **http://127.0.0.1:4190/** (local static server, bound to 127.0.0.1).
Stop it with:

```powershell
Stop-Process -Id (Get-Content reports\server.pid)
```

The earlier working copy (`...-oblivion-v2-20261025-201500`, 110/110) is untouched.
The brief's named folder `C:\Users\theni\godmode-uiux-acceptance-test` holds an
older FORM/FUTURE build, not this story; it was not modified.

---

## Result

```
checks 156 | PASS 156 | FAIL 0 | NOT TESTED 0
```

- Browser: Chromium 153.0.8010.12 via Playwright Python, headless with
  `--enable-gpu --ignore-gpu-blocklist --use-angle=d3d11`.
- Viewports measured: 320×780, 390×844, 768×1024, 1024×768, 1440×900.
- Layout shift: **0.0176** (control probe 0.2083), well inside the 0.1 budget.
- DPR: device 3 → renderer caps at **2** (canvas 780 px at 390×844).
- Frame rate this run: **47 fps measured** (44 frames in one second) on Intel
  UHD via ANGLE/D3D11. This is one sample; earlier runs measured 35 and 55 fps
  on the same flags.
- Evidence: `reports/results.json`, 53 screenshots in `reports/screens/`
  (17.2 MB), including `v3-ghost`, `v3-journal`, `v3-seam`, `v3-hold-ending`,
  `v4-sound-on`, `v4-ending-rewrite`.

The harness now has 156 checks: the original 95, the v2 additions, the v3
instrumentation and ending work, and 17 v4 checks covering generated audio,
the discovery cue and haptic, reticle/touch/reduced-motion behaviour, the
resolve reveal, the fracture cut, the return-visit line, and all three ending
treatments. Every ending is exercised through real clicks, pointer-holds and
key presses.

---

## What v3 adds

**1. Archive instrumentation (HUD)**
- A real session clock (`mm:ss`) beside a fictional archive record clock
  (`09Y 000D`), labelled so the fiction is explicit.
- One impossible timestamp (`09Y 000D 00:00:11`) appears once, at the chapter-1
  beat that names the eleven seconds, holds 1.8 s, reverts, and never repeats.
- Screen-reader-only meta line describes the signals; the clocks do not spam a
  live region.

**2. Cinematic scroll**
- One embedded word per chapter, composed into the plate and hidden ≤780 px.
- City windows watch the cursor only within 130 px, fine pointers only.
- A brief edge fringe at high scroll velocity (>0.9 px/ms), cleared after
  240 ms, absent under reduced motion and at endings.

**3. Narrative detail**
- ECHO's first chapter-4 entry: three dots, then `[signal withheld]`.
- The lie corrupts on screen (slice clip, nudge, decorative glyph layer with
  `aria-hidden` text untouched) and cleans when f4 + f5 are both recovered;
  the resolved note appears with the cleanup. One corruption grammar only.

**4. Memory investigation**
- Journal states: discovered → inspected → connected, with badges.
- Compare mode: exactly two records, keyboard operable, authored contradictions
  (`f1|f5`, `f4|f5`) drawn as a thread; records that agree return `NO THREAD`.
- Archive scrubber: 2189-01 → 2197-01, keyboard-operable, narrows records by
  date and marks what predates ECHO's first write (2189-06-02).
- Links and the seam persist with the rest of the tab's session state.

**5. Art direction**
- Layered upgrade stylesheet (`assets/css/upgrade.css`) loaded after the base:
  clocks, journal density, comparison panel, scrubber, corruption, ending
  chrome. Reduced-motion overrides for every new animation.

**6. Cursor / tactile / sound**
- Hold-to-confirm: 1.5 s pointer or Enter/Space, cancellable by release,
  pointer-leave, blur or Escape, with a progress fill and a described
  single-press alternative.
- Sound was **not added**: the brief forbids downloads and there is no audio
  asset in the project. Nothing is stubbed or faked.

**7. Endings**
- Endings hide HUD, ECHO and colophon, restore offsets, dim the world, index
  the ledger rows (staggered), and keep the authored per-ending treatments
  (restore drift, erase rows, rewrite grid).

`window.__oblivion.version` is now **3**; the public API and the harness use
the same surfaces a visitor does.

## Files changed in v3

- `index.html` — clocks, scene words, watches, seam, lie/resolved note, hold
  control and alternative, journal comparison + scrubber markup.
- `assets/css/upgrade.css` — new layer (loaded second).
- `assets/js/story.js` — stamps, SEAM record, contradictions, v3 session state
  (`oblivion.v3.session`), link persistence, journal states, proof.
- `assets/js/system.js` — new: clocks, anomaly, corruption level, velocity,
  watching windows.
- `assets/js/ui.js` — evidence/journal integration, ghost beat, lie
  corruption, compare/scrub, hold engine, seam, ending chrome details.
- `assets/js/main.js` — system import, version 3, state surface.
- `tools/qa.py` — extended check set, hold helpers, three ending clicks moved to the
  documented single-press alternative (the hold itself is tested separately).

## Defects found by this acceptance run and fixed

1. **Ghost beat overwritten.** A second chapter event arriving while ECHO was
   typing replaced the dots with a normal line. Fixed in `ui.js`: while the
   ghost beat is typing/withheld it owns the strip, and leaving chapter 4 ends
   the beat so the next chapter speaks.
2. **Drawn threads lost on reload.** `links` were stored as `"f1|f5"` strings
   but `read()` expected pairs, so comparison history vanished on reload.
   Fixed in `story.js` to accept both shapes and re-sanitise ids.
3. Harness corrections (not product bugs): anomaly scroll target, ghost timing
   wait, instant-velocity scroll, journal state expectations, corruption count,
   and the visibility transition on the ending chrome.
4. **Ghost beat invisible on phones.** The base sheet hides ECHO ≤780 px and
   only the reduced-motion override re-showed it. Fixed in `upgrade.css`: the
   typing/withheld states re-appear under 780 px; a 390 px check now proves it.
5. **Ending was not a modal, and "revisit the evidence" stranded the visitor.**
   The ending now carries `role="dialog" aria-modal="true"`, makes `#story` and
   the colophon inert, keeps the ending underneath the journal, and returns
   focus to the review control. Three focus-containment checks added.
6. **Photo control had no accessible name.** Added
   `aria-label="Turn over the photograph"`; the caption stays as a description.
7. **Out-of-window journal rows were dimmed to ~2:1 contrast.** Raised the
   dimming to 0.62 opacity (still visibly out of range).
8. **Prototype-key storage crash.** Session values are now validated with
   `Object.hasOwn` so inherited names cannot reach the renderer.
9. **Corruption check raced the scroll engine.** The test sampled after a
   chapter event that had not settled; it now waits for the dominant chapter
   and asserts the sampled chapter. Product behaviour was correct.

## What v4 adds

**1. A room tone that is off until asked**
- `assets/js/audio.js` builds the drone and cues with the Web Audio API from
  three detuned sines through a lowpass, so there is no audio asset, network
  request or autoplay. The context is not constructed until the visitor presses
  the HUD switch.
- The drone drops two semitones per chapter. A discovery plays one short gold
  chime. Erase fades the tone and suspends the context; restore and rewrite
  open it up.
- The switch reports `aria-pressed` and a visible `on`/`off` state.

**2. The archive reticle**
- A 3 px centre pip joins the existing ring, and the pointer casts a restrained
  gold wash over the HUD, journal and evidence panels.
- Approaching corrupted text stutters the reticle for 220 ms. The reticle is
  hidden entirely for touch pointers and under reduced motion. No magnetic
  pull: controls never move away from the pointer.

**3. Text that resolves**
- Clean ECHO lines resolve from blur and wide tracking into readable type over
  0.56 s. Deceptive lines never resolve; they keep the corruption grammar.
- The words themselves are never scrambled, so screen readers and copy/paste
  see the final sentence immediately.

**4. One fracture cut**
- Crossing from the room into the revelation (and back out) sweeps a single
  crimson cut line across the frame for 0.86 s, then leaves. It is skipped
  under reduced motion.

**5. A returning visitor**
- `oblivion.v3.visit` records that this tab has been here before, separate from
  story progress. Chapter 1 then opens with
  `ECHO: You came back. The archive did not expect that.` — and only when the
  archive has actually seen the visitor.

**6. Discovery feedback and ending treatments**
- First recovery of a record dispatches `story:discovery` and a guarded
  12 ms `navigator.vibrate`. Re-opening a held record repeats neither.
- Restore settles into place imperfectly; erase animates the ledger out row by
  row; rewrite rebuilds its panel through a stepped clip. All three are motion-
  gated and all three queue their audio cue even with sound off.

## Files changed in v4

- `assets/js/audio.js` (new), `assets/js/main.js` (import), `assets/js/ui.js`
  (reticle, resolve, cut, discovery event, return line, treatments),
  `assets/js/story.js` (`markVisit`), `index.html` (switch, seam-cut layer,
  copy), `assets/css/upgrade.css` (switch, pip, illumination, stutter, resolve,
  cut, treatments), `tools/qa.py` (17 checks).

## Defects found by this acceptance run and fixed

10. **The return-visit line could never fire.** `initScroll()` runs before
    `initUi()`, and the scroll engine emits its first chapter event during
    that call, so the chapter-1 handler read the visit flag before it was set.
    The flag is now captured at module load, before any chapter event.
11. **The ending-treatment test dropped `is-erasing`.** A test-only class
    filter (`is-r…`) hid the erase class. Product behaviour was correct;
    the assertion now keeps every `is-` class and still requires all three
    treatments.

## Not tested (and not claimed)

- **No animation libraries** are installed or used (GSAP, ScrollTrigger, Three,
  Lenis, Framer Motion, Anime.js). Anything depending on them is out of scope;
  installs were forbidden.
- **No visual review of screenshots.** The agent has no image input. Aesthetic
  claims rest on measured geometry, contrast, copy and state — not on looking
  at the PNGs.
- **Audio** is generated with the Web Audio API, not sampled. Headphones on a
  real device were not used for listening tests; the harness asserts the graph
  exists, the switch works and no autoplay occurs, not that the mix sounds
  good. Erase silence is 1.8 s of fade plus a suspended context, not a
  three-second mastered silence.
- **Haptics** are dispatched through `navigator.vibrate`, which desktop
  Chromium ignores; no phone hardware was available to feel the pulse.
- **No magnetic cursor.** The reticle expands and lights panels but never pulls
  the target toward the pointer, because that makes small controls harder to
  hit.
- Firefox and WebKit; axe/Lighthouse; real screen readers; forced-colors;
  200% zoom; landscape phones; INP/LCP; real phone GPUs — all NOT TESTED.
- The reported 47 fps is one 1-second sample in this environment, not a
  performance guarantee.

## Reproduce

```powershell
cd "C:\Users\theni\godmode-uiux-acceptance-test-oblivion-v3-20261025-190042"
python tools\qa.py
```

The harness serves the folder on port 4190 if nothing is listening, runs, and
writes `reports/results.json` plus screenshots.
