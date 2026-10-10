import { FastifyInstance } from 'fastify';
import { AcquisitionThesisSchema, IdParamsSchema } from '@deallens/shared';
import { store } from '../services/store';

export async function thesesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/theses/:id
  fastify.get('/api/v1/theses/:id', async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'Provide a valid thesis ID.' } });
    const { id } = params.data;
    const thesis = store.getThesis(id);
    if (!thesis) {
      return reply.status(404).send({
        error: {
          code: 'THESIS_NOT_FOUND',
          message: `Thesis with id '${id}' was not found.`,
        },
      });
    }
    return { data: thesis };
  });

  // POST /api/v1/theses
  fastify.post('/api/v1/theses', async (request, reply) => {
    const parsed = AcquisitionThesisSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid thesis payload',
          details: parsed.error.format(),
        },
      });
    }

    const thesis = parsed.data;
    await store.saveThesis(thesis);

    return reply.status(201).send({
      data: thesis,
    });
  });
}
