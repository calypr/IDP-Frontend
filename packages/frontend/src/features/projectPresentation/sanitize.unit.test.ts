import { sanitizeProjectPresentationHtml } from './sanitize';

describe('sanitizeProjectPresentationHtml', () => {
  it('removes executable script content and inline event handlers', () => {
    const sanitized = sanitizeProjectPresentationHtml(
      '<section onclick="alert(1)"><script>alert(1)</script><img src="/x" onerror="alert(2)" /></section>',
    );

    expect(sanitized).toContain('<section>');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onclick=');
    expect(sanitized).not.toContain('onerror=');
  });

  it('hardens links opened from presentation content', () => {
    const sanitized = sanitizeProjectPresentationHtml(
      '<a href="https://example.org">Example</a>',
    );

    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
  });
});
