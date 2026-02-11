import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName: string) {
    console.log(`\n--- Checking ${tableName} ---`);
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
        console.error(`${tableName} Error:`, error.message);
    } else {
        console.log(`${tableName} Columns:`, data?.[0] ? Object.keys(data[0]) : 'No records found to infer columns');
    }
}

async function checkSchema() {
    const tables = [
        'personnel',
        'fleet',
        'social_posts',
        'materias_instrucao',
        'materias_apresentacoes',
        'materias_videos',
        'ssci_uso_documentos'
    ];

    for (const table of tables) {
        await checkTable(table);
    }
}

checkSchema();
