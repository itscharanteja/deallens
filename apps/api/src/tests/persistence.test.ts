import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEMO_THESIS, analyzeCompany, getDemoDataset, AnalysisRun } from '@deallens/shared';
const database = vi.hoisted(() => ({ tables: new Map<string, Map<string, Record<string, unknown>>>(), failWrites: false }));
vi.mock('../services/db/supabaseClient', () => ({ supabase: { from: (table: string) => ({
  select: async () => ({ data: Array.from(database.tables.get(table)?.values() ?? []), error: null }),
  upsert: async (row: Record<string, unknown>) => {
    if (database.failWrites) return { error: { message: 'write failed' } };
    const rows = database.tables.get(table) ?? new Map(); rows.set(String(row.id), row); database.tables.set(table, rows);
    return { error: null };
  },
}) } }));
import { HybridDataStore, store } from '../services/store';
beforeAll(async () => { await store.ready; });
beforeEach(() => { database.tables.clear(); database.failWrites = false; });
describe('Validated persistence and restart hydration', () => {
  it('restores company, thesis, evidence, analysis and immutable run snapshots', async () => {
    const first = new HybridDataStore(); await first.ready;
    const fixture = getDemoDataset().validList[0];
    const company = { ...fixture.company, id: 'persisted-company', dataSource: 'live' as const };
    const thesis = { ...DEFAULT_DEMO_THESIS, id: 'persisted-thesis' };
    const evidence = fixture.evidence.map(e => ({ ...e, id: `persisted-${e.id}`, companyId: company.id }));
    const analysis = analyzeCompany(company, thesis, evidence);
    await first.saveThesis(thesis); await first.saveCompany(company); await first.setEvidenceForCompany(company.id, evidence); await first.saveAnalysis(analysis);
    const run: AnalysisRun = { id: 'persisted-run', thesisId: thesis.id, status: 'completed', startedAt: analysis.analyzedAt, completedAt: analysis.analyzedAt, results: [{ company, analysis }] };
    await first.saveRun(run);
    const second = new HybridDataStore(); await second.ready;
    expect(second.getCompany(company.id)).toEqual(company); expect(second.getThesis(thesis.id)).toEqual(thesis);
    expect(second.getEvidenceForCompany(company.id)).toEqual(evidence); expect(second.getAnalysis(company.id)).toEqual(analysis); expect(second.getRun(run.id)).toEqual(run);
    await second.saveCompany({ ...company, revenue: 99 });
    expect(second.getRun(run.id)?.results[0].company.revenue).toBe(company.revenue);
  });
  it('exposes returned database errors while preserving memory fallback', async () => {
    const instance = new HybridDataStore(); await instance.ready;
    database.failWrites = true;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await instance.saveThesis({ ...DEFAULT_DEMO_THESIS, id: 'failed-write' });
    expect(instance.persistence).toBe('degraded'); expect(instance.getThesis('failed-write')).toBeDefined(); expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });
});
