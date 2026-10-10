import { Company, CompanySchema, CsvImportResult, EnrichedCompanyResult, QueueFilters, ActionBucket, AcquisitionThesis } from '../schemas/index';
import { normalizeDomain } from '../scoring/index';

export const BUCKET_LABELS: Record<ActionBucket, string> = {
  PURSUE_NOW: 'Pursue now', RESEARCH_OWNER: 'Research owner', MONITOR: 'Monitor', SKIP: 'Skip',
};
export const CSV_MAX_BYTES = 1_000_000;
export const CSV_MAX_ROWS = 1000;
export const CSV_FIELDS = ['company_name', 'website', 'industry', 'location', 'revenue', 'employees', 'founded_year', 'contact_name', 'contact_title', 'contact_email', 'linkedin_url'] as const;
export type CsvField = typeof CSV_FIELDS[number];
export type CsvMapping = Partial<Record<CsvField, string>>;

export function safeWebsite(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return null;
    return url.href;
  } catch { return null; }
}

// A small RFC 4180 parser: quoted commas, escaped quotes, CRLF, and multiline cells.
export function readCsv(text: string): string[][] {
  if (new TextEncoder().encode(text).length > CSV_MAX_BYTES) throw new Error('Choose a CSV smaller than 1 MB.');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, '');
  const finishCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(Boolean)) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === ',') finishCell();
    else if (c === '\n' || c === '\r') { finishRow(); if (c === '\r' && input[i + 1] === '\n') i++; }
    else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === '"' || (closed && c.trim())) throw new Error('A quoted field is malformed. Check quotes and commas in your CSV.');
    else cell += c;
    if (rows.length > CSV_MAX_ROWS + 1) throw new Error('Import up to 1,000 companies at a time.');
  }
  if (quoted) throw new Error('A quoted field is not closed. Check the final quotation mark.');
  if (cell || row.length) finishRow();
  if (rows.length < 2) throw new Error('Include column headers and at least one company row.');
  if (rows.length - 1 > CSV_MAX_ROWS) throw new Error('Import up to 1,000 companies at a time.');
  if (new Set(rows[0]).size !== rows[0].length || rows[0].some(h => !h)) throw new Error('Use a unique, non-empty name for each column.');
  return rows;
}

export function suggestCsvMapping(headers: string[]): CsvMapping {
  const aliases: Record<CsvField, string[]> = {
    company_name: ['company_name', 'company', 'name', 'business_name'], website: ['website', 'domain', 'url', 'company_website'],
    industry: ['industry', 'sector'], location: ['location', 'geography', 'country'], revenue: ['revenue', 'annual_revenue'],
    employees: ['employees', 'employee_count', 'headcount'], founded_year: ['founded_year', 'founded', 'year_founded'],
    contact_name: ['contact_name', 'decision_maker'], contact_title: ['contact_title', 'title'], contact_email: ['contact_email', 'email'], linkedin_url: ['linkedin_url', 'linkedin'],
  };
  const result: CsvMapping = {};
  for (const field of CSV_FIELDS) result[field] = headers.find(h => aliases[field].includes(h.toLowerCase().trim().replace(/[\s-]+/g, '_')));
  return result;
}

