import { describe, it, expect } from 'vitest';
import { importCsv, readCsv, suggestCsvMapping, filterQueue, exportQueue, createBrief, createDealBook, QueueFiltersSchema, getDemoDataset, analyzeCompany, DEFAULT_DEMO_THESIS, CompanySchema, AcquisitionThesisSchema, calculateFitScore } from '@deallens/shared';
const demo = getDemoDataset();
const results = demo.validList.map(({ company, evidence }) => ({ company, analysis: analyzeCompany(company, DEFAULT_DEMO_THESIS, evidence) }));

describe('CSV import workflow', () => {
  it('reads quoted commas, escaped quotes, multiline cells and CRLF', () => {
    const rows = readCsv('name,location\r\n"Acme ""Technology""","Austin, TX\nUnited States"\r\n');
    expect(rows[1]).toEqual(['Acme "Technology"', 'Austin, TX\nUnited States']);
  });
  it('keeps missing company facts unknown and starts uncrawled', () => {
    const result = importCsv('company_name\nAcme');
    expect(result.companies[0]).toMatchObject({ name: 'Acme', website: '', industry: 'Unknown', location: 'Unknown', revenue: null, crawlStatus: 'PENDING', crawledPagesCount: 0, dataSource: 'imported' });
    expect(CompanySchema.safeParse(result.companies[0]).success).toBe(true);
  });
  it('normalizes headers and supports explicit column mapping', () => {
    expect(suggestCsvMapping(['Company Name', 'Annual Revenue'])).toMatchObject({ company_name: 'Company Name', revenue: 'Annual Revenue' });
    expect(importCsv('Business,Site\nAcme,acme.example', [], { company_name: 'Business', website: 'Site' }).companies[0].website).toBe('https://acme.example/');
  });
  it('deduplicates within the file and against the workspace', () => {
    const existing = importCsv('name,domain\nAcme,https://www.acme.example').companies;
    const result = importCsv('name,domain\nAcme,acme.example\nBeta,beta.example\nBeta Copy,www.beta.example', existing);
    expect(result.duplicates).toBe(2); expect(result.companies).toHaveLength(1);
  });
  it('reports invalid rows without discarding valid companies', () => {
    const result = importCsv('name,domain,revenue\nGood,good.example,5000000\nBad,bad.example,5M\n,missing.example,20');
    expect(result.companies).toHaveLength(1); expect(result.issues.map(x => x.row)).toEqual([3, 4]);
  });
  it('rejects unsafe schemes and negative or ambiguous numbers', () => {
    expect(importCsv('name,website\nBad,javascript:alert(1)').issues).toHaveLength(1);
    expect(importCsv('name,employees\nBad,-1').issues).toHaveLength(1);
    expect(importCsv('name,employees\nBad,3.2').issues).toHaveLength(1);
  });
  it('rejects malformed CSV, missing name mapping, and oversize input', () => {
    expect(() => readCsv('name\n"Unclosed')).toThrow('not closed');
    expect(() => importCsv('website\nexample.com')).toThrow('Company name');
    expect(() => readCsv('name\n' + 'a'.repeat(1_000_001))).toThrow('1 MB');
    expect(() => readCsv('name,name\nAcme,Acme')).toThrow('unique');
  });
});

