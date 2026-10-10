import { z } from 'zod';

export const ActionBucketEnum = z.enum([
  'PURSUE_NOW',
  'RESEARCH_OWNER',
  'MONITOR',
  'SKIP',
]);
export type ActionBucket = z.infer<typeof ActionBucketEnum>;

export const EvidenceTypeEnum = z.enum([
  'FOUNDER_LED',
  'FAMILY_OWNED',
  'OWNER_OPERATED',
  'OPERATING_HISTORY',
  'INDEPENDENT',
  'LEADERSHIP',
  'LOCATION',
  'INDUSTRY',
  'OTHER',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeEnum>;

export const ExtractionMethodEnum = z.enum(['rule', 'llm', 'structured_data']);
export type ExtractionMethod = z.infer<typeof ExtractionMethodEnum>;

export const EvidenceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  polarity: z.enum(['supporting', 'conflicting']).optional(),
  type: EvidenceTypeEnum,
  claim: z.string(),
  snippet: z.string(),
  sourceUrl: z.string().url(),
  sourcePageTitle: z.string().optional(),
  confidence: z.number().min(0).max(1),
  extractionMethod: ExtractionMethodEnum,
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CrawlStatusEnum = z.enum([
  'PENDING',
  'SUCCESS',
  'PARTIAL',
  'BLOCKED_OR_UNAVAILABLE',
  'TIMEOUT',
  'FAILED',
]);
export type CrawlStatus = z.infer<typeof CrawlStatusEnum>;

export const CompanySchema = z.object({
  dataSource: z.enum(['demo', 'imported', 'live']).optional(),
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  website: z.string(),
  normalizedDomain: z.string(),
  industry: z.string(),
  location: z.string(),
  revenue: z.number().finite().nonnegative().nullable().optional(),
  employees: z.number().int().nonnegative().nullable().optional(),
  foundedYear: z.number().int().min(1800).max(new Date().getUTCFullYear()).nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactTitle: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  crawlStatus: CrawlStatusEnum.default('PENDING'),
  crawledPagesCount: z.number().int().min(0).max(4).default(0),
});
export type Company = z.infer<typeof CompanySchema>;

export const AcquisitionThesisSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'Give your criteria a name.'),
  industry: z.string().trim().min(1, 'Enter a target industry.'),
  geography: z.string().trim().min(1, 'Enter a target geography.'),
  minRevenue: z.number().min(0),
  maxRevenue: z.number().min(0),
  minEmployees: z.number().min(0),
  maxEmployees: z.number().min(0),
  minBusinessAge: z.number().min(0),
  preferFounderLed: z.boolean().default(true),
  preferIndependent: z.boolean().default(true),
  exclusionKeywords: z.array(z.string()).default([]),
  notes: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.maxRevenue < value.minRevenue) ctx.addIssue({ code: 'custom', path: ['maxRevenue'], message: 'Maximum revenue must be at least the minimum.' });
  if (value.maxEmployees < value.minEmployees) ctx.addIssue({ code: 'custom', path: ['maxEmployees'], message: 'Maximum employees must be at least the minimum.' });
});
export type AcquisitionThesis = z.infer<typeof AcquisitionThesisSchema>;

export const FitComponentsSchema = z.object({
  industry: z.number(),
  geography: z.number(),
  revenue: z.number(),
  employees: z.number(),
  age: z.number(),
  founderLed: z.number(),
  independent: z.number(),
});
export type FitComponents = z.infer<typeof FitComponentsSchema>;

export const CompanyAnalysisSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  thesisId: z.string(),
  fitScore: z.number().min(0).max(100),
  fitComponents: FitComponentsSchema,
  ownerSignalScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  actionBucket: ActionBucketEnum,
  summary: z.string(),
  recommendedAction: z.string(),
  unknowns: z.array(z.string()),
  keySignals: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
  analyzedAt: z.string(),
});
export type CompanyAnalysis = z.infer<typeof CompanyAnalysisSchema>;

