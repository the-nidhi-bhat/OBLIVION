/* ═══════════════════════════════════════════════════════════════════════
   OBLIVION — the world renderer
   Hand-written WebGL1. No libraries, no build step, no textures.

   One fixed full-viewport canvas carries the whole journey. Scroll progress
   is not decoration here: it moves the camera down the corridor, widens the
   aperture, changes the palette per chapter and folds the geometry in the
   fracture chapter.

   Lifecycle contract
     • DPR capped at 2
     • one rAF loop, paused when the tab is hidden
     • single deterministic frame under prefers-reduced-motion (and on resize)
     • context loss → explicit static fallback; restore → rebuild
     • dispose() removes every listener, observer, buffer and program
   ═══════════════════════════════════════════════════════════════════════ */

const RINGS = 120;
const PER_RING = 160;
const COUNT = RINGS * PER_RING; // 19,200
const FOV = 42;
const CAMERA_START = 6.4;
const CORRIDOR_DEPTH = 5.4; // per ring

const canvas = document.querySelector('[data-scene-canvas]');
const fallback = document.querySelector('[data-scene-fallback]');
const rendererCell = document.querySelector('[data-meta-renderer]');
const signalCell = document.querySelector('[data-meta-signal]');

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  backend: 'pending',
  frames: 0,
  running: false,
  paused: false,
  dpr: 1,
  disposed: false,
  ready: false,
  scroll: 0,      // 0 → 1 across the whole story
  chapter: 0,     // 0 → 6
  ending: 'none',
  lastError: null,
};
window.__scene = state;

/* ---------- shaders ---------- */

const VERT = `
precision highp float;

attribute float aRing;    // 0 → 1 down the corridor
attribute float aAngle;   // 0 → 2π around it
attribute float aRand;    // deterministic per-point noise

uniform float uTime;
uniform float uAspect;
uniform float uDpr;
uniform float uIntro;     // 0 → 1 gate opening
uniform float uScroll;    // 0 → 1 story progress
uniform float uChapter;   // 0 → 6
uniform float uWarp;      // fracture distortion
uniform vec2  uMouse;

varying float vDepth;
varying float vRand;

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  float ring = aRing;
  float travel = uScroll * 92.0;            // the camera falls into the archive

  float breathe = 0.17 * sin(ring * 6.2 + uTime * 0.3)
                + 0.08 * sin(ring * 14.0 - uTime * 0.46)
                + 0.05 * sin(aRand * 23.0 + uTime * 0.18);

  // the aperture widens as the story opens; later chapters compress it again
  float aperture = mix(1.02, 2.35, smoothstep(0.0, 0.22, uScroll));
  aperture *= mix(1.0, 0.62, smoothstep(0.55, 1.0, uScroll));
  float radius = aperture + breathe * (0.55 + uChapter * 0.05);

  float ang = aAngle + ring * 2.7 + uTime * 0.06 + uScroll * 5.5;

  // the fracture folds the corridor into itself
  ang += uWarp * 0.85 * sin(radius * 3.1 + uTime * 0.7);

  float z = -ring * ${CORRIDOR_DEPTH.toFixed(2)};
  vec3 pos = vec3(cos(ang) * radius, sin(ang) * radius, z);

  pos.xy = rot(uTime * 0.045 + uMouse.x * 0.24 + uScroll * 0.6) * pos.xy;
  pos.yz = rot(0.14 + uMouse.y * 0.12) * pos.yz;

  pos.xy *= mix(0.74, 1.0, uIntro);

  float camZ = ${CAMERA_START.toFixed(2)} - travel;
  vec3 view = pos - vec3(0.0, 0.0, camZ);

  float f = ${(1 / Math.tan((FOV * Math.PI) / 360)).toFixed(5)}; // 1 / tan(fov/2)
  gl_Position = vec4(view.x * f / max(uAspect, 0.18), view.y * f, -view.z, -view.z);

  float size = (1.05 + 2.0 * aRand);
  gl_PointSize = clamp((uDpr * size * 2.4) / max(-view.z, 0.35), 0.7, 4.5) * mix(0.35, 1.0, uIntro);

  vDepth = ring;
  vRand = aRand;
}
`;

