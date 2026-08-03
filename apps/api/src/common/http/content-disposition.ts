/**
 * Build a safe Content-Disposition header value.
 * Node rejects non-ASCII in `filename="..."`, which broke listening audio
 * with Cyrillic original names (browser showed «Ошибка»).
 */
export function buildContentDisposition(
  disposition: 'inline' | 'attachment',
  filename: string | null | undefined,
): string {
  const raw = String(filename || 'file')
    .replace(/[\r\n"]/g, '_')
    .trim() || 'file';
  const ascii =
    raw
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/[\\/]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'file';
  const encoded = encodeURIComponent(raw).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
