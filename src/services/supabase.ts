
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lsxsbvtacopsvhwbdkhx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzeHNidnRhY29wc3Zod2Jka2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTI0MDQsImV4cCI6MjA4NTM2ODQwNH0.W9kcFPQkcbQmpWFWtQ_D_53lfUIA6TWeUcXuFEBVrF0';

export const supabase = createClient(supabaseUrl, supabaseKey);
