import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WA_AUTH_DIR: z.string().default('./data/wa-auth'),
  WA_USE_PAIRING_CODE: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  OUTBOUND_MIN_DELAY_MS: z.coerce.number().int().min(1000).default(1500),
  OUTBOUND_MAX_DELAY_MS: z.coerce.number().int().min(1000).default(3500),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(120),
  MAX_CART_ITEMS: z.coerce.number().int().positive().default(100)
}).refine((v) => v.OUTBOUND_MAX_DELAY_MS >= v.OUTBOUND_MIN_DELAY_MS, {
  message: 'OUTBOUND_MAX_DELAY_MS must be >= OUTBOUND_MIN_DELAY_MS'
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
