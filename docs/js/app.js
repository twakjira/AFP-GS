(function () {
  "use strict";

  document.documentElement.className += " js";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function setupNav() {
    var links = $all(".navlink");
    var sections = links.map(function (a) { return $(a.getAttribute("href")); });
    function update() {
      var y = window.scrollY + 120;
      var active = 0;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i] && sections[i].offsetTop <= y) active = i;
      }
      for (var j = 0; j < links.length; j++) {
        if (j === active) links[j].className = "navlink active";
        else links[j].className = "navlink";
      }
    }
    window.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
  }

  function setupReveal() {
    var nodes = $all(".reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (n) { n.className += " visible"; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.className += " visible";
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function parseNumber(text) {
    var v = parseFloat(String(text).replace(/[^0-9.\-]/g, ""));
    return isNaN(v) ? null : v;
  }

  function setupTables() {
    $all("table[data-sortable]").forEach(function (table) {
      var lower = (table.getAttribute("data-lower") || "").split(",").map(function (s) { return parseInt(s, 10); }).filter(function (n) { return !isNaN(n); });
      var head = $all("thead th", table);
      var body = $("tbody", table);
      var rows = $all("tr", body);
      var ncol = head.length;
      for (var c = 1; c < ncol; c++) {
        var vals = rows.map(function (r) { return parseNumber(r.children[c] ? r.children[c].textContent : ""); });
        var nums = vals.filter(function (v) { return v != null; });
        if (!nums.length) continue;
        var max = Math.max.apply(null, nums);
        rows.forEach(function (r, i) {
          var cell = r.children[c];
          if (!cell || vals[i] == null) return;
          var text = cell.textContent.trim();
          cell.textContent = "";
          var bar = el("span", "cellbar");
          bar.setAttribute("data-w", String(Math.round(100 * vals[i] / max)));
          var val = el("span", "cellval", text);
          cell.appendChild(bar);
          cell.appendChild(val);
          cell.className += " num";
        });
      }
      head.forEach(function (th, c) {
        if (c === 0) return;
        th.className += " sortable";
        th.setAttribute("title", "Click to sort");
        th.addEventListener("click", function () {
          var isLower = lower.indexOf(c) >= 0;
          var state = th.getAttribute("data-dir");
          var dir = state ? (state === "asc" ? "desc" : "asc") : (isLower ? "asc" : "desc");
          head.forEach(function (h) { h.removeAttribute("data-dir"); h.className = h.className.replace(/ sorted-(asc|desc)/g, ""); });
          th.setAttribute("data-dir", dir);
          th.className += " sorted-" + dir;
          var sorted = $all("tr", body).sort(function (a, b) {
            var va = parseNumber(a.children[c] ? a.children[c].textContent : "");
            var vb = parseNumber(b.children[c] ? b.children[c].textContent : "");
            if (va == null) return 1;
            if (vb == null) return -1;
            return dir === "asc" ? va - vb : vb - va;
          });
          sorted.forEach(function (r) { body.appendChild(r); });
        });
      });
      function grow() {
        $all(".cellbar", table).forEach(function (b) { b.style.width = b.getAttribute("data-w") + "%"; });
      }
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) { grow(); io.disconnect(); } });
        }, { threshold: 0.2 });
        io.observe(table);
      } else {
        grow();
      }
    });
  }

  var FRAMES = [
    { key: "gt", label: "Reference scan" },
    { key: "base", label: "SparseSurf" },
    { key: "ours", label: "AFP-GS" },
    { key: "base_err", label: "SparseSurf error" },
    { key: "ours_err", label: "AFP-GS error" }
  ];

  function setupViewer() {
    var root = $("#viewer");
    if (!root) return;
    var manifest = null;
    var state = { tag: 0, item: 0, frame: 2, pos: 50, timer: null };
    var tabs = $(".viewer-tabs", root);
    var thumbs = $(".thumbs", root);
    var frames = $(".frames", root);
    var wipe = $(".wipe", root);
    var bottom = $(".wipe .bottom", root);
    var top = $(".wipe .top", root);
    var handle = $(".wipe .handle", root);
    var labelLeft = $(".wipe .label-left", root);
    var labelRight = $(".wipe .label-right", root);
    var caption = $(".viewer-caption", root);
    var cycleBtn = $(".cycle", root);
    var preloaded = {};

    function preload(src) {
      if (preloaded[src]) return;
      var im = new Image();
      im.src = src;
      preloaded[src] = im;
    }

    function current() { return manifest[state.tag].items[state.item]; }

    function render() {
      var item = current();
      var frame = FRAMES[state.frame];
      bottom.src = item[frame.key];
      top.src = item.photo;
      labelLeft.textContent = "Photograph";
      labelRight.textContent = frame.label;
      $all(".frame-btn", frames).forEach(function (b, i) { b.className = i === state.frame ? "frame-btn active" : "frame-btn"; });
      $all(".thumb", thumbs).forEach(function (b, i) { b.className = i === state.item ? "thumb active" : "thumb"; });
      $all(".tab", tabs).forEach(function (b, i) { b.className = i === state.tag ? "tab active" : "tab"; });
      caption.textContent = manifest[state.tag].label + " protocol, DTU scan " + item.scan + ". Chamfer distance " +
        item.cd_base.toFixed(2) + " mm for SparseSurf and " + item.cd_ours.toFixed(2) + " mm for AFP-GS. Error maps show the distance from the mesh to the reference scan from 0 to 2 mm, with grey outside the observation mask.";
      setPos(state.pos);
      FRAMES.forEach(function (f) { preload(item[f.key]); });
    }

    function setPos(p) {
      p = Math.max(2, Math.min(98, p));
      state.pos = p;
      top.style.clipPath = "inset(0 " + (100 - p) + "% 0 0)";
      top.style.webkitClipPath = "inset(0 " + (100 - p) + "% 0 0)";
      handle.style.left = p + "%";
    }

    function buildTabs() {
      tabs.innerHTML = "";
      manifest.forEach(function (d, i) {
        var b = el("button", "tab", d.label);
        b.type = "button";
        b.addEventListener("click", function () { state.tag = i; state.item = 0; buildThumbs(); render(); });
        tabs.appendChild(b);
      });
    }

    function buildThumbs() {
      thumbs.innerHTML = "";
      manifest[state.tag].items.forEach(function (it, i) {
        var b = el("button", "thumb");
        b.type = "button";
        var im = el("img");
        im.src = it.ours;
        im.alt = "Scan " + it.scan;
        b.appendChild(im);
        b.appendChild(el("span", "thumb-label", "Scan " + it.scan));
        b.addEventListener("click", function () { state.item = i; render(); });
        thumbs.appendChild(b);
      });
    }

    function buildFrames() {
      frames.innerHTML = "";
      FRAMES.forEach(function (f, i) {
        var b = el("button", "frame-btn", f.label);
        b.type = "button";
        b.addEventListener("click", function () { state.frame = i; render(); });
        frames.appendChild(b);
      });
    }

    function pointerPos(evt) {
      var rect = wipe.getBoundingClientRect();
      var x = evt.touches ? evt.touches[0].clientX : evt.clientX;
      return 100 * (x - rect.left) / rect.width;
    }
    var dragging = false;
    function start(evt) { dragging = true; setPos(pointerPos(evt)); evt.preventDefault(); }
    function move(evt) { if (dragging) { setPos(pointerPos(evt)); evt.preventDefault(); } }
    function end() { dragging = false; }
    wipe.addEventListener("mousedown", start);
    wipe.addEventListener("touchstart", start, { passive: false });
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);

    cycleBtn.addEventListener("click", function () {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
        cycleBtn.textContent = "Cycle the frames";
        cycleBtn.className = "btn cycle";
        return;
      }
      cycleBtn.textContent = "Stop cycling";
      cycleBtn.className = "btn btn-primary cycle";
      state.timer = setInterval(function () {
        state.frame = (state.frame + 1) % FRAMES.length;
        render();
      }, 1400);
    });

    function fail() {
      var note = el("p", "note", "The interactive viewer needs the page to be served over HTTP. The static figures below show the same reconstructions.");
      root.parentNode.replaceChild(note, root);
    }

    var req = new XMLHttpRequest();
    req.open("GET", "assets/samples/manifest.json", true);
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return;
      if (req.status >= 200 && req.status < 300) {
        try {
          manifest = JSON.parse(req.responseText);
        } catch (e) { fail(); return; }
        if (!manifest || !manifest.length) { fail(); return; }
        buildTabs();
        buildThumbs();
        buildFrames();
        render();
        root.className += " ready";
      } else {
        fail();
      }
    };
    req.onerror = fail;
    try { req.send(); } catch (e) { fail(); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupNav();
    setupReveal();
    setupTables();
    setupViewer();
  });
})();
