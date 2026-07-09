/* ============================================================
 * PF Mock Builder — application logic.
 * Palette → canvas drag & drop, selection, move/resize with
 * grid snapping, undo/redo, properties inspector, zoom,
 * edit/render mode toggle, save/load (browser + JSON file).
 * ============================================================ */
(function () {
  'use strict';

  const R = window.Registry;
  const GRID = 10;
  const MIN_W = 24, MIN_H = 16;
  const LS_AUTOSAVE = 'pfmb.autosave.v1';
  const LS_LAYOUTS = 'pfmb.layouts.v1';
  const FILE_MAGIC = 'pf-mock-layout';

  /* ------------------------- state ------------------------- */
  let state = defaultState();
  let selection = new Set();
  let mode = 'edit';            /* 'edit' | 'render' */
  let zoom = 1;
  let history = [], future = [];
  let idSeq = 1;
  let focusSnapshot = null;     /* history snapshot taken when a prop field gains focus */

  function defaultState() {
    return {
      canvas: { title: 'My Application', width: 1180, height: 830, chrome: 'browser', grid: true },
      components: []
    };
  }
  function serialize() {
    return { app: FILE_MAGIC, version: 1, savedAt: new Date().toISOString(), canvas: state.canvas, components: state.components };
  }
  function nextId() {
    while (state.components.some(c => c.id === 'c' + idSeq)) idSeq++;
    return 'c' + idSeq++;
  }
  function snap(v) { return Math.round(v / GRID) * GRID; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function byId(id) { return state.components.find(c => c.id === id); }
  function selected() { return state.components.filter(c => selection.has(c.id)); }

  /* ------------------- container nesting ------------------- */
  /* Components carry an optional `parent` (container id). Coordinates stay
   * absolute; the parent link makes children follow container moves and
   * cascade on delete/duplicate. */
  function descendantsOf(id) {
    const out = [];
    const walk = (pid) => state.components.forEach(c => { if (c.parent === pid) { out.push(c); walk(c.id); } });
    walk(id);
    return out;
  }
  function subtree(c) { return [c, ...descendantsOf(c.id)]; }
  /* topmost container whose bounds contain the point, skipping excluded ids */
  function containerAtPt(cx, cy, excludeIds) {
    for (let i = state.components.length - 1; i >= 0; i--) {
      const t = state.components[i];
      if (excludeIds && excludeIds.has(t.id)) continue;
      const def = R.get(t.type);
      if (!def || !def.container) continue;
      if (cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.h) return t;
    }
    return null;
  }
  /* keep a child (and its subtree) after its container in z-order */
  function ensureAfter(c, t) {
    if (state.components.indexOf(c) > state.components.indexOf(t)) return;
    const sub = subtree(c);
    state.components = state.components.filter(x => !sub.includes(x));
    state.components.splice(state.components.indexOf(t) + 1, 0, ...sub);
  }
  /* re-evaluate which container a component sits in; returns the new
   * container def name when the parent changed, else null */
  function assignParent(c, excludeIds) {
    const t = containerAtPt(c.x + c.w / 2, c.y + c.h / 2, excludeIds || new Set(subtree(c).map(x => x.id)));
    const prev = c.parent || null;
    if (t) { c.parent = t.id; ensureAfter(c, t); } else { delete c.parent; }
    if ((c.parent || null) === prev) return null;
    return t ? R.get(t.type).name : 'the page';
  }
  function clearDropTargets() {
    el.canvas.querySelectorAll('.comp.drop-target').forEach(n => n.classList.remove('drop-target'));
  }
  function showDropTarget(t) {
    clearDropTargets();
    if (!t) return;
    const n = el.canvas.querySelector(`.comp[data-id="${t.id}"]`);
    if (n) n.classList.add('drop-target');
  }

  /* ----------------------- undo/redo ----------------------- */
  function snapshot() { return JSON.stringify(state); }
  function pushHistory(snap) {
    history.push(snap !== undefined ? snap : snapshot());
    if (history.length > 100) history.shift();
    future = [];
    updateToolbar();
  }
  function undo() {
    if (!history.length) return;
    future.push(snapshot());
    state = JSON.parse(history.pop());
    selection = new Set([...selection].filter(id => byId(id)));
    renderAll(); autosave();
  }
  function redo() {
    if (!future.length) return;
    history.push(snapshot());
    state = JSON.parse(future.pop());
    selection = new Set([...selection].filter(id => byId(id)));
    renderAll(); autosave();
  }

  /* ------------------------ DOM refs ------------------------ */
  const $ = (s) => document.querySelector(s);
  const el = {
    palette: $('#palette'), search: $('#paletteSearch'),
    canvasWrap: $('#canvasWrap'), scaler: $('#canvasScaler'), frame: $('#canvasFrame'),
    chromeBar: $('#chromeBar'), canvas: $('#canvas'), overlay: $('#overlay'),
    props: $('#props'), propsTitle: $('#propsTitle'),
    zoomLabel: $('#zoomLabel'), status: $('#statusBar'),
    modal: $('#modal'), modalTitle: $('#modalTitle'), modalBody: $('#modalBody'), modalActions: $('#modalActions'),
    toast: $('#appToast'), fileInput: $('#fileInput')
  };

  /* ======================== PALETTE ======================== */
  const CAT_GLYPHS = {
    'Form': '▭', 'Buttons': '▣', 'Data': '▤', 'Panels': '◫', 'Overlays': '❏',
    'Menus': '☰', 'Messages': '▷', 'File & Media': '◨', 'Misc': '✱'
  };
  const collapsedCats = new Set();

  function buildPalette() {
    const q = (el.search.value || '').trim().toLowerCase();
    let html = '';
    R.categories.forEach(cat => {
      const items = R.byCategory(cat).filter(d =>
        !q || d.name.toLowerCase().includes(q) || d.pf.toLowerCase().includes(q));
      if (!items.length) return;
      const collapsed = !q && collapsedCats.has(cat);
      html += `<div class="pal-cat" data-cat="${cat}">` +
        `<span class="pal-cat-arrow">${collapsed ? '▸' : '▾'}</span>${cat}` +
        `<span class="pal-cat-count">${items.length}</span></div>`;
      if (!collapsed) {
        items.forEach(d => {
          html += `<div class="pal-item" data-type="${d.type}" title="${R.esc(d.pf)} — drag to canvas, or double-click to add">` +
            `<span class="pal-glyph">${CAT_GLYPHS[cat] || '▭'}</span>` +
            `<span class="pal-name">${R.esc(d.name)}</span>` +
            `<span class="pal-pf">${R.esc(d.pf.replace(/^p:|^h:/, ''))}</span></div>`;
        });
      }
    });
    el.palette.innerHTML = html || '<div class="pal-empty">No components match.</div>';
  }

  el.search.addEventListener('input', buildPalette);
  el.palette.addEventListener('click', (ev) => {
    const cat = ev.target.closest('.pal-cat');
    if (cat) {
      const name = cat.dataset.cat;
      collapsedCats.has(name) ? collapsedCats.delete(name) : collapsedCats.add(name);
      buildPalette();
    }
  });
  el.palette.addEventListener('dblclick', (ev) => {
    const item = ev.target.closest('.pal-item');
    if (item) addComponent(item.dataset.type, null, null);
  });
  el.palette.addEventListener('pointerdown', (ev) => {
    const item = ev.target.closest('.pal-item');
    if (!item || ev.button !== 0) return;
    startPaletteDrag(item.dataset.type, ev);
  });

  function addComponent(type, x, y) {
    const def = R.get(type);
    if (!def || mode === 'render') return;
    pushHistory();
    const c = {
      id: nextId(), type: type,
      x: snap(x != null ? x : clamp((state.canvas.width - def.w) / 2, 0, 1e5)),
      y: snap(y != null ? y : clamp((state.canvas.height - def.h) / 2, 0, 1e5)),
      w: def.w, h: def.h, props: {}
    };
    c.x = clamp(c.x, 0, Math.max(0, state.canvas.width - 20));
    c.y = clamp(c.y, 0, Math.max(0, state.canvas.height - 16));
    state.components.push(c);
    const placed = assignParent(c, new Set([c.id]));
    selection = new Set([c.id]);
    renderAll(); autosave();
    setStatus(def.name + ' added' + (placed && placed !== 'the page' ? ' inside ' + placed : '') + ' — drag to position it');
    return c;
  }

  /* palette drag: ghost follows the pointer, drop on canvas creates */
  function startPaletteDrag(type, ev) {
    const def = R.get(type);
    if (!def || mode === 'render') return;
    ev.preventDefault();
    let ghost = null;
    const move = (e) => {
      if (!ghost) {
        if (Math.abs(e.clientX - ev.clientX) + Math.abs(e.clientY - ev.clientY) < 4) return;
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.style.width = (def.w * zoom) + 'px';
        ghost.style.height = (def.h * zoom) + 'px';
        ghost.innerHTML = `<span>${R.esc(def.name)}</span>`;
        document.body.appendChild(ghost);
      }
      ghost.style.left = (e.clientX - def.w * zoom / 2) + 'px';
      ghost.style.top = (e.clientY - def.h * zoom / 2) + 'px';
      const over = canvasPoint(e);
      ghost.classList.toggle('ok', !!over);
      showDropTarget(over ? containerAtPt(over.x, over.y, null) : null);
    };
    const up = (e) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      clearDropTargets();
      if (ghost) {
        ghost.remove();
        const pt = canvasPoint(e);
        if (pt) addComponent(type, pt.x - def.w / 2, pt.y - def.h / 2);
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  /* pointer position in canvas coordinates, or null if outside */
  function canvasPoint(e) {
    const r = el.canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }

  /* ======================== CANVAS ======================== */
  function renderAll() {
    document.body.classList.toggle('render-mode', mode === 'render');
    el.canvas.style.width = state.canvas.width + 'px';
    el.canvas.style.height = state.canvas.height + 'px';
    el.canvas.classList.toggle('show-grid', mode === 'edit' && !!state.canvas.grid);
    el.scaler.style.transform = 'scale(' + zoom + ')';
    el.scaler.style.width = 'fit-content';
    el.canvasWrap.style.setProperty('--zw', (el.frame.offsetWidth * zoom) + 'px');
    renderChrome();

    let html = '';
    state.components.forEach((c, i) => {
      html += `<div class="comp" data-id="${c.id}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;z-index:${i + 1}">` +
        `<div class="comp-inner">${R.render(c, mode)}</div></div>`;
    });
    el.canvas.innerHTML = html;
    renderSelectionUI();
    renderProps();
    updateToolbar();
  }

  function renderChrome() {
    const ch = state.canvas.chrome, t = R.esc(state.canvas.title || 'Untitled');
    el.frame.className = 'canvas-frame chrome-' + ch;
    if (ch === 'browser') {
      el.chromeBar.innerHTML = `<span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span>` +
        `<span class="chrome-url">https://myapp.example.com — ${t}</span>`;
    } else if (ch === 'window') {
      el.chromeBar.innerHTML = `<span class="chrome-title">${t}</span><span class="chrome-winbtns">–&nbsp;&nbsp;▢&nbsp;&nbsp;✕</span>`;
    } else {
      el.chromeBar.innerHTML = '';
    }
  }

  function renderComp(c) {
    const node = el.canvas.querySelector(`.comp[data-id="${c.id}"]`);
    if (!node) return;
    node.style.left = c.x + 'px'; node.style.top = c.y + 'px';
    node.style.width = c.w + 'px'; node.style.height = c.h + 'px';
    node.firstElementChild.innerHTML = R.render(c, mode);
  }

  /* selection outlines + resize handles (in the overlay layer) */
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  function renderSelectionUI() {
    if (mode === 'render') { el.overlay.innerHTML = ''; return; }
    let html = '';
    selected().forEach(c => {
      html += `<div class="sel-box" data-id="${c.id}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px">`;
      if (selection.size === 1) {
        HANDLES.forEach(h => html += `<span class="handle h-${h}" data-h="${h}"></span>`);
        html += `<span class="sel-size">${c.w} × ${c.h}</span>`;
      }
      html += '</div>';
    });
    el.overlay.innerHTML = html;
  }

  /* ---------- canvas pointer interactions ---------- */
  let drag = null; /* {kind:'move'|'resize'|'marquee', ...} */

  el.canvas.addEventListener('pointerdown', onCanvasDown);
  el.overlay.addEventListener('pointerdown', onCanvasDown);

  function onCanvasDown(ev) {
    if (mode === 'render' || ev.button !== 0) return;
    ev.preventDefault();
    const handle = ev.target.closest('.handle');
    const compNode = ev.target.closest('.comp') ||
      (ev.target.closest('.sel-box') && !handle ? topCompAt(canvasPoint(ev)) : null);

    if (handle) {
      const c = selected()[0];
      if (!c) return;
      drag = { kind: 'resize', h: handle.dataset.h, id: c.id, start: { ...c }, snap: snapshot(), moved: false, px: ev.clientX, py: ev.clientY };
    } else if (compNode) {
      const id = compNode.dataset ? compNode.dataset.id : compNode.id;
      if (ev.shiftKey) {
        selection.has(id) ? selection.delete(id) : selection.add(id);
        renderSelectionUI(); renderProps();
        return;
      }
      if (!selection.has(id)) { selection = new Set([id]); renderSelectionUI(); renderProps(); }
      /* moving a container also moves everything nested inside it */
      const moveSet = new Map();
      selected().forEach(c => subtree(c).forEach(x => moveSet.set(x.id, x)));
      drag = {
        kind: 'move', snap: snapshot(), moved: false, px: ev.clientX, py: ev.clientY,
        movedIds: new Set(moveSet.keys()),
        starts: [...moveSet.values()].map(c => ({ id: c.id, x: c.x, y: c.y }))
      };
    } else {
      /* empty canvas: start a marquee selection */
      const pt = canvasPoint(ev);
      if (!pt) return;
      if (!ev.shiftKey) { selection.clear(); renderSelectionUI(); renderProps(); }
      drag = { kind: 'marquee', x0: pt.x, y0: pt.y, keep: new Set(selection), node: null };
    }
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp);
  }

  /* the topmost component whose bounds contain the point (z order) */
  function topCompAt(pt) {
    if (!pt) return null;
    for (let i = state.components.length - 1; i >= 0; i--) {
      const c = state.components[i];
      if (pt.x >= c.x && pt.x <= c.x + c.w && pt.y >= c.y && pt.y <= c.y + c.h) {
        return el.canvas.querySelector(`.comp[data-id="${c.id}"]`);
      }
    }
    return null;
  }

  function onDragMove(ev) {
    if (!drag) return;
    if (drag.kind === 'move') {
      const dx = (ev.clientX - drag.px) / zoom, dy = (ev.clientY - drag.py) / zoom;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      drag.moved = true;
      drag.starts.forEach(s => {
        const c = byId(s.id);
        if (!c) return;
        c.x = clamp(snap(s.x + dx), -c.w + 20, state.canvas.width - 20);
        c.y = clamp(snap(s.y + dy), 0, state.canvas.height - 16);
        const node = el.canvas.querySelector(`.comp[data-id="${c.id}"]`);
        if (node) { node.style.left = c.x + 'px'; node.style.top = c.y + 'px'; }
      });
      renderSelectionUI();
      const pt = canvasPoint(ev);
      showDropTarget(pt ? containerAtPt(pt.x, pt.y, drag.movedIds) : null);
      const c0 = byId(drag.starts[0].id);
      if (c0) setStatus(`x ${c0.x}  y ${c0.y}`);
    } else if (drag.kind === 'resize') {
      const dx = (ev.clientX - drag.px) / zoom, dy = (ev.clientY - drag.py) / zoom;
      drag.moved = true;
      const c = byId(drag.id), s = drag.start, h = drag.h;
      if (!c) return;
      let x = s.x, y = s.y, w = s.w, hh = s.h;
      if (h.includes('e')) w = s.w + dx;
      if (h.includes('s')) hh = s.h + dy;
      if (h.includes('w')) { w = s.w - dx; x = s.x + dx; }
      if (h.includes('n')) { hh = s.h - dy; y = s.y + dy; }
      w = snap(w); hh = snap(hh); x = snap(x); y = snap(y);
      if (w < MIN_W) { if (h.includes('w')) x -= (MIN_W - w); w = MIN_W; }
      if (hh < MIN_H) { if (h.includes('n')) y -= (MIN_H - hh); hh = MIN_H; }
      c.x = x; c.y = y; c.w = w; c.h = hh;
      renderComp(c); renderSelectionUI();
      setStatus(`${c.w} × ${c.h}`);
    } else if (drag.kind === 'marquee') {
      const pt = canvasPoint(ev) || lastInsidePoint(ev);
      if (!pt) return;
      if (!drag.node) {
        drag.node = document.createElement('div');
        drag.node.className = 'marquee';
        el.overlay.appendChild(drag.node);
      }
      const x = Math.min(drag.x0, pt.x), y = Math.min(drag.y0, pt.y);
      const w = Math.abs(pt.x - drag.x0), h = Math.abs(pt.y - drag.y0);
      Object.assign(drag.node.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      selection = new Set(drag.keep);
      state.components.forEach(c => {
        if (c.x < x + w && c.x + c.w > x && c.y < y + h && c.y + c.h > y) selection.add(c.id);
      });
      [...el.overlay.querySelectorAll('.sel-box')].forEach(n => n.remove());
      selected().forEach(c => {
        const b = document.createElement('div');
        b.className = 'sel-box';
        Object.assign(b.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' });
        el.overlay.appendChild(b);
      });
    }
  }
  function lastInsidePoint(e) {
    const r = el.canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / zoom, 0, state.canvas.width),
      y: clamp((e.clientY - r.top) / zoom, 0, state.canvas.height)
    };
  }

  function onDragUp() {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragUp);
    clearDropTargets();
    if (!drag) return;
    if ((drag.kind === 'move' || drag.kind === 'resize') && drag.moved) {
      let placed = null;
      if (drag.kind === 'move') {
        /* re-evaluate container membership for each moved root */
        selected().forEach(c => { placed = assignParent(c, drag.movedIds) || placed; });
      } else {
        const c = byId(drag.id);
        if (c) placed = assignParent(c);
      }
      pushHistory(drag.snap);
      autosave();
      drag = null;
      renderAll();                       /* z-order may have changed on reparent */
      setStatus(placed ? (placed === 'the page' ? 'Detached from container' : 'Placed inside ' + placed) : '');
      return;
    }
    if (drag.kind === 'marquee' && drag.node) drag.node.remove();
    drag = null;
    renderSelectionUI(); renderProps();
    setStatus('');
  }

  /* ------------------- keyboard shortcuts ------------------- */
  document.addEventListener('keydown', (ev) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.key.toLowerCase() === 'z' && !inField) { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (mod && ev.key.toLowerCase() === 'y' && !inField) { ev.preventDefault(); redo(); return; }
    if (mod && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveDialog(); return; }
    if (ev.key === 'Escape') {
      if (el.modal.classList.contains('open')) { closeModal(); return; }
      if (mode === 'render') { setMode('edit'); return; }
      selection.clear(); renderSelectionUI(); renderProps();
      return;
    }
    if (inField || mode === 'render') return;
    if (mod && ev.key.toLowerCase() === 'a') { ev.preventDefault(); selection = new Set(state.components.map(c => c.id)); renderSelectionUI(); renderProps(); return; }
    if (mod && ev.key.toLowerCase() === 'd') { ev.preventDefault(); duplicateSelection(); return; }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && selection.size) { ev.preventDefault(); deleteSelection(); return; }
    const nudges = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (nudges[ev.key] && selection.size) {
      ev.preventDefault();
      const step = ev.shiftKey ? GRID : 1;
      pushHistory();
      const moveSet = new Map();
      selected().forEach(c => subtree(c).forEach(x => moveSet.set(x.id, x)));
      moveSet.forEach(c => {
        c.x = clamp(c.x + nudges[ev.key][0] * step, -c.w + 20, state.canvas.width - 20);
        c.y = clamp(c.y + nudges[ev.key][1] * step, 0, state.canvas.height - 16);
        renderComp(c);
      });
      renderSelectionUI(); renderProps(); autosave();
    }
  });

  function deleteSelection() {
    if (!selection.size) return;
    pushHistory();
    const del = new Set();
    selected().forEach(c => subtree(c).forEach(x => del.add(x.id)));
    state.components = state.components.filter(c => !del.has(c.id));
    selection.clear();
    renderAll(); autosave();
    setStatus('Deleted');
  }
  function duplicateSelection() {
    if (!selection.size) return;
    pushHistory();
    const roots = selected();
    const all = new Map();
    roots.forEach(c => subtree(c).forEach(x => all.set(x.id, x)));
    const idMap = {};
    const clones = [...all.values()].map(c => {
      const n = JSON.parse(JSON.stringify(c));
      idMap[c.id] = n.id = nextId();
      n.x += 20; n.y += 20;
      return n;
    });
    clones.forEach(n => { if (n.parent && idMap[n.parent]) n.parent = idMap[n.parent]; });
    state.components.push(...clones);
    selection = new Set(roots.map(c => idMap[c.id]));
    renderAll(); autosave();
  }

  /* ==================== PROPERTIES PANEL ==================== */
  function renderProps() {
    const sel = selected();
    if (mode === 'render') {
      el.propsTitle.textContent = 'Render mode';
      el.props.innerHTML = '<div class="props-hint">This is the rendered PrimeFaces preview.<br><br>Click <b>✏️ Edit</b> (or press Esc) to go back to editing.</div>';
      return;
    }
    if (sel.length === 0) return renderCanvasProps();
    if (sel.length > 1) return renderMultiProps(sel);
    renderSingleProps(sel[0]);
  }

  function field(label, inner) {
    return `<div class="prop-field"><label>${label}</label>${inner}</div>`;
  }

  function renderCanvasProps() {
    el.propsTitle.textContent = 'Page';
    el.props.innerHTML =
      field('Title', `<input type="text" data-canvas="title" value="${R.esc(state.canvas.title)}">`) +
      `<div class="prop-row">` +
      field('Width', `<input type="number" data-canvas="width" value="${state.canvas.width}" min="200" step="10">`) +
      field('Height', `<input type="number" data-canvas="height" value="${state.canvas.height}" min="200" step="10">`) +
      `</div>` +
      field('Frame', `<select data-canvas="chrome">` +
        ['browser', 'window', 'none'].map(o => `<option value="${o}" ${state.canvas.chrome === o ? 'selected' : ''}>${o}</option>`).join('') + `</select>`) +
      field('', `<label class="prop-check"><input type="checkbox" data-canvas="grid" ${state.canvas.grid ? 'checked' : ''}> Show grid</label>`) +
      `<div class="props-hint">Drag components from the palette onto the page.<br><br>` +
      `<b>Tips</b><br>· Double-click a palette item to add it<br>· Drag on empty space to select several<br>· Shift+click adds to the selection<br>` +
      `· Arrows nudge (Shift = grid step)<br>· Ctrl+D duplicates, Del deletes<br>· Ctrl+Z / Ctrl+Shift+Z undo / redo</div>`;
    wireProps();
  }

  function renderMultiProps(sel) {
    el.propsTitle.textContent = sel.length + ' components';
    const A = (k, glyph, tip) => `<button class="btn-sm" data-align="${k}" title="${tip}">${glyph}</button>`;
    el.props.innerHTML =
      `<div class="prop-field"><label>Align</label><div class="align-grid">` +
      A('left', '⇤', 'Align left') + A('hcenter', '↔', 'Center horizontally') + A('right', '⇥', 'Align right') +
      A('top', '⤒', 'Align top') + A('vcenter', '↕', 'Center vertically') + A('bottom', '⤓', 'Align bottom') +
      `</div></div>` +
      `<div class="prop-field"><label>Actions</label>` +
      `<button class="btn-sm" data-act="duplicate">⧉ Duplicate</button>` +
      `<button class="btn-sm btn-danger" data-act="delete">🗑 Delete</button></div>`;
    wireProps();
  }

  function renderSingleProps(c) {
    const def = R.get(c.type);
    const d = R.resolve(c);
    el.propsTitle.innerHTML = `${R.esc(def.name)} <span class="props-pf">${R.esc(def.pf)}</span>`;
    let html =
      `<div class="prop-row">` +
      field('X', `<input type="number" data-geo="x" value="${c.x}" step="${GRID}">`) +
      field('Y', `<input type="number" data-geo="y" value="${c.y}" step="${GRID}">`) +
      `</div><div class="prop-row">` +
      field('W', `<input type="number" data-geo="w" value="${c.w}" step="${GRID}" min="${MIN_W}">`) +
      field('H', `<input type="number" data-geo="h" value="${c.h}" step="${GRID}" min="${MIN_H}">`) +
      `</div>`;
    def.props.forEach(p => {
      const v = d[p.k];
      if (p.t === 'text') html += field(p.n, `<input type="text" data-prop="${p.k}" value="${R.esc(v)}">`);
      else if (p.t === 'num') html += field(p.n, `<input type="number" data-prop="${p.k}" value="${Number(v) || 0}">`);
      else if (p.t === 'bool') html += field('', `<label class="prop-check"><input type="checkbox" data-prop="${p.k}" ${v ? 'checked' : ''}> ${p.n}</label>`);
      else if (p.t === 'sel') html += field(p.n, `<select data-prop="${p.k}">` + p.o.map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${o}</option>`).join('') + `</select>`);
      else if (p.t === 'list') html += field(p.n + ' (one per line)', `<textarea rows="4" data-prop="${p.k}">${R.esc(v)}</textarea>`);
    });
    if (c.parent && byId(c.parent)) {
      const pDef = R.get(byId(c.parent).type);
      html += `<div class="prop-field"><label>Container</label>` +
        `<div class="inside-row">Inside <b>${R.esc(pDef ? pDef.name : c.parent)}</b>` +
        `<button class="btn-sm" data-act="detach" title="Detach from the container (keeps position)">Detach</button></div></div>`;
    }
    html +=
      `<div class="prop-field"><label>Arrange</label>` +
      `<button class="btn-sm" data-act="front" title="Bring to front">⬆⬆</button>` +
      `<button class="btn-sm" data-act="forward" title="Bring forward">⬆</button>` +
      `<button class="btn-sm" data-act="backward" title="Send backward">⬇</button>` +
      `<button class="btn-sm" data-act="back" title="Send to back">⬇⬇</button></div>` +
      `<div class="prop-field"><label>Actions</label>` +
      `<button class="btn-sm" data-act="duplicate">⧉ Duplicate</button>` +
      `<button class="btn-sm btn-danger" data-act="delete">🗑 Delete</button></div>`;
    el.props.innerHTML = html;
    wireProps();
  }

  function wireProps() {
    el.props.querySelectorAll('input, select, textarea').forEach(inp => {
      inp.addEventListener('focus', () => { focusSnapshot = snapshot(); });
      inp.addEventListener('input', () => applyPropInput(inp, false));
      inp.addEventListener('change', () => applyPropInput(inp, true));
    });
    el.props.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'delete') deleteSelection();
      else if (act === 'duplicate') duplicateSelection();
      else if (act === 'detach') {
        const c = selected()[0];
        if (c && c.parent) { pushHistory(); delete c.parent; renderAll(); autosave(); }
      }
      else reorder(act);
    }));
    el.props.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => alignSelection(b.dataset.align)));
  }

  function applyPropInput(inp, commit) {
    const val = inp.type === 'checkbox' ? inp.checked :
                inp.type === 'number' ? Number(inp.value) : inp.value;
    if (inp.dataset.canvas) {
      const k = inp.dataset.canvas;
      if (k === 'width' || k === 'height') state.canvas[k] = clamp(Number(inp.value) || 200, 200, 6000);
      else state.canvas[k] = val;
      el.canvas.style.width = state.canvas.width + 'px';
      el.canvas.style.height = state.canvas.height + 'px';
      el.canvas.classList.toggle('show-grid', mode === 'edit' && !!state.canvas.grid);
      renderChrome();
    } else {
      const c = selected()[0];
      if (!c) return;
      if (inp.dataset.geo) {
        const k = inp.dataset.geo;
        const nv = Math.max(k === 'w' ? MIN_W : k === 'h' ? MIN_H : -1e5, Number(inp.value) || 0);
        if (k === 'x' || k === 'y') {
          const delta = nv - c[k];
          descendantsOf(c.id).forEach(dc => { dc[k] += delta; renderComp(dc); });
        }
        c[k] = nv;
      } else if (inp.dataset.prop) {
        c.props = c.props || {};
        c.props[inp.dataset.prop] = val;
      }
      renderComp(c); renderSelectionUI();
    }
    if (commit && focusSnapshot != null) {
      if (focusSnapshot !== snapshot()) pushHistory(focusSnapshot);
      focusSnapshot = snapshot();
      autosave();
    }
  }

  function reorder(act) {
    const c = selected()[0];
    if (!c) return;
    const i = state.components.indexOf(c);
    pushHistory();
    state.components.splice(i, 1);
    let j = act === 'front' ? state.components.length : act === 'back' ? 0 :
            act === 'forward' ? Math.min(state.components.length, i + 1) : Math.max(0, i - 1);
    state.components.splice(j, 0, c);
    renderAll(); autosave();
  }

  function alignSelection(how) {
    const sel = selected();
    if (sel.length < 2) return;
    pushHistory();
    const minX = Math.min(...sel.map(c => c.x)), maxX = Math.max(...sel.map(c => c.x + c.w));
    const minY = Math.min(...sel.map(c => c.y)), maxY = Math.max(...sel.map(c => c.y + c.h));
    sel.forEach(c => {
      if (how === 'left') c.x = minX;
      if (how === 'right') c.x = maxX - c.w;
      if (how === 'hcenter') c.x = snap(minX + (maxX - minX - c.w) / 2);
      if (how === 'top') c.y = minY;
      if (how === 'bottom') c.y = maxY - c.h;
      if (how === 'vcenter') c.y = snap(minY + (maxY - minY - c.h) / 2);
      renderComp(c);
    });
    renderSelectionUI(); autosave();
  }

  /* ======================= TOOLBAR ======================= */
  function setMode(m) {
    mode = m;
    selection.clear();
    renderAll();
    setStatus(m === 'render' ? 'Rendered with PrimeFaces components — press Esc to edit' : '');
  }
  function setZoom(z) {
    zoom = clamp(Math.round(z * 20) / 20, 0.4, 2);
    el.zoomLabel.textContent = Math.round(zoom * 100) + '%';
    renderAll();
  }

  function updateToolbar() {
    $('#btnUndo').disabled = !history.length;
    $('#btnRedo').disabled = !future.length;
    const rb = $('#btnRender');
    rb.innerHTML = mode === 'edit' ? '▶ Render' : '✏️ Edit';
    rb.title = mode === 'edit' ? 'Preview with PrimeFaces components (Esc to return)' : 'Back to wireframe editing (Esc)';
    rb.classList.toggle('rendering', mode === 'render');
  }

  $('#btnRender').addEventListener('click', () => setMode(mode === 'edit' ? 'render' : 'edit'));
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnZoomIn').addEventListener('click', () => setZoom(zoom + 0.1));
  $('#btnZoomOut').addEventListener('click', () => setZoom(zoom - 0.1));
  $('#zoomLabel').addEventListener('click', () => setZoom(1));
  $('#btnNew').addEventListener('click', newLayout);
  $('#btnOpen').addEventListener('click', openDialog);
  $('#btnSave').addEventListener('click', saveDialog);
  $('#btnExport').addEventListener('click', exportFile);
  $('#btnPng').addEventListener('click', exportPng);
  $('#btnImport').addEventListener('click', () => el.fileInput.click());
  $('#btnHelp').addEventListener('click', helpDialog);

  /* ==================== SAVE / LOAD ==================== */
  function autosave() {
    try { localStorage.setItem(LS_AUTOSAVE, JSON.stringify(serialize())); } catch (e) { /* storage full/blocked */ }
  }
  function loadLayoutData(data, sourceName) {
    if (!data || data.app !== FILE_MAGIC || !Array.isArray(data.components)) {
      toast('Not a valid layout file', true);
      return false;
    }
    pushHistory();
    state = {
      canvas: Object.assign(defaultState().canvas, data.canvas || {}),
      components: data.components.filter(c => c && c.id && R.get(c.type))
    };
    /* drop parent links that point at removed/unknown components */
    const ids = new Set(state.components.map(c => c.id));
    state.components.forEach(c => { if (c.parent && !ids.has(c.parent)) delete c.parent; });
    selection.clear();
    setMode('edit');
    autosave();
    if (sourceName) toast('Loaded “' + sourceName + '”');
    return true;
  }

  function savedLayouts() {
    try { return JSON.parse(localStorage.getItem(LS_LAYOUTS)) || {}; } catch (e) { return {}; }
  }
  function writeLayouts(obj) {
    try { localStorage.setItem(LS_LAYOUTS, JSON.stringify(obj)); return true; }
    catch (e) { toast('Browser storage is full', true); return false; }
  }

  function newLayout() {
    showModal('New layout', '<p>Start a new empty layout?<br>The current layout stays in browser autosave/undo history until you leave.</p>', [
      { label: 'Cancel' },
      { label: 'New layout', primary: true, fn: () => {
          pushHistory();
          state = defaultState();
          selection.clear();
          setMode('edit'); autosave();
        } }
    ]);
  }

  function saveDialog() {
    const layouts = savedLayouts();
    showModal('Save layout',
      `<div class="prop-field"><label>Name</label><input id="saveName" type="text" value="${R.esc(state.canvas.title || 'My layout')}"></div>` +
      (Object.keys(layouts).length ? `<p class="modal-note">Existing: ${Object.keys(layouts).map(R.esc).join(', ')}</p>` : '') +
      `<p class="modal-note">Saves in this browser (localStorage). Use <b>Export</b> for a portable .json file.</p>`,
      [
        { label: 'Cancel' },
        { label: '💾 Save', primary: true, fn: () => {
            const name = ($('#saveName').value || 'Untitled').trim();
            const all = savedLayouts();
            all[name] = serialize();
            if (writeLayouts(all)) toast('Saved “' + name + '” in this browser');
          } }
      ]);
    setTimeout(() => { const n = $('#saveName'); if (n) { n.focus(); n.select(); } }, 50);
  }

  function openDialog() {
    const layouts = savedLayouts();
    const names = Object.keys(layouts).sort();
    let body = '';
    if (names.length) {
      body += '<div class="layout-list">' + names.map(n => {
        const at = layouts[n].savedAt ? new Date(layouts[n].savedAt).toLocaleString() : '';
        return `<div class="layout-row"><span class="layout-name">${R.esc(n)}</span><span class="layout-date">${at}</span>` +
          `<button class="btn-sm" data-open="${R.esc(n)}">Open</button>` +
          `<button class="btn-sm btn-danger" data-del="${R.esc(n)}" title="Delete">✕</button></div>`;
      }).join('') + '</div>';
    } else {
      body += '<p>No layouts saved in this browser yet.</p>';
    }
    body += `<p class="modal-note">You can also <b>Import</b> a .json layout file, or load the demo:</p>`;
    showModal('Open layout', body, [
      { label: 'Close' },
      { label: '📥 Import file…', fn: () => el.fileInput.click() },
      { label: '✨ Load demo layout', fn: () => loadLayoutData(window.SAMPLE_LAYOUT, 'Demo layout') }
    ]);
    el.modalBody.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
      loadLayoutData(savedLayouts()[b.dataset.open], b.dataset.open);
      closeModal();
    }));
    el.modalBody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const all = savedLayouts();
      delete all[b.dataset.del];
      writeLayouts(all);
      closeModal(); openDialog();
    }));
  }

  function exportFile() {
    const data = JSON.stringify(serialize(), null, 2);
    const filename = exportName() + '.mock.json';
    downloadBlob(new Blob([data], { type: 'application/json' }), filename);
    toast('Exported ' + filename);
  }

  /* ---------------------- PNG export ----------------------
   * The layout is rebuilt off-screen (so the page stylesheets apply),
   * every element's computed style is inlined, and the tree is
   * rasterized through an SVG <foreignObject> onto a 2x canvas.
   * Computed-style inlining is used instead of embedding the CSS text
   * because Chrome refuses to expose cssRules on file:// pages. */
  const XHTML_NS = 'http://www.w3.org/1999/xhtml', SVG_NS = 'http://www.w3.org/2000/svg';

  function inlineComputedStyles(root, probeHolder) {
    const defaults = {};
    function baseline(el) {
      const isSvg = el.namespaceURI === SVG_NS;
      const key = (isSvg ? 'svg:' : '') + el.tagName;
      if (!defaults[key]) {
        const probe = isSvg ? document.createElementNS(SVG_NS, el.tagName) : document.createElement(el.tagName);
        probeHolder.appendChild(probe);
        const cs = getComputedStyle(probe);
        const snap = {};
        for (let i = 0; i < cs.length; i++) snap[cs[i]] = cs.getPropertyValue(cs[i]);
        probe.remove();
        defaults[key] = snap;
      }
      return defaults[key];
    }
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach(el => {
      const cs = getComputedStyle(el);
      const base = baseline(el);
      let style = '';
      for (let i = 0; i < cs.length; i++) {
        const p = cs[i], v = cs.getPropertyValue(p);
        if (v !== base[p]) style += p + ':' + v + ';';
      }
      el.setAttribute('style', style);
    });
  }

  function exportPng() {
    const scale = 2;
    const w = state.canvas.width, h = state.canvas.height;
    const wire = mode === 'edit';
    /* off-screen stage: same DOM shape as the real canvas so all CSS
     * (theme, wireframe filter via the body class, hint hiding) applies */
    const stage = document.createElement('div');
    stage.className = 'render-mode';
    stage.style.cssText = 'position:fixed;left:-100000px;top:0;';
    const root = document.createElement('div');
    root.id = 'canvas';
    root.style.cssText = `width:${w}px;height:${h}px;position:relative;background:#fff;overflow:hidden;`;
    let inner = '';
    state.components.forEach((c, i) => {
      inner += `<div class="comp" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;z-index:${i + 1}">` +
        `<div class="comp-inner">${R.render(c, wire ? 'edit' : 'render')}</div></div>`;
    });
    root.innerHTML = inner;
    stage.appendChild(root);
    document.body.appendChild(stage);
    let svg;
    try {
      inlineComputedStyles(root, stage);
      const xhtml = new XMLSerializer().serializeToString(root);
      svg = `<svg xmlns="${SVG_NS}" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    } finally {
      stage.remove();
    }
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = w * scale; cv.height = h * scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      try {
        cv.toBlob(b => {
          if (!b) return toast('PNG export failed in this browser', true);
          downloadBlob(b, exportName() + (wire ? '-wireframe' : '') + '.png');
          toast('Exported PNG (' + (wire ? 'wireframe' : 'rendered') + ', ' + cv.width + '×' + cv.height + ')');
        });
      } catch (e) { toast('PNG export failed in this browser', true); }
    };
    img.onerror = () => toast('PNG export failed in this browser', true);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function exportName() {
    return (state.canvas.title || 'layout').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'layout';
  }
  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  el.fileInput.addEventListener('change', () => {
    const f = el.fileInput.files[0];
    el.fileInput.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { if (loadLayoutData(JSON.parse(rd.result), f.name)) closeModal(); }
      catch (e) { toast('Could not read that file as JSON', true); }
    };
    rd.readAsText(f);
  });

  function helpDialog() {
    showModal('PF Mock Builder — help',
      `<p><b>Sketch → Render.</b> Drag placeholders from the left palette onto the page, arrange them, then hit <b>▶ Render</b> to preview the same layout drawn with PrimeFaces-styled components and mock data.</p>` +
      `<table class="help-table">` +
      `<tr><td>Add component</td><td>drag from palette, or double-click it</td></tr>` +
      `<tr><td>Select</td><td>click · Shift+click adds · drag empty space for marquee · Ctrl/Cmd+A all</td></tr>` +
      `<tr><td>Move</td><td>drag · arrow keys nudge 1px · Shift+arrows ${GRID}px</td></tr>` +
      `<tr><td>Resize</td><td>drag the handles (single selection)</td></tr>` +
      `<tr><td>Duplicate / Delete</td><td>Ctrl/Cmd+D · Del</td></tr>` +
      `<tr><td>Undo / Redo</td><td>Ctrl/Cmd+Z · Ctrl/Cmd+Shift+Z</td></tr>` +
      `<tr><td>Containers</td><td>drop onto a Panel / Card / Fieldset / TabView / Dialog / Sidebar — it nests and moves with it (Detach in the inspector)</td></tr>` +
      `<tr><td>Save</td><td>Ctrl/Cmd+S (browser) · Export = portable .json</td></tr>` +
      `<tr><td>Export image</td><td>🖼 PNG exports the current mode (rendered or wireframe) at 2× resolution</td></tr>` +
      `<tr><td>Render ⇄ Edit</td><td>▶ Render button · Esc returns to edit</td></tr>` +
      `</table>` +
      `<p class="modal-note">Every placeholder maps to a PrimeFaces component (shown in the palette and inspector). Layouts autosave to this browser as you work.</p>`,
      [{ label: 'Got it', primary: true }]);
  }

  /* ---------------------- modal & toast ---------------------- */
  function showModal(title, bodyHtml, actions) {
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = bodyHtml;
    el.modalActions.innerHTML = '';
    (actions || [{ label: 'Close' }]).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' btn-primary' : '');
      b.innerHTML = a.label;
      b.addEventListener('click', () => { closeModal(); if (a.fn) a.fn(); });
      el.modalActions.appendChild(b);
    });
    el.modal.classList.add('open');
  }
  function closeModal() { el.modal.classList.remove('open'); }
  el.modal.addEventListener('pointerdown', (e) => { if (e.target === el.modal) closeModal(); });

  let toastTimer = null;
  function toast(msg, isError) {
    el.toast.textContent = msg;
    el.toast.className = 'app-toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  }
  function setStatus(msg) {
    el.status.textContent = msg || (mode === 'render'
      ? 'Render preview — Esc to edit'
      : state.components.length + ' component' + (state.components.length === 1 ? '' : 's'));
  }

  /* ------------------------- boot ------------------------- */
  (function boot() {
    buildPalette();
    let restored = false;
    try {
      const saved = JSON.parse(localStorage.getItem(LS_AUTOSAVE));
      if (saved && saved.app === FILE_MAGIC) {
        state = { canvas: Object.assign(defaultState().canvas, saved.canvas || {}), components: (saved.components || []).filter(c => R.get(c.type)) };
        restored = true;
      }
    } catch (e) { /* corrupt autosave — start fresh */ }
    if (!restored && window.SAMPLE_LAYOUT) {
      /* first visit: open the demo so the app doesn't start empty */
      state = { canvas: Object.assign(defaultState().canvas, window.SAMPLE_LAYOUT.canvas), components: window.SAMPLE_LAYOUT.components.slice() };
    }
    setZoom(1);
    setStatus('');
  })();
})();
