import pLimit from 'p-limit';
import { safeRequest } from './http';
import { parsePageHtml, extractEvidenceFromPage } from '../extraction/index';
import { crawlCache } from './cache';
import { Evidence, CrawlStatus } from '@deallens/shared';
import { config } from '../../lib/config';

export interface CrawlResult {
  domain: string; crawlStatus: CrawlStatus; pagesCrawled: number;
  evidence: Evidence[]; error?: string; cached?: boolean;
}
const domainLimiter = pLimit(config.CRAWL_MAX_CONCURRENCY);
export async function crawlDomain(targetUrl: string, companyId: string, forceRefresh = false): Promise<CrawlResult> {
  if (!forceRefresh) {
    const cached = crawlCache.get(targetUrl);
    if (cached) return { ...cached, evidence: cached.evidence.map(e => ({ ...e, companyId, id: `${companyId}-${e.id}` })), cached: true };
  }
  return domainLimiter(async () => {
    if (!targetUrl.trim()) return { domain: '', crawlStatus: 'FAILED', pagesCrawled: 0, evidence: [], error: 'MISSING_WEBSITE' };
    let base: URL;
    try { base = new URL(/^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`); }
    catch { return { domain: targetUrl, crawlStatus: 'FAILED', pagesCrawled: 0, evidence: [], error: 'INVALID_URL' }; }
    const evidence: Evidence[] = [];
    let pagesCrawled = 0;
    let error: string | undefined;
    let blocked = false;
    let timeout = false;
    const urls = [base.href];
    for (let page = 0; page < urls.length && page < 4; page++) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await safeRequest(urls[page], { timeoutMs: config.CRAWL_TIMEOUT_MS });
          if ([401, 403, 429].includes(response.status)) { blocked = true; error = 'BLOCKED_OR_UNAVAILABLE'; break; }
          if (response.status >= 500) { error = 'HTTP_UNAVAILABLE'; continue; }
          if (response.status < 200 || response.status >= 300) { error = 'HTTP_UNAVAILABLE'; break; }
          if (!/text\/html|application\/xhtml/i.test(response.contentType)) { error = 'NON_HTML'; break; }
          const parsed = parsePageHtml(response.body, response.url);
          if (!parsed.text.trim()) { error = 'PARSE_EMPTY'; break; }
          pagesCrawled++;
          for (const item of extractEvidenceFromPage(parsed, companyId)) {
            if (!evidence.some(e => e.type === item.type && e.snippet.toLowerCase() === item.snippet.toLowerCase())) evidence.push(item);
          }
          if (page === 0) {
            const home = new URL(response.url);
            base = home;
            const discovered = parsed.links.map(href => { try { return new URL(href, home); } catch { return null; } })
              .filter((url): url is URL => !!url && url.origin === home.origin && /\/(about|about-us|team|leadership|company|our-story|contact)(\/|$)/i.test(url.pathname));
            urls.push(...Array.from(new Set([...discovered.map(url => url.href), ...['/about', '/team', '/leadership'].map(path => new URL(path, home).href)])).filter(url => url !== home.href).slice(0, 3));
          }
          break;
        } catch (failure) {
          error = failure instanceof Error ? failure.message : 'NETWORK_FAILURE';
          if (error === 'CRAWL_TIMEOUT') timeout = true;
          if (['SSRF_BLOCKED', 'REDIRECT_BLOCKED', 'RESPONSE_TOO_LARGE'].includes(error)) { blocked = true; break; }
        }
      }
      if (blocked) break;
    }
    const crawlStatus: CrawlStatus = pagesCrawled > 0 ? (pagesCrawled === 4 ? 'SUCCESS' : 'PARTIAL') : blocked ? 'BLOCKED_OR_UNAVAILABLE' : timeout ? 'TIMEOUT' : 'FAILED';
    if (crawlStatus === 'SUCCESS') error = undefined;
    const result: CrawlResult = { domain: base.origin, crawlStatus, pagesCrawled, evidence, error };
    if (pagesCrawled > 0) crawlCache.set(targetUrl, result);
    return result;
  });
}
