import { describe, it, expect, beforeEach } from 'vitest';
import { isSafeUrl } from '../services/crawler/ssrf';
import { crawlCache } from '../services/crawler/cache';
import { crawlDomain } from '../services/crawler/index';

describe('Crawler SSRF Protection Guardrails', () => {
  it('allows valid public commercial domains', () => {
    expect(isSafeUrl('https://apexmanaged.com').safe).toBe(true);
    expect(isSafeUrl('http://millertechgroup.com/about').safe).toBe(true);
    expect(isSafeUrl('https://subdomain.company.co.uk').safe).toBe(true);
  });

  it('rejects localhost and loopback targets', () => {
    expect(isSafeUrl('http://localhost').safe).toBe(false);
    expect(isSafeUrl('http://localhost:3000').safe).toBe(false);
    expect(isSafeUrl('http://127.0.0.1').safe).toBe(false);
    expect(isSafeUrl('http://127.0.1.5:8080').safe).toBe(false);
    expect(isSafeUrl('http://admin.localhost').safe).toBe(false);
  });

  it('rejects private RFC1918 networks', () => {
    expect(isSafeUrl('http://10.0.0.1').safe).toBe(false);
    expect(isSafeUrl('http://192.168.1.1').safe).toBe(false);
    expect(isSafeUrl('http://172.16.0.1').safe).toBe(false);
    expect(isSafeUrl('http://172.31.255.255').safe).toBe(false);
  });

  it('rejects cloud link-local addresses (metadata services)', () => {
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
  });

  it('rejects non-http schemes like ftp, file, gopher', () => {
    expect(isSafeUrl('ftp://example.com').safe).toBe(false);
    expect(isSafeUrl('file:///etc/passwd').safe).toBe(false);
    expect(isSafeUrl('gopher://example.com').safe).toBe(false);
  });
});

describe('Crawler 24-Hour Cache Store', () => {
  beforeEach(() => {
    crawlCache.clear();
  });

  it('stores and retrieves crawl results within TTL', () => {
    const mockResult = {
      domain: 'https://testdomain.com',
      crawlStatus: 'SUCCESS' as const,
      pagesCrawled: 3,
      evidence: [
        {
          id: 'ev-1',
          companyId: 'comp-1',
          type: 'FOUNDER_LED' as const,
          claim: 'Founder-led',
          snippet: 'Founded in 2004',
          sourceUrl: 'https://testdomain.com/about',
          confidence: 0.95,
          extractionMethod: 'rule' as const,
        },
      ],
    };

    crawlCache.set('testdomain.com', mockResult);
    expect(crawlCache.has('https://www.testdomain.com/')).toBe(true);
    const retrieved = crawlCache.get('testdomain.com');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.pagesCrawled).toBe(3);
    expect(retrieved?.evidence.length).toBe(1);
  });

  it('returns cached result on subsequent crawlDomain call without network fetch', async () => {
    const mockResult = {
      domain: 'https://cached-domain.com',
      crawlStatus: 'SUCCESS' as const,
      pagesCrawled: 2,
      evidence: [],
    };
    crawlCache.set('cached-domain.com', mockResult);

    const result = await crawlDomain('cached-domain.com', 'new-comp-id');
    expect(result.cached).toBe(true);
    expect(result.crawlStatus).toBe('SUCCESS');
    expect(result.pagesCrawled).toBe(2);
  });
});
