import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
// pnpm runs in apps/api; support both workspace-root and feature-local configuration.
loadEnv({ path: resolve(__dirname, '../../../../.env') });
loadEnv({ path: resolve(__dirname, '../../.env'), override: true });
const optional = z.preprocess(value => value === '' ? undefined : value, z.string().optional());
export const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  SUPABASE_URL: z.preprocess(value => value === '' ? undefined : value, z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: optional,
  SUPABASE_ANON_KEY: optional,
  LLM_API_KEY: optional,
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  CRAWL_TIMEOUT_MS: z.coerce.number().int().min(100).max(5000).default(5000),
  CRAWL_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(4),
}).parse(process.env);
