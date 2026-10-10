import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { Evidence, EvidenceType } from '@deallens/shared';

export interface ExtractedPageContent { url: string; title: string; text: string; headings: string[]; links: string[] }
export function parsePageHtml(html: string, pageUrl: string): ExtractedPageContent {
  const $ = cheerio.load(html);
  const links = $('a[href]').map((_, element) => $(element).attr('href')).get();
  $('script, style, svg, noscript, iframe, nav, footer, header').remove();
  return {
    url: pageUrl, title: $('title').text().trim() || $('h1').first().text().trim() || 'Page',
    text: $('body').text().replace(/\s+/g, ' ').trim(),
    headings: $('h1,h2,h3').map((_, element) => $(element).text().trim()).get().filter(Boolean).slice(0, 10), links,
  };
}

export function extractEvidenceFromPage(page: ExtractedPageContent, companyId: string): Evidence[] {
  const evidence: Evidence[] = [];
  const add = (type: EvidenceType, claim: string, snippet: string, confidence: number, polarity: 'supporting' | 'conflicting' = 'supporting') => {
    const clean = snippet.trim();
    if (evidence.some(e => e.type === type && e.snippet === clean)) return;
    evidence.push({ id: `ev-${createHash('sha256').update(`${companyId}|${page.url}|${type}|${clean}`).digest('hex').slice(0, 24)}`,
      companyId, type, claim, snippet: clean, sourceUrl: page.url, sourcePageTitle: page.title,
      confidence, extractionMethod: 'rule', polarity });
  };
  for (const sentence of page.text.match(/[^.!?]+[.!?]?/g) ?? []) {
    const snippet = sentence.trim();
    if (!snippet || snippet.length > 300) continue;
    if (/no longer (?:founder[- ]led|family[- ]owned|independent)|acquired by|subsidiary of|majority[- ]owned by/i.test(snippet)) {
      add('OTHER', 'Ownership change or conflicting independence indicator; verify current ownership', snippet, 0.9, 'conflicting');
      continue;
    }
    if (/\bnot\b|\bnever\b/i.test(snippet)) continue;
    if (/founder(?:\s+(?:and|&)\s*(?:ceo|president))|(?:ceo|president)(?:\s+(?:and|&)\s*founder)|founder[- ]led|founder[^.!?]{0,70}(?:continues to|currently|still leads)/i.test(snippet)) {
      add('FOUNDER_LED', 'Current founder leadership wording', snippet, 0.9);
    } else if (/founded (?:in \d{4} )?by/i.test(snippet)) {
      add('OTHER', 'Historical founder identified; current leadership not verified', snippet, 0.85);
    }
    if (/family[- ]owned|family business|(?:second|third)[- ]generation/i.test(snippet)) add('FAMILY_OWNED', 'Family ownership or generational wording', snippet, 0.9);
    if (/owner[- ]operated|locally owned and operated/i.test(snippet)) add('OWNER_OPERATED', 'Owner-operation wording', snippet, 0.9);
    const year = snippet.match(/(?:established in|founded in|since)\s+(\d{4})/i);
    const years = snippet.match(/(?:for over|celebrating)\s+(\d+)\s+years/i);
    if ((year && new Date().getUTCFullYear() - Number(year[1]) >= 15 && Number(year[1]) >= 1800) || (years && Number(years[1]) >= 15)) {
      add('OPERATING_HISTORY', 'Public wording indicates at least 15 years of business history', snippet, 0.9);
    }
    if (/privately[- ]held|privately owned|100% employee[- ]owned|bootstrapped|zero outside investors/i.test(snippet)) {
      add('INDEPENDENT', 'Private ownership or bootstrapping wording; investors require verification', snippet, 0.85);
    }
  }
  return evidence;
}