const FRAG = `
precision highp float;

uniform float uIntensity;
uniform vec3  uPalette;
uniform float uEndingTint;

varying float vDepth;
varying float vRand;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.05, d);
  if (alpha < 0.01) discard;

  vec3 white  = vec3(0.96, 0.95, 0.93);
  vec3 deep   = vec3(0.34, 0.04, 0.09);

  // near the mouth it burns with the chapter palette, deep in it cools to dust
  vec3 tint = mix(uPalette, white, smoothstep(0.12, 0.5, vDepth) * 0.55);
  tint = mix(tint, deep, smoothstep(0.72, 1.0, vDepth) * 0.65);
  tint = mix(tint, tint * 1.25 + 0.12, uEndingTint);

  // the opening page has been travelling through fog for a while
  float fade = 1.0 - smoothstep(0.85, 1.0, vDepth) * 0.55;

  gl_FragColor = vec4(tint * (0.7 + vRand * 0.6), alpha * fade * uIntensity);
}
`;

const PALETTES = {
  1: [0.88, 0.16, 0.23],   // city — crimson
  2: [0.36, 0.52, 0.75],   // ocean — cold blue
  3: [0.69, 0.58, 0.45],   // room — lamplight
  4: [1.0, 0.25, 0.33],    // fracture — alarm
  5: [0.82, 0.77, 1.0],    // last memory — violet
  6: [0.88, 0.16, 0.23],   // choice
};

const palettes = { current: PALETTES[1].slice(), target: PALETTES[1].slice() };

/* ---------- gl plumbing ---------- */

let gl = null;
let program = null;
let buffers = [];
let uniforms = {};
let attrs = {};
let raf = 0;
let startTime = 0;
let staticDrawn = false;
let onVis = null;
let onLost = null;
let onRestored = null;
let onResize = null;
let onReduce = null;
let onPageHide = null;
let onPointer = null;
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

function compile(target, source) {
  const shader = gl.createShader(target);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader: ${log}`);
  }
  return shader;
}

function buildProgram() {
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`link: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function upload() {
  const ring = new Float32Array(COUNT);
  const angle = new Float32Array(COUNT);
  const rand = new Float32Array(COUNT);
  let i = 0;
  for (let r = 0; r < RINGS; r += 1) {
    for (let a = 0; a < PER_RING; a += 1) {
      ring[i] = r / (RINGS - 1);
      angle[i] = (a / PER_RING) * Math.PI * 2;
      rand[i] = ((r * 131 + a * 17) % 997) / 997; // deterministic, no Math.random
      i += 1;
    }
  }
  const make = (data) => {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    buffers.push(buf);
    return buf;
  };
  make(ring);
  make(angle);
  make(rand);

  attrs.ring = gl.getAttribLocation(program, 'aRing');
  attrs.angle = gl.getAttribLocation(program, 'aAngle');
  attrs.rand = gl.getAttribLocation(program, 'aRand');

  ['uTime', 'uAspect', 'uDpr', 'uIntro', 'uScroll', 'uChapter', 'uWarp',
    'uMouse', 'uIntensity', 'uPalette', 'uEndingTint'].forEach((name) => {
    uniforms[name] = gl.getUniformLocation(program, name);
  });
}

function bindAttrs() {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
  gl.enableVertexAttribArray(attrs.ring);
  gl.vertexAttribPointer(attrs.ring, 1, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers[1]);
  gl.enableVertexAttribArray(attrs.angle);
  gl.vertexAttribPointer(attrs.angle, 1, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers[2]);
  gl.enableVertexAttribArray(attrs.rand);
  gl.vertexAttribPointer(attrs.rand, 1, gl.FLOAT, false, 0, 0);
}

function resize() {
  if (!gl || state.disposed) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    state.dpr = dpr;
    if (!state.running) draw(startTime + 1200); // resizing clears the buffer
  }
}

