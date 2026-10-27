/* Lemme product page interactions (lemmelive.com "new PDP" design)
   - Gallery: swipe/scroll-snap slides, thumbnails, arrows, in-place zoom (x3, drag to pan)
   - Tabs that open a side drawer (benefits, what we leave out, supplement facts, FAQs, awards)
   - Purchase options, AJAX add to bag, sticky add-to-bag bar, "full routine" bundle
   - Sticky page links, accordions, benefit video controls, ingredient drawer, product cards row */
(function () {
  if (window.LemmePdp) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var desktop = window.matchMedia('(min-width: 1024px)');
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  function $(el, sel) { return el.querySelector(sel); }
  function $all(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function once(el, key) { if (!el || el['__lp' + key]) return false; el['__lp' + key] = true; return true; }
  function money(cents) {
    var v = cents / 100;
    return '$' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
  }

  /* ---------- Cart helpers ---------- */
  function refreshCart(source) {
    return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        $all(document, '[data-lm-cart-count]').forEach(function (el) { el.textContent = cart.item_count; });
        $all(document, '.lm-header__cart').forEach(function (a) {
          var label = a.getAttribute('aria-label') || '';
          a.setAttribute('aria-label', label.replace(/\(\d+\)/, '(' + cart.item_count + ')'));
        });
        document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { resource: cart, sourceId: source, data: { itemCount: cart.item_count, source: 'product-form' } } }));
        return cart;
      });
  }
  function addItems(items) {
    return fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items })
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json.description || json.message || 'Could not add to bag');
        return json;
      });
    });
  }

  /* ---------- Gallery ---------- */
  function initGallery(section) {
    var gallery = $(section, '[data-lp-gallery]');
    if (!once(gallery, 'gallery')) return;
    var track = $(gallery, '[data-lp-track]');
    var slides = $all(gallery, '[data-lp-slide]');
    var thumbs = $all(gallery, '[data-lp-thumb]');
    var prev = $(gallery, '[data-lp-prev]');
    var next = $(gallery, '[data-lp-next]');
    var zoomBtn = $(gallery, '[data-lp-zoom]');
    var index = 0;
    var zoom = { on: false, scale: 3, x: 0, y: 0 };

    function setActive(i) {
      index = i;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
      thumbs.forEach(function (t, n) {
        var on = n === i;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) {
          var list = t.parentNode;
          var vertical = list.scrollHeight > list.clientHeight + 1 && desktop.matches;
          if (vertical) list.scrollTo({ top: t.offsetTop - list.clientHeight / 2 + t.offsetHeight / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
          else list.scrollTo({ left: t.offsetLeft - list.clientWidth / 2 + t.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      });
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === slides.length - 1;
    }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      if (zoom.on) setZoom(false);
      track.scrollTo({ left: slides[i].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
      setActive(i);
    }
    var t;
    track.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== index) setActive(Math.max(0, Math.min(slides.length - 1, i)));
      }, 60);
    }, { passive: true });
    thumbs.forEach(function (b) { b.addEventListener('click', function () { go(+b.getAttribute('data-lp-thumb')); }); });
    if (prev) prev.addEventListener('click', function () { go(index - 1); });
    if (next) next.addEventListener('click', function () { go(index + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      if (e.key === 'Escape' && zoom.on) setZoom(false);
    });

    // Zoom in place (like Swiper zoom on lemmelive.com: x3, drag to look around)
    function img() { return slides[index] && slides[index].querySelector('img'); }
    function clamp() {
      var el = img(); if (!el) return;
      var w = el.clientWidth, h = el.clientHeight;
      var maxX = (w * (zoom.scale - 1)) / 2, maxY = (h * (zoom.scale - 1)) / 2;
      zoom.x = Math.max(-maxX, Math.min(maxX, zoom.x));
      zoom.y = Math.max(-maxY, Math.min(maxY, zoom.y));
    }
    function apply() {
      var el = img(); if (!el) return;
      el.style.transform = zoom.on ? 'translate3d(' + zoom.x + 'px,' + zoom.y + 'px,0) scale(' + zoom.scale + ')' : '';
    }
    function setZoom(on, cx, cy) {
      slides.forEach(function (s) { var i = s.querySelector('img'); if (i) i.style.transform = ''; });
      zoom.on = on; zoom.x = 0; zoom.y = 0;
      if (on && cx != null) {
        var r = img().getBoundingClientRect();
        zoom.x = -(cx - (r.left + r.width / 2)) * (zoom.scale - 1);
        zoom.y = -(cy - (r.top + r.height / 2)) * (zoom.scale - 1);
        clamp();
      }
      gallery.classList.toggle('is-zoomed', on);
      if (zoomBtn) zoomBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      apply();
    }
    if (zoomBtn) zoomBtn.addEventListener('click', function () { setZoom(!zoom.on); });
    track.addEventListener('dblclick', function (e) { setZoom(!zoom.on, e.clientX, e.clientY); });
    var drag = null;
    track.addEventListener('pointerdown', function (e) {
      if (!zoom.on) return;
      drag = { x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y, id: e.pointerId };
      gallery.classList.add('is-panning');
      track.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    track.addEventListener('pointermove', function (e) {
      if (!drag) return;
      zoom.x = drag.ox + (e.clientX - drag.x);
      zoom.y = drag.oy + (e.clientY - drag.y);
      clamp(); apply();
    });
    function endDrag() { if (!drag) return; drag = null; gallery.classList.remove('is-panning'); }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', function () { if (zoom.on) setZoom(false); });
    setActive(0);
  }

  /* ---------- Horizontal scroller with fades + arrows (tabs) ---------- */
  function initTabsScroller(section) {
    var tabs = $(section, '[data-lp-tabs]');
    if (!once(tabs, 'tabs')) return;
    var sc = $(tabs, '[data-lp-tabs-scroller]');
    var p = $(tabs, '[data-lp-tabs-prev]');
    var n = $(tabs, '[data-lp-tabs-next]');
    function update() {
      var max = sc.scrollWidth - sc.clientWidth;
      var start = sc.scrollLeft > 2, end = sc.scrollLeft < max - 2;
      tabs.classList.toggle('is-fade-start', start);
      tabs.classList.toggle('is-fade-end', end);
      p.hidden = !start; n.hidden = !end;
    }
    sc.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    p.addEventListener('click', function () { sc.scrollBy({ left: -sc.clientWidth * 0.6, behavior: 'smooth' }); });
    n.addEventListener('click', function () { sc.scrollBy({ left: sc.clientWidth * 0.6, behavior: 'smooth' }); });
    update();
  }

  /* ---------- Move fixed UI to <body> (replacing an older copy after a theme editor reload) ---------- */
  function portal(node) {
    if (!node || node.parentNode === document.body) return;
    if (node.id) { var old = document.getElementById(node.id); while (old && old !== node) { old.remove(); old = document.getElementById(node.id); } }
    else if (node.hasAttribute('data-lp-portal')) $all(document.body, ':scope > [data-lp-portal="' + node.getAttribute('data-lp-portal') + '"]').forEach(function (o) { o.remove(); });
    document.body.appendChild(node);
  }

  /* ---------- Side drawer ---------- */
  function Drawer(el, opts) {
    var overlay = el.previousElementSibling && el.previousElementSibling.hasAttribute('data-lp-overlay') ? el.previousElementSibling : null;
    // Move to <body> so no section stacking context can sit on top of the drawer
    portal(overlay); portal(el);
    var title = $(el, '[data-lp-drawer-title]');
    var body = $(el, '[data-lp-drawer-body]');
    var prevBtn = $(el, '[data-lp-drawer-prev]');
    var nextBtn = $(el, '[data-lp-drawer-next]');
    var opener = null;
    var current = -1;
    var api = {};
    function show(i) {
      current = i;
      opts.render(i, { title: title, body: body });
      body.scrollTop = 0;
      if (prevBtn) { prevBtn.hidden = i <= 0; var pl = $(prevBtn, '[data-lp-label]'); if (pl && i > 0) pl.textContent = opts.label(i - 1); }
      if (nextBtn) { nextBtn.hidden = i >= opts.count() - 1; var nl = $(nextBtn, '[data-lp-label]'); if (nl && i < opts.count() - 1) nl.textContent = opts.label(i + 1); }
      if (opts.onShow) opts.onShow(i);
    }
    function onKey(e) {
      if (e.key === 'Escape') { api.close(); return; }
      if (e.key !== 'Tab') return;
      var f = $all(el, 'button:not([hidden]):not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])').filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    api.open = function (i, from) {
      opener = from || document.activeElement;
      show(i);
      el.hidden = false; if (overlay) overlay.hidden = false;
      document.documentElement.classList.add('lp-locked');
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-open'); if (overlay) overlay.classList.add('is-open'); }); });
      document.addEventListener('keydown', onKey);
      setTimeout(function () { var c = $(el, '[data-lp-close]'); if (c) c.focus({ preventScroll: true }); }, 50);
    };
    api.close = function () {
      if (el.hidden) return;
      el.classList.remove('is-open'); if (overlay) overlay.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('lp-locked');
      setTimeout(function () { el.hidden = true; if (overlay) overlay.hidden = true; }, reduceMotion ? 0 : 320);
      if (opts.onClose) opts.onClose();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    };
    $(el, '[data-lp-close]').addEventListener('click', api.close);
    if (overlay) overlay.addEventListener('click', api.close);
    if (prevBtn) prevBtn.addEventListener('click', function () { show(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(current + 1); });
    return api;
  }

  function initDetailsDrawer(section) {
    var el = $(section, '[data-lp-drawer]');
    if (!once(el, 'drawer')) return;
    var tabs = $all(section, '.lp-tab[data-lp-open]');
    var keys = tabs.map(function (b) { return b.getAttribute('data-lp-open'); });
    var titles = tabs.map(function (b) { return b.getAttribute('data-lp-title'); });
    var panels = $all(el, '[data-lp-panel]');
    if (keys.indexOf('awards') === -1 && $(el, '[data-lp-panel="awards"]')) { keys.push('awards'); titles.push('Awards'); }
    var drawer = Drawer(el, {
      count: function () { return keys.length; },
      label: function (i) { return titles[i]; },
      render: function (i, ui) {
        ui.title.textContent = titles[i];
        panels.forEach(function (p) { p.hidden = p.getAttribute('data-lp-panel') !== keys[i]; });
      },
      onShow: function (i) { tabs.forEach(function (b) { b.setAttribute('aria-expanded', b.getAttribute('data-lp-open') === keys[i] ? 'true' : 'false'); }); },
      onClose: function () { tabs.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
    });
    $all(section, '[data-lp-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = keys.indexOf(b.getAttribute('data-lp-open'));
        if (i > -1) drawer.open(i, b);
      });
    });
  }

  /* ---------- Accordions (animated <details>) ---------- */
  function initAccordions(scope) {
    $all(scope, '[data-lp-accordion]').forEach(function (d) {
      if (!once(d, 'acc')) return;
      var summary = $(d, 'summary');
      summary.addEventListener('click', function (e) {
        if (reduceMotion) return;
        e.preventDefault();
        if (d.classList.contains('is-animating')) return;
        var start = d.offsetHeight;
        if (d.open) {
          d.classList.add('is-animating', 'is-closing');
          d.style.height = start + 'px';
          requestAnimationFrame(function () { d.style.height = summary.offsetHeight + (d.offsetHeight - d.clientHeight) + 'px'; });
        } else {
          d.style.height = start + 'px';
          d.open = true;
          var end = d.scrollHeight + (d.offsetHeight - d.clientHeight);
          d.classList.add('is-animating');
          requestAnimationFrame(function () { d.style.height = end + 'px'; });
        }
        var done = function (ev) {
          if (ev && ev.target !== d) return;
          d.removeEventListener('transitionend', done);
          if (d.classList.contains('is-closing')) d.open = false;
          d.classList.remove('is-animating', 'is-closing');
          d.style.height = '';
        };
        d.addEventListener('transitionend', done);
        setTimeout(function () { if (d.classList.contains('is-animating')) done(); }, 700);
      });
    });
  }

  /* ---------- Buying ---------- */
  function initBuy(section) {
    var buy = $(section, '[data-lp-buy]');
    if (!once(buy, 'buy')) return;
    var form = $(buy, '[data-lp-form]');
    var idInput = $(form, '[data-lp-variant]');
    var planInput = $(form, '[data-lp-plan]');
    var submit = $(form, '[data-lp-submit]');
    var label = $(form, '[data-lp-submit-label]');
    var onceBtn = $(form, '[data-lp-once]');
    var oncePrice = $(form, '[data-lp-once-price]');
    var status = $(form, '[data-lp-status]');
    var nameEl = $(buy, '[data-lp-option-name]');
    var radios = $all(buy, 'input[type="radio"]');
    var sticky = $(section, '[data-lp-sticky]');
    var stickyBtn = sticky && $(sticky, '[data-lp-sticky-btn]');
    var stickyLabel = sticky && $(sticky, '[data-lp-sticky-label]');
    var buyOnce = false, fromSticky = false;
    portal(sticky);

    function current() { return radios.filter(function (r) { return r.checked; })[0] || radios[0]; }
    function render() {
      var r = current(); if (!r) return;
      idInput.value = r.value;
      if (planInput) planInput.value = r.getAttribute('data-selling-plan') || '';
      var ok = r.getAttribute('data-available') === 'true';
      var text = ok ? r.getAttribute('data-price') + ' — ' + submit.getAttribute('data-add') : submit.getAttribute('data-sold-out');
      submit.disabled = !ok;
      label.textContent = text;
      if (nameEl) nameEl.textContent = r.getAttribute('data-name');
      if (stickyLabel) { stickyLabel.textContent = text; stickyBtn.disabled = !ok; }
      if (oncePrice) oncePrice.textContent = r.getAttribute('data-once-price');
      if (onceBtn) onceBtn.parentNode.hidden = !ok || !r.getAttribute('data-selling-plan');
      section.dispatchEvent(new CustomEvent('lp:option', { detail: r }));
    }
    radios.forEach(function (r) { r.addEventListener('change', function () { status.textContent = ''; render(); }); });
    render();

    if (onceBtn) onceBtn.addEventListener('click', function () { buyOnce = true; });
    submit.addEventListener('click', function () { buyOnce = false; });
    form.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      var r = current();
      var item = { id: +r.value, quantity: 1 };
      var plan = r.getAttribute('data-selling-plan');
      if (plan && !buyOnce) item.selling_plan = +plan;
      var btn = fromSticky ? stickyBtn : (buyOnce ? onceBtn : submit);
      btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      status.textContent = '';
      addItems([item]).then(function () {
        status.textContent = submit.getAttribute('data-added') + ' ';
        var a = document.createElement('a'); a.href = root + 'cart'; a.textContent = 'View bag'; status.appendChild(a);
        if (fromSticky && stickyLabel) stickyLabel.textContent = submit.getAttribute('data-added');
        return refreshCart('lemme-pdp');
      }).catch(function (err) {
        status.textContent = err.message;
        if (fromSticky && stickyLabel) stickyLabel.textContent = err.message;
      }).then(function () {
        btn.removeAttribute('aria-busy'); btn.disabled = false;
        var wasSticky = fromSticky; buyOnce = false; fromSticky = false;
        setTimeout(render, wasSticky ? 2200 : 0);
      });
    });
    if (stickyBtn) stickyBtn.addEventListener('click', function () {
      if (stickyBtn.disabled) return;
      fromSticky = true;
      if (form.requestSubmit) form.requestSubmit(submit); else submit.click();
    });
  }

  /* ---------- Full routine bundle ---------- */
  function initUpsell(section) {
    var card = $(section, '[data-lp-upsell]');
    if (!once(card, 'upsell')) return;
    var boxes = $all(card, 'input[type="checkbox"]');
    var totalEl = $(card, '[data-lp-upsell-total]');
    var wasEl = $(card, '[data-lp-upsell-was]');
    var optEl = $(card, '[data-lp-upsell-option]');
    var priceEl = $(card, '[data-lp-upsell-price]');
    var priceWas = $(card, '[data-lp-upsell-price-was]');
    var btn = $(card, '[data-lp-upsell-add]');
    var status = $(card, '[data-lp-upsell-status]');
    var radios = $all(section, '[data-lp-buy] input[type="radio"]');
    function selected() { return radios.filter(function (r) { return r.checked; })[0] || radios[0]; }
    function update() {
      var r = selected();
      var main = r ? +r.getAttribute('data-price-cents') : 0;
      var mainWas = r ? Math.max(+r.getAttribute('data-once-cents'), +r.getAttribute('data-compare-cents')) : main;
      var total = main, was = mainWas;
      boxes.forEach(function (b) { if (b.checked) { total += +b.getAttribute('data-price'); was += +b.getAttribute('data-compare'); } });
      totalEl.textContent = money(total);
      wasEl.textContent = money(was); wasEl.hidden = was <= total;
      priceEl.textContent = money(main);
      priceWas.textContent = money(mainWas); priceWas.hidden = mainWas <= main;
      optEl.textContent = r ? r.getAttribute('data-name') : '';
    }
    section.addEventListener('lp:option', update);
    boxes.forEach(function (b) { b.addEventListener('change', update); });
    update();
    btn.addEventListener('click', function () {
      var r = selected(); if (!r) return;
      var items = [{ id: +r.value, quantity: 1 }];
      var plan = r.getAttribute('data-selling-plan'); if (plan) items[0].selling_plan = +plan;
      boxes.forEach(function (b) { if (b.checked) items.push({ id: +b.value, quantity: 1 }); });
      btn.disabled = true; btn.setAttribute('aria-busy', 'true'); status.textContent = '';
      addItems(items).then(function () {
        status.textContent = 'Added ' + items.length + ' items to your bag!';
        return refreshCart('lemme-routine');
      }).catch(function (err) { status.textContent = err.message; })
        .then(function () { btn.disabled = false; btn.removeAttribute('aria-busy'); });
    });
  }

  /* ---------- Sticky page links ---------- */
  function initSubnav() {
    var nav = document.querySelector('[data-lp-subnav]');
    if (!once(nav, 'subnav')) return;
    var list = $(nav, '[data-lp-subnav-list]');
    var sc = $(nav, '[data-lp-subnav-scroller]');
    var next = $(nav, '[data-lp-subnav-next]');
    var targets = $all(document, '[data-lp-nav]').filter(function (s) { return s.id && s.getAttribute('data-lp-nav'); });
    var links = targets.map(function (s) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'lp-subnav__link';
      a.href = '#' + s.id;
      a.textContent = s.getAttribute('data-lp-nav');
      li.appendChild(a); list.appendChild(li);
      return a;
    });
    function setActive(id) { links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + id); }); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
      }, { rootMargin: '-45% 0px -50% 0px' });
      targets.forEach(function (s) { io.observe(s); });
    }
    function upd() { if (next) next.hidden = sc.scrollLeft >= sc.scrollWidth - sc.clientWidth - 2; }
    sc.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    if (next) next.addEventListener('click', function () { sc.scrollBy({ left: sc.clientWidth * 0.6, behavior: 'smooth' }); });
    upd();
  }

  /* ---------- Benefit video ---------- */
  function initVideos(scope) {
    $all(scope, '[data-lp-video-frame]').forEach(function (frame) {
      if (!once(frame, 'video')) return;
      var v = $(frame, 'video'); if (!v) return;
      var play = $(frame, '[data-lp-video-play]');
      var mute = $(frame, '[data-lp-video-mute]');
      v.muted = true; v.playsInline = true;
      if (reduceMotion) { v.pause(); v.removeAttribute('autoplay'); }
      function sync() {
        frame.classList.toggle('is-paused', v.paused);
        frame.classList.toggle('is-unmuted', !v.muted);
        if (play) play.setAttribute('aria-label', v.paused ? 'Play video' : 'Pause video');
        if (mute) mute.setAttribute('aria-label', v.muted ? 'Unmute video' : 'Mute video');
      }
      ['play', 'pause', 'volumechange'].forEach(function (ev) { v.addEventListener(ev, sync); });
      if (play) play.addEventListener('click', function () { if (v.paused) v.play(); else v.pause(); });
      if (mute) mute.addEventListener('click', function () { v.muted = !v.muted; });
      if ('IntersectionObserver' in window && !reduceMotion) {
        new IntersectionObserver(function (en) {
          en.forEach(function (e) { if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); });
        }, { threshold: 0.5 }).observe(v);
      }
      sync();
    });
  }

  /* ---------- Dots for a horizontal scroll track ---------- */
  function dotsFor(track, dotsWrap, itemSel) {
    if (!dotsWrap) return function () {};
    function pages() { return Math.max(1, Math.round(track.scrollWidth / Math.max(1, track.clientWidth))); }
    function build() {
      dotsWrap.innerHTML = '';
      var n = pages();
      if (n < 2 || getComputedStyle(track).overflowX === 'visible') return;
      for (var i = 0; i < n; i++) {
        var b = document.createElement('button');
        b.type = 'button'; b.tabIndex = -1;
        (function (i) { b.addEventListener('click', function () { track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); }); })(i);
        dotsWrap.appendChild(b);
      }
      sync();
    }
    function sync() {
      var bs = dotsWrap.children; if (!bs.length) return;
      var max = track.scrollWidth - track.clientWidth;
      var i = track.scrollLeft >= max - 2 ? bs.length - 1 : Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      for (var k = 0; k < bs.length; k++) bs[k].classList.toggle('is-active', k === i);
    }
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', build);
    build();
    return sync;
  }

  /* ---------- Ingredients ---------- */
  function initIngredients(scope) {
    $all(scope, '[data-lp-ingr]').forEach(function (sec) {
      if (!once(sec, 'ingr')) return;
      var track = $(sec, '[data-lp-ingr-track]');
      dotsFor(track, $(sec, '[data-lp-dots]'));
      var more = $(sec, '[data-lp-ingr-more]');
      if (more) more.addEventListener('click', function () { sec.classList.add('is-expanded'); });
      var items = $all(sec, '.lp-ingr__item');
      var el = $(sec, '[data-lp-drawer]');
      var drawer = Drawer(el, {
        count: function () { return items.length; },
        label: function () { return ''; },
        render: function (i, ui) {
          ui.title.innerHTML = $(items[i], '.lp-ingr__title').innerHTML;
          ui.body.innerHTML = '';
          ui.body.appendChild($(items[i], 'template[data-lp-ingr-detail]').content.cloneNode(true));
        }
      });
      $all(sec, '[data-lp-ingr-open]').forEach(function (b) {
        b.addEventListener('click', function () { drawer.open(+b.getAttribute('data-lp-ingr-open'), b); });
      });
    });
  }

  /* ---------- Product cards row ---------- */
  function initCards(scope) {
    $all(scope, '[data-lp-cards]').forEach(function (sec) {
      if (!once(sec, 'cards')) return;
      var url = sec.getAttribute('data-lp-recs-url');
      if (!$(sec, '.lp-cards__slide') && url && window.fetch) {
        fetch(url).then(function (r) { return r.text(); }).then(function (html) {
          var fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-lp-cards]');
          if (!fresh || !fresh.querySelector('.lp-cards__slide')) return;
          sec.innerHTML = fresh.innerHTML;
          sec.__lpcards = false;
          sec.removeAttribute('data-lp-recs-url');
          initCards(sec.parentNode);
        }).catch(function () {});
        return;
      }
      var track = $(sec, '[data-lp-cards-track]'); if (!track) return;
      var prev = $(sec, '[data-lp-cards-prev]');
      var next = $(sec, '[data-lp-cards-next]');
      var syncDots = dotsFor(track, $(sec, '[data-lp-dots]'));
      function upd() {
        var max = track.scrollWidth - track.clientWidth;
        if (prev) prev.hidden = track.scrollLeft <= 2;
        if (next) next.hidden = track.scrollLeft >= max - 2;
      }
      function step() { var s = track.querySelector('.lp-cards__slide'); return s ? s.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth; }
      if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
      if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
      track.addEventListener('scroll', upd, { passive: true });
      window.addEventListener('resize', upd);
      upd(); syncDots();
      $all(sec, '[data-lp-card-add]').forEach(function (b) {
        b.addEventListener('click', function () {
          var lbl = $(b, '.lp-card__add-label'), old = lbl.textContent;
          b.disabled = true; b.setAttribute('aria-busy', 'true');
          addItems([{ id: +b.getAttribute('data-lp-card-add'), quantity: 1 }]).then(function () {
            lbl.textContent = 'Added!';
            return refreshCart('lemme-card');
          }).catch(function (err) { lbl.textContent = 'Error'; b.title = err.message; })
            .then(function () { b.removeAttribute('aria-busy'); setTimeout(function () { lbl.textContent = old; b.disabled = false; }, 1800); });
        });
      });
    });
  }

  function init(scope) {
    scope = scope || document;
    $all(scope, '[data-lp-main]').forEach(function (section) {
      initGallery(section);
      initTabsScroller(section);
      initDetailsDrawer(section);
      initBuy(section);
      initUpsell(section);
    });
    initAccordions(scope);
    initVideos(scope);
    initIngredients(scope);
    initCards(scope);
    initSubnav();
  }

  window.LemmePdp = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
