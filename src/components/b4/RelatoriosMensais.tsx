import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  gerarRelatorioMensal,
  salvarRelatorio,
  listarRelatorios,
  RelatorioMensal,
  RelatorioSalvo,
} from '../../services/b4RelatorioService';
import { GoogleSheetsService } from '../../services/googleSheetsService';
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
  }, [loadHistorico]);

  const handleGerar = async () => {
    setLoading(true);
    try {
      const resultado = await gerarRelatorioMensal(mes, ano);
      setRelatorio(resultado);

      await salvarRelatorio(resultado);

      // Fire-and-forget Google Sheets sync
      GoogleSheetsService.syncRelatorioB4(resultado).then(ok => {
        if (ok) toast.info('📊 Relatório sincronizado com Google Sheets.');
      });

      toast.success(`Relatório de ${MESES[mes - 1]}/${ano} gerado!`);
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
    doc.text('CORPO DE BOMBEIROS MILITAR', 105, 20, { align: 'center' });
    doc.text('5ª BBM — ARAQUARI/SC', 105, 28, { align: 'center' });

    doc.setFontSize(13);
    doc.text(rel.titulo, 105, 38, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
      105, 46, { align: 'center' }
    );

    // Metrics table
    autoTable(doc, {
      startY: 55,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total de Patrimônio', rel.totalPatrimonio.toString()],
        ['Total de Viaturas', rel.totalViaturas.toString()],
        ['Viaturas Operacionais', rel.viaturasOperacionais.toString()],
        ['Viaturas em Manutenção', rel.viaturasManutencao.toString()],
        ['Patrimônio Novo no Mês', rel.patrimonioNovo.toString()],
        ['Patrimônio Baixado', rel.patrimonioDescartado.toString()],
        ['Total de Aquisições', rel.totalManutencoes.toString()],
        ['Custo com Aquisições', formatCurrency(rel.custoManutencoes)],
        ['Combustível Consumido', `${rel.totalCombustivel} L`],
        ['Custo com Combustível', formatCurrency(rel.custoCombustivel)],
        ['Ocorrências Atendidas', rel.ocorrenciasAtendidas.toString()],
        ['KM Totais da Frota', `${rel.kmRodados.toLocaleString('pt-BR')} km`],
      ],
      styles: { fontSize: 10 },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      'Documento gerado automaticamente pelo Sistema de Gestão Interna — 5ª BBM CBMSC',
      105, pageHeight - 10, { align: 'center' }
    );

    doc.save(`relatorio-b4-${MESES[rel.mes - 1].toLowerCase()}-${rel.ano}.pdf`);
    toast.success('PDF exportado!');
  };

  const activeReport = viewingReport?.dados || relatorio;

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
              <button
                onClick={() => exportarPDF(activeReport)}
                className="h-10 px-4 bg-[#1e293b] text-white font-bold rounded-xl shadow hover:brightness-125 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                PDF
              </button>
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
            <MetricCard label="Custo Aquisições" value={formatCurrency(activeReport.custoManutencoes)} icon="payments" color="#6d28d9" />
            <MetricCard label="Combustível" value={`${activeReport.totalCombustivel} L`} icon="local_gas_station" color="#0e7490" />
            <MetricCard label="Ocorrências" value={activeReport.ocorrenciasAtendidas} icon="emergency" color="#1e293b" />
            <MetricCard label="KM da Frota" value={activeReport.kmRodados.toLocaleString('pt-BR')} icon="speed" color="#15803d" />
            <MetricCard label="Custo Combustível" value={formatCurrency(activeReport.custoCombustivel)} icon="attach_money" color="#c2410c" />
            <MetricCard label="Patrimônio Novo" value={activeReport.patrimonioNovo} icon="add_circle" color="#0369a1" />
            <MetricCard label="Patrimônio Baixado" value={activeReport.patrimonioDescartado} icon="remove_circle" color="#991b1b" />
          </div>
        </div>
      )}

      {/* Report History Table */}
      <div className="bg-white border border-rustic-border rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">history</span>
          Histórico de Relatórios
        </h3>

        {historico.length === 0 ? (
          <p className="text-center text-gray-400 italic py-8">
            Nenhum relatório gerado ainda. Selecione o mês/ano e clique em "GERAR RELATÓRIO".
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
