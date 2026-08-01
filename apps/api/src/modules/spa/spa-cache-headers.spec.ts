import { applyNoStoreCacheHeaders, applySpaStaticFileHeaders } from './spa-cache-headers';

describe('spa-cache-headers', () => {
  function mockRes() {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    };
  }

  it('marks index.html and sw.js as no-store for CF + browser', () => {
    const indexRes = mockRes();
    applySpaStaticFileHeaders(indexRes, '/opt/longhuaCRM/dist/index.html');
    expect(indexRes.headers['Cache-Control']).toMatch(/no-store/);
    expect(indexRes.headers['CDN-Cache-Control']).toBe('no-store');
    expect(indexRes.headers['Cloudflare-CDN-Cache-Control']).toBe('no-store');

    const swRes = mockRes();
    applySpaStaticFileHeaders(swRes, '/opt/longhuaCRM/dist/sw.js');
    expect(swRes.headers['Cache-Control']).toMatch(/no-store/);
    expect(swRes.headers['CDN-Cache-Control']).toBe('no-store');
  });

  it('marks hashed assets immutable', () => {
    const res = mockRes();
    applySpaStaticFileHeaders(res, '/opt/longhuaCRM/dist/assets/AdminPanel-abc.js');
    expect(res.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('applies no-store helper for missing asset 404s', () => {
    const res = mockRes();
    applyNoStoreCacheHeaders(res);
    expect(res.headers['Cache-Control']).toMatch(/no-store/);
    expect(res.headers['CDN-Cache-Control']).toBe('no-store');
  });
});
