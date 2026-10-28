/* Lemme build your bundle (sections/lemme-byob.liquid).
   Pick products into the pack's slots, choose one-time or subscription, then everything is added to the bag in one
   request with a shared _bundle_id. Picks are kept for a day so switching pack size
   keeps them. One-time bundles get the discount code from Theme settings applied to the bag. */
(function () {
  'use strict';
  if (window.__lemmeByobReady) return;
  window.__lemmeByobReady = true;

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var KEY = 'lemme-byob-picks';

  function $(el, sel) { return el.querySelector(sel); }
  function $all(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function money(cents) {
    var v = Math.round(cents / 100);
    return '$' + v;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function save(ids) {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), ids: ids })); } catch (e) {}
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s || Date.now() - s.t > 864e5) return [];
      return s.ids || [];
    } catch (e) { return []; }
  }

  function init(section) {
    if (section.__lbb) return;
    section.__lbb = true;
    var size = +section.getAttribute('data-size') || 4;
    var max = +section.getAttribute('data-max') || 3;
    var pct = +section.getAttribute('data-percent') || 0;
    var code = section.getAttribute('data-code') || '';
    var codeCents = +section.getAttribute('data-code-cents') || 0;
    var cards = $all(section, '[data-lbb-card]');
    var byId = {};
    cards.forEach(function (c) { byId[c.getAttribute('data-id')] = c; });
    var slots = $all(section, '[data-lbb-slot]');
    var form = $(section, '[data-lbb-form]');
    var toggle = $(section, '[data-lbb-toggle]');
    var currentEl = $(section, '[data-lbb-current]');
    var submit = $(section, '[data-lbb-submit]');
    var submitLabel = $(section, '[data-lbb-submit-label]');
    var status = $(section, '[data-lbb-status]');
    var modes = $all(section, '[data-lbb-mode]');
    var planSelect = $(section, '[data-lbb-plan]');
    var subMore = $(section, '[data-lbb-sub-more]');
    var picks = load().filter(function (id) { return byId[id] && !byId[id].hasAttribute('data-sold-out'); }).slice(0, size);

    function mode() { var m = modes.filter(function (r) { return r.checked; })[0]; return m ? m.value : 'once'; }
    function count(id) { return picks.filter(function (p) { return p === id; }).length; }

    function totals() {
      var full = 0, sub = 0;
      picks.forEach(function (id) {
        var c = byId[id];
        var price = +c.getAttribute('data-price') || 0;
        var compare = Math.max(price, +c.getAttribute('data-compare') || 0);
        full += compare;
        sub += Math.round(price * (100 - pct) / 100);
      });
      var base = picks.reduce(function (sum, id) { return sum + (+byId[id].getAttribute('data-price') || 0); }, 0);
      return { compare: full, once: Math.max(0, base - codeCents), sub: sub };
    }

    function render(newIndex) {
      var full = picks.length === size;
      currentEl.textContent = picks.length;
      slots.forEach(function (slot, i) {
        var fill = $(slot, '[data-lbb-slot-fill]');
        var rm = $(slot, '[data-lbb-remove]');
        var id = picks[i];
        slot.classList.toggle('is-filled', !!id);
        slot.classList.toggle('is-new', i === newIndex);
        rm.hidden = !id;
        if (!id) { fill.innerHTML = ''; rm.removeAttribute('aria-label'); return; }
        var c = byId[id];
        if (fill.getAttribute('data-for') !== id) {
          fill.innerHTML = '';
          var src = c.getAttribute('data-image');
          if (src) { var img = new Image(); img.src = src; img.alt = ''; img.width = 137; fill.appendChild(img); }
          var p = document.createElement('p'); p.className = 'lbb-slot__name'; p.textContent = c.getAttribute('data-name'); fill.appendChild(p);
          fill.setAttribute('data-for', id);
        }
        rm.setAttribute('aria-label', 'Remove ' + c.getAttribute('data-title') + ' from your bundle');
      });
      cards.forEach(function (c) {
        var id = c.getAttribute('data-id');
        var n = count(id);
        var add = $(c, '[data-lbb-add]');
        var qty = $(c, '[data-lbb-qty]');
        c.classList.toggle('is-picked', n > 0);
        qty.hidden = n === 0;
        $(qty, '[data-lbb-count]').textContent = n;
        $(qty, '[data-lbb-step="1"]').disabled = full || n >= max;
        if (!c.hasAttribute('data-sold-out')) add.disabled = full;
      });
      var t = totals();
      $all(section, '[data-lbb-prices]').forEach(function (box) {
        box.hidden = !full;
        var isSub = box.getAttribute('data-lbb-prices') === 'sub';
        var price = isSub ? t.sub : t.once;
        $(box, '[data-lbb-price]').textContent = money(price);
        var s = $(box, '[data-lbb-compare]');
        s.textContent = t.compare > price ? money(t.compare) : '';
      });
      var m = mode();
      if (subMore) subMore.hidden = m !== 'sub';
      $all(section, '.lbb-pack__badge').forEach(function (b) {
        b.textContent = m === 'sub' ? b.getAttribute('data-sub') : b.getAttribute('data-once');
        if (m === 'sub' && /\b0%/.test(b.textContent)) b.textContent = '';
      });
      submit.disabled = !full;
      var title = section.getAttribute('data-title');
      submitLabel.textContent = full
        ? title + ' — ' + money(m === 'sub' ? t.sub : t.once) + ' - ' + submit.getAttribute('data-label')
        : title + ' — ' + submit.getAttribute('data-label');
      save(picks);
    }

    function addPick(id) {
      if (picks.length >= size || count(id) >= max) return;
      picks.push(id);
      render(picks.length - 1);
      status.textContent = '';
    }
    function removeOne(id) {
      var i = picks.lastIndexOf(id);
      if (i > -1) { picks.splice(i, 1); render(); }
    }

    section.addEventListener('click', function (e) {
      var card = e.target.closest('[data-lbb-card]');
      if (card && e.target.closest('[data-lbb-add]')) { addPick(card.getAttribute('data-id')); return; }
      var step = e.target.closest('[data-lbb-step]');
      if (card && step) {
        if (step.getAttribute('data-lbb-step') === '1') addPick(card.getAttribute('data-id'));
        else removeOne(card.getAttribute('data-id'));
        return;
      }
      var rm = e.target.closest('[data-lbb-remove]');
      if (rm) {
        var i = slots.indexOf(rm.closest('[data-lbb-slot]'));
        if (i > -1 && picks[i]) { picks.splice(i, 1); render(); }
        return;
      }
      if (e.target.closest('[data-lbb-toggle]')) {
        var open = !form.classList.contains('is-open');
        form.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });
    modes.forEach(function (r) { r.addEventListener('change', function () { render(); }); });
    if (planSelect) planSelect.addEventListener('change', function () { render(); });

    submit.addEventListener('click', function () {
      if (picks.length !== size) return;
      var m = mode();
      var plan = m === 'sub' && planSelect ? +planSelect.value : null;
      var bundleId = uuid();
      var title = section.getAttribute('data-title');
      // Only the chosen products are added (no $0 pack line, so checkout lists just the products). They share a
      // _bundle_id so the bag groups them into one card; "bundle" shows the pack name under each line at checkout.
      var items = [];
      picks.forEach(function (id) {
        var found = items.filter(function (it) { return String(it.id) === id; })[0];
        if (found) { found.quantity++; return; }
        items.push({ id: +id, quantity: 1, properties: { _bundle_id: bundleId, bundle: title, _bundle_size: String(size) } });
      });
      if (plan) items.forEach(function (it) { it.selling_plan = plan; });
      submit.setAttribute('aria-busy', 'true');
      status.textContent = '';
      fetch(root + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items })
      })
        .then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.description || j.message || 'Could not add to bag'); return j; }); })
        .then(function () { return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }); })
        .then(function (cart) {
          if (m !== 'once' || !code) return cart;
          var codes = (cart.discount_codes || []).map(function (d) { return d.code; }).filter(function (c) { return c && c.toUpperCase() !== code.toUpperCase(); });
          codes.push(code);
          return fetch(root + 'cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ discount: codes.join(',') })
          }).then(function (r) { return r.json(); }).catch(function () { return cart; });
        })
        .then(function (cart) {
          picks = [];
          render();
          form.classList.remove('is-open');
          document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { resource: cart, sourceId: 'lemme-byob', data: { itemCount: cart.item_count, source: 'product-form' } } }));
          if (!document.querySelector('[data-lc]')) window.location.href = root + 'cart';
        })
        .catch(function (err) { status.textContent = err.message; })
        .then(function () { submit.removeAttribute('aria-busy'); });
    });

    // Keep picks when switching pack size
    $all(section, '[data-lbb-pack]').forEach(function (a) {
      a.addEventListener('click', function () { save(picks); });
    });

    render();
  }

  function initAll(scope) { $all(scope || document, '[data-lbb]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(); });
  else initAll();
  document.addEventListener('shopify:section:load', function (e) { initAll(e.target); });
})();
