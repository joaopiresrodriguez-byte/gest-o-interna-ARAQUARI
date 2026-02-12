
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnose() {
    console.log('--- Diagnosing Tables ---');

    const tables = ['pending_notices', 'personnel', 'escalas', 'fleet'];

    for (const table of tables) {
        console.log(`\nTable: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.error(`Error fetching ${table}:`, error.message);
            if (error.message.includes('column')) {
                console.log('Hint: Possible missing column or rename issue.');
            }
        } else if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]).join(', '));
            console.log('Sample data:', data[0]);
        } else {
            console.log('Table exists but is empty.');
            // Try to get columns anyway if empty
            const { data: cols, error: colError } = await supabase.from(table).select('*').limit(0);
            if (!colError) {
                // Note: select * limit 0 might not give keys in some drivers but let's see
            }
        }
    }

    console.log('\n--- Checking Personnel Status ---');
    const { data: personnel } = await supabase.from('personnel').select('name, status, war_name');
    if (personnel) {
        console.log('Total personnel:', personnel.length);
        const statuses = personnel.reduce((acc: any, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {});
        console.log('Statuses count:', statuses);
    }
}

diagnose();
