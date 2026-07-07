/* Becken DateTimePicker — dependency-free widget layer.
 *
 * The server renders the field (hidden ISO input + display input + trigger button)
 * and calls BeckenDTP.init(clientId, cfg). This file builds the popover, keeps the
 * hidden input in sync, and fires a native "change" event on it when the user commits
 * a value — which triggers any Faces client behavior (<f:ajax/>) rendered onto it.
 */
(function () {
  "use strict";

  var p2 = function (n) { return (n < 10 ? "0" : "") + n; };

  function parseIso(mode, s) {
    if (!s) return null;
    var m;
    if (mode === "time") {
      m = /^(\d{2}):(\d{2})/.exec(s);
      return m ? { hh: +m[1], mi: +m[2] } : null;
    }
    m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
    if (!m) return null;
    var v = { y: +m[1], m: +m[2], d: +m[3] };
    if (mode === "datetime") {
      v.hh = m[4] != null ? +m[4] : null;
      v.mi = m[5] != null ? +m[5] : null;
    }
    return v;
  }

  function toIso(mode, v) {
    if (!v) return "";
    if (mode === "time") return p2(v.hh) + ":" + p2(v.mi);
    var date = v.y + "-" + p2(v.m) + "-" + p2(v.d);
    if (mode === "date") return date;
    return date + "T" + p2(v.hh) + ":" + p2(v.mi);
  }

  var TOKENS = ["yyyy", "MM", "dd", "HH", "mm", "ss"];

  function formatPattern(pattern, v) {
    return pattern
      .replace("yyyy", v.y != null ? String(v.y).padStart(4, "0") : "yyyy")
      .replace("MM", v.m != null ? p2(v.m) : "MM")
      .replace("dd", v.d != null ? p2(v.d) : "dd")
      .replace("HH", v.hh != null ? p2(v.hh) : "HH")
      .replace("mm", v.mi != null ? p2(v.mi) : "mm")
      .replace("ss", "00");
  }

  /* Lenient parse: pull the numbers out of the text in the order the pattern's
     tokens appear; separators don't matter, missing trailing time defaults to 0. */
  function parsePattern(pattern, mode, text) {
    var order = [];
    var re = /yyyy|MM|dd|HH|mm|ss/g, m;
    while ((m = re.exec(pattern))) order.push(m[0]);
    var nums = (text.match(/\d+/g) || []).map(Number);
    if (!nums.length) return null;
    var v = {};
    for (var i = 0; i < order.length; i++) {
      var n = i < nums.length ? nums[i] : null;
      switch (order[i]) {
        case "yyyy": v.y = n; break;
        case "MM": v.m = n; break;
        case "dd": v.d = n; break;
        case "HH": v.hh = n == null ? 0 : n; break;
        case "mm": v.mi = n == null ? 0 : n; break;
      }
    }
    if (mode !== "time") {
      if (v.y == null || v.m == null || v.d == null) return null;
      if (v.y < 100) v.y += 2000;
      if (v.m < 1 || v.m > 12 || v.d < 1 || v.d > new Date(v.y, v.m, 0).getDate()) return null;
    }
    if (mode !== "date") {
      if (v.hh == null || v.mi == null || v.hh > 23 || v.mi > 59) return null;
    }
    return v;
  }

  function dateKey(v) { return v.y * 10000 + v.m * 100 + v.d; }
  function fullKey(mode, v) {
    if (mode === "time") return (v.hh || 0) * 100 + (v.mi || 0);
    return dateKey(v) * 10000 + (v.hh || 0) * 100 + (v.mi || 0);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (tag === "button") e.type = "button";
    return e;
  }

  function init(clientId, cfg) {
    var root = document.getElementById(clientId);
    if (!root || root.__bdtp) return;
    root.__bdtp = true;

    var hidden = document.getElementById(clientId + ":iso");
    var display = document.getElementById(clientId + ":display");
    var trigger = root.querySelector(".bdtp-trigger");
    var mode = cfg.mode;
    var hasDate = mode !== "time";
    var hasTime = mode !== "date";
    var minV = cfg.min ? parseIso(mode, cfg.min) : null;
    var maxV = cfg.max ? parseIso(mode, cfg.max) : null;

    var val = {};            // working selection while panel is open
    var picked = { h: false, m: false }; // explicitly clicked this session
    var lastCommitted = hidden.value;
    var viewY, viewM;        // calendar view (month page)
    var panel, daysEl, dowsEl, titleBtn, monthsEl, yearsEl, view = "days";
    var segH, segM, hoursEl, minsEl;
    var yearsBase;

    function today() {
      var n = new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), hh: n.getHours(), mi: n.getMinutes() };
    }

    function inRange(v) {
      if (!hasDate) {
        var k = fullKey(mode, v);
        return (!minV || k >= fullKey(mode, minV)) && (!maxV || k <= fullKey(mode, maxV));
      }
      var dk = dateKey(v);
      if (minV && dk < dateKey(minV)) return false;
      if (maxV && dk > dateKey(maxV)) return false;
      return true;
    }

    /* ---------- panel construction (once) ---------- */

    function buildPanel() {
      panel = el("div", "bdtp-panel");
      panel.setAttribute("role", "dialog");
      var body = el("div", "bdtp-body");
      panel.appendChild(body);

      if (hasDate) {
        var cal = el("div", "bdtp-cal");
        var head = el("div", "bdtp-cal-head");
        var prev = el("button", "bdtp-nav", "‹");
        var next = el("button", "bdtp-nav", "›");
        titleBtn = el("button", "bdtp-title");
        head.append(prev, titleBtn, next);
        cal.appendChild(head);

        dowsEl = el("div", "bdtp-dows");
        for (var i = 0; i < 7; i++) {
          dowsEl.appendChild(el("span", "bdtp-dow", cfg.weekdays[(cfg.firstDay + i) % 7]));
        }
        daysEl = el("div", "bdtp-days");
        monthsEl = el("div", "bdtp-months");
        yearsEl = el("div", "bdtp-years");
        cal.append(dowsEl, daysEl, monthsEl, yearsEl);
        body.appendChild(cal);

        prev.addEventListener("click", function () { nav(-1); });
        next.addEventListener("click", function () { nav(1); });
        titleBtn.addEventListener("click", function () {
          setView(view === "days" ? "months" : "years");
        });
        daysEl.addEventListener("keydown", daysKeyNav);
      }

      if (hasTime) {
        var time = el("div", "bdtp-time");
        var disp = el("div", "bdtp-time-display");
        segH = el("input", "bdtp-seg");
        segM = el("input", "bdtp-seg");
        [segH, segM].forEach(function (seg) {
          seg.maxLength = 2;
          seg.inputMode = "numeric";
          seg.setAttribute("aria-label", seg === segH ? "Hours" : "Minutes");
        });
        disp.append(segH, el("span", "bdtp-colon", ":"), segM);
        time.appendChild(disp);

        time.appendChild(el("div", "bdtp-sect", "Hour"));
        hoursEl = el("div", "bdtp-hours");
        for (var h = 0; h < 24; h++) {
          var hb = el("button", "bdtp-cell", p2(h));
          hb.dataset.h = h;
          hoursEl.appendChild(hb);
        }
        time.appendChild(hoursEl);

        time.appendChild(el("div", "bdtp-sect", "Minute"));
        minsEl = el("div", "bdtp-mins");
        for (var mi = 0; mi < 60; mi += cfg.minuteStep) {
          var mb = el("button", "bdtp-cell", p2(mi));
          mb.dataset.m = mi;
          minsEl.appendChild(mb);
        }
        time.appendChild(minsEl);
        body.appendChild(time);

        hoursEl.addEventListener("click", function (e) {
          var b = e.target.closest("button");
          if (b) { val.hh = +b.dataset.h; picked.h = true; if (val.mi == null) val.mi = 0; afterPick(); }
        });
        minsEl.addEventListener("click", function (e) {
          var b = e.target.closest("button");
          if (b) { val.mi = +b.dataset.m; picked.m = true; if (val.hh == null) val.hh = 0; afterPick(); }
        });
        segH.addEventListener("input", segInput);
        segM.addEventListener("input", segInput);
        segH.addEventListener("blur", segNormalize);
        segM.addEventListener("blur", segNormalize);
      }

      var foot = el("div", "bdtp-foot");
      var clear = el("button", "bdtp-btn", "Clear");
      var now = el("button", "bdtp-btn", "Now");
      var done = el("button", "bdtp-btn bdtp-primary", "Done");
      foot.append(clear, el("span", "bdtp-spring"), now, done);
      panel.appendChild(foot);

      clear.addEventListener("click", function () {
        val = {};
        hidden.value = "";
        display.value = "";
        commitDispatch();
        close(false);
      });
      now.addEventListener("click", function () {
        val = today();
        commit();
        close(false);
      });
      done.addEventListener("click", function () { commit(); close(false); });

      var backdrop = el("div", "bdtp-backdrop");
      backdrop.addEventListener("click", function () { commitIfPicked(); close(false); });
      root.append(backdrop, panel);

      panel.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); close(true); }
      });
    }

    /* ---------- rendering ---------- */

    function setView(v) {
      view = v;
      daysEl.style.display = v === "days" ? "" : "none";
      dowsEl.style.display = v === "days" ? "" : "none";
      monthsEl.style.display = v === "months" ? "" : "none";
      yearsEl.style.display = v === "years" ? "" : "none";
      if (v === "years") yearsBase = viewY - (viewY % 12);
      renderCal();
    }

    function nav(dir) {
      if (view === "days") {
        viewM += dir;
        if (viewM < 1) { viewM = 12; viewY--; }
        if (viewM > 12) { viewM = 1; viewY++; }
      } else if (view === "months") {
        viewY += dir;
      } else {
        yearsBase += dir * 12;
      }
      renderCal();
    }

    function renderCal() {
      if (!hasDate) return;
      if (view === "days") {
        titleBtn.textContent = cfg.months[viewM - 1] + " " + viewY;
        renderDays();
      } else if (view === "months") {
        titleBtn.textContent = viewY;
        renderMonths();
      } else {
        titleBtn.textContent = yearsBase + " – " + (yearsBase + 11);
        renderYears();
      }
    }

    function renderDays() {
      daysEl.textContent = "";
      var first = new Date(viewY, viewM - 1, 1);
      var lead = (first.getDay() - cfg.firstDay + 7) % 7;
      var start = new Date(viewY, viewM - 1, 1 - lead);
      var t = today();
      for (var i = 0; i < 42; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var cell = { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
        var b = el("button", "bdtp-day", d.getDate());
        if (cell.m !== viewM) b.classList.add("bdtp-out");
        if (cell.y === t.y && cell.m === t.m && cell.d === t.d) b.classList.add("bdtp-today");
        if (val.y === cell.y && val.m === cell.m && val.d === cell.d) b.classList.add("bdtp-sel");
        if (!inRange(cell)) b.disabled = true;
        b.dataset.iso = cell.y + "-" + p2(cell.m) + "-" + p2(cell.d);
        daysEl.appendChild(b);
      }
    }

    function renderMonths() {
      monthsEl.textContent = "";
      for (var i = 1; i <= 12; i++) {
        var b = el("button", "bdtp-cell", cfg.monthsShort[i - 1]);
        if (val.y === viewY && val.m === i) b.classList.add("bdtp-sel");
        b.dataset.m = i;
        monthsEl.appendChild(b);
      }
    }

    function renderYears() {
      yearsEl.textContent = "";
      for (var i = 0; i < 12; i++) {
        var y = yearsBase + i;
        var b = el("button", "bdtp-cell", y);
        if (val.y === y) b.classList.add("bdtp-sel");
        b.dataset.y = y;
        yearsEl.appendChild(b);
      }
    }

    function renderTime() {
      if (!hasTime) return;
      segH.value = val.hh != null ? p2(val.hh) : "--";
      segM.value = val.mi != null ? p2(val.mi) : "--";
      hoursEl.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("bdtp-sel", +b.dataset.h === val.hh);
      });
      minsEl.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("bdtp-sel", +b.dataset.m === val.mi);
      });
    }

    function preview() {
      if (mode !== "time" && val.y == null) return;
      if (mode !== "date" && (val.hh == null || val.mi == null)) {
        if (mode === "date") return;
        if (val.y == null) return;
      }
      display.value = formatPattern(cfg.pattern, val);
    }

    /* ---------- interactions ---------- */

    function afterPick() {
      renderTime();
      preview();
      if (mode === "time" && picked.h && picked.m) {
        commit(); // time-only: hour + minute explicitly picked → done
        close(false);
      }
    }

    function segInput(e) {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 2);
      var n = e.target.value === "" ? null : +e.target.value;
      if (e.target === segH) {
        if (n != null && n <= 23) { val.hh = n; if (val.mi == null) val.mi = 0; }
        if (e.target.value.length === 2) segM.select();
      } else if (n != null && n <= 59) {
        val.mi = n; if (val.hh == null) val.hh = 0;
      }
      renderTimeCellsOnly();
      preview();
    }

    function renderTimeCellsOnly() {
      hoursEl.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("bdtp-sel", +b.dataset.h === val.hh);
      });
      minsEl.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("bdtp-sel", +b.dataset.m === val.mi);
      });
    }

    function segNormalize() {
      renderTime();
    }

    function daysKeyNav(e) {
      var delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!delta) return;
      e.preventDefault();
      var buttons = Array.prototype.slice.call(daysEl.querySelectorAll("button"));
      var idx = buttons.indexOf(document.activeElement);
      if (idx < 0) idx = buttons.findIndex(function (b) { return b.classList.contains("bdtp-sel"); });
      if (idx < 0) idx = 0;
      var next = buttons[Math.min(41, Math.max(0, idx + delta))];
      if (next && !next.disabled) next.focus();
    }

    function hasPick() {
      if (mode === "time") return val.hh != null && val.mi != null;
      return val.y != null;
    }

    function commitIfPicked() {
      if (hasPick()) commit();
    }

    /* Fill missing parts with sensible defaults, clamp to range, write + notify. */
    function commit() {
      if (!hasPick()) return;
      var t = today();
      if (mode !== "time" && val.y == null) { val.y = t.y; val.m = t.m; val.d = t.d; }
      if (mode !== "date") {
        if (val.hh == null) val.hh = 0;
        if (val.mi == null) val.mi = 0;
      }
      if (minV && fullKey(mode, val) < fullKey(mode, minV)) val = Object.assign({}, minV);
      if (maxV && fullKey(mode, val) > fullKey(mode, maxV)) val = Object.assign({}, maxV);
      hidden.value = toIso(mode, val);
      display.value = formatPattern(cfg.pattern, val);
      commitDispatch();
    }

    function commitDispatch() {
      if (hidden.value !== lastCommitted) {
        lastCommitted = hidden.value;
        hidden.dispatchEvent(new Event("change"));
      }
    }

    /* ---------- open / close ---------- */

    function open() {
      if (root.classList.contains("bdtp-open")) return;
      if (!panel) buildPanel();
      val = parseIso(mode, hidden.value) || {};
      picked.h = picked.m = false;
      if (hasTime && parseIso(mode, hidden.value) && val.hh == null) { val.hh = 0; val.mi = 0; }
      var base = val.y != null ? val : today();
      viewY = base.y; viewM = base.m;
      if (hasDate) setView("days");
      renderTime();
      root.classList.add("bdtp-open");
      panel.classList.add("bdtp-visible");
      position();
      requestAnimationFrame(function () { panel.classList.add("bdtp-in"); });
      document.addEventListener("mousedown", outside, true);
      document.addEventListener("keydown", escKey, true);
    }

    function close(revert) {
      if (!panel) return;
      if (revert) {
        hidden.value = lastCommitted;
        display.value = lastCommitted ? formatPattern(cfg.pattern, parseIso(mode, lastCommitted)) : "";
      }
      root.classList.remove("bdtp-open");
      panel.classList.remove("bdtp-visible", "bdtp-in", "bdtp-above");
      panel.style.left = panel.style.right = "";
      document.removeEventListener("mousedown", outside, true);
      document.removeEventListener("keydown", escKey, true);
    }

    function outside(e) {
      if (!root.isConnected) { // component was replaced by an ajax update
        document.removeEventListener("mousedown", outside, true);
        document.removeEventListener("keydown", escKey, true);
        return;
      }
      if (!root.contains(e.target)) { commitIfPicked(); close(false); }
    }

    function escKey(e) {
      if (!root.isConnected) {
        document.removeEventListener("keydown", escKey, true);
        return;
      }
      if (e.key === "Escape") close(true);
    }

    function position() {
      if (window.matchMedia("(max-width: 600px)").matches) return; // bottom sheet
      var r = panel.getBoundingClientRect();
      var anchor = root.getBoundingClientRect();
      if (anchor.left + r.width > window.innerWidth - 8 && anchor.right - r.width > 8) {
        panel.style.left = "auto";
        panel.style.right = "0";
      }
      if (r.bottom > window.innerHeight - 8 && anchor.top - r.height > 8) {
        panel.classList.add("bdtp-above");
      }
    }

    /* ---------- field wiring ---------- */

    trigger.addEventListener("click", function () {
      root.classList.contains("bdtp-open") ? close(true) : open();
    });
    display.addEventListener("click", open);
    display.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); open(); }
      if (e.key === "Enter") { e.preventDefault(); parseTyped(); close(false); }
      if (e.key === "Escape") close(true);
    });
    display.addEventListener("blur", function () {
      setTimeout(function () {
        if (root.isConnected && !root.contains(document.activeElement)) parseTyped();
      }, 120);
    });

    function parseTyped() {
      var text = display.value.trim();
      if (text === "") {
        if (hidden.value !== "") { hidden.value = ""; val = {}; commitDispatch(); }
        return;
      }
      var parsed = parsePattern(cfg.pattern, mode, text);
      if (parsed) {
        val = parsed;
        commit();
        if (panel && root.classList.contains("bdtp-open")) {
          var base = val.y != null ? val : today();
          viewY = base.y; viewM = base.m;
          if (hasDate) renderCal();
          renderTime();
        }
      } else {
        // leave the typed text; server-side validation will flag it on submit
        hidden.value = text;
      }
    }

    if (hasDate) {
      // day click lives here so buildPanel stays readable
      root.addEventListener("click", function (e) {
        var day = e.target.closest(".bdtp-day");
        if (day && !day.disabled) {
          var iso = day.dataset.iso.split("-");
          val.y = +iso[0]; val.m = +iso[1]; val.d = +iso[2];
          if (mode === "date") { commit(); close(false); return; }
          viewY = val.y; viewM = val.m;
          renderCal();
          preview();
          return;
        }
        var mon = e.target.closest(".bdtp-months .bdtp-cell");
        if (mon) { viewM = +mon.dataset.m; setView("days"); return; }
        var yr = e.target.closest(".bdtp-years .bdtp-cell");
        if (yr) { viewY = +yr.dataset.y; setView("months"); }
      });
    }
  }

  window.BeckenDTP = { init: init };
})();
