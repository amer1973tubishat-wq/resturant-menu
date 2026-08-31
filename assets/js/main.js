/* =========================================================
   شيف هاشم — Chef Hashem
   Public site behaviour. Vanilla JS, no dependencies.

   The menu is rendered from window.MENU_DATA (assets/data/menu.js).
   If the dashboard (admin.html) has saved edits in this browser,
   those are used instead and a "local preview" flag is shown.

   No user-facing text lives in this file: messages come from
   data-msg-* attributes in the markup, so translating the site
   never means editing JavaScript.
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'chefhashem.menu';
  var IMG_BASE = 'assets/img/';

  /* ---------- Data ---------- */
  var data = window.MENU_DATA || { restaurant: {}, categories: [], items: [] };
  var usingLocal = false;

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed && parsed.items && parsed.categories && parsed.restaurant) {
        data = parsed;
        usingLocal = true;
      }
    }
  } catch (e) {
    /* private mode, blocked storage or corrupt JSON — fall back to the file */
  }

  var R = data.restaurant || {};
  var categories = data.categories || [];
  var items = data.items || [];

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Small helpers ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;   // textContent, never innerHTML
    return node;
  }

  function msg(owner, name, fallback) {
    var value = owner && owner.getAttribute('data-msg-' + name);
    return value || fallback;
  }

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
    });
  }

  /**
   * Fold Arabic spelling variants so search matches how people type:
   * strips diacritics and tatweel, unifies alef/yaa/taa-marbuta/hamza.
   */
  function normalize(text) {
    // Written as \u escapes rather than literal Arabic: a character-class
    // range throws a SyntaxError if this file is ever parsed as anything
    // but UTF-8, which would take the whole script down.
    return String(text)
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')   // tashkeel + tatweel
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ -> ا
      .replace(/\u0649/g, '\u064A')                    // ى -> ي
      .replace(/\u0626/g, '\u064A')                    // ئ -> ي
      .replace(/\u0624/g, '\u0648')                    // ؤ -> و
      .replace(/\u0629/g, '\u0647')                    // ة -> ه
      .replace(/\s+/g, ' ')
      .trim();
  }

  function imageUrl(name) {
    if (!name) return IMG_BASE + 'thumb-burger.svg';
    // an uploaded image is a data: URI, a linked one is a path or an absolute URL,
    // and anything else is a filename inside assets/img/
    if (/^data:/.test(name) || /^(https?:)?\/\//.test(name) || name.indexOf('/') !== -1) return name;
    return IMG_BASE + name;
  }

  function digits(value) {
    return String(value || '').replace(/[^0-9]/g, '');
  }

  /* ---------- Contact links ---------- */
  var LINKS = {
    tel: 'tel:+' + digits(R.phone),
    mail: 'mailto:' + (R.email || ''),
    map: R.mapUrl || '#',
    whatsapp: 'https://wa.me/' + digits(R.whatsapp || R.phone) +
              '?text=' + encodeURIComponent(fill(R.whatsappMessage || '', { name: R.name || '' })),
    instagram: R.instagram || '#',
    tiktok: R.tiktok || '#',
    x: R.x || '#'
  };

  function bindRestaurant() {
    document.querySelectorAll('[data-bind]').forEach(function (node) {
      var value = R[node.getAttribute('data-bind')];
      if (value) node.textContent = value;
    });

    document.querySelectorAll('[data-bind-href]').forEach(function (node) {
      var href = LINKS[node.getAttribute('data-bind-href')];
      if (href) node.setAttribute('href', href);
    });

    document.querySelectorAll('[data-bind-img]').forEach(function (node) {
      var value = R[node.getAttribute('data-bind-img')];
      if (value) node.src = imageUrl(value);
    });

    // Opening hours
    var body = document.getElementById('hoursBody');
    if (body && R.hours) {
      body.textContent = '';
      R.hours.forEach(function (row) {
        var tr = el('tr');
        var th = el('th', null, row.day);
        th.setAttribute('scope', 'row');
        tr.appendChild(th);
        tr.appendChild(el('td', null, row.time));
        body.appendChild(tr);
      });
    }

    // Keep the structured data in step with the visible details
    var ld = document.getElementById('ldJson');
    if (ld) {
      try {
        var json = JSON.parse(ld.textContent);
        json.name = R.name || json.name;
        json.telephone = R.phone || json.telephone;
        json.address = {
          '@type': 'PostalAddress',
          streetAddress: R.addressLine1 || '',
          addressLocality: R.addressLine2 || ''
        };
        if (R.mapUrl) json.hasMap = R.mapUrl;
        ld.textContent = JSON.stringify(json, null, 2);
      } catch (e) { /* leave the static block alone if it can't be parsed */ }
    }

    var titleTemplate = document.body.getAttribute('data-title-template');
    if (R.name && titleTemplate) document.title = fill(titleTemplate, { name: R.name });
  }

  /* ---------- Rendering ---------- */
  function priceNode(item) {
    var p = el('p', 'card__price', String(item.price) + ' ');
    p.appendChild(el('span', null, R.currency || ''));
    return p;
  }

  function badgeNode(item) {
    var styles = { veg: ' card__flag--veg', new: ' card__flag--new' };
    return el('span', 'card__flag' + (styles[item.badgeStyle] || ''), item.badge);
  }

  function buildCard(item) {
    var li = el('li', 'card');
    li.dataset.category = item.category;

    var media = el('div', 'card__media');
    var img = el('img');
    img.src = imageUrl(item.image);
    img.alt = '';
    img.loading = 'lazy';
    img.width = 120;
    img.height = 120;
    media.appendChild(img);

    var body = el('div', 'card__body');
    var head = el('div', 'card__head');
    var title = el('h3', 'card__title', item.name);
    if (item.badge) {
      title.appendChild(document.createTextNode(' '));
      title.appendChild(badgeNode(item));
    }
    head.appendChild(title);
    head.appendChild(priceNode(item));
    body.appendChild(head);
    body.appendChild(el('p', 'card__desc', item.desc));

    if (item.tags && item.tags.length) {
      var tags = el('ul', 'tags');
      item.tags.forEach(function (tag) { tags.appendChild(el('li', 'tag', tag)); });
      body.appendChild(tags);
    }

    li.appendChild(media);
    li.appendChild(body);
    li.dataset.search = normalize(li.textContent);
    return li;
  }

  function buildFeatureCard(item, rank) {
    var li = el('li', 'feature-card reveal');

    var media = el('div', 'feature-card__media');
    var img = el('img');
    img.src = imageUrl(item.image);
    img.alt = item.name;
    img.loading = 'lazy';
    media.appendChild(img);
    var badge = el('span', 'feature-card__rank', String(rank));
    badge.setAttribute('aria-hidden', 'true');
    media.appendChild(badge);

    var body = el('div', 'feature-card__body');
    var head = el('div', 'feature-card__head');
    head.appendChild(el('h3', null, item.name));
    head.appendChild(priceNode(item));
    body.appendChild(head);
    body.appendChild(el('p', null, item.desc));

    li.appendChild(media);
    li.appendChild(body);
    return li;
  }

  function buildGalleryItem(entry, index) {
    // the first tile is tall and the fifth spans two columns — that shape is the design,
    // so it follows position rather than anything in the data
    var shape = index === 0 ? ' gallery__item--tall' : (index === 4 ? ' gallery__item--wide' : '');
    var li = el('li', 'gallery__item' + shape + ' reveal');

    var img = el('img');
    img.src = imageUrl(entry.image);
    img.alt = entry.caption || '';
    img.loading = 'lazy';

    li.appendChild(img);
    li.appendChild(el('span', 'gallery__cap', entry.caption || ''));
    return li;
  }

  var grid = document.getElementById('menuGrid');
  var featuredGrid = document.getElementById('featuredGrid');
  var filters = document.getElementById('menuFilters');
  var footerCats = document.getElementById('footerCategories');
  var galleryGrid = document.getElementById('galleryGrid');

  function renderAll() {
    if (grid) {
      grid.textContent = '';
      items.forEach(function (item) { grid.appendChild(buildCard(item)); });
    }

    if (featuredGrid) {
      featuredGrid.textContent = '';
      items.filter(function (i) { return i.featured; })
           .slice(0, 3)
           .forEach(function (item, i) { featuredGrid.appendChild(buildFeatureCard(item, i + 1)); });
    }

    if (filters) {
      filters.textContent = '';
      var all = el('button', 'chip is-active', filters.getAttribute('data-all-label') || 'All');
      all.type = 'button';
      all.dataset.filter = 'all';
      all.setAttribute('aria-pressed', 'true');
      filters.appendChild(all);

      categories.forEach(function (cat) {
        var chip = el('button', 'chip', cat.name);
        chip.type = 'button';
        chip.dataset.filter = cat.id;
        chip.setAttribute('aria-pressed', 'false');
        filters.appendChild(chip);
      });
    }

    if (galleryGrid && R.gallery) {
      galleryGrid.textContent = '';
      R.gallery.forEach(function (entry, i) { galleryGrid.appendChild(buildGalleryItem(entry, i)); });
    }

    if (footerCats) {
      footerCats.textContent = '';
      categories.forEach(function (cat) {
        var li = el('li');
        var a = el('a', null, cat.name);
        a.href = '#menu';
        a.dataset.jump = cat.id;
        li.appendChild(a);
        footerCats.appendChild(li);
      });
    }
  }

  /* ---------- Filter + search ---------- */
  var counter = document.getElementById('menuCount');
  var empty = document.getElementById('menuEmpty');
  var searchWrap = document.querySelector('.search');
  var search = document.getElementById('menuSearch');
  var clearBtn = document.getElementById('menuSearchClear');

  var state = { category: 'all', query: '' };
  var chips = [];
  var cards = [];

  function labelFor(id) {
    var found = categories.filter(function (c) { return c.id === id; })[0];
    return found ? found.name : '';
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

    if (counter) {
      if (state.query) {
        counter.textContent = fill(msg(counter, 'search', '{n} results for “{q}”'), { n: shown, q: search.value.trim() });
      } else if (state.category !== 'all') {
        counter.textContent = fill(msg(counter, 'category', 'Showing {n} in {category}'), { n: shown, category: labelFor(state.category) });
      } else {
        counter.textContent = fill(msg(counter, 'all', 'Showing all {n} dishes'), { n: shown });
      }
    }
  }

  function setCategory(id) {
    state.category = id;
    apply();

    // Keep the active chip in view on phones, where the row scrolls sideways
    var active = chips.filter(function (c) { return c.dataset.filter === id; })[0];
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  function wireMenu() {
    chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-filter]'));
    cards = Array.prototype.slice.call(document.querySelectorAll('#menuGrid .card'));

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { setCategory(chip.dataset.filter); });

      chip.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        // Arrow direction is visual, so it flips in RTL
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

    // Footer category links jump to the menu with that filter applied
    document.querySelectorAll('[data-jump]').forEach(function (link) {
      link.addEventListener('click', function () { setCategory(link.dataset.jump); });
    });

    apply();
  }

  /* ---------- Navigation ---------- */
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
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 900) closeNav(); });
  }

  /* ---------- Sticky header & toolbar ---------- */
  var header = document.querySelector('.header');
  var toolbar = document.querySelector('.menu-toolbar');

  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
      if (toolbar) {
        toolbar.classList.toggle('is-stuck', toolbar.getBoundingClientRect().top <= header.offsetHeight + 1);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Scroll-spy ---------- */
  function wireSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
    var sections = links
      .map(function (link) {
        var href = link.getAttribute('href');
        return href && href.charAt(0) === '#' ? document.querySelector(href) : null;
      })
      .filter(Boolean);

    if (!('IntersectionObserver' in window) || !sections.length) return;

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
  function wireReveals() {
    var revealables = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealables.forEach(function (node) { node.classList.add('is-visible'); });
      return;
    }

    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealables.forEach(function (node) { revealer.observe(node); });
  }

  /* ---------- Go ---------- */
  bindRestaurant();
  renderAll();
  wireMenu();
  wireSpy();
  wireReveals();

  var flag = document.getElementById('previewFlag');
  if (flag && usingLocal) flag.hidden = false;

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
