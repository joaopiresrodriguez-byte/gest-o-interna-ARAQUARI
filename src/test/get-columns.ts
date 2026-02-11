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

// For each table, test if a column exists by trying to select it
async function testColumn(table: string, col: string): Promise<boolean> {
    const { error } = await supabase.from(table).select(col).limit(0);
    return !error;
}

async function discoverColumns(table: string, candidates: string[]): Promise<{ exists: string[], missing: string[] }> {
    const exists: string[] = [];
    const missing: string[] = [];
    for (const col of candidates) {
        const ok = await testColumn(table, col);
        if (ok) exists.push(col);
        else missing.push(col);
    }
    return { exists, missing };
}

async function main() {
    const tests: { table: string; englishCols: string[]; portugueseCols: string[] }[] = [
        {
            table: 'personnel',
            englishCols: ['id', 'name', 'war_name', 'rank', 'role', 'status', 'type', 'address', 'email', 'birth_date', 'phone', 'blood_type', 'cnh', 'weapon_permit', 'image', 'created_at'],
            portugueseCols: ['nome', 'nome_guerra', 'graduacao', 'funcao', 'endereco', 'data_nascimento', 'telefone', 'tipo_sanguineo', 'porte_arma', 'foto']
        },
        {
            table: 'personnel_documents',
            englishCols: ['id', 'file_name', 'document_type', 'file_url', 'size_kb', 'uploaded_by', 'upload_date', 'notes', 'personnel_id'],
            portugueseCols: ['nome_arquivo', 'tipo_documento', 'url_arquivo', 'tamanho_kb', 'enviado_por', 'data_envio', 'observacoes']
        },
        {
            table: 'personnel_vacations',
            englishCols: ['id', 'personnel_id', 'full_name', 'start_date', 'end_date', 'day_count', 'status', 'notes'],
            portugueseCols: ['nome_completo', 'data_inicio', 'data_fim', 'total_dias', 'observacoes']
        },
        {
            table: 'daily_missions',
            englishCols: ['id', 'title', 'description', 'mission_date', 'start_time', 'end_time', 'responsible_id', 'status', 'priority', 'created_at', 'updated_at', 'responsible_name', 'notes', 'created_by'],
            portugueseCols: ['titulo', 'descricao', 'data_missao', 'hora_inicio', 'hora_fim', 'responsavel_id', 'prioridade', 'nome_responsavel', 'observacoes', 'criado_por']
        },
        {
            table: 'gu_reports',
            englishCols: ['id', 'title', 'description', 'type', 'report_date', 'responsible_id', 'created_at'],
            portugueseCols: ['titulo', 'descricao', 'tipo', 'data_relatorio', 'responsavel_id']
        },
        {
            table: 'materias_instrucao',
            englishCols: ['id', 'name', 'category', 'level', 'status', 'total_presentations', 'total_videos', 'created_at', 'updated_at', 'credit_hours'],
            portugueseCols: ['nome', 'categoria', 'nivel', 'total_apresentacoes', 'total_videos', 'carga_horaria']
        },
        {
            table: 'ssci_normative_documents',
            englishCols: ['id', 'document_name', 'document_type', 'code_number', 'issuing_body', 'publication_date', 'file_url', 'times_referenced', 'upload_date', 'summary', 'tags', 'category', 'size_kb', 'status', 'uploaded_by', 'validity_date'],
            portugueseCols: ['nome_documento', 'tipo_documento', 'numero_codigo', 'orgao_emissor', 'data_publicacao', 'url_arquivo', 'vezes_referenciado', 'data_upload', 'resumo_ementa']
        },
        {
            table: 'materias_apresentacoes',
            englishCols: ['id', 'materia_id', 'title', 'file_url', 'file_name', 'size_kb', 'page_count', 'sort_order', 'uploaded_by', 'upload_date', 'file_path'],
            portugueseCols: ['titulo', 'url_arquivo', 'nome_arquivo', 'tamanho_kb', 'total_paginas', 'ordem', 'enviado_por', 'data_envio']
        },
        {
            table: 'materias_videos',
            englishCols: ['id', 'materia_id', 'title', 'file_url', 'thumbnail_url', 'file_name', 'size_mb', 'duration_seconds', 'format', 'resolution', 'sort_order', 'uploaded_by', 'upload_date', 'video_url', 'duration'],
            portugueseCols: ['titulo', 'url_video', 'url_thumbnail', 'nome_arquivo', 'tamanho_mb', 'duracao_segundos', 'formato', 'resolucao', 'ordem', 'enviado_por', 'data_envio']
        },
        {
            table: 'training_schedule',
            englishCols: ['id', 'materia_id', 'date', 'instructor', 'location', 'status', 'time'],
            portugueseCols: ['data', 'instrutor', 'local']
        }
    ];

    for (const { table, englishCols, portugueseCols } of tests) {
        console.log(`\n=== ${table} ===`);
        const allCols = [...new Set([...englishCols, ...portugueseCols])];
        const { exists, missing } = await discoverColumns(table, allCols);
        console.log(`  EXISTS:  [${exists.join(', ')}]`);
        console.log(`  MISSING: [${missing.join(', ')}]`);
    }
}

main().then(() => process.exit(0));
