import {
  AcquisitionThesis,
  Company,
  CompanyAnalysis,
  Evidence,
  DEFAULT_DEMO_THESIS,
  getDemoDataset,
  analyzeCompany,
  CompanySchema, AcquisitionThesisSchema, EvidenceSchema, CompanyAnalysisSchema, AnalysisRunSchema, AnalysisRun,
} from '@deallens/shared';
import { supabase } from './db/supabaseClient';

export class HybridDataStore {
  theses: Map<string, AcquisitionThesis> = new Map();
  companies: Map<string, Company> = new Map();
  evidence: Map<string, Evidence[]> = new Map();
  analyses: Map<string, CompanyAnalysis> = new Map();

  runs: Map<string, AnalysisRun> = new Map();
  persistence: 'memory' | 'supabase' | 'degraded' = 'memory';
  ready: Promise<void>;
  constructor() {
    this.seedLocal();
    this.ready = this.syncWithSupabase();
  }
  private reportFailure(operation: string) {
    this.persistence = 'degraded';
    console.warn(JSON.stringify({ event: 'persistence_failed', operation }));
  }
  private async write(table: string, row: Record<string, unknown>) {
    if (!supabase) return;
    try {
      const { error } = await supabase.from(table).upsert(row);
      if (error) this.reportFailure(`write:${table}`);
    } catch { this.reportFailure(`write:${table}`); }
  }
  getRun(id: string) { return this.runs.get(id); }
  async saveRun(run: AnalysisRun) {
    this.runs.set(run.id, structuredClone(run));
    await this.write('analysis_runs', { id: run.id, thesis_id: run.thesisId, status: run.status,
      company_count: run.results.length, started_at: run.startedAt, completed_at: run.completedAt, payload: run });
  }

  seedLocal() {
    this.theses.set(DEFAULT_DEMO_THESIS.id, DEFAULT_DEMO_THESIS);

    const demo = getDemoDataset();
    for (const item of demo.validList) {
      this.companies.set(item.company.id, item.company);
      this.evidence.set(item.company.id, item.evidence);

      const analysis = analyzeCompany(item.company, DEFAULT_DEMO_THESIS, item.evidence);
      this.analyses.set(item.company.id, analysis);
    }
  }

  async syncWithSupabase() {
    if (!supabase) return;
    const client = supabase;
    this.persistence = 'supabase';
    try {
      const tables = ['acquisition_theses', 'companies', 'company_evidence', 'company_analyses', 'analysis_runs'] as const;
      const remoteAnalyses = new Map<string, CompanyAnalysis>();
      const fetched = await Promise.all(tables.map(table => client.from(table).select('payload')));
      for (let index = 0; index < tables.length; index++) {
        const result = fetched[index];
        if (result.error) { this.reportFailure(`read:${tables[index]}`); continue; }
        for (const row of result.data ?? []) {
          const payload: unknown = row.payload;
          switch (tables[index]) {
            case 'acquisition_theses': { const p = AcquisitionThesisSchema.safeParse(payload); if (p.success) this.theses.set(p.data.id, p.data); else this.reportFailure('invalid:thesis'); break; }
            case 'companies': { const p = CompanySchema.safeParse(payload); if (p.success) this.companies.set(p.data.id, p.data); else this.reportFailure('invalid:company'); break; }
            case 'company_evidence': { const p = EvidenceSchema.safeParse(payload); if (p.success) { const list = this.evidence.get(p.data.companyId) ?? []; if (!list.some(e => e.id === p.data.id)) list.push(p.data); this.evidence.set(p.data.companyId, list); } else this.reportFailure('invalid:evidence'); break; }
            case 'company_analyses': { const p = CompanyAnalysisSchema.safeParse(payload); if (p.success && (!remoteAnalyses.has(p.data.companyId) || remoteAnalyses.get(p.data.companyId)!.analyzedAt < p.data.analyzedAt)) remoteAnalyses.set(p.data.companyId, p.data); else if (!p.success) this.reportFailure('invalid:analysis'); break; }
            case 'analysis_runs': { const p = AnalysisRunSchema.safeParse(payload); if (p.success) this.runs.set(p.data.id, p.data); else this.reportFailure('invalid:run'); break; }
          }
        }
      }
      for (const [id, analysis] of remoteAnalyses) this.analyses.set(id, analysis);
      await this.saveThesis(DEFAULT_DEMO_THESIS);
    } catch { this.reportFailure('hydrate'); }
  }

  getThesis(id: string): AcquisitionThesis | undefined {
    return this.theses.get(id);
  }

  async saveThesis(thesis: AcquisitionThesis) {
    this.theses.set(thesis.id, thesis);
    await this.write('acquisition_theses', { id: thesis.id, name: thesis.name, industry: thesis.industry,
      geography: thesis.geography, min_revenue: thesis.minRevenue, max_revenue: thesis.maxRevenue,
      min_employees: thesis.minEmployees, max_employees: thesis.maxEmployees, min_business_age: thesis.minBusinessAge,
      prefer_founder_led: thesis.preferFounderLed, prefer_independent: thesis.preferIndependent,
      exclusion_keywords: thesis.exclusionKeywords, notes: thesis.notes, payload: thesis });
  }

  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  getAllCompanies(): Company[] {
    return Array.from(this.companies.values());
  }

  async saveCompany(company: Company) {
    this.companies.set(company.id, company);
    await this.write('companies', { id: company.id, name: company.name, domain: company.domain,
      website: company.website, normalized_domain: company.normalizedDomain, industry: company.industry,
      location: company.location, revenue: company.revenue, employees: company.employees,
      founded_year: company.foundedYear, contact_name: company.contactName, contact_title: company.contactTitle,
      contact_email: company.contactEmail, description: company.description, crawl_status: company.crawlStatus,
      crawled_pages_count: company.crawledPagesCount, payload: company });
  }

  getEvidenceForCompany(companyId: string): Evidence[] {
    return this.evidence.get(companyId) || [];
  }

  async setEvidenceForCompany(companyId: string, evidence: Evidence[]) {
    this.evidence.set(companyId, evidence);
    for (const item of evidence) await this.write('company_evidence', { id: item.id, company_id: companyId,
      type: item.type, claim: item.claim, snippet: item.snippet, source_url: item.sourceUrl,
      source_page_title: item.sourcePageTitle, confidence: item.confidence, extraction_method: item.extractionMethod, payload: item });
  }

  getAnalysis(companyId: string): CompanyAnalysis | undefined {
    return this.analyses.get(companyId);
  }

  async saveAnalysis(analysis: CompanyAnalysis) {
    this.analyses.set(analysis.companyId, analysis);
    await this.write('company_analyses', { id: analysis.id, company_id: analysis.companyId, thesis_id: analysis.thesisId,
      fit_score: analysis.fitScore, fit_components: analysis.fitComponents, owner_signal_score: analysis.ownerSignalScore,
      confidence_score: analysis.confidenceScore, action_bucket: analysis.actionBucket, summary: analysis.summary,
      recommended_action: analysis.recommendedAction, unknowns_json: analysis.unknowns, key_signals: analysis.keySignals,
      analyzed_at: analysis.analyzedAt, payload: analysis });
  }
}
export const store = new HybridDataStore();
