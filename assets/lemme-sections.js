/* Lemme homepage sections: logo marquee pause button and the tabbed carousel. */
(function () {
  if (window.LemmeSections) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $all(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

  function initLogos(root) {
    $all(root, '[data-ls-logos]').forEach(function (sec) {
      if (sec.__ls) return; sec.__ls = true;
      var btn = sec.querySelector('[data-ls-logos-toggle]');
      if (reduceMotion) { sec.classList.add('is-paused'); }
      function sync() {
        var paused = sec.classList.contains('is-paused');
        btn.setAttribute('aria-label', paused ? 'Play logos' : 'Pause logos');
      }
      btn.addEventListener('click', function () {
        var paused = sec.classList.toggle('is-paused');
        sec.classList.toggle('is-playing', !paused);
        sync();
      });
      sync();
    });
  }

  function initCarousel(media) {
    if (media.__ls) return; media.__ls = true;
    var track = media.querySelector('[data-ls-track]');
    var slides = $all(media, '[data-ls-slide]');
    var prev = media.querySelector('[data-ls-prev]');
    var next = media.querySelector('[data-ls-next]');
    var thumbs = $all(media, '[data-ls-thumb]');
    var dotsWrap = media.querySelector('[data-ls-dots]');
    var dots = [];
    var index = 0;
    if (dotsWrap && slides.length > 1) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.tabIndex = -1;
        b.addEventListener('click', function () { go(i); });
        dotsWrap.appendChild(b); dots.push(b);
      });
    }
    function set(i) {
      index = i;
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= slides.length - 1;
      thumbs.forEach(function (t, n) { t.classList.toggle('is-active', n === i); });
      dots.forEach(function (d, n) { d.classList.toggle('is-active', n === i); });
    }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
      set(i);
    }
    var t;
    track.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var w = slides[0] ? slides[0].offsetWidth : track.clientWidth;
        var i = Math.round(track.scrollLeft / Math.max(1, w));
        if (i !== index) set(Math.max(0, Math.min(slides.length - 1, i)));
      }, 60);
    }, { passive: true });
    if (prev) prev.addEventListener('click', function () { go(index - 1); });
    if (next) next.addEventListener('click', function () { go(index + 1); });
    thumbs.forEach(function (b) { b.addEventListener('click', function () { go(+b.getAttribute('data-ls-thumb')); }); });
    set(0);
  }

  function initTabs(root) {
    $all(root, '[data-ls-tabs]').forEach(function (sec) {
      if (sec.__ls) return; sec.__ls = true;
      var tabs = $all(sec, '[data-ls-tab]');
      var panels = $all(sec, '[data-ls-panel]');
      function select(i, focus) {
        tabs.forEach(function (t, n) {
          var on = n === i;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
        });
        panels.forEach(function (p, n) { p.hidden = n !== i; });
        if (focus) tabs[i].focus();
        var media = panels[i] && panels[i].querySelector('[data-ls-carousel]');
        if (media) initCarousel(media);
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(i); });
        t.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
        });
      });
      select(0);
    });
  }

  function init(root) { root = root || document; initLogos(root); initTabs(root); }
  window.LemmeSections = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  document.addEventListener('shopify:block:select', function (e) {
    var tab = e.target.closest && e.target.closest('[data-ls-tab]');
    if (tab) tab.click();
  });
})();
