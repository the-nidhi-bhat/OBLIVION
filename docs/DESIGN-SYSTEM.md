# Design system

OBLIVION's visual language is an archive terminal that has been left running too
long: near-black surfaces, memory-white type, blood-crimson signals, and one
recovered-gold accent used sparingly for what has been proven.

All values below exist in `assets/css/main.css` unless marked *upgrade.css*
(`assets/css/upgrade.css`, loaded second).

---

## 1. Colour

| Token | Value | Role |
|---|---|---|
| `--void` | `#04050a` | Page, deepest surface |
| `--ink` | `#f4f1ea` | Primary type, memory-white |
| `--ink-2` | `#d6d0c6` | Body copy, supporting text |
| `--ink-3` | `#aaa49b` | Metadata, captions, disabled |
| `--crimson` | `#e0243a` | Signal, errors, corruption, active state |
| `--crimson-hot` | `#ff4155` | Hover/focus signal, fringe peak |
| `--crimson-deep` | `#7d0f1d` | Deep accent, gradients, shadows |
| `--chrome-a` / `--chrome-b` | `#cfd6df` / `#7e8794` | Metallic dividers, inactive chrome |
| `--line` | `rgba(244,241,234,.14)` | Hairlines and borders |
| `--line-soft` | `rgba(244,241,234,.07)` | Secondary separators |
| `--tint` | `224,36,58` | RGB triplet for tinted overlays |

Rules:

- Crimson is a **signal**, not decoration. It marks active state, corruption,
  the impossible timestamp and destructive commitment.
- Gold (recovered/proven) appears only on resolved evidence; it is never used
  for body text or chrome.
- Body copy never drops below `--ink-2` on `--void`.
- Out-of-window journal rows dim to **0.62 opacity** (not lower) so the row
  stays readable while clearly outside the range.

`@media (prefers-contrast: more)` lifts `--ink-3`/`--ink-4` and strengthens
`--line` in the base sheet.

---

## 2. Typography

| Family | Token | Use |
|---|---|---|
| System sans | `--sans` (`Segoe UI`, system-ui, Helvetica, Arial) | Interface, body, ledes |
| Serif | `--serif` (Georgia, Times) | Intimate passages, record bodies, journal echo |
| Monospace | `--mono` (ui-monospace, Cascadia Mono, SF Mono, Consolas) | HUD, dates, stamps, technical voice, corruption |

No webfonts are loaded. Font stacks are system-first, so the text renders
immediately and works offline.

**Scale (fluid, `clamp()`):**

| Role | Size |
|---|---|
| Display / chapter titles | `clamp(2.2rem, 7vw, 5.6rem)` |
| Split headlines | `clamp(1.9rem, 7.2vw, 5.4rem)` mono variant |
| Serif display | `clamp(1.8rem, 4.5vw, 3.6rem)` |
| Lede serif | `clamp(1.02rem, 1.3vw, 1.2rem)` / 1.68 |
| Lede mono | `clamp(.82rem, 1.05vw, .94rem)` / 1.7 |
| Body | `0.95rem` / 1.5–1.66 |
| Metadata | `0.62–0.74rem` mono, uppercase, letter-spaced |
| HUD | `0.66–0.72rem` mono, `0.16em` tracking |

**Voice pairing:** serif for what a person felt; mono for what the archive
recorded; sans for what the interface says. Mixing the three is meaningful, not
decorative.

---

## 3. Layout

- `--hud-h: 68px` fixed HUD; `--stage-max: 1440px`; `--pad-x:
  clamp(1.15rem, 4vw, 5rem)`.
- Chapters 1–5 are **pinned stages** on wide screens: the section is taller than
  the viewport and progress is measured from its own scroll span. Chapter 6 is
  never pinned.
- The grid is intentionally asymmetric: text columns cap at 34–40 ch; visuals
  take the remaining field.
- Vertical rhythm uses a 4 px base; section spacing is `clamp(4rem, 10vh, 9rem)`.

**Breakpoints**

| Width | Behaviour |
|---|---|
| ≤1180 | Tighter grid, HUD compresses |
| ≤960 | Single-column compositions, reduced offsets |
| ≤780 | Pinning dropped, scene words hidden, ECHO beat re-shown as text |
| ≤560 | Phone type scale, stacked controls, journal becomes a list |
| ≤420 | Minimal padding, shortened metadata, one-column ledger |

Coarse pointers and `(hover: none)` remove the custom cursor ring entirely.

---

## 4. Motion

