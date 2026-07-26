/* THE NOCTURNE TAPES — restoration console and case file.
 *
 * The console is the game. Its four controls are real transforms on real audio:
 * playback rate carries pitch with it exactly as a tape machine does, so every
 * secret hidden by speed can be recovered by speed. Nothing is unlocked by
 * assertion; it is unlocked by operating the physics.
 */
(function () {
"use strict";

var D = window.CASE;
var SAVE = "nocturne.save.v1";

/* ═══ state ══════════════════════════════════════════════════════════ */
var S = {
  reels: [1],          // unlocked reel numbers
  tab: 1,
  solved: {},          // lockId -> true
  played: {},          // audioId -> true
  hints: {},           // reel -> count revealed
  cardsSeen: {},
  codaFound: false,
  finished: null       // "correct" | "partial" | "wrong"
};

function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} }
function load() {
  try {
    var raw = localStorage.getItem(SAVE);
    if (!raw) return false;
    var o = JSON.parse(raw);
    if (o && o.reels) { S = Object.assign(S, o); return true; }
  } catch (e) {}
  return false;
}

/* ═══ dom ════════════════════════════════════════════════════════════ */
var $ = function (id) { return document.getElementById(id); };
function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function fmt(t) {
  if (!isFinite(t) || t < 0) t = 0;
  var m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

/* ═══ audio engine ═══════════════════════════════════════════════════ */
var AC = null, master, filter, analyser, splitter, merger, gains = {};
var buffers = {};            // audioId -> {fwd, rev}
var src = null, cur = null;  // cur = {card, audioId, buf}
var T = { playing: false, offset: 0, anchor: 0, rate: 1, rev: false,
          A: null, B: null, endedGuard: 0 };

function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  splitter = AC.createChannelSplitter(2);
  merger = AC.createChannelMerger(2);
  ["LL", "LR", "RL", "RR"].forEach(function (k) {
    gains[k] = AC.createGain();
  });
  splitter.connect(gains.LL, 0); gains.LL.connect(merger, 0, 0);
  splitter.connect(gains.LR, 0); gains.LR.connect(merger, 0, 1);
  splitter.connect(gains.RL, 1); gains.RL.connect(merger, 0, 0);
  splitter.connect(gains.RR, 1); gains.RR.connect(merger, 0, 1);

  filter = AC.createBiquadFilter();
  filter.type = "allpass"; filter.frequency.value = 1000; filter.Q.value = 0.7;
  master = AC.createGain(); master.gain.value = 0.92;
  analyser = AC.createAnalyser();
  analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.75;

  merger.connect(filter); filter.connect(master);
  master.connect(analyser); analyser.connect(AC.destination);
  setBalance(0);
  drawSpectrum();
}

function fetchBuffer(audioId) {
  if (buffers[audioId]) return Promise.resolve(buffers[audioId]);
  return fetch("assets/audio/" + audioId + ".mp3")
    .then(function (r) {
      if (!r.ok) throw new Error("missing " + audioId);
      return r.arrayBuffer();
    })
    .then(function (ab) {
      return new Promise(function (res, rej) {
        AC.decodeAudioData(ab, res, rej);
      });
    })
    .then(function (buf) { buffers[audioId] = { fwd: buf, rev: null }; return buffers[audioId]; });
}

function reversed(entry) {
  if (entry.rev) return entry.rev;
  var f = entry.fwd;
  var r = AC.createBuffer(f.numberOfChannels, f.length, f.sampleRate);
  for (var c = 0; c < f.numberOfChannels; c++) {
    var a = f.getChannelData(c), b = r.getChannelData(c), n = f.length;
    for (var i = 0; i < n; i++) b[i] = a[n - 1 - i];
  }
  entry.rev = r;
  return r;
}

function activeBuffer() {
  if (!cur) return null;
  var e = buffers[cur.audioId];
  return T.rev ? reversed(e) : e.fwd;
}

function position() {
  if (!cur) return 0;
  if (!T.playing) return T.offset;
  var p = T.offset + (AC.currentTime - T.anchor) * T.rate;
  var d = activeBuffer().duration;
  if (T.A != null && T.B != null && p > T.B) {
    var span = T.B - T.A;
    if (span > 0.05) p = T.A + ((p - T.A) % span);
  }
  return Math.max(0, Math.min(p, d));
}

