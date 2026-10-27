/* ZorDevAI demo layer for the Thermostead sample (Website + AI Assistant).
 * 1. A shared store: requests live in this browser only (localStorage), where dashboard.html reads them.
 * 2. The demo guide: three steps a visitor can try.
 * The AI caller is a separate service (AI Telemarketer) and is not part of this demo.
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
      details: req.details || "", source: req.source, status: "new", createdAt: Date.now(),
    };
    list.unshift(item);
    write(REQUESTS, list.slice(0, 30));
    return item;
  }
  function progress(step) {
    var p = read(PROGRESS, {});
    if (!p[step]) { p[step] = true; write(PROGRESS, p); }
    renderGuide();
  }
  window.zdStore = { read: read, write: write, saveRequest: saveRequest, progress: progress };

  // The site's booking form (index.html calls this after a valid submit)
  window.zdBooked = function (b) {
    saveRequest({ name: b.name, mobile: b.mobile, area: b.area, service: b.issue, details: b.notes, source: "site" });
    progress("book");
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") node.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return node;
  }

  /* ---------------- Demo guide ---------------- */
  var guide, card, pill, count, steps = {}, touched = false;
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
        step("book", 2, "Book a visit on the form", "It lands in the owner dashboard right away", "button", { type: "button", onclick: goBook }),
        step("dash", 3, "Open the owner dashboard", "See every chat and booking", "a", { href: "dashboard.html", target: "_blank", rel: "noopener", onclick: function () { progress("dash"); } }),
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

  // The "Talk to Zoren" button stays hidden until a real link is set here.
  var ZORDEVAI_CONTACT = "https://m.me/61595403575723";
  function boot() {
    buildGuide();
    var c = document.getElementById("zd-contact");
    if (c && ZORDEVAI_CONTACT) { c.href = ZORDEVAI_CONTACT; c.hidden = false; c.target = "_blank"; c.rel = "noopener"; }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
