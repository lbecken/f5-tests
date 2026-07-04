"use strict";
/* DocStudy frontend — vanilla JS, no build step.
   Talks to the API contract in DESIGN.md. Backend may not be up yet:
   every API call fails gracefully (toast + console) without blanking the page. */

(function () {
  // ---------- State ----------
  const state = {
    config: null,
    topics: [],
    documents: [],
    activeTopicId: null,
    activeTopic: null,   // full topic incl. messages
    streaming: false,
    abortController: null,
    modalMode: "new",    // "new" | "rename"
    modalTopicId: null,
    docPollTimer: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const esc = (s) => String(s == null ? "" : s);

  // ---------- Mermaid ----------
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (window.mermaid) {
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: prefersDark ? "dark" : "default",
      });
    } catch (e) { console.warn("mermaid init failed", e); }
  }

  // ---------- Toasts ----------
  function toast(message, kind = "error", ms = 5000) {
    const box = $("#toasts");
    const t = el("div", "toast " + kind, message);
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, ms);
  }

  // ---------- API helper ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, opts);
    if (!res.ok) {
      let detail = res.status + " " + res.statusText;
      try { const j = await res.json(); if (j && j.detail) detail = j.detail; } catch (_) {}
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }
    const ctype = res.headers.get("content-type") || "";
    if (ctype.includes("application/json")) return res.json();
    return res;
  }

  function friendlyErr(e, ctx) {
    // Connection refused / backend down surfaces as TypeError from fetch.
    if (e instanceof TypeError) return (ctx ? ctx + ": " : "") + "backend not reachable";
    return (ctx ? ctx + ": " : "") + (e.message || "unknown error");
  }

  // ================= Config =================
  async function loadConfig() {
    const node = $("#config-status");
    try {
      const cfg = await api("/api/config");
      state.config = cfg;
      const reachable = cfg.ollama_reachable ?? cfg.ollama ?? cfg.reachable;
      const model = cfg.chat_model || (cfg.models && cfg.models.chat) ||
        (cfg.profile && cfg.profile.chat_model) || cfg.model || "";
      const profile = (typeof cfg.profile === "string" ? cfg.profile : (cfg.profile && cfg.profile.name)) ||
        cfg.active_profile || "";
      node.className = "config-status " + (reachable ? "ok" : "down");
      const label = [profile, model].filter(Boolean).join(" · ") || "connected";
      node.innerHTML = '<span class="dot"></span>' + esc(reachable ? label : "Ollama offline");
    } catch (e) {
      node.className = "config-status down";
      node.innerHTML = '<span class="dot"></span>offline';
      console.warn("config", e);
    }
  }

  // ================= Documents =================
  async function loadDocuments() {
    try {
      const docs = await api("/api/documents");
      state.documents = Array.isArray(docs) ? docs : (docs.documents || []);
      renderDocuments();
      scheduleDocPoll();
    } catch (e) {
      state.documents = [];
      renderDocuments();
      console.warn("documents", e);
    }
  }

  function docProgress(d) {
    // Tolerate several plausible shapes for progress info.
    const p = d.progress || d.indexing || {};
    const done = p.done ?? p.embedded ?? p.completed ?? d.chunks_done ?? d.progress_done;
    const total = p.total ?? d.chunks_total ?? d.progress_total;
    if (typeof done === "number" && typeof total === "number" && total > 0) {
      return { done, total, pct: Math.min(100, Math.round((done / total) * 100)) };
    }
    return null;
  }

  function isIndexing(d) {
    return d.status === "indexing" || d.status === "pending";
  }

  function renderDocuments() {
    const list = $("#documents-list");
    list.innerHTML = "";
    if (!state.documents.length) {
      const empty = el("li", "modal-docs-empty", "No documents yet. Add one by path or upload above.");
      list.appendChild(empty);
      return;
    }
    for (const d of state.documents) {
      const li = el("li", "doc-item");
      const top = el("div", "doc-top");
      top.appendChild(el("span", "doc-name", d.name || d.source_path || ("Document " + d.id)));
      const status = el("span", "doc-status " + (d.status || ""), d.status || "unknown");
      top.appendChild(status);
      const del = el("button", "icon-btn", "🗑");
      del.title = "Delete document";
      del.addEventListener("click", () => deleteDocument(d));
      top.appendChild(del);
      li.appendChild(top);

      const subText = d.error ? ("⚠ " + d.error) : (d.source_path || d.format || "");
      if (subText) {
        const sub = el("div", "doc-sub", subText);
        li.appendChild(sub);
      }

      if (isIndexing(d)) {
        const prog = docProgress(d);
        const bar = el("div", "progress");
        const span = el("span");
        span.style.width = (prog ? prog.pct : 8) + "%";
        bar.appendChild(span);
        li.appendChild(bar);
        if (prog) {
          li.appendChild(el("div", "doc-sub", "Indexing " + prog.done + " / " + prog.total + " chunks (" + prog.pct + "%)"));
        }
      }
      list.appendChild(li);
    }
  }

  function scheduleDocPoll() {
    const anyIndexing = state.documents.some(isIndexing);
    if (anyIndexing && !state.docPollTimer) {
      state.docPollTimer = setInterval(pollDocuments, 2000);
    } else if (!anyIndexing && state.docPollTimer) {
      clearInterval(state.docPollTimer);
      state.docPollTimer = null;
    }
  }

  async function pollDocuments() {
    try {
      const docs = await api("/api/documents");
      state.documents = Array.isArray(docs) ? docs : (docs.documents || []);
      renderDocuments();
      scheduleDocPoll();
    } catch (e) {
      console.warn("poll documents", e);
    }
  }

  async function addDocumentByPath() {
    const input = $("#doc-path");
    const path = input.value.trim();
    if (!path) return;
    try {
      await api("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      input.value = "";
      toast("Added document, indexing started.", "ok", 3000);
      loadDocuments();
    } catch (e) {
      toast(friendlyErr(e, "Add document"));
    }
  }

  async function uploadDocument(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api("/api/documents", { method: "POST", body: fd });
      toast("Uploaded " + file.name + ", indexing started.", "ok", 3000);
      loadDocuments();
    } catch (e) {
      toast(friendlyErr(e, "Upload"));
    }
  }

  async function deleteDocument(d) {
    if (!confirm('Delete document "' + (d.name || d.id) + '"? This removes it from the index.')) return;
    try {
      await api("/api/documents/" + d.id, { method: "DELETE" });
      loadDocuments();
    } catch (e) {
      toast(friendlyErr(e, "Delete document"));
    }
  }

  // ================= Topics =================
  async function loadTopics() {
    try {
      const topics = await api("/api/topics");
      state.topics = Array.isArray(topics) ? topics : (topics.topics || []);
      renderTopics();
    } catch (e) {
      state.topics = [];
      renderTopics();
      console.warn("topics", e);
    }
  }

  function renderTopics() {
    const list = $("#topics-list");
    list.innerHTML = "";
    if (!state.topics.length) {
      list.appendChild(el("li", "modal-docs-empty", "No topics yet. Click “+ New”."));
      return;
    }
    for (const t of state.topics) {
      const li = el("li", "topic-item" + (t.id === state.activeTopicId ? " active" : ""));
      li.appendChild(el("span", "topic-name", t.name || ("Topic " + t.id)));
      const actions = el("div", "row-actions");
      const rename = el("button", "icon-btn", "✎");
      rename.title = "Rename";
      rename.addEventListener("click", (ev) => { ev.stopPropagation(); openModal("rename", t); });
      const del = el("button", "icon-btn", "🗑");
      del.title = "Delete";
      del.addEventListener("click", (ev) => { ev.stopPropagation(); deleteTopic(t); });
      actions.appendChild(rename);
      actions.appendChild(del);
      li.appendChild(actions);
      li.addEventListener("click", () => openTopic(t.id));
      list.appendChild(li);
    }
  }

  async function openTopic(id) {
    state.activeTopicId = id;
    renderTopics();
    try {
      const topic = await api("/api/topics/" + id);
      state.activeTopic = topic;
      renderActiveTopic();
    } catch (e) {
      state.activeTopic = null;
      toast(friendlyErr(e, "Open topic"));
      renderActiveTopic();
    }
  }

  function topicDocIds(topic) {
    return topic.document_ids || topic.documents?.map((d) => (typeof d === "object" ? d.id : d)) || [];
  }

  function renderActiveTopic() {
    const header = $("#main-header");
    const composer = $("#composer");
    const msgs = $("#messages");
    const topic = state.activeTopic;

    if (!topic) {
      header.hidden = true;
      composer.hidden = true;
      msgs.innerHTML = "";
      if (!state.topics.length) {
        renderEmpty(msgs, "📚", "Welcome to DocStudy",
          "Create a topic to start studying your documents. Add documents in the sidebar first.");
      } else {
        renderEmpty(msgs, "💬", "No topic selected", "Pick a topic on the left, or create a new one.");
      }
      return;
    }

    header.hidden = false;
    composer.hidden = false;
    $("#active-topic-name").textContent = topic.name || ("Topic " + topic.id);

    const badges = $("#topic-docs-badges");
    badges.innerHTML = "";
    const ids = topicDocIds(topic);
    const names = ids.map((id) => {
      const d = state.documents.find((x) => x.id === id);
      return d ? (d.name || d.source_path) : ("#" + id);
    });
    if (topic.documents && topic.documents.length && typeof topic.documents[0] === "object") {
      // topic may embed document objects with names directly
      names.length = 0;
      topic.documents.forEach((d) => names.push(d.name || d.source_path || ("#" + d.id)));
    }
    for (const n of names) badges.appendChild(el("span", "doc-badge", n));

    renderMessages();
  }

  function renderEmpty(container, icon, title, body) {
    container.innerHTML = "";
    const e = el("div", "empty-state");
    e.appendChild(el("div", "big", icon));
    e.appendChild(el("h3", null, title));
    e.appendChild(el("p", null, body));
    container.appendChild(e);
  }

  function renderMessages() {
    const msgs = $("#messages");
    msgs.innerHTML = "";
    const list = state.activeTopic.messages || [];
    if (!list.length) {
      renderEmpty(msgs, "✳️", "Ask something about your documents…",
        "Your questions and cited answers will appear here.");
      return;
    }
    for (const m of list) {
      msgs.appendChild(renderMessage(m));
    }
    scrollToBottom();
  }

  function renderMessage(m) {
    const wrap = el("div", "msg msg-" + (m.role || "assistant"));
    wrap.appendChild(el("div", "msg-role", m.role === "user" ? "You" : "Assistant"));
    const bubble = el("div", "bubble");
    if (m.role === "user") {
      bubble.textContent = m.content || "";
    } else {
      const md = el("div", "markdown");
      renderMarkdownInto(md, m.content || "");
      bubble.appendChild(md);
    }
    wrap.appendChild(bubble);
    return wrap;
  }

  async function deleteTopic(t) {
    if (!confirm('Delete topic "' + (t.name || t.id) + '"? This cannot be undone.')) return;
    try {
      await api("/api/topics/" + t.id, { method: "DELETE" });
      if (state.activeTopicId === t.id) {
        state.activeTopicId = null;
        state.activeTopic = null;
        renderActiveTopic();
      }
      loadTopics();
    } catch (e) {
      toast(friendlyErr(e, "Delete topic"));
    }
  }

  // ---------- Markdown + mermaid + citations ----------
  const CITATION_RE = /\[[^\[\]]*§[^\[\]]*\]/g;

  function renderMarkdownInto(container, text) {
    let html;
    try {
      html = window.marked ? window.marked.parse(text || "") : escapeHtml(text || "");
    } catch (e) {
      html = escapeHtml(text || "");
    }
    container.innerHTML = html;
    styleCitations(container);
    renderMermaid(container);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  // Post-process citations by walking text nodes so we never corrupt markup.
  function styleCitations(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf("§") === -1) return NodeFilter.FILTER_REJECT;
        const p = node.parentNode;
        if (p && (p.tagName === "CODE" || p.tagName === "PRE" || p.tagName === "SCRIPT" || p.tagName === "STYLE"))
          return NodeFilter.FILTER_REJECT;
        return CITATION_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    for (const node of targets) {
      const frag = document.createDocumentFragment();
      const text = node.nodeValue;
      let last = 0;
      CITATION_RE.lastIndex = 0;
      let match;
      while ((match = CITATION_RE.exec(text))) {
        if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        const badge = el("span", "citation", match[0]);
        badge.title = "Citation";
        frag.appendChild(badge);
        last = match.index + match[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  let mermaidSeq = 0;
  function renderMermaid(root) {
    if (!window.mermaid) return;
    const blocks = root.querySelectorAll("pre > code.language-mermaid, code.language-mermaid");
    const nodes = [];
    blocks.forEach((code) => {
      const pre = code.closest("pre") || code;
      const div = el("div", "mermaid");
      div.textContent = code.textContent;
      div.id = "mmd-" + (++mermaidSeq);
      pre.parentNode.replaceChild(div, pre);
      nodes.push(div);
    });
    if (nodes.length) {
      try {
        const p = window.mermaid.run({ nodes });
        if (p && p.catch) p.catch((e) => console.warn("mermaid run", e));
      } catch (e) { console.warn("mermaid run", e); }
    }
  }

  function scrollToBottom() {
    const m = $("#messages");
    m.scrollTop = m.scrollHeight;
  }

  // ================= Modal (new / rename topic) =================
  function openModal(mode, topic) {
    state.modalMode = mode;
    state.modalTopicId = topic ? topic.id : null;
    $("#modal-title").textContent = mode === "rename" ? "Rename topic" : "New topic";
    $("#modal-save").textContent = mode === "rename" ? "Save" : "Create";
    $("#modal-topic-name").value = topic ? (topic.name || "") : "";

    const docsBox = $("#modal-docs");
    docsBox.innerHTML = "";
    const selectedIds = topic ? topicDocIds(topic) : [];
    if (!state.documents.length) {
      docsBox.appendChild(el("div", "modal-docs-empty", "No documents available. Add documents first."));
    } else {
      for (const d of state.documents) {
        const row = el("label", "modal-doc");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = d.id;
        cb.checked = selectedIds.includes(d.id);
        row.appendChild(cb);
        row.appendChild(el("span", null, d.name || d.source_path || ("Document " + d.id)));
        row.appendChild(el("span", "md-status", d.status || ""));
        docsBox.appendChild(row);
      }
    }
    $("#modal-backdrop").hidden = false;
    $("#modal-topic-name").focus();
  }

  function closeModal() { $("#modal-backdrop").hidden = true; }

  function modalSelectedDocIds() {
    return Array.from($("#modal-docs").querySelectorAll('input[type="checkbox"]:checked'))
      .map((cb) => Number(cb.value));
  }

  async function saveModal() {
    const name = $("#modal-topic-name").value.trim();
    if (!name) { toast("Please enter a topic name.", "warn", 2500); return; }
    const document_ids = modalSelectedDocIds();
    try {
      if (state.modalMode === "rename") {
        await api("/api/topics/" + state.modalTopicId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, document_ids }),
        });
        closeModal();
        await loadTopics();
        if (state.activeTopicId === state.modalTopicId) openTopic(state.modalTopicId);
      } else {
        const created = await api("/api/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, document_ids }),
        });
        closeModal();
        await loadTopics();
        if (created && created.id != null) openTopic(created.id);
      }
    } catch (e) {
      toast(friendlyErr(e, "Save topic"));
    }
  }

  // ================= Export / Import =================
  async function exportTopic() {
    if (state.activeTopicId == null) return;
    try {
      const res = await fetch("/api/topics/" + state.activeTopicId + "/export");
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = (state.activeTopic && state.activeTopic.name ? state.activeTopic.name : "topic")
        .replace(/[^a-z0-9-_ ]/gi, "_");
      a.href = url;
      a.download = name + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(friendlyErr(e, "Export"));
    }
  }

  async function importTopic(file) {
    if (!file) return;
    try {
      const text = await file.text();
      let body;
      try { body = JSON.parse(text); }
      catch (_) { toast("Import file is not valid JSON.", "error"); return; }
      const result = await api("/api/topics/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadTopics();
      const warnings = (result && (result.warnings || result.missing_documents || result.missing)) || [];
      if (Array.isArray(warnings) && warnings.length) {
        toast("Imported with warnings: " + warnings.map((w) => (typeof w === "string" ? w : (w.name || JSON.stringify(w)))).join(", "), "warn", 8000);
      } else {
        toast("Topic imported.", "ok", 3000);
      }
      if (result && result.id != null) openTopic(result.id);
    } catch (e) {
      toast(friendlyErr(e, "Import"));
    }
  }

  // ================= Sending messages (SSE over fetch) =================
  async function sendMessage() {
    if (state.streaming || state.activeTopicId == null) return;
    const input = $("#composer-input");
    const content = input.value.trim();
    if (!content) return;

    // Optimistically append the user message.
    if (!state.activeTopic.messages) state.activeTopic.messages = [];
    // clear empty-state if present
    if ($("#messages").querySelector(".empty-state")) $("#messages").innerHTML = "";
    const userMsg = { role: "user", content };
    state.activeTopic.messages.push(userMsg);
    $("#messages").appendChild(renderMessage(userMsg));
    input.value = "";
    autoGrow(input);
    scrollToBottom();

    setStreaming(true);
    const ctrl = new AbortController();
    state.abortController = ctrl;

    // Build the assistant message container up front.
    const asstWrap = el("div", "msg msg-assistant");
    asstWrap.appendChild(el("div", "msg-role", "Assistant"));
    const bubble = el("div", "bubble");
    let activityBox = null;      // collapsible activity container
    let activityBody = null;
    let activityCount = 0;
    const toolLines = {};        // name -> last created line for attaching results
    const answer = el("div", "markdown streaming-caret");
    bubble.appendChild(answer);
    asstWrap.appendChild(bubble);
    $("#messages").appendChild(asstWrap);
    scrollToBottom();

    let answerText = "";
    let renderScheduled = false;
    const RENDER_INTERVAL = 100; // ~10 renders/sec
    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      setTimeout(() => {
        renderScheduled = false;
        answer.classList.remove("streaming-caret");
        renderMarkdownInto(answer, answerText);
        answer.classList.add("streaming-caret");
        scrollToBottom();
      }, RENDER_INTERVAL);
    }

    function ensureActivity() {
      if (activityBox) return;
      activityBox = el("div", "activity open");
      const head = el("div", "activity-head");
      head.appendChild(el("span", "chevron", "▶"));
      head.appendChild(el("span", null, "Agent activity"));
      const count = el("span", "count", "");
      head.appendChild(count);
      head.addEventListener("click", () => activityBox.classList.toggle("open"));
      activityBody = el("div", "activity-body");
      activityBox.appendChild(head);
      activityBox.appendChild(activityBody);
      activityBox._count = count;
      bubble.insertBefore(activityBox, answer);
    }

    const TOOL_ICONS = { search: "🔍", read_section: "📖", get_toc: "🗂", find_similar: "🔗", list_documents: "📚" };

    function addToolCall(name, args) {
      ensureActivity();
      activityCount++;
      activityBox._count.textContent = activityCount + (activityCount === 1 ? " step" : " steps");
      const line = el("div", "activity-line");
      const icon = TOOL_ICONS[name] || "🛠";
      let desc = name;
      if (args) {
        if (args.query != null) desc = name + ": " + args.query;
        else if (args.section_path != null) desc = name + " §" + args.section_path + (args.doc_id != null ? " (doc " + args.doc_id + ")" : "");
        else if (args.text != null) desc = name + ": " + String(args.text).slice(0, 80);
        else { const keys = Object.keys(args); if (keys.length) desc = name + "(" + keys.map((k) => k + "=" + JSON.stringify(args[k])).join(", ") + ")"; }
      }
      line.innerHTML = "";
      line.appendChild(document.createTextNode(icon + " "));
      line.appendChild(el("span", "al-query", desc));
      activityBody.appendChild(line);
      toolLines[name] = line;
      scrollToBottom();
      return line;
    }

    function addToolResult(name, summary) {
      const line = toolLines[name] || (activityBody && activityBody.lastElementChild);
      if (!line) return;
      const r = el("div", "al-result", summary || "done");
      line.appendChild(r);
      scrollToBottom();
    }

    try {
      const res = await fetch("/api/topics/" + state.activeTopicId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ content }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let detail = res.status + " " + res.statusText;
        try { const j = await res.json(); if (j && j.detail) detail = j.detail; } catch (_) {}
        throw new Error(detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let doneMessageId = null;

      function handleEvent(evName, dataStr) {
        let data = null;
        if (dataStr) { try { data = JSON.parse(dataStr); } catch (_) { data = { text: dataStr }; } }
        const type = evName || (data && data.type) || "token";
        switch (type) {
          case "tool_call":
            addToolCall(data && data.name, data && data.args);
            break;
          case "tool_result":
            addToolResult(data && data.name, data && data.summary);
            break;
          case "token":
            answerText += (data && (data.text != null ? data.text : data.content)) || "";
            scheduleRender();
            break;
          case "done":
            if (data && data.message_id != null) doneMessageId = data.message_id;
            break;
          case "error":
            toast("Agent error: " + ((data && data.detail) || "unknown"), "error", 8000);
            break;
          default:
            // Unknown event type: if it carries text, treat as token.
            if (data && data.text) { answerText += data.text; scheduleRender(); }
        }
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line.
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          parseFrame(frame, handleEvent);
        }
      }
      if (buf.trim()) parseFrame(buf, handleEvent);

      // Finalize render.
      answer.classList.remove("streaming-caret");
      renderMarkdownInto(answer, answerText);
      // Persist locally in state.
      state.activeTopic.messages.push({ role: "assistant", content: answerText, id: doneMessageId });
      scrollToBottom();
    } catch (e) {
      if (e.name === "AbortError") {
        answer.classList.remove("streaming-caret");
        if (answerText) {
          renderMarkdownInto(answer, answerText);
          state.activeTopic.messages.push({ role: "assistant", content: answerText });
        } else {
          bubble.appendChild(el("div", "al-result", "⏹ Stopped."));
        }
      } else {
        answer.classList.remove("streaming-caret");
        toast(friendlyErr(e, "Send"));
        if (!answerText) bubble.appendChild(el("div", "al-result", "⚠ " + friendlyErr(e, "Send")));
        else { renderMarkdownInto(answer, answerText); state.activeTopic.messages.push({ role: "assistant", content: answerText }); }
      }
    } finally {
      setStreaming(false);
      state.abortController = null;
    }
  }

  function parseFrame(frame, handleEvent) {
    let evName = null;
    const dataLines = [];
    for (const raw of frame.split("\n")) {
      const line = raw.replace(/\r$/, "");
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) evName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    if (evName || dataLines.length) handleEvent(evName, dataLines.join("\n"));
  }

  function setStreaming(on) {
    state.streaming = on;
    $("#send-btn").hidden = on;
    $("#stop-btn").hidden = !on;
    $("#composer-input").disabled = on;
    if (!on) $("#composer-input").focus();
  }

  function stopStreaming() {
    if (state.abortController) state.abortController.abort();
  }

  // ---------- Composer autosize + keys ----------
  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  // ================= Wiring =================
  function wire() {
    $("#new-topic-btn").addEventListener("click", () => openModal("new", null));
    $("#import-btn").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", (e) => {
      const f = e.target.files[0];
      importTopic(f);
      e.target.value = "";
    });

    $("#add-path-btn").addEventListener("click", addDocumentByPath);
    $("#doc-path").addEventListener("keydown", (e) => { if (e.key === "Enter") addDocumentByPath(); });
    $("#upload-btn").addEventListener("click", () => $("#upload-file").click());
    $("#upload-file").addEventListener("change", (e) => {
      const f = e.target.files[0];
      uploadDocument(f);
      e.target.value = "";
    });

    $("#rename-topic-btn").addEventListener("click", () => {
      if (state.activeTopic) openModal("rename", state.activeTopic);
    });
    $("#delete-topic-btn").addEventListener("click", () => {
      if (state.activeTopic) deleteTopic(state.activeTopic);
    });
    $("#export-topic-btn").addEventListener("click", exportTopic);

    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-save").addEventListener("click", saveModal);
    $("#modal-backdrop").addEventListener("click", (e) => { if (e.target.id === "modal-backdrop") closeModal(); });
    $("#modal-topic-name").addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveModal();
      if (e.key === "Escape") closeModal();
    });

    const input = $("#composer-input");
    input.addEventListener("input", () => autoGrow(input));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    $("#send-btn").addEventListener("click", sendMessage);
    $("#stop-btn").addEventListener("click", stopStreaming);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("#modal-backdrop").hidden) closeModal();
    });
  }

  // ================= Init =================
  function init() {
    wire();
    renderActiveTopic(); // initial empty state
    // Independent loads; each fails gracefully.
    loadConfig();
    loadDocuments();
    loadTopics().then(renderActiveTopic);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