export function importCsv(text: string, existing: Company[] = [], mapping?: CsvMapping): CsvImportResult {
  const [headers, ...rows] = readCsv(text);
  const columns = mapping ?? suggestCsvMapping(headers);
  if (!columns.company_name) throw new Error('Map a column to Company name before continuing.');
  const seen = new Set(existing.map(c => c.normalizedDomain || `name:${c.name.trim().toLowerCase()}`));
  const result: CsvImportResult = { companies: [], totalRows: rows.length, duplicates: 0, issues: [] };
  rows.forEach((row, index) => {
    try {
      if (row.length !== headers.length) throw new Error('Column count does not match the header.');
      const get = (field: CsvField) => columns[field] ? row[headers.indexOf(columns[field]!)]?.trim() || '' : '';
      const name = get('company_name');
      if (!name) throw new Error('Company name is missing.');
      const raw = get('website');
      const website = raw ? safeWebsite(raw) : '';
      if (raw && !website) throw new Error('Website must be a valid HTTP or HTTPS address.');
      const domain = website ? normalizeDomain(website) : '';
      const key = domain || `name:${name.toLowerCase()}`;
      if (seen.has(key)) { result.duplicates++; return; }
      const number = (field: CsvField) => {
        const value = get(field);
        if (!value) return null;
        const n = Number(value.replace(/[$,\s]/g, ''));
        if (!Number.isFinite(n) || n < 0 || (field !== 'revenue' && !Number.isInteger(n))) throw new Error(`${field.replace('_', ' ')} must be a positive number (for example, 4500000).`);
        if (field === 'founded_year' && (n < 1800 || n > new Date().getFullYear())) throw new Error('Founded year must be between 1800 and the current year.');
        return n;
      };
      const company = CompanySchema.parse({
        id: `import-${encodeURIComponent(key)}`, name, domain, website: website || '', normalizedDomain: domain,
        industry: get('industry') || 'Unknown', location: get('location') || 'Unknown',
        revenue: number('revenue'), employees: number('employees'), foundedYear: number('founded_year'),
        contactName: get('contact_name') || null, contactTitle: get('contact_title') || null,
        contactEmail: get('contact_email') || null, linkedinUrl: safeWebsite(get('linkedin_url')),
        crawlStatus: 'PENDING', crawledPagesCount: 0, dataSource: 'imported',
      });
      seen.add(key); result.companies.push(company);
    } catch (e) { result.issues.push({ row: index + 2, message: e instanceof Error ? e.message : 'Invalid company row.' }); }
  });
  return result;
}

export function filterQueue(items: EnrichedCompanyResult[], filters: QueueFilters): EnrichedCompanyResult[] {
  const q = filters.search.trim().toLowerCase();
  const priority: Record<ActionBucket, number> = { PURSUE_NOW: 0, RESEARCH_OWNER: 1, MONITOR: 2, SKIP: 3 };
  return items.filter(({ company: c, analysis: a }) =>
    (!q || [c.name, c.domain, c.industry, c.location, c.contactName].some(v => v?.toLowerCase().includes(q))) &&
    (filters.bucket === 'ALL' || a.actionBucket === filters.bucket) &&
    (filters.industry === 'ALL' || c.industry === filters.industry) &&
    (filters.source === 'ALL' || (c.dataSource ?? 'imported') === filters.source) &&
    a.fitScore >= filters.minFit && a.confidenceScore >= filters.minConfidence &&
    (filters.evidence === 'ALL' || (filters.evidence === 'HAS_EVIDENCE' && a.evidence.length > 0) ||
      (filters.evidence === 'NEEDS_RESEARCH' && a.evidence.length === 0) ||
      (filters.evidence === 'FETCH_FAILED' && ['FAILED', 'TIMEOUT', 'BLOCKED_OR_UNAVAILABLE'].includes(c.crawlStatus)))
  ).sort((a, b) => {
    if (filters.sort === 'name') return a.company.name.localeCompare(b.company.name);
    if (filters.sort === 'fit') return b.analysis.fitScore - a.analysis.fitScore || a.company.name.localeCompare(b.company.name);
    if (filters.sort === 'confidence') return b.analysis.confidenceScore - a.analysis.confidenceScore || a.company.name.localeCompare(b.company.name);
    return priority[a.analysis.actionBucket] - priority[b.analysis.actionBucket] || b.analysis.fitScore - a.analysis.fitScore || a.company.name.localeCompare(b.company.name);
  });
}

