/**
 * Script de Teste Isolado - Sincronização com Google Sheets/Drive
 * 
 * Este script lê as credenciais do arquivo .env, envia cadastros de teste mockados
 * diretamente para o webhook do Google Apps Script (simulando a ação do backend)
 * e imprime a resposta detalhada de sucesso/falha retornada pelo Google Sheets.
 * 
 * Execução:
 *   node scripts/test-google-sync.js
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 Iniciando Teste de Sincronização Isolado com Google Sheets...\n');

// 1. Carregar variáveis do .env manualmente (evita dependência de dotenv)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        // Ignora comentários e linhas vazias
        if (line.trim().startsWith('#') || !line.includes('=')) return;
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            // Remove aspas
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            process.env[key] = value.trim();
        }
    });
    console.log('✅ Arquivo .env carregado com sucesso.');
} else {
    console.warn('⚠️ Arquivo .env não encontrado. Tentando usar variáveis de ambiente do sistema...');
}

const WEBHOOK_URL = process.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL;
const SHEETS_EFETIVO_ID = process.env.VITE_SHEETS_EFETIVO_ID;
const B4_SPREADSHEET_ID = '1p1AZXbEO8TY5lqJB5IZ03Rhycn80_LAkarOzp65rqAQ';

console.log(`- Webhook URL: ${WEBHOOK_URL ? WEBHOOK_URL.slice(0, 45) + '...' : 'NÃO CONFIGURADO'}`);
console.log(`- Efetivo Spreadsheet ID: ${SHEETS_EFETIVO_ID || 'NÃO CONFIGURADO (Usará planilha padrão do webhook)'}`);
console.log(`- Patrimônio B4 Spreadsheet ID: ${B4_SPREADSHEET_ID}\n`);

if (!WEBHOOK_URL) {
    console.error('❌ ERRO: A variável VITE_GOOGLE_SHEETS_WEBHOOK_URL não está configurada no seu arquivo .env!');
    console.error('Por favor, adicione a URL da implantação do Apps Script no seu .env e tente novamente.');
    process.exit(1);
}

// 2. Mocks de teste
const mockMilitar = {
    matricula: '999999',
    name: 'Militar de Teste Automatizado',
    war_name: 'TESTE AUTOMÁTICO',
    graduation: 'Cabo',
    type: 'BM',
    status: 'Ativo',
    role: 'Motorista',
    cpf: '111.222.333-44',
    birth_date: '1990-05-15',
    email: 'teste.webhook@cbmsc.gov.br',
    phone: '(47) 99999-8888',
    education_level: 'Superior Completo',
    blood_type: 'O+',
    cnh_category: 'D',
    cnh_number: '12345678901',
    cnh_expiry_date: '2029-12-31',
    cve_active: 'Sim',
    cve_issue_date: '2024-01-01',
    cve_expiry_date: '2028-01-01',
    weapon_permit: true,
    toxicological_expiry_date: '2027-06-30',
    last_cadastro_review: new Date().toISOString(),
};

const mockViatura = {
    id: 88888,
    name: 'Viatura Teste Webhook',
    brand: 'Chevrolet S10',
    plate: 'AAA-0G99',
    renavam: '123456789',
    chassis: '9BWTESTE12345678',
    year: '2024',
    oil_type: 'Diesel S10',
    location: 'Sede Araquari',
    patrimonio_number: 'PAT-VIAT-999',
    patrimonio_type: 'Viatura',
    status: 'active',
    details: 'Viatura de teste para homologação do webhook de sincronização.',
    atividades: ['Operacional', 'Instrução'],
};

const mockEquipamento = {
    id: 77777,
    name: 'Desfibrilador Teste Webhook',
    brand: 'Zoll',
    nf_number: 'NF-777-TESTE',
    patrimonio_number: 'PAT-EQUP-777',
    patrimonio_type: 'Equipamento',
    status: 'active',
    details: 'Equipamento médico para testes de webhook.',
    atividades: ['Resgate'],
};

// Auxiliar para formatação de datas
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('pt-BR'); } catch { return dateStr; }
};

// Função para enviar o payload e verificar o retorno
async function testSync(payloadName, payload) {
    console.log(`📤 Enviando payload: [${payloadName}] para a aba: "${payload.sheet}"...`);
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`❌ Falha na requisição HTTP: ${response.status} ${response.statusText}`);
            console.error(`Detalhes do erro do servidor: ${errorText}\n`);
            return false;
        }

        const data = await response.json().catch(() => null);
        if (!data) {
            console.error('❌ Erro: O servidor não retornou um JSON válido.\n');
            return false;
        }

        if (data.success) {
            console.log(`✅ SUCESSO! Linha gravada com êxito.`);
            console.log(`   - Aba afetada: "${data.sheet}"`);
            console.log(`   - Linha na Planilha: ${data.row}`);
            console.log(`   - Ação realizada: ${data.updated ? 'ATUALIZAÇÃO (Linha existente atualizada)' : 'INSERÇÃO (Nova linha adicionada)'}\n`);
            return true;
        } else {
            console.error(`❌ Erro retornado pelo Apps Script: ${data.error || 'Erro desconhecido'}\n`);
            return false;
        }
    } catch (err) {
        console.error(`❌ Erro de conexão/rede:`, err.message || err);
        console.error('Verifique se a URL do Webhook está correta e se você tem conexão à internet.\n');
        return false;
    }
}

// 3. Execução dos testes sequenciais
async function runAllTests() {
    let successCount = 0;
    let totalTests = 3;

    // Teste 1: Cadastro Efetivo (B1)
    const payloadB1 = {
        sheet: 'CadastroEfetivo',
        data: [
            mockMilitar.matricula,
            mockMilitar.name,
            mockMilitar.war_name,
            mockMilitar.graduation,
            mockMilitar.type,
            mockMilitar.status,
            mockMilitar.role,
            mockMilitar.cpf,
            formatDate(mockMilitar.birth_date),
            mockMilitar.email,
            mockMilitar.phone,
            mockMilitar.education_level,
            mockMilitar.blood_type,
            mockMilitar.cnh_category,
            mockMilitar.cnh_number,
            formatDate(mockMilitar.cnh_expiry_date),
            mockMilitar.cve_active,
            formatDate(mockMilitar.cve_issue_date),
            formatDate(mockMilitar.cve_expiry_date),
            mockMilitar.weapon_permit ? 'Sim' : 'Não',
            formatDate(mockMilitar.toxicological_expiry_date),
            formatDate(mockMilitar.last_cadastro_review),
        ],
        spreadsheetId: SHEETS_EFETIVO_ID,
        keyColumnIndex: 0,
        keyValue: mockMilitar.matricula,
        headers: [
            'Matrícula', 'Nome Completo', 'Nome de Guerra', 'Posto/Graduação',
            'Tipo', 'Status', 'Função', 'CPF', 'Nascimento', 'Email', 'Telefone',
            'Instrução', 'Tipo Sanguíneo', 'Cat. CNH', 'Nº CNH', 'Val. CNH',
            'CVE Ativo', 'Emissão CVE', 'Val. CVE', 'Porte Arma', 'Val. Toxicológico',
            'Última Revisão',
        ]
    };
    const t1 = await testSync('Militar (B1)', payloadB1);
    if (t1) successCount++;

    // Teste 2: Cadastro Viatura (B4)
    const statusViatura = mockViatura.status === 'active' ? 'Ativo' : 'Inativo';
    const payloadB4Viatura = {
        sheet: 'Viatura',
        data: [
            new Date().toLocaleDateString('pt-BR'),
            mockViatura.name,
            mockViatura.brand,
            mockViatura.plate,
            mockViatura.renavam,
            mockViatura.chassis,
            mockViatura.year,
            mockViatura.oil_type,
            mockViatura.location,
            mockViatura.patrimonio_number,
            mockViatura.patrimonio_type,
            statusViatura,
            mockViatura.details,
            mockViatura.atividades.join(', '),
        ],
        spreadsheetId: B4_SPREADSHEET_ID,
        keyColumnIndex: 3, // Placa está na coluna D (índice 3)
        keyValue: mockViatura.plate,
        headers: [
            'Data Cadastro', 'Nome', 'Marca', 'Placa', 'RENAVAM', 'Chassi',
            'Ano', 'Tipo Óleo', 'Localização', 'Nº Patrimônio', 'Tipo Patrimônio',
            'Status', 'Detalhes', 'Atividades',
        ]
    };
    const t2 = await testSync('Viatura (B4)', payloadB4Viatura);
    if (t2) successCount++;

    // Teste 3: Cadastro Equipamento (B4)
    const statusEquipamento = mockEquipamento.status === 'active' ? 'Ativo' : 'Inativo';
    const payloadB4Equipamento = {
        sheet: 'Equipamento',
        data: [
            new Date().toLocaleDateString('pt-BR'),
            mockEquipamento.name,
            mockEquipamento.brand,
            mockEquipamento.nf_number,
            mockEquipamento.patrimonio_number,
            mockEquipamento.patrimonio_type,
            mockEquipamento.location,
            statusEquipamento,
            mockEquipamento.details,
            mockEquipamento.atividades.join(', '),
        ],
        spreadsheetId: B4_SPREADSHEET_ID,
        keyColumnIndex: 4, // Nº Patrimônio está na coluna E (índice 4)
        keyValue: mockEquipamento.patrimonio_number,
        headers: [
            'Data Cadastro', 'Nome', 'Marca', 'Nº NF', 'Nº Patrimônio',
            'Tipo Patrimônio', 'Localização', 'Status', 'Detalhes', 'Atividades',
        ]
    };
    const t3 = await testSync('Equipamento (B4)', payloadB4Equipamento);
    if (t3) successCount++;

    console.log('───────────────────────────────────────────────────────');
    console.log(`🏁 Resumo dos Testes: ${successCount} de ${totalTests} testes bem-sucedidos.`);
    if (successCount === totalTests) {
        console.log('🎉 Parabéns! A integração de gravação do Google Sheets está 100% OPERACIONAL!');
    } else {
        console.warn('⚠️ Houve falhas em alguns testes. Verifique as mensagens de erro acima.');
    }
    console.log('───────────────────────────────────────────────────────');
}

runAllTests();
