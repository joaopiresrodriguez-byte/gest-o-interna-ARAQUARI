import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  gerarRelatorioMensal,
  salvarRelatorio,
  listarRelatorios,
  RelatorioMensal,
  RelatorioSalvo,
  buscarInventarioConsolidado,
  InventarioItem,
  buscarMissoesEInstrucoesGuarnicao,
  ItemMissaoInstrucaoGuarnicao
} from '../../services/b4RelatorioService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon, color }) => (
  <div
    className="rounded-xl p-4 flex flex-col gap-2 shadow-sm border border-white/10 min-w-[140px] transition-transform hover:scale-[1.03]"
    style={{ backgroundColor: color }}
  >
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-white/70 text-[20px]">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{label}</span>
    </div>
    <span className="text-2xl font-black text-white">{value}</span>
  </div>
);

const RelatoriosMensais: React.FC = () => {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [relatorio, setRelatorio] = useState<RelatorioMensal | null>(null);
  const [historico, setHistorico] = useState<RelatorioSalvo[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingReport, setViewingReport] = useState<RelatorioSalvo | null>(null);

  // Aba ativa de relatório: 'inventario' ou 'guarnicao_missoes'
  const [abaAtiva, setAbaAtiva] = useState<'inventario' | 'guarnicao_missoes'>('inventario');

  // Inventário das 3 tabelas (b4_vehicles, b4_compartimentos_viaturas, b4_locais_equipamentos/checklist_itens)
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [filtroLocal, setFiltroLocal] = useState<string>('todos');

  // Missões e Instruções da Guarnição
  const [missoesGuarnicao, setMissoesGuarnicao] = useState<ItemMissaoInstrucaoGuarnicao[]>([]);
  const [filtroGuarnicao, setFiltroGuarnicao] = useState<string>('todos');

  const itemPertenceGuarnicao = (guarnicaoItem: string, filtroId: string): boolean => {
    if (filtroId === 'todos') return true;
    const gNorm = guarnicaoItem.toLowerCase();
    const term = filtroId.toLowerCase();
    if (term === 'alfa') return gNorm.includes('alfa') || gNorm.includes('turma a') || gNorm.includes('equipe a') || gNorm.endsWith(' a');
    if (term === 'bravo') return gNorm.includes('bravo') || gNorm.includes('turma b') || gNorm.includes('equipe b') || gNorm.endsWith(' b');
    if (term === 'charlie') return gNorm.includes('charlie') || gNorm.includes('turma c') || gNorm.includes('equipe c') || gNorm.endsWith(' c');
    if (term === 'delta') return gNorm.includes('delta') || gNorm.includes('turma d') || gNorm.includes('equipe d') || gNorm.endsWith(' d');
    return gNorm.includes(term);
  };

  const getGuarnicaoBadgeStyle = (guarnicaoName: string): string => {
    const gNorm = guarnicaoName.toLowerCase();
    if (gNorm.includes('alfa') || gNorm.endsWith('a')) return 'bg-blue-50 text-blue-800 border-blue-200';
    if (gNorm.includes('bravo') || gNorm.endsWith('b')) return 'bg-rose-50 text-rose-800 border-rose-200';
    if (gNorm.includes('charlie') || gNorm.endsWith('c')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (gNorm.includes('delta') || gNorm.endsWith('d')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    return 'bg-stone-100 text-stone-800 border-stone-300';
  };


  const carregarInventario = useCallback(async (local: string) => {
    try {
      const data = await buscarInventarioConsolidado(local);
      setInventario(data);
    } catch (err: any) {
      console.error('Erro ao carregar inventário:', err);
    }
  }, []);

  const carregarMissoesGuarnicao = useCallback(async (m: number, a: number, guarnicao: string) => {
    try {
      const data = await buscarMissoesEInstrucoesGuarnicao(m, a, guarnicao);
      setMissoesGuarnicao(data);
    } catch (err: any) {
      console.error('Erro ao carregar missões/instruções da guarnição:', err);
    }
  }, []);

  const loadHistorico = useCallback(async () => {
    try {
      const data = await listarRelatorios();
      setHistorico(data);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  }, []);

  useEffect(() => {
    loadHistorico();
    carregarInventario(filtroLocal);
    carregarMissoesGuarnicao(mes, ano, filtroGuarnicao);
  }, [loadHistorico, carregarInventario, filtroLocal, carregarMissoesGuarnicao, mes, ano, filtroGuarnicao]);


  const handleGerar = async () => {
    setLoading(true);
    try {
      const resultado = await gerarRelatorioMensal(mes, ano);
      setRelatorio(resultado);
      await salvarRelatorio(resultado);
      await carregarInventario(filtroLocal);

      toast.success(`Relatório de ${MESES[mes - 1]}/${ano} gerado com sucesso!`);
      loadHistorico();
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      toast.error(`Erro: ${error.message || 'Falha ao gerar relatório'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportarPDF = (rel: RelatorioMensal) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CORPO DE BOMBEIROS MILITAR DE SANTA CATARINA', 105, 18, { align: 'center' });
    doc.text('5º BATALHÃO DE BOMBEIROS MILITAR — ARAQUARI', 105, 26, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`INVENTÁRIO E CONSOLIDAÇÃO PATRIMONIAL (B4) — ${MESES[rel.mes - 1].toUpperCase()}/${rel.ano}`, 105, 35, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Filtro Aplicado: ${filtroLocal === 'todos' ? 'Visão Geral (Todos os Locais/Viaturas)' : filtroLocal}`, 105, 42, { align: 'center' });
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 105, 47, { align: 'center' });

    // Table of Inventory with alerts in RED
    if (abaAtiva === 'inventario') {
      const tableBody = inventario.map(item => [
        item.nome,
        item.tomboPatrimonio,
        item.tipo,
        item.localViatura + (item.compartimento ? ` (${item.compartimento})` : ''),
        item.quantidade.toString(),
        item.estadoConservacao
      ]);

      autoTable(doc, {
        startY: 54,
        head: [['Item / Equipamento', 'Tombo/Placa', 'Tipo', 'Local / Viatura / Compartimento', 'Qtd', 'Estado']],
        body: tableBody,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const itemIndex = data.row.index;
            const item = inventario[itemIndex];
            if (item && item.statusAlerta !== 'normal') {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
      doc.save(`INVENTARIO_PATRIMONIAL_B4_${MESES[rel.mes - 1].toLowerCase()}_${rel.ano}.pdf`);
      toast.success('PDF do Inventário exportado!');
    } else {
      const tableBody = missoesGuarnicao.map(item => [
        item.tipo === 'missao' ? 'Missão' : 'Instrução',
        item.titulo,
        `${new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR')}${item.horario ? ' (' + item.horario + ')' : ''}`,
        `Guarnição ${item.guarnicao}`,
        item.responsavelOuInstrutor || 'N/A',
        item.status
      ]);

      autoTable(doc, {
        startY: 54,
        head: [['Tipo', 'Título / Atividade', 'Data (Horário)', 'Guarnição Escalada', 'Responsável / Instrutor', 'Status']],
        body: tableBody,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [185, 28, 28], textColor: 255 }
      });
      doc.save(`MISSOES_INSTRUCOES_GUARNICAO_${filtroGuarnicao.toUpperCase()}_${MESES[rel.mes - 1].toLowerCase()}_${rel.ano}.pdf`);
      toast.success('PDF de Missões e Instruções exportado!');
    }

    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      'Documento de Relatório Oficial — Sistema de Gestão Interna CBMSC Araquari',
      105, pageHeight - 10, { align: 'center' }
    );
  };

  const exportarTSV = async () => {
    try {
      if (abaAtiva === 'inventario') {
        const items = await buscarInventarioConsolidado(filtroLocal);
        const headers = [
          'ID',
          'Nome do Item / Equipamento',
          'Tombo / Patrimônio / Placa',
          'Tipo',
          'Local ou Viatura',
          'Compartimento',
          'Quantidade',
          'Estado de Conservação / Condição',
          'Status Alerta',
          'Detalhes / Observações'
        ];

        const lines: string[] = items.map(item => [
          item.id,
          item.nome,
          item.tomboPatrimonio,
          item.tipo,
          item.localViatura,
          item.compartimento || 'N/A',
          item.quantidade,
          item.estadoConservacao,
          item.statusAlerta !== 'normal' ? `[ALERTA: ${item.statusAlerta.toUpperCase()}]` : 'OK',
          item.detalhes || ''
        ].map(val => String(val).replace(/\t|\n/g, ' ')).join('\t'));

        const blob = new Blob([['\uFEFF' + headers.join('\t'), ...lines].join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `INVENTARIO_PATRIMONIAL_B4_${filtroLocal.toUpperCase()}_${new Date().toISOString().split('T')[0]}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Inventário TSV exportado com sucesso!');
      } else {
        const items = await buscarMissoesEInstrucoesGuarnicao(mes, ano, filtroGuarnicao);
        const headers = [
          'ID',
          'Tipo',
          'Título / Atividade',
          'Data',
          'Horário',
          'Guarnição Escalada',
          'Responsável / Instrutor',
          'Status',
          'Detalhes'
        ];

        const lines: string[] = items.map(item => [
          item.id,
          item.tipo === 'missao' ? 'Missão' : 'Instrução',
          item.titulo,
          item.data,
          item.horario || 'N/A',
          `Guarnição ${item.guarnicao}`,
          item.responsavelOuInstrutor || 'N/A',
          item.status,
          item.detalhes || ''
        ].map(val => String(val).replace(/\t|\n/g, ' ')).join('\t'));

        const blob = new Blob([['\uFEFF' + headers.join('\t'), ...lines].join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MISSOES_INSTRUCOES_GUARNICAO_${filtroGuarnicao.toUpperCase()}_${MESES[mes - 1].toUpperCase()}_${ano}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Relatório de Guarnição TSV exportado!');
      }
    } catch (err: any) {
      toast.error('Erro ao exportar TSV: ' + err.message);
    }
  };

  const activeReport = viewingReport?.dados || relatorio;

  const locsUnicos = Array.from(new Set(inventario.map(i => i.localViatura))).sort();

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="bg-stone-50 border border-rustic-border rounded-2xl p-6 shadow-inner">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 text-[#3e2723]">
              <span className="material-symbols-outlined text-primary">analytics</span>
              Relatórios Mensais
            </h2>
            <p className="text-xs text-rustic-brown/60 mt-1">
              Gere relatórios consolidados do módulo de Logística e Patrimônio.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Mês</label>
              <select
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-rustic-border text-sm font-bold bg-white min-w-[140px]"
              >
                {MESES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Ano</label>
              <select
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
                className="h-10 px-3 rounded-lg border border-rustic-border text-sm font-bold bg-white"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGerar}
              disabled={loading}
              className="h-10 px-6 bg-primary text-white font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              )}
              GERAR RELATÓRIO
            </button>

            {activeReport && (
              <div className="flex gap-2">
                <button
                  onClick={() => exportarPDF(activeReport)}
                  className="h-10 px-4 bg-[#1e293b] text-white font-bold rounded-xl shadow hover:brightness-125 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  PDF
                </button>
                <button
                  onClick={exportarTSV}
                  className="h-10 px-4 bg-emerald-700 text-white font-bold rounded-xl shadow hover:bg-emerald-800 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  EXPORTAR TSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      {activeReport && (
        <div className="space-y-4">
          {viewingReport && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewingReport(null)}
                className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Voltar ao relatório atual
              </button>
              <span className="text-xs text-gray-400">
                Visualizando: {viewingReport.titulo}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            <MetricCard label="Patrimônio Total" value={activeReport.totalPatrimonio} icon="inventory_2" color="#1e293b" />
            <MetricCard label="Viaturas" value={activeReport.totalViaturas} icon="local_shipping" color="#334155" />
            <MetricCard label="Operacionais" value={activeReport.viaturasOperacionais} icon="check_circle" color="#15803d" />
            <MetricCard label="Em Manutenção" value={activeReport.viaturasManutencao} icon="build" color="#c2410c" />
            <MetricCard label="Aquisições" value={activeReport.totalManutencoes} icon="shopping_cart" color="#1d4ed8" />
            <MetricCard label="Custo Aquisições" value={formatCurrency(activeReport.custoManutencoes)} icon="payments" color="#0d9488" />
            <MetricCard label="Combustível" value={`${activeReport.totalCombustivel} L`} icon="local_gas_station" color="#0e7490" />
            <MetricCard label="Ocorrências" value={activeReport.ocorrenciasAtendidas} icon="emergency" color="#1e293b" />
            <MetricCard label="KM da Frota" value={activeReport.kmRodados.toLocaleString('pt-BR')} icon="speed" color="#15803d" />
            <MetricCard label="Custo Combustível" value={formatCurrency(activeReport.custoCombustivel)} icon="attach_money" color="#c2410c" />
            <MetricCard label="Patrimônio Novo" value={activeReport.patrimonioNovo} icon="add_circle" color="#0369a1" />
            <MetricCard label="Patrimônio Baixado" value={activeReport.patrimonioDescartado} icon="remove_circle" color="#991b1b" />
          </div>
        </div>
      )}

      {/* Tabela de Relatório com Alternância de Abas */}
      <div className="bg-white border border-rustic-border rounded-xl p-6 shadow-sm space-y-4">
        {/* Tab Headers and Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rustic-border/40 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAbaAtiva('inventario')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                abaAtiva === 'inventario'
                  ? 'bg-rustic-brown text-white shadow-md'
                  : 'bg-stone-100 text-rustic-brown/70 hover:bg-stone-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">inventory</span>
              Inventário Consolidado
            </button>
            <button
              onClick={() => setAbaAtiva('guarnicao_missoes')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                abaAtiva === 'guarnicao_missoes'
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-stone-100 text-rustic-brown/70 hover:bg-stone-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
              Missões e Instruções por Guarnição
            </button>
          </div>

          <div className="flex items-center gap-3">
            {abaAtiva === 'inventario' ? (
              <div className="flex items-center gap-2 bg-stone-50 border border-rustic-border rounded-xl px-3 py-1.5">
                <span className="material-symbols-outlined text-stone-400 text-[18px]">filter_alt</span>
                <label className="text-xs font-bold text-rustic-brown">Filtrar Local/Viatura:</label>
                <select
                  value={filtroLocal}
                  onChange={e => setFiltroLocal(e.target.value)}
                  className="bg-transparent text-xs font-bold text-rustic-brown outline-none cursor-pointer"
                >
                  <option value="todos">Visão Geral (Todos)</option>
                  {locsUnicos.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-stone-50 border border-rustic-border rounded-xl px-3 py-1.5">
                <span className="material-symbols-outlined text-stone-400 text-[18px]">groups</span>
                <label className="text-xs font-bold text-rustic-brown">Filtrar Guarnição:</label>
                <select
                  value={filtroGuarnicao}
                  onChange={e => setFiltroGuarnicao(e.target.value)}
                  className="bg-transparent text-xs font-bold text-rustic-brown outline-none cursor-pointer"
                >
                  <option value="todos">Todas as Guarnições</option>
                  <option value="Alfa">Guarnição Alfa</option>
                  <option value="Bravo">Guarnição Bravo</option>
                  <option value="Charlie">Guarnição Charlie</option>
                  <option value="Delta">Guarnição Delta</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content based on Active Tab */}
        {abaAtiva === 'inventario' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-stone-50 text-[10px] font-black uppercase tracking-wider text-rustic-brown/60 border-b border-rustic-border">
                  <th className="py-3 px-4">Item / Equipamento</th>
                  <th className="py-3 px-4">Tombo / Placa</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Local / Viatura (Compartimento)</th>
                  <th className="py-3 px-4 text-center">Qtd</th>
                  <th className="py-3 px-4 text-center">Estado / Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rustic-border/30">
                {inventario.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-400 italic">
                      Nenhum bem patrimonial encontrado para o filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  inventario.map((item, idx) => {
                    const hasAlert = item.statusAlerta !== 'normal';
                    return (
                      <tr
                        key={item.id || idx}
                        className={`hover:bg-stone-50/70 transition-colors ${hasAlert ? 'bg-red-50/50' : ''}`}
                      >
                        <td className="py-3 px-4 font-bold text-rustic-brown">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[16px] ${hasAlert ? 'text-red-600' : 'text-stone-400'}`}>
                              {item.tipo === 'Viatura' ? 'local_shipping' : item.tipo === 'Compartimento' ? 'grid_view' : 'build'}
                            </span>
                            <span>{item.nome}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono font-bold text-rustic-brown/70">{item.tomboPatrimonio}</td>
                        <td className="py-3 px-4 text-xs">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-stone-100 text-rustic-brown border border-rustic-border/40">
                            {item.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-rustic-brown font-medium">
                          {item.localViatura}
                          {item.compartimento && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded ml-1 border border-blue-200">
                              {item.compartimento}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-black text-center">{item.quantidade}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                            hasAlert
                              ? 'bg-red-100 text-red-700 border border-red-300 shadow-sm'
                              : 'bg-green-100 text-green-700 border border-green-200'
                          }`}>
                            {hasAlert && <span className="material-symbols-outlined text-[12px]">error</span>}
                            {item.estadoConservacao}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dashboard Sub-Header & Garrison Quick Pills */}
            <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white rounded-2xl p-5 shadow-lg border border-stone-700">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-red-400 text-xs font-black uppercase tracking-widest">
                    <span className="material-symbols-outlined text-[16px]">monitoring</span>
                    Painel Operacional das Guarnições
                  </div>
                  <h4 className="text-lg font-black text-white mt-1">
                    Missões & Treinamentos — {MESES[mes - 1]}/{ano}
                  </h4>
                  <p className="text-xs text-stone-300">
                    Selecione uma guarnição para filtrar instantaneamente as atividades executadas no plantão.
                  </p>
                </div>

                {/* Garrison Pills Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'todos', label: 'Todas Guarnições', color: 'bg-stone-700 text-white hover:bg-stone-600', active: 'bg-white text-stone-900 ring-2 ring-red-500' },
                    { id: 'Alfa', label: 'Guarnição Alfa', color: 'bg-blue-950/80 text-blue-200 border-blue-800 hover:bg-blue-900', active: 'bg-blue-600 text-white ring-2 ring-blue-400' },
                    { id: 'Bravo', label: 'Guarnição Bravo', color: 'bg-rose-950/80 text-rose-200 border-rose-800 hover:bg-rose-900', active: 'bg-rose-600 text-white ring-2 ring-rose-400' },
                    { id: 'Charlie', label: 'Guarnição Charlie', color: 'bg-amber-950/80 text-amber-200 border-amber-800 hover:bg-amber-900', active: 'bg-amber-600 text-white ring-2 ring-amber-400' },
                    { id: 'Delta', label: 'Guarnição Delta', color: 'bg-emerald-950/80 text-emerald-200 border-emerald-800 hover:bg-emerald-900', active: 'bg-emerald-600 text-white ring-2 ring-emerald-400' },
                  ].map(g => {
                    const isActive = filtroGuarnicao === g.id;
                    const count = g.id === 'todos'
                      ? missoesGuarnicao.length
                      : missoesGuarnicao.filter(i => itemPertenceGuarnicao(i.guarnicao, g.id)).length;

                    return (
                      <button
                        key={g.id}
                        onClick={() => setFiltroGuarnicao(g.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-2 ${
                          isActive ? g.active : `${g.color} border-transparent`
                        }`}
                      >
                        <span>{g.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isActive ? 'bg-black/20 text-current' : 'bg-stone-800 text-stone-300'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KPI Mini Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-stone-700/60">
                <div className="bg-stone-800/80 border border-stone-700 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-stone-400">Total Atividades</span>
                  <div className="text-xl font-black text-white">{missoesGuarnicao.length}</div>
                </div>
                <div className="bg-stone-800/80 border border-stone-700 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-400">Missões Diárias</span>
                  <div className="text-xl font-black text-amber-300">
                    {missoesGuarnicao.filter(i => i.tipo === 'missao').length}
                  </div>
                </div>
                <div className="bg-stone-800/80 border border-stone-700 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-blue-400">Instruções / Aulas</span>
                  <div className="text-xl font-black text-blue-300">
                    {missoesGuarnicao.filter(i => i.tipo === 'instrucao').length}
                  </div>
                </div>
                <div className="bg-stone-800/80 border border-stone-700 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Concluídas</span>
                  <div className="text-xl font-black text-emerald-300">
                    {missoesGuarnicao.filter(i => i.status === 'Concluída').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Data Table */}
            <div className="overflow-x-auto rounded-xl border border-rustic-border">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-[10px] font-black uppercase tracking-wider text-rustic-brown/70 border-b border-rustic-border">
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Título / Atividade</th>
                    <th className="py-3 px-4">Data e Horário</th>
                    <th className="py-3 px-4">Guarnição Escalada</th>
                    <th className="py-3 px-4">Responsável / Instrutor</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rustic-border/30">
                  {missoesGuarnicao.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-stone-400 italic bg-stone-50/40">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-stone-300">event_busy</span>
                          <span>Nenhuma missão ou instrução encontrada para o filtro selecionado neste mês.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    missoesGuarnicao.map((item, idx) => {
                      const isMissao = item.tipo === 'missao';
                      const colorGuarnicao = getGuarnicaoBadgeStyle(item.guarnicao);

                      return (
                        <tr key={item.id || idx} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3.5 px-4 text-xs">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 shadow-sm ${
                              isMissao ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                            }`}>
                              <span className="material-symbols-outlined text-[14px]">
                                {isMissao ? 'flag' : 'school'}
                              </span>
                              {isMissao ? 'Missão' : 'Instrução'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-rustic-brown">
                            <div className="text-sm font-black text-stone-900">{item.titulo}</div>
                            {item.detalhes && (
                              <div className="text-[11px] text-stone-500 font-normal line-clamp-1 mt-0.5">{item.detalhes}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-rustic-brown/80 font-medium">
                            <div className="font-bold text-stone-800">{new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                            {item.horario && <div className="text-[10px] text-stone-500 font-mono font-bold mt-0.5">{item.horario}</div>}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold">
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black inline-flex items-center gap-1 border shadow-xs ${colorGuarnicao}`}>
                              <span className="material-symbols-outlined text-[13px]">shield</span>
                              {item.guarnicao}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold text-stone-700">
                            {item.responsavelOuInstrutor}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 shadow-xs ${
                              item.status === 'Concluída'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : item.status === 'Em Andamento'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-stone-100 text-stone-700 border border-stone-300'
                            }`}>
                              {item.status === 'Concluída' && <span className="material-symbols-outlined text-[12px]">check_circle</span>}
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>


      {/* Report History Table */}
      <div className="bg-white border border-rustic-border rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">history</span>
          Histórico de Relatórios
        </h3>

        {historico.length === 0 ? (
          <p className="text-center text-gray-400 italic py-8">
            Nenhum relatório gerado ainda. Selecione o mês/ano e clique em &quot;GERAR RELATÓRIO&quot;.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-rustic-border text-xs font-bold uppercase text-rustic-brown/50">
                <tr>
                  <th className="py-3 px-4">Mês/Ano</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Gerado em</th>
                  <th className="py-3 px-4">Patrimônio</th>
                  <th className="py-3 px-4">Viaturas</th>
                  <th className="py-3 px-4">Ocorrências</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rustic-border/30">
                {historico.map(r => (
                  <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold">
                      {MESES[r.mes - 1]?.slice(0, 3)}/{r.ano}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                        {r.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {new Date(r.updated_at || r.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-xs">{r.dados?.totalPatrimonio ?? '-'}</td>
                    <td className="py-3 px-4 text-xs">{r.dados?.totalViaturas ?? '-'}</td>
                    <td className="py-3 px-4 text-xs">{r.dados?.ocorrenciasAtendidas ?? '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingReport(r)}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-gray-400 hover:text-primary transition-colors"
                          title="Visualizar"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => r.dados && exportarPDF(r.dados)}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-gray-400 hover:text-[#1e293b] transition-colors"
                          title="Exportar PDF"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RelatoriosMensais;