function startSource(offset) {
  var buf = activeBuffer();
  if (!buf) return;
  stopSource(true);
  src = AC.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = T.rate;
  if (T.A != null && T.B != null && T.B - T.A > 0.05) {
    src.loop = true; src.loopStart = T.A; src.loopEnd = T.B;
    if (offset < T.A || offset > T.B) offset = T.A;
  }
  src.connect(splitter);
  var guard = ++T.endedGuard;
  src.onended = function () {
    if (guard !== T.endedGuard) return;      // superseded by a restart
    T.playing = false; T.offset = 0;
    syncTransport();
  };
  T.offset = Math.max(0, Math.min(offset, buf.duration - 0.02));
  T.anchor = AC.currentTime;
  src.start(0, T.offset);
  T.playing = true;
  syncTransport();
}

function stopSource(silent) {
  if (src) {
    T.endedGuard++;
    try { src.stop(); } catch (e) {}
    try { src.disconnect(); } catch (e) {}
    src = null;
  }
  if (!silent) { T.playing = false; syncTransport(); }
}

function play() {
  if (!cur) return;
  if (AC.state === "suspended") AC.resume();
  startSource(T.offset >= activeBuffer().duration - 0.05 ? 0 : T.offset);
}
function pause() {
  if (!T.playing) return;
  T.offset = position();
  stopSource();
}
function toggle() { T.playing ? pause() : play(); }

function seek(t) {
  T.offset = t;
  if (T.playing) startSource(t); else syncTransport();
}

function setRate(r) {
  if (T.playing) { T.offset = position(); T.anchor = AC.currentTime; }
  T.rate = r;
  if (src) src.playbackRate.value = r;
  checkCoda();
}

function setDirection(rev) {
  if (rev === T.rev || !cur) return;
  var d = activeBuffer().duration;
  var p = position();
  T.rev = rev;
  var np = Math.max(0, d - p);            // stay at the same point on the tape
  if (T.playing) startSource(np); else { T.offset = np; syncTransport(); }
}

/* balance: 0 = true stereo, ±1 = that channel alone, in both ears */
function setBalance(b) {
  if (!AC) return;
  var m = Math.abs(b), t = AC.currentTime, g = function (n, v) {
    gains[n].gain.setTargetAtTime(v, t, 0.02);
  };
  if (b <= 0) { g("LL", 1); g("LR", m); g("RL", 0); g("RR", 1 - m); }
  else        { g("LL", 1 - m); g("LR", 0); g("RL", m); g("RR", 1); }
}

/* Returns the target corner frequency so the readout can show where the knob
   is pointing rather than where the ramp has got to. */
function setFilter(f) {
  if (!AC) return 0;
  var t = AC.currentTime, hz;
  if (Math.abs(f) < 0.04) {
    filter.type = "allpass";
    filter.frequency.setTargetAtTime(1000, t, 0.02);
    return 0;
  }
  if (f < 0) {                       // 20 kHz down to 200 Hz, logarithmically
    filter.type = "lowpass";
    hz = Math.exp(Math.log(20000) + (Math.log(200) - Math.log(20000)) * (-f));
  } else {                           // 20 Hz up to 6 kHz
    filter.type = "highpass";
    hz = Math.exp(Math.log(20) + (Math.log(6000) - Math.log(20)) * f);
  }
  filter.frequency.setTargetAtTime(hz, t, 0.02);
  return hz;
}

/* ═══ spectrum ═══════════════════════════════════════════════════════ */
function drawSpectrum() {
  var cv = $("spectrum"), ctx = cv.getContext("2d");
  var W = cv.width, H = cv.height;
  var bins = new Uint8Array(analyser.frequencyBinCount);
  (function loop() {
    requestAnimationFrame(loop);
    analyser.getByteFrequencyData(bins);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0906"; ctx.fillRect(0, 0, W, H);
    var nyq = AC.sampleRate / 2, top = 9000, n = Math.floor(bins.length * top / nyq);
    var bw = W / n;
    for (var i = 0; i < n; i++) {
      var v = bins[i] / 255, h = v * (H - 2);
      if (h < 0.5) continue;
      ctx.fillStyle = v > 0.72 ? "#f0c163" : v > 0.4 ? "#c08a2c" : "#6d4f19";
      ctx.fillRect(i * bw, H - h, Math.max(1, bw - 0.4), h);
    }
    // 5 kHz gridline: a quiet nudge that there is sound up there worth finding
    ctx.strokeStyle = "rgba(224,163,60,.16)"; ctx.beginPath();
    var x = (5000 / top) * W; ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  })();
}

/* ═══ transport ui ═══════════════════════════════════════════════════ */
var scrubbing = false;

