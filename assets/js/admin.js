/* =========================================================
   لوحة تحكم شيف هاشم — Chef Hashem dashboard

   Edits the menu in the browser and writes it to localStorage,
   which index.html reads back. To publish the changes for real
   visitors, use "تنزيل menu.js" and replace assets/data/menu.js
   with the downloaded file.

   The passcode gate is client-side. It keeps the page out of
   casual view; it is NOT access control. Anyone who can load
   the site can read this file and the data it holds.
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'chefhashem.menu';
  var UNLOCK_KEY = 'chefhashem.unlocked';
  var IMG_BASE = '../assets/img/';   // the dashboard lives one level down, at /manage/

  /* Hash of the default passcode "hashem2014". The dashboard can change the
     passcode at runtime, which stores an override in this browser; edit this
     constant to change it for every browser. */
  var PASS_HASH = '57c4a9a2';
  var PASS_KEY = 'chefhashem.pass';

  function currentHash() {
    try { return localStorage.getItem(PASS_KEY) || PASS_HASH; } catch (e) { return PASS_HASH; }
  }

  var IMAGES = [
    { file: 'thumb-burger.svg',  label: 'برجر لحم' },
    { file: 'thumb-chicken.svg', label: 'برجر دجاج' },
    { file: 'thumb-fries.svg',   label: 'بطاطس' },
    { file: 'thumb-rings.svg',   label: 'حلقات بصل' },
    { file: 'thumb-salad.svg',   label: 'سلطة / نباتي' },
    { file: 'thumb-soda.svg',    label: 'مشروب' },
    { file: 'thumb-shake.svg',   label: 'ميلك شيك' },
    { file: 'thumb-dessert.svg', label: 'حلويات' },
    { file: 'thumb-combo.svg',   label: 'وجبة' }
  ];

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  window.hash = hash;   // exposed so an owner can generate a new passcode hash

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function imageUrl(name) {
    if (!name) return IMG_BASE + 'thumb-burger.svg';
    return /^(https?:)?\/\//.test(name) || name.indexOf('/') !== -1 ? name : IMG_BASE + name;
  }

  function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }

  /* ---------- Uploaded images ----------
     Everything is stored inside the menu data as a data: URI, because there
     is no server to upload to. Photos are therefore downscaled and
     re-encoded before storing — a phone photo is several megabytes, and
     localStorage gives us roughly five in total. */
  var LIMITS = {
    dish:    { max: 500, mode: 'photo' },
    hero:    { max: 900, mode: 'photo' },
    logo:    { max: 256, mode: 'flat'  },   // keeps transparency
    gallery: { max: 700, mode: 'photo' }
  };

  function processImage(file, kind, done, fail) {
    var limit = LIMITS[kind] || LIMITS.dish;

    if (!/^image\//.test(file.type)) {
      fail('الملف المختار ليس صورة.');
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () { fail('تعذّرت قراءة الملف.'); };
    reader.onload = function () {
      var source = String(reader.result);

      // SVG is already small and lossless — store it as-is
      if (file.type === 'image/svg+xml') { done(source); return; }

      var img = new Image();
      img.onerror = function () { fail('تعذّر فتح الصورة.'); };
      img.onload = function () {
        var scale = Math.min(1, limit.max / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // PNG for logos so transparency survives, JPEG for photographs
        done(limit.mode === 'flat'
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = source;
    };
    reader.readAsDataURL(file);
  }

  function byteSize(value) {
    if (!value) return 0;
    var m = /^data:[^;]+;base64,(.*)$/.exec(value);
    return m ? Math.round(m[1].length * 0.75) : value.length;
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' بايت';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' ك.ب';
    return (bytes / 1048576).toFixed(1) + ' م.ب';
  }

  /**
   * Renders a preview + upload / choose / link control into `mount`.
   * `get` returns the current value, `set` stores a new one.
   */
  function imageField(mount, kind, get, set) {
    mount.textContent = '';
    mount.className = 'imgfield';

    var preview = el('div', 'imgfield__preview');
    var img = el('img');
    img.alt = '';
    preview.appendChild(img);

    var controls = el('div', 'imgfield__controls');

    var upload = el('button', 'btn btn--primary btn--sm', 'رفع صورة');
    upload.type = 'button';

    var file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;

    var choose = el('select', 'imgfield__select');
    var head = el('option', null, 'أو اختر رسمة جاهزة…');
    head.value = '';
    choose.appendChild(head);
    IMAGES.forEach(function (entry) {
      var option = el('option', null, entry.label);
      option.value = entry.file;
      choose.appendChild(option);
    });

    var link = el('input', 'imgfield__link');
    link.type = 'text';
    link.dir = 'ltr';
    link.placeholder = 'أو الصق مسار/رابط صورة';

    var meta = el('p', 'imgfield__meta');
    var error = el('p', 'field__error');

    function refresh() {
      var value = get() || '';
      img.src = imageUrl(value);
      var uploaded = /^data:/.test(value);
      // only uploads need a caption; a filename already shows in the field below
      meta.textContent = uploaded ? 'صورة مرفوعة · ' + humanSize(byteSize(value)) : '';
      choose.value = IMAGES.some(function (e) { return e.file === value; }) ? value : '';
      link.value = uploaded || !value ? '' : (choose.value ? '' : value);
    }

    upload.addEventListener('click', function () { file.click(); });

    file.addEventListener('change', function (e) {
      var picked = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!picked) return;

      error.textContent = '';
      meta.textContent = 'جارٍ المعالجة…';

      processImage(picked, kind, function (uri) {
        set(uri);
        markDirty(true);
        refresh();
        updateSize();
        toast('تمت إضافة الصورة');
      }, function (message) {
        error.textContent = message;
        refresh();
      });
    });

    choose.addEventListener('change', function () {
      if (!choose.value) return;
      set(choose.value);
      markDirty(true);
      refresh();
      updateSize();
    });

    link.addEventListener('change', function () {
      var value = link.value.trim();
      if (!value) return;
      set(value);
      markDirty(true);
      refresh();
      updateSize();
    });

    controls.appendChild(upload);
    controls.appendChild(file);
    controls.appendChild(choose);
    controls.appendChild(link);

    mount.appendChild(preview);
    mount.appendChild(controls);
    mount.appendChild(meta);
    mount.appendChild(error);
    refresh();
    return { refresh: refresh };
  }

  /** Total size of the stored menu, so uploads can't silently blow the quota. */
  function updateSize() {
    var badge = $('sizeState');
    if (!badge) return;

    var bytes = JSON.stringify(data).length;
    badge.textContent = humanSize(bytes);
    badge.className = 'save-state' + (bytes > 3.5 * 1048576 ? ' is-dirty' : '');
    badge.title = bytes > 3.5 * 1048576
      ? 'الحجم كبير — قد يرفض المتصفح الحفظ. استخدم صوراً أصغر.'
      : 'حجم بيانات القائمة بما فيها الصور المرفوعة';
  }

  /* ---------- State ---------- */
  var original = deepCopy(window.MENU_DATA);   // what the data file holds
  var data;                                    // what we are editing
  var dirty = false;

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    data = saved ? JSON.parse(saved) : deepCopy(original);
  } catch (e) {
    data = deepCopy(original);
  }
  if (!data || !data.items || !data.categories || !data.restaurant) data = deepCopy(original);

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(text, isError) {
    var node = $('toast');
    node.textContent = text;
    node.className = 'toast' + (isError ? ' toast--err' : '');
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2600);
  }

  function markDirty(value) {
    dirty = value;
    var badge = $('saveState');

    if (value) {
      badge.textContent = 'تغييرات غير محفوظة';
      badge.className = 'save-state is-dirty';
      return;
    }

    // "محفوظ" would be misleading before anything has actually been saved
    var hasSaved = false;
    try { hasSaved = !!localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage blocked */ }
    badge.textContent = hasSaved ? 'محفوظ' : 'لا تغييرات';
    badge.className = 'save-state' + (hasSaved ? ' is-saved' : '');
  }

  /* ---------- Gate ---------- */
  function unlock() {
    $('gate').hidden = true;
    $('app').hidden = false;
    renderAll();
  }

  try {
    if (sessionStorage.getItem(UNLOCK_KEY) === '1') unlock();
  } catch (e) { /* storage blocked — the gate simply always shows */ }

  $('gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var value = $('passcode').value;

    if (hash(value) !== currentHash()) {
      $('gateError').textContent = 'رمز الدخول غير صحيح.';
      $('passcode').select();
      return;
    }

    $('gateError').textContent = '';
    try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (e2) { /* not fatal */ }
    unlock();
  });

  $('lockBtn').addEventListener('click', function () {
    if (dirty && !confirm('لديك تغييرات غير محفوظة. هل تريد القفل بدون حفظ؟')) return;
    try { sessionStorage.removeItem(UNLOCK_KEY); } catch (e) { /* ignore */ }
    location.reload();
  });

  /* ---------- Tabs ---------- */
  var TABS = ['items', 'categories', 'info', 'security'];
  TABS.forEach(function (name) {
    $('tabbtn-' + name).addEventListener('click', function () {
      TABS.forEach(function (other) {
        var isTarget = other === name;
        $('tabbtn-' + other).classList.toggle('is-active', isTarget);
        $('tabbtn-' + other).setAttribute('aria-selected', String(isTarget));
        $('tab-' + other).hidden = !isTarget;
      });
    });
  });

  /* ---------- Items ---------- */
  var editingId = null;

  function categoryName(id) {
    var found = data.categories.filter(function (c) { return c.id === id; })[0];
    return found ? found.name : '—';
  }

  function renderItems() {
    var list = $('itemRows');
    var query = ($('adminSearch').value || '').trim().toLowerCase();
    list.textContent = '';
    var shown = 0;

    data.items.forEach(function (item, index) {
      var haystack = (item.name + ' ' + item.desc + ' ' + categoryName(item.category)).toLowerCase();
      if (query && haystack.indexOf(query) === -1) return;
      shown++;

      var row = el('li', 'row');

      var thumb = el('div', 'row__img');
      var img = el('img');
      img.src = imageUrl(item.image);
      img.alt = '';
      thumb.appendChild(img);

      var main = el('div', 'row__main');
      var title = el('div', 'row__title');
      title.appendChild(document.createTextNode(item.name));
      if (item.featured) title.appendChild(el('span', 'pill pill--star', 'الأكثر طلباً'));
      if (item.badge) title.appendChild(el('span', 'pill' + (item.badgeStyle === 'veg' ? ' pill--veg' : ''), item.badge));
      main.appendChild(title);
      main.appendChild(el('div', 'row__meta', categoryName(item.category)));

      var price = el('div', 'row__price', item.price + ' ' + (data.restaurant.currency || ''));

      var tools = el('div', 'row__tools');
      var up = el('button', 'icon-btn', '▲');
      up.type = 'button'; up.title = 'تحريك لأعلى'; up.disabled = index === 0;
      up.addEventListener('click', function () { move(index, -1); });

      var down = el('button', 'icon-btn', '▼');
      down.type = 'button'; down.title = 'تحريك لأسفل'; down.disabled = index === data.items.length - 1;
      down.addEventListener('click', function () { move(index, 1); });

      var edit = el('button', 'icon-btn', '✎');
      edit.type = 'button'; edit.title = 'تعديل';
      edit.addEventListener('click', function () { openItem(item.id); });

      var remove = el('button', 'icon-btn icon-btn--danger', '🗑');
      remove.type = 'button'; remove.title = 'حذف';
      remove.addEventListener('click', function () {
        if (!confirm('حذف «' + item.name + '» من القائمة؟')) return;
        data.items = data.items.filter(function (i) { return i.id !== item.id; });
        markDirty(true);
        renderItems();
        toast('تم حذف الصنف');
      });

      [up, down, edit, remove].forEach(function (b) { tools.appendChild(b); });

      row.appendChild(thumb);
      row.appendChild(main);
      row.appendChild(price);
      row.appendChild(tools);
      list.appendChild(row);
    });

    $('itemsEmpty').hidden = shown > 0;
  }

  function move(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= data.items.length) return;
    var moved = data.items.splice(index, 1)[0];
    data.items.splice(target, 0, moved);
    markDirty(true);
    renderItems();
  }

  var draftImage = '';   // the image being edited in the modal

  function fillModalSelects() {
    var cat = $('fCategory');
    cat.textContent = '';
    data.categories.forEach(function (c) {
      var option = el('option', null, c.name);
      option.value = c.id;
      cat.appendChild(option);
    });

    imageField($('fImageField'), 'dish',
      function () { return draftImage; },
      function (value) { draftImage = value; });
  }

  function openItem(id) {
    if (!data.categories.length) {
      toast('أضف قسماً واحداً على الأقل أولاً', true);
      return;
    }

    editingId = id;

    var item = id ? data.items.filter(function (i) { return i.id === id; })[0] : null;
    $('modalTitle').textContent = item ? 'تعديل الصنف' : 'صنف جديد';
    $('fName').value = item ? item.name : '';
    $('fCategory').value = item ? item.category : data.categories[0].id;
    $('fPrice').value = item ? item.price : '';
    $('fDesc').value = item ? item.desc : '';
    $('fBadge').value = item ? (item.badge || '') : '';
    $('fBadgeStyle').value = item ? (item.badgeStyle || 'hot') : 'hot';
    $('fTags').value = item && item.tags ? item.tags.join('\u060C ') : '';
    $('fFeatured').checked = !!(item && item.featured);

    draftImage = item ? item.image : IMAGES[0].file;
    fillModalSelects();

    $('fNameError').textContent = '';
    $('fPriceError').textContent = '';
    $('itemModal').hidden = false;
    $('fName').focus();
  }

  function closeModal() {
    $('itemModal').hidden = true;
    editingId = null;
  }

  function slug(name) {
    var base = name.trim().replace(/\s+/g, '-').slice(0, 24) || 'item';
    var id = base;
    var n = 2;
    while (data.items.some(function (i) { return i.id === id && i.id !== editingId; })) id = base + '-' + n++;
    return id;
  }

  $('addItemBtn').addEventListener('click', function () { openItem(null); });
  $('modalClose').addEventListener('click', closeModal);
  $('modalCancel').addEventListener('click', closeModal);
  $('itemModal').addEventListener('click', function (e) { if (e.target === $('itemModal')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('itemModal').hidden) closeModal(); });
  $('adminSearch').addEventListener('input', renderItems);

  $('itemForm').addEventListener('submit', function (e) {
    e.preventDefault();

    var name = $('fName').value.trim();
    var price = parseFloat($('fPrice').value);
    var ok = true;

    $('fNameError').textContent = '';
    $('fPriceError').textContent = '';

    if (!name) { $('fNameError').textContent = 'اسم الصنف مطلوب.'; ok = false; }
    if (isNaN(price) || price < 0) { $('fPriceError').textContent = 'أدخل سعراً صحيحاً.'; ok = false; }
    if (!ok) return;

    var payload = {
      id: editingId || slug(name),
      category: $('fCategory').value,
      featured: $('fFeatured').checked,
      name: name,
      desc: $('fDesc').value.trim(),
      price: price,
      image: draftImage,
      badge: $('fBadge').value.trim(),
      badgeStyle: $('fBadgeStyle').value,
      tags: $('fTags').value.split(/[\u060C,]/).map(function (t) { return t.trim(); }).filter(Boolean)
    };

    if (editingId) {
      data.items = data.items.map(function (i) { return i.id === editingId ? payload : i; });
    } else {
      data.items.push(payload);
    }

    markDirty(true);
    closeModal();
    renderItems();
    toast('تم حفظ الصنف في المتصفح');
  });

  /* ---------- Categories ---------- */
  function renderCategories() {
    var list = $('catRows');
    list.textContent = '';

    data.categories.forEach(function (cat, index) {
      var count = data.items.filter(function (i) { return i.category === cat.id; }).length;
      var row = el('li', 'row');

      var main = el('div', 'row__main');
      var input = el('input');
      input.type = 'text';
      input.value = cat.name;
      input.style.cssText = 'width:100%;font:inherit;font-weight:700;color:var(--cream);background:transparent;border:0;padding:0';
      input.addEventListener('change', function () {
        var value = input.value.trim();
        if (!value) { input.value = cat.name; return; }
        cat.name = value;
        markDirty(true);
        renderItems();
        toast('تم تعديل اسم القسم');
      });
      main.appendChild(input);
      main.appendChild(el('div', 'row__meta', count + ' صنف · المعرّف: ' + cat.id));

      var tools = el('div', 'row__tools');
      var up = el('button', 'icon-btn', '▲');
      up.type = 'button'; up.disabled = index === 0;
      up.addEventListener('click', function () { moveCat(index, -1); });

      var down = el('button', 'icon-btn', '▼');
      down.type = 'button'; down.disabled = index === data.categories.length - 1;
      down.addEventListener('click', function () { moveCat(index, 1); });

      var remove = el('button', 'icon-btn icon-btn--danger', '🗑');
      remove.type = 'button';
      remove.disabled = count > 0;
      remove.title = count > 0 ? 'انقل أصناف هذا القسم أولاً' : 'حذف';
      remove.addEventListener('click', function () {
        if (!confirm('حذف قسم «' + cat.name + '»؟')) return;
        data.categories = data.categories.filter(function (c) { return c.id !== cat.id; });
        markDirty(true);
        renderCategories();
        toast('تم حذف القسم');
      });

      [up, down, remove].forEach(function (b) { tools.appendChild(b); });
      row.appendChild(main);
      row.appendChild(tools);
      list.appendChild(row);
    });
  }

  function moveCat(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= data.categories.length) return;
    var moved = data.categories.splice(index, 1)[0];
    data.categories.splice(target, 0, moved);
    markDirty(true);
    renderCategories();
  }

  $('addCatBtn').addEventListener('click', function () {
    var name = $('newCatName').value.trim();
    $('newCatError').textContent = '';

    if (!name) { $('newCatError').textContent = 'أدخل اسم القسم.'; return; }
    if (data.categories.some(function (c) { return c.name === name; })) {
      $('newCatError').textContent = 'يوجد قسم بهذا الاسم.';
      return;
    }

    var id = 'cat-' + Date.now().toString(36);
    data.categories.push({ id: id, name: name });
    $('newCatName').value = '';
    markDirty(true);
    renderCategories();
    toast('تمت إضافة القسم');
  });

  /* ---------- Restaurant info ---------- */
  function renderInfo() {
    document.querySelectorAll('[data-info]').forEach(function (input) {
      var key = input.getAttribute('data-info');
      input.value = data.restaurant[key] || '';

      if (input.dataset.wired) return;
      input.dataset.wired = '1';
      input.addEventListener('input', function () {
        data.restaurant[key] = input.value;
        if (key === 'name') $('brandName').textContent = input.value;
        markDirty(true);
      });
    });

    $('brandName').textContent = data.restaurant.name || '';

    imageField($('logoField'), 'logo',
      function () { return data.restaurant.logo; },
      function (value) { data.restaurant.logo = value; });

    imageField($('heroField'), 'hero',
      function () { return data.restaurant.heroImage; },
      function (value) { data.restaurant.heroImage = value; });

    renderGallery();
    renderHours();
  }

  function renderGallery() {
    var wrap = $('galleryEditor');
    if (!wrap) return;

    wrap.textContent = '';
    if (!data.restaurant.gallery) data.restaurant.gallery = [];

    data.restaurant.gallery.forEach(function (entry, index) {
      var row = el('div', 'gallery-row');

      var mount = el('div');
      imageField(mount, 'gallery',
        function () { return entry.image; },
        function (value) { entry.image = value; });

      var caption = el('input');
      caption.type = 'text';
      caption.value = entry.caption || '';
      caption.placeholder = 'الوصف تحت الصورة';
      caption.setAttribute('aria-label', 'وصف الصورة ' + (index + 1));
      caption.addEventListener('input', function () {
        entry.caption = caption.value;
        markDirty(true);
      });

      row.appendChild(mount);
      row.appendChild(caption);
      wrap.appendChild(row);
    });
  }

  function renderHours() {
    var wrap = $('hoursEditor');
    wrap.textContent = '';
    (data.restaurant.hours || []).forEach(function (row, index) {
      var line = el('div', 'hours-row');

      var day = el('input');
      day.type = 'text'; day.value = row.day; day.setAttribute('aria-label', 'اليوم');
      day.addEventListener('input', function () { row.day = day.value; markDirty(true); });

      var time = el('input');
      time.type = 'text'; time.value = row.time; time.setAttribute('aria-label', 'الوقت');
      time.addEventListener('input', function () { row.time = time.value; markDirty(true); });

      var remove = el('button', 'icon-btn icon-btn--danger', '🗑');
      remove.type = 'button';
      remove.addEventListener('click', function () {
        data.restaurant.hours.splice(index, 1);
        markDirty(true);
        renderHours();
      });

      line.appendChild(day);
      line.appendChild(time);
      line.appendChild(remove);
      wrap.appendChild(line);
    });
  }

  $('addHourBtn').addEventListener('click', function () {
    if (!data.restaurant.hours) data.restaurant.hours = [];
    data.restaurant.hours.push({ day: '', time: '' });
    markDirty(true);
    renderHours();
  });

  /* ---------- Save / download / import / reset ---------- */
  $('saveBtn').addEventListener('click', function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      markDirty(false);
      toast('تم الحفظ — افتح «معاينة الموقع» لرؤية النتيجة');
    } catch (e) {
      var quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
      toast(quota
        ? 'الصور المرفوعة تجاوزت سعة المتصفح — استخدم صوراً أقل أو أصغر.'
        : 'تعذّر الحفظ في هذا المتصفح', true);
    }
  });

  /* ---------- Change the passcode ---------- */
  $('pwSaveBtn').addEventListener('click', function () {
    var current = $('pwCurrent').value;
    var next = $('pwNew').value;
    var confirmValue = $('pwConfirm').value;
    var error = $('pwError');

    error.textContent = '';

    if (hash(current) !== currentHash()) { error.textContent = 'كلمة المرور الحالية غير صحيحة.'; return; }
    if (next.length < 6) { error.textContent = 'كلمة المرور الجديدة قصيرة — 6 أحرف على الأقل.'; return; }
    if (next !== confirmValue) { error.textContent = 'كلمة المرور الجديدة وتأكيدها غير متطابقين.'; return; }
    if (next === current) { error.textContent = 'كلمة المرور الجديدة مطابقة للحالية.'; return; }

    var digest = hash(next);
    try {
      localStorage.setItem(PASS_KEY, digest);
    } catch (e) {
      error.textContent = 'تعذّر حفظ كلمة المرور في هذا المتصفح.';
      return;
    }

    $('pwCurrent').value = '';
    $('pwNew').value = '';
    $('pwConfirm').value = '';
    $('pwHash').textContent = digest;
    $('pwPermanent').hidden = false;
    toast('تم تغيير كلمة المرور');
  });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('استعادة البيانات الأصلية من ملف menu.js وحذف التعديلات المحفوظة في المتصفح؟')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    data = deepCopy(original);   // the passcode override is deliberately kept
    markDirty(false);
    renderAll();
    toast('تمت الاستعادة من ملف البيانات');
  });

  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ---------- Render ---------- */
  function renderAll() {
    renderItems();
    renderCategories();
    renderInfo();
    updateSize();
    markDirty(dirty);
  }
})();
