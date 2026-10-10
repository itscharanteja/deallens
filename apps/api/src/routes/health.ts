import { FastifyInstance } from 'fastify';
import { store } from '../services/store';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return {
      status: store.persistence === 'degraded' ? 'degraded' : 'ok',
      persistence: store.persistence,
      timestamp: new Date().toISOString(),
      service: 'deallens-api',
      version: '0.1.0',
    };
  });
}
