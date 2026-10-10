import { FastifyInstance } from 'fastify';
import { importCsv, CsvImportRequestSchema } from '@deallens/shared';
import { store } from '../services/store';

export async function importsRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/imports/csv', async (request, reply) => {
    const parsed = CsvImportRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: 'CSV_INVALID', message: 'Provide CSV text with a header and at least one company.' } });
    try {
      const result = importCsv(parsed.data.csvText, store.getAllCompanies());
      for (const company of result.companies) await store.saveCompany(company);
      return { data: { ...result, validCompaniesImported: result.companies.length, duplicatesRemoved: result.duplicates }, meta: {} };
    } catch (e) {
      return reply.status(400).send({ error: { code: 'CSV_INVALID', message: e instanceof Error ? e.message : 'Check the CSV format and try again.' } });
    }
  });
}
