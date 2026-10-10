import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('../services/crawler/http', () => ({ safeRequest: request }));
import { crawlDomain } from '../services/crawler';
import { crawlCache } from '../services/crawler/cache';
beforeEach(() => { request.mockReset(); crawlCache.clear(); });
describe('Crawler HTTP pipeline', () => {
  it('discovers informative links, bounds pages and retains supporting text', async () => {
    request.mockImplementation(async (url: string) => ({ url, status: 200, contentType: 'text/html', body: '<body><a href="/our-story">Story</a><p>We are owner-operated.</p></body>' }));
    const result = await crawlDomain('https://public.example', 'test');
    expect(result.pagesCrawled).toBe(4); expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls[1][0]).toBe('https://public.example/our-story');
    expect(result.evidence).toHaveLength(1); expect(result.evidence[0].snippet).toContain('owner-operated');
  });
  it('stops when blocked and returns typed timeout, non-HTML and empty outcomes', async () => {
    request.mockResolvedValue({ url: 'https://public.example', status: 429, contentType: 'text/html', body: '' });
    expect((await crawlDomain('public.example', 'test')).crawlStatus).toBe('BLOCKED_OR_UNAVAILABLE'); expect(request).toHaveBeenCalledTimes(1);
    request.mockReset().mockRejectedValue(new Error('CRAWL_TIMEOUT'));
    expect((await crawlDomain('public.example', 'test')).crawlStatus).toBe('TIMEOUT'); expect(request).toHaveBeenCalledTimes(3);
    request.mockReset().mockResolvedValue({ url: 'https://public.example', status: 200, contentType: 'application/pdf', body: 'data' });
    expect((await crawlDomain('public.example', 'test')).error).toBe('NON_HTML');
    request.mockReset().mockResolvedValue({ url: 'https://public.example', status: 200, contentType: 'text/html', body: '<body></body>' });
    expect((await crawlDomain('public.example', 'test')).error).toBe('PARSE_EMPTY');
  });
});