export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Preserve text as text in spreadsheet applications, including formula-like company names.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function exportQueue(items: EnrichedCompanyResult[]): string {
  const headers = ['company_name', 'domain', 'industry', 'location', 'revenue', 'employees', 'fit_score', 'owner_signal_score', 'confidence_score', 'action_bucket', 'decision_maker', 'decision_maker_title', 'email', 'recommended_action', 'evidence_count', 'evidence_urls', 'research_notes', 'data_source', 'crawl_status'];
  return [headers.join(','), ...items.map(({ company: c, analysis: a }) => [c.name, c.normalizedDomain, c.industry, c.location, c.revenue, c.employees, a.fitScore, a.ownerSignalScore, a.confidenceScore, BUCKET_LABELS[a.actionBucket], c.contactName, c.contactTitle, c.contactEmail, a.recommendedAction, a.evidence.length, Array.from(new Set(a.evidence.map(e => e.sourceUrl))).join(' | '), a.unknowns.join(' | '), c.dataSource ?? 'imported', c.crawlStatus].map(csvCell).join(','))].join('\r\n');
}
export function createBrief({ company: c, analysis: a }: EnrichedCompanyResult): string {
  return `# ${c.name} — acquisition research brief\n\nData source: ${c.dataSource === 'demo' ? 'DEMO FIXTURE — illustrative, not verified research' : 'Imported company details; public website evidence where available'}\nWebsite: ${c.website || 'Unknown'}\nIndustry: ${c.industry}\nLocation: ${c.location}\nReported revenue: ${c.revenue ?? 'Unknown'} (not independently verified)\nEmployees: ${c.employees ?? 'Unknown'}\n\n## Research priority\n${BUCKET_LABELS[a.actionBucket]}\nFit: ${a.fitScore}/100 · Owner signal: ${a.ownerSignalScore}/100 · Confidence: ${a.confidenceScore}/100\n\n## Why this company\n${a.summary}\n\n## Evidence\n${a.evidence.map(e => `- ${e.claim}\n  Quote: “${e.snippet}”\n  Source: ${e.sourceUrl}\n  Method: ${e.extractionMethod}; extraction confidence: ${Math.round(e.confidence * 100)}%`).join('\n') || 'Insufficient evidence. Requires manual research.'}\n\n## Unknowns\n${a.unknowns.map(u => `- ${u}`).join('\n')}\n- Owner willingness to sell is unknown.\n\n## Next action\n${a.recommendedAction}\n`;
}

export function createDealBook(
  items: EnrichedCompanyResult[],
  thesis?: AcquisitionThesis,
  title = 'DealLens Acquisition Deal Book'
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const pursueNow = items.filter(x => x.analysis.actionBucket === 'PURSUE_NOW');
  const researchOwner = items.filter(x => x.analysis.actionBucket === 'RESEARCH_OWNER');
  const monitor = items.filter(x => x.analysis.actionBucket === 'MONITOR');
  const skip = items.filter(x => x.analysis.actionBucket === 'SKIP');

  const thesisSection = thesis
    ? `\n### Target Acquisition Buy-Box\n- **Target Industry:** ${thesis.industry}\n- **Revenue Target:** $${(thesis.minRevenue / 1_000_000).toFixed(1)}M – $${(thesis.maxRevenue / 1_000_000).toFixed(1)}M\n- **Team Size:** ${thesis.minEmployees} – ${thesis.maxEmployees} employees\n- **Target Geography:** ${thesis.geography || 'Any'}\n`
    : '';

  const triageTable = [
    '| Company | Action Bucket | Fit Score | Owner Signal | Confidence | Industry | Location |',
    '| :--- | :--- | :---: | :---: | :---: | :--- | :--- |',
    ...items.map(
      x =>
        `| [${x.company.name}](#${x.company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}) | ${BUCKET_LABELS[x.analysis.actionBucket]} | ${x.analysis.fitScore}/100 | ${x.analysis.ownerSignalScore}/100 | ${x.analysis.confidenceScore}/100 | ${x.company.industry} | ${x.company.location} |`
    ),
  ].join('\n');

  const toc = items
    .map(
      (x, i) =>
        `${i + 1}. [${x.company.name}](#${x.company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}) — ${BUCKET_LABELS[x.analysis.actionBucket]} (Fit: ${x.analysis.fitScore}/100, Owner: ${x.analysis.ownerSignalScore}/100)`
    )
    .join('\n');

  const executiveSummary = `# ${title}\n*Generated: ${timestamp} · Total Candidates: ${items.length}*\n${thesisSection}\n## Executive Summary & Triage Matrix\n- **Pursue Now (Immediate Outreach):** ${pursueNow.length} companies\n- **Research Owner (Cap Table Due Diligence):** ${researchOwner.length} companies\n- **Monitor (Quarterly Pipeline):** ${monitor.length} companies\n- **Skip (Archived):** ${skip.length} companies\n\n${triageTable}\n\n## Table of Contents\n${toc}\n\n---\n\n`;

  const briefs = items.map(item => createBrief(item)).join('\n---\n\n');

  return executiveSummary + briefs;
}
