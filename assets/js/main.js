/* =========================================================
   Ember & Bun — template behaviour
   Vanilla JS, no dependencies. Everything degrades gracefully
   if JavaScript is disabled: the full menu stays visible and
   the form falls back to native browser validation.
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile navigation ---------- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('primaryNav');

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) closeNav();
    });
  }

  /* ---------- Sticky header shadow ---------- */
  var header = document.querySelector('.header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Menu category filter ---------- */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-filter]'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('#menuGrid .card'));
  var counter = document.getElementById('menuCount');

  function labelFor(filter) {
    var chip = chips.filter(function (c) { return c.dataset.filter === filter; })[0];
    return chip ? chip.textContent.trim() : 'items';
  }

  function applyFilter(filter) {
    var shown = 0;

    cards.forEach(function (card) {
      var match = filter === 'all' || card.dataset.category === filter;
      card.hidden = !match;
      if (match) shown++;
    });

    chips.forEach(function (chip) {
      var active = chip.dataset.filter === filter;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    if (counter) {
      counter.textContent = filter === 'all'
        ? 'Showing all ' + shown + ' dishes'
        : 'Showing ' + shown + ' in ' + labelFor(filter);
    }
  }

  if (chips.length && cards.length) {
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        applyFilter(chip.dataset.filter);
      });

      // Arrow-key navigation across the filter toolbar.
      chip.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var i = chips.indexOf(chip);
        var next = e.key === 'ArrowRight'
          ? (i + 1) % chips.length
          : (i - 1 + chips.length) % chips.length;
        chips[next].focus();
        chips[next].click();
      });
    });

    applyFilter('all');
  }

  /* ---------- Highlight the section you're reading ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var sections = links
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealables = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealables.forEach(function (el) { revealer.observe(el); });
  }

  /* ---------- Reservation form ---------- */
  var form = document.getElementById('reserveForm');
  var status = document.getElementById('formStatus');

  function setError(field, message) {
    var slot = form.querySelector('[data-error-for="' + field.name + '"]');
    if (slot) slot.textContent = message || '';
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate(field) {
    var value = field.value.trim();

    if (!value) return 'This field is required.';
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      return 'Enter a valid email address.';
    }
    if (field.type === 'date') {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(value + 'T00:00:00') < today) return 'Pick today or a future date.';
    }
    return '';
  }

  if (form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll('input[required]'));

    // Bookings open from today onwards.
    var dateField = form.querySelector('#date');
    if (dateField) dateField.min = new Date().toISOString().slice(0, 10);

    fields.forEach(function (field) {
      field.addEventListener('blur', function () { setError(field, validate(field)); });
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') setError(field, validate(field));
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstInvalid = null;
      fields.forEach(function (field) {
        var message = validate(field);
        setError(field, message);
        if (message && !firstInvalid) firstInvalid = field;
      });

      if (firstInvalid) {
        status.textContent = 'Please fix the highlighted fields.';
        status.className = 'form__status is-err';
        firstInvalid.focus();
        return;
      }

      // ---------------------------------------------------------------
      // Demo only: no request is sent. Replace this block with a POST to
      // your booking provider, e.g.
      //   fetch('/api/reservations', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(Object.fromEntries(new FormData(form)))
      //   })
      // ---------------------------------------------------------------
      var data = new FormData(form);
      status.textContent = 'Thanks, ' + data.get('name').split(' ')[0] +
        ' — we’ll confirm your table for ' + data.get('guests') + ' by email.';
      status.className = 'form__status is-ok';
      form.reset();
      fields.forEach(function (field) { setError(field, ''); });
    });
  }

  /* ---------- Newsletter sign-up ---------- */
  var subForm = document.getElementById('subscribeForm');
  var subStatus = document.getElementById('subStatus');

  if (subForm) {
    subForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = subForm.querySelector('input[type="email"]').value.trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        subStatus.textContent = 'Enter a valid email address.';
        subStatus.className = 'form__status is-err';
        return;
      }

      subStatus.textContent = 'You’re on the list. See you soon.';
      subStatus.className = 'form__status is-ok';
      subForm.reset();
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
