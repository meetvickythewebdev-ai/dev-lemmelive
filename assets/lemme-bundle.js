/* Lemme bundle product page:
   - page background fades from the product's top colour to its page colour while scrolling
   - purchase options (one-time / subscription), quantity, AJAX add to bag (opens the cart drawer)
   - benefit icon tabs for each product in the bundle
   - "so what's in it?" ingredient dropdown + carousel
   The gallery and the details drawer are handled by lemme-pdp.js. */
(function () {
  'use strict';
  if (window.__lemmeBundleReady) return;
  window.__lemmeBundleReady = true;

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(el, sel) { return el.querySelector(sel); }
  function $all(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

  /* ---------- Scrolling background ---------- */
  function hex(c) {
    c = (c || '').trim();
    var m = c.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = c.match(/rgba?\(([^)]+)\)/);
    if (m) return m[1].split(',').slice(0, 3).map(function (v) { return parseFloat(v); });
    return null;
  }
  var bg = null;
  function scrollTop() {
    var wrap = document.querySelector('.page-wrapper');
    return Math.max(window.scrollY || 0, wrap ? wrap.scrollTop : 0);
  }
  function paint() {
    if (!bg || !document.contains(bg.section)) return;
    var h = bg.section.offsetHeight || 1;
    // Same curve as lemmelive.com: the top colour starts fading at ~30% of the first section and is gone at ~90%.
    var p = (scrollTop() - h * 0.3) / (h * 0.6);
    p = Math.max(0, Math.min(1, p));
    if (p === bg.last) return;
    bg.last = p;
    var c = bg.top.map(function (v, i) { return Math.round(v + (bg.page[i] - v) * p); });
    document.documentElement.style.setProperty('--lb-bg', 'rgb(' + c.join(',') + ')');
  }
  function initBackground(scope) {
    var section = $(scope, '[data-lb-main]') || (scope.matches && scope.matches('[data-lb-main]') ? scope : null);
    if (!section) return;
    var top = hex(section.getAttribute('data-lb-top'));
    var page = hex(section.getAttribute('data-lb-page'));
    if (!top || !page) return;
    bg = { section: section, top: top, page: page, last: -1 };
    paint();
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; paint(); });
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- Buy box ---------- */
  function money(cents, round) {
    var v = cents / 100;
    if (round) v = Math.round(v);
    return '$' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
  }

  function initBuy(section) {
    var buy = $(section, '[data-lb-buy]');
    if (!buy || buy.__lb) return;
    buy.__lb = true;
    var round = buy.getAttribute('data-round') === 'true';
    var form = $(buy, '[data-lb-form]');
    var planInput = $(form, '[data-lb-plan]');
    var qtyInput = $(form, '[data-lb-qty-input]');
    var submit = $(form, '[data-lb-submit]');
    var label = $(form, '[data-lb-submit-label]');
    var status = $(form, '[data-lb-status]');
    var radios = $all(buy, '.lb-option__radio');
    var more = $(buy, '[data-lb-sub-more]');
    var freq = $(buy, '[data-lb-frequency]');
    var subPrice = $(buy, '[data-lb-sub-price]');

    function current() { return radios.filter(function (r) { return r.checked; })[0] || radios[0]; }
    function render() {
      var r = current();
      var sub = r && r.hasAttribute('data-sub');
      var plan = sub ? (freq ? freq.value : r.value) : '';
      planInput.value = plan;
      planInput.disabled = !plan;
      if (more) more.hidden = !sub;
    }
    radios.forEach(function (r) { r.addEventListener('change', function () { status.textContent = ''; render(); }); });
    if (freq) freq.addEventListener('change', function () {
      var opt = freq.options[freq.selectedIndex];
      if (subPrice && opt) subPrice.textContent = money(+opt.getAttribute('data-price'), round);
      render();
    });
    render();

    function setQty(n) {
      n = Math.max(1, Math.min(+qtyInput.max || 99, Math.round(n) || 1));
      qtyInput.value = n;
    }
    $all(form, '[data-lb-qty]').forEach(function (b) {
      b.addEventListener('click', function () { setQty((+qtyInput.value || 1) + +b.getAttribute('data-lb-qty')); });
    });
    qtyInput.addEventListener('change', function () { setQty(+qtyInput.value); });

    form.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      var item = { id: +$(form, '[data-lb-variant]').value, quantity: +qtyInput.value || 1 };
      if (!planInput.disabled && planInput.value) item.selling_plan = +planInput.value;
      submit.setAttribute('aria-busy', 'true');
      status.textContent = '';
      fetch(root + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [item] })
      })
        .then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.description || j.message || 'Could not add to bag'); return j; }); })
        .then(function () { return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }); })
        .then(function (cart) {
          document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { resource: cart, sourceId: 'lemme-bundle', data: { itemCount: cart.item_count, source: 'product-form' } } }));
          if (!document.querySelector('[data-lc]')) window.location.href = root + 'cart';
        })
        .catch(function (err) { status.textContent = err.message; })
        .then(function () { submit.removeAttribute('aria-busy'); });
    });
  }

  /* ---------- Benefit icon tabs ---------- */
  function initTabs(section) {
    var box = $(section, '[data-lb-tabs]');
    if (!box || box.__lb) return;
    box.__lb = true;
    var tabs = $all(box, '[data-lb-tab]');
    var panels = $all(box, '[data-lb-panel]');
    function select(i, focus) {
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (panels[n]) panels[n].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
  }

  /* ---------- Ingredients ---------- */
  function carousel(group) {
    if (group.__lb) return group.__lb;
    var track = $(group, '[data-lb-ingr-track]');
    var nav = $(group, '[data-lb-ingr-nav]');
    var dots = $(group, '[data-lb-ingr-dots]');
    var prev = $(group, '[data-lb-ingr-prev]');
    var next = $(group, '[data-lb-ingr-next]');
    var slides = $all(track, '.lb-ingr__slide');
    function perPage() {
      var s = slides[0]; if (!s) return 1;
      return Math.max(1, Math.round(track.clientWidth / s.offsetWidth));
    }
    function pages() { return Math.max(1, slides.length - perPage() + 1); }
    function index() {
      var s = slides[0]; if (!s) return 0;
      var step = s.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
      return Math.min(pages() - 1, Math.round(track.scrollLeft / Math.max(1, step)));
    }
    function go(i) {
      i = Math.max(0, Math.min(pages() - 1, i));
      var s = slides[i];
      if (s) track.scrollTo({ left: s.offsetLeft - slides[0].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    function build() {
      var n = track.scrollWidth > track.clientWidth + 2 ? pages() : 1;
      nav.hidden = n < 2;
      dots.innerHTML = '';
      for (var i = 0; i < n && n > 1; i++) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'lb-gallery__dot'; b.tabIndex = -1;
        b.setAttribute('aria-label', 'Show ingredient ' + (i + 1));
        (function (i) { b.addEventListener('click', function () { go(i); }); })(i);
        dots.appendChild(b);
      }
      sync();
    }
    function sync() {
      var i = index();
      $all(dots, 'button').forEach(function (b, n) { b.classList.toggle('is-active', n === i); });
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= pages() - 1;
    }
    if (prev) prev.addEventListener('click', function () { go(index() - 1); });
    if (next) next.addEventListener('click', function () { go(index() + 1); });
    track.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', build);
    build();
    group.__lb = { build: build };
    return group.__lb;
  }
  function initIngredients(scope) {
    $all(scope, '[data-lb-ingr]').forEach(function (sec) {
      if (sec.__lb) return;
      sec.__lb = true;
      var groups = $all(sec, '[data-lb-ingr-group]');
      var select = $(sec, '[data-lb-ingr-select]');
      groups.forEach(function (g) { if (!g.hidden) carousel(g); });
      if (select) select.addEventListener('change', function () {
        groups.forEach(function (g) {
          var on = g.getAttribute('data-lb-ingr-group') === select.value;
          g.hidden = !on;
          if (on) carousel(g).build();
        });
      });
    });
  }

  function init(scope) {
    scope = scope || document;
    initBackground(scope);
    $all(scope, '[data-lb-main]').forEach(function (s) { initBuy(s); initTabs(s); });
    if (scope.matches && scope.matches('[data-lb-main]')) { initBuy(scope); initTabs(scope); }
    initIngredients(scope);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
