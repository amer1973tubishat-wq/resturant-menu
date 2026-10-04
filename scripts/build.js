#!/usr/bin/env node
/**
 * Builds the two pages the restaurant runs from the one source file.
 *
 *   node scripts/build.js public              → dist/public/index.html
 *   node scripts/build.js content <dump-dir>  → dist/public/content.json
 *   node scripts/build.js admin               → dist/admin.html
 *
 * index.html stays the single source and the one the test suites drive. It
 * carries the dashboard behind @admin markers:
 *
 *   - The PUBLIC page is the customer site with every marked region removed —
 *     no dashboard markup, no dashboard styles, no dashboard code, no database
 *     calls. What a customer downloads contains nothing to find. Its content
 *     arrives in content.json, a data file published beside it.
 *   - The ADMIN page is the whole file with ADMIN_PAGE switched on: the
 *     dashboard opens on load, and its Publish button is wired to the
 *     background task that rebuilds content.json.
 *
 * `content` turns a dump of the admin page's database (the layout ArtifactData
 * writes with out_dir: <dir>/content/menu.json, <dir>/content/site.json,
 * <dir>/media/<id>.json) into content.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');

/* Where the two pages live, and the background task (a Claude Code Routine)
   the admin page's Publish button starts. The environment variables let the
   tests point the admin page at a dummy task. */
const CONFIG = {
  adminUrl:  'https://claude.ai/artifact/UozoNEQNyZSkLSZ8jJ9vJj',
  publicUrl: process.env.BAYTNA_PUBLIC_URL || 'https://claude.ai/artifact/UTkA8CPyEyiqpLFmUvEikg',
  triggerId: process.env.BAYTNA_TRIGGER_ID || 'trig_019AgcQbfPSuDaGCRKEua8sn',
};

function fail(msg) { console.error('build: ' + msg); process.exit(1); }

/* Remove everything between a begin and end marker, markers included. A
   marker that is missing or unbalanced fails the build outright: silently
   shipping dashboard code to customers is the one outcome this script exists
   to prevent. */
function strip(src, begin, end, label) {
  const a = src.indexOf(begin);
  const b = src.indexOf(end);
  if (a < 0 || b < 0 || b < a) fail(`${label}: markers missing or out of order`);
  if (src.indexOf(begin, a + 1) >= 0) fail(`${label}: more than one begin marker`);
  return src.slice(0, a) + src.slice(b + end.length);
}

/* The viewer wraps every published page in its own doctype, head and body,
   so a page must not bring its own. Strip them, keep the body's loading state
   as the one line of script that sets it, and drop the charset and viewport
   tags the wrapper already supplies. */
function toArtifact(html) {
  const swaps = [
    [/<!doctype html>\s*/i, ''],
    [/<html[^>]*>\s*/i, ''],
    [/<head>\s*/i, ''],
    [/<meta charset="utf-8">\s*/i, ''],
    [/<meta name="viewport"[^>]*>\s*/i, ''],
    [/<\/head>\s*/i, ''],
    [/<body class="is-loading no-js">\s*<script>document\.body\.classList\.remove\('no-js'\);<\/script>/i,
      "<script>document.body.classList.add('is-loading');</script>"],
    [/<\/body>\s*<\/html>\s*$/i, ''],
  ];
  for (const [re, to] of swaps) {
    if (!re.test(html)) fail('artifact shape: could not find ' + re);
    html = html.replace(re, to);
  }
  return html;
}

function buildPublic() {
  let html = fs.readFileSync(SRC, 'utf8');
  html = strip(html, '/* @admin-css:begin */', '/* @admin-css:end */', 'css');
  html = strip(html, '<!-- @admin-html:begin -->', '<!-- @admin-html:end -->', 'html');
  html = strip(html, '/* @admin-js:begin */', '/* @admin-js:end */', 'js');

  /* The published content, applied at the end of the page's own script. If
     content.json is missing the page keeps its built-in menu rather than
     breaking. */
  const loader = `
/* ============================================================
   PUBLISHED CONTENT
   The public site has no database and no dashboard. Its content is
   content.json, published beside this page by the admin page's
   Publish button, and read as data — never run as code. If it is
   missing, the page keeps its built-in menu rather than breaking.
   ============================================================ */
(function(){
  function apply(c){
    if(!c || typeof c !== 'object') return;
    if(c.media && typeof c.media === 'object'){
      Object.keys(c.media).forEach(function(id){
        if(typeof c.media[id] === 'string') MEDIA[id] = c.media[id];
      });
    }
    if(c.menu && typeof c.menu === 'object') applyContent(c.menu);
    if(c.site && typeof c.site === 'object') applyContent(c.site);
  }
  try {
    fetch('content.json', { cache: 'no-cache' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(apply)
      .catch(function(){});
  } catch(e){}
})();
`;
  const close = html.lastIndexOf('})();');
  if (close < 0) fail('could not find the end of the main script');
  html = html.slice(0, close) + loader + html.slice(close);


  /* A last guard: nothing that only the dashboard uses may survive. */
  const leaks = ['admin-root', 'claude.use', 'ADMIN_ROUTE', 'ensureDb', 'ownerBtn', 'adSave', 'pressSave']
    .filter(t => html.includes(t));
  if (leaks.length) fail('dashboard code leaked into the public page: ' + leaks.join(', '));

  html = toArtifact(html);
  fs.mkdirSync(path.join(DIST, 'public'), { recursive: true });
  const out = path.join(DIST, 'public', 'index.html');
  fs.writeFileSync(out, html);
  console.log('public  → ' + path.relative(ROOT, out) + '  (' + html.length + ' bytes)');
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

/* ArtifactData writes either the bare document or an envelope with the
   fields under `data`; accept both. */
function unwrap(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) return doc.data;
  return doc;
}

