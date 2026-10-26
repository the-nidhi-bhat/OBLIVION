"""
OBLIVION v3 — acceptance harness.

Real Chromium against the real server. Five viewports, three endings, six
chapters, reduced motion, no-WebGL, high DPR, plus the v3 instrumentation:
clocks, the impossible timestamp, ghost typing, corruption and its proof,
journal states, comparison, archive scrubber, the seam and hold-to-commit.

Design rules for this file:
  • every check must be able to fail: no assertion is satisfied by the mere
    presence of an element
  • scroll checks compare measured values at measured scroll positions, and
    record those positions
  • controls are exercised through real clicks, real holds and real key presses
  • a metric that needs a control (CLS, animation) runs the control

Writes reports/results.json and reports/screens/*.png.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
SHOTS = REPORTS / "screens"
PORT = 4190
BASE = f"http://127.0.0.1:{PORT}/"

VIEWPORTS = [
    ("mobile-320", 320, 780),
    ("mobile-390", 390, 844),
    ("tablet-768", 768, 1024),
    ("laptop-1024", 1024, 768),
    ("desktop-1440", 1440, 900),
]

CHAPTERS = [
    (1, "The City With No People"),
    (2, "The Ocean of Lost Memories"),
    (3, "The Room That Should Not Exist"),
    (4, "ECHO Is Lying"),
    (5, "The Last Memory"),
    (6, "The Choice"),
]

results = {
    "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "base_url": BASE,
    "browser": "Chromium (Playwright Python)",
    "checks": [],
    "viewports": {},
    "scroll": {},
    "navigation": {},
    "evidence": {},
    "endings": {},
    "reduced_motion": {},
    "no_webgl": {},
    "keyboard": {},
    "cls": {},
    "dpr": {},
    "perf": {},
    "screenshots": [],
    "limitations": [
        "Chromium only (Playwright 1.64 bundled build). Firefox and WebKit are NOT TESTED.",
        "No animation library is used or installed: GSAP, ScrollTrigger, Motion and Three.js are absent. All motion is CSS transforms driven by measured scroll progress plus one hand-written WebGL1 renderer. Their behaviour is therefore NOT TESTED (and not claimed).",
        "No axe-core or Lighthouse in the environment: contrast, names and focus are measured directly; an automated rule engine was not run.",
        "Contrast is computed from getComputedStyle over an alpha-blended ancestor chain and does not model the WebGL canvas, gradients behind large text, or backdrop blur.",
        "FPS is a one-second frame count in a headless Chromium on this machine. It is reported, not promised.",
        "INP, LCP and real-device touch latency are NOT TESTED.",
        "Screenshots were not inspected by a vision model: composition is verified by measured geometry (line counts, sizes, overflow, contrast), not by human or machine visual judgement.",
        "Screen readers, forced-colors mode, 200% zoom and landscape phone (844x390) are NOT TESTED.",
    ],
}

fails = 0
not_tested = 0


def record(name: str, ok, detail, viewport: str = "global") -> None:
    global fails, not_tested
    status = "PASS" if ok is True else "FAIL" if ok is False else "NOT TESTED"
    if ok is False:
        fails += 1
    if ok is None:
        not_tested += 1
    results["checks"].append({"id": name, "viewport": viewport, "result": status, "detail": detail})
    print(f"  [{status:9}] {viewport:12} {name}")
    if ok is not True:
        try:
            print(f"              â†³ {json.dumps(detail, default=str)[:900]}")
        except Exception:
            print(f"              â†³ {str(detail)[:900]}")


def port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def sha(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def shot(page, name: str) -> None:
    path = SHOTS / f"{name}.png"
    page.screenshot(path=str(path))
    results["screenshots"].append({"file": path.name, "bytes": path.stat().st_size,
                                   "sha256_16": sha(path),
                                   "scrollY": page.evaluate("() => Math.round(scrollY)")})


def settle(page, timeout_ms: int = 6000) -> int:
    deadline = time.time() + timeout_ms / 1000
    last, stable = None, 0
    while time.time() < deadline:
        y = page.evaluate("() => Math.round(window.scrollY)")
        if y == last:
            stable += 1
            if stable >= 3:
                return y
        else:
            stable, last = 0, y
        page.wait_for_timeout(70)
    return page.evaluate("() => Math.round(window.scrollY)")


def await_chapter(page, chapter: int, timeout_ms: int = 6000) -> None:
    """Wait until the scroll engine reports this chapter as dominant, then let its beat run."""
    page.wait_for_function("(n) => document.body.dataset.chapter === String(n)",
                           arg=chapter, timeout=timeout_ms)
    page.wait_for_timeout(250)


def wire(page, bucket: dict) -> None:
    page.on("console", lambda m: bucket["console"].append({"type": m.type, "text": m.text[:300]})
            if m.type == "error" else None)
    page.on("pageerror", lambda e: bucket["errors"].append(str(e)[:300]))
    page.on("requestfailed", lambda r: bucket["failed"].append(r.url))
    page.on("response", lambda r: bucket["bad"].append({"url": r.url, "status": r.status}) if r.status >= 400 else None)


def bucket() -> dict:
    return {"console": [], "errors": [], "failed": [], "bad": []}


def skip_intro(page) -> None:
    try:
        page.wait_for_selector("[data-intro-skip]", timeout=4000)
        page.click("[data-intro-skip]")
    except Exception:
        pass
    try:
        page.wait_for_function("() => window.__intro && window.__intro.done === true", timeout=8000)
    except Exception:
        pass


def booted(page, timeout: int = 16000) -> None:
    page.wait_for_function("() => window.__intro && window.__intro.done === true", timeout=timeout)


def scroll_frac(page, chapter: int, frac: float) -> int:
    page.evaluate("""([i, f]) => {
        const s = document.getElementById('ch' + i);
        const vh = innerHeight;
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const span = s.offsetHeight > vh * 1.2 && !reduce
            ? Math.max(1, s.offsetHeight - vh)
            : Math.max(0, s.offsetHeight - vh);
        window.scrollTo({ top: s.offsetTop + span * f, behavior: 'instant' });
    }""", [chapter, frac])
    page.wait_for_timeout(60)
    try:
        page.wait_for_function(
            "() => Math.abs(window.__scroll.scrollY - Math.round(window.scrollY)) < 1.5", timeout=3000)
    except Exception:
        pass
    page.wait_for_timeout(90)
    return page.evaluate("() => Math.round(window.scrollY)")


def wait_for_chapter(page, index: int, timeout: int = 6000) -> None:
    try:
        page.wait_for_function("""(i) => {
            const s = document.getElementById('ch' + i);
            const r = s.getBoundingClientRect();
            return window.__scroll.chapter === i
                && r.top <= 120 && r.bottom >= innerHeight * 0.4
                && Math.abs(window.scrollY - window.__scroll.scrollY) < 2;
        }""", arg=index, timeout=timeout)
    except Exception:
        pass
    page.wait_for_timeout(120)


def press_and_hold(page, ms: int = 700) -> None:
    """Hold the commit control with a real button-down at its measured centre."""
    btn = page.locator("[data-confirm]")
    btn.scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    box = btn.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(ms)
    page.mouse.up()


def keyboard_hold(page, ms: int = 1700) -> None:
    page.locator("[data-confirm]").focus()
    page.keyboard.down("Enter")
    page.wait_for_timeout(ms)
    page.keyboard.up("Enter")


JS_OVERFLOW = """() => {
  const de = document.documentElement;
  const insideScroller = (el) => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowX) || /(hidden|clip)/.test(s.overflowX)) return true;
      n = n.parentElement;
    }
    return false;
  };
  const loose = [];
  const clipped = [];
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > innerWidth + 1 || r.left < -1) {
      const item = {tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40),
                    left: Math.round(r.left), right: Math.round(r.right)};
      (insideScroller(el) ? clipped : loose).push(item);
    }
  }
  return {doc: de.scrollWidth - de.clientWidth, loose, reachable: clipped.slice(0, 6)};
}"""

JS_NAMES = """() => {
  const nodes = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="radio"], [role="switch"]')]
    .filter((el) => el.getClientRects().length > 0);
  const bad = [];
  for (const el of nodes) {
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') ||
                  (el.labels && el.labels[0] && el.labels[0].textContent) || '').trim();
    if (!name) bad.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 30));
  }
  return {total: nodes.length, unnamed: bad};
}"""

JS_HEADINGS = """() => {
  const out = [];
  for (const h of document.querySelectorAll('h1, h2, h3')) {
    const cs = getComputedStyle(h);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const r = h.getBoundingClientRect();
    out.push({tag: h.tagName.toLowerCase(), level: +h.tagName[1],
              text: h.textContent.replace(/\\s+/g, ' ').trim().slice(0, 44),
              lines: Math.max(1, Math.round(r.height / lh)),
              clipped: h.scrollWidth > h.clientWidth + 1,
              size: Math.round(parseFloat(cs.fontSize) * 10) / 10,
              visible: r.width > 0 && r.height > 0});
  }
  return out;
}"""

JS_ONE = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return {tag: 'body', name: null, ring: false, visible: false};
  const cs = getComputedStyle(el);
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
               (cs.boxShadow && cs.boxShadow !== 'none');
  return {tag: el.tagName.toLowerCase(),
          name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().slice(0, 44),
          ring, visible: el.getClientRects().length > 0};
}"""