| Motion | Source | Duration / threshold |
|---|---|---|
| Scroll-driven transforms | `scroll.js` progress → CSS `--p` | per frame |
| ECHO typing → withheld | `ui.js` | 2,400 ms typing; 400 ms under reduced motion |
| Velocity fringe | `system.js` | > 0.9 px/ms, cleared after 240 ms |
| Impossible timestamp | `system.js` | appears at ch1 p ≥ 0.88, holds 1,800 ms, reverts |
| Hold to commit | `ui.js` | 1,500 ms; fill via `--hold` |
| Dialog open/close | CSS | 180–260 ms, `--ease` |
| Ending reveal | CSS | staggered rows via `--i` |

**Easing:** `--ease: cubic-bezier(.22,1,.36,1)` for entrances and releases;
`--ease-in: cubic-bezier(.6,0,.85,.35)` for exits and collapses.

**Rules**

1. One owner per animated property. CSS transitions own hover/focus; the
   renderer owns the canvas; no JS writes the same value CSS animates.
2. Scroll velocity is measured, never assumed; the fringe is capped and clears.
3. Motion must have a static equivalent: every reveal has a readable end state.
4. Under `prefers-reduced-motion: reduce`: no pinning, no scrubbed transforms,
   no typing, no fringe, no long animations; the withheld line appears
   immediately and the story remains fully playable.
5. Nothing loops forever except the clock tick (1 s) and the renderer.

---

## 5. Components

### HUD
Fixed bar: chapter cell, session clock, archive clock, evidence count, FPS cell,
and two buttons (Evidence, Replay). The archive clock is the fiction; the
session clock is real. The only live-region text here is the boot announcement —
the clocks do not announce every tick.

### Scene word
One oversized word per chapter, set behind the composition. Hidden ≤780 px
because it would collide with the text column. Decorative and `aria-hidden`.

### Memory control
Dated, tagged button with a state line (`inspect` → `recovered`). Focus ring is
crimson; recovered state adds the gold accent and `data-recovered="true"`.

### Evidence dialog
Native `<dialog>`: title, dated stamp, body, an "implication" note in mono, and
close. Focus returns to the opener.

### Journal
List of recovered records with state badges:

- `discovered` — recovered but not opened;
- `inspected` — opened in the reading panel;
- `connected` — part of an authored contradiction.

Compare toggle switches rows into multi-select (`aria-pressed` only in compare
mode). The comparison panel shows the two records, the contradiction text, or
`NO THREAD`.

### Scrubber
Range input 0–96 (months from 2189-01 to 2197-01). Keyboard operability:
arrows, Home/End. `aria-valuetext` carries the date. Rows outside the window are
dimmed and marked `data-in-window="false"`; rows before ECHO's first write carry
`data-predates="true"`.

### Hold control
Progress fill driven by `--hold` (0–1). States: idle, holding
(`data-holding="true"`), committed. Cancellation: pointer release, pointer
leave, blur, Escape. A described single-press alternative sits beside it.

### Ending
Full-screen dialog: label, title, body, four-row ledger, ECHO's last line, and
two actions (revisit evidence, restart). Each ending has its own treatment class
on `body[data-ending]`.

---

## 6. Interaction states

Every interactive element defines: default, hover, focus-visible, active,
disabled/committed. Focus is always visible and never removed without an
equivalent. Disabled is used only where the action is genuinely unavailable
(e.g. compare needs two records); otherwise the control explains itself.

---

## 7. Accessibility patterns

- Semantic landmarks, one `h1`, ordered headings; skip link first in tab order.
- Dialogs are native `<dialog>` or `role="dialog" aria-modal="true"` with
  `inert` background.
- Custom cursor is decorative and disabled for coarse pointers and reduced
  motion; it never replaces the native cursor ring.
- Text over the canvas sits on tinted surfaces with measured contrast; the
  canvas itself is not used behind small text.
- Status changes that matter (boot, ending) use live regions; ticking values do
  not.
- Touch targets aim for 44 px; two controls (journal rows at 34 px, seam at
  24 px) are currently below that and are documented as a limitation.

---

## 8. Do / don't

**Do**

- use crimson for one meaning at a time;
- let the serif carry feeling and the mono carry record;
- keep one decorative idea per chapter;
- test at 320, 390, 768, 1024 and 1440;
- provide a reduced-motion branch for every new animation.

**Don't**

- add gradients, glows or glass panels as decoration;
- reuse gold as a generic accent;
- animate a property two systems already own;
- hide content on mobile without an equivalent;
- introduce a webfont or icon set for a handful of glyphs.
