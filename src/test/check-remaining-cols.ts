import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabase = createClient(envVars['VITE_SUPABASE_URL'], envVars['VITE_SUPABASE_ANON_KEY']);

async function testCol(table: string, col: string): Promise<boolean> {
    const { error } = await supabase.from(table).select(col).limit(0);
    return !error;
}

async function main() {
    const checks = [
        { table: 'personnel_documents', cols: ['arquivo_url', 'url_arquivo', 'file_url', 'upload_date', 'personnel_id', 'data_envio', 'data_upload'] },
        { table: 'personnel_vacations', cols: ['quantidade_dias', 'total_dias', 'day_count', 'personnel_id', 'pessoal_id'] },
        { table: 'gu_reports', cols: ['report_text', 'texto_relatorio', 'title', 'description', 'type', 'report_date', 'responsible_id'] },
        { table: 'ssci_normative_documents', cols: ['arquivo_url', 'url_arquivo', 'file_url', 'category', 'size_kb', 'validity_date'] },
    ];

    for (const { table, cols } of checks) {
        console.log(`\n=== ${table} ===`);
        for (const col of cols) {
            const ok = await testCol(table, col);
            console.log(`  ${ok ? '✅' : '❌'} ${col}`);
        }
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
