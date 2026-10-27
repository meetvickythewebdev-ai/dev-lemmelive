/* Lemme product page interactions
   - Product-colour background that fades out as you scroll past the product (same formula as lemmelive.com)
   - Image gallery (scroll-snap) with thumbnails, arrows, dots and a zoom view
   - Details / FAQs tabs, "See benefits" toggle, supplement facts drawer
   - Purchase options (variants + subscription selling plans), AJAX add to bag, mobile sticky button
   - Related products loaded from Shopify's product recommendations */
(function () {
  if (window.LemmePdp) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(root, sel) { return root.querySelector(sel); }
  function $all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function scrollTop() {
    var wrapper = document.querySelector('.page-wrapper');
    return Math.max(window.pageYOffset || document.documentElement.scrollTop || 0, wrapper ? wrapper.scrollTop : 0);
  }

  /* ---------- Background fade ---------- */
  function initBackground(section) {
    var bg = document.querySelector('[data-lm-pdp-bg]');
    if (!bg || bg.__lm) return;
    bg.__lm = true;
    var ticking = false;
    function update() {
      ticking = false;
      var h = section.getBoundingClientRect().height;
      var o = 1 - (scrollTop() - h / 1.1 + 500) / 500;
      bg.style.opacity = Math.max(0, Math.min(1, o)).toFixed(3);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    var wrapper = document.querySelector('.page-wrapper');
    if (wrapper) wrapper.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- Gallery ---------- */
  function initGallery(section) {
    var gallery = $(section, '[data-lm-gallery]');
    if (!gallery || gallery.__lm) return;
    gallery.__lm = true;
    var track = $(gallery, '.swiper-wrapper');
    var slides = $all(gallery, '.swiper-slide');
    var thumbs = $all(gallery, '[data-lm-thumb]');
    var dotsWrap = $(gallery, '[data-lm-gallery-dots]');
    var dots = [];
    var index = 0;

    if (dotsWrap && slides.length > 1) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lm-pdp-gallery__dot' + (i === 0 ? ' is-active' : '');
        b.setAttribute('aria-label', 'Go to image ' + (i + 1));
        b.addEventListener('click', function () { go(i); });
        dotsWrap.appendChild(b);
        dots.push(b);
      });
    }

    function setActive(i) {
      index = i;
      thumbs.forEach(function (t, n) { t.classList.toggle('is-active', n === i); t.setAttribute('aria-selected', n === i ? 'true' : 'false'); });
      dots.forEach(function (d, n) { d.classList.toggle('is-active', n === i); });
    }
    function go(i) {
      i = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
      setActive(i);
    }
    var scrollTimer;
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== index) setActive(Math.max(0, Math.min(slides.length - 1, i)));
      }, 60);
    }, { passive: true });
    thumbs.forEach(function (t) { t.addEventListener('click', function () { go(parseInt(t.getAttribute('data-lm-thumb'), 10)); }); });
    var prev = $(gallery, '[data-lm-gallery-prev]');
    var next = $(gallery, '[data-lm-gallery-next]');
    if (prev) prev.addEventListener('click', function () { go(index - 1); });
    if (next) next.addEventListener('click', function () { go(index + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });
    track.setAttribute('tabindex', '0');
    track.setAttribute('aria-label', 'Product images, use arrow keys to browse');

    // Zoom
    var zoom = $(section, '[data-lm-zoom]');
    var zoomBtn = $(gallery, '[data-lm-zoom-open]');
    if (zoom && zoomBtn && zoom.showModal) {
      var zoomImg = document.createElement('img');
      $(zoom, '[data-lm-zoom-holder]').appendChild(zoomImg);
      zoomBtn.addEventListener('click', function () {
        var img = slides[index] && slides[index].querySelector('img');
        if (!img) return;
        zoomImg.src = img.getAttribute('data-lm-zoom-src') || img.currentSrc || img.src;
        zoomImg.alt = img.alt || '';
        zoom.showModal();
      });
      $(zoom, '[data-lm-zoom-close]').addEventListener('click', function () { zoom.close(); });
      zoomImg.addEventListener('click', function () { zoom.close(); });
      zoom.addEventListener('close', function () { zoomBtn.focus(); });
    }
  }

  /* ---------- Tabs, benefits, drawer, FAQ jump ---------- */
  function initTabs(section) {
    var tabs = $all(section, '[data-lm-tab]');
    tabs.forEach(function (tab) {
      if (tab.__lm) return;
      tab.__lm = true;
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-lm-tab');
        tabs.forEach(function (t) { var on = t === tab; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
        $all(section, '[data-lm-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-lm-panel') !== name; });
        $all(section, '[data-lm-drawer-open].lm-pdp-tabs__tab').forEach(function (t) { t.classList.remove('is-active'); });
      });
    });

    var toggle = $(section, '[data-lm-benefits-toggle]');
    if (toggle && !toggle.__lm) {
      toggle.__lm = true;
      toggle.addEventListener('click', function () {
        var list = document.getElementById(toggle.getAttribute('aria-controls'));
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        list.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? toggle.getAttribute('data-label-close') : toggle.getAttribute('data-label-open');
      });
    }

    $all(section, '[data-lm-drawer-open]').forEach(function (btn) {
      if (btn.__lm) return;
      btn.__lm = true;
      btn.addEventListener('click', function () {
        var d = document.getElementById(btn.getAttribute('data-lm-drawer-open'));
        if (d && d.showModal) { d.__opener = btn; d.showModal(); }
      });
    });
    $all(section, '[data-lm-drawer]').forEach(function (d) {
      if (d.__lm) return;
      d.__lm = true;
      $(d, '[data-lm-drawer-close]').addEventListener('click', function () { d.close(); });
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
      d.addEventListener('close', function () { if (d.__opener) d.__opener.focus(); });
    });

    $all(section, '[data-lm-faq-jump]').forEach(function (btn) {
      if (btn.__lm) return;
      btn.__lm = true;
      btn.addEventListener('click', function () {
        var item = document.getElementById('LmFaq-' + btn.getAttribute('data-lm-faq-jump'));
        if (!item) return;
        item.open = true;
        item.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        var summary = item.querySelector('summary');
        if (summary) setTimeout(function () { summary.focus({ preventScroll: true }); }, 400);
      });
    });
  }

  /* ---------- Buying ---------- */
  function updateCartCount(count) {
    $all(document, '[data-lm-cart-count]').forEach(function (el) { el.textContent = count; });
    $all(document, '.lm-header__cart').forEach(function (a) {
      var label = a.getAttribute('aria-label') || '';
      a.setAttribute('aria-label', label.replace(/\(\d+\)/, '(' + count + ')'));
    });
  }

  function initBuy(section) {
    var buy = $(section, '[data-lm-buy]');
    if (!buy || buy.__lm) return;
    buy.__lm = true;
    var form = $(buy, '[data-lm-product-form]');
    var idInput = $(form, '[data-lm-variant-input]');
    var planInput = $(form, '[data-lm-plan-input]');
    var submit = $(form, '[data-lm-submit]');
    var label = $(form, '[data-lm-submit-label]');
    var onceBtn = $(form, '[data-lm-buy-once]');
    var oncePrice = $(form, '[data-lm-once-price]');
    var status = $(form, '[data-lm-form-status]');
    var radios = $all(buy, 'input[type="radio"]');
    var buyOnce = false;

    function current() { return radios.filter(function (r) { return r.checked; })[0] || radios[0]; }
    function render() {
      var r = current();
      if (!r) return;
      idInput.value = r.value;
      if (planInput) planInput.value = r.getAttribute('data-selling-plan') || '';
      var available = r.getAttribute('data-available') === 'true';
      submit.disabled = !available;
      if (available) {
        label.innerHTML = '';
        var price = document.createElement('span');
        price.setAttribute('data-lm-submit-price', '');
        price.textContent = r.getAttribute('data-price');
        label.appendChild(price);
        label.appendChild(document.createTextNode(label.getAttribute('data-add')));
      } else {
        label.textContent = label.getAttribute('data-sold-out');
      }
      if (oncePrice) oncePrice.textContent = r.getAttribute('data-once-price');
      if (onceBtn) onceBtn.parentNode.hidden = !available || !r.getAttribute('data-selling-plan');
    }
    radios.forEach(function (r) { r.addEventListener('change', function () { status.textContent = ''; render(); }); });
    render();

    if (onceBtn) onceBtn.addEventListener('click', function () { buyOnce = true; });
    submit.addEventListener('click', function () { buyOnce = false; });

    form.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      var data = new FormData(form);
      if (buyOnce || !data.get('selling_plan')) data.delete('selling_plan');
      var btn = buyOnce ? onceBtn : submit;
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      status.textContent = '';
      var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      fetch(root + 'cart/add.js', { method: 'POST', headers: { Accept: 'application/json' }, body: data })
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.json.description || result.json.message || 'Could not add to bag');
          status.innerHTML = '';
          status.appendChild(document.createTextNode(label.getAttribute('data-added') + ' '));
          var link = document.createElement('a');
          link.href = root + 'cart';
          link.textContent = 'View bag';
          status.appendChild(link);
          return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (cart) {
            updateCartCount(cart.item_count);
            document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { resource: cart, sourceId: 'lemme-pdp', data: { itemCount: cart.item_count, source: 'product-form' } } }));
          });
        })
        .catch(function (err) { status.textContent = err.message; })
        .finally(function () { btn.removeAttribute('aria-busy'); btn.disabled = false; buyOnce = false; render(); });
    });

    // Mobile sticky button
    var sticky = $(section, '[data-lm-sticky]');
    if (sticky && 'IntersectionObserver' in window) {
      sticky.hidden = false;
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        sticky.classList.toggle('is-visible', !e.isIntersecting && e.boundingClientRect.top < 0);
      }).observe(buy);
      $(sticky, '[data-lm-sticky-btn]').addEventListener('click', function () {
        buy.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        var r = current();
        if (r) setTimeout(function () { r.focus({ preventScroll: true }); }, 500);
      });
    }
  }

  /* ---------- Related products ---------- */
  function initRelated(root) {
    $all(root, '[data-lm-related]').forEach(function (el) {
      if (el.__lm || el.hasAttribute('data-loaded')) return;
      el.__lm = true;
      var url = el.getAttribute('data-url');
      if (!url || !window.fetch) return;
      fetch(url).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector('[data-lm-related]');
        if (!fresh || !fresh.querySelector('.swiper-slide')) return;
        el.innerHTML = fresh.innerHTML;
        el.setAttribute('data-loaded', '');
        if (window.LemmeHome && window.LemmeHome.init) window.LemmeHome.init(el);
      }).catch(function () {});
    });
  }

  function init(root) {
    root = root || document;
    $all(root, '[data-lm-pdp]').forEach(function (section) {
      initBackground(section);
      initGallery(section);
      initTabs(section);
      initBuy(section);
    });
    initRelated(root);
  }

  window.LemmePdp = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
