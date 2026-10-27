/* ZorDevAI Assistant: interactive demo chat for the Thermostead sample.
 * Same look as the real assistant, but everything runs in the visitor's browser: replies are scripted
 * (the real assistant uses AI and the shop's own facts), and requests are saved in this browser only,
 * where the demo owner dashboard (dashboard.html) reads them. Uses window.zdStore from demo.js.
 */
(function () {
  "use strict";
  if (window.__zordevaiDemo) return;
  window.__zordevaiDemo = true;

  var cfg = {
    name: "Thermostead Aircon",
    assistantName: "Thermostead Assistant",
    accent: "#B9521F",
    accentInk: "#FFFFFF",
    greeting: "Hi! 👋 Ako si Tess, ang virtual assistant ng Thermostead Aircon. I can answer questions about cleaning, repair, and installation, or book a visit for you. Ano pong maitutulong ko?",
    quickReplies: ["Hindi lumalamig ang aircon", "Magkano ang cleaning?", "Book a cleaning", "Saan kayo?"],
    services: ["Aircon cleaning", "Repair (not cooling, leaking, noise)", "New aircon or installation", "Freon check", "Not sure yet"],
    dashboard: "dashboard.html",
  };
  var CHATS = "zd_demo_chats", STATE = "zd_demo_chat";
  var store = window.zdStore || {
    read: function (k, f) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
    write: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    saveRequest: function (r) { return r; }, progress: function () {},
  };

  // ---- Scripted replies (the real assistant answers with AI from the shop's facts) ----
  var MOBILE = /(\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/;
  var ASK = " Gusto n'yo pong mag-book? I-send lang ang pangalan, mobile number, at barangay.";
  var TOPICS = [
    { words: /tawag|call me|tawgi|call back|callback/i, topic: null, reply: "Sige po! I-send lang ang pangalan, mobile number, at barangay (halimbawa: Juan Dela Cruz, 0917 123 4567, Lanang), at tatawagan kayo ng team namin para i-confirm ang oras." },
    { words: /price|cost|how much|fee|rate|magkano|pila|presyo|bayad/i, topic: "Aircon cleaning", reply: "Demo prices po: window-type cleaning ₱700, split-type cleaning ₱1,200 per unit. Ang check-up ay ₱500, at ibabawas ito kung itutuloy ang repair." + ASK },
    { words: /leak|tulo|tumutulo|nagtulo|water/i, topic: "Repair (not cooling, leaking, noise)", reply: "Kapag tumutulo ang tubig, kadalasan barado ang drain o madumi ang filter. Mabilis lang itong ayusin." + ASK },
    { words: /not cool|not cold|warm air|broken|noise|ingay|error|repair|\b(sira|guba|ayaw|mainit|init)\b|lumalamig|dili mobugnaw/i, topic: "Repair (not cooling, leaking, noise)", reply: "Naku, sorry to hear that! Madalas, dumi o kulang na freon ang dahilan. Titingnan ng technician ang buong unit at bibigyan kayo ng isang presyo bago magsimula." + ASK },
    { words: /clean|linis|limpyo|maintenance|check-?up/i, topic: "Aircon cleaning", reply: "Every 6 months po ang cleaning para sa bahay, every 3 months kung buong araw gamit o para sa store. Window-type ₱700, split-type ₱1,200 (demo prices)." + ASK },
    { words: /install|new unit|new aircon|bili|buy|bago|palit|replace/i, topic: "New aircon or installation", reply: "Pwede po! Sinusukat muna namin ang kwarto para tama ang laki ng aircon na bibilhin ninyo. Gusto n'yo po ng site check? I-send lang ang pangalan, mobile number, at barangay." },
    { words: /freon|gas|refrigerant/i, topic: "Freon check", reply: "Hinahanap muna namin ang leak bago mag-recharge, para hindi kayo paulit-ulit na nagpapa-freon. Ang presyo ay depende sa unit, sasabihin muna bago gawin." + ASK },
    { words: /when|today|tomorrow|schedule|available|open|hours|kailan|kanus-a|oras|bukas/i, topic: null, reply: "Kadalasan same day o kinabukasan po, may two-hour arrival window. Magte-text ang technician kapag papunta na. Bukas po kami Mon to Sat, 8 AM to 6 PM." + ASK },
    { words: /warrant|guarantee/i, topic: null, reply: "May written warranty po ang repairs, sa parts at labor. Ang bagong install ay may warranty ng manufacturer at may warranty din mula sa amin." },
    { words: /brand|carrier|daikin|\blg\b|samsung|midea|koppel|panasonic|aux/i, topic: null, reply: "Lahat po ng major brands: window-type, split-type, at floor-mounted." },
    { words: /where|area|location|cover|asa|saan|davao/i, topic: null, reply: "Davao City at mga kalapit na lugar po. I-send ang barangay ninyo para ma-confirm namin." },
    { words: /book|visit|appointment|reserve|pa-?check/i, topic: null, reply: "Sige po! I-send lang ang pangalan, mobile number, at barangay (halimbawa: Juan Dela Cruz, 0917 123 4567, Lanang) at tatawagan kayo para i-confirm ang oras." },
    { words: /\b(human|person|real|tao|staff|owner)\b/i, topic: null, reply: "Virtual assistant po ako ng Thermostead. Totoong tao ang team namin: iwan lang ang number ninyo at tatawag sila." },
    { words: /\b(hi|hello|hey)\b|good (morning|afternoon|evening)|maayong|kumusta|musta/i, topic: null, reply: "Hello po! Ano pong problema ng aircon ninyo, o gusto n'yo bang mag-book ng cleaning?" },
  ];
  var FALLBACK = "Sa demo na ito, alam ko ang ilang topics: presyo, cleaning, repair, installation, freon, at booking. Ang totoong assistant ay sumasagot gamit ang facts ng shop ninyo. Pwede rin pong i-tap ang \"Leave my number\".";

  function parseDetails(text) {
    var m = text.match(MOBILE);
    if (!m) return null;
    var before = text.slice(0, m.index).replace(/my name is|i'?m|ako si|ako ay|name:?/gi, "").replace(/[,;\s]+$/, "").trim();
    var after = text.slice(m.index + m[0].length).replace(/^[,;\s-]+/, "").trim();
    var name = before.split(/[,;\n]/)[0].trim() || "Customer";
    return { name: name.slice(0, 60), mobile: m[0].replace(/\s+/g, " ").trim(), area: after.slice(0, 80) };
  }

  function scriptedReply(text, state) {
    var details = parseDetails(text);
    if (details) {
      store.saveRequest({ name: details.name, mobile: details.mobile, area: details.area, service: state.topic || "Not sure yet", details: state.lastQuestion || "", source: "chat" });
      state.topic = null;
      return { text: "Salamat, " + details.name.split(" ")[0] + "! Naka-save na po ang request ninyo, at tatawagan kayo ng team para i-confirm ang oras.\n\n(Demo: sa totoong system, may alert agad sa phone ng owner. Open the owner dashboard)" };
    }
    for (var i = 0; i < TOPICS.length; i++) {
      if (TOPICS[i].words.test(text)) {
        if (TOPICS[i].topic) state.topic = TOPICS[i].topic;
        state.lastQuestion = text.slice(0, 160);
        return { text: TOPICS[i].reply };
      }
    }
    return { text: FALLBACK };
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
    "*{box-sizing:border-box;font-family:'Figtree',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}",
    ".zd{--accent:" + cfg.accent + ";--accent-ink:" + cfg.accentInk + ";--bg:#fff;--surface:#f3f1ec;--ink:#14202A;--muted:#5b6870;--line:#e5e0d6;position:fixed;right:20px;bottom:20px;z-index:2147483000;color:var(--ink)}",
    ".launch{width:60px;height:60px;border-radius:50%;border:none;background:var(--accent);color:var(--accent-ink);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.3);transition:transform .2s}",
    ".launch:hover{transform:scale(1.06)}button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}",
    ".nudge{position:absolute;right:72px;bottom:10px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:10px 14px;font-size:14px;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.2);cursor:pointer}",
    ".panel{position:absolute;right:0;bottom:76px;width:380px;height:min(620px,calc(100vh - 110px));background:var(--bg);border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}",
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
    ".chip.solid{background:var(--accent);color:var(--accent-ink)}",
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

    var state = store.read(STATE, null) || { log: [], counted: false, topic: null, lastQuestion: "" };
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
        el("a", { href: cfg.dashboard, target: "_blank", rel: "noopener", text: "Owner dashboard (demo)", onclick: function () { store.progress("dash"); } }),
      ]),
      el("div", { class: "note", text: "Demo: replies are scripted; the real assistant uses AI and your shop's facts. Nothing you type leaves your browser." }),
    ]);
    var formView = el("div", { style: "display:none;flex-direction:column;flex:1;min-height:0" });

    panel.appendChild(el("div", { class: "head" }, [
      el("div", { class: "avatar", text: "T" }),
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
      store.write(STATE, state);
    }
    function chipRow(list) {
      var row = el("div", { class: "chips" });
      list.forEach(function (c) {
        row.appendChild(el("button", { class: "chip" + (c.solid ? " solid" : ""), type: "button", text: c.label, onclick: function () { row.remove(); c.run(); } }));
      });
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }
    function quickChips() { chipRow(cfg.quickReplies.map(function (q) { return { label: q, run: function () { ask(q); } }; })); }

    bubble("bot", cfg.greeting);
    state.log.forEach(function (m) { bubble(m.role, m.text); });
    if (!state.log.length) quickChips();

    var nudge = null;
    function setOpen(open) {
      if (open) { panel.removeAttribute("hidden"); input.focus(); log.scrollTop = log.scrollHeight; }
      else { panel.setAttribute("hidden", ""); }
      launch.setAttribute("aria-expanded", String(open));
      wrap.classList.toggle("open", open);
      if (nudge) { nudge.remove(); nudge = null; }
      if (!open && root.activeElement) launch.focus();
    }
    launch.addEventListener("click", function () { setOpen(panel.hasAttribute("hidden")); });
    closeBtn.addEventListener("click", function () { setOpen(false); });
    root.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hasAttribute("hidden")) setOpen(false); });
    window.zdOpenChat = function () { setOpen(true); };

    function ask(text) {
      text = String(text || "").trim();
      if (!text || busy) return;
      busy = true; send.disabled = true;
      if (!state.counted) { state.counted = true; store.write(CHATS, store.read(CHATS, 0) + 1); }
      store.progress("chat");
      bubble("me", text); remember("me", text);
      var typing = el("div", { class: "msg bot", "aria-label": "Typing" });
      typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      log.appendChild(typing); log.scrollTop = log.scrollHeight;
      setTimeout(function () {
        typing.remove();
        var reply = /^okay na/i.test(text) ? { text: "Walang anuman po! Nandito lang ako kung may tanong pa kayo. 😊" } : scriptedReply(text, state);
        bubble("bot", reply.text); remember("bot", reply.text);
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
        store.progress("chat");
        store.saveRequest({
          name: name, mobile: mobile, area: form.elements.area.value.trim(),
          service: form.elements.service.value, details: form.elements.details.value.trim(), source: "form",
        });
        formView.innerHTML = "";
        formView.appendChild(el("div", { style: "padding:16px;display:flex;flex-direction:column;gap:10px" }, [
          el("b", { text: "Thank you! Your request is in." }),
          el("p", { text: "In the real system, the owner's phone gets an alert right now, and the team calls you to confirm a time." }),
          el("a", { class: "primary", href: cfg.dashboard, target: "_blank", rel: "noopener", text: "Open the owner dashboard", onclick: function () { store.progress("dash"); } }),
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
    }, 4500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
