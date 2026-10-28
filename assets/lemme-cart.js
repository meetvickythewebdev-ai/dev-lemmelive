/* Lemme cart drawer (sections/lemme-cart-drawer.liquid).
   Opens from the header bag icon and after adding to the bag; changes go through the cart AJAX API
   and the drawer is re-rendered with the Section Rendering API so prices and discounts come from Shopify. */
(function () {
  'use strict';
  if (window.__lemmeCartReady) return;
  window.__lemmeCartReady = true;

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
    return fetch(url, { cache: 'no-store' })
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
        if (window.LemmeHome && typeof window.LemmeHome.init === 'function') { try { window.LemmeHome.init(fresh); } catch (err) {} }
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

  /* ---------- Add-to-bag popup (snippets/lemme-atc-popup.liquid) ---------- */
  var popWanted = false;
  function showPop(added) {
    var d = dialog();
    var pop = d && d.querySelector('[data-lc-pop]');
    var trigger = pop ? pop.getAttribute('data-trigger') : 'add';
    popWanted = !!added || trigger === 'open';
    syncPop();
  }
  function syncPop() {
    var d = dialog();
    if (!d) return;
    var pop = d.querySelector('[data-lc-pop]');
    d.classList.toggle('lc--pop', popWanted && !!pop);
  }
  function hidePop() { popWanted = false; syncPop(); }

  /* ---------- Open / close ---------- */
  function open(from, added) {
    var d = dialog();
    if (!d) return false;
    if (from === true) { added = true; from = null; }
    showPop(added);
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
    hidePop();
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

    // Click on the dimmed page (outside the panel and the popup cards) closes it.
    if (e.target === d || e.target.hasAttribute('data-lc-inner')) { close(); return; }
    if (e.target.closest('[data-lc-pop-close]') || e.target.matches('[data-lc-pop], .lc-pop__content, .lc-pop__items')) { hidePop(); return; }
    if (e.target.closest('[data-lc-close]')) { close(); return; }

    var toggle = e.target.closest('[data-lc-toggle]');
    if (toggle) { toggleBreakdown(toggle); return; }

    var rmBundle = e.target.closest('[data-lc-remove-bundle]');
    if (rmBundle) {
      var bundleRow = rmBundle.closest('[data-lc-item]');
      if (bundleRow) bundleRow.classList.add('is-busy');
      var updates = {};
      rmBundle.getAttribute('data-lc-remove-bundle').split(',').forEach(function (k) { if (k) updates[k] = 0; });
      post('cart/update.js', { updates: updates })
        .then(function (cart) {
          // Drop the one-time bundle code when no one-time bundle is left in the bag
          var code = (d.getAttribute('data-byob-code') || '').toUpperCase();
          var codes = (cart.discount_codes || []).map(function (c) { return c.code; });
          var hasCode = codes.some(function (c) { return c.toUpperCase() === code; });
          var oneTimeLeft = cart.items.some(function (i) { return i.properties && i.properties._bundle_parent && !i.selling_plan_allocation; });
          if (code && hasCode && !oneTimeLeft) {
            return post('cart/update.js', { discount: codes.filter(function (c) { return c.toUpperCase() !== code; }).join(',') });
          }
          return cart;
        })
        .then(function (cart) { emit(cart); return refresh(); })
        .catch(function (err) { if (bundleRow) bundleRow.classList.remove('is-busy'); announce(err.message); return refresh(); });
      return;
    }

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
        .then(syncPop)
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
    var added = detail.data && detail.data.source === 'product-form';
    refresh().then(function () { if (added && d.open) syncPop(); });
    if (added && d.getAttribute('data-open-on-add') === 'true') open(null, true);
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

  document.addEventListener('keydown', function (e) {
    var d = dialog();
    if (e.key === 'Escape' && d && d.classList.contains('lc--pop') && d.open) { e.preventDefault(); e.stopPropagation(); hidePop(); }
  }, true);

  window.LemmeCart = { open: open, close: close, refresh: refresh, hidePopup: hidePop };
})();
