/* Lemme cart drawer (sections/lemme-cart-drawer.liquid).
   Opens from the header bag icon and after adding to the bag; changes go through the cart AJAX API
   and the drawer is re-rendered with the Section Rendering API so prices and discounts come from Shopify. */
(function () {
  'use strict';
  if (window.LemmeCart) return;

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opener = null;
  var busy = false;
  var queued = false;

  function dialog() { return document.querySelector('[data-lc]'); }
  function inner() { var d = dialog(); return d && d.querySelector('[data-lc-inner]'); }

  function setCount(n) {
    document.querySelectorAll('[data-lm-cart-count]').forEach(function (el) { el.textContent = n; el.setAttribute('data-count', n); });
    document.querySelectorAll('.lm-header__cart').forEach(function (a) {
      var label = a.getAttribute('aria-label') || '';
      a.setAttribute('aria-label', label.replace(/\(\d+\)/, '(' + n + ')'));
    });
  }

  function announce(text) {
    var s = dialog() && dialog().querySelector('[data-lc-status]');
    if (s) { s.textContent = ''; setTimeout(function () { s.textContent = text; }, 50); }
  }

  /* Re-render the drawer from the server, keeping scroll position and focus. */
  function refresh() {
    var d = dialog();
    if (!d) return Promise.resolve();
    if (busy) { queued = true; return Promise.resolve(); }
    busy = true;
    var id = d.getAttribute('data-section-id');
    var url = window.location.pathname + '?sections=' + encodeURIComponent(id);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var html = json && json[id];
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-lc-inner]');
        var current = inner();
        if (!fresh || !current) return;
        var scroller = current.querySelector('[data-lc-scroll]');
        var top = scroller ? scroller.scrollTop : 0;
        var active = document.activeElement;
        var focusKey = null;
        if (active && current.contains(active)) {
          var item = active.closest('[data-lc-item]');
          focusKey = {
            key: item ? item.getAttribute('data-key') : null,
            sel: active.matches('[data-lc-qty="1"]') ? '[data-lc-qty="1"]' : active.matches('[data-lc-qty="-1"]') ? '[data-lc-qty="-1"]' : active.matches('[data-lc-plan]') ? '[data-lc-plan]' : active.matches('[data-lc-toggle]') ? '[data-lc-toggle]' : null,
            wasOpen: !!current.querySelector('[data-lc-toggle][aria-expanded="true"]')
          };
        }
        var breakdownOpen = !!current.querySelector('[data-lc-toggle][aria-expanded="true"]');
        current.replaceWith(fresh);
        var s2 = fresh.querySelector('[data-lc-scroll]');
        if (s2) s2.scrollTop = top;
        if (breakdownOpen) toggleBreakdown(fresh.querySelector('[data-lc-toggle]'), true);
        setCount(+fresh.getAttribute('data-count') || 0);
        // Put focus back where it was, or on something sensible.
        if (focusKey && d.open) {
          var target = null;
          if (focusKey.key && focusKey.sel) {
            var row = fresh.querySelector('[data-lc-item][data-key="' + focusKey.key + '"]');
            target = row && row.querySelector(focusKey.sel);
          } else if (focusKey.sel === '[data-lc-toggle]') {
            target = fresh.querySelector('[data-lc-toggle]');
          }
          (target || fresh.querySelector('[data-lc-close]')).focus({ preventScroll: true });
        }
      })
      .catch(function () {})
      .then(function () {
        busy = false;
        if (queued) { queued = false; return refresh(); }
      });
  }

  function emit(cart) {
    document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { resource: cart, sourceId: 'lemme-cart', data: { itemCount: cart.item_count, source: 'lemme-cart' } } }));
  }

  function post(path, body) {
    return fetch(root + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json.description || json.message || 'Something went wrong');
        return json;
      });
    });
  }

  function change(row, data) {
    if (row) row.classList.add('is-busy');
    data.id = row.getAttribute('data-key');
    return post('cart/change.js', data)
      .then(function (cart) { emit(cart); return refresh(); })
      .catch(function (err) { if (row) row.classList.remove('is-busy'); announce(err.message); return refresh(); });
  }

  function toggleBreakdown(btn, force) {
    if (!btn) return;
    var open = typeof force === 'boolean' ? force : btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.hidden = !open;
  }

  /* ---------- Open / close ---------- */
  function open(from) {
    var d = dialog();
    if (!d) return false;
    if (d.open) { d.classList.add('is-open'); return true; }
    opener = from || document.activeElement;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    document.documentElement.classList.add('lc-locked');
    d.getBoundingClientRect();
    requestAnimationFrame(function () { d.classList.add('is-open'); });
    var close = d.querySelector('[data-lc-close]');
    if (close) close.focus({ preventScroll: true });
    return true;
  }

  function close() {
    var d = dialog();
    if (!d || !d.open) return;
    d.classList.remove('is-open');
    var done = function () {
      if (d.classList.contains('is-open')) return;
      if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
      document.documentElement.classList.remove('lc-locked');
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      opener = null;
    };
    if (reduceMotion) done(); else setTimeout(done, 260);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (e) {
    var d = dialog();
    if (!d) return;

    var bag = e.target.closest('.lm-header__cart, [data-lc-open]');
    if (bag && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      open(bag);
      refresh();
      return;
    }
    if (!d.contains(e.target)) return;

    // Click on the dimmed page (the dialog's backdrop) closes it.
    if (e.target === d) {
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { close(); return; }
    }
    if (e.target.closest('[data-lc-close]')) { close(); return; }

    var toggle = e.target.closest('[data-lc-toggle]');
    if (toggle) { toggleBreakdown(toggle); return; }

    var row = e.target.closest('[data-lc-item]');
    var rm = e.target.closest('[data-lc-remove]');
    if (rm && row) { change(row, { quantity: 0 }); return; }

    var qty = e.target.closest('[data-lc-qty]');
    if (qty && row) {
      var n = Math.max(0, (+row.getAttribute('data-qty') || 0) + (+qty.getAttribute('data-lc-qty')));
      change(row, { quantity: n });
      return;
    }

    var add = e.target.closest('[data-lc-add]');
    if (add) {
      add.setAttribute('aria-busy', 'true');
      post('cart/add.js', { items: [{ id: +add.getAttribute('data-lc-add'), quantity: 1 }] })
        .then(function () { return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }); })
        .then(function (cart) { emit(cart); return refresh(); })
        .catch(function (err) { add.removeAttribute('aria-busy'); announce(err.message); });
    }
  });

  document.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-lc] [data-lc-plan]');
    if (!sel) return;
    var row = sel.closest('[data-lc-item]');
    change(row, { quantity: +row.getAttribute('data-qty') || 1, selling_plan: sel.value ? +sel.value : null });
  });

  document.addEventListener('cancel', function (e) {
    if (e.target === dialog()) { e.preventDefault(); close(); }
  }, true);

  // Something else changed the cart (product page, other sections): re-render and open.
  document.addEventListener('cart:update', function (e) {
    var detail = e.detail || {};
    if (detail.sourceId === 'lemme-cart') return;
    var d = dialog();
    if (!d) return;
    refresh();
    if (detail.data && detail.data.source === 'product-form' && d.getAttribute('data-open-on-add') === 'true') open();
  });

  // Theme editor: show the drawer while its settings are being edited.
  document.addEventListener('shopify:section:select', function (e) {
    var d = dialog();
    if (d && d.getAttribute('data-section-id') === e.detail.sectionId) open();
  });
  document.addEventListener('shopify:section:deselect', function (e) {
    var d = dialog();
    if (d && d.getAttribute('data-section-id') === e.detail.sectionId) close();
  });
  document.addEventListener('shopify:section:load', function (e) {
    var d = dialog();
    if (d && d.getAttribute('data-section-id') === e.detail.sectionId) open();
  });

  window.LemmeCart = { open: open, close: close, refresh: refresh };
})();