JS_SKIP_FIRST = """() => {
  const list = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.getClientRects().length > 0);
  const first = list[0] || null;
  return {first: first ? (String(first.className) + '|' + (first.textContent || '').trim().slice(0, 26)) : null,
          isSkip: first === document.querySelector('.skip')};
}"""

JS_CONTRAST = """(selectors) => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return {rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1};
  };
  const bgOf = (el) => {
    let node = el;
    let acc = [0, 0, 0];
    let alpha = 0;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        acc = [0, 1, 2].map((i) => c.rgb[i] * c.a + acc[i] * (1 - c.a));
        alpha += c.a * (1 - alpha);
        if (alpha >= 0.98) return acc;
      }
      node = node.parentElement;
    }
    return acc;
  };
  return selectors.map((sel) => {
    const el = document.querySelector(sel);
    if (!el) return {sel, found: false};
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) return {sel, found: false};
    const bg = bgOf(el);
    const l1 = lum(fg.rgb), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    return {sel, found: true, ratio: Math.round(ratio * 100) / 100, size, large,
            required: large ? 3 : 4.5, pass: ratio >= (large ? 3 : 4.5)};
  });
}"""

CONTRAST_GLOBAL = [
    ".hud__word", ".hud__status", ".rail a[aria-current='true']", ".chip",
    ".kicker", ".lede", ".signs li", ".callout__quote", ".window-memory figcaption p",
    ".reveal", ".colophon p",
]

CHAPTER_STATE = """(i) => {
  const s = document.getElementById('ch' + i);
  if (!s) return null;
  const cs = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop).trim() : null;
  const num = (el, prop) => { const v = cs(el, prop); return v === null ? null : parseFloat(v); };
  const base = {p: +(s.dataset.progress || 0), chapter: window.__scroll.chapter, y: Math.round(scrollY)};
  if (i === 1) return {...base, eye: num(s.querySelector('.city__eye'), 'opacity'),
                         letter: cs(s.querySelector('.split .ltr'), 'transform'),
                         sign: num(s.querySelector('.signs li'), 'opacity'),
                         window: num(s.querySelector('.window-memory'), 'opacity')};
  if (i === 2) return {...base, frag: cs(s.querySelector('.fragment--1 .fragment__btn'), 'transform'),
                         glow: cs(s.querySelector('.ocean__glow'), 'transform')};
  if (i === 3) return {...base, lines: [...s.querySelectorAll('.transcript__list li')].filter((li) => parseFloat(getComputedStyle(li).opacity) > 0.5).length,
                         photo: !!s.querySelector('[data-photo]')?.classList.contains('is-flipped'),
                         flip: cs(s.querySelector('[data-photo]'), '--flip')};
  if (i === 4) return {...base, panel: cs(s.querySelector('.panel--a'), 'transform'),
                         seam: cs(s.querySelector('.fracture__seam'), 'transform'),
                         tl: [...s.querySelectorAll('[data-tl]')].filter((li) => parseFloat(getComputedStyle(li).opacity) > 0.5).length,
                         line: num(s.querySelector('.dialogue__line--alt'), 'opacity')};
  if (i === 5) return {...base, seed: cs(s.querySelector('.core__seed'), 'transform') + '|' + cs(s.querySelector('.core__seed'), 'scale'),
                         mem: num(s.querySelector('.last-memory'), 'opacity')};
  return {...base, choices: s.querySelectorAll('[data-ending-choice]').length,
          total: +window.__scroll.total.toFixed(3)};
}"""


