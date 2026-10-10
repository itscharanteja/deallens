import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { importCsv } from '@deallens/shared';
vi.mock('../services/db/supabaseClient', () => ({ supabase: null }));
vi.mock('../services/crawler/index', () => ({ crawlDomain: vi.fn(async () => ({ domain: 'api-test.example', crawlStatus: 'TIMEOUT', pagesCrawled: 0, evidence: [] })) }));
import { buildApp } from '../app';
let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); });
afterAll(async () => { await app.close(); });
describe('Research workflow API', () => {
  it('serves the demo queue without a live provider', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/companies' });
    expect(response.statusCode).toBe(200); expect(response.json().data.length).toBeGreaterThan(25);
  });
  it('validates imports and returns the same unknown states as the UI', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/imports/csv', payload: { csvText: 'name\nAPI Test Company' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.companies[0]).toMatchObject({ industry: 'Unknown', crawlStatus: 'PENDING', crawledPagesCount: 0 });
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/imports/csv', payload: { csvText: 'website\nexample.com' } });
    expect(invalid.statusCode).toBe(400); expect(invalid.json().error.code).toBe('CSV_INVALID');
  });
  it('registers a browser-session import for research and exposes typed crawl failure', async () => {
    const company = importCsv('name,website\nResearch Test,api-test.example').companies[0];
    const response = await app.inject({ method: 'POST', url: `/api/v1/companies/${encodeURIComponent(company.id)}/enrich`, payload: { company } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.company.crawlStatus).toBe('TIMEOUT');
    expect(response.json().data.crawlSummary.pagesCrawled).toBe(0);
  });
  it('rejects a mismatched company rather than researching another record', async () => {
    const company = importCsv('name,website\nWrong ID,api-test.example').companies[0];
    const response = await app.inject({ method: 'POST', url: '/api/v1/companies/different/enrich', payload: { company } });
    expect(response.statusCode).toBe(400);
  });
  it('dispatches qualified deals to simulated CRM pipeline', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/crm-push',
      payload: {
        stage: 'Sourcing Queue',
        scope: 'pursue_now',
        companies: [
          {
            id: 'c1',
            name: 'Apex Managed Solutions',
            domain: 'apexmanaged.com',
            industry: 'IT Services',
            location: 'Austin, TX',
            revenue: 6500000,
            employees: 42,
            contactName: 'Marcus Vance',
            contactTitle: 'Founder & CEO',
            contactEmail: 'mvance@apexmanaged.com',
            fitScore: 88,
            ownerSignalScore: 85,
            confidenceScore: 92,
            actionBucket: 'PURSUE_NOW',
            recommendedAction: 'Initiate discreet founder outreach',
            keySignals: ['FOUNDER_LED'],
            evidenceUrls: ['https://apexmanaged.com/about'],
            unknowns: [],
          },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.success).toBe(true);
    expect(response.json().data.mode).toBe('simulated_crm');
    expect(response.json().data.dispatched).toBe(1);
    expect(response.json().data.batchId).toMatch(/^BATCH-CRM-/);
  });
  it('blocks SSRF attempts on external webhook URLs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/crm-push',
      payload: {
        webhookUrl: 'http://127.0.0.1:8080/hook',
        companies: [
          {
            id: 'c1',
            name: 'Apex Managed Solutions',
            domain: 'apexmanaged.com',
            industry: 'IT Services',
            location: 'Austin, TX',
            fitScore: 88,
            ownerSignalScore: 85,
            confidenceScore: 92,
            actionBucket: 'PURSUE_NOW',
            recommendedAction: 'Initiate outreach',
          },
        ],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('SSRF_BLOCKED');
  });
});

describe('Analysis history contracts', () => {
  it('rejects invalid input and unknown thesis/run IDs', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/v1/analysis', payload: { companyIds: 42 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/analysis', payload: { thesisId: 'missing-thesis' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/v1/analysis/missing-run' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/v1/analysis/missing-run/export.csv' })).statusCode).toBe(404);
  });
  it('keeps run snapshots isolated and exports provenance with safe spreadsheet values', async () => {
    const imports = await app.inject({ method: 'POST', url: '/api/v1/imports/csv', payload: { csvText: 'name,website\n=Formula,formula.example\nSecond Company,second.example' } });
    const companies = imports.json().data.companies;
    const first = await app.inject({ method: 'POST', url: '/api/v1/analysis', payload: { companyIds: [companies[0].id] } });
    const runId = first.json().data.analysisRunId;
    await app.inject({ method: 'POST', url: '/api/v1/analysis', payload: { companyIds: [companies[1].id] } });
    const saved = await app.inject({ method: 'GET', url: `/api/v1/analysis/${runId}` });
    expect(saved.json().data.results).toHaveLength(1); expect(saved.json().data.results[0].company.id).toBe(companies[0].id);
    const csv = await app.inject({ method: 'GET', url: `/api/v1/analysis/${runId}/export.csv` });
    expect(csv.body).toContain('evidence_urls'); expect(csv.body).toContain("'=Formula"); expect(csv.body).not.toContain('Second Company');
    const brief = await app.inject({ method: 'POST', url: '/api/v1/companies/demo-northstar-example/brief' });
    expect(brief.json().data.briefMarkdown).toContain('DEMO FIXTURE');
  });
});

describe('Public API resource limits', () => {
  it('bounds POST requests with typed rate-limit guidance', async () => {
    const limited = await buildApp();
    for (let count = 0; count < 30; count++) await limited.inject({ method: 'POST', url: '/api/v1/analysis', payload: { companyIds: 42 } });
    const response = await limited.inject({ method: 'POST', url: '/api/v1/analysis', payload: {} });
    expect(response.statusCode).toBe(429); expect(response.json().error.code).toBe('RATE_LIMITED'); expect(response.headers['retry-after']).toBe('60');
    await limited.close();
  });
});
