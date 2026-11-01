import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export function assertNoSupabaseError(result, operation) {
  if (result.error) {
    const error = new Error(`${operation}: ${result.error.message}`);
    error.cause = result.error;
    throw error;
  }
  return result.data;
}
