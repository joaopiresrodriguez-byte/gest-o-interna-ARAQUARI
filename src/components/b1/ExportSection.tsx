import React, { useState } from 'react';
import { Personnel, Vacation, SigrhExport, B1Course, RankHistory, DisciplinaryRecord } from '../../services/types';
import { formatLocalDate } from '../../utils/dateUtils';

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
    exports: SigrhExport[];
    courses?: B1Course[];
    rankHistories?: RankHistory[];
    disciplinaryRecords?: DisciplinaryRecord[];
    onAddExport: (exp: Omit<SigrhExport, 'id'>) => void;
}

const ExportSection: React.FC<Props> = ({
    personnelList,
    vacations,
    exports,
    courses = [],
    rankHistories = [],
    disciplinaryRecords = [],
    onAddExport
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'sigrh' | 'sgpe' | 'checklist'>('sigrh');
    const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
    const [escalaDate, setEscalaDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [chefeSocorroId, setChefeSocorroId] = useState<string>('');
    const [abtrMotoristaId, setAbtrMotoristaId] = useState<string>('');
    const [abtrResgatista1Id, setAbtrResgatista1Id] = useState<string>('');
    const [abtrResgatista2Id, setAbtrResgatista2Id] = useState<string>('');
    const [asuMotoristaId, setAsuMotoristaId] = useState<string>('');
    const [asuSocorrista1Id, setAsuSocorrista1Id] = useState<string>('');
    const [asuSocorrista2Id, setAsuSocorrista2Id] = useState<string>('');
    const [observacoesChefe, setObservacoesChefe] = useState<string>('');

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const handleMarkSubmitted = (exportType: string, system: 'SIGRH' | 'SGP-e') => {
        onAddExport({ export_type: exportType, month_ref: currentMonth, submitted_date: today.toISOString().split('T')[0], responsible: 'Operador B1', system });
    };

    // BLOCO 10 — EXPORTAR SIGRH (TODOS OS DADOS DO MILITAR SEM EXCEÇÃO)
    const generateSIGRHFullData = () => {
        const headers = [
            'ID', 'Nome Completo', 'Nome de Guerra', 'Posto/Graduação', 'Tipo (BM/BC)', 'Status', 'Função',
            'Matrícula', 'CPF', 'Data Nascimento', 'Cidade Residência', 'Data Inclusão', 'Data Última Promoção',
            'Email', 'Telefone', 'Tipo Sanguíneo', 'Nível Instrução', 'Endereço', 'Contato Emergência', 'Tel Emergência',
            'CVE Ativo', 'CVE Emissão', 'CVE Validade', 'Cat CNH', 'Nº CNH', 'Validade CNH', 'Toxicológico Validade', 'Porte de Arma',
            'Cursos Realizados', 'Histórico Férias/Afastamentos', 'Histórico Promoções', 'Registros Disciplinares'
        ];

        const lines = personnelList.map(p => {
            const pCourses = courses
                .filter(c => c.personnel_id === p.id)
                .map(c => `${c.course_name} (${c.completion_date || 'N/A'})`)
                .join('; ');

            const pVacations = vacations
                .filter(v => v.personnel_id === p.id)
                .map(v => `${v.leave_type || 'Férias'}: ${v.start_date} até ${v.end_date} [${v.status}]`)
                .join('; ');

            const pRanks = rankHistories
                .filter(r => r.personnel_id === p.id)
                .map(r => `${r.previous_rank} -> ${r.new_rank} em ${r.change_date}`)
                .join('; ');

            const pDisciplinary = disciplinaryRecords
                .filter(d => d.personnel_id === p.id)
                .map(d => `${d.record_type}: ${d.description} (${d.date})`)
                .join('; ');

            return [
                p.id || '',
                p.name || '',
                p.war_name || '',
                p.graduation || p.rank || '',
                p.type || '',
                p.status || '',
                p.role || '',
                p.matricula || '',
                p.cpf || '',
                p.birth_date || '',
                p.cidade_residencia || '',
                p.data_inclusao || '',
                p.data_ultima_promocao || '',
                p.email || '',
                p.phone || '',
                p.blood_type || '',
                p.education_level || '',
                p.address || '',
                p.emergency_contact_name || '',
                p.emergency_phone || '',
                p.cve_active || '',
                p.cve_issue_date || '',
                p.cve_expiry_date || '',
                p.cnh_category || '',
                p.cnh_number || '',
                p.cnh_expiry_date || '',
                p.toxicological_expiry_date || '',
                p.weapon_permit ? 'Sim' : 'Não',
                pCourses || 'Nenhum curso registrado',
                pVacations || 'Nenhum afastamento registrado',
                pRanks || 'Nenhuma promoção registrada',
                pDisciplinary || 'Sem alterações disciplinares'
            ].map(val => String(val).replace(/\t|\n/g, ' ')).join('\t');
        });

        const blob = new Blob([['\uFEFF' + headers.join('\t'), ...lines].join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SIGRH_EXTRATO_COMPLETO_EFETIVO_${currentMonth}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        handleMarkSubmitted('Extrato Completo SIGRH', 'SIGRH');
    };

    // BLOCO 11 — SGPE: DOCUMENTO 1 — FICHA DE FREQUÊNCIA (EXPEDIENTE)
    const generateSGPEFichaFrequencia = () => {
        const person = personnelList.find(p => String(p.id) === selectedPersonnelId) || personnelList[0];
        if (!person) return;

        const month = today.getMonth();
        const year = today.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthYearStr = `${String(month + 1).padStart(2, '0')}/${year}`;

        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Ficha de Frequência - SGPe CBMSC</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 15px; color: #000; }
  .header-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
  .header-table td { border: none; padding: 2px; }
  .title-header { text-align: center; font-weight: bold; font-size: 12px; }
  .sgpe-tag { color: #dc2626; font-weight: bold; font-size: 11px; }
  .box-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
  .box-table th, .box-table td { border: 1px solid #000; padding: 3px 5px; text-align: left; font-size: 9px; }
  .freq-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .freq-table th, .freq-table td { border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px; }
  .freq-table th { background-color: #f2f2f2; font-weight: bold; }
  .red-box { border: 2px solid #dc2626; padding: 3px; text-align: center; font-weight: bold; color: #dc2626; }
  .footer-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .footer-table td { border: 1px solid #000; padding: 4px; vertical-align: top; font-size: 8px; }
  .signed-text { color: red; font-size: 8px; font-weight: italic; margin-top: 15px; }
  @media print { @page { size: A4; margin: 8mm; } }
</style>
</head>
<body>

<table className="header-table" style="width:100%">
  <tr>
    <td style="width:70%">
      <div style="font-weight:bold; font-size:11px;">ESTADO DE SANTA CATARINA</div>
      <div style="font-size:10px;">2802-CORPO DE BOMBEIROS MILITAR DE SC</div>
      <div className="sgpe-tag" style="margin-top:4px;">SGPe: CBMSC 3109/2026</div>
    </td>
    <td style="width:30%; text-align:right;">
      <div style="font-size:14px; font-weight:bold;">Controle de Frequência</div>
      <div style="border:2px solid red; padding:4px; margin-top:4px; text-align:center; color:red; font-weight:bold;">
        Mês/Ano<br><span style="color:#000;">${monthYearStr}</span>
      </div>
    </td>
  </tr>
</table>

<table className="box-table">
  <tr>
    <td style="width:30%"><b>Município</b><br>ARAQUARI</td>
    <td style="width:70%"><b>Unidade</b><br>000080730204 - 3 PBM - ARAQUARI - 7BBM</td>
  </tr>
</table>

<table className="box-table" style="margin-top:3px;">
  <tr>
    <td style="width:20%"><b>Matrícula</b><br>${person.matricula || '930142-9'}</td>
    <td style="width:50%"><b>Nome</b><br>${person.name}</td>
    <td style="width:15%"><b>Carga horária</b><br>40</td>
    <td style="width:15%"><b>Jornada de Trabalho</b><br>07h às 14h</td>
  </tr>
</table>

<table className="freq-table">
  <thead>
    <tr>
      <th rowspan="2" style="width:4%">Dia</th>
      <th colspan="2">Manhã/Hora</th>
      <th colspan="2">Tarde/Hora</th>
      <th colspan="2">Noite/Hora</th>
      <th rowspan="2" style="width:40%">Observação</th>
      <th rowspan="2" style="width:8%">HORAS</th>
    </tr>
    <tr>
      <th style="width:8%">Entrada</th>
      <th style="width:8%">Saída</th>
      <th style="width:8%">Entrada</th>
      <th style="width:8%">Saída</th>
      <th style="width:8%">Entrada</th>
      <th style="width:8%">Saída</th>
    </tr>
  </thead>
  <tbody>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dayOfWeek = dateObj.getDay(); // 0 = Dom, 6 = Sáb
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isVacation = vacations.some(v => v.personnel_id === person.id && dateStr >= v.start_date && dateStr <= v.end_date);

            let entradaM = '07:00', SaidaM = '', entradaT = '', SaidaT = '14:00', obs = 'EXPEDIENTE MATUTINO', horas = '07:00';

            if (dayOfWeek === 6) {
                entradaM = 'SÁ'; SaidaM = 'BA'; entradaT = 'DO'; SaidaT = ''; obs = 'SÁBADO'; horas = '00:00';
            } else if (dayOfWeek === 0) {
                entradaM = 'DO'; SaidaM = 'MIN'; entradaT = 'GO'; SaidaT = ''; obs = 'DOMINGO'; horas = '00:00';
            } else if (isVacation) {
                entradaM = ''; SaidaM = ''; entradaT = ''; SaidaT = ''; obs = 'FÉRIAS'; horas = '00:00';
            }

            html += `<tr>
        <td>${String(d).padStart(2, '0')}</td>
        <td>${entradaM}</td>
        <td>${SaidaM}</td>
        <td>${entradaT}</td>
        <td>${SaidaT}</td>
        <td></td>
        <td></td>
        <td style="text-align:left; padding-left:5px;">${obs}</td>
        <td>${horas}</td>
      </tr>`;
        }

        html += `</tbody>
</table>

<table className="footer-table">
  <tr>
    <td style="width:40%">
      <b>Em caso de abono a chefia imediata deverá especificar o dia a ser abonado, descrever o motivo e assinar.</b>
      <table style="width:100%; border-collapse:collapse; margin-top:4px;">
        <tr><th style="border:1px solid #000;">Dia</th><th style="border:1px solid #000;">Motivo</th></tr>
        <tr><td style="border:1px solid #000; height:15px;"></td><td style="border:1px solid #000;"></td></tr>
        <tr><td style="border:1px solid #000; height:15px;"></td><td style="border:1px solid #000;"></td></tr>
      </table>
    </td>
    <td style="width:35%">
      <b>Servidor</b><br>
      Reconheço como verdadeiras as anotações sobre a minha assiduidade e pontualidade e as assumo na íntegra.<br>
      <b>Data e Assinatura do Servidor</b><br>
      <div className="signed-text">Datado e assinado digitalmente</div>
      <hr style="margin-top:15px; border:0; border-top:1px solid #000;">
      <b>Chefia imediata</b><br>
      Data e Assinatura da Chefia Imediata<br>
      <div className="signed-text">Datado e assinado digitalmente</div>
    </td>
    <td style="width:25%; font-size:8px;">
      <table style="width:100%; border-collapse:collapse;">
        <tr><td>MÊS ANTERIOR</td><td style="text-align:right; color:red;">00:00</td></tr>
        <tr><td>HORAS PREVISTAS</td><td style="text-align:right;">184:00</td></tr>
        <tr><td>TRABALHADAS</td><td style="text-align:right;">184:00</td></tr>
        <tr><td>BH MENSAL</td><td style="text-align:right;">00:00</td></tr>
        <tr><td>BH TOTAL</td><td style="text-align:right;">00:00</td></tr>
      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 500);
        }
        handleMarkSubmitted(`Ficha de Frequência - ${person.name}`, 'SGP-e');
    };

    // BLOCO 11 — SGPE: DOCUMENTO 2 — ESCALA DE SERVIÇO (OPERACIONAL 24X72)
    const generateSGPEEscalaServico = () => {
        const d = new Date(escalaDate + 'T12:00:00');
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        const formatFullDay = (dateObj: Date) => {
            return `${String(dateObj.getDate()).padStart(2, '0')} de ${dateObj.toLocaleDateString('pt-BR', { month: 'long' })}`;
        };

        const getPersonLabel = (id: string) => {
            const p = personnelList.find(item => String(item.id) === id);
            if (!p) return '';
            return `${p.graduation || p.rank || 'BM'} Mtcl ${p.matricula || '719831-0'} ${p.war_name || p.name}`;
        };

        const chefeName = getPersonLabel(chefeSocorroId) || 'Sd Mtcl 719831-0 Anton';
        const abtrMot = getPersonLabel(abtrMotoristaId) || 'Sd Mtcl 719737-3 de Melo';
        const abtrResg1 = getPersonLabel(abtrResgatista1Id) || '';
        const abtrResg2 = getPersonLabel(abtrResgatista2Id) || '';

        const asuMot = getPersonLabel(asuMotoristaId) || 'Sd Mtcl 719868-0 Elias';
        const asuSoc1 = getPersonLabel(asuSocorrista1Id) || '';
        const asuSoc2 = getPersonLabel(asuSocorrista2Id) || '';

        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Escala de Serviço 24 x 72 - SGPe CBMSC</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #000; }
  .header-box { border: 1px solid #000; padding: 10px; text-align: center; margin-bottom: 20px; font-weight: bold; }
  .main-title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 5px; }
  .sub-title { text-align: center; font-size: 12px; margin-bottom: 20px; }
  .table-box { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  .table-box th, .table-box td { border: 1px solid #000; padding: 5px 8px; font-size: 11px; }
  .table-box th { background-color: #f2f2f2; text-align: center; }
  .red-signed { color: red; font-size: 9px; font-weight: bold; }
  .obs-box { border: 1px solid #000; width: 100%; min-height: 80px; padding: 10px; margin-bottom: 30px; font-size: 10px; }
  .signatures-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
  .signatures-table td { width: 50%; text-align: center; vertical-align: top; border: none; }
  @media print { @page { size: A4 landscape; margin: 10mm; } }
</style>
</head>
<body>

<div className="header-box">
  ESTADO DE SANTA CATARINA<br>
  CORPO DE BOMBEIROS MILITAR<br>
  7º BATALHÃO DE BOMBEIROS MILITAR<br>
  3º PELOTÃO DE BOMBEIROS MILITAR DE ARAQUARI
</div>

<div className="main-title">ESCALA DE SERVIÇO 24 X 72</div>
<div className="sub-title">${formatFullDay(d)} para ${formatFullDay(nextD)}</div>

<!-- Chefe do Socorro -->
<table className="table-box" style="width: 50%; margin-bottom: 15px;">
  <thead>
    <tr><th colspan="2">Chefe do Socorro</th></tr>
    <tr><th style="width:30%">Função</th><th style="width:70%">Rubrica</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Chefe Socorro</td>
      <td>
        ${chefeName} 
        <span className="red-signed" style="float:right">(ASSINADO DIGITALMENTE)</span>
      </td>
    </tr>
  </tbody>
</table>

<!-- Viaturas ABTR e ASU -->
<table className="table-box">
  <thead>
    <tr>
      <th colspan="2" style="width:50%">ABTR-265</th>
      <th colspan="2" style="width:50%">ASU-552</th>
    </tr>
    <tr>
      <th style="width:15%">Função</th><th style="width:35%">Rubrica</th>
      <th style="width:15%">Funç:</th><th style="width:35%">Rubrica</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Motorista</td>
      <td>${abtrMot} ${abtrMot ? '<span class="red-signed" style="float:right">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
      <td>Motorista</td>
      <td>${asuMot} ${asuMot ? '<span class="red-signed" style="float:right">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
    </tr>
    <tr>
      <td>Resgatista 1</td>
      <td>${abtrResg1}</td>
      <td>Socorrista 1</td>
      <td>${asuSoc1}</td>
    </tr>
    <tr>
      <td>Resgatista 2</td>
      <td>${abtrResg2}</td>
      <td>Socorrista 2</td>
      <td>${asuSoc2}</td>
    </tr>
  </tbody>
</table>

<!-- Observações -->
<div style="font-weight: bold; text-align: center; margin-bottom: 5px;">OBSERVAÇÕES ESPECÍFICAS PARA O CHEFE DE SOCORRO</div>
<div className="obs-box">
  ${observacoesChefe || ''}
</div>

<div>Araquari, ${formatFullDay(d)} de ${d.getFullYear()}.</div>

<table className="signatures-table">
  <tr>
    <td>
      <div className="red-signed">(ASSINADO DIGITALMENTE)</div>
      ____________________________________________<br>
      <b>3º Sargento João Vitor Pires Rodrigues</b><br>
      B1 do 2º/2ª/16ºBBM
    </td>
    <td>
      <div className="red-signed">(ASSINADO DIGITALMENTE)</div>
      ____________________________________________<br>
      <b>1º Tenente BM Runan Aguirre Suares</b><br>
      Cmt do 2º/2ª/16ºBBM
    </td>
  </tr>
</table>

</body>
</html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 500);
        }
        handleMarkSubmitted(`Escala de Serviço 24x72 (${escalaDate})`, 'SGP-e');
    };

    return (
        <div className="space-y-6">
            {/* Navigation Sub-Tabs */}
            <div className="flex gap-2 border-b border-stone-200 pb-3">
                {[
                    { id: 'sigrh', label: 'SIGRH (Extrato Completo)', icon: 'table_view' },
                    { id: 'sgpe', label: 'SGP-e (Ficha Frequência & Escala 24x72)', icon: 'description' },
                    { id: 'checklist', label: 'Checklist de Submissões', icon: 'fact_check' }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveSubTab(t.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                            activeSubTab === t.id ? 'bg-primary text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                    >
                        <span className="material-symbols-outlined text-base">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB: SIGRH */}
            {activeSubTab === 'sigrh' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
                    <div>
                        <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">download</span>
                            Exportação Completa SIGRH
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Exporta uma planilha unificada com <b>todos os 32 dados cadastrais e históricos vinculados</b> de cada militar no sistema (sem omissão de campos).
                        </p>
                    </div>

                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-bold text-sm text-gray-800 block">Extrato Cadastral & Operacional Completo</span>
                                <span className="text-[10px] text-gray-500">Inclui dados pessoais, CNH, CVE, Cursos, Férias, Promoções e Registros Disciplinares</span>
                            </div>
                            <button
                                onClick={generateSIGRHFullData}
                                className="px-5 py-3 bg-primary text-white font-black text-xs rounded-xl hover:brightness-110 shadow-md flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-base">file_download</span>
                                EXPORTAR EXTRATO SIGRH (.TSV)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: SGPE */}
            {activeSubTab === 'sgpe' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-6">
                    <div>
                        <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">description</span>
                            Documentos Oficiais SGP-e
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Gere os dois documentos padronizados para o SGPe fiéis aos modelos oficiais do CBMSC.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* DOCUMENTO 1 — FICHA DE FREQUÊNCIA */}
                        <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-blue-600 text-2xl">badge</span>
                                    <h4 className="font-black text-base text-gray-800">DOCUMENTO 1 — Ficha de Frequência</h4>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">
                                    Destinado ao efetivo do <b>regime de expediente</b> (Carga Horária 40h, 07h às 14h, tabela de dias 1 a 31, justificativas e assinaturas digitais).
                                </p>

                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">
                                        Selecione o Militar para Ficha:
                                    </label>
                                    <select
                                        value={selectedPersonnelId}
                                        onChange={e => setSelectedPersonnelId(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold"
                                    >
                                        <option value="">Selecione um militar...</option>
                                        {personnelList.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.graduation || p.rank || ''} {p.name} ({p.matricula || 'Sem Matrícula'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={generateSGPEFichaFrequencia}
                                className="w-full py-3 bg-blue-700 text-white font-black text-xs rounded-xl hover:bg-blue-800 transition-colors shadow-sm flex items-center justify-center gap-2 mt-4"
                            >
                                <span className="material-symbols-outlined text-base">print</span>
                                GERAR FICHA DE FREQUÊNCIA (PRINT/PDF)
                            </button>
                        </div>

                        {/* DOCUMENTO 2 — ESCALA DE SERVIÇO 24X72 */}
                        <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-red-600 text-2xl">local_fire_department</span>
                                    <h4 className="font-black text-base text-gray-800">DOCUMENTO 2 — Escala de Serviço 24x72</h4>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">
                                    Destinado ao <b>efetivo operacional</b>. Fiel ao modelo do 3º Pelotão de Araquari (ABTR-265 e ASU-552 + Chefe do Socorro).
                                </p>

                                <div className="space-y-3 text-xs">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Data do Serviço:</label>
                                        <input
                                            type="date"
                                            value={escalaDate}
                                            onChange={e => setEscalaDate(e.target.value)}
                                            className="w-full h-9 px-3 rounded-lg border border-rustic-border bg-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Chefe Socorro:</label>
                                            <select value={chefeSocorroId} onChange={e => setChefeSocorroId(e.target.value)} className="w-full h-8 px-2 rounded border bg-white text-[10px]">
                                                <option value="">Selecione...</option>
                                                {personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation} {p.war_name || p.name}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Motorista ABTR:</label>
                                            <select value={abtrMotoristaId} onChange={e => setAbtrMotoristaId(e.target.value)} className="w-full h-8 px-2 rounded border bg-white text-[10px]">
                                                <option value="">Selecione...</option>
                                                {personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation} {p.war_name || p.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Motorista ASU:</label>
                                            <select value={asuMotoristaId} onChange={e => setAsuMotoristaId(e.target.value)} className="w-full h-8 px-2 rounded border bg-white text-[10px]">
                                                <option value="">Selecione...</option>
                                                {personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation} {p.war_name || p.name}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Socorrista ASU:</label>
                                            <select value={asuSocorrista1Id} onChange={e => setAsuSocorrista1Id(e.target.value)} className="w-full h-8 px-2 rounded border bg-white text-[10px]">
                                                <option value="">Selecione...</option>
                                                {personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation} {p.war_name || p.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={generateSGPEEscalaServico}
                                className="w-full py-3 bg-red-700 text-white font-black text-xs rounded-xl hover:bg-red-800 transition-colors shadow-sm flex items-center justify-center gap-2 mt-4"
                            >
                                <span className="material-symbols-outlined text-base">print</span>
                                GERAR ESCALA DE SERVIÇO 24X72 (PRINT/PDF)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: CHECKLIST */}
            {activeSubTab === 'checklist' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
                    <h3 className="font-black text-lg">Checklist de Submissões aos Sistemas</h3>
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-[10px] font-black uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Tipo</th>
                                <th className="px-4 py-3">Sistema</th>
                                <th className="px-4 py-3">Mês Ref.</th>
                                <th className="px-4 py-3">Data Submissão</th>
                                <th className="px-4 py-3">Responsável</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {exports.map(e => (
                                <tr key={e.id}>
                                    <td className="px-4 py-2 font-bold">{e.export_type}</td>
                                    <td className="px-4 py-2 text-center">{e.system}</td>
                                    <td className="px-4 py-2 text-center">{e.month_ref}</td>
                                    <td className="px-4 py-2 text-center">
                                        {e.submitted_date ? new Date(e.submitted_date).toLocaleDateString('pt-BR') : '—'}
                                    </td>
                                    <td className="px-4 py-2 text-center">{e.responsible || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ExportSection;
