(function () {
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  function typeset(el) {
    if (el.dataset.typeset) return;
    el.dataset.typeset = '1';
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]);
  }
  function show(panel) { panel.hidden = false; typeset(panel); }

  /* Click toggles a panel and pins it open. */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('.pub-toggle');
    if (!b) return;
    var panel = document.getElementById(b.dataset.target);
    if (!panel) return;
    var card = b.closest('.pub');
    if (panel.hidden) { show(panel); } else { panel.hidden = true; }
    b.classList.toggle('is-open', !panel.hidden);
    if (b.classList.contains('pub-pin') && card) {
      card.classList.toggle('is-pinned', !panel.hidden);
    }
  });

  /* Hover reveals the abstract in place, after a beat so passing over does nothing.
     The card grows downward, so its top edge never moves and the pointer cannot
     slip out of the element it just opened. */
  if (canHover) {
    var timer = null, openCard = null;
    function close(card) {
      if (!card || card.classList.contains('is-pinned')) return;
      var a = card.querySelector('.pub-abstract');
      if (a) a.hidden = true;
      var btn = card.querySelector('.pub-pin');
      if (btn) btn.classList.remove('is-open');
    }
    document.addEventListener('mouseover', function (ev) {
      var card = ev.target.closest('.pub');
      if (!card || card === openCard) return;
      clearTimeout(timer);
      var prev = openCard;
      timer = setTimeout(function () {
        var a = card.querySelector('.pub-abstract');
        if (!a) return;
        if (prev && prev !== card) close(prev);
        show(a);
        var btn = card.querySelector('.pub-pin');
        if (btn) btn.classList.add('is-open');
        openCard = card;
      }, 190);
    });
    document.addEventListener('mouseout', function (ev) {
      var card = ev.target.closest('.pub');
      if (!card) return;
      if (ev.relatedTarget && card.contains(ev.relatedTarget)) return;
      clearTimeout(timer);
      close(card);
      if (openCard === card) openCard = null;
    });
  }

  /* Program drawers on the home page. */
  document.addEventListener('click', function (ev) {
    var bar = ev.target.closest('.prog-bar');
    if (!bar) return;
    var drawer = document.getElementById(bar.getAttribute('aria-controls'));
    if (!drawer) return;
    var open = drawer.hidden;
    drawer.hidden = !open;
    bar.setAttribute('aria-expanded', String(open));
    bar.querySelector('.prog-bar-hint').textContent = open ? 'hide' : 'show';
    if (open) markYears(drawer);
  });

  /* Show a year only on the first visible card of its run, like the CV. */
  function markYears(root) {
    (root || document).querySelectorAll('.pub-list').forEach(function (list) {
      var last = null;
      list.querySelectorAll('.pub').forEach(function (card) {
        if (card.hidden) { card.classList.remove('is-year-first'); return; }
        var y = card.dataset.year || '';
        card.classList.toggle('is-year-first', y !== last);
        last = y;
      });
    });
  }
  markYears();

  var box = document.getElementById('pubsearch');
  if (!box) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.pub'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.program'));
  function apply() {
    var terms = box.value.toLowerCase().split(/\s+/).filter(Boolean);
    cards.forEach(function (c) {
      var hay = c.dataset.search;
      c.hidden = !terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
    sections.forEach(function (s) {
      s.hidden = !s.querySelector('.pub:not([hidden])');
      var tail = s.querySelector('.prog-tail');
      if (tail) {
        var after = false, any = false;
        s.querySelectorAll('.pub, .prog-tail').forEach(function (n) {
          if (n === tail) { after = true; return; }
          if (after && !n.hidden) any = true;
        });
        tail.hidden = !any;
      }
    });
    markYears();
  }
  box.addEventListener('input', apply);
})();
