/* Lemme search drawer (sections/lemme-search-drawer.liquid) and search page (sections/lemme-search.liquid).
   - The header search icon opens the drawer under the header; the icon, Esc or a click on the page closes it.
   - Typing fetches Shopify predictive search rendered by the drawer section itself
     (/search/suggest?section_id=…), so results use the same Liquid cards and metafields.
   - Suggested searches fill the field; Enter goes to the search page. */
(function () {
  'use strict';
  if (window.__lemmeSearchReady) return;
  window.__lemmeSearchReady = true;

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opener = null;
  var controller = null;
  var timer = null;
  var cache = {};

  function drawer() { return document.querySelector('[data-lsd]'); }
  function backdrop() { return document.querySelector('[data-lsd-backdrop]'); }
  function toggles() { return Array.prototype.slice.call(document.querySelectorAll('[data-lsd-open]')); }

  function setExpanded(open) {
    toggles().forEach(function (t) { t.setAttribute('aria-expanded', open ? 'true' : 'false'); });
  }

  function open(from) {
    var d = drawer();
    if (!d) return false;
    opener = from || document.activeElement;
    var b = backdrop();
    d.hidden = false;
    if (b) b.hidden = false;
    void d.offsetWidth;
    d.classList.add('is-open');
    if (b) b.classList.add('is-open');
    document.documentElement.classList.add('lsd-locked');
    setExpanded(true);
    var input = d.querySelector('[data-lsd-input]');
    if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, reduceMotion ? 0 : 50);
    return true;
  }

  function close(restoreFocus) {
    var d = drawer();
    if (!d || d.hidden) return;
    var b = backdrop();
    d.classList.remove('is-open');
    if (b) b.classList.remove('is-open');
    document.documentElement.classList.remove('lsd-locked');
    setExpanded(false);
    var done = function () {
      if (d.classList.contains('is-open')) return;
      d.hidden = true;
      if (b) b.hidden = true;
    };
    if (reduceMotion) done(); else setTimeout(done, 320);
    if (restoreFocus !== false && opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  function isOpen() { var d = drawer(); return !!(d && d.classList.contains('is-open')); }

  /* ---------- Predictive search ---------- */
  function showResults(html) {
    var d = drawer();
    var out = d.querySelector('[data-lsd-output]');
    var def = d.querySelector('[data-lsd-default]');
    if (html === null) {
      out.hidden = true;
      out.innerHTML = '';
      def.hidden = false;
      return;
    }
    out.innerHTML = html;
    out.hidden = false;
    def.hidden = true;
  }

  function search(term) {
    var d = drawer();
    var id = d.getAttribute('data-section-id');
    var key = term.toLowerCase();
    if (cache[key]) { showResults(cache[key]); return; }
    if (controller) controller.abort();
    controller = window.AbortController ? new AbortController() : null;
    var url = root + 'search/suggest?q=' + encodeURIComponent(term) +
      '&resources[type]=product,collection,query,page,article' +
      '&resources[limit]=10&resources[limit_scope]=each' +
      '&resources[options][unavailable_products]=last' +
      '&resources[options][fields]=title,product_type,variants.title,vendor,tag' +
      '&section_id=' + encodeURIComponent(id);
    d.classList.add('is-loading');
    fetch(url, controller ? { signal: controller.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'text/html');
        var res = doc.querySelector('[data-lsd-results]');
        if (!res) return;
        var input = d.querySelector('[data-lsd-input]');
        if (input.value.trim().toLowerCase() !== key) return;
        cache[key] = res.innerHTML;
        showResults(res.innerHTML);
      })
      .catch(function () {})
      .then(function () { d.classList.remove('is-loading'); });
  }

  function onInput(input) {
    var d = drawer();
    var term = input.value.trim();
    var min = +d.getAttribute('data-min') || 2;
    d.querySelector('[data-lsd-clear]').hidden = !input.value;
    clearTimeout(timer);
    if (term.length < min) {
      if (controller) controller.abort();
      showResults(null);
      return;
    }
    timer = setTimeout(function () { search(term); }, 200);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-lsd-open]');
    if (t && drawer() && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      if (isOpen()) close(); else open(t);
      return;
    }
    if (e.target.closest('[data-lsd-backdrop]')) { close(); return; }
    var d = drawer();
    if (!d || !d.contains(e.target)) return;
    if (e.target.closest('[data-lsd-clear]')) {
      var input = d.querySelector('[data-lsd-input]');
      input.value = '';
      onInput(input);
      input.focus();
      return;
    }
    var term = e.target.closest('[data-lsd-term]');
    if (term) {
      var field = d.querySelector('[data-lsd-input]');
      field.value = term.getAttribute('data-lsd-term');
      onInput(field);
      field.focus();
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.matches && e.target.matches('[data-lsd-input]')) onInput(e.target);
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest && e.target.closest('[data-lsd-form]');
    if (!form) return;
    var input = form.querySelector('[data-lsd-input]');
    if (!input.value.trim()) { e.preventDefault(); input.focus(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen()) return;
    // Let other open dialogs (cart) handle their own Esc first.
    var cart = document.querySelector('[data-lc][open]');
    if (cart) return;
    e.preventDefault();
    close();
  });

  // Keep keyboard focus inside the drawer while it is open (header stays reachable with Shift+Tab to the icon).
  document.addEventListener('focusin', function (e) {
    var d = drawer();
    if (!isOpen() || d.contains(e.target)) return;
    if (e.target.closest('[data-lsd-open]') || e.target.closest('.lm-header')) return;
    var input = d.querySelector('[data-lsd-input]');
    if (input) input.focus({ preventScroll: true });
  });

  // Close when the cart opens or the page navigates within the theme editor.
  document.addEventListener('cart:update', function (e) {
    if (e.detail && e.detail.data && e.detail.data.source === 'product-form') close(false);
  });

  // Theme editor: show the drawer while it is being edited.
  document.addEventListener('shopify:section:select', function (e) {
    var d = drawer();
    if (d && d.getAttribute('data-section-id') === e.detail.sectionId) open();
  });
  document.addEventListener('shopify:section:deselect', function (e) {
    var d = drawer();
    if (d && d.getAttribute('data-section-id') === e.detail.sectionId) close(false);
  });
  document.addEventListener('shopify:section:load', function () { cache = {}; });

  window.LemmeSearch = { open: open, close: close };
})();
