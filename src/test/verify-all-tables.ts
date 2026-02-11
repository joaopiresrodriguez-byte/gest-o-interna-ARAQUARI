/**
 * Comprehensive Schema Verification Script
 * Run: npx tsx src/test/verify-all-tables.ts
 * 
 * Tests ALL tables referenced in the codebase against actual Supabase schema.
 * Reports column mismatches, missing tables, and INSERT failures.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually to avoid dotenv dependency
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// All tables referenced in the codebase
const ALL_TABLES = [
    'profiles',
    'personnel',
    'personnel_documents',
    'personnel_vacations',
    'fleet',
    'checklist_items',
    'daily_checklists',
    'pending_notices',
    'daily_missions',
    'gu_reports',
    'training_schedule',
    'missions',
    'materias_instrucao',
    'materias_apresentacoes',
    'materias_videos',
    'purchases',
    'product_receipts',
    'social_posts',
    'ssci_analyses',
    'ssci_chat_sessions',
    'ssci_chat_messages',
    'ssci_normative_documents',
    'ssci_document_usage',
];

async function checkTable(tableName: string) {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);

    if (error) {
        return { table: tableName, status: 'ERROR', error: error.message, columns: null };
    }

    const columns = data && data.length > 0 ? Object.keys(data[0]) : null;
    return { table: tableName, status: 'OK', error: null, columns };
}

async function testInsert(tableName: string, testData: Record<string, any>) {
    // Use a transaction-like approach: insert then immediately delete
    const { data, error } = await supabase.from(tableName).insert(testData).select().single();

    if (error) {
        return { table: tableName, status: 'INSERT_FAILED', error: `${error.code}: ${error.message}`, details: error.details };
    }

    // Clean up: delete the test record
    if (data?.id) {
        await supabase.from(tableName).delete().eq('id', data.id);
    }

    return { table: tableName, status: 'INSERT_OK', error: null, insertedColumns: Object.keys(data) };
}

async function run() {
    console.log('=== SUPABASE SCHEMA VERIFICATION ===\n');
    console.log(`URL: ${supabaseUrl}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    // Phase 1: Check all tables exist
    console.log('--- PHASE 1: TABLE EXISTENCE ---\n');
    const results = [];
    for (const table of ALL_TABLES) {
        const result = await checkTable(table);
        results.push(result);
        const icon = result.status === 'OK' ? '✅' : '❌';
        console.log(`${icon} ${table}: ${result.status}${result.error ? ' → ' + result.error : ''}`);
        if (result.columns) {
            console.log(`   Columns: [${result.columns.join(', ')}]`);
        }
    }

    const existingTables = results.filter(r => r.status === 'OK').map(r => r.table);
    const missingTables = results.filter(r => r.status === 'ERROR');

    console.log(`\n--- SUMMARY ---`);
    console.log(`Tables OK: ${existingTables.length}/${ALL_TABLES.length}`);
    console.log(`Tables MISSING/ERROR: ${missingTables.length}`);
    if (missingTables.length > 0) {
        console.log(`Missing: ${missingTables.map(t => t.table).join(', ')}`);
    }

    // Phase 2: Test INSERTs with data shaped like the frontend sends
    console.log('\n\n--- PHASE 2: INSERT TESTS (matching frontend shapes) ---\n');

    const insertTests: { table: string; data: Record<string, any> }[] = [
        {
            table: 'personnel',
            data: {
                name: 'TEST_USER_DELETE_ME',
                war_name: 'TEST',
                rank: 'Sd.',
                role: 'Test',
                status: 'ATIVO',
                type: 'BM',
            }
        },
        {
            table: 'personnel_documents',
            data: {
                file_name: 'test.pdf',
                document_type: 'Certidão',
                file_url: 'https://example.com/test.pdf',
                size_kb: 100,
                upload_date: new Date().toISOString(),
                notes: 'TEST_DELETE_ME'
            }
        },
        {
            table: 'personnel_vacations',
            data: {
                personnel_id: 1,
                full_name: 'TEST_DELETE_ME',
                start_date: '2025-01-01',
                end_date: '2025-01-15',
                day_count: 15,
                status: 'planejado',
            }
        },
        {
            table: 'fleet',
            data: {
                id: 'TEST-DELETE-ME',
                name: 'TEST_VEHICLE',
                type: 'Equipamento',
                status: 'active',
                details: 'TEST'
            }
        },
        {
            table: 'checklist_items',
            data: {
                item_name: 'TEST_DELETE_ME',
                category: 'materiais',
                is_active: true,
                description: 'TEST'
            }
        },
        {
            table: 'daily_missions',
            data: {
                title: 'TEST_DELETE_ME',
                description: 'test',
                mission_date: '2025-01-01',
                priority: 'media',
                status: 'agendada',
                responsible_name: 'test',
                notes: 'test',
                created_by: 'test'
            }
        },
        {
            table: 'gu_reports',
            data: {
                title: 'TEST_DELETE_ME',
                description: 'test',
                type: 'test',
                report_date: '2025-01-01',
                responsible_id: 'test'
            }
        },
        {
            table: 'purchases',
            data: {
                item: 'TEST_DELETE_ME',
                quantity: 1,
                unit_price: 0,
                status: 'Pendente',
                requester: 'test'
            }
        },
        {
            table: 'product_receipts',
            data: {
                photo_url: 'https://example.com/test.jpg',
                fiscal_note_number: 'TEST_DELETE_ME',
                notes: 'test',
                receipt_date: new Date().toISOString()
            }
        },
        {
            table: 'social_posts',
            data: {
                content: 'TEST_DELETE_ME',
                platform: 'Instagram',
                likes: 0,
                image_url: 'https://example.com/test.jpg'
            }
        },
        {
            table: 'missions',
            data: {
                title: 'TEST_DELETE_ME',
                date: '2025-01-01',
                completed: false
            }
        },
        {
            table: 'ssci_analyses',
            data: {
                request_type: 'requerimento',
                protocol_number: 'TEST-0001',
                request_description: 'TEST_DELETE_ME',
                ai_response: 'test',
                analysis_date: new Date().toISOString(),
                responsible_user: 'test'
            }
        },
        {
            table: 'ssci_chat_sessions',
            data: {
                session_title: 'TEST_DELETE_ME',
                user: 'test',
                status: 'active'
            }
        },
        {
            table: 'ssci_normative_documents',
            data: {
                document_name: 'TEST_DELETE_ME',
                document_type: 'test',
                file_url: 'https://example.com/test.pdf'
            }
        },
        {
            table: 'pending_notices',
            data: {
                type: 'material',
                target_module: 'B4',
                description: 'TEST_DELETE_ME',
                status: 'pendente'
            }
        },
        {
            table: 'materias_instrucao',
            data: {
                name: 'TEST_DELETE_ME',
                category: 'test',
                status: 'active'
            }
        }
    ];

    for (const test of insertTests) {
        if (!existingTables.includes(test.table)) {
            console.log(`⏭️  ${test.table}: SKIPPED (table doesn't exist)`);
            continue;
        }

        const result = await testInsert(test.table, test.data);
        const icon = result.status === 'INSERT_OK' ? '✅' : '❌';
        console.log(`${icon} ${test.table}: ${result.status}${result.error ? ' → ' + result.error : ''}`);
        if (result.details) {
            console.log(`   Details: ${result.details}`);
        }
    }

    console.log('\n=== VERIFICATION COMPLETE ===\n');
}

run().catch(console.error);
