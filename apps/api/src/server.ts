import { buildApp } from './app';

import { config } from './lib/config';
const { PORT, HOST } = config;

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    console.log(`DealLens API service listening on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Failed to start DealLens API:', err);
    process.exit(1);
  }
}

start();
