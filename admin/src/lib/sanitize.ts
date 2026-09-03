/**
 * Rich-text fields (the story block) are the one place we store markup, so
 * they are sanitised on the way in with a strict allow-list. Anything not
 * named here is dropped, which means new tags are denied by default.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'span',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  span: new Set(['dir']),
  p: new Set(['dir']),
};

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  let out = input;

  // Strip dangerous elements along with their contents, so the text inside a
  // <script> block does not survive as visible page text.
  out = out.replace(/<(script|style|iframe|object|embed|form|svg|math)[\s\S]*?<\/\1\s*>/gi, '');
  out = out.replace(/<(script|style|iframe|object|embed|form|svg|math)\b[^>]*\/?>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  out = out.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagRaw: string, attrsRaw: string) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed) return `<${tag}>`;

    const kept: string[] = [];
    const attrRe = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrsRaw))) {
      const name = (m[1] ?? m[3] ?? '').toLowerCase();
      const value = m[2] ?? m[4] ?? '';
      if (/^on/i.test(name)) continue;          // no event handlers, ever
      if (!allowed.has(name)) continue;
      // Block javascript:, data:, vbscript: — allow only these schemes.
      if (name === 'href' && !/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value.trim())) continue;
      kept.push(`${name}="${escapeAttr(value)}"`);
    }
    // A link that opens a new tab must not hand over window.opener.
    if (tag === 'a' && kept.some((k) => k.startsWith('target='))) {
      kept.push('rel="noopener noreferrer"');
    }
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}>`;
  });

  return out.trim();
}

function escapeAttr(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Plain-text fields: strip control characters, collapse space, cap length. */
export function cleanText(v: string, max = 2000): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
