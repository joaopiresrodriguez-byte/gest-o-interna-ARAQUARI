import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('--- Checking Personnel Table ---');
    const { data: personnel, error: pError } = await supabase.from('personnel').select('*').limit(1);
    if (pError) console.error('Personnel Error:', pError.message);
    else console.log('Personnel Sample:', personnel?.[0] ? Object.keys(personnel[0]) : 'No records found');

    console.log('\n--- Checking Fleet Table ---');
    const { data: fleet, error: fError } = await supabase.from('fleet').select('*').limit(1);
    if (fError) console.error('Fleet Error:', fError.message);
    else console.log('Fleet Sample:', fleet?.[0] ? Object.keys(fleet[0]) : 'No records found');

    console.log('\n--- Checking Social Posts Table ---');
    const { data: social, error: sError } = await supabase.from('social_posts').select('*').limit(1);
    if (sError) console.error('Social Error:', sError.message);
    else console.log('Social Sample:', social?.[0] ? Object.keys(social[0]) : 'No records found');
}

checkSchema();
