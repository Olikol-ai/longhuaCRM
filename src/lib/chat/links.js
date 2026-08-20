const URL_RE = /(https?:\/\/[^\s<]+[^.,:;!?\s<])/gi;

export function splitLinks(text) {
  const source = String(text || '');
  if (!source) return [];
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(URL_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: 'text', value: source.slice(last, index) });
    parts.push({ type: 'link', value: match[0] });
    last = index + match[0].length;
  }
  if (last < source.length) parts.push({ type: 'text', value: source.slice(last) });
  return parts.length ? parts : [{ type: 'text', value: source }];
}

export function firstUrl(text) {
  const match = String(text || '').match(URL_RE);
  return match?.[0] || null;
}
