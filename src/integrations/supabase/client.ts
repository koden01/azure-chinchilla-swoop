import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn("Supabase environment variables are not set. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined.");
}

export const supabase = createClient(
  SUPABASE_URL || 'http://localhost',
  SUPABASE_PUBLISHable_KEY || 'dummy_key'
);