export const EnrichedCompanyResultSchema = z.object({
  company: CompanySchema,
  analysis: CompanyAnalysisSchema,
});
export type EnrichedCompanyResult = z.infer<typeof EnrichedCompanyResultSchema>;

export const EnrichmentResponseSchema = z.object({
  meta: z.object({ persistence: z.enum(['memory', 'supabase', 'degraded']) }).optional(),
  data: z.object({
    company: CompanySchema,
    evidence: z.array(EvidenceSchema),
    crawlSummary: z.object({ status: CrawlStatusEnum, pagesCrawled: z.number(), error: z.string().optional() }),
  }),
});
export const EnrichmentRequestSchema = z.object({ company: CompanySchema.optional() });

export const QueueFiltersSchema = z.object({
  search: z.string().default(''),
  bucket: ActionBucketEnum.or(z.literal('ALL')).default('ALL'),
  industry: z.string().default('ALL'),
  minFit: z.number().default(0),
  minConfidence: z.number().default(0),
  evidence: z.enum(['ALL', 'HAS_EVIDENCE', 'NEEDS_RESEARCH', 'FETCH_FAILED']).default('ALL'),
  source: z.enum(['ALL', 'demo', 'imported', 'live']).default('ALL'),
  sort: z.enum(['priority', 'fit', 'confidence', 'name']).default('priority'),
});
export type QueueFilters = z.infer<typeof QueueFiltersSchema>;

export const CsvImportResultSchema = z.object({
  companies: z.array(CompanySchema),
  totalRows: z.number(),
  duplicates: z.number(),
  issues: z.array(z.object({ row: z.number(), message: z.string() })),
});
export type CsvImportResult = z.infer<typeof CsvImportResultSchema>;
export const CsvImportRequestSchema = z.object({ csvText: z.string().min(1).max(1_000_000) });

export const AnalysisRequestSchema = z.object({
  thesisId: z.string().min(1).optional(),
  companyIds: z.array(z.string().min(1)).min(1).max(1000).optional(),
});
export const AnalysisRunSchema = z.object({
  id: z.string(), thesisId: z.string(), status: z.literal('completed'),
  startedAt: z.string(), completedAt: z.string(),
  results: z.array(EnrichedCompanyResultSchema),
});
export type AnalysisRun = z.infer<typeof AnalysisRunSchema>;
export const IdParamsSchema = z.object({ id: z.string().min(1).max(200) });
export const RunParamsSchema = z.object({ runId: z.string().min(1).max(200) });

export const WorkspaceSnapshotSchema = z.object({
  version: z.literal(1),
  thesis: AcquisitionThesisSchema,
  dataset: z.array(z.object({ company: CompanySchema, evidence: z.array(EvidenceSchema) })).max(10000),
});

export const CrmPushRequestSchema = z.object({
  webhookUrl: z.string().url().optional(),
  stage: z.string().default('Sourcing Queue'),
  dealOwner: z.string().default('Lead Acquisition Analyst'),
  scope: z.enum(['selected', 'pursue_now', 'filtered', 'all']).default('pursue_now'),
  companies: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      domain: z.string(),
      industry: z.string(),
      location: z.string(),
      revenue: z.number().finite().nonnegative().nullable().optional(),
      employees: z.number().int().nonnegative().nullable().optional(),
      contactName: z.string().nullable().optional(),
      contactTitle: z.string().nullable().optional(),
      contactEmail: z.string().nullable().optional(),
      fitScore: z.number(),
      ownerSignalScore: z.number(),
      confidenceScore: z.number(),
      actionBucket: z.string(),
      recommendedAction: z.string(),
      keySignals: z.array(z.string()).default([]),
      evidenceUrls: z.array(z.string()).default([]),
      unknowns: z.array(z.string()).default([]),
    })
  ).min(1).max(1000),
});

export const CrmPushResponseSchema = z.union([
  z.object({ data: z.object({ success: z.literal(true), mode: z.enum(['live_webhook', 'simulated_crm']), batchId: z.string() }) }),
  z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
]);
