/*
 * Lemme homepage interactions
 * Recreates the motion of lemmelive.com without jQuery/GSAP:
 *  - magnetic pill buttons with sliding black "filler" (desktop)
 *  - simple filler hover for non-magnetic buttons
 *  - endless marquees (promo bar, squiggles, ticker) that always fill the screen
 *  - Swiper carousels (press logos, product grid on mobile/tablet)
 *  - hero fade slideshow
 *  - "what we leave out" strike-through when scrolled into view
 *  - mega menu + mobile drawer + accordions
 * Every component re-initialises inside the Shopify theme editor.
 */
(function () {
  'use strict';
  if (window.LemmeHome) return;

  var DESKTOP = window.matchMedia('(min-width: 1025px) and (hover: hover)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE_OUT = 'cubic-bezier(.215,.61,.355,1)'; // ~ Power3.easeOut

  function $all(root, sel) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function lerp(a, b, n) { return (1 - n) * a + n * b; }

  /* ---------------------------------------------------------------- Swiper loader */
  var swiperPromise = null;
  function loadSwiper(src) {
    if (window.Swiper) return Promise.resolve(window.Swiper);
    if (swiperPromise) return swiperPromise;
    swiperPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(window.Swiper); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return swiperPromise;
  }

  /* ---------------------------------------------------------------- Buttons */
  var mouse = { x: -9999, y: -9999 };
  window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  function flipText(inner, outY, inY) {
    if (!inner || !inner.animate) return;
    inner.getAnimations().forEach(function (a) { a.cancel(); });
    inner.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(' + outY + ')' }], { duration: 100, easing: EASE_OUT, fill: 'forwards' });
    inner.animate([{ opacity: 1, transform: 'translateY(' + inY + ')' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 250, delay: 100, easing: EASE_OUT, fill: 'forwards' });
  }
  function moveFiller(filler, from, to, duration) {
    if (!filler || !filler.animate) return;
    filler.getAnimations().forEach(function (a) { a.cancel(); });
    var kf = from === null ? [{ transform: 'translate3d(0,' + to + ',0)' }] : [{ transform: 'translate3d(0,' + from + ',0)' }, { transform: 'translate3d(0,' + to + ',0)' }];
    filler.animate(kf, { duration: duration, easing: EASE_OUT, fill: 'forwards' });
  }

  function MagneticButton(el) {
    this.el = el;
    this.text = el.querySelector('.lm-btn__text');
    this.inner = el.querySelector('.lm-btn__text-inner');
    this.filler = el.querySelector('.lm-btn__filler');
    this.tx = 0; this.ty = 0; this.hover = false;
    this.movement = el.classList.contains('lm-btn--full') ? 0.2 : 0.7;
  }
  MagneticButton.prototype.measure = function () {
    var r = this.el.getBoundingClientRect();
    // remove current translation so we measure the resting position
    this.cx = r.left + r.width / 2 - this.tx;
    this.cy = r.top + r.height / 2 - this.ty;
    this.trigger = r.width * this.movement;
  };
  MagneticButton.prototype.enter = function () {
    this.hover = true;
    this.el.classList.add('is-hovered');
    moveFiller(this.filler, '75%', '0%', 500);
    flipText(this.inner, '-10%', '30%');
  };
  MagneticButton.prototype.leave = function () {
    this.hover = false;
    this.el.classList.remove('is-hovered');
    moveFiller(this.filler, null, '-75%', 400);
    flipText(this.inner, '10%', '-30%');
  };
  MagneticButton.prototype.tick = function () {
    this.measure();
    var dx = mouse.x - this.cx, dy = mouse.y - this.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var x = 0, y = 0;
    if (dist < this.trigger) {
      if (!this.hover) this.enter();
      x = dx * 0.2; y = dy * 0.2;
    } else if (this.hover) {
      this.leave();
    }
    this.tx = lerp(this.tx, x, 0.1);
    this.ty = lerp(this.ty, y, 0.1);
    if (Math.abs(this.tx) < 0.01) this.tx = 0;
    if (Math.abs(this.ty) < 0.01) this.ty = 0;
    this.el.style.transform = 'translate3d(' + this.tx.toFixed(2) + 'px,' + this.ty.toFixed(2) + 'px,0)';
    if (this.text) this.text.style.transform = 'translate3d(' + (-0.6 * this.tx).toFixed(2) + 'px,' + (-0.6 * this.ty).toFixed(2) + 'px,0)';
  };
  MagneticButton.prototype.reset = function () {
    this.el.style.transform = ''; if (this.text) this.text.style.transform = '';
    this.el.classList.remove('is-hovered'); this.hover = false; this.tx = this.ty = 0;
  };

  var magnets = [];
  var visibleMagnets = new Set();
  var rafId = null;
  var magnetObserver = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var m = entry.target.__lmMagnet;
      if (!m) return;
      if (entry.isIntersecting) visibleMagnets.add(m); else { visibleMagnets.delete(m); m.reset(); }
    });
    startLoop();
  }) : null;

  function loop() {
    rafId = null;
    if (!DESKTOP.matches || REDUCED.matches || !visibleMagnets.size) return;
    visibleMagnets.forEach(function (m) { m.tick(); });
    rafId = requestAnimationFrame(loop);
  }
  function startLoop() { if (!rafId && visibleMagnets.size && DESKTOP.matches) rafId = requestAnimationFrame(loop); }

  function initButtons(root) {
    $all(root, '[data-lm-magnetic]').forEach(function (el) {
      if (el.__lmMagnet) return;
      var m = new MagneticButton(el);
      el.__lmMagnet = m;
      magnets.push(m);
      if (magnetObserver) magnetObserver.observe(el);
    });
    $all(root, '[data-lm-button]').forEach(function (el) {
      if (el.__lmButton) return;
      el.__lmButton = true;
      var filler = el.querySelector('.lm-btn__filler');
      el.addEventListener('mouseenter', function () {
        if (!DESKTOP.matches) return;
        el.classList.add('is-hovered');
        moveFiller(filler, '75%', '10%', 200);
      });
      el.addEventListener('mouseleave', function () {
        if (!DESKTOP.matches) return;
        el.classList.remove('is-hovered');
        moveFiller(filler, null, '-75%', 200);
      });
    });
  }
  DESKTOP.addEventListener && DESKTOP.addEventListener('change', function () {
    if (!DESKTOP.matches) magnets.forEach(function (m) { m.reset(); });
    startLoop();
  });

  /* ---------------------------------------------------------------- Marquees */
  function fillMarquee(marquee) {
    var track = marquee.querySelector('.lm-marquee__track');
    if (!track) return;
    var originals = $all(track, '.lm-marquee__item:not([data-clone])');
    if (!originals.length) return;
    $all(track, '[data-clone]').forEach(function (c) { c.remove(); });
    var needed = window.innerWidth * 2;
    var guard = 0;
    while (track.scrollWidth < needed && guard < 40) {
      originals.forEach(function (item) {
        var clone = item.cloneNode(true);
        clone.setAttribute('data-clone', '');
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      });
      guard++;
    }
  }
  function initMarquees(root) {
    $all(root, '[data-lm-marquee]').forEach(function (m) {
      fillMarquee(m);
      var toggle = m.parentElement && m.parentElement.querySelector('[data-lm-marquee-toggle]');
      if (toggle && !toggle.__lm) {
        toggle.__lm = true;
        toggle.addEventListener('click', function () {
          var paused = m.classList.toggle('is-paused');
          toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
        });
      }
    });
  }
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { initMarquees(document); }, 200);
  });

  /* ---------------------------------------------------------------- Carousels */
  function initPress(root) {
    $all(root, '[data-lm-press]').forEach(function (el) {
      if (el.__swiper) return;
      var container = el.querySelector('.swiper');
      loadSwiper(el.getAttribute('data-swiper-src')).then(function (Swiper) {
        if (el.__swiper) return;
        var autoplay = parseInt(el.getAttribute('data-autoplay') || '4000', 10);
        el.__swiper = new Swiper(container, {
          slidesPerView: 1,
          spaceBetween: 48,
          loop: true,
          speed: 500,
          grabCursor: true,
          autoplay: autoplay > 0 ? { delay: autoplay, disableOnInteraction: false } : false,
          pagination: { el: el.querySelector('.lm-press__pagination'), clickable: true },
          breakpoints: {
            550: { slidesPerView: 2, spaceBetween: 24 },
            750: { slidesPerView: 3, spaceBetween: 48 },
            1025: { slidesPerView: 5, spaceBetween: 48 }
          },
          a11y: { enabled: true }
        });
      });
    });
  }

  function initProducts(root) {
    $all(root, '[data-lm-products]').forEach(function (el) {
      if (el.__swiper) return;
      var container = el.querySelector('.swiper');
      loadSwiper(el.getAttribute('data-swiper-src')).then(function (Swiper) {
        if (el.__swiper) return;
        el.__swiper = new Swiper(container, {
          slidesPerView: 1,
          spaceBetween: 0,
          loop: el.querySelectorAll('.swiper-slide').length > 2,
          speed: 500,
          navigation: { nextEl: el.querySelector('.lm-products__nav--next'), prevEl: el.querySelector('.lm-products__nav--prev') },
          pagination: { el: el.querySelector('.lm-products__pagination'), clickable: true },
          breakpoints: {
            750: { slidesPerView: 2, spaceBetween: 24 },
            1025: { slidesPerView: 4, spaceBetween: 20, allowTouchMove: false, loop: false }
          }
        });
      });
    });
  }

  /* ---------------------------------------------------------------- Hero slideshow */
  function initHero(root) {
    $all(root, '[data-lm-hero]').forEach(function (el) {
      if (el.__lmHero) return;
      var slides = $all(el, '.lm-hero__slide');
      if (slides.length < 2) { el.__lmHero = true; return; }
      var dots = $all(el, '.lm-hero__dots button');
      var index = 0, timer = null;
      var delay = parseInt(el.getAttribute('data-autoplay') || '0', 10);
      function go(i) {
        index = (i + slides.length) % slides.length;
        slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); s.setAttribute('aria-hidden', n === index ? 'false' : 'true'); });
        dots.forEach(function (d, n) { d.setAttribute('aria-current', n === index ? 'true' : 'false'); });
      }
      function play() { if (delay > 0 && !REDUCED.matches) { stop(); timer = setInterval(function () { go(index + 1); }, delay); } }
      function stop() { if (timer) clearInterval(timer); timer = null; }
      dots.forEach(function (d, n) { d.addEventListener('click', function () { go(n); play(); }); });
      el.addEventListener('mouseenter', stop);
      el.addEventListener('mouseleave', play);
      go(0); play();
      el.__lmHero = { stop: stop };
    });
  }

  /* ---------------------------------------------------------------- "What we leave out" */
  function initNoList(root) {
    $all(root, '[data-lm-nolist]').forEach(function (el) {
      if (el.__lmObs || !('IntersectionObserver' in window)) { if (!el.__lmObs) el.classList.add('is-in-view'); return; }
      el.__lmObs = new IntersectionObserver(function (entries) {
        el.classList.toggle('is-in-view', entries[0].isIntersecting);
      }, { threshold: [0, 1] });
      el.__lmObs.observe(el.querySelector('[data-lm-nolist-target]') || el);
    });
  }

  /* ---------------------------------------------------------------- Header */
  function initHeader(root) {
    $all(root, '[data-lm-header]').forEach(function (header) {
      if (header.__lm) return;
      header.__lm = true;
      var toggle = header.querySelector('[data-lm-mega-toggle]');
      var mega = header.querySelector('[data-lm-mega]');
      var closeTimer = null;

      function openMega() {
        if (!mega) return;
        clearTimeout(closeTimer);
        mega.classList.add('is-open');
        toggle && toggle.setAttribute('aria-expanded', 'true');
      }
      function closeMega(delay) {
        if (!mega) return;
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function () {
          mega.classList.remove('is-open');
          toggle && toggle.setAttribute('aria-expanded', 'false');
        }, delay || 0);
      }
      if (toggle && mega) {
        toggle.addEventListener('mouseenter', function () { if (DESKTOP.matches) openMega(); });
        toggle.addEventListener('click', function (e) {
          e.preventDefault();
          if (mega.classList.contains('is-open')) closeMega(); else openMega();
        });
        toggle.addEventListener('mouseleave', function () { if (DESKTOP.matches) closeMega(250); });
        mega.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });
        var overlay = header.querySelector('[data-lm-mega-overlay]');
        if (overlay) overlay.addEventListener('click', function () { closeMega(); });
        mega.addEventListener('mouseleave', function () { if (DESKTOP.matches) closeMega(150); });
        header.querySelectorAll('.lm-header__bar a, .lm-header__bar button').forEach(function (a) {
          if (a !== toggle) a.addEventListener('mouseenter', function () { if (DESKTOP.matches) closeMega(120); });
        });
      }

      var menuBtn = header.querySelector('[data-lm-drawer-toggle]');
      var drawer = header.querySelector('[data-lm-drawer]');
      function setDrawer(open) {
        if (!drawer) return;
        drawer.classList.toggle('is-open', open);
        menuBtn && menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('lm-no-scroll', open);
        if (open) { var first = drawer.querySelector('a, button'); first && first.focus({ preventScroll: true }); }
      }
      if (menuBtn && drawer) {
        menuBtn.addEventListener('click', function () { setDrawer(!drawer.classList.contains('is-open')); });
      }

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (mega && mega.classList.contains('is-open')) { closeMega(); toggle && toggle.focus(); }
        if (drawer && drawer.classList.contains('is-open')) { setDrawer(false); menuBtn && menuBtn.focus(); }
      });
      window.addEventListener('resize', function () { if (window.innerWidth >= 1025) setDrawer(false); else closeMega(); });
    });

    $all(root, '[data-lm-accordion]').forEach(function (btn) {
      if (btn.__lm) return;
      btn.__lm = true;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    });
  }

  /* ---------------------------------------------------------------- Scrollbar offset
   * Horizon makes .page-wrapper the scroll container on desktop, so its scrollbar sits under the
   * fixed header. Measure it and expose --lm-scrollbar-width so the header stops before it. */
  function measureScrollbar() {
    var pw = document.querySelector('.page-wrapper');
    var w = 0;
    if (pw && getComputedStyle(pw).overflowY !== 'visible') w = pw.offsetWidth - pw.clientWidth;
    document.documentElement.style.setProperty('--lm-scrollbar-width', Math.max(0, w) + 'px');
  }
  window.addEventListener('resize', measureScrollbar);

  /* ---------------------------------------------------------------- Boot */
  function init(root) {
    root = root || document;
    measureScrollbar();
    initButtons(root);
    initMarquees(root);
    initPress(root);
    initProducts(root);
    initHero(root);
    initNoList(root);
    initHeader(root);
  }

  function teardown(root) {
    $all(root, '[data-lm-press], [data-lm-products]').forEach(function (el) {
      if (el.__swiper && el.__swiper.destroy) el.__swiper.destroy(true, true);
      el.__swiper = null;
    });
    $all(root, '[data-lm-hero]').forEach(function (el) { if (el.__lmHero && el.__lmHero.stop) el.__lmHero.stop(); el.__lmHero = null; });
    $all(root, '[data-lm-nolist]').forEach(function (el) { if (el.__lmObs) el.__lmObs.disconnect(); el.__lmObs = null; });
    $all(root, '[data-lm-magnetic]').forEach(function (el) {
      var m = el.__lmMagnet; if (!m) return;
      visibleMagnets.delete(m); if (magnetObserver) magnetObserver.unobserve(el);
      magnets = magnets.filter(function (x) { return x !== m; }); el.__lmMagnet = null;
    });
    document.body.classList.remove('lm-no-scroll');
  }

  window.LemmeHome = { init: init, teardown: teardown };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);

  // Theme editor support
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  document.addEventListener('shopify:section:unload', function (e) { teardown(e.target); });
  document.addEventListener('shopify:block:select', function (e) {
    var slide = e.target.closest && e.target.closest('.swiper-slide');
    var host = e.target.closest && e.target.closest('[data-lm-press], [data-lm-products]');
    if (slide && host && host.__swiper) {
      var idx = parseInt(slide.getAttribute('data-swiper-slide-index') || Array.prototype.indexOf.call(slide.parentNode.children, slide), 10);
      host.__swiper.autoplay && host.__swiper.autoplay.stop();
      host.__swiper.slideToLoop ? host.__swiper.slideToLoop(idx) : host.__swiper.slideTo(idx);
    }
    var mega = e.target.closest && e.target.closest('[data-lm-mega]');
    if (mega) mega.classList.add('is-open');
  });
  document.addEventListener('shopify:block:deselect', function (e) {
    var host = e.target.closest && e.target.closest('[data-lm-press]');
    if (host && host.__swiper && host.__swiper.autoplay) host.__swiper.autoplay.start();
  });
})();
