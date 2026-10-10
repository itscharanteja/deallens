import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { store } from '../services/store';
import { analyzeCompany, DEFAULT_DEMO_THESIS, AnalysisRequestSchema, RunParamsSchema, exportQueue, AnalysisRun } from '@deallens/shared';

export async function analysisRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/analysis', async (request, reply) => {
    const parsed = AnalysisRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'Provide a thesis ID and a list of company IDs.' } });
    const thesis = store.getThesis(parsed.data.thesisId ?? DEFAULT_DEMO_THESIS.id);
    if (!thesis) return reply.status(404).send({ error: { code: 'THESIS_NOT_FOUND', message: 'The requested acquisition thesis was not found.' } });
    const ids = Array.from(new Set(parsed.data.companyIds ?? store.getAllCompanies().map(c => c.id)));
    if (ids.some(id => !store.getCompany(id))) return reply.status(404).send({ error: { code: 'COMPANY_NOT_FOUND', message: 'One or more requested companies were not found.' } });
    const startedAt = new Date().toISOString();
    const results = [];
    for (const id of ids) {
      const company = store.getCompany(id)!;
      const evidence = store.getEvidenceForCompany(id);
      const analysis = analyzeCompany(company, thesis, evidence);
      await store.saveCompany(company);
      await store.setEvidenceForCompany(id, evidence);
      await store.saveAnalysis(analysis);
      results.push({ company, analysis });
    }
    const run: AnalysisRun = { id: `run-${randomUUID()}`, thesisId: thesis.id, status: 'completed', startedAt, completedAt: new Date().toISOString(), results };
    await store.saveRun(run);
    return { data: { analysisRunId: run.id, status: run.status, count: results.length, results }, meta: { persistence: store.persistence } };
  });
  fastify.get('/api/v1/analysis/:runId', async (request, reply) => {
    const params = RunParamsSchema.safeParse(request.params);
    const run = params.success ? store.getRun(params.data.runId) : undefined;
    if (!run) return reply.status(404).send({ error: { code: 'ANALYSIS_RUN_NOT_FOUND', message: 'The requested analysis run was not found.' } });
    return { data: run, meta: { persistence: store.persistence } };
  });
  fastify.get('/api/v1/analysis/:runId/export.csv', async (request, reply) => {
    const params = RunParamsSchema.safeParse(request.params);
    const run = params.success ? store.getRun(params.data.runId) : undefined;
    if (!run) return reply.status(404).send({ error: { code: 'ANALYSIS_RUN_NOT_FOUND', message: 'The requested analysis run was not found.' } });
    return reply.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename="deallens_queue.csv"').send(exportQueue(run.results));
  });
}
