/* Ward Dashboard - polls the EMR message feed and browses the registry
 * through the dashboard's own /api backend (which speaks FHIR to the EMR). */

const api = (path) => `api${path}`;

const feedEl = document.getElementById("feed");
const feedEmptyEl = document.getElementById("feed-empty");
const pendingBadge = document.getElementById("pending-badge");
const pollToggle = document.getElementById("poll-toggle");
const patientsEl = document.getElementById("patients");
const detailEl = document.getElementById("patient-detail");

let pollTimer = null;

/* ---------- message feed ---------- */

async function pullNextMessage() {
  try {
    const res = await fetch(api("/feed/next"));
    const msg = await res.json();
    if (msg.error) { showError(msg); return; }
    if (!msg.empty) {
      renderMessage(msg);
      // Admissions/discharges change the census - refresh the registry.
      if (msg.event === "admit" || msg.event === "discharge") loadPatients();
      // Drain quickly if more messages are waiting.
      pullNextMessage();
    }
    refreshPending();
  } catch (e) {
    showError({ message: String(e) });
  }
}

function renderMessage(msg) {
  feedEmptyEl.hidden = true;
  const li = document.createElement("li");
  li.className = msg.event;

  const line = document.createElement("div");
  line.className = "msg-line";
  line.append(
    el("span", "msg-type", msg.event.replace("-", " ")),
    el("span", "msg-analog", msg.v2Analog),
    el("strong", "", msg.patient),
    el("span", "", enhanceFlags(msg.detail)),
    el("span", "msg-time", msg.timestamp)
  );

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "raw FHIR message Bundle";
  const pre = document.createElement("pre");
  pre.textContent = msg.raw;
  details.append(summary, pre);

  li.append(line, details);
  feedEl.prepend(li);
}

function enhanceFlags(text) {
  // Highlight [H]/[L] out-of-range flags
  const span = document.createElement("span");
  const match = text.match(/^(.*)\[(H|L)\]\s*$/);
  if (match) {
    span.append(match[1]);
    span.append(el("span", "flag", `[${match[2]}]`));
  } else {
    span.textContent = text;
  }
  return span;
}

async function refreshPending() {
  try {
    const res = await fetch(api("/feed/pending"));
    const data = await res.json();
    pendingBadge.textContent = `queue: ${data.pending ?? "?"}`;
  } catch {
    pendingBadge.textContent = "queue: ?";
  }
}

function setPolling(on) {
  if (on && !pollTimer) {
    pollTimer = setInterval(pullNextMessage, 3000);
    pollToggle.textContent = "Stop polling";
    pollToggle.classList.add("polling");
    pullNextMessage();
  } else if (!on && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    pollToggle.textContent = "Start polling";
    pollToggle.classList.remove("polling");
  }
}

pollToggle.addEventListener("click", () => setPolling(!pollTimer));

/* ---------- simulation buttons ---------- */

document.querySelectorAll("[data-sim]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await fetch(api(`/simulate/${btn.dataset.sim}`), { method: "POST" });
      refreshPending();
      if (!pollTimer) pullNextMessage(); // show it even when not polling
    } finally {
      btn.disabled = false;
    }
  });
});

/* ---------- patient registry ---------- */

async function loadPatients() {
  try {
    const res = await fetch(api("/patients"));
    const data = await res.json();
    if (data.error) { showError(data); return; }
    patientsEl.replaceChildren();
    for (const p of data.patients) {
      const li = document.createElement("li");
      const dot = el("span", "census-dot" + (p.admitted ? " in" : ""), "");
      dot.title = p.admitted ? "currently admitted" : "not admitted";
      li.append(
        dot,
        el("span", "", `${p.name} (${p.gender}, *${p.birthDate})`),
        el("span", "mrn", p.mrn)
      );
      li.addEventListener("click", () => loadPatientDetail(p.id));
      patientsEl.append(li);
    }
  } catch (e) {
    showError({ message: String(e) });
  }
}

async function loadPatientDetail(id) {
  const res = await fetch(api(`/patients/${id}`));
  const p = await res.json();
  if (p.error) { showError(p); return; }

  detailEl.hidden = false;
  detailEl.replaceChildren(
    el("h3", "", `${p.name}`),
    el("div", "hint", `${p.mrn} · ${p.gender} · born ${p.birthDate} · ${p.phone ?? ""}`),
    el("h4", "", "Encounters"),
    tableOf(p.encounters,
      ["status", "class", "reason", "location", "attending", "start", "end"]),
    el("h4", "", "Observations"),
    tableOf(p.observations.map((o) => ({
      time: (o.time ?? "").slice(0, 16).replace("T", " "),
      category: o.category,
      test: `${o.test} (${o.loinc})`,
      value: `${o.value} ${o.unit}`,
      flag: o.flag ?? "",
    })), ["time", "category", "test", "value", "flag"]),
    rawDetails(p.raw)
  );
  detailEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function tableOf(rows, columns) {
  if (!rows.length) return el("p", "empty", "none");
  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  columns.forEach((c) => head.append(el("th", "", c)));
  const body = table.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    columns.forEach((c) => {
      const td = tr.insertCell();
      td.textContent = row[c] ?? "";
      if (c === "flag" && row[c]) td.className = "flag";
    });
  }
  return table;
}

function rawDetails(raw) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "raw FHIR Patient resource";
  const pre = document.createElement("pre");
  pre.textContent = raw;
  details.append(summary, pre);
  return details;
}

document.getElementById("refresh-patients").addEventListener("click", loadPatients);

/* ---------- helpers ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "" && text !== undefined) node.append(text);
  return node;
}

function showError(err) {
  feedEmptyEl.hidden = false;
  feedEmptyEl.textContent =
    `Error talking to the EMR: ${err.message ?? "unknown"}. ${err.hint ?? ""}`;
}

/* ---------- boot ---------- */

loadPatients();
refreshPending();
