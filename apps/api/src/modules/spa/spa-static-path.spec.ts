import {
  isStaticAssetRequestPath,
  normalizeRequestPathname,
} from './spa-static-path';

describe('spa-static-path', () => {
  it('normalizes pathnames', () => {
    expect(normalizeRequestPathname('/assets/a.js?v=1')).toBe('/assets/a.js');
    expect(normalizeRequestPathname('assets/a.js')).toBe('/assets/a.js');
  });

  it('treats hashed Vite chunks as static assets', () => {
    expect(isStaticAssetRequestPath('/assets/index-AbCdEf12.js')).toBe(true);
    expect(isStaticAssetRequestPath('/assets/vendor-react-XyZ.css')).toBe(true);
    expect(isStaticAssetRequestPath('/assets/missing-chunk.js')).toBe(true);
  });

  it('treats root static files as assets', () => {
    expect(isStaticAssetRequestPath('/sw.js')).toBe(true);
    expect(isStaticAssetRequestPath('/manifest.webmanifest')).toBe(true);
    expect(isStaticAssetRequestPath('/favicon.ico')).toBe(true);
  });

  it('does not treat SPA routes as assets', () => {
    expect(isStaticAssetRequestPath('/')).toBe(false);
    expect(isStaticAssetRequestPath('/schedule')).toBe(false);
    expect(isStaticAssetRequestPath('/lessons/123')).toBe(false);
    expect(isStaticAssetRequestPath('/api/health')).toBe(false);
  });
});