function syncTransport() {
  var has = !!cur;
  ["btnPlay", "scrub", "kSpeed", "kFilter", "kBalance", "btnFwd", "btnRev",
   "btnA", "btnB", "btnLoopClr", "btnReset"].forEach(function (id) {
    $(id).disabled = !has;
  });
  $("btnPlay").classList.toggle("playing", T.playing);
  $("recLamp").classList.toggle("on", T.playing);
  $("btnFwd").classList.toggle("on", !T.rev);
  $("btnRev").classList.toggle("on", T.rev);
  $("oDir").textContent = T.rev ? "reversed" : "forward";
  if (!has) return;
  var d = activeBuffer().duration, p = position();
  if (!scrubbing) $("scrub").value = Math.round((p / d) * 1000);
  $("tNow").textContent = fmt(p);
  $("tEnd").textContent = fmt(d);
  var band = $("loopBand");
  if (T.A != null && T.B != null) {
    band.hidden = false;
    band.style.left = (T.A / d * 100) + "%";
    band.style.width = ((T.B - T.A) / d * 100) + "%";
  } else band.hidden = true;
  $("btnA").classList.toggle("on", T.A != null);
  $("btnB").classList.toggle("on", T.B != null);
}
setInterval(function () { if (cur) syncTransport(); }, 100);

function resetConsole() {
  $("kSpeed").value = 100; $("kFilter").value = 0; $("kBalance").value = 0;
  $("oSpeed").innerHTML = "1.00&times;"; $("oFilter").textContent = "off";
  $("oBalance").textContent = "centre";
  setRate(1); setFilter(0); setBalance(0);
  if (T.rev) setDirection(false);
  T.A = T.B = null;
  if (src) src.loop = false;
  syncTransport();
}

/* ═══ loading a card ═════════════════════════════════════════════════ */
function loadCard(card) {
  initAudio();
  if (AC.state === "suspended") AC.resume();
  if (!card.audio) { showRef(card); return; }
  stopSource();
  playCue("tr_reel_start", 0.3);        // the transport threading a new reel
  T.offset = 0; T.A = T.B = null;
  $("npTitle").textContent = card.title;
  $("npSub").textContent = "loading…";
  cur = null; syncTransport();
  fetchBuffer(card.audio).then(function () {
    cur = { card: card, audioId: card.audio };
    S.cardsSeen[card.id] = true; S.played[card.audio] = true; save();
    $("npSub").textContent = card.sub || "";
    renderCards();
    syncTransport();
    play();
  }).catch(function (e) {
    $("npSub").textContent = "could not load this reel";
    console.error(e);
  });
}

/* ═══ rendering ══════════════════════════════════════════════════════ */
function maxReel() { return Math.max.apply(null, S.reels); }

function cardUnlockedBy(cardId) {
  for (var i = 0; i < D.locks.length; i++)
    if (D.locks[i].unlocks_card === cardId) return D.locks[i].id;
  return null;
}

function visibleCards() {
  return D.cards.filter(function (c) {
    if (c.reel > maxReel()) return false;
    var need = cardUnlockedBy(c.id);
    if (need && !S.solved[need]) return false;
    return S.tab === "all" ? true : c.reel === S.tab;
  });
}

function renderTabs() {
  var nav = $("reelTabs"); nav.innerHTML = "";
  D.reels.forEach(function (r) {
    var open = S.reels.indexOf(r.n) >= 0;
    var b = el("button", "tab" + (S.tab === r.n ? " on" : ""),
      "REEL " + r.n + " · " + r.title + (open ? "" : ' <span class="lockicon">&#128274;</span>'));
    b.disabled = !open;
    b.onclick = function () { S.tab = r.n; save(); renderAll(); };
    nav.appendChild(b);
  });
  var all = el("button", "tab" + (S.tab === "all" ? " on" : ""), "ALL");
  all.onclick = function () { S.tab = "all"; save(); renderAll(); };
  nav.appendChild(all);
}

function cardNode(c, isFoley) {
  var b = el("button", "card" + (cur && cur.card.id === c.id ? " on" : ""));
  var thumb = el("div", "thumb");
  var img = el("img");
  img.src = c.img; img.alt = ""; img.loading = "lazy";
  img.onerror = function () { img.style.display = "none"; };
  thumb.appendChild(img);
  if (c.dur) thumb.appendChild(el("span", "dur", fmt(c.dur)));
  if (!S.cardsSeen[c.id]) thumb.appendChild(el("span", "new", "NEW"));
  if (isFoley && c.cat != null) thumb.appendChild(el("span", "cat", "#" + c.cat));
  b.appendChild(thumb);
  var meta = el("div", "meta");
  meta.appendChild(el("span", "ct", isFoley ? c.object : c.title));
  meta.appendChild(el("span", "cs", isFoley
    ? (c.cat != null ? "catalogue #" + c.cat : "not in the index") : (c.sub || "")));
  b.appendChild(meta);
  b.onclick = function () {
    loadCard(isFoley ? { id: c.id, title: c.object, sub: "Foley room · " +
      (c.cat != null ? "catalogue #" + c.cat : "not in the index"), audio: c.audio } : c);
  };
  return b;
}

