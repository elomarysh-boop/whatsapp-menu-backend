import express from 'express';
import { env } from './env.js';
import { supabase, assertNoSupabaseError } from './supabase.js';
import { WhatsAppManager } from './whatsapp-manager.js';
import { logger } from './logger.js';

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
async function bootstrap() {
  const result = await supabase.from('stores').select('*').eq('is_active', true);
  const stores = assertNoSupabaseError(result, 'loadActiveStores') ?? [];
  for (const store of stores) await manager.connectStore(store);
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT, stores: stores.length }, 'Backend started'));
  const shutdown = async (signal) => { logger.info({ signal }, 'Shutdown requested'); server.close(); await manager.disconnectAll(); process.exit(0); };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => { logger.fatal({ error }, 'Startup failed'); process.exit(1); });
