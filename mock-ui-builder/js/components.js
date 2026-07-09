/* ============================================================
 * Registry — the palette of mock components.
 *
 * Every entry maps a mock placeholder to a PrimeFaces component
 * (`pf` holds the JSF tag name). The same markup is used in edit
 * mode (styled as a grayscale wireframe) and in render mode
 * (styled with the PrimeFaces "Saga" look), so the rendered UI
 * always matches the sketched layout exactly.
 *
 * Definition shape:
 *   type        registry key (stable — stored in saved layouts)
 *   name        human name shown in the palette
 *   pf          PrimeFaces tag, e.g. "p:commandButton"
 *   cat         palette category
 *   w, h        default size when dropped
 *   props       ordered prop schema: {k, n, t, d, o?}
 *               t: text | num | bool | sel | list  (list = one item per line)
 *   html(d, c, mode) -> markup. d = props merged with defaults.
 * ============================================================ */
(function (global) {
  'use strict';

  const M = global.MockData;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function lines(s) {
    return String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  }

  /* --- tiny inline icons (PrimeIcons are not available offline) --- */
  function svg(inner, vb) {
    return `<svg class="pi-svg" viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${inner}</svg>`;
  }
  const ST = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    chevD: svg(`<path d="M5 9l7 7 7-7" ${ST}/>`),
    chevU: svg(`<path d="M5 15l7-7 7 7" ${ST}/>`),
    chevL: svg(`<path d="M15 5l-7 7 7 7" ${ST}/>`),
    chevR: svg(`<path d="M9 5l7 7-7 7" ${ST}/>`),
    check: svg(`<path d="M4 12.5l5 5L20 6.5" ${ST}/>`),
    times: svg(`<path d="M6 6l12 12M18 6L6 18" ${ST}/>`),
    plus:  svg(`<path d="M12 5v14M5 12h14" ${ST}/>`),
    minus: svg(`<path d="M5 12h14" ${ST}/>`),
    search: svg(`<circle cx="10.5" cy="10.5" r="6" ${ST}/><path d="M15.2 15.2L21 21" ${ST}/>`),
    bars:  svg(`<path d="M4 6h16M4 12h16M4 18h16" ${ST}/>`),
    cal:   svg(`<rect x="4" y="5" width="16" height="15" rx="2" ${ST}/><path d="M4 10h16M8 3v4M16 3v4" ${ST}/>`),
    user:  svg(`<circle cx="12" cy="8" r="4" ${ST}/><path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6" ${ST}/>`),
    home:  svg(`<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" ${ST}/>`),
    trash: svg(`<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" ${ST}/>`),
    save:  svg(`<path d="M5 4h11l4 4v12H5z M8 4v5h7V4 M8 20v-7h8v7" ${ST}/>`),
    upload: svg(`<path d="M12 16V5M7 9l5-5 5 5M4 20h16" ${ST}/>`),
    warn:  svg(`<path d="M12 3L2 21h20L12 3zm0 7v5m0 3v.5" ${ST}/>`),
    info:  svg(`<circle cx="12" cy="12" r="9" ${ST}/><path d="M12 10.5V17m0-9.5v.5" ${ST}/>`),
    photo: svg(`<rect x="3" y="5" width="18" height="14" rx="2" ${ST}/><circle cx="8.5" cy="10" r="1.6" ${ST}/><path d="M3 17l5-5 4 4 4-5 5 6" ${ST}/>`),
    dots:  svg(`<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>`),
    dblL:  svg(`<path d="M11 5l-7 7 7 7M19 5l-7 7 7 7" ${ST}/>`),
    dblR:  svg(`<path d="M5 5l7 7-7 7M13 5l7 7-7 7" ${ST}/>`)
  };
  const NAMED_ICONS = { none: '', check: I.check, plus: I.plus, trash: I.trash, search: I.search, save: I.save, times: I.times, upload: I.upload, calendar: I.cal, user: I.user };

  function btn(label, opts) {
    opts = opts || {};
    const cls = ['p-button'];
    if (opts.sev && opts.sev !== 'primary') cls.push('p-button-' + opts.sev);
    if (opts.style === 'outlined') cls.push('p-button-outlined');
    if (opts.style === 'text') cls.push('p-button-text');
    if (opts.icon && !label) cls.push('p-button-icon-only');
    if (opts.cls) cls.push(opts.cls);
    return `<button type="button" class="${cls.join(' ')}" tabindex="-1">` +
      (opts.icon || '') + (label ? `<span class="p-button-label">${esc(label)}</span>` : '') +
      `</button>`;
  }
  function stars(value, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += `<span class="p-rating-star ${i < value ? 'on' : ''}">${i < value ? '★' : '☆'}</span>`;
    return s;
  }
  function checkboxBox(checked) {
    return `<span class="p-checkbox ${checked ? 'p-checked' : ''}">${checked ? I.check : ''}</span>`;
  }
  function radioBox(checked) {
    return `<span class="p-radiobutton ${checked ? 'p-checked' : ''}"><span class="p-radiobutton-dot"></span></span>`;
  }
  const SEV_OPTS = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'help'];
  const MSG_ICON = { info: I.info, success: I.check, warn: I.warn, error: I.times };

  /* Fill container with option rows, marking index `sel` selected */
  function listRows(opts, sel, cls) {
    return opts.map((o, i) =>
      `<div class="${cls} ${i === sel ? 'p-highlight' : ''}">${esc(o)}</div>`).join('');
  }

  function tableHtml(d, opts) {
    opts = opts || {};
    const cols = lines(d.columns);
    const rows = M.rows(Math.max(1, d.rows | 0));
    let h = `<div class="p-datatable ${d.striped ? 'p-striped' : ''} ${opts.tree ? 'p-treetable' : ''}">`;
    if (d.title) h += `<div class="p-datatable-header">${esc(d.title)}</div>`;
    h += '<div class="p-datatable-wrapper"><table><thead><tr>';
    cols.forEach((c, ci) => h += `<th>${esc(c)}${ci === 0 && d.sortable ? ' <span class="p-sort">▲</span>' : ''}</th>`);
    h += '</tr></thead><tbody>';
    rows.forEach((r, ri) => {
      h += '<tr>';
      cols.forEach((c, ci) => {
        let cell = esc(M.cell(c, ri));
        if (opts.tree && ci === 0) {
          const depth = ri % 3 === 0 ? 0 : 1;
          cell = `<span class="p-tt-indent" style="padding-left:${depth * 22}px">` +
                 `<span class="p-tt-toggler">${depth === 0 ? I.chevD : ''}</span>${cell}</span>`;
        }
        h += `<td>${cell}</td>`;
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    if (d.paginator) h += paginatorHtml();
    h += '</div>';
    return h;
  }
  function paginatorHtml() {
    let pages = '';
    for (let i = 1; i <= 4; i++) pages += `<span class="p-paginator-page ${i === 1 ? 'p-highlight' : ''}">${i}</span>`;
    return `<div class="p-paginator"><span class="p-paginator-el">${I.dblL}</span>` +
      `<span class="p-paginator-el">${I.chevL}</span>${pages}` +
      `<span class="p-paginator-el">${I.chevR}</span><span class="p-paginator-el">${I.dblR}</span></div>`;
  }
  function photoBox(mode, i, label) {
    if (mode === 'render') {
      return `<div class="p-photo p-photo-${(i % 6) + 1}">${I.photo}${label ? `<span class="p-photo-label">${esc(label)}</span>` : ''}</div>`;
    }
    return `<div class="p-photo p-photo-wire">${I.photo}${label ? `<span class="p-photo-label">${esc(label)}</span>` : ''}</div>`;
  }

  /* ---------------- chart drawing (inline SVG) ---------------- */
  const CHART_COLORS = ['#42A5F5', '#66BB6A', '#FFA726', '#26C6DA', '#7E57C2', '#EC407A'];
  function chartSvg(d, c) {
    const W = 400, H = 260, padT = 12, padR = 8, padB = 26;
    const n = 7, data = M.series(n, 20, 95, 3), data2 = M.series(n, 10, 70, 8);
    let g = '';
    const twoSeriesLegend =
      `<span class="ch-leg"><span class="ch-dot" style="background:${CHART_COLORS[0]}"></span>This year</span>` +
      `<span class="ch-leg"><span class="ch-dot" style="background:${CHART_COLORS[2]}"></span>Last year</span>`;
    let legend = twoSeriesLegend;

    if (d.type === 'bar' || d.type === 'line' || d.type === 'area') {
      const padL = 34, cw = W - padL - padR, ch = H - padT - padB;
      const x = (i) => padL + (i + 0.5) * (cw / n);
      const y = (v) => padT + ch - (v / 100) * ch;
      for (let v = 0; v <= 100; v += 25) {
        g += `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" class="ch-grid"/>` +
             `<text x="${padL - 6}" y="${y(v) + 3.5}" class="ch-lbl" text-anchor="end">${v}</text>`;
      }
      for (let i = 0; i < n; i++) g += `<text x="${x(i)}" y="${H - 8}" class="ch-lbl" text-anchor="middle">${M.month(i)}</text>`;

      if (d.type === 'bar') {
        const bw = cw / n * 0.28;
        for (let i = 0; i < n; i++) {
          g += `<rect x="${x(i) - bw - 1.5}" y="${y(data[i])}" width="${bw}" height="${y(0) - y(data[i])}" fill="${CHART_COLORS[0]}" rx="2"/>`;
          g += `<rect x="${x(i) + 1.5}" y="${y(data2[i])}" width="${bw}" height="${y(0) - y(data2[i])}" fill="${CHART_COLORS[2]}" rx="2"/>`;
        }
      } else {
        const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
        const pts2 = data2.map((v, i) => `${x(i)},${y(v)}`).join(' ');
        if (d.type === 'area') {
          g += `<polygon points="${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}" fill="${CHART_COLORS[0]}" opacity="0.22"/>`;
          g += `<polygon points="${x(0)},${y(0)} ${pts2} ${x(n - 1)},${y(0)}" fill="${CHART_COLORS[2]}" opacity="0.22"/>`;
        }
        g += `<polyline points="${pts}" fill="none" stroke="${CHART_COLORS[0]}" stroke-width="2.5"/>`;
        g += `<polyline points="${pts2}" fill="none" stroke="${CHART_COLORS[2]}" stroke-width="2.5"/>`;
        if (d.type === 'line') {
          data.forEach((v, i) => g += `<circle cx="${x(i)}" cy="${y(v)}" r="3.4" fill="#fff" stroke="${CHART_COLORS[0]}" stroke-width="2"/>`);
          data2.forEach((v, i) => g += `<circle cx="${x(i)}" cy="${y(v)}" r="3.4" fill="#fff" stroke="${CHART_COLORS[2]}" stroke-width="2"/>`);
        }
      }
    } else if (d.type === 'hbar') {
      const padL = 78, cw = W - padL - padR, ch = H - padT - 10;
      const cats = 5, vals = M.series(cats, 15, 95, 4);
      const x = (v) => padL + (v / 100) * cw;
      for (let v = 0; v <= 100; v += 25) {
        g += `<line x1="${x(v)}" y1="${padT}" x2="${x(v)}" y2="${padT + ch}" class="ch-grid"/>` +
             `<text x="${x(v)}" y="${H - 4}" class="ch-lbl" text-anchor="middle">${v}</text>`;
      }
      const bh = ch / cats * 0.55;
      for (let i = 0; i < cats; i++) {
        const cy = padT + (i + 0.5) * (ch / cats);
        g += `<rect x="${padL}" y="${cy - bh / 2}" width="${x(vals[i]) - padL}" height="${bh}" fill="${CHART_COLORS[i % CHART_COLORS.length]}" rx="2"/>`;
        g += `<text x="${padL - 7}" y="${cy + 3.5}" class="ch-lbl" text-anchor="end">${M.city(i)}</text>`;
      }
      legend = '';
    } else if (d.type === 'radar') {
      const axes = 6, cx = W / 2, cy = (H - 6) / 2 + 3, r = Math.min(W, H) / 2 - 26;
      const pt = (i, v) => {
        const a = -Math.PI / 2 + (i / axes) * Math.PI * 2;
        return (cx + (r * v / 100) * Math.cos(a)).toFixed(1) + ',' + (cy + (r * v / 100) * Math.sin(a)).toFixed(1);
      };
      for (let ring = 25; ring <= 100; ring += 25) {
        g += `<polygon points="${Array.from({ length: axes }, (_, i) => pt(i, ring)).join(' ')}" fill="none" class="ch-grid"/>`;
      }
      for (let i = 0; i < axes; i++) {
        g += `<line x1="${cx}" y1="${cy}" x2="${pt(i, 100).replace(',', '" y2="')}" class="ch-grid"/>`;
        const a = -Math.PI / 2 + (i / axes) * Math.PI * 2;
        g += `<text x="${cx + (r + 13) * Math.cos(a)}" y="${cy + (r + 13) * Math.sin(a) + 3.5}" class="ch-lbl" text-anchor="middle">${M.month(i)}</text>`;
      }
      const s1 = M.series(axes, 30, 95, 6), s2 = M.series(axes, 20, 80, 9);
      g += `<polygon points="${s1.map((v, i) => pt(i, v)).join(' ')}" fill="${CHART_COLORS[0]}" opacity="0.25" stroke="${CHART_COLORS[0]}" stroke-width="2"/>`;
      g += `<polygon points="${s2.map((v, i) => pt(i, v)).join(' ')}" fill="${CHART_COLORS[2]}" opacity="0.25" stroke="${CHART_COLORS[2]}" stroke-width="2"/>`;
    } else { /* pie / doughnut */
      const vals = M.series(5, 8, 40, 5), tot = vals.reduce((a, b) => a + b, 0);
      const cx = W / 2, cy = (H - 16) / 2 + 6, r = Math.min(W - padL0(), H - padT - padB) / 2.1;
      function padL0() { return 42; }
      let a0 = -Math.PI / 2;
      vals.forEach((v, i) => {
        const a1 = a0 + (v / tot) * Math.PI * 2;
        const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const large = (a1 - a0) > Math.PI ? 1 : 0;
        g += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z" fill="${CHART_COLORS[i % CHART_COLORS.length]}" stroke="#fff" stroke-width="2"/>`;
        a0 = a1;
      });
      if (d.type === 'doughnut') g += `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="var(--ch-hole, #fff)"/>`;
      legend = CHART_COLORS.slice(0, 5).map((col, i) => `<span class="ch-leg"><span class="ch-dot" style="background:${col}"></span>${M.category(i)}</span>`).join('');
    }
    return `<div class="p-chart">${d.title ? `<div class="p-chart-title">${esc(d.title)}</div>` : ''}` +
      `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="p-chart-svg">${g}</svg>` +
      (legend ? `<div class="p-chart-legend">${legend}</div>` : '') + '</div>';
  }

  /* ============================================================
   * Component definitions
   * ============================================================ */
  const defs = {};
  function def(type, o) { o.type = type; defs[type] = o; }

  /* ------------------------- FORM ------------------------- */
  def('outputLabel', {
    name: 'Label', pf: 'p:outputLabel', cat: 'Form', w: 120, h: 24,
    props: [{ k: 'text', n: 'Text', t: 'text', d: 'Label' }, { k: 'required', n: 'Required *', t: 'bool', d: false }],
    html: (d) => `<label class="p-outputlabel">${esc(d.text)}${d.required ? '<span class="p-req">*</span>' : ''}</label>`
  });
  def('inputText', {
    name: 'Input Text', pf: 'p:inputText', cat: 'Form', w: 220, h: 36,
    props: [{ k: 'value', n: 'Value', t: 'text', d: '' }, { k: 'placeholder', n: 'Placeholder', t: 'text', d: 'Enter text' }, { k: 'disabled', n: 'Disabled', t: 'bool', d: false }],
    html: (d) => `<div class="p-inputtext ${d.disabled ? 'p-disabled' : ''}">${d.value ? esc(d.value) : `<span class="p-placeholder">${esc(d.placeholder)}</span>`}</div>`
  });
  def('inputTextarea', {
    name: 'Textarea', pf: 'p:inputTextarea', cat: 'Form', w: 260, h: 90,
    props: [{ k: 'value', n: 'Value', t: 'text', d: '' }, { k: 'placeholder', n: 'Placeholder', t: 'text', d: 'Your message...' }],
    html: (d) => `<div class="p-inputtext p-textarea">${d.value ? esc(d.value) : `<span class="p-placeholder">${esc(d.placeholder)}</span>`}</div>`
  });
  def('password', {
    name: 'Password', pf: 'p:password', cat: 'Form', w: 220, h: 36,
    props: [{ k: 'filled', n: 'Show dots', t: 'bool', d: true }],
    html: (d) => `<div class="p-inputtext p-password">${d.filled ? '●●●●●●●●' : '<span class="p-placeholder">Password</span>'}</div>`
  });
  def('inputNumber', {
    name: 'Input Number', pf: 'p:inputNumber', cat: 'Form', w: 200, h: 36,
    props: [{ k: 'value', n: 'Value', t: 'text', d: '42' }],
    html: (d) => `<div class="p-inputnumber"><div class="p-inputtext">${esc(d.value)}</div>` +
      `<span class="p-inputnumber-btns"><span class="p-inputnumber-btn">${I.chevU}</span><span class="p-inputnumber-btn">${I.chevD}</span></span></div>`
  });
  def('inputMask', {
    name: 'Input Mask', pf: 'p:inputMask', cat: 'Form', w: 200, h: 36,
    props: [{ k: 'value', n: 'Value', t: 'text', d: '99/99/9999' }],
    html: (d) => `<div class="p-inputtext"><span class="p-placeholder">${esc(d.value)}</span></div>`
  });
  def('datePicker', {
    name: 'Date Picker', pf: 'p:datePicker', cat: 'Form', w: 220, h: 36,
    props: [{ k: 'value', n: 'Value', t: 'text', d: '09/07/2026' }],
    html: (d) => `<div class="p-calendar"><div class="p-inputtext">${esc(d.value)}</div><span class="p-calendar-btn">${I.cal}</span></div>`
  });
  def('checkbox', {
    name: 'Checkbox', pf: 'p:selectBooleanCheckbox', cat: 'Form', w: 180, h: 28,
    props: [{ k: 'label', n: 'Label', t: 'text', d: 'Remember me' }, { k: 'checked', n: 'Checked', t: 'bool', d: true }],
    html: (d) => `<div class="p-field-check">${checkboxBox(d.checked)}<span class="p-field-check-label">${esc(d.label)}</span></div>`
  });
  def('radioGroup', {
    name: 'Radio Buttons', pf: 'p:selectOneRadio', cat: 'Form', w: 180, h: 96,
    props: [{ k: 'options', n: 'Options', t: 'list', d: 'Option A\nOption B\nOption C' },
            { k: 'selected', n: 'Selected #', t: 'num', d: 1 },
            { k: 'horizontal', n: 'Horizontal', t: 'bool', d: false }],
    html: (d) => `<div class="p-radiogroup ${d.horizontal ? 'p-horizontal' : ''}">` +
      lines(d.options).map((o, i) => `<div class="p-field-check">${radioBox(i === (d.selected | 0) - 1)}<span class="p-field-check-label">${esc(o)}</span></div>`).join('') + '</div>'
  });
  def('dropdown', {
    name: 'Dropdown', pf: 'p:selectOneMenu', cat: 'Form', w: 220, h: 36,
    props: [{ k: 'value', n: 'Selected value', t: 'text', d: 'Select a country' }],
    html: (d) => `<div class="p-dropdown"><span class="p-dropdown-label">${esc(d.value)}</span><span class="p-dropdown-trigger">${I.chevD}</span></div>`
  });
  def('multiSelect', {
    name: 'MultiSelect', pf: 'p:selectCheckboxMenu', cat: 'Form', w: 240, h: 36,
    props: [{ k: 'values', n: 'Selected (lines)', t: 'list', d: 'Berlin\nLisbon' }],
    html: (d) => `<div class="p-dropdown p-multiselect"><span class="p-dropdown-label">` +
      lines(d.values).map(v => `<span class="p-ms-token">${esc(v)} ${I.times}</span>`).join('') +
      `</span><span class="p-dropdown-trigger">${I.chevD}</span></div>`
  });
  def('listbox', {
    name: 'Listbox', pf: 'p:selectOneListbox', cat: 'Form', w: 200, h: 150,
    props: [{ k: 'options', n: 'Options', t: 'list', d: 'New York\nRome\nLondon\nParis\nTokyo' }, { k: 'selected', n: 'Selected #', t: 'num', d: 2 }],
    html: (d) => `<div class="p-listbox">${listRows(lines(d.options), (d.selected | 0) - 1, 'p-listbox-item')}</div>`
  });
  def('autoComplete', {
    name: 'AutoComplete', pf: 'p:autoComplete', cat: 'Form', w: 220, h: 36,
    props: [{ k: 'value', n: 'Value', t: 'text', d: 'Braz' }, { k: 'dropdown', n: 'Dropdown button', t: 'bool', d: true }],
    html: (d) => `<div class="p-autocomplete"><div class="p-inputtext">${esc(d.value)}<span class="p-caret"></span></div>` +
      (d.dropdown ? `<span class="p-ac-btn">${I.chevD}</span>` : '') + '</div>'
  });
  def('chips', {
    name: 'Chips', pf: 'p:chips', cat: 'Form', w: 260, h: 40,
    props: [{ k: 'values', n: 'Values (lines)', t: 'list', d: 'Java\nJSF\nPrimeFaces' }],
    html: (d) => `<div class="p-inputtext p-chips">` +
      lines(d.values).map(v => `<span class="p-chips-token">${esc(v)} ${I.times}</span>`).join('') + '</div>'
  });
  def('slider', {
    name: 'Slider', pf: 'p:slider', cat: 'Form', w: 220, h: 24,
    props: [{ k: 'value', n: 'Value (0-100)', t: 'num', d: 60 }],
    html: (d) => `<div class="p-slider"><span class="p-slider-track"></span><div class="p-slider-range" style="width:${Math.min(100, Math.max(0, d.value))}%"></div>` +
      `<span class="p-slider-handle" style="left:${Math.min(100, Math.max(0, d.value))}%"></span></div>`
  });
  def('rating', {
    name: 'Rating', pf: 'p:rating', cat: 'Form', w: 150, h: 28,
    props: [{ k: 'value', n: 'Stars (0-5)', t: 'num', d: 4 }],
    html: (d) => `<div class="p-rating">${stars(Math.min(5, Math.max(0, d.value | 0)), 5)}</div>`
  });
  def('knob', {
    name: 'Knob', pf: 'p:knob', cat: 'Form', w: 100, h: 100,
    props: [{ k: 'value', n: 'Value (0-100)', t: 'num', d: 65 }],
    html: (d) => {
      const v = Math.min(100, Math.max(0, d.value | 0)), r = 40, c = 2 * Math.PI * r;
      return `<div class="p-knob"><svg viewBox="0 0 100 100">` +
        `<circle cx="50" cy="50" r="${r}" class="p-knob-track" stroke-dasharray="${c}"/>` +
        `<circle cx="50" cy="50" r="${r}" class="p-knob-value" stroke-dasharray="${c * v / 100} ${c}" transform="rotate(-90 50 50)"/>` +
        `<text x="50" y="57" text-anchor="middle" class="p-knob-text">${v}</text></svg></div>`;
    }
  });
  def('inputSwitch', {
    name: 'Input Switch', pf: 'p:toggleSwitch', cat: 'Form', w: 52, h: 28,
    props: [{ k: 'checked', n: 'On', t: 'bool', d: true }],
    html: (d) => `<div class="p-inputswitch ${d.checked ? 'p-checked' : ''}"><span class="p-inputswitch-slider"></span></div>`
  });
  def('selectButton', {
    name: 'Select Button', pf: 'p:selectOneButton', cat: 'Form', w: 240, h: 36,
    props: [{ k: 'options', n: 'Options', t: 'list', d: 'Off\nOn\nAuto' }, { k: 'selected', n: 'Selected #', t: 'num', d: 2 }],
    html: (d) => `<div class="p-selectbutton">` +
      lines(d.options).map((o, i) => `<span class="p-selectbutton-opt ${i === (d.selected | 0) - 1 ? 'p-highlight' : ''}">${esc(o)}</span>`).join('') + '</div>'
  });
  def('toggleButton', {
    name: 'Toggle Button', pf: 'p:toggleButton', cat: 'Form', w: 120, h: 36,
    props: [{ k: 'label', n: 'Label', t: 'text', d: 'Active' }, { k: 'checked', n: 'Pressed', t: 'bool', d: true }],
    html: (d) => `<button type="button" tabindex="-1" class="p-button p-togglebutton ${d.checked ? '' : 'p-button-outlined'}">${d.checked ? I.check : I.times}<span class="p-button-label">${esc(d.label)}</span></button>`
  });
  def('colorPicker', {
    name: 'Color Picker', pf: 'p:colorPicker', cat: 'Form', w: 36, h: 36,
    props: [{ k: 'color', n: 'Color (hex)', t: 'text', d: '#2196F3' }],
    html: (d) => `<div class="p-colorpicker"><span class="p-colorpicker-swatch" style="background:${esc(d.color)}"></span></div>`
  });
  def('spinner', {
    name: 'Spinner', pf: 'p:spinner', cat: 'Form', w: 180, h: 36,
    props: [{ k: 'value', n: 'Value', t: 'text', d: '5' }],
    html: (d) => `<div class="p-spinner"><span class="p-spinner-btn">${I.minus}</span><div class="p-inputtext">${esc(d.value)}</div><span class="p-spinner-btn">${I.plus}</span></div>`
  });
  def('editor', {
    name: 'Text Editor', pf: 'p:textEditor', cat: 'Form', w: 340, h: 180,
    props: [{ k: 'words', n: 'Content words', t: 'num', d: 24 }],
    html: (d) => `<div class="p-editor"><div class="p-editor-toolbar">` +
      `<span class="p-ed-btn"><b>B</b></span><span class="p-ed-btn"><i>I</i></span><span class="p-ed-btn"><u>U</u></span>` +
      `<span class="p-ed-sep"></span><span class="p-ed-btn">${I.bars}</span><span class="p-ed-btn">“”</span><span class="p-ed-btn">🔗</span>` +
      `</div><div class="p-editor-content">${esc(M.lorem(Math.max(3, d.words | 0)))}</div></div>`
  });

  /* ------------------------ BUTTONS ------------------------ */
  def('commandButton', {
    name: 'Button', pf: 'p:commandButton', cat: 'Buttons', w: 110, h: 36,
    props: [{ k: 'label', n: 'Label', t: 'text', d: 'Submit' },
            { k: 'icon', n: 'Icon', t: 'sel', d: 'none', o: Object.keys(NAMED_ICONS) },
            { k: 'severity', n: 'Severity', t: 'sel', d: 'primary', o: SEV_OPTS },
            { k: 'style', n: 'Style', t: 'sel', d: 'filled', o: ['filled', 'outlined', 'text'] },
            { k: 'rounded', n: 'Rounded', t: 'bool', d: false }],
    html: (d) => btn(d.label, { icon: NAMED_ICONS[d.icon], sev: d.severity, style: d.style, cls: (d.rounded ? 'p-button-rounded' : '') + ' p-fill' })
  });
  def('splitButton', {
    name: 'Split Button', pf: 'p:splitButton', cat: 'Buttons', w: 140, h: 36,
    props: [{ k: 'label', n: 'Label', t: 'text', d: 'Save' }, { k: 'severity', n: 'Severity', t: 'sel', d: 'primary', o: SEV_OPTS }],
    html: (d) => `<div class="p-splitbutton p-fill">${btn(d.label, { icon: I.check, sev: d.severity, cls: 'p-sb-main' })}` +
      btn('', { icon: I.chevD, sev: d.severity, cls: 'p-sb-menu' }) + '</div>'
  });
  def('link', {
    name: 'Link', pf: 'p:link', cat: 'Buttons', w: 120, h: 24,
    props: [{ k: 'label', n: 'Label', t: 'text', d: 'Forgot password?' }],
    html: (d) => `<span class="p-link">${esc(d.label)}</span>`
  });

  /* ------------------------- DATA ------------------------- */
  def('dataTable', {
    name: 'DataTable', pf: 'p:dataTable', cat: 'Data', w: 620, h: 320,
    props: [{ k: 'title', n: 'Header title', t: 'text', d: 'Customers' },
            { k: 'columns', n: 'Columns', t: 'list', d: 'Name\nCountry\nDate\nStatus' },
            { k: 'rows', n: 'Rows', t: 'num', d: 6 },
            { k: 'paginator', n: 'Paginator', t: 'bool', d: true },
            { k: 'striped', n: 'Striped rows', t: 'bool', d: true },
            { k: 'sortable', n: 'Sort indicator', t: 'bool', d: true }],
    html: (d) => tableHtml(d)
  });
  def('treeTable', {
    name: 'TreeTable', pf: 'p:treeTable', cat: 'Data', w: 520, h: 280,
    props: [{ k: 'title', n: 'Header title', t: 'text', d: '' },
            { k: 'columns', n: 'Columns', t: 'list', d: 'Name\nCategory\nPrice' },
            { k: 'rows', n: 'Rows', t: 'num', d: 6 },
            { k: 'paginator', n: 'Paginator', t: 'bool', d: false },
            { k: 'striped', n: 'Striped rows', t: 'bool', d: false },
            { k: 'sortable', n: 'Sort indicator', t: 'bool', d: false }],
    html: (d) => tableHtml(d, { tree: true })
  });
  def('dataView', {
    name: 'DataView', pf: 'p:dataView', cat: 'Data', w: 560, h: 240,
    props: [{ k: 'items', n: 'Items', t: 'num', d: 3 }],
    html: (d, c, mode) => `<div class="p-dataview">` +
      M.rows(Math.max(1, d.items | 0)).map((r, i) =>
        `<div class="p-dataview-row">${photoBox(mode, i)}` +
        `<div class="p-dataview-body"><div class="p-dv-name">${esc(r.product)}</div>` +
        `<div class="p-dv-sub">${esc(r.category)}</div>` +
        `<div class="p-rating">${stars(3 + i % 3, 5)}</div></div>` +
        `<div class="p-dataview-right"><div class="p-dv-price">${esc(r.price)}</div>` +
        `<span class="p-tag p-tag-${['success', 'warning', 'danger'][i % 3]}">${esc(r.status)}</span></div></div>`).join('') + '</div>'
  });
  def('tree', {
    name: 'Tree', pf: 'p:tree', cat: 'Data', w: 240, h: 240,
    props: [{ k: 'root', n: 'Root label', t: 'text', d: 'Documents' }],
    html: (d) => {
      const leaf = (n, depth) => `<div class="p-tree-node" style="padding-left:${depth * 20}px"><span class="p-tree-toggler"></span><span class="p-tree-icon">📄</span>${esc(n)}</div>`;
      const branch = (n, depth, open) => `<div class="p-tree-node" style="padding-left:${depth * 20}px"><span class="p-tree-toggler">${open ? I.chevD : I.chevR}</span><span class="p-tree-icon">📁</span>${esc(n)}</div>`;
      return `<div class="p-tree">` + branch(d.root, 0, true) +
        branch('Work', 1, true) + leaf('Expenses.doc', 2) + leaf('Resume.doc', 2) +
        branch('Home', 1, false) + branch('Pictures', 1, true) + leaf('logo.png', 2) + '</div>';
    }
  });
  def('orderList', {
    name: 'OrderList', pf: 'p:orderList', cat: 'Data', w: 300, h: 260,
    props: [{ k: 'title', n: 'Caption', t: 'text', d: 'Cities' },
            { k: 'options', n: 'Items', t: 'list', d: 'San Francisco\nLondon\nParis\nIstanbul\nBerlin' }],
    html: (d) => `<div class="p-orderlist"><div class="p-orderlist-controls">` +
      [I.chevU, I.dblL, I.chevD, I.dblR].map((ic, i) => btn('', { icon: [I.chevU, '<span style="transform:rotate(90deg)">' + I.dblL + '</span>', I.chevD, '<span style="transform:rotate(90deg)">' + I.dblR + '</span>'][i] })).join('') +
      `</div><div class="p-orderlist-list"><div class="p-list-caption">${esc(d.title)}</div>` +
      listRows(lines(d.options), 1, 'p-listbox-item') + '</div></div>'
  });
  def('pickList', {
    name: 'PickList', pf: 'p:pickList', cat: 'Data', w: 460, h: 260,
    props: [{ k: 'source', n: 'Available', t: 'list', d: 'Brasilia\nSao Paulo\nRio de Janeiro\nSalvador' },
            { k: 'target', n: 'Selected', t: 'list', d: 'Porto Alegre\nRecife' }],
    html: (d) => `<div class="p-picklist">` +
      `<div class="p-orderlist-list"><div class="p-list-caption">Available</div>${listRows(lines(d.source), 0, 'p-listbox-item')}</div>` +
      `<div class="p-orderlist-controls">${[I.chevR, I.dblR, I.chevL, I.dblL].map(ic => btn('', { icon: ic })).join('')}</div>` +
      `<div class="p-orderlist-list"><div class="p-list-caption">Selected</div>${listRows(lines(d.target), -1, 'p-listbox-item')}</div></div>`
  });
  def('carousel', {
    name: 'Carousel', pf: 'p:carousel', cat: 'Data', w: 460, h: 220,
    props: [{ k: 'items', n: 'Visible items', t: 'num', d: 3 }],
    html: (d, c, mode) => `<div class="p-carousel"><span class="p-carousel-prev">${I.chevL}</span><div class="p-carousel-items">` +
      M.rows(Math.max(1, d.items | 0)).map((r, i) =>
        `<div class="p-carousel-item">${photoBox(mode, i + 2)}<div class="p-dv-name">${esc(r.product)}</div><div class="p-dv-price">${esc(r.price)}</div></div>`).join('') +
      `</div><span class="p-carousel-next">${I.chevR}</span>` +
      `<div class="p-carousel-dots"><span class="p-dot p-highlight"></span><span class="p-dot"></span><span class="p-dot"></span></div></div>`
  });
  def('timeline', {
    name: 'Timeline', pf: 'p:timeline', cat: 'Data', w: 320, h: 260,
    props: [{ k: 'events', n: 'Events', t: 'list', d: 'Ordered\nProcessing\nShipped\nDelivered' }],
    html: (d) => `<div class="p-timeline">` + lines(d.events).map((e, i, arr) =>
      `<div class="p-timeline-event"><div class="p-timeline-side"><span class="p-timeline-marker" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>${i < arr.length - 1 ? '<span class="p-timeline-connector"></span>' : ''}</div>` +
      `<div class="p-timeline-content"><div class="p-tl-title">${esc(e)}</div><div class="p-tl-date">${M.date(i)} ${M.time(i)}</div></div></div>`).join('') + '</div>'
  });
  def('paginator', {
    name: 'Paginator', pf: 'p:dataTable paginator', cat: 'Data', w: 360, h: 44,
    props: [],
    html: () => paginatorHtml()
  });
  def('chart', {
    name: 'Chart', pf: 'p:chart', cat: 'Data', w: 420, h: 300,
    props: [{ k: 'title', n: 'Title', t: 'text', d: 'Monthly Sales' },
            { k: 'type', n: 'Type', t: 'sel', d: 'bar', o: ['bar', 'hbar', 'line', 'area', 'pie', 'doughnut', 'radar'] }],
    html: (d, c) => chartSvg(d, c)
  });
  def('galleria', {
    name: 'Galleria', pf: 'p:galleria', cat: 'Data', w: 380, h: 300,
    props: [{ k: 'thumbs', n: 'Thumbnails', t: 'num', d: 5 }],
    html: (d, c, mode) => `<div class="p-galleria"><div class="p-galleria-main">${photoBox(mode, 1)}` +
      `<span class="p-galleria-nav p-g-prev">${I.chevL}</span><span class="p-galleria-nav p-g-next">${I.chevR}</span></div>` +
      `<div class="p-galleria-thumbs">` +
      Array.from({ length: Math.max(1, d.thumbs | 0) }, (_, i) => `<div class="p-galleria-thumb ${i === 0 ? 'p-highlight' : ''}">${photoBox(mode, i + 1)}</div>`).join('') +
      '</div></div>'
  });

  /* ------------------------ PANELS ------------------------ */
  def('panel', {
    container: true,
    name: 'Panel', pf: 'p:panel', cat: 'Panels', w: 360, h: 220,
    props: [{ k: 'title', n: 'Header', t: 'text', d: 'Panel Header' },
            { k: 'toggleable', n: 'Toggle icon', t: 'bool', d: true },
            { k: 'words', n: 'Content words (0 = empty)', t: 'num', d: 0 }],
    html: (d) => `<div class="p-panel"><div class="p-panel-header"><span>${esc(d.title)}</span>` +
      (d.toggleable ? `<span class="p-panel-toggler">${I.chevU}</span>` : '') +
      `</div><div class="p-panel-content">${d.words > 0 ? esc(M.lorem(d.words)) : '<span class="p-dropzone-hint">Drop components on top of this panel</span>'}</div></div>`
  });
  def('card', {
    container: true,
    name: 'Card', pf: 'p:card', cat: 'Panels', w: 320, h: 220,
    props: [{ k: 'title', n: 'Title', t: 'text', d: 'Card Title' },
            { k: 'subtitle', n: 'Subtitle', t: 'text', d: 'Subtitle' },
            { k: 'words', n: 'Content words', t: 'num', d: 20 },
            { k: 'footer', n: 'Footer buttons', t: 'bool', d: true }],
    html: (d) => `<div class="p-card"><div class="p-card-title">${esc(d.title)}</div>` +
      (d.subtitle ? `<div class="p-card-subtitle">${esc(d.subtitle)}</div>` : '') +
      `<div class="p-card-content">${esc(M.lorem(Math.max(3, d.words | 0)))}</div>` +
      (d.footer ? `<div class="p-card-footer">${btn('Save', { icon: I.check })} ${btn('Cancel', { icon: I.times, style: 'outlined', sev: 'secondary' })}</div>` : '') + '</div>'
  });
  def('fieldset', {
    container: true,
    name: 'Fieldset', pf: 'p:fieldset', cat: 'Panels', w: 340, h: 180,
    props: [{ k: 'title', n: 'Legend', t: 'text', d: 'Details' }, { k: 'words', n: 'Content words (0 = empty)', t: 'num', d: 0 }],
    html: (d) => `<fieldset class="p-fieldset"><legend>${esc(d.title)}</legend>` +
      `<div class="p-fieldset-content">${d.words > 0 ? esc(M.lorem(d.words)) : '<span class="p-dropzone-hint">Drop components on top of this fieldset</span>'}</div></fieldset>`
  });
  def('accordion', {
    name: 'Accordion', pf: 'p:accordionPanel', cat: 'Panels', w: 360, h: 240,
    props: [{ k: 'tabs', n: 'Sections', t: 'list', d: 'Header I\nHeader II\nHeader III' },
            { k: 'active', n: 'Open section #', t: 'num', d: 1 },
            { k: 'words', n: 'Content words', t: 'num', d: 18 }],
    html: (d) => `<div class="p-accordion">` + lines(d.tabs).map((t, i) => {
      const open = i === (d.active | 0) - 1;
      return `<div class="p-accordion-header ${open ? 'p-highlight' : ''}">${open ? I.chevD : I.chevR}<span>${esc(t)}</span></div>` +
        (open ? `<div class="p-accordion-content">${esc(M.lorem(Math.max(3, d.words | 0)))}</div>` : '');
    }).join('') + '</div>'
  });
  def('tabView', {
    container: true,
    name: 'TabView', pf: 'p:tabView', cat: 'Panels', w: 400, h: 240,
    props: [{ k: 'tabs', n: 'Tabs', t: 'list', d: 'Overview\nDetails\nHistory' },
            { k: 'active', n: 'Active tab #', t: 'num', d: 1 },
            { k: 'words', n: 'Content words (0 = empty)', t: 'num', d: 0 }],
    html: (d) => `<div class="p-tabview"><div class="p-tabview-nav">` +
      lines(d.tabs).map((t, i) => `<span class="p-tabview-tab ${i === (d.active | 0) - 1 ? 'p-highlight' : ''}">${esc(t)}</span>`).join('') +
      `</div><div class="p-tabview-panel">${d.words > 0 ? esc(M.lorem(d.words)) : '<span class="p-dropzone-hint">Drop components on top of this tab panel</span>'}</div></div>`
  });
  def('toolbar', {
    name: 'Toolbar', pf: 'p:toolbar', cat: 'Panels', w: 480, h: 56,
    props: [{ k: 'leftButtons', n: 'Left buttons', t: 'list', d: 'New\nOpen' }, { k: 'rightLabel', n: 'Right side', t: 'text', d: 'Search' }],
    html: (d) => `<div class="p-toolbar"><div class="p-toolbar-group">` +
      lines(d.leftButtons).map((b, i) => btn(b, i === 0 ? { icon: I.plus } : { icon: I.upload, sev: 'secondary', style: 'outlined' })).join('') +
      `</div><div class="p-toolbar-group">` +
      (d.rightLabel ? `<div class="p-inputtext p-toolbar-search"><span class="p-placeholder">${esc(d.rightLabel)}</span>${I.search}</div>` : '') +
      btn('', { icon: I.dots, sev: 'secondary', style: 'text' }) + '</div></div>'
  });
  def('divider', {
    name: 'Divider', pf: 'p:divider', cat: 'Panels', w: 300, h: 24,
    props: [{ k: 'text', n: 'Label (optional)', t: 'text', d: '' }, { k: 'dashed', n: 'Dashed', t: 'bool', d: false }],
    html: (d) => `<div class="p-divider ${d.dashed ? 'p-dashed' : ''}"><span class="p-divider-line"></span>` +
      (d.text ? `<span class="p-divider-text">${esc(d.text)}</span><span class="p-divider-line"></span>` : '') + '</div>'
  });

  /* ------------------------ OVERLAYS ------------------------ */
  def('dialog', {
    container: true,
    name: 'Dialog', pf: 'p:dialog', cat: 'Overlays', w: 380, h: 220,
    props: [{ k: 'title', n: 'Title', t: 'text', d: 'Edit Profile' },
            { k: 'words', n: 'Content words (0 = empty)', t: 'num', d: 0 },
            { k: 'footer', n: 'Footer buttons', t: 'bool', d: true }],
    html: (d) => `<div class="p-dialog"><div class="p-dialog-header"><span>${esc(d.title)}</span><span class="p-dialog-close">${I.times}</span></div>` +
      `<div class="p-dialog-content">${d.words > 0 ? esc(M.lorem(d.words)) : '<span class="p-dropzone-hint">Drop components on top of this dialog</span>'}</div>` +
      (d.footer ? `<div class="p-dialog-footer">${btn('Cancel', { style: 'text', sev: 'secondary' })}${btn('Save', { icon: I.check })}</div>` : '') + '</div>'
  });
  def('confirmDialog', {
    name: 'Confirm Dialog', pf: 'p:confirmDialog', cat: 'Overlays', w: 360, h: 170,
    props: [{ k: 'title', n: 'Title', t: 'text', d: 'Confirmation' }, { k: 'message', n: 'Message', t: 'text', d: 'Are you sure you want to proceed?' }],
    html: (d) => `<div class="p-dialog"><div class="p-dialog-header"><span>${esc(d.title)}</span><span class="p-dialog-close">${I.times}</span></div>` +
      `<div class="p-dialog-content p-confirm"><span class="p-confirm-icon">${I.warn}</span>${esc(d.message)}</div>` +
      `<div class="p-dialog-footer">${btn('No', { icon: I.times, style: 'text' })}${btn('Yes', { icon: I.check })}</div></div>`
  });
  def('overlayPanel', {
    container: true,
    name: 'Overlay Panel', pf: 'p:overlayPanel', cat: 'Overlays', w: 260, h: 140,
    props: [{ k: 'words', n: 'Content words', t: 'num', d: 14 }],
    html: (d) => `<div class="p-overlaypanel"><span class="p-op-arrow"></span><div class="p-op-content">${esc(M.lorem(Math.max(3, d.words | 0)))}</div></div>`
  });
  def('sidebar', {
    container: true,
    name: 'Sidebar', pf: 'p:sidebar', cat: 'Overlays', w: 260, h: 420,
    props: [{ k: 'title', n: 'Title', t: 'text', d: 'Menu' }, { k: 'items', n: 'Items', t: 'list', d: 'Dashboard\nOrders\nCustomers\nReports\nSettings' }],
    html: (d) => `<div class="p-sidebar"><div class="p-sidebar-header"><span>${esc(d.title)}</span><span class="p-dialog-close">${I.times}</span></div>` +
      `<div class="p-sidebar-content">${lines(d.items).map((it, i) => `<div class="p-menuitem ${i === 0 ? 'p-highlight' : ''}"><span class="p-menuitem-icon">${[I.home, I.bars, I.user, I.info, I.cal][i % 5]}</span>${esc(it)}</div>`).join('')}</div></div>`
  });
  def('tooltip', {
    name: 'Tooltip', pf: 'p:tooltip', cat: 'Overlays', w: 160, h: 44,
    props: [{ k: 'text', n: 'Text', t: 'text', d: 'Enter your username' }],
    html: (d) => `<div class="p-tooltip"><span class="p-tooltip-arrow"></span>${esc(d.text)}</div>`
  });

  /* ------------------------- MENUS ------------------------- */
  def('menubar', {
    name: 'Menubar', pf: 'p:menubar', cat: 'Menus', w: 620, h: 48,
    props: [{ k: 'brand', n: 'Brand', t: 'text', d: 'APP' },
            { k: 'items', n: 'Items', t: 'list', d: 'File\nEdit\nView\nHelp' },
            { k: 'rightUser', n: 'User avatar right', t: 'bool', d: true }],
    html: (d) => `<div class="p-menubar">` +
      (d.brand ? `<span class="p-menubar-brand">${esc(d.brand)}</span>` : '') +
      lines(d.items).map(it => `<span class="p-menubar-item">${esc(it)} ${I.chevD}</span>`).join('') +
      `<span class="p-menubar-spacer"></span>` +
      (d.rightUser ? `<span class="p-avatar p-avatar-circle p-avatar-sm">${M.initials(0)}</span>` : '') + '</div>'
  });
  def('menu', {
    name: 'Menu', pf: 'p:menu', cat: 'Menus', w: 200, h: 230,
    props: [{ k: 'sections', n: 'Sections', t: 'list', d: 'Documents\nProfile' },
            { k: 'items', n: 'Items per section', t: 'num', d: 2 }],
    html: (d) => `<div class="p-menu">` + lines(d.sections).map((s, si) =>
      `<div class="p-menu-section">${esc(s)}</div>` +
      Array.from({ length: Math.max(1, d.items | 0) }, (_, i) =>
        `<div class="p-menuitem"><span class="p-menuitem-icon">${[I.plus, I.search, I.user, I.save][(si * 2 + i) % 4]}</span>${['New', 'Search', 'Settings', 'Export'][(si * 2 + i) % 4]}</div>`).join('')).join('') + '</div>'
  });
  def('panelMenu', {
    name: 'PanelMenu', pf: 'p:panelMenu', cat: 'Menus', w: 220, h: 260,
    props: [{ k: 'sections', n: 'Sections', t: 'list', d: 'File\nEdit\nUsers' }, { k: 'openFirst', n: 'First open', t: 'bool', d: true }],
    html: (d) => `<div class="p-panelmenu">` + lines(d.sections).map((s, i) => {
      const open = d.openFirst && i === 0;
      return `<div class="p-accordion-header ${open ? 'p-highlight' : ''}">${open ? I.chevD : I.chevR}<span>${esc(s)}</span></div>` +
        (open ? `<div class="p-panelmenu-content"><div class="p-menuitem"><span class="p-menuitem-icon">${I.plus}</span>New</div><div class="p-menuitem"><span class="p-menuitem-icon">${I.trash}</span>Delete</div></div>` : '');
    }).join('') + '</div>'
  });
  def('breadcrumb', {
    name: 'Breadcrumb', pf: 'p:breadCrumb', cat: 'Menus', w: 380, h: 40,
    props: [{ k: 'items', n: 'Items', t: 'list', d: 'Electronics\nComputer\nAccessories' }],
    html: (d) => `<div class="p-breadcrumb"><span class="p-breadcrumb-home">${I.home}</span>` +
      lines(d.items).map(it => `<span class="p-breadcrumb-sep">${I.chevR}</span><span class="p-breadcrumb-item">${esc(it)}</span>`).join('') + '</div>'
  });
  def('steps', {
    name: 'Steps', pf: 'p:steps', cat: 'Menus', w: 480, h: 70,
    props: [{ k: 'items', n: 'Steps', t: 'list', d: 'Personal\nSeat\nPayment\nConfirmation' }, { k: 'active', n: 'Active step #', t: 'num', d: 2 }],
    html: (d) => `<div class="p-steps">` + lines(d.items).map((it, i, arr) =>
      `<div class="p-steps-item ${i === (d.active | 0) - 1 ? 'p-highlight' : ''} ${i < (d.active | 0) - 1 ? 'p-done' : ''}">` +
      `<span class="p-steps-number">${i < (d.active | 0) - 1 ? I.check : i + 1}</span><span class="p-steps-title">${esc(it)}</span>` +
      (i < arr.length - 1 ? '<span class="p-steps-connector"></span>' : '') + '</div>').join('') + '</div>'
  });
  def('tabMenu', {
    name: 'TabMenu', pf: 'p:tabMenu', cat: 'Menus', w: 420, h: 42,
    props: [{ k: 'items', n: 'Items', t: 'list', d: 'Home\nCalendar\nDocumentation\nSettings' }, { k: 'active', n: 'Active #', t: 'num', d: 1 }],
    html: (d) => `<div class="p-tabview-nav p-tabmenu">` +
      lines(d.items).map((t, i) => `<span class="p-tabview-tab ${i === (d.active | 0) - 1 ? 'p-highlight' : ''}">${esc(t)}</span>`).join('') + '</div>'
  });

  /* ----------------------- MESSAGES ----------------------- */
  def('message', {
    name: 'Message (inline)', pf: 'p:message', cat: 'Messages', w: 280, h: 36,
    props: [{ k: 'severity', n: 'Severity', t: 'sel', d: 'error', o: ['info', 'success', 'warn', 'error'] },
            { k: 'text', n: 'Text', t: 'text', d: 'Username is required' }],
    html: (d) => `<div class="p-message p-message-${d.severity}">${MSG_ICON[d.severity] || I.info}<span>${esc(d.text)}</span></div>`
  });
  def('messages', {
    name: 'Messages (block)', pf: 'p:messages', cat: 'Messages', w: 420, h: 64,
    props: [{ k: 'severity', n: 'Severity', t: 'sel', d: 'info', o: ['info', 'success', 'warn', 'error'] },
            { k: 'summary', n: 'Summary', t: 'text', d: 'Info' },
            { k: 'detail', n: 'Detail', t: 'text', d: 'Your changes have been saved.' }],
    html: (d) => `<div class="p-message p-messages p-message-${d.severity}">${MSG_ICON[d.severity] || I.info}` +
      `<span><b>${esc(d.summary)}</b>&#160; ${esc(d.detail)}</span><span class="p-message-close">${I.times}</span></div>`
  });
  def('toast', {
    name: 'Toast / Growl', pf: 'p:growl', cat: 'Messages', w: 320, h: 78,
    props: [{ k: 'severity', n: 'Severity', t: 'sel', d: 'success', o: ['info', 'success', 'warn', 'error'] },
            { k: 'summary', n: 'Summary', t: 'text', d: 'Success' },
            { k: 'detail', n: 'Detail', t: 'text', d: 'Record saved successfully.' }],
    html: (d) => `<div class="p-toast p-message-${d.severity}"><span class="p-toast-icon">${MSG_ICON[d.severity] || I.info}</span>` +
      `<span class="p-toast-body"><b>${esc(d.summary)}</b><span>${esc(d.detail)}</span></span><span class="p-message-close">${I.times}</span></div>`
  });

  /* --------------------- FILE & MEDIA --------------------- */
  def('fileUpload', {
    name: 'File Upload', pf: 'p:fileUpload', cat: 'File & Media', w: 420, h: 170,
    props: [{ k: 'multiple', n: 'Show file row', t: 'bool', d: true }],
    html: (d) => `<div class="p-fileupload"><div class="p-fileupload-bar">` +
      btn('Choose', { icon: I.plus }) + btn('Upload', { icon: I.upload, style: 'outlined' }) + btn('Cancel', { icon: I.times, style: 'outlined', sev: 'secondary' }) +
      `</div><div class="p-fileupload-content">` +
      (d.multiple ? `<div class="p-fileupload-row">${I.photo}<span>report_2026.pdf</span><span class="p-fu-size">142 KB</span>${btn('', { icon: I.times, sev: 'danger', style: 'text' })}</div>` : `<span class="p-placeholder">Drag and drop files here to upload.</span>`) +
      '</div></div>'
  });
  def('image', {
    name: 'Image', pf: 'p:graphicImage', cat: 'File & Media', w: 240, h: 160,
    props: [{ k: 'caption', n: 'Caption', t: 'text', d: '' }, { k: 'seed', n: 'Variant (1-6)', t: 'num', d: 1 }],
    html: (d, c, mode) => photoBox(mode, (d.seed | 0) - 1, d.caption)
  });
  def('avatar', {
    name: 'Avatar', pf: 'p:avatar', cat: 'File & Media', w: 48, h: 48,
    props: [{ k: 'label', n: 'Initials', t: 'text', d: 'AB' }, { k: 'circle', n: 'Circle', t: 'bool', d: true }],
    html: (d) => `<span class="p-avatar p-fill ${d.circle ? 'p-avatar-circle' : ''}">${esc(d.label)}</span>`
  });

  /* ------------------------- MISC ------------------------- */
  def('heading', {
    name: 'Heading', pf: 'h:outputText (h1-h3)', cat: 'Misc', w: 300, h: 40,
    props: [{ k: 'text', n: 'Text', t: 'text', d: 'Page Title' }, { k: 'level', n: 'Level', t: 'sel', d: 'h1', o: ['h1', 'h2', 'h3'] }],
    html: (d) => `<div class="p-heading p-heading-${d.level}">${esc(d.text)}</div>`
  });
  def('staticText', {
    name: 'Paragraph', pf: 'h:outputText', cat: 'Misc', w: 320, h: 80,
    props: [{ k: 'words', n: 'Words', t: 'num', d: 30 }],
    html: (d) => `<div class="p-paragraph">${esc(M.lorem(Math.max(3, d.words | 0)))}</div>`
  });
  def('progressBar', {
    name: 'ProgressBar', pf: 'p:progressBar', cat: 'Misc', w: 280, h: 22,
    props: [{ k: 'value', n: 'Value (0-100)', t: 'num', d: 60 }, { k: 'showValue', n: 'Show value', t: 'bool', d: true }],
    html: (d) => `<div class="p-progressbar"><div class="p-progressbar-value" style="width:${Math.min(100, Math.max(0, d.value))}%">` +
      (d.showValue ? `${Math.min(100, Math.max(0, d.value))}%` : '') + '</div></div>'
  });
  def('badge', {
    name: 'Badge', pf: 'p:badge', cat: 'Misc', w: 48, h: 44,
    props: [{ k: 'value', n: 'Value', t: 'text', d: '4' }],
    html: (d) => `<span class="p-badge-holder">${I.bars}<span class="p-badge">${esc(d.value)}</span></span>`
  });
  def('tag', {
    name: 'Tag', pf: 'p:tag', cat: 'Misc', w: 90, h: 26,
    props: [{ k: 'value', n: 'Value', t: 'text', d: 'NEW' },
            { k: 'severity', n: 'Severity', t: 'sel', d: 'primary', o: ['primary', 'success', 'info', 'warning', 'danger'] },
            { k: 'rounded', n: 'Rounded', t: 'bool', d: false }],
    html: (d) => `<span class="p-tag p-fill p-tag-${d.severity} ${d.rounded ? 'p-rounded' : ''}">${esc(d.value)}</span>`
  });
  def('chip', {
    name: 'Chip', pf: 'p:chip', cat: 'Misc', w: 130, h: 32,
    props: [{ k: 'label', n: 'Label', t: 'text', d: 'Amy Almeida' }, { k: 'removable', n: 'Removable', t: 'bool', d: true }],
    html: (d) => `<span class="p-chip p-fill"><span class="p-avatar p-avatar-circle p-avatar-sm">${esc(d.label).split(' ').map(w => w[0] || '').join('').slice(0, 2)}</span>` +
      `<span>${esc(d.label)}</span>${d.removable ? I.times : ''}</span>`
  });
  def('skeleton', {
    name: 'Skeleton', pf: 'p:skeleton', cat: 'Misc', w: 300, h: 120,
    props: [{ k: 'variant', n: 'Variant', t: 'sel', d: 'card', o: ['card', 'lines', 'circle'] }],
    html: (d) => {
      if (d.variant === 'circle') return `<div class="p-skeleton-group"><span class="p-skel p-skel-circle"></span><div class="p-skel-col"><span class="p-skel" style="width:70%"></span><span class="p-skel" style="width:45%"></span></div></div>`;
      if (d.variant === 'lines') return `<div class="p-skeleton-group p-skel-col"><span class="p-skel"></span><span class="p-skel" style="width:85%"></span><span class="p-skel" style="width:60%"></span></div>`;
      return `<div class="p-skeleton-group p-skel-col"><span class="p-skel p-skel-rect"></span><span class="p-skel" style="width:70%"></span><span class="p-skel" style="width:40%"></span></div>`;
    }
  });

  /* ---------------- public registry API ---------------- */
  const CATEGORIES = ['Form', 'Buttons', 'Data', 'Panels', 'Overlays', 'Menus', 'Messages', 'File & Media', 'Misc'];

  const Registry = {
    defs: defs,
    categories: CATEGORIES,
    get: (type) => defs[type] || null,
    byCategory: function (cat) {
      return Object.values(defs).filter(d => d.cat === cat);
    },
    /* merged props (defaults + overrides) for a placed component */
    resolve: function (comp) {
      const def = defs[comp.type];
      const out = {};
      if (!def) return out;
      def.props.forEach(p => {
        out[p.k] = (comp.props && comp.props[p.k] !== undefined) ? comp.props[p.k] : p.d;
      });
      return out;
    },
    render: function (comp, mode) {
      const def = defs[comp.type];
      if (!def) return `<div class="p-unknown">Unknown: ${esc(comp.type)}</div>`;
      try {
        return def.html(Registry.resolve(comp), comp, mode);
      } catch (e) {
        return `<div class="p-unknown">Render error</div>`;
      }
    },
    esc: esc,
    icons: I
  };

  global.Registry = Registry;
})(window);
