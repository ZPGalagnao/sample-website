/* ZorDevAI Assistant: interactive demo widget.
 * Same look as the real assistant, but everything runs in the visitor's browser:
 * replies are scripted (the real assistant uses AI and the shop's own facts), and requests are saved
 * in this browser only, where the demo owner dashboard (dashboard.html) reads them.
 */
(function () {
  "use strict";
  if (window.__zordevaiDemo) return;
  window.__zordevaiDemo = true;

  var cfg = {
    name: "Thermostead Heating & Air",
    assistantName: "Thermostead Assistant",
    accent: "#B9521F",
    accentInk: "#FFFFFF",
    greeting: "Hi! 👋 I'm Thermostead's virtual assistant. I can answer questions about repairs, tune-ups and new systems, or set up a visit for you. What's going on at home?",
    quickReplies: ["My AC isn't cooling", "How much does a visit cost?", "Book a tune-up", "Repair or replace?"],
    services: ["AC repair or new install", "Furnace or heating repair", "Heat pump", "Tune-up", "Ducts and airflow", "Not sure yet"],
    dashboard: "dashboard.html",
  };
  var REQUESTS = "zd_demo_requests";
  var CHATS = "zd_demo_chats";
  var STATE = "zd_demo_chat";

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: the demo still runs */ }
  }

  // ---- Scripted replies (the real assistant answers with AI from the shop's facts) ----
  var MOBILE = /(\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/;
  var TOPICS = [
    { words: /price|cost|how much|fee|rate|magkano|pila|presyo|bayad/i, reply: "There's one flat diagnostic fee, quoted when you book. If you go ahead with the repair, that fee comes off your bill, and there are no overtime charges. Want me to set a visit? Send your name, mobile number and area." },
    { words: /not cool|not cold|warm air|broken|leak|noise|error|repair|\b(sira|guba|ayaw|mainit|init)\b|dili mobugnaw/i, reply: "Sorry to hear that! A licensed tech checks the whole system, explains what's wrong and gives you one price before any work starts. Want me to set a visit? Send your name, mobile number and area." },
    { words: /tune|clean|maintenance|check-?up|linis|limpyo/i, reply: "A tune-up keeps your system running well: a spring check for the AC and a fall check for heating. Want to book one? Send your name, mobile number and area." },
    { words: /replace|new unit|new system|buy|palit|bago|bili/i, reply: "Simple rule: if the repair costs more than half the price of a new system, or the system is over 15 years old, replacing may be worth it. A tech shows you the numbers, no pressure." },
    { words: /when|today|tomorrow|schedule|available|open|hours|kailan|kanus-a|oras/i, reply: "Most calls get a visit the same day or the next morning, in a two-hour window. You get a text when the tech is on the way. Want me to set one? Send your name, mobile number and area." },
    { words: /warrant|guarantee/i, reply: "Repairs come with a written parts and labor warranty. New installs come with the manufacturer's warranty plus Thermostead's own." },
    { words: /brand|carrier|daikin|\blg\b|samsung|midea|koppel/i, reply: "The team services all major brands of air conditioners, furnaces and heat pumps." },
    { words: /where|area|location|cover|asa|saan/i, reply: "Send your barangay or area and the team will confirm they cover it and when they can come." },
    { words: /book|visit|appointment|schedule|pa-?check|reserve/i, reply: "Sure! Please send your name, mobile number and area (for example: Juan Dela Cruz, 0917 123 4567, Bajada) and the team will call you to confirm a time." },
    { words: /\b(hi|hello|hey)\b|good (morning|afternoon|evening)|maayong|kumusta/i, reply: "Hello! How can I help? You can ask about costs, repairs, tune-ups, or set a visit." },
    { words: /\b(human|person|real|tao|staff|owner)\b/i, reply: "I'm Thermostead's virtual assistant. The team is real: leave your number and they'll call you back." },
  ];
  var FALLBACK = "In this demo I know a few topics: costs, repairs, tune-ups, repair or replace, and booking a visit. The real assistant answers anything about your shop using your own facts. You can also tap \"Leave my number\".";

  function parseDetails(text) {
    var m = text.match(MOBILE);
    if (!m) return null;
    var before = text.slice(0, m.index).replace(/my name is|i'?m|ako si|ako ay|name:?/gi, "").replace(/[,;\s]+$/, "").trim();
    var after = text.slice(m.index + m[0].length).replace(/^[,;\s-]+/, "").trim();
    var name = before.split(/[,;\n]/)[0].trim() || "Customer";
    return { name: name.slice(0, 60), mobile: m[0].replace(/\s+/g, " ").trim(), area: after.slice(0, 80) };
  }

  function saveRequest(req) {
    var list = read(REQUESTS, []);
    var item = {
      id: "r" + Date.now().toString(36),
      name: req.name,
      mobile: req.mobile,
      area: req.area || "",
      service: req.service || "",
      details: req.details || "",
      source: req.source,
      status: "new",
      createdAt: Date.now(),
    };
    list.unshift(item);
    write(REQUESTS, list.slice(0, 30));
    return item;
  }

  function scriptedReply(text, state) {
    var details = parseDetails(text);
    if (details) {
      var item = saveRequest({
        name: details.name,
        mobile: details.mobile,
        area: details.area,
        service: state.topic || "Not sure yet",
        details: state.lastQuestion || "",
        source: "chat",
      });
      state.topic = null;
      return "Thanks, " + item.name.split(" ")[0] + "! Your request is saved and the team will call you soon to confirm a time.\n\n(Demo: in the real system, the owner's phone gets an alert right now. See it here: Open the owner dashboard)";
    }
    for (var i = 0; i < TOPICS.length; i++) {
      if (TOPICS[i].words.test(text)) {
        if (/tune|clean|linis|limpyo/i.test(text)) state.topic = "Tune-up";
        else if (/not cool|not cold|warm|broken|leak|noise|error|repair|\b(sira|guba|ayaw|mainit|init)\b/i.test(text)) state.topic = "AC repair or new install";
        state.lastQuestion = text.slice(0, 160);
        return TOPICS[i].reply;
      }
    }
    return FALLBACK;
  }

  // ---- UI (same look as the real widget) ----
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") node.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function richText(text) {
    var safe = String(text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
    safe = safe.replace("Open the owner dashboard", '<a href="' + cfg.dashboard + '" target="_blank" rel="noopener">Open the owner dashboard</a>');
    return safe.replace(/\n/g, "<br>");
  }

  var ICON_CHAT = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L4.6 22l4.1-2.2c1 .3 2.1.4 3.3.4 5.5 0 10-3.9 10-8.6S17.5 3 12 3Zm-4.5 9.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}",
    ".zd{--accent:" + cfg.accent + ";--accent-ink:" + cfg.accentInk + ";--bg:#fff;--surface:#f2f5f9;--ink:#14213d;--muted:#5b6b85;--line:#e3e8f2;position:fixed;right:20px;bottom:20px;z-index:2147483000;color:var(--ink)}",
    ".launch{width:60px;height:60px;border-radius:50%;border:none;background:var(--accent);color:var(--accent-ink);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:transform .2s}",
    ".launch:hover{transform:scale(1.06)}button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}",
    ".nudge{position:absolute;right:72px;bottom:10px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:10px 14px;font-size:14px;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}",
    ".panel{position:absolute;right:0;bottom:76px;width:380px;height:min(620px,calc(100vh - 110px));background:var(--bg);border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}",
    ".panel[hidden]{display:none}",
    ".head{display:flex;align-items:center;gap:10px;padding:14px 14px 12px;border-bottom:1px solid var(--line)}",
    ".avatar{width:38px;height:38px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}",
    ".title{flex:1;min-width:0}.title b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.title span{font-size:12px;color:var(--muted)}",
    ".x{background:none;border:none;color:var(--muted);cursor:pointer;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center}",
    ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:14.5px;line-height:1.45}",
    ".msg{max-width:85%;padding:10px 13px;border-radius:16px;word-wrap:break-word}",
    ".bot{background:var(--surface);align-self:flex-start;border-bottom-left-radius:6px}",
    ".me{background:var(--accent);color:var(--accent-ink);align-self:flex-end;border-bottom-right-radius:6px}",
    ".msg a{color:inherit;font-weight:700}",
    ".chips{display:flex;flex-wrap:wrap;gap:8px}",
    ".chip{background:transparent;color:var(--ink);border:1px solid var(--accent);border-radius:999px;padding:8px 12px;font-size:13px;cursor:pointer;min-height:36px}",
    ".typing{display:inline-flex;gap:4px}.typing i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:zd 1s infinite}",
    ".typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes zd{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}",
    ".compose{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line);align-items:flex-end}",
    "textarea{flex:1;resize:none;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:14px;padding:10px 12px;font-size:15px;max-height:110px;min-height:44px;line-height:1.35}",
    ".send{width:44px;height:44px;border-radius:50%;border:none;background:var(--accent);color:var(--accent-ink);cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none}",
    ".send:disabled{opacity:.5;cursor:default}",
    ".foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:0 14px 10px;font-size:12px;color:var(--muted);flex-wrap:wrap}",
    ".foot button,.foot a{background:none;border:none;color:var(--ink);font-size:12.5px;cursor:pointer;padding:6px 0;text-decoration:underline}",
    ".note{font-size:11.5px;color:var(--muted);text-align:center;padding:0 14px 8px}",
    "form.lead{display:flex;flex-direction:column;gap:8px;padding:14px;overflow-y:auto;flex:1}",
    "form.lead label{font-size:13px;color:var(--muted)}",
    "form.lead input,form.lead select,form.lead textarea{width:100%;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:10px;font-size:15px;min-height:44px}",
    ".primary{background:var(--accent);color:var(--accent-ink);border:none;border-radius:12px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;min-height:44px;text-align:center;text-decoration:none;display:block}",
    ".err{color:#b42318;font-size:13px}",
    "@media (max-width:520px){.zd{right:14px;bottom:14px}.panel{position:fixed;inset:0;width:auto;height:auto;border-radius:0}.nudge{display:none}.zd.open .launch{display:none}}",
    "@media (prefers-reduced-motion:reduce){.launch,.typing i{transition:none;animation:none}}",
  ].join("");

  function start() {
    var host = el("div", { id: "zordevai-assistant" });
    var root = host.attachShadow({ mode: "open" });
    root.appendChild(el("style", { text: CSS }));
    var wrap = el("div", { class: "zd" });
    root.appendChild(wrap);
    document.body.appendChild(host);

    var state = read(STATE, null) || { log: [], counted: false, topic: null, lastQuestion: "" };
    var busy = false;

    var launch = el("button", { class: "launch", type: "button", "aria-label": "Chat with " + cfg.name, "aria-expanded": "false" });
    launch.innerHTML = ICON_CHAT;
    var panel = el("div", { class: "panel", role: "dialog", "aria-label": cfg.assistantName, hidden: "" });
    var log = el("div", { class: "log", "aria-live": "polite" });
    var input = el("textarea", { rows: "1", placeholder: "Type your message…", "aria-label": "Your message", maxlength: "500" });
    var send = el("button", { class: "send", type: "button", "aria-label": "Send" });
    send.innerHTML = ICON_SEND;
    var closeBtn = el("button", { class: "x", type: "button", "aria-label": "Close chat" });
    closeBtn.innerHTML = ICON_CLOSE;

    var chatView = el("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0" }, [
      log,
      el("div", { class: "compose" }, [input, send]),
      el("div", { class: "foot" }, [
        el("button", { type: "button", text: "Leave my number", onclick: showForm }),
        el("a", { href: cfg.dashboard, target: "_blank", rel: "noopener", text: "Owner dashboard (demo)" }),
      ]),
      el("div", { class: "note", text: "Demo: replies are scripted; the real assistant uses AI and your shop's facts. Nothing you type leaves your browser." }),
    ]);
    var formView = el("div", { style: "display:none;flex-direction:column;flex:1;min-height:0" });

    panel.appendChild(el("div", { class: "head" }, [
      el("div", { class: "avatar", text: cfg.name.charAt(0) }),
      el("div", { class: "title" }, [el("b", { text: cfg.assistantName }), el("span", { text: "Demo assistant · scripted replies" })]),
      closeBtn,
    ]));
    panel.appendChild(chatView);
    panel.appendChild(formView);
    wrap.appendChild(panel);
    wrap.appendChild(launch);

    function bubble(role, text) {
      var b = el("div", { class: "msg " + (role === "me" ? "me" : "bot") });
      b.innerHTML = richText(text);
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
    }
    function remember(role, text) {
      state.log.push({ role: role, text: text });
      if (state.log.length > 60) state.log = state.log.slice(-60);
      write(STATE, state);
    }
    function chips() {
      var row = el("div", { class: "chips" });
      cfg.quickReplies.forEach(function (q) {
        row.appendChild(el("button", { class: "chip", type: "button", text: q, onclick: function () { row.remove(); ask(q); } }));
      });
      log.appendChild(row);
    }

    bubble("bot", cfg.greeting);
    state.log.forEach(function (m) { bubble(m.role, m.text); });
    if (!state.log.length) chips();

    var nudge = null;
    function setOpen(open) {
      if (open) { panel.removeAttribute("hidden"); input.focus(); log.scrollTop = log.scrollHeight; }
      else { panel.setAttribute("hidden", ""); }
      launch.setAttribute("aria-expanded", String(open));
      wrap.classList.toggle("open", open);
      if (nudge) { nudge.remove(); nudge = null; }
      if (!open) launch.focus();
    }
    launch.addEventListener("click", function () { setOpen(panel.hasAttribute("hidden")); });
    closeBtn.addEventListener("click", function () { setOpen(false); });
    root.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hasAttribute("hidden")) setOpen(false); });

    function ask(text) {
      text = String(text || "").trim();
      if (!text || busy) return;
      busy = true; send.disabled = true;
      if (!state.counted) { state.counted = true; write(CHATS, read(CHATS, 0) + 1); }
      bubble("me", text); remember("me", text);
      var typing = el("div", { class: "msg bot", "aria-label": "Typing" });
      typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      log.appendChild(typing); log.scrollTop = log.scrollHeight;
      setTimeout(function () {
        typing.remove();
        var reply = scriptedReply(text, state);
        bubble("bot", reply); remember("bot", reply);
        busy = false; send.disabled = false; input.focus();
      }, 800);
    }

    function grow() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; }
    input.addEventListener("input", grow);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); var t = input.value; input.value = ""; grow(); ask(t); }
    });
    send.addEventListener("click", function () { var t = input.value; input.value = ""; grow(); ask(t); });

    function showForm() {
      formView.innerHTML = "";
      var err = el("div", { class: "err", role: "alert" });
      var service = el("select", { name: "service", id: "zd-service" });
      cfg.services.forEach(function (s) { service.appendChild(el("option", { text: s })); });
      var form = el("form", { class: "lead", novalidate: "" }, [
        el("b", { text: "Leave your number and the team will call you." }),
        el("label", { for: "zd-name", text: "Name" }), el("input", { id: "zd-name", name: "name", autocomplete: "name" }),
        el("label", { for: "zd-mobile", text: "Mobile number" }), el("input", { id: "zd-mobile", name: "mobile", type: "tel", inputmode: "tel", placeholder: "09XX XXX XXXX" }),
        el("label", { for: "zd-area", text: "Barangay or area" }), el("input", { id: "zd-area", name: "area" }),
        el("label", { for: "zd-service", text: "What do you need?" }), service,
        el("label", { for: "zd-details", text: "Details (optional)" }), el("textarea", { id: "zd-details", name: "details", rows: "3" }),
        err,
        el("button", { class: "primary", type: "submit", text: "Send my request" }),
        el("button", { class: "chip", type: "button", text: "Back to chat", onclick: showChat }),
      ]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = form.elements.name.value.trim();
        var mobile = form.elements.mobile.value.trim();
        if (!name) { err.textContent = "Please enter your name."; form.elements.name.focus(); return; }
        if (!MOBILE.test(mobile)) { err.textContent = "Please enter a mobile number like 0917 123 4567."; form.elements.mobile.focus(); return; }
        saveRequest({
          name: name, mobile: mobile, area: form.elements.area.value.trim(),
          service: form.elements.service.value, details: form.elements.details.value.trim(), source: "form",
        });
        formView.innerHTML = "";
        formView.appendChild(el("div", { style: "padding:16px;display:flex;flex-direction:column;gap:10px" }, [
          el("b", { text: "Thank you! Your request is in." }),
          el("p", { text: "In the real system, the owner's phone gets an alert right now. Open the demo dashboard to see your request." }),
          el("a", { class: "primary", href: cfg.dashboard, target: "_blank", rel: "noopener", text: "Open the owner dashboard" }),
          el("button", { class: "chip", type: "button", text: "Back to chat", onclick: showChat }),
        ]));
      });
      formView.appendChild(form);
      chatView.style.display = "none"; formView.style.display = "flex";
      form.elements.name.focus();
    }
    function showChat() { formView.style.display = "none"; chatView.style.display = "flex"; input.focus(); }

    setTimeout(function () {
      if (!panel.hasAttribute("hidden") || window.innerWidth <= 520) return;
      nudge = el("div", { class: "nudge", text: "Questions? Chat with us 👋", onclick: function () { setOpen(true); } });
      wrap.appendChild(nudge);
    }, 3500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
