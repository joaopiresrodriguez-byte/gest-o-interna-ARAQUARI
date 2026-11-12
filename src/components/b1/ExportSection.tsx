import React, { useState, useEffect } from 'react';
import { Personnel, Vacation, SigrhExport, B1Course, RankHistory, DisciplinaryRecord, Escala } from '../../services/types';
import { formatLocalDate } from '../../utils/dateUtils';
import { toast } from 'sonner';
import { supabase } from '../../services/supabase';
import { PersonnelSelect } from '../shared/PersonnelSelect';

import { ExtratoMensalB1 } from './ExtratoMensalB1';

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
    escalas?: Escala[];
    exports: SigrhExport[];
    courses?: B1Course[];
    rankHistories?: RankHistory[];
    disciplinaryRecords?: DisciplinaryRecord[];
    onAddExport: (exp: Omit<SigrhExport, 'id'>) => void;
}

const ExportSection: React.FC<Props> = ({
    personnelList,
    vacations,
    escalas = [],
    courses = [],
    rankHistories = [],
    disciplinaryRecords = [],
    onAddExport
}) => {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [activeSubTab, setActiveSubTab] = useState<'extrato_mensal' | 'sigrh' | 'sgpe' | 'csv_escalas'>('extrato_mensal');
    const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
    const [escalaDate, setEscalaDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [csvMonthBM, setCsvMonthBM] = useState<string>(currentMonth);
    const [csvMonthBC, setCsvMonthBC] = useState<string>(currentMonth);
    const [exportandoCsvBM, setExportandoCsvBM] = useState<boolean>(false);
    const [exportandoCsvBC, setExportandoCsvBC] = useState<boolean>(false);
    const [chefeSocorroId, setChefeSocorroId] = useState<string>('');
    const [abtrMotoristaId, setAbtrMotoristaId] = useState<string>('');
    const [abtrResgatista1Id, setAbtrResgatista1Id] = useState<string>('');
    const [abtrResgatista2Id, setAbtrResgatista2Id] = useState<string>('');
    const [asuMotoristaId, setAsuMotoristaId] = useState<string>('');
    const [asuSocorrista1Id, setAsuSocorrista1Id] = useState<string>('');
    const [asuSocorrista2Id, setAsuSocorrista2Id] = useState<string>('');
    const [observacoesChefe, setObservacoesChefe] = useState<string>('');

    // Preenchimento automático das funções do DOCUMENTO 2 de acordo com a escala publicada do dia
    useEffect(() => {
        if (!escalaDate) return;

        const carregarEscalaDoDia = async () => {
            try {
                // 1. Tentar encontrar escala já em memória
                let dayEscala = escalas.find(e => e.data === escalaDate);

                // 2. Se não estiver em memória, buscar no Supabase
                if (!dayEscala) {
                    const { data } = await supabase
                        .from('escalas')
                        .select('*')
                        .eq('data', escalaDate)
                        .maybeSingle();
                    if (data) dayEscala = data as Escala;
                }

                if (!dayEscala || !Array.isArray(dayEscala.militares) || dayEscala.militares.length === 0) {
                    return;
                }

                // Filtrar os militares escalados no dia que não estão em férias
                const militaresIds = dayEscala.militares.filter(id => {
                    const emFerias = vacations.some(
                        v => v.personnel_id === id &&
                        v.start_date && v.end_date &&
                        escalaDate >= v.start_date &&
                        escalaDate <= v.end_date
                    );
                    return !emFerias;
                });

                const listaEscalados = militaresIds
                    .map(id => personnelList.find(p => p.id === id))
                    .filter(Boolean) as Personnel[];

                if (listaEscalados.length === 0) return;

                // Separar em militares e comunitários
                const bms = listaEscalados.filter(p => p.type !== 'BC');
                const bcs = listaEscalados.filter(p => p.type === 'BC');

                // Ordem hierárquica dos BMs
                const ranksBMOrder: Record<string, number> = {
                    'Cel': 0, 'Ten Cel': 1, 'Maj': 2, 'Cap': 3, '1º Ten': 4, '2º Ten': 5, 'Asp Of': 6,
                    'Sub Ten': 7, '1º Sgt': 8, '2º Sgt': 9, '3º Sgt': 10, 'Cb': 11, 'Sd': 12
                };
                const normalizeGrad = (p: Personnel) => {
                    const g = (p.graduation || p.rank || '').replace(/\s*BM$/i, '').trim();
                    return g.replace(/(\d+)[°º]\s*Sgt/i, '$1º Sgt');
                };

                bms.sort((a, b) => {
                    const sA = ranksBMOrder[normalizeGrad(a)] ?? 99;
                    const sB = ranksBMOrder[normalizeGrad(b)] ?? 99;
                    return sA - sB;
                });

                // Auto-preenchimento das 7 posições baseado na graduação e ordem
                // 1. Chefe do Socorro: militar mais graduado
                const chefe = bms[0] || listaEscalados[0];
                if (chefe) setChefeSocorroId(String(chefe.id));

                // 2. Motorista ABTR: quem tem CNH D/E e CVE ativo, ou 2º mais graduado
                const motoristasPossiveis = listaEscalados.filter(p =>
                    (p.cve_active === 'Sim' || p.cve_active === 'Ativo') &&
                    (p.cnh_category?.includes('D') || p.cnh_category?.includes('E') || p.cnh?.includes('D') || p.cnh?.includes('E'))
                );

                const motABTR = motoristasPossiveis.find(p => p.id !== chefe?.id) || bms[1] || listaEscalados[1];
                if (motABTR) setAbtrMotoristaId(String(motABTR.id));

                // 3. Motorista ASU
                const motASU = motoristasPossiveis.find(p => p.id !== chefe?.id && p.id !== motABTR?.id) || bms[2] || listaEscalados[2];
                if (motASU) setAsuMotoristaId(String(motASU.id));

                // 4. Socorrista 1 ASU
                const soc1 = listaEscalados.find(p => p.id !== chefe?.id && p.id !== motABTR?.id && p.id !== motASU?.id);
                if (soc1) setAsuSocorrista1Id(String(soc1.id));

                // 5. Resgatista 1 ABTR
                const resg1 = listaEscalados.find(p => p.id !== chefe?.id && p.id !== motABTR?.id && p.id !== motASU?.id && p.id !== soc1?.id);
                if (resg1) setAbtrResgatista1Id(String(resg1.id));

                // 6. Socorrista 2 ASU
                const soc2 = listaEscalados.find(p => p.id !== chefe?.id && p.id !== motABTR?.id && p.id !== motASU?.id && p.id !== soc1?.id && p.id !== resg1?.id);
                if (soc2) setAsuSocorrista2Id(String(soc2.id));

                // 7. Resgatista 2 ABTR
                const resg2 = listaEscalados.find(p => p.id !== chefe?.id && p.id !== motABTR?.id && p.id !== motASU?.id && p.id !== soc1?.id && p.id !== resg1?.id && p.id !== soc2?.id);
                if (resg2) setAbtrResgatista2Id(String(resg2.id));

            } catch (err) {
                console.warn('Erro ao carregar escala do dia para o Documento 2:', err);
            }
        };

        carregarEscalaDoDia();
    }, [escalaDate, escalas, personnelList, vacations]);

    // EXPORTAÇÃO CSV — ESCALA DE MILITARES (BM)
    const exportarEscalaBMCSV = async () => {
        try {
            setExportandoCsvBM(true);
            const [yearStr, monthNumStr] = csvMonthBM.split('-');
            const year = Number(yearStr);
            const monthNum = Number(monthNumStr);
            const daysInMonth = new Date(year, monthNum, 0).getDate();

            // Buscar escalas publicadas do mês
            const startDate = `${csvMonthBM}-01`;
            const endDate = `${csvMonthBM}-${String(daysInMonth).padStart(2, '0')}`;
            const { data: escalasData } = await supabase
                .from('escalas')
                .select('*')
                .gte('data', startDate)
                .lte('data', endDate);

            // Buscar guarnições e seus membros
            const { data: guarnicoes } = await supabase.from('guarnicoes').select('*').order('nome');
            const { data: membros } = await supabase.from('guarnicao_membros').select('*');

            // Militares ativos BM
            const bms = personnelList.filter(p => (p.type === 'BM' || !p.type) && p.status === 'Ativo');

            // Montar dias da semana (ex: T, Q, Q, S, S, D, S...)
            const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
            const headerSemana = ['SEMANA'];
            const headerDias = ['NOME/DIA'];

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, monthNum - 1, d);
                headerSemana.push(diasSemana[dateObj.getDay()]);
                headerDias.push(String(d).padStart(2, '0'));
            }
            headerSemana.push('Horas trabalho', 'Horas prevista', 'Horas Excedentes');
            headerDias.push('', '', '');

            const rowsCSV: string[][] = [];
            rowsCSV.push([`PREVISÃO ESCALA MÊS DE ${new Date(year, monthNum - 1).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()} DE ${year}`]);
            rowsCSV.push(['ESCALA - ARAQUARI']);
            rowsCSV.push(headerSemana);
            rowsCSV.push(headerDias);

            // Função para calcular horas do dia do BM (ex: 24h ou expediente 7h/8h/11h)
            const getEscalaHoras = (pId: number, dateStr: string): number => {
                const dayEscala = (escalasData || []).find(e => e.data === dateStr);
                const isScaled = dayEscala?.militares?.includes(pId);
                if (!isScaled) return 0;
                // Exemplo 24h ordinário ou valor específico
                return 24;
            };

            // Agrupar BMs por Guarnição
            const bmsPorGuarnicao: Record<string, Personnel[]> = {
                'EXPEDIENTE / OUTROS': [],
                'GUARNIÇÃO AMARELA': [],
                'GUARNIÇÃO VERMELHA': [],
                'GUARNIÇÃO VERDE': [],
                'GUARNIÇÃO AZUL': [],
            };

            bms.forEach(bm => {
                const mLink = (membros || []).find(m => m.militar_id === bm.id);
                const g = (guarnicoes || []).find(g => g.id === mLink?.guarnicao_id);
                const gNome = g?.nome?.toUpperCase() || '';

                if (gNome.includes('AMAREL') || gNome.includes('CHARLIE')) bmsPorGuarnicao['GUARNIÇÃO AMARELA'].push(bm);
                else if (gNome.includes('VERMELH') || gNome.includes('BRAVO')) bmsPorGuarnicao['GUARNIÇÃO VERMELHA'].push(bm);
                else if (gNome.includes('VERDE') || gNome.includes('DELTA')) bmsPorGuarnicao['GUARNIÇÃO VERDE'].push(bm);
                else if (gNome.includes('AZUL') || gNome.includes('ALPHA')) bmsPorGuarnicao['GUARNIÇÃO AZUL'].push(bm);
                else bmsPorGuarnicao['EXPEDIENTE / OUTROS'].push(bm);
            });

            Object.entries(bmsPorGuarnicao).forEach(([gTitulo, grupoBMs]) => {
                if (grupoBMs.length === 0) return;
                rowsCSV.push([gTitulo]);

                grupoBMs.forEach(bm => {
                    const nomeCompleto = `${bm.graduation || ''} ${bm.name}`.trim();
                    const row = [nomeCompleto];
                    let totalHoras = 0;

                    for (let d = 1; d <= daysInMonth; d++) {
                        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isVacation = vacations.some(v => v.personnel_id === bm.id && dateStr >= v.start_date && dateStr <= v.end_date);

                        if (isVacation) {
                            row.push('F');
                        } else {
                            const h = getEscalaHoras(bm.id, dateStr);
                            if (h > 0) {
                                row.push(String(h));
                                totalHoras += h;
                            } else {
                                row.push('');
                            }
                        }
                    }
                    const prevista = 168; // Carga padrão do mês
                    const excedentes = Math.max(0, totalHoras - prevista);
                    row.push(String(totalHoras), String(prevista), String(excedentes));
                    rowsCSV.push(row);
                });
            });

            const csvContent = rowsCSV.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Escala_BM_Araquari_${csvMonthBM}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Escala BM em CSV baixada com sucesso!');
        } catch (e: any) {
            console.error('Erro ao exportar escala BM CSV:', e);
            toast.error('Erro ao gerar CSV: ' + (e?.message || 'Falha'));
        } finally {
            setExportandoCsvBM(false);
        }
    };

    // EXPORTAÇÃO CSV — ESCALA DE BOMBEIROS COMUNITÁRIOS (BC)
    const exportarEscalaBCCSV = async () => {
        try {
            setExportandoCsvBC(true);
            const [yearStr, monthNumStr] = csvMonthBC.split('-');
            const year = Number(yearStr);
            const monthNum = Number(monthNumStr);
            const daysInMonth = new Date(year, monthNum, 0).getDate();

            // Buscar BCs cadastrados
            const bcs = personnelList.filter(p => p.type === 'BC' && p.status === 'Ativo');

            // Buscar intenções/selecionados de BC do mês
            const { data: selecionados } = await supabase
                .from('bc_selecionados')
                .select('*')
                .eq('mes_referencia', csvMonthBC);

            const { data: intencoes } = await supabase
                .from('bc_intencoes')
                .select('*')
                .eq('mes_referencia', csvMonthBC);

            // Mapeamento dos dias da semana em português (ter., qua., qui., sex., sáb., dom., seg.)
            const diasSemanaPt = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
            const headerSemana = [csvMonthBC];
            const headerDias = ['NOME BC', 'NOME DE GUERRA'];

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, monthNum - 1, d);
                headerSemana.push(diasSemanaPt[dateObj.getDay()]);
                headerDias.push(String(d));
            }

            const rowsCSV: string[][] = [];
            rowsCSV.push(headerSemana);
            rowsCSV.push(headerDias);

            bcs.forEach(bc => {
                const row = [bc.name, bc.war_name || bc.name];

                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${csvMonthBC}-${String(d).padStart(2, '0')}`;
                    const sel = (selecionados || []).find(s => String(s.bombeiro_id) === String(bc.id) && s.dia === dateStr);
                    const int = (intencoes || []).find(i => String(i.bombeiro_id) === String(bc.id) && i.dia === dateStr);

                    const itemData = sel || int;
                    if (itemData) {
                        const hIni = itemData.horario_inicio || '07:00';
                        const hFim = itemData.horario_fim || '19:00';
                        let codigo = 'D'; // Diurno
                        if (hIni.startsWith('19') || hIni.startsWith('18')) codigo = 'N'; // Noturno
                        else if (itemData.total_horas >= 24) codigo = '24';
                        else if (hIni.startsWith('07') || hIni.startsWith('08')) codigo = 'D';
                        row.push(codigo);
                    } else {
                        row.push('');
                    }
                }
                rowsCSV.push(row);
            });

            const csvContent = rowsCSV.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Escala_BC_Araquari_${csvMonthBC}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Escala BC em CSV baixada com sucesso!');
        } catch (e: any) {
            console.error('Erro ao exportar escala BC CSV:', e);
            toast.error('Erro ao gerar CSV: ' + (e?.message || 'Falha'));
        } finally {
            setExportandoCsvBC(false);
        }
    };

    const handleMarkSubmitted = (exportType: string, system: 'SIGRH' | 'SGP-e') => {
        onAddExport({ export_type: exportType, month_ref: currentMonth, submitted_date: today.toISOString().split('T')[0], responsible: 'Operador B1', system });
    };

    // BLOCO 10 — EXPORTAR SIGRH PDF (FICHA COMPLETA INDIVIDUAL OU GERAL COM TODOS OS DADOS)
    const generateSIGRHPDF = (personId?: string) => {
        const listToPrint = personId
            ? personnelList.filter(p => String(p.id) === personId)
            : personnelList;

        if (listToPrint.length === 0) {
            toast.error('Nenhum militar selecionado para impressão do SIGRH.');
            return;
        }

        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SIGRH - Extrato Cadastral e Operacional Completo - CBMSC</title>
<style>
  @page { size: A4; margin: 12mm 15mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1e293b; margin: 0; padding: 0; line-height: 1.4; }
  .page-break { page-break-after: always; }
  .header { text-align: center; border-bottom: 2px solid #991b1b; padding-bottom: 8px; margin-bottom: 15px; }
  .header h1 { font-size: 13px; font-weight: 900; margin: 0; color: #991b1b; text-transform: uppercase; tracking-wide; }
  .header h2 { font-size: 10px; font-weight: 700; margin: 2px 0 0 0; color: #475569; }
  .header h3 { font-size: 9px; font-weight: 600; margin: 2px 0 0 0; color: #64748b; }
  
  .card-militar { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 20px; background-color: #fff; }
  .section-title { font-size: 10px; font-weight: 900; color: #991b1b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-top: 12px; margin-bottom: 8px; flex items-center; }
  
  .grid-2 { display: flex; flex-wrap: wrap; margin: -4px; }
  .col-2 { width: 50%; box-sizing: border-box; padding: 4px; }
  .col-3 { width: 33.33%; box-sizing: border-box; padding: 4px; }
  .col-4 { width: 25%; box-sizing: border-box; padding: 4px; }
  .col-12 { width: 100%; box-sizing: border-box; padding: 4px; }

  .field-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 6px; }
  .label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #64748b; display: block; }
  .value { font-size: 9.5px; font-weight: 700; color: #0f172a; margin-top: 1px; word-break: break-word; }

  table.data-table { width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 10px; }
  table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 8.5px; text-align: left; }
  table.data-table th { background-color: #f1f5f9; font-weight: 900; color: #334155; uppercase; }
  
  .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 4px; }
</style>
</head>
<body>`;

        listToPrint.forEach((p, idx) => {
            const pCourses = courses.filter(c => c.personnel_id === p.id);
            const pVacations = vacations.filter(v => v.personnel_id === p.id);
            const pRanks = rankHistories.filter(r => r.personnel_id === p.id);
            const pDisciplinary = disciplinaryRecords.filter(d => d.personnel_id === p.id);

            html += `
<div className="${idx < listToPrint.length - 1 ? 'page-break' : ''}">
  <div className="header">
    <h1>ESTADO DE SANTA CATARINA — CORPO DE BOMBEIROS MILITAR</h1>
    <h2>7º BATALHÃO DE BOMBEIROS MILITAR — 3º PELOTÃO (ARAQUARI)</h2>
    <h3>FICHA CADASTRAL E OPERACIONAL COMPLETA DO MILITAR — SIGRH</h3>
  </div>

  <div className="card-militar">
    <!-- DADOS PESSOAIS E FUNCIONAIS -->
    <div className="section-title">1. Dados Identificadores e Funcionais</div>
    <div className="grid-2">
      <div className="col-4"><div className="field-box"><span className="label">Posto / Graduação</span><div className="value">${p.graduation || p.rank || 'N/D'}</div></div></div>
      <div className="col-4"><div className="field-box"><span className="label">Nome Completo</span><div className="value">${p.name}</div></div></div>
      <div className="col-4"><div className="field-box"><span className="label">Nome de Guerra</span><div className="value">${p.war_name || 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Matrícula</span><div className="value">${p.matricula || 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">CPF</span><div className="value">${p.cpf || 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Tipo / Status</span><div className="value">${p.type || 'BM'} / ${p.status || 'Ativo'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Data de Inclusão</span><div className="value">${p.data_inclusao ? formatLocalDate(p.data_inclusao) : 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Última Promoção</span><div className="value">${p.data_ultima_promocao ? formatLocalDate(p.data_ultima_promocao) : 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Função</span><div className="value">${p.role || 'Bombeiro Militar'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Cidade Residência</span><div className="value">${p.cidade_residencia || 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Data Nascimento</span><div className="value">${p.birth_date ? formatLocalDate(p.birth_date) : 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">E-mail</span><div className="value">${p.email || 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Telefone</span><div className="value">${p.phone || 'N/D'}</div></div></div>
    </div>

    <!-- HABILITAÇÕES E SAÚDE -->
    <div className="section-title">2. Habilitações, Documentos e Saúde</div>
    <div className="grid-2">
      <div className="col-3"><div className="field-box"><span className="label">Cat. CNH / Nº CNH</span><div className="value">${p.cnh_category || 'N/D'} - ${p.cnh_number || 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Validade CNH</span><div className="value">${p.cnh_expiry_date ? formatLocalDate(p.cnh_expiry_date) : 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Venc. Toxicológico</span><div className="value">${p.toxicological_expiry_date ? formatLocalDate(p.toxicological_expiry_date) : 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">CVE Ativo / Emissão</span><div className="value">${p.cve_active || 'Não'} ${p.cve_issue_date ? `(${formatLocalDate(p.cve_issue_date)})` : ''}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Validade CVE</span><div className="value">${p.cve_expiry_date ? formatLocalDate(p.cve_expiry_date) : 'N/D'}</div></div></div>
      <div className="col-3"><div className="field-box"><span className="label">Tipo Sanguíneo / Porte Arma</span><div className="value">${p.blood_type || 'N/D'} / ${p.weapon_permit ? 'Sim' : 'Não'}</div></div></div>
      <div className="col-6"><div className="field-box"><span className="label">Contato de Emergência</span><div className="value">${p.emergency_contact_name || 'N/D'} (${p.emergency_phone || 'N/D'})</div></div></div>
    </div>

    <!-- HISTÓRICO DE CURSOS E QUALIFICAÇÕES -->
    <div className="section-title">3. Cursos e Qualificações Registradas</div>
    ${pCourses.length === 0 ? '<p style="color:#94a3b8; font-style:italic;">Nenhum curso cadastrado.</p>' : `
    <table className="data-table">
      <thead><tr><th>Sigla</th><th>Curso</th><th>Instituição</th><th>Horas</th><th>Conclusão</th><th>Validade</th></tr></thead>
      <tbody>
        ${pCourses.map(c => `<tr><td><b>${c.sigla_curso || '—'}</b></td><td>${c.course_name}</td><td>${c.institution || 'CBMSC'}</td><td>${c.workload_hours ? c.workload_hours + 'h' : '—'}</td><td>${formatLocalDate(c.completion_date)}</td><td>${c.expiry_date ? formatLocalDate(c.expiry_date) : 'Sem validade'}</td></tr>`).join('')}
      </tbody>
    </table>`}

    <!-- HISTÓRICO DE FÉRIAS E AFASTAMENTOS -->
    <div className="section-title">4. Histórico de Férias e Afastamentos</div>
    ${pVacations.length === 0 ? '<p style="color:#94a3b8; font-style:italic;">Nenhum afastamento registrado.</p>' : `
    <table className="data-table">
      <thead><tr><th>Tipo</th><th>Período</th><th>Dias</th><th>Status</th><th>Observação</th></tr></thead>
      <tbody>
        ${pVacations.map(v => `<tr><td><b>${v.leave_type || 'Férias'}</b></td><td>${formatLocalDate(v.start_date)} a ${formatLocalDate(v.end_date)}</td><td>${v.day_count}d</td><td>${v.status || 'planejado'}</td><td>${v.notes || '—'}</td></tr>`).join('')}
      </tbody>
    </table>`}

    <!-- HISTÓRICO DE PROMOÇÕES E ALTERAÇÕES -->
    <div className="section-title">5. Promoções e Registros Disciplinares</div>
    <div className="grid-2">
      <div className="col-6">
        <div style="font-weight:bold; font-size:8.5px; margin-bottom:2px; color:#475569;">PROMOÇÕES:</div>
        ${pRanks.length === 0 ? '<p style="color:#94a3b8; font-style:italic;">Sem histórico de promoções.</p>' : `
        <table className="data-table">
          <thead><tr><th>Graduação Anterior</th><th>Nova Graduação</th><th>Data</th></tr></thead>
          <tbody>
            ${pRanks.map(r => `<tr><td>${r.previous_rank}</td><td><b>${r.new_rank}</b></td><td>${formatLocalDate(r.change_date)}</td></tr>`).join('')}
          </tbody>
        </table>`}
      </div>
      <div className="col-6">
        <div style="font-weight:bold; font-size:8.5px; margin-bottom:2px; color:#475569;">DISCIPLINA:</div>
        ${pDisciplinary.length === 0 ? '<p style="color:#94a3b8; font-style:italic;">Sem registros disciplinares.</p>' : `
        <table className="data-table">
          <thead><tr><th>Tipo</th><th>Descrição</th><th>Data</th></tr></thead>
          <tbody>
            ${pDisciplinary.map(d => `<tr><td><b>${d.record_type}</b></td><td>${d.description}</td><td>${formatLocalDate(d.date)}</td></tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>
  </div>
</div>`;
        });

        html += `
  <div className="footer">
    Documento extraído do Sistema de Gestão Interna CBMSC Araquari em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.
  </div>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 500);
        }
        handleMarkSubmitted(personId ? 'Ficha Individual SIGRH' : 'Extrato Geral SIGRH', 'SIGRH');
    };

    // BLOCO 10 — EXPORTAR SIGRH (.TSV)
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
            const isBC = p.type === 'BC' || (p.graduation && p.graduation.toLowerCase().includes('bc')) || (p.rank && p.rank.toLowerCase().includes('bc'));
            const warName = (p.war_name || p.name.split(' ')[0]).toUpperCase();
            if (isBC) {
                return `BC ${warName}`;
            }
            let grad = (p.graduation || p.rank || 'Sd').replace(/\s*BM$/i, '').trim();
            grad = grad.replace(/(\d+)[°º]\s*Sgt/i, '$1º Sgt');
            if (grad === 'Sd') grad = 'Sd BM';
            else if (grad === 'Cb') grad = 'Cb BM';
            else if (grad.includes('Sgt')) grad = `${grad} BM`;
            else if (grad.includes('Ten')) grad = `${grad} BM`;
            else grad = `${grad} BM`;
            return `${grad} ${warName}`.trim();
        };

        const chefeName = getPersonLabel(chefeSocorroId);
        const abtrMot = getPersonLabel(abtrMotoristaId);
        const abtrResg1 = getPersonLabel(abtrResgatista1Id);
        const abtrResg2 = getPersonLabel(abtrResgatista2Id);

        const asuMot = getPersonLabel(asuMotoristaId);
        const asuSoc1 = getPersonLabel(asuSocorrista1Id);
        const asuSoc2 = getPersonLabel(asuSocorrista2Id);

        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Escala de Serviço 24 x 72 - SGPe CBMSC</title>
<style>
  @page {
    size: A4 landscape;
    margin: 15mm 18mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
  }
  .header-box {
    border: 1.5px solid #000;
    padding: 12px 10px;
    text-align: center;
    font-weight: bold;
    font-size: 11.5px;
    line-height: 1.45;
    margin-bottom: 24px;
    text-transform: uppercase;
  }
  .main-title {
    text-align: center;
    font-size: 13.5px;
    font-weight: bold;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .sub-title {
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 22px;
  }
  .table-box {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  .table-box th, .table-box td {
    border: 1px solid #000;
    padding: 6px 10px;
    font-size: 11px;
    height: 24px;
  }
  .table-box th {
    background-color: #fff;
    font-weight: bold;
    text-align: center;
  }
  .table-box td.funcao {
    font-weight: normal;
  }
  .table-box td.militar {
    font-weight: normal;
  }
  .table-box td.rubrica {
    text-align: left;
    white-space: nowrap;
  }
  .red-signed {
    color: #d32f2f;
    font-size: 9.5px;
    font-weight: bold;
    letter-spacing: 0.2px;
  }
  .obs-title {
    font-weight: bold;
    text-align: center;
    font-size: 11px;
    letter-spacing: 0.3px;
    margin-top: 18px;
    margin-bottom: 6px;
    text-transform: uppercase;
  }
  .obs-box {
    border: 1.5px solid #000;
    width: 100%;
    min-height: 90px;
    padding: 10px 12px;
    margin-bottom: 24px;
    font-size: 11px;
    white-space: pre-wrap;
  }
  .data-local {
    font-size: 11px;
    margin-bottom: 40px;
  }
  .signatures-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 30px;
  }
  .signatures-table td {
    width: 50%;
    text-align: center;
    vertical-align: top;
    border: none;
    font-size: 11px;
    line-height: 1.4;
  }
  .signatures-table .sig-line {
    display: inline-block;
    width: 280px;
    border-top: 1px solid #000;
    margin-top: 4px;
    margin-bottom: 5px;
  }
</style>
</head>
<body>

<div className="header-box">
  ESTADO DE SANTA CATARINA<br>
  CORPO DE BOMBEIROS MILITAR<br>
  16º BATALHÃO DE BOMBEIROS MILITAR<br>
  2º PELOTÃO DE BOMBEIROS MILITAR DE ARAQUARI
</div>

<div className="main-title">ESCALA DE SERVIÇO 24 X 72</div>
<div className="sub-title">${formatFullDay(d)} para ${formatFullDay(nextD)}</div>

<!-- Chefe do Socorro -->
<table className="table-box" style="width: 58%; margin-bottom: 18px;">
  <thead>
    <tr>
      <th colspan="3" style="text-align: center;">Chefe do Socorro</th>
    </tr>
    <tr>
      <th style="width: 32%; text-align: left;">Função</th>
      <th style="width: 36%; text-align: left;">Militar</th>
      <th style="width: 32%; text-align: left;">Rubrica</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="funcao">Chefe Socorro</td>
      <td className="militar">${chefeName}</td>
      <td className="rubrica">${chefeName ? '<span class="red-signed">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
    </tr>
  </tbody>
</table>

<!-- Viaturas ABTR e ASU Lado a Lado -->
<table className="table-box">
  <thead>
    <tr>
      <th colspan="3" style="width: 50%; text-align: center;">ABTR-265</th>
      <th colspan="3" style="width: 50%; text-align: center;">ASU-552</th>
    </tr>
    <tr>
      <th style="width: 16%; text-align: left;">Função</th>
      <th style="width: 18%; text-align: left;">Militar</th>
      <th style="width: 16%; text-align: left;">Rubrica</th>
      <th style="width: 16%; text-align: left;">Função</th>
      <th style="width: 18%; text-align: left;">Militar</th>
      <th style="width: 16%; text-align: left;">Rubrica</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="funcao">Motorista</td>
      <td className="militar">${abtrMot}</td>
      <td className="rubrica">${abtrMot ? '<span class="red-signed">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
      <td className="funcao">Motorista</td>
      <td className="militar">${asuMot}</td>
      <td className="rubrica">${asuMot ? '<span class="red-signed">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
    </tr>
    <tr>
      <td className="funcao">Resgatista 1</td>
      <td className="militar">${abtrResg1}</td>
      <td className="rubrica">${abtrResg1 ? '<span class="red-signed">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
      <td className="funcao">Socorrista 1</td>
      <td className="militar">${asuSoc1}</td>
      <td className="rubrica">${asuSoc1 ? '<span class="red-signed">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
    </tr>
    <tr>
      <td className="funcao">Resgatista 2</td>
      <td className="militar">${abtrResg2}</td>
      <td className="rubrica">${abtrResg2 ? '<span class="red-signed">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
      <td className="funcao">Socorrista 2</td>
      <td className="militar">${asuSoc2}</td>
      <td className="rubrica">${asuSoc2 ? '<span class="red-signed">(ASSINADO DIGITALMENTE)</span>' : ''}</td>
    </tr>
  </tbody>
</table>

<!-- Observações Específicas -->
<div className="obs-title">OBSERVAÇÕES ESPECÍFICAS PARA O CHEFE DE SOCORRO</div>
<div className="obs-box">${observacoesChefe || ''}</div>

<div className="data-local">Araquari, ${formatFullDay(d)} de ${d.getFullYear()}.</div>

<!-- Assinaturas -->
<table className="signatures-table">
  <tr>
    <td>
      <div className="red-signed">(ASSINADO DIGITALMENTE)</div>
      <div className="sig-line"></div><br>
      <b>3º Sargento João Vitor Pires Rodrigues</b><br>
      AUX B1 do 2º/2º/16ºBBM
    </td>
    <td>
      <div className="red-signed">(ASSINADO DIGITALMENTE)</div>
      <div className="sig-line"></div><br>
      <b>1º Tenente BM Runan Aguirre Suares</b><br>
      Cmt do 2º/2º/16ºBBM
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
            <div className="flex gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
                {[
                    { id: 'extrato_mensal', label: 'Extrato Mensal B1 (Alterações SIGRH)', icon: 'published_with_changes' },
                    { id: 'sigrh', label: 'SIGRH (Ficha & Extrato Unificado)', icon: 'table_view' },
                    { id: 'sgpe', label: 'SGP-e (Ficha Frequência & Escala 24x72)', icon: 'description' },
                    { id: 'csv_escalas', label: 'Escalas de Serviço (CSV)', icon: 'csv' }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveSubTab(t.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${
                            activeSubTab === t.id ? 'bg-primary text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                    >
                        <span className="material-symbols-outlined text-base">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB: EXTRATO MENSAL B1 */}
            {activeSubTab === 'extrato_mensal' && (
                <ExtratoMensalB1 personnelList={personnelList} vacations={vacations} />
            )}

            {/* TAB: SIGRH */}
            {activeSubTab === 'sigrh' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
                    <div>
                        <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">download</span>
                            Exportação Completa SIGRH
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Exporta relatório completo ou planilha unificada com <b>todos os 32 dados cadastrais e históricos vinculados</b> de cada militar no sistema (sem omissão de campos).
                        </p>
                    </div>

                    <div className="max-w-xl">
                        <div className="bg-stone-50 p-5 rounded-xl border border-stone-200 flex flex-col justify-between space-y-4">
                            <div>
                                <span className="font-bold text-base text-gray-800 block">Planilha Unificada (.TSV)</span>
                                <span className="text-xs text-gray-500 mt-1 block">Formato tabulado ideal para importação e planilhas com 32 colunas cadastrais completas.</span>
                            </div>
                            <button
                                onClick={generateSIGRHFullData}
                                className="w-full py-3.5 bg-primary text-white font-black text-xs rounded-xl hover:brightness-110 shadow-md flex items-center justify-center gap-2 tracking-wider uppercase"
                            >
                                <span className="material-symbols-outlined text-base">file_download</span>
                                EXPORTAR PLANILHA SIGRH (.TSV)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: EXPORTAR ESCALAS CSV */}
            {activeSubTab === 'csv_escalas' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-6">
                    <div>
                        <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-green-700">csv</span>
                            Exportação de Escalas em CSV (BM e BC)
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Gere planilhas CSV com a previsão e distribuição mensal de escalas nos modelos padronizados do CBMSC.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* OPÇÃO 1 — ESCALA BM (BOMBEIROS MILITARES) */}
                        <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-red-700 text-2xl">local_fire_department</span>
                                    <div>
                                        <h4 className="font-black text-base text-gray-800">1. Escala de Bombeiros Militares (BM)</h4>
                                        <span className="text-[10px] text-stone-500 font-medium">Modelo com guarnições (Amarela, Vermelha, Verde, Azul, Expediente) e totalizador de horas/excedentes.</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Mês de Referência:</label>
                                    <input
                                        type="month"
                                        value={csvMonthBM}
                                        onChange={e => setCsvMonthBM(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={exportarEscalaBMCSV}
                                disabled={exportandoCsvBM}
                                className="w-full py-3 bg-red-800 text-white font-black text-xs rounded-xl hover:bg-red-900 transition-all shadow flex items-center justify-center gap-2 mt-4"
                            >
                                <span className="material-symbols-outlined text-base">download</span>
                                {exportandoCsvBM ? 'GERANDO CSV...' : 'EXPORTAR ESCALA BM EM CSV'}
                            </button>
                        </div>

                        {/* OPÇÃO 2 — ESCALA BC (BOMBEIROS COMUNITÁRIOS) */}
                        <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-600 text-2xl">groups</span>
                                    <div>
                                        <h4 className="font-black text-base text-gray-800">2. Escala de Bombeiros Comunitários (BC)</h4>
                                        <span className="text-[10px] text-stone-500 font-medium">Modelo com distribuição dos dias do mês (códigos D/N/24) por Bombeiro Comunitário.</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Mês de Referência:</label>
                                    <input
                                        type="month"
                                        value={csvMonthBC}
                                        onChange={e => setCsvMonthBC(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={exportarEscalaBCCSV}
                                disabled={exportandoCsvBC}
                                className="w-full py-3 bg-amber-700 text-white font-black text-xs rounded-xl hover:bg-amber-800 transition-all shadow flex items-center justify-center gap-2 mt-4"
                            >
                                <span className="material-symbols-outlined text-base">download</span>
                                {exportandoCsvBC ? 'GERANDO CSV...' : 'EXPORTAR ESCALA BC EM CSV'}
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
                                    <PersonnelSelect
                                        personnelList={personnelList}
                                        value={selectedPersonnelId}
                                        onChange={val => setSelectedPersonnelId(String(val))}
                                        placeholder="Selecione um militar..."
                                        size="sm"
                                    />
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
                                    Destinado ao <b>efetivo operacional</b> (2º Pelotão de Bombeiros Militar de Araquari). Os nomes são <b>preenchidos automaticamente</b> de acordo com a escala publicada do dia, permitindo ajustar quem assume cada função.
                                </p>

                                <div className="space-y-3 text-xs">
                                    <div className="bg-white p-2.5 rounded-xl border border-rustic-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 block">Data do Serviço:</label>
                                            <span className="text-[11px] text-stone-400">Troca de data carrega a escala publicada correspondente</span>
                                        </div>
                                        <input
                                            type="date"
                                            value={escalaDate}
                                            onChange={e => setEscalaDate(e.target.value)}
                                            className="h-9 px-3 rounded-lg border border-rustic-border bg-stone-50 font-bold text-xs"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Chefe Socorro:</label>
                                            <PersonnelSelect
                                                personnelList={personnelList}
                                                value={chefeSocorroId}
                                                onChange={val => setChefeSocorroId(String(val))}
                                                placeholder="Selecione..."
                                                size="sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Motorista ABTR:</label>
                                            <PersonnelSelect
                                                personnelList={personnelList}
                                                value={abtrMotoristaId}
                                                onChange={val => setAbtrMotoristaId(String(val))}
                                                placeholder="Selecione..."
                                                size="sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                             <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Motorista ASU:</label>
                                             <PersonnelSelect
                                                 personnelList={personnelList}
                                                 value={asuMotoristaId}
                                                 onChange={val => setAsuMotoristaId(String(val))}
                                                 placeholder="Selecione..."
                                                 size="sm"
                                             />
                                        </div>

                                        <div>
                                             <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Socorrista 1 ASU:</label>
                                             <PersonnelSelect
                                                 personnelList={personnelList}
                                                 value={asuSocorrista1Id}
                                                 onChange={val => setAsuSocorrista1Id(String(val))}
                                                 placeholder="Selecione..."
                                                 size="sm"
                                             />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                             <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Resgatista 1 ABTR:</label>
                                             <PersonnelSelect
                                                 personnelList={personnelList}
                                                 value={abtrResgatista1Id}
                                                 onChange={val => setAbtrResgatista1Id(String(val))}
                                                 placeholder="Selecione..."
                                                 size="sm"
                                             />
                                        </div>

                                        <div>
                                             <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Resgatista 2 ABTR:</label>
                                             <PersonnelSelect
                                                 personnelList={personnelList}
                                                 value={abtrResgatista2Id}
                                                 onChange={val => setAbtrResgatista2Id(String(val))}
                                                 placeholder="Selecione..."
                                                 size="sm"
                                             />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                             <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Socorrista 2 ASU:</label>
                                             <PersonnelSelect
                                                 personnelList={personnelList}
                                                 value={asuSocorrista2Id}
                                                 onChange={val => setAsuSocorrista2Id(String(val))}
                                                 placeholder="Selecione..."
                                                 size="sm"
                                             />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Observações ao Chefe de Socorro:</label>
                                        <textarea
                                            value={observacoesChefe}
                                            onChange={e => setObservacoesChefe(e.target.value)}
                                            rows={2}
                                            placeholder="Observações específicas para o serviço..."
                                            className="w-full px-3 py-2 rounded-lg border border-rustic-border bg-white text-[10px] resize-none"
                                        />
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

        </div>
    );
};

export default ExportSection;
