import { FastifyInstance } from 'fastify';
import { store } from '../services/store';
import { crawlDomain } from '../services/crawler/index';
import { analyzeCompany, DEFAULT_DEMO_THESIS, EnrichmentRequestSchema, createBrief, IdParamsSchema } from '@deallens/shared';
import { z } from 'zod';

export async function companiesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/companies
  fastify.get('/api/v1/companies', async () => {
    const companies = store.getAllCompanies();
    const results = companies.map((c) => ({
      company: c,
      analysis: store.getAnalysis(c.id),
      evidence: store.getEvidenceForCompany(c.id),
    }));
    return { data: results, meta: { total: results.length } };
  });

  // GET /api/v1/companies/:id
  fastify.get('/api/v1/companies/:id', async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'Provide a valid company ID.' } });
    const { id } = params.data;
    const company = store.getCompany(id);
    if (!company) {
      return reply.status(404).send({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: `Company with id '${id}' was not found.`,
        },
      });
    }

    const evidence = store.getEvidenceForCompany(id);
    const analysis = store.getAnalysis(id);

    return {
      data: {
        company,
        evidence,
        analysis,
      },
    };
  });

  // POST /api/v1/companies/:id/enrich
  fastify.post('/api/v1/companies/:id/enrich', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const body = EnrichmentRequestSchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'Provide a valid company to research.' } });
    const { id } = params.data;
    const supplied = body.data.company;
    if (supplied && (supplied.id !== id || !id.startsWith('import-') || supplied.dataSource === 'demo')) {
      return reply.status(400).send({ error: { code: 'INVALID_COMPANY', message: 'The imported company does not match this request.' } });
    }
    // Browser-session imports can be researched without requiring the API during import.
    const company = store.getCompany(id) || supplied;
    if (!company) {
      return reply.status(404).send({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: `Company with id '${id}' was not found.`,
        },
      });
    }

    const crawlResult = await crawlDomain(company.website, company.id);

    // Update company crawl status
    const updatedCompany = {
      ...company,
      dataSource: company.dataSource === 'demo' ? 'demo' as const : crawlResult.pagesCrawled > 0 ? 'live' as const : 'imported' as const,
      crawlStatus: crawlResult.crawlStatus,
      crawledPagesCount: crawlResult.pagesCrawled,
    };
    await store.saveCompany(updatedCompany);

    // Merge new evidence with existing
    const existingEvidence = store.getEvidenceForCompany(id);
    const mergedEvidence = [...existingEvidence];
    for (const newEv of crawlResult.evidence) {
      if (!mergedEvidence.some((e) => e.snippet === newEv.snippet)) {
        mergedEvidence.push(newEv);
      }
    }
    await store.setEvidenceForCompany(id, mergedEvidence);

    // Re-run analysis against thesis
    const thesis = store.getThesis(DEFAULT_DEMO_THESIS.id) || DEFAULT_DEMO_THESIS;
    const newAnalysis = analyzeCompany(updatedCompany, thesis, mergedEvidence);
    await store.saveAnalysis(newAnalysis);

    return {
      meta: { persistence: store.persistence },
      data: {
        company: updatedCompany,
        evidence: mergedEvidence,
        analysis: newAnalysis,
        crawlSummary: {
          status: crawlResult.crawlStatus,
          pagesCrawled: crawlResult.pagesCrawled,
          newEvidenceDiscovered: crawlResult.evidence.length,
          error: crawlResult.error,
        },
      },
    };
  });

  // POST /api/v1/companies/:id/brief
  fastify.post('/api/v1/companies/:id/brief', async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'Provide a valid company ID.' } });
    const { id } = params.data;
    const company = store.getCompany(id);
    if (!company) {
      return reply.status(404).send({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: `Company with id '${id}' was not found.`,
        },
      });
    }

    const analysis = store.getAnalysis(id);
    const evidence = store.getEvidenceForCompany(id);

    const briefMarkdown = createBrief({ company, analysis: analysis ?? analyzeCompany(company, DEFAULT_DEMO_THESIS, evidence) });

    return {
      data: {
        companyId: company.id,
        briefMarkdown,
      },
    };
  });
}