function renderCards() {
  var host = $("cards"); host.innerHTML = "";
  var list = visibleCards();
  list.forEach(function (c) { host.appendChild(cardNode(c, false)); });
  $("trayCount").textContent = list.length + " item" + (list.length === 1 ? "" : "s");

  var showFoley = maxReel() >= 2 && (S.tab === 2 || S.tab === "all" || maxReel() >= 2);
  $("foleyWrap").hidden = !(maxReel() >= 2);
  if (maxReel() >= 2) {
    var fh = $("foley"); fh.innerHTML = "";
    D.foley.forEach(function (f) { fh.appendChild(cardNode(f, true)); });
  }
}

function renderLockSlot() {
  var slot = $("lockSlot"); slot.innerHTML = "";
  var lock = nextLock();
  if (!lock) {
    if (S.finished) {
      var b2 = el("button", "lockbtn done", "Case closed — replay the ending");
      b2.onclick = function () { showEnding(S.finished); };
      slot.appendChild(b2);
    }
    return;
  }
  var b = el("button", "lockbtn", "&#128274; " + lock.title);
  b.onclick = function () { openLock(lock); };
  slot.appendChild(b);
}

/* the next unsolved lock the player is entitled to attempt */
function nextLock() {
  for (var i = 0; i < D.locks.length; i++) {
    var L = D.locks[i];
    if (S.solved[L.id]) continue;
    if (S.reels.indexOf(L.reel) < 0) return null;   // reel not open yet
    return L;
  }
  return null;
}

function renderAll() { renderTabs(); renderCards(); renderLockSlot(); }

/* ═══ modals ═════════════════════════════════════════════════════════ */
function openModal(build) {
  var body = $("modalBody"); body.innerHTML = "";
  build(body);
  $("modal").hidden = false;
}
function closeModal() { $("modal").hidden = true; }
$("modalX").onclick = closeModal;
$("modal").onclick = function (e) { if (e.target === $("modal")) closeModal(); };

var toastTimer;
function toast(msg, ms) {
  var t = $("toast"); t.innerHTML = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, ms || 4200);
}

/* a card with no audio: the Morse chart. Rendered as a real, readable table
   rather than a photograph of one, because reel four depends on it. */
var MORSE = {"A":".-","B":"-...","C":"-.-.","D":"-..","E":".","F":"..-.","G":"--.",
"H":"....","I":"..","J":".---","K":"-.-","L":".-..","M":"--","N":"-.","O":"---",
"P":".--.","Q":"--.-","R":".-.","S":"...","T":"-","U":"..-","V":"...-","W":".--",
"X":"-..-","Y":"-.--","Z":"--..","1":".----","2":"..---","3":"...--","4":"....-",
"5":".....","6":"-....","7":"--...","8":"---..","9":"----.","0":"-----"};

function showRef(card) {
  openModal(function (b) {
    b.appendChild(el("h2", null, card.title));
    b.appendChild(el("p", "lead", card.sub));
    var grid = el("div", null, "");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px";
    Object.keys(MORSE).forEach(function (k) {
      var cell = el("div", null,
        '<b style="color:var(--amber);font-family:var(--serif);font-size:16px">' + k +
        '</b> <span style="letter-spacing:.18em;color:var(--cream)">' + MORSE[k] + "</span>");
      cell.style.cssText = "padding:5px 8px;border:1px solid var(--edge);border-radius:2px;font-size:12px";
      grid.appendChild(cell);
    });
    b.appendChild(grid);
    b.appendChild(el("p", "lead",
      "A dot is one unit. A dash is three. The gap inside a letter is one unit, " +
      "between letters three.")).style.marginTop = "18px";
  });
}

/* ═══ locks ══════════════════════════════════════════════════════════ */
function solveLock(L, sheetBody, verdictNode) {
  S.solved[L.id] = true;
  if (L.unlocks_reel && S.reels.indexOf(L.unlocks_reel) < 0) {
    S.reels.push(L.unlocks_reel);
    S.tab = L.unlocks_reel;
  }
  save();
  if (L.id === "lock4") playCue("safe_open", 0.6);   // the safe, not a switch
  playCue("tape_sys_lock_open");
  renderAll();
  verdictNode.className = "verdict ok";
  var msg = "<strong>Lock released.</strong>";
  if (L.unlocks_card) {
    var c = D.cards.filter(function (x) { return x.id === L.unlocks_card; })[0];
    if (c) msg += " A new item is in the tray: <em>" + c.title + "</em>.";
  }
  if (L.unlocks_reel) msg += " Reel " + L.unlocks_reel + " is open.";
  verdictNode.innerHTML = msg;
  setTimeout(function () {
    closeModal();
    if (L.unlocks_reel) toast("Reel " + L.unlocks_reel + " threaded.");
  }, 1500);
}

