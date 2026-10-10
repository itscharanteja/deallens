import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../lib/config';
const key = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
export const supabase: SupabaseClient | null = config.SUPABASE_URL && key
  ? createClient(config.SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