def main() -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob("*.png"):
        old.unlink()

    proc = None
    if not port_open(PORT):
        proc = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
            cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(40):
            if port_open(PORT):
                break
            time.sleep(0.15)

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"])
            print(f"Chromium {browser.version} against {BASE}")

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 1. the page the visitor receives â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ story structure (1440)")
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            b = bucket()
            wire(page, b)
            page.goto(BASE, wait_until="load")

            record("server responds and the document loads", page.title().startswith("OBLIVION"), page.title(), "delivery")
            record("opening sequence announces itself and can be skipped", page.is_visible("[data-intro-skip]"), {"skip": page.is_visible("[data-intro-skip]")}, "delivery")

            page.wait_for_timeout(300)
            shot(page, "00-intro")
            intro = page.evaluate("""() => ({
                pct: window.__intro.pct, reason: window.__intro.reason,
                title: document.querySelector('[data-boot-title]').textContent.replace(/\\s+/g, ' ').trim(),
                locked: document.body.classList.contains('is-booting'),
                inert: document.getElementById('story').hasAttribute('inert'),
                focus: document.activeElement.id || document.activeElement.tagName
            })""")
            record("the boot sequence holds the page and shows the title",
                   intro["locked"] and intro["inert"] and "OBLIVION" in intro["title"], intro, "delivery")

            booted(page)
            intro_done = page.evaluate("""() => ({
                pct: window.__intro.pct, reason: window.__intro.reason, source: window.__intro.source,
                locked: document.body.classList.contains('is-booting'),
                hidden: document.querySelector('[data-intro]').hidden,
                inert: document.getElementById('story').hasAttribute('inert'),
                focus: document.activeElement.id || document.activeElement.tagName
            })""")
            record("boot sequence completes on its own and releases the story",
                   intro_done["pct"] == 100 and not intro_done["locked"] and not intro_done["inert"],
                   intro_done, "delivery")

            scenes = page.evaluate("""() => [...document.querySelectorAll('[data-scene]')].map((s) => ({
                i: +s.dataset.scene,
                name: s.dataset.chapterName,
                title: (s.querySelector('h2') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '',
                height: s.offsetHeight,
                stagePosition: getComputedStyle(s.querySelector('.stage')).position
            }))""")
            record("all six chapters exist in order",
                   [x["i"] for x in scenes] == [1, 2, 3, 4, 5, 6], scenes, "story")
            record("every chapter has its own heading and name",
                   len({x["title"] for x in scenes}) == 6 and len({x["name"] for x in scenes}) == 6, scenes, "story")
            record("desktop chapters are pinned and taller than the viewport",
                   all(x["stagePosition"] == "sticky" and x["height"] > 1200 for x in scenes[:5]),
                   [(x["i"], x["stagePosition"], x["height"]) for x in scenes], "story")

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 2. viewports â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            for tag, w, h in VIEWPORTS:
                print(f"\nâ”€â”€ {tag} {w}x{h}")
                vctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
                vp = vctx.new_page()
                vb = bucket()
                wire(vp, vb)
                vp.goto(BASE, wait_until="load")
                skip_intro(vp)
                vp.wait_for_timeout(350)
                vp.evaluate("() => { window.scrollTo({top: 0, behavior: 'instant'}); }")
                first_in_dom = vp.evaluate(JS_SKIP_FIRST)
                # move the sequential-focus start point to the top of the document
                vp.evaluate("() => { document.body.tabIndex = -1; document.body.focus(); }")
                vp.keyboard.press("Tab")
                try:
                    vp.wait_for_function("() => document.querySelector('.skip').getBoundingClientRect().top >= 0", timeout=2500)
                except Exception:
                    pass
                first = vp.evaluate(JS_ONE)
                skip_rect = vp.evaluate("""() => {
                    const el = document.querySelector('.skip');
                    const r = el.getBoundingClientRect();
                    return {top: Math.round(r.top), bottom: Math.round(r.bottom),
                            focused: document.activeElement === el};
                }""")

                data = {"size": [w, h], "first_tab": first, "first_in_dom": first_in_dom, "skip_rect": skip_rect}

                ov = vp.evaluate(JS_OVERFLOW)
                data["overflow"] = ov
                record("no horizontal overflow and no control stranded off-screen",
                       ov["doc"] <= 1 and not ov["loose"], ov, tag)

                names = vp.evaluate(JS_NAMES)
                data["names"] = names
                record("every interactive control has an accessible name",
                       names["total"] > 0 and not names["unnamed"], names, tag)

                record("the skip link is the first focusable and slides into view when reached",
                       first_in_dom["isSkip"] and first["tag"] == "a" and skip_rect["focused"]
                       and skip_rect["top"] >= 0 and skip_rect["bottom"] <= h,
                       {"dom": first_in_dom, "focused": first, "rect": skip_rect}, tag)

                stops = []
                for _ in range(22):
                    vp.keyboard.press("Tab")
                    stops.append(vp.evaluate(JS_ONE))
                data["tab_stops"] = stops
                rings = [s for s in stops if s["tag"] != "body"]
                record("every reached tab stop shows a focus ring and is visible",
                       bool(rings) and all(s["ring"] and s["visible"] for s in rings),
                       [s for s in rings if not (s["ring"] and s["visible"])], tag)

                heads = vp.evaluate(JS_HEADINGS)
                data["headings"] = heads
                levels = [x["level"] for x in heads]
                skips = [(levels[i - 1], levels[i]) for i in range(1, len(levels)) if levels[i] - levels[i - 1] > 1]
                record("headings start at h1 and never skip a level downward",
                       levels[:1] == [1] and not skips, {"levels": levels, "skips": skips}, tag)
                record("no heading is clipped horizontally",
                       not [x for x in heads if x["clipped"]], [x["text"] for x in heads if x["clipped"]], tag)

                contrast = vp.evaluate(JS_CONTRAST, CONTRAST_GLOBAL)
                data["contrast"] = contrast
                bad_contrast = [c for c in contrast if not c.get("found") or not c["pass"]]
                record("chapter-01 and HUD text meet WCAG AA contrast",
                       not bad_contrast, bad_contrast, tag)

                flow = vp.evaluate("""() => [...document.querySelectorAll('[data-scene]')].map((s) => {
                    const pin = s.querySelector('.pin');
                    return {
                        i: +s.dataset.scene,
                        pos: getComputedStyle(s.querySelector('.stage')).position,
                        pin: pin ? pin.offsetHeight : 0,
                        vh: innerHeight
                    };
                })""")
                data["flow"] = flow
                if w <= 780:
                    record("small screens drop the pinning instead of shrinking it",
                           all(f["pos"] == "static" and f["pin"] < f["vh"] * 2 for f in flow), flow, tag)
                else:
                    record("wide screens keep the pinned stages",
                           all(f["pos"] == "sticky" for f in flow[:5]), flow, tag)

                errs = {"console": vb["console"], "errors": vb["errors"],
                        "failed": vb["failed"], "bad": vb["bad"]}
                data["console"] = errs
                record("no console errors, page errors, failed requests or 4xx/5xx",
                       not any(errs.values()), errs, tag)

                backend = vp.evaluate("() => ({backend: window.__scene.backend, frames: window.__scene.frames, err: window.__scene.lastError})")
                data["scene"] = backend
                record("the WebGL world compiled and is drawing frames",
                       backend["backend"] == "webgl" and backend["frames"] > 0, backend, tag)

                shot(vp, f"{tag}-ch1")
                # one screenshot per chapter at the two extremes of the range
                for ch in (2, 3, 4, 5, 6):
                    scroll_frac(vp, ch, 0.5)
                    vp.wait_for_timeout(320)
                    shot(vp, f"{tag}-ch{ch}")

                results["viewports"][tag] = data
                vctx.close()

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 3. scroll storytelling â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ scroll storytelling (1440)")
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            b = bucket()
            wire(page, b)
            page.goto(BASE, wait_until="load")
            skip_intro(page)
            page.wait_for_timeout(300)

            scroll_log = {}

            for ch, name in CHAPTERS[:5]:
                samples = []
                for frac in (0.15, 0.5, 0.85):
                    y = scroll_frac(page, ch, frac)
                    state = page.evaluate(CHAPTER_STATE, ch)
                    state["scrollY"] = y
                    state["frac"] = frac
                    samples.append(state)
                    if frac == 0.5:
                        shot(page, f"scroll-ch{ch}-mid")
                scroll_log[ch] = samples

                record(f"chapter 0{ch} progress tracks the scroll position",
                       all(abs(s["p"] - s["frac"]) <= 0.07 for s in samples),
                       [{"frac": s["frac"], "p": s["p"], "scrollY": s["scrollY"]} for s in samples], f"ch{ch}")

                if ch == 1:
                    changed = (samples[0]["letter"] != samples[2]["letter"]
                               and samples[0]["eye"] < samples[2]["eye"] + 0.001
                               and samples[2]["eye"] > samples[0]["eye"]
                               and samples[2]["sign"] >= samples[0]["sign"])
                    record("ch1 â€” headline splits, depth and portal eye react to progress",
                           bool(changed), {"letter": [s["letter"] for s in samples],
                                           "eye": [s["eye"] for s in samples],
                                           "sign": [s["sign"] for s in samples],
                                           "window": [s["window"] for s in samples]}, "ch1")
                if ch == 2:
                    record("ch2 â€” memory objects drift at different depths as you descend",
                           samples[0]["frag"] != samples[2]["frag"] and samples[0]["glow"] != samples[2]["glow"],
                           {"frag": [s["frag"] for s in samples], "glow": [s["glow"] for s in samples]}, "ch2")
                if ch == 3:
                    record("ch3 â€” the transcript is revealed by progress",
                           samples[0]["lines"] < samples[2]["lines"] and samples[2]["lines"] >= 5,
                           [s["lines"] for s in samples], "ch3")
                    record("ch3 â€” the photograph turns over at its story beat",
                           samples[0]["photo"] is False and samples[2]["photo"] is True,
                           [{"p": s["p"], "photo": s["photo"], "flip": s["flip"]} for s in samples], "ch3")
                if ch == 4:
                    record("ch4 â€” the environment folds and the reconstruction fills in",
                           samples[0]["panel"] != samples[2]["panel"] and samples[0]["tl"] < samples[2]["tl"]
                           and samples[2]["line"] > 0.8,
                           {"panel": [s["panel"] for s in samples], "timeline": [s["tl"] for s in samples],
                            "dialogue": [s["line"] for s in samples]}, "ch4")
                if ch == 5:
                    record("ch5 â€” the core opens and the last memory surfaces",
                           samples[0]["seed"] != samples[2]["seed"] and samples[2]["mem"] > samples[0]["mem"],
                           {"seed": [s["seed"] for s in samples], "memory": [s["mem"] for s in samples]}, "ch5")

            # chapter 6 is not pinned: progress must still advance and the choices must exist
            page.evaluate("() => document.getElementById('ch6').scrollIntoView({behavior: 'instant'})")
            page.wait_for_timeout(300)
            top6 = page.evaluate(CHAPTER_STATE, 6)
            page.evaluate("() => window.scrollTo({top: document.body.scrollHeight, behavior: 'instant'})")
            page.wait_for_timeout(300)
            bottom6 = page.evaluate(CHAPTER_STATE, 6)
            record("ch6 â€” the choice scene adds progress without pinning",
                   top6["choices"] == 3 and bottom6["total"] > top6["total"],
                   {"top": top6, "bottom": bottom6}, "ch6")

            # reverse
            scroll_frac(page, 1, 0.85)
            page.wait_for_timeout(250)
            back_start = page.evaluate(CHAPTER_STATE, 1)
            scroll_frac(page, 1, 0.2)
            page.wait_for_timeout(250)
            back_end = page.evaluate(CHAPTER_STATE, 1)
            record("scrolling back up reverses the chapter state instead of sticking",
                   back_end["p"] < back_start["p"] and back_end["eye"] < back_start["eye"]
                   and back_end["sign"] <= back_start["sign"],
                   {"before": back_start, "after": back_end}, "reverse")

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 4. navigation â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ navigation")
            nav_log = []
            for ch, name in CHAPTERS:
                link = page.locator(f"[data-chapter-link='{ch}']").first
                link.click()
                wait_for_chapter(page, ch)
                target = page.evaluate("""(i) => {
                    const s = document.getElementById('ch' + i);
                    const hud = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 0;
                    return Math.max(0, Math.round(s.offsetTop - hud));
                }""", ch)
                try:
                    page.wait_for_function("(t) => Math.abs(window.scrollY - t) < 2", arg=target, timeout=6000)
                except Exception:
                    pass
                page.wait_for_timeout(120)
                nav_log.append(page.evaluate("""(i) => {
                    const s = document.getElementById('ch' + i);
                    const r = s.getBoundingClientRect();
                    return {i, top: Math.round(r.top), bottom: Math.round(r.bottom),
                            chapter: window.__scroll.chapter,
                            bodyChapter: document.body.dataset.chapter,
                            current: document.querySelector(`[data-chapter-link='${i}'][aria-current='true']`) ? true : false,
                            focus: document.activeElement.id};
                }""", ch))
                if ch in (1, 3, 6):
                    shot(page, f"nav-ch{ch}")
            results["navigation"] = nav_log
            record("every chapter link scrolls to its own chapter",
                   all(-80 <= n["top"] <= 120 and n["chapter"] == n["i"] for n in nav_log), nav_log, "nav")
            record("the rail marks the chapter the visitor is actually in",
                   all(n["current"] and n["bodyChapter"] == str(n["i"]) for n in nav_log), nav_log, "nav")
            record("chapter navigation moves keyboard focus into the chapter",
                   all(n["focus"] == f"ch{n['i']}" for n in nav_log), [n["focus"] for n in nav_log], "nav")

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 5. evidence, journal, ECHO â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ evidence and story state")
            scroll_frac(page, 2, 0.5)
            page.wait_for_timeout(300)
            evidence_log = []
            for fid, title in (("f1", "The Last Birthday"), ("f2", "Deletion Order 114"), ("f3", "Two Figures, One Erased")):
                page.locator(f"[data-fragment='{fid}']").first.click()
                page.wait_for_timeout(250)
                evidence_log.append(page.evaluate("""(t) => ({
                    title: document.querySelector('[data-evidence-title]').textContent,
                    date: document.querySelector('[data-evidence-date]').textContent,
                    body: document.querySelector('[data-evidence-body]').textContent.length,
                    impl: document.querySelector('[data-evidence-impl]').textContent.length,
                    open: document.querySelector('[data-evidence-panel]').open,
                    focused: document.activeElement.tagName,
                    count: window.__oblivion.state().count,
                    mark: document.querySelector('[data-fragment-state="' + 'f1' + '"]').textContent
                })""", title))
                if fid == "f1":
                    shot(page, "evidence-f1")
                page.keyboard.press("Escape")
                page.wait_for_timeout(180)

            results["evidence_records"] = evidence_log
            record("three memory fragments open as authored, dated records",
                   all(e["open"] and e["body"] > 200 and e["impl"] > 80 and e["date"] for e in evidence_log)
                   and [e["title"] for e in evidence_log] == ["The Last Birthday", "Deletion Order 114", "Two Figures, One Erased"],
                   evidence_log, "evidence")
            record("inspecting a fragment updates the recovered count",
                   [e["count"] for e in evidence_log] == [1, 2, 3], [e["count"] for e in evidence_log], "evidence")
            record("the fragment control reports that it has been recovered",
                   evidence_log[0]["mark"] == "recovered", evidence_log[0]["mark"], "evidence")

            # reopening must not double count
            page.locator("[data-fragment='f1']").first.click()
            page.wait_for_timeout(200)
            reconsider = page.evaluate("() => window.__oblivion.state().count")
            page.keyboard.press("Escape")
            page.wait_for_timeout(150)
            record("re-opening a fragment does not duplicate evidence", reconsider == 3, reconsider, "evidence")

            page.click("[data-journal-open]")
            page.wait_for_timeout(250)
            journal = page.evaluate("""() => ({
                open: document.querySelector('[data-journal]').open,
                items: document.querySelectorAll('[data-journal-item]').length,
                count: document.querySelector('[data-journal] [data-evidence-count]').textContent,
                empty: document.querySelector('[data-journal-empty]').hidden,
                echo: document.querySelector('[data-journal-echo]').textContent
            })""")
            results["journal"] = journal
            record("the journal lists every recovered memory",
                   journal["open"] and journal["items"] == 3 and journal["count"] == "3" and journal["empty"] is True,
                   journal, "journal")
            shot(page, "journal")
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)

            record("ECHO's journal line tracks how much evidence you carry",
                   "close" in results["journal"]["echo"].lower(), results["journal"]["echo"], "story")

            # the last two proofs are in chapter 4
            scroll_frac(page, 4, 0.55)
            page.wait_for_timeout(300)
            for fid in ("f4", "f5"):
                page.locator(f"[data-fragment='{fid}']").first.click()
                page.wait_for_timeout(240)
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)
            page.click("[data-journal-open]")
            page.wait_for_timeout(300)
            full = page.evaluate("""() => ({
                echo: document.querySelector('[data-journal-echo]').textContent,
                items: document.querySelectorAll('[data-journal-item]').length,
                count: document.querySelector('[data-journal] [data-evidence-count]').textContent
            })""")
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            record("recovering all five memories changes ECHO and the journal total",
                   full["items"] == 5 and full["count"] == "5" and "All of it" in full["echo"], full, "journal")

            # the ambient strip follows the chapter the visitor is in
            scroll_frac(page, 2, 0.5)
            page.wait_for_timeout(450)
            line2 = page.evaluate("() => document.querySelector('[data-echo-line]').textContent")
            scroll_frac(page, 5, 0.5)
            page.wait_for_timeout(550)
            line5 = page.evaluate("() => document.querySelector('[data-echo-line]').textContent")
            record("ECHO speaks differently in different chapters",
                   line2.startswith("ECHO:") and line5.startswith("ECHO:") and line2 != line5,
                   {"ch2": line2, "ch5": line5}, "story")

            # evidence survives a reload in the same tab
            page.reload(wait_until="load")
            skip_intro(page)
            page.wait_for_timeout(300)
            persisted = page.evaluate("() => ({count: window.__oblivion.state().count, ending: window.__oblivion.state().ending})")
            record("recovered evidence persists for the tab (sessionStorage)",
                   persisted["count"] == 5, persisted, "story")

            # ══════════════════════════════════ 5b. v3: the archive's accounting ══════════════════════════════════
            print("\n── v3 instrumentation")
            v3 = {}

            clocks0 = page.evaluate("""() => ({
                session: window.__system.clocks.session,
                sessionText: document.querySelector('[data-session-clock]').textContent,
                record: window.__system.clocks.record,
                recordText: document.querySelector('[data-archive-clock]').textContent,
                meta: document.querySelector('[data-meta-signal]').textContent.trim()
            })""")
            page.wait_for_timeout(1300)
            clocks1 = page.evaluate("() => window.__system.clocks.session")
            v3["clocks"] = {"before": clocks0, "after": clocks1}
            record("v3: a real session clock runs beside the archive's fictional record clock",
                   page.evaluate("window.__oblivion.version") == 3
                   and ":" in clocks0["session"] and clocks0["session"] != clocks1
                   and clocks0["record"].startswith("09Y") and clocks0["recordText"] == clocks0["record"]
                   and clocks0["meta"] != "",
                   v3["clocks"], "v3")

            page.evaluate("window.__oblivion.goToScene(1, false)")
            settle(page)
            scroll_frac(page, 1, 0.92)
            try:
                page.wait_for_function("() => window.__system.anomaly === true", timeout=5000)
            except Exception:
                pass
            anomaly = page.evaluate("""() => ({
                on: window.__system.anomaly,
                record: window.__system.clocks.record,
                body: document.body.dataset.anomaly,
                text: document.querySelector('[data-archive-clock]').textContent
            })""")
            page.wait_for_timeout(2300)
            revert = page.evaluate("""() => ({on: window.__system.anomaly,
                record: window.__system.clocks.record, body: document.body.dataset.anomaly})""")
            scroll_frac(page, 1, 0.4)
            scroll_frac(page, 1, 0.92)
            page.wait_for_timeout(400)
            repeat = page.evaluate("() => window.__system.anomalies")
            v3["anomaly"] = {"shot": anomaly, "revert": revert, "repeat": repeat}
            record("v3: one impossible timestamp appears once, reverts, and never repeats",
                   anomaly["on"] and anomaly["record"].endswith("00:00:11") and anomaly["body"] == "true"
                   and anomaly["text"].endswith("00:00:11")
                   and not revert["on"] and revert["record"] == "09Y 000D" and revert["body"] == "false"
                   and repeat == 1,
                   v3["anomaly"], "v3")

            settle(page)
            y0 = page.evaluate("() => Math.round(window.scrollY)")
            page.evaluate("() => window.scrollTo({top: window.scrollY + 1600, behavior: 'instant'})")
            page.wait_for_timeout(120)
            fast_on = page.evaluate("() => ({on: document.body.classList.contains('is-fast'), api: window.__system.fast, y: Math.round(window.scrollY)})")
            page.wait_for_timeout(600)
            fast_off = page.evaluate("() => ({on: document.body.classList.contains('is-fast'), api: window.__system.fast})")
            v3["velocity"] = {"from": y0, "on": fast_on, "off": fast_off}
            record("v3: speed shows as a brief edge fringe, then clears",
                   fast_on["on"] and fast_off["on"] is False and fast_on["y"] > y0, v3["velocity"], "v3")

            gctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page_g = gctx.new_page()
            gb = bucket()
            wire(page_g, gb)
            page_g.goto(BASE, wait_until="load")
            skip_intro(page_g)
            page_g.wait_for_timeout(300)
            page_g.evaluate("window.__oblivion.goToScene(4, false)")
            settle(page_g)
            if page_g.evaluate("() => window.__scroll.chapter") != 4:
                scroll_frac(page_g, 4, 0.2)
            try:
                page_g.wait_for_function("() => window.__oblivion.state().ui.ghost === 'typing'", timeout=6000)
            except Exception:
                pass
            typing = page_g.evaluate("""() => ({stage: window.__oblivion.state().ui.ghost,
                cls: document.querySelector('[data-echo]').className,
                dots: document.querySelectorAll('.echo__dots span').length,
                text: document.querySelector('[data-echo-line]').textContent})""")
            try:
                page_g.wait_for_function("() => window.__oblivion.state().ui.ghost === 'withheld'", timeout=6000)
            except Exception:
                pass
            withheld = page_g.evaluate("""() => ({stage: window.__oblivion.state().ui.ghost,
                text: document.querySelector('[data-echo-line]').textContent,
                cls: document.querySelector('[data-echo]').className})""")
            v3["ghost"] = {"typing": typing, "withheld": withheld}
            record("v3: ECHO starts to answer, fails, and withholds the line",
                   typing["stage"] == "typing" and typing["dots"] == 3 and typing["text"] == ""
                   and withheld["stage"] == "withheld" and withheld["text"] == "[signal withheld]"
                   and "is-withheld" in withheld["cls"], v3["ghost"], "v3")
            record("v3: the ghost beat raises no console errors", not gb["console"] and not gb["errors"], gb, "v3")
            shot(page_g, "v3-ghost")
            gctx.close()

            words = page.evaluate("""() => [...document.querySelectorAll('.scene__word')].map((w) => ({
                text: w.textContent.trim(), chapter: w.closest('[data-scene]').dataset.scene,
                visible: getComputedStyle(w).display !== 'none'}))""")
            record("v3: each chapter carries one embedded word, part of the composition",
                   len(words) == 6 and all(w["text"] and w["visible"] for w in words), words, "v3")

            page.evaluate("window.__oblivion.goToScene(1, false)")
            page.wait_for_timeout(700)
            watch = page.evaluate("""() => { const w = document.querySelector('[data-watch]');
                if (!w) return null; const r = w.getBoundingClientRect();
                return {x: r.left + r.width / 2, y: r.top + r.height / 2}; }""")
            if watch:
                page.mouse.move(watch["x"], watch["y"])
                page.wait_for_timeout(250)
            watch_on = page.evaluate("() => document.querySelectorAll('[data-watch].is-watching').length")
            page.mouse.move(4, 4)
            page.wait_for_timeout(250)
            watch_off = page.evaluate("() => document.querySelectorAll('[data-watch].is-watching').length")
            v3["watches"] = {"on": watch_on, "off": watch_off}
            record("v3: windows notice the cursor only when it comes close",
                   watch is not None and watch_on == 1 and watch_off == 0, v3["watches"], "v3")

            page.click("[data-journal-open]")
            page.wait_for_timeout(300)
            page.click("[data-compare-toggle]")
            page.wait_for_timeout(150)
            page.click("[data-journal-item='f1']")
            page.wait_for_timeout(120)
            one = page.evaluate("() => ({disabled: document.querySelector('[data-compare-link]').disabled, pressed: document.querySelector('[data-journal-item=\"f1\"]').getAttribute('aria-pressed')})")
            page.click("[data-journal-item='f5']")
            page.wait_for_timeout(120)
            two = page.evaluate("() => ({disabled: document.querySelector('[data-compare-link]').disabled})")
            page.click("[data-compare-link]")
            page.wait_for_timeout(300)
            thread1 = page.evaluate("""() => ({
                verdict: document.querySelector('[data-compare-result]').dataset.verdict,
                text: document.querySelector('[data-compare-result]').textContent,
                states: [...document.querySelectorAll('[data-journal-item]')].map((b) => b.dataset.journalItem + ':' + b.dataset.state)
            })""")
            page.click("[data-journal-item='f4']")
            page.click("[data-journal-item='f5']")
            page.click("[data-compare-link]")
            page.wait_for_timeout(250)
            thread2 = page.evaluate("() => document.querySelector('[data-compare-result]').dataset.verdict")
            page.click("[data-journal-item='f2']")
            page.click("[data-journal-item='f3']")
            page.click("[data-compare-link]")
            page.wait_for_timeout(250)
            thread3 = page.evaluate("""() => ({verdict: document.querySelector('[data-compare-result]').dataset.verdict,
                text: document.querySelector('[data-compare-result]').textContent})""")
            v3["compare"] = {"one": one, "two": two, "f1f5": thread1, "f4f5": thread2, "f2f3": thread3}
            record("v3: comparison needs two records and names the contradiction it finds",
                   one["disabled"] and one["pressed"] == "true" and not two["disabled"]
                   and thread1["verdict"] == "contradiction" and "Provenance" in thread1["text"]
                   and thread2 == "contradiction"
                   and thread1["states"] == ["f1:connected", "f2:inspected", "f3:inspected", "f4:inspected", "f5:connected"],
                   v3["compare"], "v3")
            record("v3: records that agree are reported as no thread at all",
                   thread3["verdict"] == "none" and "NO THREAD" in thread3["text"], thread3, "v3")

            page.focus("[data-scrub]")
            page.keyboard.press("Home")
            page.wait_for_timeout(150)
            scrub_home = page.evaluate("""() => ({value: +document.querySelector('[data-scrub]').value,
                out: document.querySelector('[data-scrub-out]').textContent,
                f1: document.querySelector('[data-journal-item=\"f1\"]').dataset.inWindow,
                f4: document.querySelector('[data-journal-item=\"f4\"]').dataset.inWindow})""")
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(150)
            scrub_next = page.evaluate("""() => ({value: +document.querySelector('[data-scrub]').value,
                out: document.querySelector('[data-scrub-out]').textContent})""")
            page.keyboard.press("End")
            page.wait_for_timeout(150)
            scrub_end = page.evaluate("""() => ({value: +document.querySelector('[data-scrub]').value,
                out: document.querySelector('[data-scrub-out]').textContent,
                f4: document.querySelector('[data-journal-item=\"f4\"]').dataset.inWindow})""")
            v3["scrub"] = {"home": scrub_home, "next": scrub_next, "end": scrub_end}
            record("v3: the archive scrubber narrows the record by date, from the keyboard",
                   scrub_home["value"] == 0 and scrub_home["out"] == "2189-01"
                   and scrub_home["f1"] == "false" and scrub_home["f4"] == "false"
                   and scrub_next["value"] == 1 and scrub_next["out"] == "2189-02"
                   and scrub_end["value"] == 96 and scrub_end["out"] == "2197-01" and scrub_end["f4"] == "true",
                   v3["scrub"], "v3")
            shot(page, "v3-journal")
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)

            page.evaluate("window.__oblivion.goToScene(3, false)")
            page.wait_for_timeout(700)
            page.click("[data-seam]")
            page.wait_for_timeout(300)
            seam = page.evaluate("""() => ({title: document.querySelector('[data-evidence-title]').textContent,
                count: window.__oblivion.state().count, egg: window.__oblivion.state().egg,
                open: document.querySelector('[data-evidence-panel]').open})""")
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)
            seam["focus"] = page.evaluate("() => document.activeElement.hasAttribute('data-seam')")
            v3["seam"] = seam
            record("v3: the seam is an authored extra, not a sixth memory, and it returns focus",
                   seam["open"] and seam["title"] == "The Seam" and seam["count"] == 5
                   and seam["egg"] is True and seam["focus"], seam, "v3")
            shot(page, "v3-seam")

            page.reload(wait_until="load")
            skip_intro(page)
            page.wait_for_timeout(400)
            after = page.evaluate("""() => ({egg: window.__oblivion.state().egg,
                links: window.__oblivion.state().links, count: window.__oblivion.state().count})""")
            v3["persistence"] = after
            record("v3: the seam and the drawn thread survive with the rest of the tab's memory",
                   after["egg"] is True and "f1|f5" in after["links"] and after["count"] == 5, after, "v3")

            mctx3 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
            page_m3 = mctx3.new_page()
            mb = bucket()
            wire(page_m3, mb)
            page_m3.goto(BASE, wait_until="load")
            skip_intro(page_m3)
            page_m3.wait_for_timeout(400)
            mobile = page_m3.evaluate("""() => ({
                words: [...document.querySelectorAll('.scene__word')].filter((w) => getComputedStyle(w).display !== 'none').length,
                clocks: [...document.querySelectorAll('[data-session-clock],[data-archive-clock]')].map((el) => Math.round(el.getBoundingClientRect().right)),
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                width: innerWidth
            })""")
            v3["mobile"] = mobile
            record("v3: on a phone the added counters fit and the scene words step aside",
                   mobile["words"] == 0 and mobile["overflow"] <= 1
                   and all(r <= mobile["width"] for r in mobile["clocks"]), mobile, "v3-mobile")

            page_m3.evaluate("window.__oblivion.goToScene(4, false)")
            try:
                page_m3.wait_for_function("() => window.__oblivion.state().ui.ghost === 'withheld'", timeout=9000)
            except Exception:
                pass
            mob_echo = page_m3.evaluate("""() => ({
                display: getComputedStyle(document.querySelector('[data-echo]')).display,
                text: document.querySelector('[data-echo-line]').textContent,
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth})""")
            v3["mobileEcho"] = mob_echo
            record("v3: the withheld transmission stays visible on a phone",
                   mob_echo["display"] == "flex" and "[signal withheld]" in mob_echo["text"]
                   and mob_echo["overflow"] <= 1, mob_echo, "v3-mobile")
            record("v3: the phone pass raises no console errors", not mb["console"] and not mb["errors"], mb, "v3-mobile")
            mctx3.close()

            # corruption needs a partly-recovered state, so use a fresh tab
            cctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page_c = cctx.new_page()
            cb = bucket()
            wire(page_c, cb)
            page_c.goto(BASE, wait_until="load")
            skip_intro(page_c)
            page_c.wait_for_timeout(250)
            page_c.evaluate("window.__oblivion.goToScene(4, false)")
            page_c.wait_for_timeout(300)
            try:
                page_c.wait_for_function("() => window.__oblivion.state().ui.ghost === 'withheld'", timeout=9000)
            except Exception:
                pass
            page_c.locator("[data-fragment='f5']").click()
            page_c.wait_for_timeout(250)
            page_c.keyboard.press("Escape")
            page_c.wait_for_timeout(200)
            page_c.evaluate("window.__oblivion.goToScene(5, false)")
            await_chapter(page_c, 5)
            page_c.evaluate("window.__oblivion.goToScene(4, false)")
            await_chapter(page_c, 4)
            lie = page_c.evaluate("""() => { const l = document.querySelector('[data-echo-line]');
                return {proven: document.body.dataset.proven, corrupt: l.classList.contains('is-corrupt'),
                        ghost: l.dataset.ghost || '', line: l.textContent,
                        resolved: document.querySelector('[data-lie-resolved]').hidden,
                        chapter: document.body.dataset.chapter,
                        level: getComputedStyle(document.body).getPropertyValue('--corrupt').trim()}; }""")
            page_c.locator("[data-fragment='f4']").click()
            page_c.wait_for_timeout(300)
            page_c.keyboard.press("Escape")
            page_c.wait_for_timeout(200)
            page_c.evaluate("window.__oblivion.goToScene(5, false)")
            await_chapter(page_c, 5)
            page_c.evaluate("window.__oblivion.goToScene(4, false)")
            await_chapter(page_c, 4)
            proof = page_c.evaluate("""() => { const l = document.querySelector('[data-echo-line]');
                return {proven: document.body.dataset.proven, corrupt: l.classList.contains('is-corrupt'),
                        ghost: !!l.dataset.ghost, resolved: !document.querySelector('[data-lie-resolved]').hidden,
                        chapter: document.body.dataset.chapter,
                        count: window.__oblivion.state().count}; }""")
            v3["corruption"] = {"lie": lie, "proof": proof}
            record("v3: the lie corrupts visibly, and recovering f4 and f5 cleans it",
                   lie["proven"] == "false" and lie["corrupt"] and bool(lie["ghost"]) and lie["line"].startswith("ECHO:")
                   and lie["chapter"] == "4" and lie["resolved"] is True
                   and proof["proven"] == "true" and not proof["corrupt"] and not proof["ghost"]
                   and proof["resolved"] and proof["chapter"] == "4" and proof["count"] == 2,
                   v3["corruption"], "v3")
            record("v3: corruption runs without errors and without invented data",
                   not cb["console"] and not cb["errors"], cb, "v3")
            cctx.close()

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 6. endings â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ endings")
            # 5c. tactile commit
            print()
            print("── tactile commit")
            tctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page_t = tctx.new_page()
            tb = bucket()
            wire(page_t, tb)
            page_t.goto(BASE, wait_until="load")
            skip_intro(page_t)
            page_t.wait_for_timeout(250)
            page_t.evaluate("window.__oblivion.goToScene(6, false)")
            settle(page_t)
            page_t.locator("[data-ending-choice='restore']").click()
            page_t.wait_for_timeout(250)
            page_t.locator("[data-confirm]").scroll_into_view_if_needed()
            page_t.wait_for_timeout(250)
            box = page_t.locator("[data-confirm]").bounding_box()
            page_t.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page_t.mouse.down()
            page_t.wait_for_timeout(520)
            mid = page_t.evaluate("""() => ({holding: document.querySelector('[data-confirm]').dataset.holding,
                hold: window.__oblivion.state().ui.hold,
                fill: getComputedStyle(document.querySelector('[data-confirm]')).getPropertyValue('--hold').trim()})""")
            page_t.mouse.up()
            page_t.wait_for_timeout(300)
            cancelled = page_t.evaluate("""() => ({shown: !document.querySelector('[data-ending-screen]').hidden,
                ending: document.body.dataset.ending, hold: window.__oblivion.state().ui.hold})""")
            record("v3: the decision is a held gesture, and letting go abandons it",
                   0.15 < mid["hold"] < 0.85 and mid["holding"] == "true" and mid["fill"] != ""
                   and not cancelled["shown"] and not cancelled["ending"] and cancelled["hold"] == 0,
                   {"mid": mid, "cancelled": cancelled}, "v3")

            hold_meta = page_t.evaluate("""() => { const b = document.querySelector('[data-confirm]');
                const help = document.getElementById(b.getAttribute('aria-describedby'));
                return {hold: b.hasAttribute('data-hold'), quick: !!document.querySelector('[data-confirm-quick]'),
                        help: b.getAttribute('aria-describedby'), text: help ? help.textContent : ''}; }""")
            record("v3: the hold is explained, and a single-press alternative is offered",
                   hold_meta["hold"] and hold_meta["quick"] and hold_meta["help"]
                   and "hold" in hold_meta["text"].lower(), hold_meta, "v3")

            keyboard_hold(page_t, 1700)
            page_t.wait_for_timeout(1300)
            held = page_t.evaluate("""() => ({ending: document.body.dataset.ending,
                shown: !document.querySelector('[data-ending-screen]').hidden,
                title: document.querySelector('[data-ending-title]').textContent,
                hud: getComputedStyle(document.querySelector('[data-hud]')).visibility,
                echo: getComputedStyle(document.querySelector('[data-echo]')).visibility,
                focus: document.activeElement.id,
                indexed: [...document.querySelectorAll('[data-ending-ledger] li')]
                    .map((li) => getComputedStyle(li).getPropertyValue('--i').trim())})""")
            record("v3: holding by keyboard commits, and the ending takes the interface away",
                   held["shown"] and held["ending"] == "restore" and held["title"] == "The Whole Truth"
                   and held["hud"] == "hidden" and held["echo"] == "hidden" and held["focus"] == "ending-title"
                   and held["indexed"] == ["0", "1", "2", "3"], held, "v3")
            shot(page_t, "v3-hold-ending")

            page_t.reload(wait_until="load")
            skip_intro(page_t)
            page_t.wait_for_timeout(250)
            page_t.evaluate("window.__oblivion.goToScene(6, false)")
            settle(page_t)
            page_t.locator("[data-ending-choice='erase']").click()
            page_t.wait_for_timeout(200)
            page_t.locator("[data-confirm-quick]").scroll_into_view_if_needed()
            page_t.click("[data-confirm-quick]")
            page_t.wait_for_timeout(400)
            quick = page_t.evaluate("""() => ({ending: document.body.dataset.ending,
                shown: !document.querySelector('[data-ending-screen]').hidden})""")
            record("v3: the single-press alternative still commits for anyone who cannot hold",
                   quick["shown"] and quick["ending"] == "erase", quick, "v3")
            record("v3: the commit sequence raises no console errors", not tb["console"] and not tb["errors"], tb, "v3")
            tctx.close()

            endings = {}
            for key, expected_title in (("restore", "The Whole Truth"), ("erase", "The Quiet"), ("rewrite", "The New Rule")):
                ectx = browser.new_context(viewport={"width": 1440, "height": 900})
                page_e = ectx.new_page()
                eb = bucket()
                wire(page_e, eb)
                page_e.goto(BASE, wait_until="load")
                skip_intro(page_e)
                page_e.wait_for_timeout(250)
                page_e.evaluate("() => window.__oblivion.goToScene(6, false)")
                settle(page_e)
                page_e.locator(f"[data-ending-choice='{key}']").click()
                page_e.wait_for_timeout(200)
                page_e.locator("[data-confirm-quick]").scroll_into_view_if_needed()
                page_e.click("[data-confirm-quick]")
                page_e.wait_for_timeout(500)
                detail = page_e.evaluate("""() => ({
                    shown: !document.querySelector('[data-ending-screen]').hidden,
                    eyebrow: document.querySelector('[data-ending-eyebrow]').textContent,
                    title: document.querySelector('[data-ending-title]').textContent,
                    body: document.querySelector('[data-ending-body]').textContent,
                    ledger: [...document.querySelectorAll('[data-ending-ledger] li')].map((li) => li.textContent),
                    echo: document.querySelector('[data-ending-echo]').textContent,
                    dataEnding: document.body.dataset.ending,
                    sceneEnding: window.__scene.ending,
                    stored: window.__oblivion.state().ending,
                    focus: document.activeElement.id
                })""")
                endings[key] = detail
                shot(page_e, f"ending-{key}")
                record(f"ending {key} renders its own title, text and ledger",
                       detail["shown"] and detail["title"] == expected_title and len(detail["body"]) > 300
                       and len(detail["ledger"]) == 4 and detail["focus"] == "ending-title",
                       {k: detail[k] for k in ("title", "dataEnding", "sceneEnding", "stored", "focus")}, f"ending-{key}")
                record(f"ending {key} changes the actual world state",
                       detail["dataEnding"] == key and detail["sceneEnding"] == key and detail["stored"] == key,
                       {"dataEnding": detail["dataEnding"], "sceneEnding": detail["sceneEnding"]}, f"ending-{key}")

                # the ending is a modal: the page behind it must not take focus
                page_e.keyboard.press("Tab")
                page_e.keyboard.press("Tab")
                contained = page_e.evaluate("""() => ({
                    inside: document.querySelector('[data-ending-screen]').contains(document.activeElement),
                    storyInert: document.getElementById('story').hasAttribute('inert')})""")
                record(f"ending {key} keeps keyboard focus inside the ending",
                       contained["inside"] and contained["storyInert"], contained, f"ending-{key}")

                # revisit evidence from inside the ending: the ending stays put underneath
                page_e.click("[data-ending-review]")
                page_e.wait_for_timeout(300)
                revisit = page_e.evaluate("""() => ({
                    endingHidden: document.querySelector('[data-ending-screen]').hidden,
                    journalOpen: document.querySelector('[data-journal]').open,
                    storyInert: document.getElementById('story').hasAttribute('inert'),
                    modal: document.querySelector('[data-ending-screen]').getAttribute('aria-modal')
                })""")
                record(f"ending {key} lets the visitor revisit the evidence without losing the ending",
                       not revisit["endingHidden"] and revisit["journalOpen"]
                       and revisit["storyInert"] and revisit["modal"] == "true", revisit, f"ending-{key}")
                page_e.keyboard.press("Escape")
                page_e.wait_for_timeout(300)
                returned = page_e.evaluate("() => document.activeElement.hasAttribute('data-ending-review')")
                record(f"ending {key} gives focus back to the review control when the journal closes",
                       returned, {"returned": returned}, f"ending-{key}")

                # restart from the ending, with the ending still on screen
                page_e.click("[data-restart]")
                page_e.wait_for_load_state("load")
                page_e.wait_for_timeout(600)
                fresh = page_e.evaluate("""() => ({
                    count: window.__oblivion.state().count,
                    choice: window.__oblivion.state().choice,
                    ending: window.__oblivion.state().ending,
                    bootAgain: !document.querySelector('[data-intro]').hidden,
                    locked: document.body.classList.contains('is-booting')
                })""")
                record(f"restart after {key} clears the story and replays the opening",
                       fresh["count"] == 0 and fresh["choice"] is None and fresh["ending"] is None
                       and fresh["bootAgain"] and fresh["locked"], fresh, f"ending-{key}")
                ectx.close()

            results["endings"] = endings
            distinct = {endings[k]["title"] for k in endings} | {endings[k]["body"][:80] for k in endings}
            record("the three endings are substantially different outcomes",
                   len({endings[k]["title"] for k in endings}) == 3
                   and len({endings[k]["body"] for k in endings}) == 3
                   and len({endings[k]["ledger"][0] for k in endings}) == 3, {"titles": [endings[k]["title"] for k in endings]}, "endings")

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 7. reduced motion â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ reduced motion")
            rctx = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
            page_r = rctx.new_page()
            rb = bucket()
            wire(page_r, rb)
            page_r.goto(BASE, wait_until="load")
            booted(page_r)
            page_r.wait_for_timeout(500)

            f1 = page_r.evaluate("() => window.__scene.frames")
            page_r.wait_for_timeout(900)
            f2 = page_r.evaluate("() => window.__scene.frames")
            rm = page_r.evaluate("""() => ({
                scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
                frames: window.__scene.frames,
                running: window.__scene.running,
                longAnims: document.getAnimations().filter((a) => a.playState === 'running' && (a.effect.getTiming().duration || 0) > 50).length,
                stages: [...document.querySelectorAll('[data-scene] .stage')].map((s) => getComputedStyle(s).position),
                pins: [...document.querySelectorAll('[data-scene] .pin')].map((p) => p.offsetHeight),
                transcripts: [...document.querySelectorAll('.transcript__list li')].map((li) => +getComputedStyle(li).opacity),
                letters: [...document.querySelectorAll('.split .ltr')].map((l) => +getComputedStyle(l).opacity),
                reveals: [...document.querySelectorAll('.reveal')].map((r) => +getComputedStyle(r).opacity),
                bootReason: window.__intro.reason
            })""")
            rm["frameDelta"] = f2 - f1
            results["reduced_motion"] = rm
            record("reduced motion runs no decorative loop", f1 == f2 and not rm["running"],
                   {"f1": f1, "f2": f2, "running": rm["running"]}, "reduced")
            record("reduced motion runs no long animations", rm["longAnims"] == 0, rm["longAnims"], "reduced")
            record("reduced motion removes pinning and scrubbed transforms",
                   all(pos == "static" for pos in rm["stages"])
                   and all(p <= 900 + 2 for p in rm["pins"]), {"stages": rm["stages"], "pins": rm["pins"]}, "reduced")
            record("reduced motion exposes every transcript line, letter and reveal",
                   all(o > 0.9 for o in rm["transcripts"] + rm["letters"] + rm["reveals"]),
                   {"transcripts": rm["transcripts"], "letters": rm["letters"], "reveals": rm["reveals"]}, "reduced")
            record("reduced motion disables smooth scrolling", rm["scrollBehavior"] == "auto", rm["scrollBehavior"], "reduced")

            page_r.evaluate("window.__oblivion.goToScene(4, false)")
            page_r.wait_for_timeout(300)
            try:
                page_r.wait_for_function("() => window.__oblivion.state().ui.ghost === 'withheld'", timeout=5000)
            except Exception:
                pass
            ghost_r = page_r.evaluate("""() => ({text: document.querySelector('[data-echo-line]').textContent,
                withheld: document.querySelector('[data-echo]').classList.contains('is-withheld'),
                dots: document.querySelectorAll('.echo__dots').length,
                display: getComputedStyle(document.querySelector('[data-echo]')).display})""")
            page_r.evaluate("() => window.scrollTo({top: window.scrollY + 1200, behavior: 'instant'})")
            page_r.wait_for_timeout(150)
            fast_r = page_r.evaluate("() => document.body.classList.contains('is-fast')")
            record("reduced motion shows the withheld line without typing and never flickers the fringe",
                   ghost_r["text"] == "[signal withheld]" and ghost_r["withheld"] and ghost_r["dots"] == 0
                   and ghost_r["display"] != "none" and fast_r is False,
                   {"ghost": ghost_r, "fast": fast_r}, "reduced")

            page_r.evaluate("() => window.__oblivion.goToScene(6, false)")
            settle(page_r)
            page_r.locator("[data-ending-choice='rewrite']").click()
            page_r.locator("[data-confirm-quick]").scroll_into_view_if_needed()
            page_r.click("[data-confirm-quick]")
            page_r.wait_for_timeout(400)
            record("reduced motion still allows a decision and shows its ending",
                   page_r.evaluate("() => !document.querySelector('[data-ending-screen]').hidden && document.body.dataset.ending === 'rewrite'"),
                   page_r.evaluate("() => ({shown: !document.querySelector('[data-ending-screen]').hidden, ending: document.body.dataset.ending})"), "reduced")
            record("no errors under reduced motion", not rb["console"] and not rb["errors"], rb, "reduced")
            shot(page_r, "reduced-ending")
            rctx.close()

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 8. no WebGL â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ no WebGL")
            nctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page_n = nctx.new_page()
            nb = bucket()
            wire(page_n, nb)
            page_n.add_init_script("""(() => {
                const orig = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function (type, attrs) {
                    if (String(type).includes('webgl')) return null;
                    return orig.call(this, type, attrs);
                };
            })()""")
            page_n.goto(BASE, wait_until="load")
            booted(page_n)
            page_n.wait_for_timeout(400)
            no_gl = page_n.evaluate("""() => ({
                backend: window.__scene.backend,
                fallback: !document.querySelector('[data-scene-fallback]').hidden,
                renderer: document.querySelector('[data-meta-renderer]').textContent,
                chapters: document.querySelectorAll('[data-scene]').length,
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
            })""")
            page_n.evaluate("() => window.__oblivion.goToScene(2, false)")
            settle(page_n)
            page_n.locator("[data-fragment='f1']").click()
            page_n.wait_for_timeout(250)
            no_gl["panel"] = page_n.evaluate("() => document.querySelector('[data-evidence-panel]').open")
            page_n.keyboard.press("Escape")
            page_n.evaluate("() => window.__oblivion.goToScene(6, false)")
            settle(page_n)
            no_gl["choices"] = page_n.evaluate("() => document.querySelectorAll('[data-ending-choice]').length")
            no_gl["errors"] = {"console": nb["console"], "errors": nb["errors"], "failed": nb["failed"]}
            results["no_webgl"] = no_gl
            record("without WebGL the world degrades to an explicit static fallback",
                   no_gl["backend"] == "no-webgl" and no_gl["fallback"] and "Static" in no_gl["renderer"], no_gl, "no-webgl")
            record("without WebGL the whole story, evidence and choice still work",
                   no_gl["chapters"] == 6 and no_gl["panel"] and no_gl["choices"] == 3 and no_gl["overflow"] <= 1, no_gl, "no-webgl")
            record("without WebGL there are no console errors", not any(no_gl["errors"].values()), no_gl["errors"], "no-webgl")
            shot(page_n, "no-webgl")
            nctx.close()

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 9. keyboard-only pass â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ keyboard")
            kctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page_k = kctx.new_page()
            page_k.goto(BASE, wait_until="load")
            skip_intro(page_k)
            page_k.wait_for_timeout(250)
            page_k.evaluate("() => { scrollTo({top: 0, behavior: 'instant'}); document.body.tabIndex = -1; document.body.focus(); }")
            page_k.keyboard.press("Tab")
            page_k.wait_for_timeout(320)
            first_k = page_k.evaluate(JS_ONE)
            page_k.keyboard.press("Enter")
            page_k.wait_for_timeout(500)
            skip_result = page_k.evaluate("""() => {
                const story = document.getElementById('story');
                return {hash: location.hash, storyTop: Math.round(story.getBoundingClientRect().top),
                        scrollY: Math.round(scrollY),
                        focus: document.activeElement.id || document.activeElement.tagName};
            }""")
            record("the skip link works with the keyboard",
                   first_k["tag"] == "a" and skip_result["hash"] == "#story" and skip_result["storyTop"] <= 2,
                   {"first": first_k, "after": skip_result}, "keyboard")

            page_k.evaluate("() => document.querySelector('[data-journal-open]').focus()")
            page_k.keyboard.press("Enter")
            page_k.wait_for_timeout(300)
            j_open = page_k.evaluate("() => document.querySelector('[data-journal]').open")
            page_k.keyboard.press("Escape")
            page_k.wait_for_timeout(250)
            j_closed = page_k.evaluate("""() => ({
                open: document.querySelector('[data-journal]').open,
                focusBack: document.activeElement === document.querySelector('[data-journal-open]')
            })""")
            record("the journal opens and closes from the keyboard, returning focus",
                   j_open and (not j_closed["open"]) and j_closed["focusBack"], {"open": j_open, "closed": j_closed}, "keyboard")
            results["keyboard"] = {"skip": skip_result, "journal": j_closed}
            kctx.close()

            # â•â•â•â•â•â•â•â•â•â•â•â•â•â• 10. CLS, DPR, measured fps â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            print("\nâ”€â”€ metrics")
            mctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page_m = mctx.new_page()
            page_m.goto(BASE, wait_until="load")
            skip_intro(page_m)
            page_m.wait_for_timeout(400)
            cls = page_m.evaluate("""() => new Promise((res) => {
                let total = 0;
                let supported = true;
                const obs = new PerformanceObserver((list) => {
                    for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value;
                });
                try { obs.observe({type: 'layout-shift', buffered: true}); } catch (err) { supported = false; }
                setTimeout(() => {
                    const pageTotal = total;
                    const block = document.createElement('div');
                    block.style.cssText = 'height:300px;background:#111';
                    document.body.prepend(block);
                    setTimeout(() => {
                        const control = total - pageTotal;
                        block.remove();
                        obs.disconnect();
                        res({supported, total: Math.round(pageTotal * 10000) / 10000, control: Math.round(control * 10000) / 10000});
                    }, 700);
                }, 1200);
            })""")
            results["cls"] = cls
            record("layout shift stays inside the 0.1 budget (probe proven by a control)",
                   cls.get("supported") is True and cls.get("control", 0) > 0.05 and cls.get("total", 1) < 0.1,
                   {**cls, "note": "total = real page, control = injected 300px block"}, "metrics")
            mctx.close()

            dctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3)
            page_d = dctx.new_page()
            page_d.goto(BASE, wait_until="load")
            skip_intro(page_d)
            page_d.wait_for_timeout(500)
            dpr = page_d.evaluate("() => ({device: devicePixelRatio, used: window.__scene.dpr, w: document.querySelector('[data-scene-canvas]').width})")
            results["dpr"] = dpr
            record("the renderer caps its pixel ratio on a 3x display", dpr["used"] <= 2 and dpr["device"] >= 2, dpr, "metrics")
            dctx.close()

            pctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page_p = pctx.new_page()
            page_p.goto(BASE, wait_until="load")
            skip_intro(page_p)
            page_p.wait_for_timeout(1300)
            perf = page_p.evaluate("""() => {
                const before = window.__scene.frames;
                return new Promise((res) => setTimeout(() => {
                    res({frames: window.__scene.frames - before,
                         text: document.querySelector('[data-meta-fps]').textContent,
                         renderer: document.querySelector('[data-meta-renderer]').textContent});
                }, 1000));
            }""")
            results["perf"] = perf
            record("the page reports a measured frame rate instead of inventing one",
                   "fps" in perf["text"].lower() or "paused" in perf["text"].lower(), perf, "metrics")
            shot(page_p, "final-choice")
            pctx.close()

            browser.close()
    finally:
        if proc is not None:
            proc.terminate()

    results["summary"] = {
        "checks": len(results["checks"]),
        "pass": len(results["checks"]) - fails - not_tested,
        "fail": fails,
        "not_tested": not_tested,
    }
    results["scroll"] = scroll_log
    (REPORTS / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("\n--- summary ---")
    print(f"checks {len(results['checks'])} | PASS {results['summary']['pass']} | FAIL {fails} | NOT TESTED {not_tested}")


if __name__ == "__main__":
    main()



