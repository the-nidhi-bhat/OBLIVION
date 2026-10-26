# Changelog

OBLIVION was built and verified over three passes before publication. Because the repository was created at the end of that work, this file records the passes rather than pretending they were separate public releases.

Dates are the working dates of the acceptance copies.

## Unreleased — publication preparation (2026-10-26)

### Added
- 16 curated screenshots in `docs/screenshots/` (desktop chapters, withheld signal, recovered memory, journal, hold control, three endings, 390 px mobile, no-WebGL fallback).
- `README.md`, `docs/ARCHITECTURE.md`, `docs/STORY-BIBLE.md`, `docs/DESIGN-SYSTEM.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md`, this changelog.
- `.gitignore` covering local evidence, server PID, Python caches, OS files, editor folders, and `.env` files.

### Fixed (from independent review)
- The ECHO ghost beat was invisible on phones because the base stylesheet hides `.echo` at ≤780 px; the typing and withheld states are now re-shown at that width, with a mobile harness check.
- The ending screen behaved like a banner, not a mode: it is now `role="dialog"` / `aria-modal="true"`, the story and colophon become `inert`, focus stays inside, and focus returns to the review button when the journal closes.
- "Revisit the evidence" closed the ending and stranded the visitor; the ending now remains underneath the journal.
- The photograph button had no accessible name; it now has one, with the caption kept as description.
- Out-of-window journal items were dimmed to roughly 2:1 contrast while still interactive; opacity raised to `.62`.
- Tampered session storage could pass prototype keys (`constructor`) into the UI; all fragment and ending lookups use `Object.hasOwn`.
- The corruption check could sample chapter 5 after a smooth-scroll race; the harness now waits for the dominant chapter and asserts it.

### Changed
- Acceptance run: 139 checks, 139 pass, 0 fail, 0 not tested.

## v3 — the investigation layer (2026-10-26)

### Added
- HUD session clock beside a fictional archive clock, with one impossible timestamp (`09Y 000D 00:00:11`) that appears once and reverts.
- ECHO ghost typing that collapses into `[signal withheld]`.
- A single corruption grammar tied to chapter 4's lie, cleaned when fragments f4 and f5 are both recovered.
- Journal states (discovered / inspected / connected), two-record comparison, two authored contradictions, and a real no-thread outcome.
- Date scrubber, 2189-01 → 2197-01, marking records inside and outside the window.
- The Seam: an authored extra record that is not one of the five memories and does not count toward recovery.
- Hold-to-confirm (1.5 s, pointer and keyboard, cancellable by release, Escape, leave, or blur) with a documented single-press alternative.
- Scene words, pointer-proximity windows, scroll-velocity fringe.
- Ending chrome: HUD and ECHO withdraw, ledger rows arrive in sequence, and the ending screen indexes the choice.

### Fixed
- A late chapter event could overwrite the ghost typing beat.
- Comparison threads were lost on reload because stored link keys and the reader disagreed on format.
- The corruption beat could be overwritten when chapters changed during the reveal.

### Changed
- Acceptance run: 139 checks, 139 pass after the harness race was corrected.

## v2 — narrative and interaction (2026-10-25)

### Added
- Evidence recovery in any order, with persisted state and an evidence dialog.
- Journal with recovered dates, provenance notes, and connection hints.
- ECHO's interruption and the chapter 4 lie.
- Three endings with staged choice, ledger, restart, and replay.
- Reduced-motion mode and a no-WebGL fallback layer.
- Keyboard operation for the story, dialogs, and ending.

### Fixed
- Focus returns after dialogs.
- Ending chrome and body state remain consistent across replay.
- Harness corrections for smooth scrolling and transition timing.

### Changed
- Acceptance run: 110 checks, 110 pass.

## v1 — the story (2026-10-25)

### Added
- Six chapters from the city to the choice.
- Scroll-driven chapter progression with progress events.
- WebGL1 point-field scene with palette shifts per chapter.
- Five memory fragments, ECHO's voice, and the first ending flow.
- Responsive layout and reduced-motion handling.
- Playwright harness with screenshots and a JSON report.

### Changed
- Acceptance run: 95 checks, 95 pass.

## Notes

- Counts are from the acceptance harness on the machine that ran it (Chromium 153, Windows). They are evidence of that run, not a guarantee for other browsers or devices.
- Performance numbers in the reports are single samples and are labelled as such.
- No animation libraries, frameworks, trackers, or network calls exist in the project, by design.