function failLock(readout, verdictNode) {
  playCue("tape_sys_lock_fail");
  if (readout) {
    readout.classList.add("bad");
    setTimeout(function () { readout.classList.remove("bad"); }, 340);
  }
  verdictNode.className = "verdict no";
  verdictNode.textContent = "No. Try the tape again.";
}

function playCue(id, vol) {
  // short console confirmations, played out-of-band so they don't disturb the
  // reel the player has loaded
  if (!AC) return;
  fetchBuffer(id).then(function (e) {
    var s = AC.createBufferSource();
    s.buffer = e.fwd;
    var g = AC.createGain(); g.gain.value = vol == null ? 0.55 : vol;
    s.connect(g); g.connect(AC.destination); s.start();
  }).catch(function () {});
}

function openLock(L) {
  openModal(function (b) {
    b.appendChild(el("h2", null, L.title));
    b.appendChild(el("p", "lead", L.prompt || ""));
    var verdict = el("div", "verdict", "");
    if (L.type === "keypad") buildKeypad(L, b, verdict);
    else if (L.type === "sequence") buildSequence(L, b, verdict);
    else if (L.type === "choice") buildChoice(L, b, verdict);
    else if (L.type === "accusation") buildAccusation(L, b, verdict);
    b.appendChild(verdict);
  });
}

function buildKeypad(L, b, verdict) {
  var entry = "";
  var readout = el("div", "readout", "");
  function paint() {
    var s = "";
    for (var i = 0; i < L.length; i++) s += (i < entry.length ? entry[i] : "·");
    readout.textContent = s;
  }
  paint();
  b.appendChild(readout);
  var pad = el("div", "keypad");
  ["1","2","3","4","5","6","7","8","9","CLR","0","OK"].forEach(function (k) {
    var btn = el("button", k.length > 1 ? "wide" : null, k);
    btn.onclick = function () {
      if (k === "CLR") { entry = ""; }
      else if (k === "OK") {
        if (entry.length !== L.length) return;
        if (entry === L.answer) { readout.classList.add("good"); solveLock(L, b, verdict); }
        else failLock(readout, verdict);
        return;
      } else if (entry.length < L.length) entry += k;
      paint();
      if (entry.length === L.length && entry === L.answer) {
        readout.classList.add("good"); solveLock(L, b, verdict);
      }
    };
    pad.appendChild(btn);
  });
  b.appendChild(pad);
}

function foleyById(id) {
  var f = D.foley.filter(function (x) { return x.id === id; })[0];
  if (f) return { id: f.id, label: f.object, img: f.img, audio: f.audio };
  var c = D.cards.filter(function (x) { return x.id === "c_cat17"; })[0];
  if (id === "cat17") return { id: "cat17", label: "Effect #17",
                               img: c ? c.img : "", audio: "cat17" };
  return { id: id, label: id, img: "", audio: id };
}

function buildSequence(L, b, verdict) {
  var picked = [];
  var slots = el("div", "slots");
  var pool = el("div", "pool");
  function paint() {
    slots.innerHTML = "";
    for (var i = 0; i < L.answer.length; i++) {
      var s = el("div", "slot" + (picked[i] ? " filled" : ""));
      s.appendChild(el("span", "n", String(i + 1)));
      if (picked[i]) {
        var o = foleyById(picked[i]);
        var im = el("img"); im.src = o.img; im.alt = o.label; s.appendChild(im);
        (function (idx) {
          s.onclick = function () { picked.splice(idx, 1); paint(); };
        })(i);
      } else s.appendChild(el("span", null, "—"));
      slots.appendChild(s);
    }
    Array.prototype.forEach.call(pool.children, function (btn) {
      btn.classList.toggle("used", picked.indexOf(btn.dataset.id) >= 0);
    });
  }
  L.pool.forEach(function (id) {
    var o = foleyById(id);
    var btn = el("button");
    btn.dataset.id = id;
    var im = el("img"); im.src = o.img; im.alt = ""; btn.appendChild(im);
    btn.appendChild(el("span", "pl", o.label));
    var pl = el("span", "play", "▶");
    pl.title = "Play this object";
    pl.onclick = function (e) { e.stopPropagation(); previewSound(o.audio); };
    btn.appendChild(pl);
    btn.onclick = function () {
      if (picked.length < L.answer.length && picked.indexOf(id) < 0) { picked.push(id); paint(); }
    };
    pool.appendChild(btn);
  });
  b.appendChild(el("h4", null, "The scene, in order"));
  b.appendChild(slots);
  b.appendChild(el("h4", null, "On the shelf — click &#9654; to hear one"));
  b.appendChild(pool);
  var acts = el("div", "actions");
  var ok = el("button", "big", "Run the scene");
  ok.onclick = function () {
    if (picked.length !== L.answer.length) { verdict.className = "verdict";
      verdict.textContent = "Fill every slot first."; return; }
    var good = picked.every(function (v, i) { return v === L.answer[i]; });
    if (good) solveLock(L, b, verdict); else failLock(null, verdict);
  };
  var clr = el("button", "ghost", "Clear");
  clr.onclick = function () { picked = []; paint(); };
  acts.appendChild(ok); acts.appendChild(clr);
  b.appendChild(acts);
  paint();
}

