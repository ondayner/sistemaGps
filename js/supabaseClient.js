import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://eejkrbehgqkdvyafvxnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlamtyYmVoZ3FrZHZ5YWZ2eG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjU4NjAsImV4cCI6MjEwNDU0MTg2MH0.q1Hp178vPMW3y8p7oy8Ben7U5ISFqgrRhZ-ky8qcli0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);