import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health';
import { thesesRoutes } from './routes/theses';
import { companiesRoutes } from './routes/companies';
import { analysisRoutes } from './routes/analysis';
import { importsRoutes } from './routes/imports';
import { integrationsRoutes } from './routes/integrations';
import { store } from './services/store';

export async function buildApp() {
  await store.ready;
  const fastify = Fastify({ logger: true });
  const budgets = new Map<string, { count: number; expires: number }>();
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method !== 'POST') return;
    const now = Date.now();
    for (const [key, value] of budgets) if (value.expires <= now) budgets.delete(key);
    const current = budgets.get(request.ip) ?? { count: 0, expires: now + 60_000 };
    current.count++;
    if (budgets.size >= 10_000 && !budgets.has(request.ip)) return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'The service is busy. Please retry later.' } });
    budgets.set(request.ip, current);
    if (current.count > 30) return reply.header('Retry-After', '60').code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please retry in a minute.' } });
  });

  // Plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });
  await fastify.register(sensible);

  // Centralized Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: statusCode >= 500 ? 'The service could not complete this request. Please retry later.' : error.message,
        details: statusCode < 500 ? error.validation : undefined,
      },
    });
  });

  // Feature Routes
  await fastify.register(healthRoutes);
  await fastify.register(thesesRoutes);
  await fastify.register(companiesRoutes);
  await fastify.register(analysisRoutes);
  await fastify.register(importsRoutes);
  await fastify.register(integrationsRoutes);

  return fastify;
}
