import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://yaarzoafxwfcjdpmojxd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYXJ6b2FmeHdmY2pkcG1vanhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwNDcyNDEsImV4cCI6MjA2MzYyMzI0MX0.qdYB__h0YLU4iLKRquyEB44-iyZhBRoJ7lc3pYIkUOI";

console.log("VITE_SUPABASE_URL (hardcoded):", supabaseUrl);
console.log("VITE_SUPABASE_ANON_KEY (hardcoded):", supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);