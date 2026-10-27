/* ZorDevAI demo layer for the Thermostead sample.
 * 1. A shared store: requests live in this browser only (localStorage), where dashboard.html reads them.
 * 2. The demo guide: three steps a visitor can try.
 * 3. The AI caller: after a booking, a scripted call rings inside the page, in Tagalog, English or Bisaya.
 *    Nothing is dialed. A real AI caller (Retell, Vapi) calls the customer's phone with a natural voice.
 * Bisaya lines need a native speaker's check before this is used with a real client.
 */
(function () {
  "use strict";
  if (window.zdStore) return;

  var REQUESTS = "zd_demo_requests", PROGRESS = "zd_demo_progress", GUIDE = "zd_demo_guide";
  function read(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: the demo still runs */ } }

  function saveRequest(req) {
    var list = read(REQUESTS, []);
    var item = {
      id: "r" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: req.name, mobile: req.mobile, area: req.area || "", service: req.service || "",
      details: req.details || "", lang: req.lang || "", source: req.source, status: "new", createdAt: Date.now(),
    };
    list.unshift(item);
    write(REQUESTS, list.slice(0, 30));
    return item;
  }
  function updateRequest(id, change) {
    var list = read(REQUESTS, []);
    list.forEach(function (r) { if (r.id === id) change(r); });
    write(REQUESTS, list);
  }
  function progress(step) {
    var p = read(PROGRESS, {});
    if (!p[step]) { p[step] = true; write(PROGRESS, p); }
    renderGuide();
  }
  window.zdStore = { read: read, write: write, saveRequest: saveRequest, updateRequest: updateRequest, progress: progress };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return node;
  }

  /* ---------------- Demo guide ---------------- */
  var guide, card, pill, count, steps = {};
  function buildGuide() {
    pill = el("button", { class: "zdg-pill", type: "button", "aria-expanded": "false", "aria-controls": "zdg-card" }, [
      el("span", { class: "zdg-dot", "aria-hidden": "true" }), "Demo guide ", count = el("span", { class: "zdg-count", text: "0/3" }),
    ]);
    function step(key, n, title, hint, tag, attrs) {
      var node = el(tag, Object.assign({ class: "zdg-step" }, attrs || {}), [
        el("span", { class: "zdg-n", text: String(n), "aria-hidden": "true" }),
        el("span", null, [el("b", { text: title }), el("small", { text: hint })]),
        el("i", { class: "zdg-ok", "aria-hidden": "true", text: "✓" }),
      ]);
      steps[key] = node;
      return el("li", null, [node]);
    }
    card = el("div", { class: "zdg-card", id: "zdg-card", hidden: "" }, [
      el("div", { class: "zdg-head" }, [el("b", { text: "ZorDevAI demo" }), el("button", { class: "zdg-x", type: "button", "aria-label": "Close the demo guide", text: "×", onclick: function () { setOpen(false, true); } })]),
      el("p", { text: "Thermostead is a sample aircon shop. Try what its customers and its owner would see:" }),
      el("ol", null, [
        step("chat", 1, "Chat with the AI assistant", "Try “Magkano ang cleaning?”", "button", { type: "button", onclick: function () { if (window.zdOpenChat) window.zdOpenChat(); setOpen(false, true); } }),
        step("call", 2, "Book a visit, then the AI calls you", "The call rings right here, no real phone call", "button", { type: "button", onclick: goBook }),
        step("dash", 3, "Open the owner dashboard", "See every chat, booking and call", "a", { href: "dashboard.html", target: "_blank", rel: "noopener", onclick: function () { progress("dash"); } }),
      ]),
      el("a", { class: "zdg-more", href: "#zordevai", text: "What is this, and how much?", onclick: function () { setOpen(false, true); } }),
    ]);
    guide = el("div", { class: "zdg", role: "region", "aria-label": "Demo guide" }, [pill, card]);
    document.body.appendChild(guide);
    pill.addEventListener("click", function () { setOpen(card.hidden, true); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !card.hidden) { setOpen(false, true); pill.focus(); } });
    renderGuide();

    // First visit on a wide screen: open the guide once, and fold it away when the visitor starts scrolling.
    var state = read(GUIDE, {});
    if (!state.seen && innerWidth >= 900) {
      setTimeout(function () { setOpen(true, false); }, 1400);
      var fold = function () { if (scrollY > 260 && !touched) { setOpen(false, false); removeEventListener("scroll", fold); } };
      addEventListener("scroll", fold, { passive: true });
    }
    state.seen = true; write(GUIDE, state);
  }
  var touched = false;
  function setOpen(open, byUser) {
    if (byUser) touched = true;
    card.hidden = !open;
    pill.setAttribute("aria-expanded", String(open));
  }
  function renderGuide() {
    if (!guide) return;
    var p = read(PROGRESS, {}), n = 0;
    Object.keys(steps).forEach(function (k) { steps[k].classList.toggle("done", !!p[k]); if (p[k]) n++; });
    count.textContent = n + "/3";
  }
  function goBook() {
    setOpen(false, true);
    var book = document.getElementById("book");
    if (book) book.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setTimeout(function () { var f = document.getElementById("f-name"); if (f) f.focus({ preventScroll: true }); }, 900);
  }
  addEventListener("storage", function (e) { if (e.key === PROGRESS) renderGuide(); });

  /* ---------------- AI caller ---------------- */
  var ISSUE = {
    en: { "Not cooling": "your aircon that isn't cooling", "Leaking water": "your aircon that's leaking water", "Strange noise or smell": "a strange noise or smell from your aircon", "Cleaning": "an aircon cleaning", "New aircon or installation": "a new aircon or installation", "Something else": "your aircon" },
    tl: { "Not cooling": "aircon na hindi lumalamig", "Leaking water": "aircon na tumutulo ang tubig", "Strange noise or smell": "kakaibang ingay o amoy ng aircon", "Cleaning": "aircon cleaning", "New aircon or installation": "bagong aircon o installation", "Something else": "aircon ninyo" },
    ceb: { "Not cooling": "aircon nga dili mobugnaw", "Leaking water": "aircon nga nagtulo og tubig", "Strange noise or smell": "katingad-an nga saba o baho sa aircon", "Cleaning": "aircon cleaning", "New aircon or installation": "bag-ong aircon o installation", "Something else": "inyong aircon" },
  };
  // Every line the AI says, per language. {issue} {area} {name} {units} {when} are filled in from the booking.
  var S = {
    en: {
      you: "You", ai: "Tess (AI)",
      open: "Hi, this is Tess, the virtual assistant of Thermostead Aircon. I'm calling because you booked a visit on our website about {issue}. This call is recorded for your booking. Is now a good time to talk?",
      yes: "Yes, go ahead", busy: "I'm busy right now", no: "No thanks",
      busyAsk: "No problem. What time should I call you back?", cb: ["Later at 5 PM", "Tomorrow morning"], cbWhen: ["later at 5 PM", "tomorrow morning"],
      cbDone: "Got it, we'll call you back {when}. Thank you!",
      noDone: "Sorry to bother you. We won't call you again. Thank you!",
      units: "Thank you! How many aircon units need checking, and what type? Window-type or split-type?",
      u: ["One split-type", "Two window-type", "I'm not sure"], uVal: ["1 split-type", "2 window-type", "not sure yet"],
      unsure: "That's okay, the technician will check when they arrive.",
      sched: "You're in {area}, right? When are you free? We have a slot tomorrow from 9 to 11 AM, or Saturday from 1 to 3 PM.",
      s: ["Tomorrow, 9 to 11 AM", "Saturday, 1 to 3 PM"], price: "How much will it cost?",
      priceAns: "The check-up is ₱500, and it comes off your bill if you go ahead with the repair. Cleaning a split-type is ₱1,200 per unit. These are demo prices. When are you free?",
      confirm: "All set! Your booking: {issue}, {units}, in {area}, {when}. Our team will text you to confirm. Anything else?",
      fine: "No, thank you", human: "I'd like to talk to a person",
      humanDone: "Sure. Someone from our team will call you within 15 minutes. Thank you!",
      bye: "Thank you, {name}! Take care.",
    },
    tl: {
      you: "Ikaw", ai: "Tess (AI)",
      open: "Hello po, si Tess po ito, ang virtual assistant ng Thermostead Aircon. Tumatawag po ako dahil nag-book kayo sa website namin tungkol sa {issue}. Naka-record po ang tawag para sa booking. Okay lang po ba kayong makausap saglit?",
      yes: "Oo, sige", busy: "Busy ako ngayon", no: "Hindi na, salamat",
      busyAsk: "Sige po. Anong oras ko po kayo pwedeng tawagan ulit?", cb: ["Mamayang 5 PM", "Bukas ng umaga"], cbWhen: ["mamayang 5 PM", "bukas ng umaga"],
      cbDone: "Noted po, tatawag po kami ulit {when}. Salamat po!",
      noDone: "Pasensya na po sa abala. Hindi na po namin kayo tatawagan ulit. Salamat po!",
      units: "Salamat po! Para sa {issue}, ilang aircon po, at anong klase? Window-type o split-type?",
      u: ["Isang split-type", "Dalawang window-type", "Hindi ko sure"], uVal: ["1 split-type", "2 window-type", "hindi pa sigurado"],
      unsure: "Okay lang po, titingnan po ng technician pagdating.",
      sched: "Sa {area} po kayo, tama po? Kailan po kayo free? May slot po kami bukas ng 9 hanggang 11 ng umaga, o Sabado ng 1 hanggang 3 ng hapon.",
      s: ["Bukas, 9 to 11 AM", "Sabado, 1 to 3 PM"], price: "Magkano po?",
      priceAns: "Ang check-up po ay ₱500, at ibabawas ito kung itutuloy ang repair. Ang cleaning ng split-type ay ₱1,200 kada unit. Demo prices lang po ito. Kailan po kayo free?",
      confirm: "Okay po! Booking ninyo: {issue}, {units}, sa {area}, {when}. Magte-text po ang team para i-confirm. May iba pa po ba?",
      fine: "Wala na, salamat", human: "Gusto kong makausap ang tao",
      humanDone: "Sige po. Tatawagan po kayo ng isa sa team namin within 15 minutes. Salamat po!",
      bye: "Salamat po, {name}! Ingat po.",
    },
    ceb: {
      you: "Ikaw", ai: "Tess (AI)",
      open: "Hello po, si Tess ni, ang virtual assistant sa Thermostead Aircon. Nitawag ko kay nag-book mo sa among website bahin sa {issue}. Gi-record ning tawag para sa booking. Okay ra ba mo makig-istorya kadiyot?",
      yes: "Oo, sige", busy: "Busy ko karon", no: "Dili na lang, salamat",
      busyAsk: "Sige po. Unsang orasa ko mo tawgan balik?", cb: ["Unya alas 5", "Ugma sa buntag"], cbWhen: ["unya alas 5", "ugma sa buntag"],
      cbDone: "Sige po, motawag mi balik {when}. Salamat po!",
      noDone: "Pasensya sa samok po. Dili na mi motawag pag-usab. Salamat po!",
      units: "Salamat po! Para sa {issue}, pila ka aircon, ug unsa nga klase? Window-type o split-type?",
      u: ["Usa ka split-type", "Duha ka window-type", "Wala ko kahibalo"], uVal: ["1 split-type", "2 window-type", "wala pa kahibalo"],
      unsure: "Okay ra po, tan-awon na sa technician pag-abot.",
      sched: "Sa {area} mo, sakto po? Kanus-a mo available? Naa mi slot ugma alas 9 hangtod 11 sa buntag, o Sabado alas 1 hangtod 3 sa hapon.",
      s: ["Ugma, 9 to 11 AM", "Sabado, 1 to 3 PM"], price: "Pila ang bayad?",
      priceAns: "Ang check-up kay ₱500, ug ibawas ni kung ipadayon ang repair. Ang cleaning sa split-type kay ₱1,200 matag unit. Demo prices ra ni. Kanus-a mo available?",
      confirm: "Sige po! Ang inyong booking: {issue}, {units}, sa {area}, {when}. Mo-text ang among team para i-confirm. Naa pa moy lain?",
      fine: "Wala na, salamat", human: "Gusto ko makig-istorya sa tawo",
      humanDone: "Sige po. Tawgan mo sa usa sa among team sulod sa 15 minutos. Salamat po!",
      bye: "Salamat kaayo, {name}! Amping po.",
    },
  };
  var RESULT = {
    booked: ["Booked", ""], callback: ["Call back later", "warn"], dnc: ["Do not call", "stop"],
    noanswer: ["No answer", "warn"], handoff: ["Booked, wants a person", ""], ended: ["Ended early", "warn"],
  };

  var ICON_PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
  var ICON_SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';

  var voices = [];
  function loadVoices() { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { voices = []; } }
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", loadVoices); }
  function pickVoice(lang) {
    var want = lang === "en" ? [/^en-PH/i, /^en-(US|GB|AU)/i, /^en/i] : [/^fil/i, /^tl/i];
    for (var i = 0; i < want.length; i++) for (var j = 0; j < voices.length; j++) if (want[i].test(voices[j].lang)) return voices[j];
    return null;
  }

  var audio = null;
  function primeAudio() {   // created inside the visitor's click, so the ring is allowed to play
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) { audio = null; }
  }
  function ringOnce() {
    if (!audio) return;
    var t = audio.currentTime;
    [[0, .4], [.6, 1]].forEach(function (seg) {
      [440, 480].forEach(function (hz) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = hz; o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(0, t + seg[0]); g.gain.linearRampToValueAtTime(.035, t + seg[0] + .03);
        g.gain.setValueAtTime(.035, t + seg[1] - .04); g.gain.linearRampToValueAtTime(0, t + seg[1]);
        o.start(t + seg[0]); o.stop(t + seg[1] + .02);
      });
    });
  }

  var call = null;
  function fill(text, c) {
    return text.replace(/\{(\w+)\}/g, function (_, k) { return c.vars[k] || ""; });
  }

  function startCall(b, leadId) {
    if (call) return;
    var lang = S[b.lang] ? b.lang : "tl", T = S[lang];
    var vars = { name: (b.name || "").split(/\s+/)[0] || "", area: b.area || "Davao", issue: (ISSUE[lang][b.issue] || ISSUE[lang]["Something else"]), units: "", when: "" };
    var voice = pickVoice(lang), canSpeak = !!(window.speechSynthesis && voice);
    call = { b: b, lang: lang, T: T, vars: vars, leadId: leadId, voice: voice, speak: canSpeak, transcript: [], result: "", started: 0, timer: null, ring: null, ringTimeout: null, prevFocus: document.activeElement };

    var state = el("p", { class: "zdc-state", text: lang === "en" ? "Incoming call…" : "Tumatawag…" });
    var log = el("div", { class: "zdc-log", "aria-live": "polite" });
    var replies = el("div", { class: "zdc-replies" });
    var wave = el("div", { class: "zdc-wave", "aria-hidden": "true" }, [el("i"), el("i"), el("i"), el("i"), el("i"), el("i"), el("i")]);
    var talk = el("div", { class: "zdc-talk", hidden: "" }, [wave, log, replies]);
    var sum = el("div", { class: "zdc-sum", hidden: "" });

    var decline = el("button", { class: "zdc-btn decline", type: "button", html: "<span>" + ICON_PHONE + "</span>Decline" });
    var answer = el("button", { class: "zdc-btn answer", type: "button", html: "<span>" + ICON_PHONE + "</span>Answer" });
    var speaker = el("button", { class: "zdc-btn small", type: "button", "aria-pressed": String(canSpeak), html: "<span>" + ICON_SPEAK + "</span>Voice" });
    var end = el("button", { class: "zdc-btn end", type: "button", html: "<span>" + ICON_PHONE + "</span>End call" });
    speaker.hidden = end.hidden = true;
    if (!window.speechSynthesis || !voice) speaker.disabled = true;
    var bar = el("div", { class: "zdc-bar" }, [decline, answer, speaker, end]);

    var phone = el("div", { class: "zdc-phone" }, [
      el("p", { class: "zdc-tag", text: "Demo call · nothing is dialed" }),
      el("div", { class: "zdc-who" }, [
        el("div", { class: "zdc-av", "aria-hidden": "true", text: "T" }),
        el("div", null, [el("p", { class: "zdc-name", id: "zdc-name", text: "Thermostead Assistant" }), el("p", { class: "zdc-sub", text: "AI virtual assistant · 0900 000 0172" }), state]),
      ]),
      talk, sum, bar,
    ]);
    var root = el("div", { class: "zdc ringing", role: "dialog", "aria-modal": "true", "aria-labelledby": "zdc-name" }, [phone]);
    document.body.appendChild(root);
    Object.assign(call, { root: root, state: state, log: log, replies: replies, talk: talk, sum: sum, bar: bar, answer: answer, decline: decline, speaker: speaker, end: end });
    answer.focus();

    ringOnce(); call.ring = setInterval(ringOnce, 3000);
    call.ringTimeout = setTimeout(function () { if (call && !call.started) finish("noanswer"); }, 40000);

    answer.addEventListener("click", pickUp);
    decline.addEventListener("click", function () { finish("noanswer"); });
    end.addEventListener("click", function () { finish(call.result || "ended"); });
    speaker.addEventListener("click", function () {
      call.speak = !call.speak; speaker.setAttribute("aria-pressed", String(call.speak));
      if (!call.speak && window.speechSynthesis) speechSynthesis.cancel();
    });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); if (call.started) finish(call.result || "ended"); else if (!call.done) finish("noanswer"); else closeCall(); }
      if (e.key === "Tab") {   // keep focus inside the phone
        var f = [].slice.call(phone.querySelectorAll("button:not([hidden]):not([disabled]),a[href]")).filter(function (n) { return n.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  function pickUp() {
    clearInterval(call.ring); clearTimeout(call.ringTimeout);
    call.started = Date.now();
    call.root.classList.remove("ringing"); call.root.classList.add("talking");
    call.talk.hidden = false; call.answer.hidden = call.decline.hidden = true; call.speaker.hidden = call.end.hidden = false;
    call.end.focus();
    call.timer = setInterval(function () { call.state.textContent = clock(); }, 500);
    call.state.textContent = clock();
    if (window.zdStore) progress("call");
    if (!call.voice) note(call.lang === "en"
      ? "This browser has no English voice, so the demo shows the words. A real call uses a natural voice."
      : "Walang Filipino voice ang browser na ito, kaya captions lang sa demo. Buksan sa Microsoft Edge para marinig ang Filipino voice. Sa totoong tawag, natural na boses ang gamit.");
    step("open");
  }
  function clock() {
    var s = Math.max(0, Math.round((Date.now() - call.started) / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function note(text) { call.log.appendChild(el("p", { class: "zdc-line note", text: text })); scrollLog(); }
  function scrollLog() { call.log.scrollTop = call.log.scrollHeight; }

  function say(text, then) {
    var line = el("p", { class: "zdc-line ai" }, [el("small", { text: call.T.ai }), text]);
    call.log.appendChild(line); scrollLog();
    call.transcript.push({ who: "ai", text: text });
    call.replies.innerHTML = "";
    call.root.classList.add("speaking");
    var finished = false;
    function done() {
      if (finished || !call) return; finished = true;
      call.root.classList.remove("speaking");
      then && then();
    }
    var words = text.split(/\s+/).length;
    if (call.speak && call.voice && window.speechSynthesis) {
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text.replace(/₱/g, " pesos "));
        u.voice = call.voice; u.lang = call.voice.lang; u.rate = 1.02;
        u.onend = u.onerror = done;
        speechSynthesis.speak(u);
        setTimeout(done, words * 520 + 4000);   // a stuck voice never blocks the call
        return;
      } catch (e) { /* fall through to captions */ }
    }
    setTimeout(done, Math.min(5200, 700 + words * 95));
  }
  function choices(list) {
    call.replies.innerHTML = "";
    list.forEach(function (c, i) {
      var b = el("button", { class: "zdc-reply", type: "button", text: c[0], onclick: function () {
        call.log.appendChild(el("p", { class: "zdc-line me" }, [el("small", { text: call.T.you }), c[0]]));
        call.transcript.push({ who: "me", text: c[0] });
        scrollLog(); call.replies.innerHTML = "";
        setTimeout(function () { c[1](); }, 450);
      } });
      call.replies.appendChild(b);
      if (i === 0) setTimeout(function () { b.focus({ preventScroll: true }); }, 30);
    });
  }

  function step(name) {
    var T = call.T, v = call.vars;
    if (name === "open") return say(fill(T.open, call), function () {
      choices([[T.yes, function () { step("units"); }], [T.busy, function () { step("busy"); }], [T.no, function () { call.result = "dnc"; say(T.noDone, function () { finish("dnc"); }); }]]);
    });
    if (name === "busy") return say(T.busyAsk, function () {
      choices(T.cb.map(function (label, i) { return [label, function () { v.when = T.cbWhen[i]; call.result = "callback"; say(fill(T.cbDone, call), function () { finish("callback"); }); }]; }));
    });
    if (name === "units") return say(fill(T.units, call), function () {
      choices(T.u.map(function (label, i) { return [label, function () { v.units = T.uVal[i]; if (i === 2) say(T.unsure, function () { step("sched"); }); else step("sched"); }]; }));
    });
    if (name === "sched" || name === "sched2") return say(name === "sched" ? fill(T.sched, call) : T.priceAns, function () {
      var opts = T.s.map(function (label) { return [label, function () { v.when = label; step("confirm"); }]; });
      if (name === "sched") opts.push([T.price, function () { step("sched2"); }]);
      choices(opts);
    });
    if (name === "confirm") { call.result = "booked"; return say(fill(T.confirm, call), function () {
      choices([[T.fine, function () { say(fill(T.bye, call), function () { finish("booked"); }); }], [T.human, function () { call.result = "handoff"; say(T.humanDone, function () { finish("handoff"); }); }]]);
    }); }
  }

  function finish(result) {
    if (!call || call.done) return;
    call.done = true;
    clearInterval(call.ring); clearTimeout(call.ringTimeout); clearInterval(call.timer);
    if (window.speechSynthesis) speechSynthesis.cancel();
    var seconds = call.started ? Math.round((Date.now() - call.started) / 1000) : 0;
    call.root.classList.remove("ringing", "speaking");
    call.talk.hidden = true; call.bar.hidden = true;
    call.state.textContent = call.started ? "Call ended · " + clock() : "Missed call";

    var info = { result: result, lang: call.lang, units: call.vars.units, when: call.vars.when, seconds: seconds, transcript: call.transcript, at: Date.now() };
    if (call.leadId) updateRequest(call.leadId, function (r) {
      r.call = info;
      if (result === "booked" || result === "handoff") r.status = "booked";
      else if (result === "callback") r.status = "contacted";
      else if (result === "dnc") { r.status = "lost"; r.dnc = true; }
    });

    var R = RESULT[result] || RESULT.ended, lang = call.lang;
    var facts = el("ul", { class: "zdc-facts" }, [
      el("li", null, [el("b", { text: "Customer: " }), call.b.name + " · " + call.b.mobile]),
      el("li", null, [el("b", { text: "Need: " }), call.b.issue + (call.vars.units ? " · " + call.vars.units : "")]),
      el("li", null, [el("b", { text: "Area: " }), call.b.area]),
      call.vars.when ? el("li", null, [el("b", { text: result === "callback" ? "Call back: " : "Schedule: " }), call.vars.when]) : null,
      el("li", null, [el("b", { text: "Language: " }), { en: "English", tl: "Tagalog", ceb: "Bisaya" }[lang]]),
    ]);
    var explain = {
      booked: "The owner gets this booking with an alert, a short summary and the call recording. A person confirms the schedule by text.",
      handoff: "Booked, and the customer asked for a person, so the owner is told to call back within 15 minutes.",
      callback: "The AI calls back at the time the customer picked. It never pushes.",
      dnc: "The customer said no, so the AI stopped and marked them “do not call”. That rule is built in.",
      noanswer: "In the real system the AI tries once more after 15 to 30 minutes. If there's still no answer, the staff send a text, then stop.",
      ended: "The call ended early. The owner still sees the lead and what was said.",
    }[result] || "";
    function again(l) { return el("button", { type: "button", text: { en: "English", tl: "Tagalog", ceb: "Bisaya" }[l], onclick: function () { var b = Object.assign({}, call.b, { lang: l }), id = call.leadId; closeCall(); startCall(b, id); primeAudio(); } }); }
    call.sum.appendChild(el("h2", { text: "What the owner sees" }));
    call.sum.appendChild(el("span", { class: "zdc-pill " + R[1], text: R[0] }));
    call.sum.appendChild(facts);
    call.sum.appendChild(el("p", { text: explain }));
    call.sum.appendChild(el("a", { class: "zdc-cta", href: "dashboard.html", target: "_blank", rel: "noopener", text: "Open the owner dashboard", onclick: function () { progress("dash"); } }));
    call.sum.appendChild(el("button", { class: "zdc-ghost", type: "button", text: "Back to the website", onclick: closeCall }));
    call.sum.appendChild(el("div", { class: "zdc-again" }, ["Hear the call again in:", again("tl"), again("en"), again("ceb")]));
    call.sum.hidden = false;
    call.sum.querySelector(".zdc-cta").focus();
  }
  function closeCall() {
    if (!call) return;
    if (window.speechSynthesis) speechSynthesis.cancel();
    clearInterval(call.ring); clearTimeout(call.ringTimeout); clearInterval(call.timer);
    var back = call.prevFocus;
    call.root.remove();
    call = null;
    if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true });
  }

  // From the booking form (index.html calls this after a valid submit)
  window.zdBooked = function (b) {
    primeAudio();
    var item = saveRequest({ name: b.name, mobile: b.mobile, area: b.area, service: b.issue, details: b.notes, lang: b.lang, source: "site" });
    setTimeout(function () { startCall(b, item.id); }, 2600);
  };
  // From the chat ("Tawagan n'yo ako")
  window.zdCall = function (b, leadId) { primeAudio(); setTimeout(function () { startCall(b, leadId); }, 1800); };

  // The ZorDevAI contact button stays hidden until a real link is set here.
  var ZORDEVAI_CONTACT = "";
  function boot() {
    buildGuide();
    var c = document.getElementById("zd-contact");
    if (c && ZORDEVAI_CONTACT) { c.href = ZORDEVAI_CONTACT; c.hidden = false; c.target = "_blank"; c.rel = "noopener"; }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
