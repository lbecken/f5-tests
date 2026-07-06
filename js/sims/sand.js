'use strict';

/* ============================================================
 * Falling sand — cellular automaton on a fine grid.
 *  - each grain stores a vertical velocity; gravity accelerates
 *    it and it falls several cells per tick (not 1 cell/frame)
 *  - blocked grains topple diagonally with a probability that
 *    sets the angle of repose (~34° for dry sand)
 *  - bottom-up sweep with alternating x-direction to avoid bias
 *  - draw walls / erase with the material buttons
 * ============================================================ */
(() => {
  const CELL = 3;                 // px per cell
  const EMPTY = 0, SAND = 1, WALL = 2;
  const G_CELL = 0.35;            // gravity in cells/tick²  (tick = 1/60 s)
  const V_MAX = 8;                // max fall speed, cells/tick
  const P_TOPPLE = 0.85;          // probability of diagonal slide when blocked

  let W, H, ctx, hud;
  let cols, rows, type, vel, colr;   // grids
  let img, imgData, buf32;           // low-res framebuffer
  let off;                            // offscreen canvas at grid res
  let brush = 4, flow = 6, material = SAND;
  let grains = 0, sweepRight = true;

  const idx = (x, y) => y * cols + x;

  function palette() {
    // warm sand tones with per-grain variation
    const h = 36 + rand(-6, 6), s = rand(45, 60), l = rand(52, 68);
    return hsl2abgr(h, s, l);
  }
  // returns little-endian ABGR, the byte order of canvas ImageData
  function hsl2abgr(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return 0xff000000 | ((f(4) * 255) << 16) | ((f(8) * 255) << 8) | (f(0) * 255);
  }

  function clear() {
    type.fill(EMPTY); vel.fill(0); colr.fill(0xff000000);
    grains = 0;
    // two ledges so piles + repose angle are visible immediately
    const ly1 = (rows * 0.45) | 0, ly2 = (rows * 0.7) | 0;
    for (let x = (cols * 0.1) | 0; x < cols * 0.45; x++) setCell(x, ly1, WALL);
    for (let x = (cols * 0.55) | 0; x < cols * 0.9; x++) setCell(x, ly2, WALL);
  }

  function setCell(x, y, t) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = idx(x, y);
    if (t === SAND && type[i] === EMPTY) { grains++; colr[i] = palette(); vel[i] = 0; }
    if (t === EMPTY && type[i] === SAND) grains--;
    if (t === WALL) colr[i] = 0xff78645a; // ABGR slate
    type[i] = t;
  }

  function moveGrain(from, to) {
    type[to] = SAND; colr[to] = colr[from]; vel[to] = vel[from];
    type[from] = EMPTY; vel[from] = 0;
  }

  function stepCA() {
    sweepRight = !sweepRight;
    for (let y = rows - 2; y >= 0; y--) {
      const x0 = sweepRight ? 0 : cols - 1;
      const dx = sweepRight ? 1 : -1;
      for (let k = 0, x = x0; k < cols; k++, x += dx) {
        const i = idx(x, y);
        if (type[i] !== SAND) continue;

        // accelerate and try to fall floor(v) cells, scanning for blockers
        vel[i] = Math.min(V_MAX, vel[i] + G_CELL);
        let steps = Math.max(1, vel[i] | 0);
        let cy = y, moved = false;
        while (steps-- > 0 && cy + 1 < rows && type[idx(x, cy + 1)] === EMPTY) {
          cy++; moved = true;
        }
        if (moved) { moveGrain(i, idx(x, cy)); continue; }

        // blocked below → impact: lose most vertical speed
        vel[i] *= 0.3;

        // topple diagonally (both sides checked in random order)
        if (Math.random() < P_TOPPLE && y + 1 < rows) {
          const first = Math.random() < 0.5 ? -1 : 1;
          for (const s of [first, -first]) {
            const nx = x + s;
            if (nx < 0 || nx >= cols) continue;
            if (type[idx(nx, y + 1)] === EMPTY && type[idx(nx, y)] === EMPTY) {
              moveGrain(i, idx(nx, y + 1));
              break;
            }
          }
        }
      }
    }
  }

  function pour(cx, cy) {
    for (let n = 0; n < (material === SAND ? flow * 3 : 999); n++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * brush;
      const x = (cx + Math.cos(a) * rr) | 0;
      const y = (cy + Math.sin(a) * rr) | 0;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      if (material === EMPTY) { setCell(x, y, EMPTY); }
      else if (type[idx(x, y)] === EMPTY || material === EMPTY) setCell(x, y, material);
      if (material !== SAND && n > brush * brush * 4) break;
    }
  }

  const sim = {
    name: 'Falling Sand',
    icon: '⏳',
    info: 'Granular cellular automaton: grains carry velocity under gravity, '
        + 'topple diagonally when blocked — the slide probability sets the '
        + 'angle of repose (~34°). <b>Hold the mouse to pour.</b>',

    controls: [
      { name: 'Brush radius', min: 1, max: 14, step: 1,
        get: () => brush, set: v => { brush = v; }, fmt: v => v + ' c' },
      { name: 'Flow rate', min: 1, max: 20, step: 1,
        get: () => flow, set: v => { flow = v; } },
    ],
    actions: [
      { name: 'Sand', fn: () => { material = SAND; }, isOn: () => material === SAND },
      { name: 'Wall', fn: () => { material = WALL; }, isOn: () => material === WALL },
      { name: 'Erase', fn: () => { material = EMPTY; }, isOn: () => material === EMPTY },
      { name: 'Clear', fn: clear },
    ],

    init(env) {
      ({ ctx, w: W, h: H, hud } = env);
      cols = Math.ceil(W / CELL);
      rows = Math.ceil(H / CELL);
      type = new Uint8Array(cols * rows);
      vel = new Float32Array(cols * rows);
      colr = new Uint32Array(cols * rows);
      off = document.createElement('canvas');
      off.width = cols; off.height = rows;
      imgData = off.getContext('2d').createImageData(cols, rows);
      buf32 = new Uint32Array(imgData.data.buffer);
      clear();
    },

    frame(dt, ptr) {
      if (ptr.down) pour((ptr.x / CELL) | 0, (ptr.y / CELL) | 0);
      // hopper: trickles sand onto the ledges until there's a good pile
      if (grains < 6000) {
        for (let k = 0; k < 4; k++) {
          setCell(((cols * 0.27) | 0) + ((rand(-2, 2)) | 0), 1, SAND);
          setCell(((cols * 0.72) | 0) + ((rand(-2, 2)) | 0), 1, SAND);
        }
      }
      stepCA();
      render();
      hud.textContent = `${grains.toLocaleString()} grains   grid ${cols}×${rows}`;
    },
  };

  function render() {
    const bg = 0xff181014; // ABGR: dark
    for (let i = 0; i < type.length; i++) {
      buf32[i] = type[i] === EMPTY ? bg : colr[i];
    }
    off.getContext('2d').putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cols, rows, 0, 0, cols * CELL, rows * CELL);
  }

  Engine.register(sim);
})();
