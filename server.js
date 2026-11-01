import express from 'express';
import fs from 'node:fs';
import { env } from './env.js';
import { supabase, assertNoSupabaseError } from './supabase.js';
import { WhatsAppManager } from './whatsapp-manager.js';
import { logger } from './logger.js';

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (_req, res) => {
  try {
    const result = await supabase.from('stores').select('id').limit(1);
    assertNoSupabaseError(result, 'healthcheck');
    res.json({ ok: true, service: 'whatsapp-menu-backend', time: new Date().toISOString() });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({ ok: false });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

const manager = new WhatsAppManager();
let httpServer;

async function bootstrap() {
  try {
    const result = await supabase.from('stores').select('*').eq('is_active', true);
    const stores = assertNoSupabaseError(result, 'loadActiveStores') ?? [];
    for (const store of stores) await manager.connectStore(store);
    logger.info({ stores: stores.length }, 'WhatsApp store sessions initialized');
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    logger.fatal({ error }, 'Startup failed; HTTP process will remain alive for log inspection');
    setInterval(() => {}, 60_000);
  }
}

httpServer = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'HTTP server started'));

const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutdown requested');
  httpServer?.close();
  await manager.disconnectAll();
  process.exit(0);
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => console.error('CRITICAL ERROR:', error));
process.on('unhandledRejection', (error) => console.error('CRITICAL ERROR:', error));

bootstrap().catch((error) => {
  console.error('CRITICAL ERROR:', error);
  logger.fatal({ error }, 'Unexpected bootstrap failure; process will remain alive');
  setInterval(() => {}, 60_000);
});