function draw(t) {
  if (!gl || state.disposed) return;
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;

  // ease the palette so chapter changes feel like atmosphere, not a switch
  for (let i = 0; i < 3; i += 1) {
    palettes.current[i] += (palettes.target[i] - palettes.current[i]) * 0.045;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.012, 0.014, 0.022, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  bindAttrs();

  const chapter = Math.max(1, Math.min(6, Math.round(state.chapter) || 1));
  gl.uniform1f(uniforms.uTime, (t - startTime) / 1000);
  gl.uniform1f(uniforms.uAspect, canvas.width / canvas.height);
  gl.uniform1f(uniforms.uDpr, state.dpr);
  gl.uniform1f(uniforms.uIntro, Math.min(1, (t - startTime) / 1600));
  gl.uniform1f(uniforms.uScroll, state.scroll);
  gl.uniform1f(uniforms.uChapter, state.chapter);
  gl.uniform1f(uniforms.uWarp, chapter === 4 ? 1 : 0);
  gl.uniform2f(uniforms.uMouse, mouse.x, mouse.y);
  gl.uniform3f(uniforms.uPalette, palettes.current[0], palettes.current[1], palettes.current[2]);
  gl.uniform1f(uniforms.uEndingTint, state.ending === 'none' ? 0 : 0.55);
  gl.uniform1f(uniforms.uIntensity,
    chapter === 3 ? 0.42 : chapter === 5 ? 0.6 : chapter === 6 ? 0.72 : 0.82);

  gl.drawArrays(gl.POINTS, 0, COUNT);
  state.frames += 1;
}

function loop(t) {
  if (state.disposed) return;
  draw(t);
  raf = requestAnimationFrame(loop);
}

function play() {
  if (state.disposed || state.running) return;
  state.running = true;
  state.paused = false;
  raf = requestAnimationFrame(loop);
}

function stop() {
  state.running = false;
  state.paused = true;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function drawStatic() {
  if (!gl || state.disposed) return;
  staticDrawn = true;
  state.paused = true;
  draw(startTime + 1600);
}

function showFallback(reason) {
  state.backend = reason;
  canvas.hidden = true;
  if (fallback) fallback.hidden = false;
  if (rendererCell) rendererCell.textContent = 'Static fallback';
  if (signalCell) signalCell.textContent = 'Signal degraded';
  state.ready = true;
}

function init() {
  startTime = performance.now();

  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
  } catch (err) {
    gl = null;
  }
  if (!gl) {
    showFallback('no-webgl');
    return;
  }

  try {
    program = buildProgram();
    buffers = [];
    upload();
  } catch (err) {
    state.lastError = String((err && err.message) || err);
    showFallback('shader-failed');
    return;
  }

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  state.backend = 'webgl';
  if (rendererCell) rendererCell.textContent = 'WebGL · 19,200 pts';

  resize();

  onPointer = (event) => {
    mouse.tx = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (!window.matchMedia('(pointer: coarse)').matches) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  onVis = () => {
    if (document.hidden) stop();
    else if (!reduceQuery.matches) play();
  };
  document.addEventListener('visibilitychange', onVis);

  onResize = () => {
    resize();
    if (reduceQuery.matches) drawStatic();
  };
  window.addEventListener('resize', onResize, { passive: true });

  onReduce = () => {
    if (reduceQuery.matches) {
      stop();
      drawStatic();
    } else {
      play();
    }
  };
  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onReduce);

  onLost = (event) => {
    event.preventDefault();
    stop();
    showFallback('context-lost');
  };
  onRestored = () => {
    canvas.hidden = false;
    if (fallback) fallback.hidden = true;
    if (rendererCell) rendererCell.textContent = 'WebGL · 19,200 pts';
    if (signalCell) signalCell.textContent = 'Signal stable';
    try {
      program = buildProgram();
      buffers = [];
      upload();
      resize();
      if (reduceQuery.matches) drawStatic();
      else play();
    } catch (err) {
      state.lastError = String((err && err.message) || err);
      showFallback('context-restore-failed');
    }
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  onPageHide = () => { if (raf) cancelAnimationFrame(raf); };
  window.addEventListener('pagehide', onPageHide);

  if (reduceQuery.matches) drawStatic();
  else play();

  state.ready = true;
}

init();

/* ---------- public API ---------- */

/** Called by the scroll engine once per scroll update. */
export function setScroll(total, chapterFloat) {
  state.scroll = Math.max(0, Math.min(1, total));
  state.chapter = Math.max(1, Math.min(6, chapterFloat || 1));
  palettes.target = PALETTES[Math.round(state.chapter)] || PALETTES[1];
  if (reduceQuery.matches && !state.running) {
    staticDrawn = false;
    drawStatic();
  }
}

export function setEnding(name) {
  state.ending = name || 'none';
  if (name === 'restore') palettes.target = [1.0, 0.84, 0.62];
  if (name === 'erase') palettes.target = [0.52, 0.66, 0.86];
  if (name === 'rewrite') palettes.target = [0.78, 0.62, 1.0];
  if (reduceQuery.matches) {
    staticDrawn = false;
    drawStatic();
  }
}

export function dispose() {
  state.disposed = true;
  stop();
  if (onPointer) window.removeEventListener('pointermove', onPointer);
  if (onVis) document.removeEventListener('visibilitychange', onVis);
  if (onResize) window.removeEventListener('resize', onResize);
  if (onPageHide) window.removeEventListener('pagehide', onPageHide);
  if (reduceQuery.removeEventListener && onReduce) reduceQuery.removeEventListener('change', onReduce);
  if (canvas) {
    if (onLost) canvas.removeEventListener('webglcontextlost', onLost);
    if (onRestored) canvas.removeEventListener('webglcontextrestored', onRestored);
  }
  if (gl) {
    buffers.forEach((buf) => gl.deleteBuffer(buf));
    buffers.length = 0;
    if (program) gl.deleteProgram(program);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    gl = null;
  }
}
