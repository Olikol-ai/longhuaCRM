import {
  classifyMaterialFileUrl,
  coerceExternalHttpUrl,
  isCanvaHostname,
  isExternalMaterialUrl,
} from './material-open-url.util';

describe('material-open-url.util', () => {
  it('classifies Canva https URLs as external-canva and never as local uploads', () => {
    const classified = classifyMaterialFileUrl(
      'https://www.canva.com/design/DAGabc123/view',
    );
    expect(classified.kind).toBe('external-canva');
    expect(classified.hostname).toBe('www.canva.com');
    expect(classified.openUrl).toBe('https://www.canva.com/design/DAGabc123/view');
    expect(isExternalMaterialUrl(classified.openUrl)).toBe(true);
  });

  it('normalizes protocol-less Canva hosts to https', () => {
    const classified = classifyMaterialFileUrl('www.canva.com/design/xyz/view');
    expect(classified.kind).toBe('external-canva');
    expect(classified.openUrl).toBe('https://www.canva.com/design/xyz/view');
  });

  it('keeps generic external URLs identical for every user', () => {
    const url = 'https://docs.google.com/presentation/d/abc/edit';
    const classified = classifyMaterialFileUrl(url);
    expect(classified.kind).toBe('external-http');
    expect(classified.openUrl).toBe(url);
  });

  it('does not treat local uploads or signed paths as external', () => {
    expect(classifyMaterialFileUrl('/uploads/materials/a.pdf').kind).toBe('local-upload');
    expect(classifyMaterialFileUrl('/api/files/signed/token.here').kind).toBe(
      'local-upload',
    );
    expect(isExternalMaterialUrl('/uploads/materials/a.pdf')).toBe(false);
    expect(coerceExternalHttpUrl('/uploads/materials/a.pdf')).toBeNull();
  });

  it('detects canva hostnames only', () => {
    expect(isCanvaHostname('canva.com')).toBe(true);
    expect(isCanvaHostname('www.canva.com')).toBe(true);
    expect(isCanvaHostname('example.com')).toBe(false);
    expect(isCanvaHostname(null)).toBe(false);
  });
});