describe('Queue, evidence and export stay aligned', () => {
  it('changes results when the industry changes on its own', () => {
    const industry = results[0].company.industry;
    const filtered = filterQueue(results, QueueFiltersSchema.parse({ industry }));
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(x => x.company.industry === industry)).toBe(true);
    expect(filterQueue(results, QueueFiltersSchema.parse({ industry: 'No such industry' }))).toHaveLength(0);
  });
  it('combines search, bucket, score and source filters', () => {
    const target = results[0];
    const filtered = filterQueue(results, QueueFiltersSchema.parse({ search: `  ${target.company.name}  `, source: 'demo', bucket: target.analysis.actionBucket, minFit: target.analysis.fitScore }));
    expect(filtered.map(x => x.company.id)).toEqual([target.company.id]);
  });
  it('includes timeout states in the failed-fetch filter', () => {
    const filtered = filterQueue(results, QueueFiltersSchema.parse({ evidence: 'FETCH_FAILED' }));
    expect(filtered.some(x => x.company.crawlStatus === 'TIMEOUT')).toBe(true);
    expect(filtered.every(x => ['TIMEOUT', 'FAILED', 'BLOCKED_OR_UNAVAILABLE'].includes(x.company.crawlStatus))).toBe(true);
  });
  it('exports only the supplied view, including evidence provenance and data source', () => {
    const visible = filterQueue(results, QueueFiltersSchema.parse({ bucket: 'PURSUE_NOW' }));
    expect(visible.length).toBeGreaterThan(0);
    const rows = readCsv(exportQueue(visible));
    expect(rows).toHaveLength(visible.length + 1);
    expect(rows[0]).toContain('evidence_urls'); expect(rows[0]).toContain('data_source');
    expect(rows[1][rows[0].indexOf('evidence_urls')]).toContain(visible[0].analysis.evidence[0].sourceUrl);
    expect(rows[1][rows[0].indexOf('data_source')]).toBe('demo');
  });
  it('neutralizes spreadsheet formulas while preserving quotes', () => {
    const target = { ...results[0], company: { ...results[0].company, name: '=HYPERLINK("bad")' } };
    expect(readCsv(exportQueue([target]))[1][0]).toBe('\'=HYPERLINK("bad")');
  });
  it('keeps demo labeling and supporting quotes in the research brief', () => {
    const brief = createBrief(results[0]);
    expect(brief).toContain('DEMO FIXTURE'); expect(brief).toContain(results[0].analysis.evidence[0].snippet); expect(brief).toContain('willingness to sell is unknown');
  });
  it('compiles multi-candidate Markdown deal books with triage matrix and evidence citations', () => {
    const candidates = results.slice(0, 3);
    const book = createDealBook(candidates, DEFAULT_DEMO_THESIS, 'Q4 Sourcing Deal Book');
    expect(book).toContain('# Q4 Sourcing Deal Book');
    expect(book).toContain('## Executive Summary & Triage Matrix');
    expect(book).toContain('| Company | Action Bucket | Fit Score | Owner Signal | Confidence | Industry | Location |');
    expect(book).toContain('## Table of Contents');
    expect(book).toContain(`1. [${candidates[0].company.name}]`);
    expect(book).toContain(`Website: ${candidates[0].company.website}`);
    expect(book).toContain('## Evidence');
    expect(book).toContain(candidates[0].analysis.evidence[0].snippet);
    expect(book).toContain('## Unknowns');
    expect(book).toContain('Owner willingness to sell is unknown.');
    expect(book).toContain('## Next action');
  });
  it('retains a complete offline demo with valid company contracts', () => {
    expect(results.length).toBeGreaterThanOrEqual(40);
    expect(demo.duplicateCount).toBeGreaterThan(0);
    expect(results.every(x => CompanySchema.safeParse(x.company).success)).toBe(true);
    expect(results.every(x => !x.company.domain || x.company.domain.endsWith('.example'))).toBe(true);
    expect(new Set(results.map(x => x.analysis.actionBucket)).size).toBe(4);
  });
});

describe('Acquisition criteria usability', () => {
  it('rejects inverted ranges and empty criteria', () => {
    expect(AcquisitionThesisSchema.safeParse({ ...DEFAULT_DEMO_THESIS, minRevenue: 20_000_000 }).success).toBe(false);
    expect(AcquisitionThesisSchema.safeParse({ ...DEFAULT_DEMO_THESIS, minEmployees: 90 }).success).toBe(false);
    expect(AcquisitionThesisSchema.safeParse({ ...DEFAULT_DEMO_THESIS, industry: ' ' }).success).toBe(false);
  });
  it('treats disabled ownership preferences as satisfied criteria', () => {
    const company = { ...results[0].company, description: '' };
    const required = calculateFitScore(company, DEFAULT_DEMO_THESIS, []);
    const optional = calculateFitScore(company, { ...DEFAULT_DEMO_THESIS, preferFounderLed: false, preferIndependent: false }, []);
    expect(required.components.founderLed).toBeLessThan(10);
    expect(optional.components.founderLed).toBe(10); expect(optional.components.independent).toBe(10);
  });
});
