import { describe, it, expect } from 'vitest';
import { parsePageHtml, extractEvidenceFromPage } from '../services/extraction';
const extract = (text: string, url = 'https://test.example/about') => extractEvidenceFromPage(parsePageHtml(`<body><p>${text}</p></body>`, url), 'test');
describe('Conservative evidence extraction', () => {
  it('does not equate historical founders with current leadership', () => {
    expect(extract('Founded by Jane Smith in 1998.').map(e => e.type)).toEqual(['OTHER']);
    expect(extract('Our founder continues to lead the business as CEO.').some(e => e.type === 'FOUNDER_LED')).toBe(true);
  });
  it('does not infer investors, generations or history length from weak wording', () => {
    expect(extract('We are debt-free.')).toHaveLength(0);
    expect(extract('Established in 2024.')).toHaveLength(0);
    expect(extract('We are family-owned.')[0].claim).not.toContain('Multi-generational');
    expect(extract('We are privately held.')[0].claim).toContain('investors require verification');
  });
  it('retains conflicting ownership statements without awarding supporting ownership points', () => {
    expect(extract('We are no longer founder-led.')[0].polarity).toBe('conflicting');
    expect(extract('We were acquired by a parent company.')[0].type).toBe('OTHER');
  });
  it('uses stable page-specific evidence IDs and discovers links without rendering HTML', () => {
    const first = extract('We are owner-operated.');
    expect(first[0].id).not.toBe(extract('We are owner-operated.', 'https://test.example/team')[0].id);
    expect(extract('We are owner-operated.')[0].id).toBe(first[0].id);
    const page = parsePageHtml('<body><nav>Noise</nav><script>secret</script><a href="/our-story">Story</a><p>Useful content</p></body>', 'https://test.example');
    expect(page.links).toContain('/our-story'); expect(page.text).not.toContain('secret'); expect(page.text).not.toContain('Noise');
  });
});