var previewSrc = null;
function previewSound(audioId) {
  initAudio();
  if (AC.state === "suspended") AC.resume();
  fetchBuffer(audioId).then(function (e) {
    if (previewSrc) { try { previewSrc.stop(); } catch (x) {} }
    previewSrc = AC.createBufferSource();
    previewSrc.buffer = e.fwd;
    var g = AC.createGain(); g.gain.value = 0.95;
    previewSrc.connect(g); g.connect(AC.destination);
    previewSrc.start();
  });
}

function buildChoice(L, b, verdict) {
  var sel = null;
  // some choice locks put a questioned recording above the options
  if (L.sample) {
    b.appendChild(el("h4", null, "The questioned recording"));
    var s = el("button", "choice");
    s.appendChild(el("span", "play", "▶"));
    s.appendChild(el("span", "cl", L.sample.label));
    s.onclick = function () { previewSound(L.sample.audio); };
    b.appendChild(s);
    b.appendChild(el("h4", null, "The references"));
  }
  var wrap = el("div", "choices");
  L.options.forEach(function (o) {
    var btn = el("button", "choice");
    btn.appendChild(el("span", "dot"));
    var t = el("span");
    t.appendChild(el("span", "cl", o.label));
    btn.appendChild(t);
    var pl = el("span", "play", "▶");
    pl.style.marginLeft = "auto";
    pl.onclick = function (e) {
      e.stopPropagation();
      previewSound(o.audio || foleyById(o.id).audio);
    };
    btn.appendChild(pl);
    btn.onclick = function () {
      sel = o.id;
      Array.prototype.forEach.call(wrap.children, function (c) { c.classList.remove("sel"); });
      btn.classList.add("sel");
    };
    wrap.appendChild(btn);
  });
  b.appendChild(wrap);
  var acts = el("div", "actions");
  var ok = el("button", "big", "Name it");
  ok.onclick = function () {
    if (!sel) return;
    if (sel === L.answer) solveLock(L, b, verdict); else failLock(null, verdict);
  };
  acts.appendChild(ok);
  b.appendChild(acts);
}

function suspectName(id) {
  var s = D.suspects.filter(function (x) { return x.id === id; })[0];
  return s ? s : { name: id, role: "" };
}

function buildAccusation(L, b, verdict) {
  var answers = {};
  L.parts.forEach(function (part) {
    b.appendChild(el("h4", null, part.question));
    var wrap = el("div", "choices");
    part.options.forEach(function (oid) {
      var label, role = "";
      if (part.labels && part.labels[oid]) label = part.labels[oid];
      else { var s = suspectName(oid); label = s.name; role = s.role; }
      var btn = el("button", "choice");
      btn.appendChild(el("span", "dot"));
      var t = el("span");
      t.appendChild(el("span", "cl", label));
      if (role) t.appendChild(el("span", "cr", role));
      btn.appendChild(t);
      btn.onclick = function () {
        answers[part.id] = oid;
        Array.prototype.forEach.call(wrap.children, function (c) { c.classList.remove("sel"); });
        btn.classList.add("sel");
      };
      wrap.appendChild(btn);
    });
    b.appendChild(wrap);
  });
  var acts = el("div", "actions");
  var ok = el("button", "big", "Say it");
  ok.onclick = function () {
    if (Object.keys(answers).length < L.parts.length) {
      verdict.className = "verdict";
      verdict.textContent = "Answer all three.";
      return;
    }
    var right = L.parts.filter(function (p) { return answers[p.id] === p.answer; }).length;
    var outcome = right === L.parts.length ? "correct" : right === 0 ? "wrong" : "partial";
    if (outcome === "correct") {
      S.solved[L.id] = true;
      S.finished = "correct";
      save(); renderAll();
    } else {
      S.finished = null;
    }
    closeModal();
    showEnding(outcome);
  };
  acts.appendChild(ok);
  b.appendChild(acts);
}

