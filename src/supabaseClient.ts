import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase non configuré : vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
