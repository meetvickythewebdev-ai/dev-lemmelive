/* Lemme collection page: shop-by-benefit toggle, filter & sort panel, quick add.
   Filtering and sorting work on the products of the current page, like lemmelive.com. */
(function () {
  'use strict';

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $all(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

  function initBenefits(section) {
    var box = section.querySelector('[data-lco-benefits]');
    if (!box || box.__lco) return;
    box.__lco = true;
    var btn = box.querySelector('[data-lco-benefits-toggle]');
    var icon = box.querySelector('.lco-benefits__icon');
    btn.addEventListener('click', function () {
      var open = !box.classList.contains('is-open');
      box.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (icon) icon.textContent = open ? '-' : '+';
    });
  }

  function initFilters(section) {
    var dialog = section.querySelector('[data-lco-dialog]');
    var grid = section.querySelector('[data-lco-grid]');
    var trigger = section.querySelector('[data-lco-open]');
    if (!dialog || !trigger || dialog.__lco) return;
    dialog.__lco = true;

    var badge = section.querySelector('[data-lco-badge]');
    var status = section.querySelector('[data-lco-status]');
    var count = section.querySelector('[data-lco-count]');
    var cards = grid ? $all(grid, '[data-lco-item]') : [];
    var promo = grid ? grid.querySelector('[data-lco-promo]') : null;
    var promoIndex = promo ? Array.prototype.indexOf.call(grid.children, promo) : -1;
    var data = cards.map(function (el, i) {
      return { el: el, i: i, type: el.getAttribute('data-type'), price: +el.getAttribute('data-price') || 0, date: +el.getAttribute('data-date') || 0 };
    });
    var applied = { sort: 'featured', types: [] };
    var opener = null;

    function countText(n) {
      var tpl = n === 1 ? count.getAttribute('data-one') : count.getAttribute('data-many');
      return (tpl || '[count]').replace('[count]', n);
    }

    function syncControls() {
      $all(dialog, '[data-lco-sort]').forEach(function (r) { r.checked = r.value === applied.sort; });
      $all(dialog, '[data-lco-type]').forEach(function (p) {
        p.setAttribute('aria-pressed', applied.types.indexOf(p.getAttribute('data-lco-type')) > -1 ? 'true' : 'false');
      });
    }

    function render() {
      var shown = data.filter(function (d) { return !applied.types.length || applied.types.indexOf(d.type) > -1; });
      var hidden = data.filter(function (d) { return shown.indexOf(d) === -1; });
      if (applied.sort === 'price-low') shown.sort(function (a, b) { return a.price - b.price || a.i - b.i; });
      else if (applied.sort === 'price-high') shown.sort(function (a, b) { return b.price - a.price || a.i - b.i; });
      else if (applied.sort === 'newest') shown.sort(function (a, b) { return b.date - a.date || a.i - b.i; });
      else shown.sort(function (a, b) { return a.i - b.i; });
      var seq = shown.map(function (d) { return d.el; });
      if (promo && promoIndex > -1) seq.splice(Math.min(promoIndex, seq.length), 0, promo);
      hidden.forEach(function (d) { d.el.hidden = true; });
      shown.forEach(function (d) { d.el.hidden = false; });
      seq.forEach(function (el) { grid.appendChild(el); });
      hidden.forEach(function (d) { grid.appendChild(d.el); });

      var n = applied.types.length;
      badge.textContent = n;
      badge.hidden = n === 0;
      trigger.classList.toggle('is-active', n > 0);
      count.textContent = countText(shown.length);
      $all(status, '.lco-chip').forEach(function (c) { c.remove(); });
      applied.types.forEach(function (t) {
        var pill = dialog.querySelector('[data-lco-type="' + t + '"] span');
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'lco-chip';
        chip.setAttribute('aria-label', 'Remove filter: ' + (pill ? pill.textContent : t));
        chip.innerHTML = '';
        chip.appendChild(document.createTextNode((pill ? pill.textContent : t) + ' '));
        var x = document.createElement('span'); x.setAttribute('aria-hidden', 'true'); x.textContent = '×'; chip.appendChild(x);
        chip.addEventListener('click', function () {
          applied.types = applied.types.filter(function (v) { return v !== t; });
          syncControls();
          render();
          trigger.focus();
        });
        status.appendChild(chip);
      });
    }

    function open() {
      opener = document.activeElement;
      syncControls();
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      document.documentElement.classList.add('lco-locked');
      dialog.getBoundingClientRect();
      requestAnimationFrame(function () { dialog.classList.add('is-open'); });
    }
    function close() {
      if (!dialog.open) return;
      dialog.classList.remove('is-open');
      var done = function () {
        if (dialog.classList.contains('is-open')) return;
        if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
        document.documentElement.classList.remove('lco-locked');
        if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      };
      if (reduceMotion) done(); else setTimeout(done, 360);
    }

    trigger.addEventListener('click', open);
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) {
        var r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { close(); return; }
      }
      if (e.target.closest('[data-lco-close]')) { close(); return; }
      var pill = e.target.closest('[data-lco-type]');
      if (pill) pill.setAttribute('aria-pressed', pill.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      if (e.target.closest('[data-lco-apply]')) {
        var checked = dialog.querySelector('[data-lco-sort]:checked');
        applied.sort = checked ? checked.value : 'featured';
        applied.types = $all(dialog, '[data-lco-type][aria-pressed="true"]').map(function (p) { return p.getAttribute('data-lco-type'); });
        render();
        close();
      }
      if (e.target.closest('[data-lco-clear]')) {
        applied = { sort: 'featured', types: [] };
        syncControls();
        render();
      }
    });

    if (grid) render();
  }

  function addToBag(btn) {
    var item = { id: +btn.getAttribute('data-lco-add'), quantity: 1 };
    var plan = btn.getAttribute('data-selling-plan');
    if (plan) item.selling_plan = +plan;
    btn.setAttribute('aria-busy', 'true');
    fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [item] })
    })
      .then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.description || j.message || 'Could not add to bag'); return j; }); })
      .then(function () { return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }); })
      .then(function (cart) {
        document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { resource: cart, sourceId: 'lemme-collection', data: { itemCount: cart.item_count, source: 'product-form' } } }));
        if (!document.querySelector('[data-lc]')) window.location.href = root + 'cart';
      })
      .catch(function (err) {
        var label = btn.querySelector('.lm-btn__text-inner');
        if (!label) return;
        var before = label.textContent;
        label.textContent = err.message;
        setTimeout(function () { label.textContent = before; }, 2500);
      })
      .then(function () { btn.removeAttribute('aria-busy'); });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lco-add]');
    if (btn && !btn.disabled) { e.preventDefault(); addToBag(btn); }
  });

  function init(scope) {
    $all(scope || document, '[data-lco]').forEach(function (section) {
      initBenefits(section);
      initFilters(section);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