/* ═══ endings ════════════════════════════════════════════════════════ */
function showEnding(outcome) {
  var tape = outcome === "correct" ? "tape_end_correct"
           : outcome === "partial" ? "tape_end_partial" : "tape_end_wrong";
  var card = { id: "_end_" + outcome, title: outcome === "correct"
      ? "The Archivist — the truth" : "The Archivist — not yet",
    sub: "Reel five", audio: tape };
  loadCard(card);
  openModal(function (b) {
    b.className = "ending";
    b.appendChild(el("h2", null, outcome === "correct"
      ? "Nobody took her." : outcome === "partial"
      ? "Part of that is true." : "That is the answer they printed."));
    if (outcome === "correct") {
      b.appendChild(el("p", "epi",
        "The Archivist is speaking on the console. Let her finish."));
      var hint = el("div", "coda-hint",
        "One thing left. You have had her voice in your hands for five reels — " +
        "and you have never once run <em>her</em> through the console. " +
        "Load any of her narration and find her true speed.");
      b.appendChild(hint);
      if (S.codaFound) {
        var go = el("button", "big", "Play the last reel");
        go.style.marginTop = "16px";
        go.onclick = function () { revealCoda(true); };
        b.appendChild(go);
      }
    } else {
      b.appendChild(el("p", "epi", outcome === "partial"
        ? "She will not tell you which part you have wrong. Go back to the tape that " +
          "is not saying anything."
        : "Everything you need has already been played to you at least twice."));
      var again = el("button", "big", "Back to the tapes");
      again.style.marginTop = "16px";
      again.onclick = closeModal;
      b.appendChild(again);
    }
  });
}

/* ═══ the coda ═══════════════════════════════════════════════════════ */
function checkCoda() {
  if (!cur || !D.coda) return;
  if (D.coda.tracks.indexOf(cur.audioId) < 0) return;
  if (Math.abs(T.rate - D.coda.target_speed) > D.coda.tolerance) return;
  if (S.codaFound) return;
  S.codaFound = true; save();
  if (S.finished === "correct") {
    setTimeout(function () { revealCoda(false); }, 900);
  } else {
    toast("The pitch just resolved into a voice you already know. " +
          "<em>Finish the case and come back to her.</em>", 7000);
  }
}

function revealCoda(fromButton) {
  var card = { id: "_coda", title: "Vera Lyle", sub: "No disguise. No tape colour.",
               audio: D.coda.reveal };
  resetConsole();
  loadCard(card);
  openModal(function (b) {
    b.className = "ending";
    b.appendChild(el("h2", null, "Vera Lyle"));
    b.appendChild(el("p", "epi",
      "Sixty years in a dead woman's register, because people will believe " +
      "anything if the pitch is low enough. She is playing now, at her own speed."));
    b.appendChild(el("p", "lead",
      "You solved The Nocturne Tapes."));
    var again = el("button", "ghost", "Close");
    again.onclick = closeModal;
    b.appendChild(again);
  });
}

/* ═══ hints ══════════════════════════════════════════════════════════ */
function openHints() {
  var reel = (S.tab === "all") ? maxReel() : S.tab;
  var ids = D.hints[String(reel)] || [];
  var used = S.hints[reel] || 0;
  openModal(function (b) {
    b.appendChild(el("h2", null, "Ask the Archivist"));
    b.appendChild(el("p", "lead",
      "Reel " + reel + ". She will give you three, and they get less subtle. " +
      "She does not think less of you for asking."));
    var list = el("div");
    ids.forEach(function (id, i) {
      var row = el("div");
      row.style.cssText = "margin-bottom:10px";
      if (i < used) {
        var play = el("button", "ghost", "&#9654; Hint " + (i + 1) + " — play again");
        play.onclick = function () { previewSound(id); };
        row.appendChild(play);
      } else if (i === used) {
        var ask = el("button", "big", "Reveal hint " + (i + 1));
        ask.onclick = function () {
          S.hints[reel] = used + 1; save();
          previewSound(id);
          closeModal(); openHints();
        };
        row.appendChild(ask);
      } else {
        var lockd = el("button", "ghost", "Hint " + (i + 1) + " — locked");
        lockd.disabled = true;
        row.appendChild(lockd);
      }
      list.appendChild(row);
    });
    b.appendChild(list);
  });
}

