'use strict';

/* ============================================================
 * Engine: sim registry, main loop, input, UI, shared utilities
 * ============================================================ */

/* ---------- Deterministic value noise (1D / 2D) + fBm ---------- */
const Noise = (() => {
  const P = new Uint8Array(512);
  let seed = 1337;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const perm = [];
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];

  const fade = t => t * t * (3 - 2 * t);
  const g1 = h => (h & 1 ? 1 : -1);

  function noise1(x) {
    const xi = Math.floor(x), xf = x - xi;
    const a = g1(P[xi & 255]) * xf;
    const b = g1(P[(xi + 1) & 255]) * (xf - 1);
    return a + fade(xf) * (b - a); // in ~[-1,1]
  }
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const h = (X, Y) => P[(P[X & 255] + Y) & 255] / 255 * 2 - 1;
    const u = fade(xf), v = fade(yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + u * (b - a) + v * (c - a) + u * v * (a - b - c + d);
  }
  function fbm1(x, oct = 4) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise1(x * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  function fbm2(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  return { noise1, noise2, fbm1, fbm2 };
})();

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

/* ---------- Shared gust model (used by rain / wind / snow) ----------
 * Mean wind + slow gust envelope + fast turbulence, all from 1D fBm.
 * Returns horizontal wind speed in m/s at time t and height y (0=ground,1=top).
 */
function gustWind(t, mean, gustiness = 0.5) {
  const slow = Noise.fbm1(t * 0.11, 3);        // gust envelope, ~10 s period
  const fast = Noise.fbm1(t * 0.9 + 40, 3);    // small-scale turbulence
  return mean * (1 + gustiness * (slow * 1.4 + fast * 0.35));
}

const Engine = (() => {
  const sims = [];
  let canvas, ctx, hud, current = null, currentIdx = -1;
  let paused = false, lastT = 0, fpsAcc = 0, fpsN = 0, fpsT = 0;
  const pointer = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, down: false, justDown: false, inside: false, button: 0 };

  function register(sim) { sims.push(sim); }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(320, r.width | 0), h = Math.max(240, r.height | 0);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    if (current) initCurrent();
  }

  function initCurrent() {
    hud.textContent = '';
    current.init({ ctx, w: canvas.width, h: canvas.height, hud });
    buildControls();
  }

  function select(i) {
    if (i < 0 || i >= sims.length) return;
    currentIdx = i;
    current = sims[i];
    document.querySelectorAll('#simList button').forEach((b, j) =>
      b.classList.toggle('active', j === i));
    document.getElementById('info').innerHTML =
      `<b>${current.name}</b><br>${current.info || ''}`;
    initCurrent();
  }

  function buildControls() {
    const cWrap = document.getElementById('controls');
    cWrap.innerHTML = '';
    (current.controls || []).forEach(c => {
      const div = document.createElement('div');
      div.className = 'ctl';
      const lab = document.createElement('label');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = c.name;
      const valSpan = document.createElement('span');
      valSpan.className = 'val';
      const fmt = c.fmt || (v => v);
      valSpan.textContent = fmt(c.get());
      lab.append(nameSpan, valSpan);
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = c.min; inp.max = c.max; inp.step = c.step || 'any';
      inp.value = c.get();
      inp.addEventListener('input', () => {
        c.set(parseFloat(inp.value));
        valSpan.textContent = fmt(c.get());
      });
      div.append(lab, inp);
      cWrap.append(div);
    });
    const aWrap = document.getElementById('actions');
    aWrap.innerHTML = '';
    (current.actions || []).forEach(a => {
      const b = document.createElement('button');
      b.textContent = a.name;
      if (a.isOn && a.isOn()) b.classList.add('on');
      b.addEventListener('click', () => {
        a.fn();
        // refresh toggle states + control values
        aWrap.querySelectorAll('button').forEach((bb, k) => {
          const act = current.actions[k];
          bb.classList.toggle('on', !!(act.isOn && act.isOn()));
        });
        cWrap.querySelectorAll('.ctl').forEach((d, k) => {
          const c = current.controls[k];
          d.querySelector('input').value = c.get();
          d.querySelector('.val').textContent = (c.fmt || (v => v))(c.get());
        });
      });
      aWrap.append(b);
    });
  }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      [pointer.x, pointer.y] = pointerPos(e);
      pointer.px = pointer.x; pointer.py = pointer.y;
      pointer.down = true; pointer.justDown = true;
      pointer.button = e.button;
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => {
      [pointer.x, pointer.y] = pointerPos(e);
      pointer.inside = true;
    });
    canvas.addEventListener('pointerup', () => { pointer.down = false; });
    canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.key === ' ') { paused = !paused; e.preventDefault(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= sims.length) select(n - 1);
    });
    window.addEventListener('resize', resize);
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
    lastT = t;
    // pointer velocity (px/s), smoothed
    const ivx = (pointer.x - pointer.px) / dt, ivy = (pointer.y - pointer.py) / dt;
    pointer.vx = lerp(pointer.vx, ivx, 0.5);
    pointer.vy = lerp(pointer.vy, ivy, 0.5);
    pointer.px = pointer.x; pointer.py = pointer.y;

    if (current && !paused) current.frame(dt, pointer);
    pointer.justDown = false;

    fpsAcc += dt; fpsN++;
    if (t - fpsT > 500) {
      document.getElementById('fps').textContent =
        `${Math.round(fpsN / fpsAcc)} fps${paused ? ' · paused' : ''}`;
      fpsAcc = 0; fpsN = 0; fpsT = t;
    }
  }

  function boot() {
    canvas = document.getElementById('view');
    ctx = canvas.getContext('2d');
    hud = document.getElementById('hud');
    const list = document.getElementById('simList');
    sims.forEach((s, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<span class="icon">${s.icon}</span>${s.name}<span class="num">${i + 1}</span>`;
      b.addEventListener('click', () => select(i));
      list.append(b);
    });
    bindInput();
    resize();
    select(0);
    requestAnimationFrame(t => { lastT = t; requestAnimationFrame(loop); });
  }

  return { register, boot };
})();
