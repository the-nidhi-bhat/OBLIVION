# Development

No build step, no package manager at runtime, no dependencies. The site is the repository.

## Requirements

| Purpose | Requirement |
|---|---|
| View the site | Any current browser with WebGL1 (Chromium/Firefox/Safari). Without WebGL the fallback layer is used. |
| Run the test harness | Python 3.10+ and the Playwright test-only install below. |
| Edit | Any editor. Files are UTF-8. |

There is nothing to install to *run* OBLIVION. Python is only needed for testing and docs tooling.

## Serve locally

The project must be served over HTTP — ES modules and `sessionStorage` do not behave correctly from `file://`.

```powershell
# Windows (PowerShell), from the repository root
python -m http.server 4190 --bind 127.0.0.1
```

```bash
# macOS / Linux
python3 -m http.server 4190 --bind 127.0.0.1
```

Open `http://127.0.0.1:4190/`. Stop with `Ctrl+C`.

The port is a convention used by the harness; any port works for manual viewing, but `tools/qa.py` expects `4190`.

## Test (dev-only dependency)

```powershell
python -m pip install playwright
python -m playwright install chromium
python tools\qa.py
```

The harness starts nothing by itself — keep the server running in another terminal. It writes `reports/results.json` and screenshots into `reports/screens/`. See [`TESTING.md`](TESTING.md) for check groups, known timing constraints, and how to add a check.

Current state: **156 checks, 156 pass, 0 fail, 0 not tested** (Chromium 153). Results are a snapshot of one machine; they are evidence, not a guarantee.

## Where things live

| You want to change | Edit |
|---|---|
| Narrative copy, fragments, contradictions, endings | `assets/js/story.js` |
| Chapter-to-chapter behaviour, ECHO dialogue, journal, evidence UI, hold control, ending screen | `assets/js/ui.js` |
| Scroll position, chapter events, progress | `assets/js/scroll.js` |
| WebGL scene, camera, palette, fallback | `assets/js/scene.js` |
| Intro sequence | `assets/js/intro.js` |
| Clocks, anomaly, corruption level, velocity fringe, watching windows | `assets/js/system.js` |
| Optional room tone, chapter tuning, discovery chime, ending cues | `assets/js/audio.js` |
| Wiring, public debug API, version | `assets/js/main.js` |
| Structure and section markup | `index.html` |
| Base visual system | `assets/css/main.css` |
| v3 layer (clocks, journal, hold, ending chrome, responsive/motion overrides) | `assets/css/upgrade.css` |
| Harness | `tools/qa.py` |

Load order matters: `upgrade.css` comes after `main.css` and is written to override it, not to be edited back into it.

## Debugging

Everything needed to inspect state is exposed on `window`:

```js
// Full state: evidence, seen, links, choice, ending, chapter, total, system, ui
__oblivion.state()

__oblivion.goToScene(4, false)   // second argument is `focus`, not scroll behaviour
__oblivion.openJournal()
__oblivion.choose("restore")     // stage a choice
__oblivion.confirm()             // commit it (returns the ending key)
__oblivion.showEnding("erase")
__oblivion.restart()             // clears the session and reloads
__oblivion.reset()               // clears session without reload

__system.clocks                  // { session, record }
__system.anomaly                 // one-time impossible timestamp state
__system.corruption              // 0–3, mirrored to --corrupt
__system.fast                    // velocity fringe flag
```

Counting on the console is normal: the renderer reports its own limits once, and the harness collects console errors.

`goToScene()` smooth-scrolls. If you script it, wait for `document.body.dataset.chapter` to change rather than sleeping — that is exactly the race that produced a false failure in the harness before `await_chapter()` was added.

## Conventions

- **No dependencies.** Add one only if the platform genuinely cannot do the job; the project's value is that it runs from source.
- **One owner per animated property.** Do not let CSS transitions and the rAF loop drive the same value; document which one owns it.
- **State is authored, validated, versioned.** Anything read from `sessionStorage` goes through `story.js`'s sanitiser and `Object.hasOwn` guards. Unknown keys are ignored, not trusted.
- **Text is text.** User- and story-facing strings are inserted with `textContent`, never HTML.
- **Motion is a preference, not a default.** New motion needs a `prefers-reduced-motion` path that still tells the story.
- **Accessibility is part of done.** Interactive elements need names, focus behaviour, keyboard operation, and visible focus. Dialogs use native `<dialog>`; the ending uses `aria-modal` + `inert` on the background.
- **The fallback is a first-class path.** No-WebGL must remain readable and completable.
- **Keep the harness honest.** A check may be tightened, never weakened to make a run green. If a check is wrong, fix the check and say so in the commit.

## Editing with the harness

1. Serve the site.
2. Change the smallest thing that proves the behaviour.
3. Add or adjust a check in `tools/qa.py` when the change is behavioural.
4. Run the full harness; compare against the previous `reports/results.json`.
5. Update `reports/acceptance-report.md` only with measured facts.

Screenshots in `reports/screens/` are local-only evidence and are ignored by Git. Curated images for documentation live in `docs/screenshots/` and are committed.

## Git workflow

The repository starts from a single finished build; there is no long history to preserve.

- Work on a branch, not directly on `main`, for anything beyond documentation.
- Commit messages use conventional prefixes: `feat:`, `fix:`, `test:`, `docs:`, `style:`, `chore:`.
- Never commit `reports/server.pid`, `reports/screens/`, `__pycache__/`, or `.env` files.
- Never commit credentials. Authentication is handled by the operator's Git credential helper or GitHub CLI.
- Do not force-push, rewrite published history, or deploy from a working branch.

## Pre-push checklist

```powershell
git status --short
git diff --check
node --check assets\js\ui.js; node --check assets\js\story.js; node --check assets\js\main.js
python -m py_compile tools\qa.py
python tools\qa.py            # server running, expect 156/156
git diff --cached            # read it
```

Then confirm the remote, branch, and author identity before pushing.

## Deployment (not performed here)

The site is static and root-relative. Any static host works: serve the repository root, no build command, no environment variables, no SPA rewrite required. `index.html` is the entry point and all assets resolve relative to it.

Do not add a build step or a framework adapter unless the architecture actually changes.
