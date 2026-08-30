/* =========================================================
   برجر الجمر / Ember & Bun — template behaviour
   Vanilla JS, no dependencies, shared by the Arabic (RTL) and
   English (LTR) pages.

   No user-facing text lives in this file. Every message is read
   from a data-* attribute on the relevant element, so translating
   the site never means editing JavaScript.

   Everything degrades gracefully without JS: the full menu stays
   visible and the forms fall back to native browser validation.
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Read a message template from an element, with an English fallback. */
  function msg(el, name, fallback) {
    var value = el && el.getAttribute('data-msg-' + name);
    return value || fallback;
  }

  /** Fill {placeholders} in a message template. */
  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
    });
  }

  /**
   * Fold Arabic spelling variants so search matches how people actually
   * type: strips diacritics and tatweel, and unifies alef/yaa/taa-marbuta.
   * Latin text just gets lower-cased.
   */
  function normalize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ئ/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

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

  /* ---------- Sticky header & menu toolbar ---------- */
  var header = document.querySelector('.header');
  var toolbar = document.querySelector('.menu-toolbar');

  if (header || toolbar) {
    var onScroll = function () {
      if (header) header.classList.toggle('is-stuck', window.scrollY > 8);
      if (toolbar) {
        var top = toolbar.getBoundingClientRect().top;
        toolbar.classList.toggle('is-stuck', top <= header.offsetHeight + 1);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Menu: category filter + search ---------- */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-filter]'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('#menuGrid .card'));
  var counter = document.getElementById('menuCount');
  var empty = document.getElementById('menuEmpty');
  var searchWrap = document.querySelector('.search');
  var search = document.getElementById('menuSearch');
  var clearBtn = document.getElementById('menuSearchClear');

  var state = { category: 'all', query: '' };

  function labelFor(filter) {
    var chip = chips.filter(function (c) { return c.dataset.filter === filter; })[0];
    return chip ? chip.textContent.trim() : '';
  }

  function report(shown) {
    if (!counter) return;

    var text;
    if (state.query) {
      text = fill(msg(counter, 'search', '{n} results for “{q}”'), { n: shown, q: search.value.trim() });
    } else if (state.category !== 'all') {
      text = fill(msg(counter, 'category', 'Showing {n} in {category}'), { n: shown, category: labelFor(state.category) });
    } else {
      text = fill(msg(counter, 'all', 'Showing all {n} dishes'), { n: shown });
    }
    counter.textContent = text;
  }

  function apply() {
    var shown = 0;

    cards.forEach(function (card) {
      var byCategory = state.category === 'all' || card.dataset.category === state.category;
      var byQuery = !state.query || card.dataset.search.indexOf(state.query) !== -1;
      var match = byCategory && byQuery;

      card.hidden = !match;
      if (match) shown++;
    });

    chips.forEach(function (chip) {
      var active = chip.dataset.filter === state.category;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    if (empty) empty.hidden = shown > 0;
    if (searchWrap) searchWrap.classList.toggle('has-value', !!state.query);

    report(shown);
  }

  if (cards.length) {
    // Index each card once: title, description and tags are all searchable.
    cards.forEach(function (card) {
      card.dataset.search = normalize(card.textContent);
    });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.category = chip.dataset.filter;
        apply();
      });

      // Arrow-key navigation across the filter toolbar.
      chip.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();

        // In RTL the visual direction of the arrows is mirrored.
        var rtl = getComputedStyle(document.documentElement).direction === 'rtl';
        var forward = (e.key === 'ArrowRight') !== rtl;
        var i = chips.indexOf(chip);
        var next = forward ? (i + 1) % chips.length : (i - 1 + chips.length) % chips.length;

        chips[next].focus();
        chips[next].click();
      });
    });

    if (search) {
      search.addEventListener('input', function () {
        state.query = normalize(search.value);
        apply();
      });

      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && search.value) {
          e.stopPropagation();
          search.value = '';
          state.query = '';
          apply();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        search.value = '';
        state.query = '';
        apply();
        search.focus();
      });
    }

    apply();
  }

  /* ---------- Highlight the section you're reading ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var sections = links
    .map(function (link) {
      var href = link.getAttribute('href');
      return href && href.charAt(0) === '#' ? document.querySelector(href) : null;
    })
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

    if (!value) return msg(form, 'required', 'This field is required.');
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      return msg(form, 'email', 'Enter a valid email address.');
    }
    if (field.type === 'date') {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(value + 'T00:00:00') < today) return msg(form, 'past', 'Pick today or a future date.');
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
        status.textContent = msg(form, 'fix', 'Please fix the highlighted fields.');
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
      status.textContent = fill(msg(form, 'success', 'Thanks {name} — we’ll confirm your table for {guests} by email.'), {
        name: String(data.get('name')).trim().split(/\s+/)[0],
        guests: data.get('guests')
      });
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
        subStatus.textContent = msg(subForm, 'email', 'Enter a valid email address.');
        subStatus.className = 'form__status is-err';
        return;
      }

      subStatus.textContent = msg(subForm, 'success', 'You’re on the list. See you soon.');
      subStatus.className = 'form__status is-ok';
      subForm.reset();
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