/* Every image id the content actually points at, so orphaned uploads are not
   shipped to every visitor. */
function referencedIds(menu, site) {
  const ids = new Set();
  const add = (v) => { if (typeof v === 'string' && v && !/^(https?:|data:)/i.test(v)) ids.add(v); };
  (menu.categories || []).forEach(c => c && add(c.img));
  (menu.items || []).forEach(i => i && add(i.img));
  add(site.heroImage);
  if (site.brand) add(site.brand.logo);
  return ids;
}

function buildContent(dumpDir) {
  if (!dumpDir) fail('content needs the dump directory');
  const menu = unwrap(readJson(path.join(dumpDir, 'content', 'menu.json'))) || {};
  const site = unwrap(readJson(path.join(dumpDir, 'content', 'site.json'))) || {};
  if (!Object.keys(menu).length && !Object.keys(site).length) fail('no content found in ' + dumpDir);

  const media = {};
  const wanted = referencedIds(menu, site);
  const mediaDir = path.join(dumpDir, 'media');
  if (fs.existsSync(mediaDir)) {
    for (const f of fs.readdirSync(mediaDir)) {
      const id = f.replace(/\.json$/, '');
      if (!wanted.has(id)) continue;
      const doc = unwrap(readJson(path.join(mediaDir, f)));
      /* Only inline images, the only kind the dashboard stores. */
      if (doc && typeof doc.url === 'string' && /^data:image\//i.test(doc.url)) media[id] = doc.url;
    }
  }

  /* Drop the bookkeeping fields; customers need the content only. */
  delete menu.updatedAt; delete site.updatedAt;

  /* Plain JSON, parsed by the page as data. Nothing stored in the dashboard
     can become code on the public site. */
  const js = JSON.stringify({ menu, site, media, publishedAt: Date.now() });

  fs.mkdirSync(path.join(DIST, 'public'), { recursive: true });
  const out = path.join(DIST, 'public', 'content.json');
  fs.writeFileSync(out, js);
  console.log('content → ' + path.relative(ROOT, out) + '  (' + js.length + ' bytes, '
    + (menu.items || []).length + ' items, ' + Object.keys(media).length + ' images)');
}

function buildAdmin() {
  let html = fs.readFileSync(SRC, 'utf8');
  const swap = (from, to) => {
    if (!html.includes(from)) fail('admin build: could not find ' + from);
    html = html.replace(from, to);
  };
  swap("var ADMIN_PAGE = false;", "var ADMIN_PAGE = true;");
  swap("var PUBLISH = { trigger: '', publicUrl: '' };",
       "var PUBLISH = { trigger: " + JSON.stringify(CONFIG.triggerId)
       + ", publicUrl: " + JSON.stringify(CONFIG.publicUrl) + " };");
  swap('<title>Baytna Burger</title>', '<title>Baytna Admin</title>');
  html = toArtifact(html);
  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, 'admin.html');
  fs.writeFileSync(out, html);
  console.log('admin   → ' + path.relative(ROOT, out) + '  (' + html.length + ' bytes)'
    + (CONFIG.triggerId ? '' : '  [no publishing task configured]'));
}

const [mode, arg] = process.argv.slice(2);
if (mode === 'public') buildPublic();
else if (mode === 'content') buildContent(arg);
else if (mode === 'admin') buildAdmin();
else if (mode === 'all') { buildPublic(); buildAdmin(); }
else fail('usage: build.js public | content <dump-dir> | admin | all');