/* ═══ notes ══════════════════════════════════════════════════════════ */
function openNotes() {
  openModal(function (b) {
    b.appendChild(el("h2", null, "Case notes"));
    b.appendChild(el("p", "lead", "Case 441-57 · Lyle, Vera · reported missing 1 Nov 1957"));
    var ul = el("ul", null, "");
    var wrap = el("div", "notes");

    D.reels.forEach(function (r) {
      if (S.reels.indexOf(r.n) < 0) return;
      var li = el("li", null, "<b>Reel " + r.n + " — " + r.title + "</b>");
      var locks = D.locks.filter(function (L) { return L.reel === r.n; });
      var sub = el("ul");
      locks.forEach(function (L) {
        sub.appendChild(el("li", null, (S.solved[L.id]
          ? '<span class="solvedtag">OPEN</span> ' : "&#128274; ") + L.title));
      });
      li.appendChild(sub);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    b.appendChild(wrap);

    var heard = D.cards.filter(function (c) { return c.audio && S.played[c.audio]; }).length;
    var total = D.cards.filter(function (c) { return c.audio && c.reel <= maxReel(); }).length;
    b.appendChild(el("h4", null, "Progress"));
    b.appendChild(el("p", "lead",
      heard + " of " + total + " available items played. " +
      Object.keys(S.solved).length + " of " + D.locks.length + " locks open." +
      (S.codaFound ? " You found the Archivist." : "")));

    var reset = el("button", "ghost", "Erase this case and start again");
    reset.onclick = function () {
      if (!confirm("Erase all progress?")) return;
      localStorage.removeItem(SAVE);
      location.reload();
    };
    b.appendChild(el("div", "actions")).appendChild(reset);
  });
}

/* ═══ wiring ═════════════════════════════════════════════════════════ */
$("btnPlay").onclick = toggle;
$("btnFwd").onclick = function () { setDirection(false); };
$("btnRev").onclick = function () { setDirection(true); };
$("btnReset").onclick = resetConsole;
$("btnNotes").onclick = openNotes;
$("btnHint").onclick = openHints;

$("kSpeed").oninput = function () {
  var r = this.value / 100;
  $("oSpeed").innerHTML = r.toFixed(2) + "&times;";
  setRate(r);
};
$("kFilter").oninput = function () {
  var f = this.value / 100, hz = setFilter(f);
  $("oFilter").textContent = !hz ? "off"
    : (f < 0 ? "low-pass " : "high-pass ") + Math.round(hz) + " Hz";
};
$("kBalance").oninput = function () {
  var b = this.value / 100;
  setBalance(b);
  $("oBalance").textContent = Math.abs(b) < 0.04 ? "centre"
    : b < 0 ? "left " + Math.round(-b * 100) + "%" : "right " + Math.round(b * 100) + "%";
};

$("scrub").addEventListener("input", function () {
  scrubbing = true;
  if (!cur) return;
  var d = activeBuffer().duration;
  $("tNow").textContent = fmt(this.value / 1000 * d);
});
$("scrub").addEventListener("change", function () {
  scrubbing = false;
  if (!cur) return;
  seek(this.value / 1000 * activeBuffer().duration);
});

$("btnA").onclick = function () {
  T.A = position();
  if (T.B != null && T.B <= T.A) T.B = null;
  applyLoop();
};
$("btnB").onclick = function () {
  T.B = position();
  if (T.A != null && T.A >= T.B) T.A = null;
  applyLoop();
};
$("btnLoopClr").onclick = function () { T.A = T.B = null; applyLoop(); };
function applyLoop() {
  if (T.playing) startSource(position()); else syncTransport();
}

document.addEventListener("keydown", function (e) {
  if ($("modal").hidden === false) { if (e.key === "Escape") closeModal(); return; }
  if (!$("title").hidden) return;
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); toggle(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); seek(Math.max(0, position() - 5)); }
  else if (e.key === "ArrowRight") {
    e.preventDefault();
    seek(Math.min(activeBuffer() ? activeBuffer().duration : 0, position() + 5));
  }
});

/* ═══ boot ═══════════════════════════════════════════════════════════ */
function start(resuming) {
  $("title").hidden = true;
  $("app").hidden = false;
  initAudio();
  if (AC.state === "suspended") AC.resume();
  renderAll();
  if (!resuming) {
    var first = D.cards[0];
    if (first) loadCard(first);
  }
}

var hasSave = load();
$("assetCount").textContent =
  D.cards.length + " evidence items · " + D.foley.length + " Foley objects";
$("btnStart").onclick = function () {
  if (hasSave) { localStorage.removeItem(SAVE); }
  S = { reels: [1], tab: 1, solved: {}, played: {}, hints: {}, cardsSeen: {},
        codaFound: false, finished: null };
  start(false);
};
if (hasSave) {
  $("btnResume").hidden = false;
  $("btnStart").textContent = "Start a new case";
  $("btnResume").onclick = function () { start(true); };
}
})();
