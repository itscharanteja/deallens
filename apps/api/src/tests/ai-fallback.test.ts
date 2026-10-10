import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDemoDataset } from '@deallens/shared';
const settings = vi.hoisted(() => ({ LLM_API_KEY: '', LLM_MODEL: 'test-model' }));
vi.mock('../lib/config', () => ({ config: settings }));
import { analyzeCompanyTextWithAi } from '../services/ai';
const fixture = getDemoDataset().validList[0];
afterEach(() => { settings.LLM_API_KEY = ''; vi.restoreAllMocks(); });
describe('Optional AI helper fallback', () => {
  it('works without a provider key and makes no network request', async () => {
    const request = vi.spyOn(globalThis, 'fetch');
    const result = await analyzeCompanyTextWithAi(fixture.company, [], fixture.evidence);
    expect(result.signals[0].evidence).toBe(fixture.evidence[0].snippet); expect(request).not.toHaveBeenCalled();
  });
  it('falls back on malformed output rather than losing the evidence', async () => {
    settings.LLM_API_KEY = 'test-only';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{invalid' } }] })));
    const result = await analyzeCompanyTextWithAi(fixture.company, [fixture.evidence[0].snippet], fixture.evidence);
    expect(result.signals[0].evidence).toBe(fixture.evidence[0].snippet);
  });
  it('rejects fabricated quote text even when its JSON schema is valid', async () => {
    settings.LLM_API_KEY = 'test-only';
    const output = { founderLed: false, familyOwned: true, ownerSignalStrength: 1, summary: 'Invented', unknowns: [], signals: [{ type: 'FAMILY_OWNED', evidence: 'Unseen invented quotation', confidence: 1 }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] })));
    const result = await analyzeCompanyTextWithAi(fixture.company, [fixture.evidence[0].snippet], fixture.evidence);
    expect(result.summary).not.toBe('Invented'); expect(result.signals.some(s => s.evidence === 'Unseen invented quotation')).toBe(false);
  });
});
