import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yoxraofhtwuodehvwwbp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlveHJhb2ZodHd1b2RlaHZ3d2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODMxMzcsImV4cCI6MjA5Mjk1OTEzN30.Sn8hBsPEV5LSLHWsWbCasfQIt5Q30uWLwzcyveTjHkQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
