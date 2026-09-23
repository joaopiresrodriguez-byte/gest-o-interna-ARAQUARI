import React, { useState, useEffect, useMemo } from 'react';
import { Personnel, Vacation, ServiceSwap } from '../../services/types';
import { formatLocalDate } from '../../utils/dateUtils';
import { supabase } from '../../services/supabase';
import { ScaleAdjustmentService } from '../../services/scaleAdjustmentService';
import { toast } from 'sonner';

interface ExtratoItem {
    id: string;
    categoria: 'Afastamento / Licença' | 'Férias' | 'Troca de Serviço' | 'Troca de Escala' | 'Cedido / Transferência';
    militarNome: string;
    militarMatricula: string;
    detalhes: string;
    periodoOuData: string;
    statusSigrh: 'Pendente' | 'Em Andamento' | 'Concluído';
    observacaoB1?: string;
}

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
}

export const ExtratoMensalB1: React.FC<Props> = ({ personnelList, vacations }) => {
    const today = new Date();
    const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [monthRef, setMonthRef] = useState<string>(defaultMonth);
    const [loading, setLoading] = useState<boolean>(false);
    const [swaps, setSwaps] = useState<ServiceSwap[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [statusMap, setStatusMap] = useState<Record<string, { status: 'Pendente' | 'Em Andamento' | 'Concluído'; obs?: string }>>({});
    const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
    const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
    const [busca, setBusca] = useState<string>('');

    // Carregar chave de persistência local para os status do SIGRH
    const storageKey = useMemo(() => `b1_sigrh_status_extrato_${monthRef}`, [monthRef]);

    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setStatusMap(JSON.parse(saved));
            } catch (e) {
                setStatusMap({});
            }
        } else {
            setStatusMap({});
        }
    }, [storageKey]);

    const saveStatusMap = (newMap: Record<string, { status: 'Pendente' | 'Em Andamento' | 'Concluído'; obs?: string }>) => {
        setStatusMap(newMap);
        localStorage.setItem(storageKey, JSON.stringify(newMap));
    };

    // Carregar dados de permutas e logs do mês
    const loadMonthData = async () => {
        try {
            setLoading(true);
            // 1. Permutas / Trocas do Mês
            const { data: swapsData } = await supabase
                .from('service_swaps')
                .select('*')
                .eq('month_ref', monthRef);

            // 2. Logs de ajuste de escala e audit
            const logs = await ScaleAdjustmentService.getAuditLogs(monthRef);

            setSwaps(swapsData || []);
            setAuditLogs(logs || []);
        } catch (err) {
            console.error('Erro ao carregar dados do extrato mensal B1:', err);
            toast.error('Erro ao carregar dados do extrato do mês.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMonthData();
    }, [monthRef]);

    // Consolidar todos os eventos e alterações do mês em uma lista unificada
    const extratoItens = useMemo<ExtratoItem[]>(() => {
        const items: ExtratoItem[] = [];
        const [yearStr, monthStr] = monthRef.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);

        // A. Férias & Afastamentos / Licenças / Cedidos
        vacations.forEach(v => {
            if (!v.start_date) return;
            const sDate = new Date(v.start_date);
            // Verifica se a licença/férias incide ou inicia no mês de referência
            if (sDate.getFullYear() === year && (sDate.getMonth() + 1) === month) {
                const person = personnelList.find(p => p.id === v.personnel_id);
                const isFerias = v.leave_type === 'ferias' || v.leave_type === 'desconto_ferias';
                const isCedido = v.leave_type === 'cedido';

                const cat: ExtratoItem['categoria'] = isFerias
                    ? 'Férias'
                    : (isCedido ? 'Cedido / Transferência' : 'Afastamento / Licença');

                const key = `vac_${v.id || v.personnel_id}_${v.start_date}`;
                const savedState = statusMap[key] || { status: 'Pendente' };

                items.push({
                    id: key,
                    categoria: cat,
                    militarNome: v.full_name || person?.name || `Militar #${v.personnel_id}`,
                    militarMatricula: person?.matricula || '-',
                    detalhes: `${v.notes || v.leave_type.toUpperCase()} (${v.day_count} dias)`,
                    periodoOuData: `${formatLocalDate(v.start_date)} até ${formatLocalDate(v.end_date)}`,
                    statusSigrh: savedState.status,
                    observacaoB1: savedState.obs
                });
            }
        });

        // B. Trocas de Serviço (Service Swaps)
        swaps.forEach(s => {
            const pA = personnelList.find(p => p.id === s.personnel_id);
            const pB = personnelList.find(p => p.id === s.swap_with_personnel_id);

            const key = `swap_${s.id}`;
            const savedState = statusMap[key] || { status: 'Pendente' };

            items.push({
                id: key,
                categoria: 'Troca de Serviço',
                militarNome: pA ? `${pA.rank} ${pA.war_name || pA.name}` : (s.personnel_name || 'Militar A'),
                militarMatricula: pA?.matricula || '-',
                detalhes: `Troca com ${pB ? `${pB.rank} ${pB.war_name || pB.name}` : (s.swap_with_name || 'Militar B')}. Motivo: ${s.reason}`,
                periodoOuData: `Original: ${formatLocalDate(s.original_date)} | Nova: ${formatLocalDate(s.new_date)}`,
                statusSigrh: savedState.status,
                observacaoB1: savedState.obs
            });
        });

        // C. Alterações de Escala Individual (Scale Audit Logs)
        auditLogs.forEach(log => {
            const person = personnelList.find(p => p.id === Number(log.personnel_id));
            const key = `audit_${log.id}`;
            const savedState = statusMap[key] || { status: 'Pendente' };

            items.push({
                id: key,
                categoria: 'Troca de Escala',
                militarNome: person ? `${person.rank} ${person.war_name || person.name}` : (log.personnel_name || 'Militar'),
                militarMatricula: person?.matricula || '-',
                detalhes: `${log.action_type}: ${log.reason || 'Sem motivo registrado'} (por ${log.performed_by || 'B1'})`,
                periodoOuData: formatLocalDate(log.scale_date),
                statusSigrh: savedState.status,
                observacaoB1: savedState.obs
            });
        });

        return items;
    }, [vacations, swaps, auditLogs, personnelList, monthRef, statusMap]);

    // Filtragem dos itens
    const itensFiltrados = useMemo(() => {
        return extratoItens.filter(item => {
            const matchCat = filtroCategoria === 'TODAS' || item.categoria === filtroCategoria;
            const matchStatus = filtroStatus === 'TODOS' || item.statusSigrh === filtroStatus;
            const q = busca.toLowerCase();
            const matchBusca = !q ||
                item.militarNome.toLowerCase().includes(q) ||
                item.militarMatricula.toLowerCase().includes(q) ||
                item.detalhes.toLowerCase().includes(q);

            return matchCat && matchStatus && matchBusca;
        });
    }, [extratoItens, filtroCategoria, filtroStatus, busca]);

    // Métricas de progresso
    const totalItens = extratoItens.length;
    const concluidos = extratoItens.filter(i => i.statusSigrh === 'Concluído').length;
    const emAndamento = extratoItens.filter(i => i.statusSigrh === 'Em Andamento').length;
    const pendentes = extratoItens.filter(i => i.statusSigrh === 'Pendente').length;
    const porcentagem = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 100;

    // Atualização individual de status no SIGRH
    const handleStatusChange = (id: string, newStatus: 'Pendente' | 'Em Andamento' | 'Concluído') => {
        const updated = {
            ...statusMap,
            [id]: { ...statusMap[id], status: newStatus }
        };
        saveStatusMap(updated);
        toast.success(`Status atualizado para: ${newStatus}`);
    };

    const handleObsChange = (id: string, obs: string) => {
        const updated = {
            ...statusMap,
            [id]: { ...(statusMap[id] || { status: 'Pendente' }), obs }
        };
        saveStatusMap(updated);
    };

    // Imprimir Extrato Formatado B1
    const imprimirExtratoPDF = () => {
        const win = window.open('', '_blank');
        if (!win) return toast.error('Permita pop-ups para imprimir o relatório!');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Extrato Mensal do Efetivo B1 - ${monthRef}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
                    .header { text-align: center; border-bottom: 2px solid #990000; padding-bottom: 10px; margin-bottom: 15px; }
                    .header h2 { margin: 0; color: #990000; font-size: 16px; text-transform: uppercase; }
                    .header p { margin: 2px 0; font-weight: bold; }
                    .stats { display: flex; justify-content: space-around; background: #f4f4f4; padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #ddd; }
                    .stats-box { text-align: center; }
                    .stats-box span { display: block; font-size: 14px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
                    th { background-color: #f0f0f0; font-weight: bold; font-size: 10px; text-transform: uppercase; }
                    .badge { font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 9px; text-transform: uppercase; }
                    .badge-pendente { background-color: #fef3c7; color: #92400e; }
                    .badge-andamento { background-color: #dbeafe; color: #1e40af; }
                    .badge-concluido { background-color: #dcfce7; color: #166534; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>CORPO DE BOMBEIROS MILITAR DE SANTA CATARINA</h2>
                    <p>7º BATALHÃO DE BOMBEIROS MILITAR — ARAQUARI</p>
                    <p style="font-size: 13px; margin-top: 5px;">EXTRATO MENSAL DE ALTERAÇÕES DO EFETIVO (B1 / SIGRH) — MÊS ${monthRef}</p>
                </div>

                <div class="stats">
                    <div class="stats-box">TOTAL ALTERAÇÕES: <span>${totalItens}</span></div>
                    <div class="stats-box">CONCLUÍDAS NO SIGRH: <span style="color: green;">${concluidos}</span></div>
                    <div class="stats-box">EM ANDAMENTO: <span style="color: blue;">${emAndamento}</span></div>
                    <div class="stats-box">PENDENTES: <span style="color: orange;">${pendentes}</span></div>
                    <div class="stats-box">PROGRESSO B1: <span>${porcentagem}%</span></div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Categoria</th>
                            <th>Militar</th>
                            <th>Matrícula</th>
                            <th>Detalhes da Alteração</th>
                            <th>Período / Data</th>
                            <th>Status SIGRH</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${extratoItens.map(item => `
                            <tr>
                                <td><b>${item.categoria}</b></td>
                                <td>${item.militarNome}</td>
                                <td>${item.militarMatricula}</td>
                                <td>${item.detalhes}</td>
                                <td>${item.periodoOuData}</td>
                                <td><span class="badge badge-${item.statusSigrh === 'Concluído' ? 'concluido' : (item.statusSigrh === 'Em Andamento' ? 'andamento' : 'pendente')}">${item.statusSigrh}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 30px; text-align: right; font-style: italic;">
                    Gerado pelo Sistema Interno B1 em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
                </div>
            </body>
            </html>
        `;

        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    };

    return (
        <div className="space-y-6">
            {/* Header & Seletor de Mês */}
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h3 className="font-black text-xl text-gray-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-2xl">published_with_changes</span>
                        Extrato Mensal de Alterações do Efetivo (B1 / SIGRH)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Acompanhamento em tempo real das alterações do mês para cumprimento de demandas no SIGRH, SGP-e e planilhas internas.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl">
                        <span className="text-xs font-bold text-stone-500 uppercase">Mês Ref:</span>
                        <input
                            type="month"
                            value={monthRef}
                            onChange={e => setMonthRef(e.target.value)}
                            className="bg-transparent font-black text-sm text-gray-800 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={imprimirExtratoPDF}
                        className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl hover:brightness-110 shadow-md flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">print</span>
                        Imprimir Extrato B1
                    </button>
                </div>
            </div>

            {/* Card de Progresso do Cumprimento no SIGRH */}
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-stone-400 uppercase block">Progresso de Lançamento no SIGRH</span>
                        <span className="text-2xl font-black text-gray-900">{porcentagem}% Concluído</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            <span>{concluidos} Concluídos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span>{emAndamento} Em Andamento</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                            <span>{pendentes} Pendentes</span>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden flex">
                    <div className="bg-green-500 transition-all duration-500" style={{ width: `${totalItens > 0 ? (concluidos / totalItens) * 100 : 100}%` }}></div>
                    <div className="bg-blue-500 transition-all duration-500" style={{ width: `${totalItens > 0 ? (emAndamento / totalItens) * 100 : 0}%` }}></div>
                    <div className="bg-amber-400 transition-all duration-500" style={{ width: `${totalItens > 0 ? (pendentes / totalItens) * 100 : 0}%` }}></div>
                </div>
            </div>

            {/* Filtros e Busca */}
            <div className="bg-white p-4 rounded-xl border border-rustic-border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por militar, matrícula ou detalhe..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <select
                        value={filtroCategoria}
                        onChange={e => setFiltroCategoria(e.target.value)}
                        className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700"
                    >
                        <option value="TODAS">Todas as Categorias</option>
                        <option value="Afastamento / Licença">Afastamento / Licença</option>
                        <option value="Férias">Férias</option>
                        <option value="Troca de Serviço">Troca de Serviço</option>
                        <option value="Troca de Escala">Troca de Escala</option>
                        <option value="Cedido / Transferência">Cedido / Transferência</option>
                    </select>

                    <select
                        value={filtroStatus}
                        onChange={e => setFiltroStatus(e.target.value)}
                        className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700"
                    >
                        <option value="TODOS">Todos os Status SIGRH</option>
                        <option value="Pendente">🟡 Pendente</option>
                        <option value="Em Andamento">🔵 Em Andamento</option>
                        <option value="Concluído">🟢 Concluído</option>
                    </select>
                </div>
            </div>

            {/* Tabela de Extrato Mensal B1 */}
            <div className="bg-white rounded-2xl border border-rustic-border shadow-sm overflow-hidden">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-xs text-gray-500 font-bold">Consolidando alterações do efetivo no mês...</p>
                    </div>
                ) : itensFiltrados.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                        <span className="material-symbols-outlined text-4xl mb-2">checklist_rtl</span>
                        <p className="font-bold text-sm">Nenhuma alteração do efetivo encontrada para os filtros selecionados.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-stone-100 text-stone-600 font-black border-b border-stone-200 uppercase text-[10px]">
                                    <th className="py-3 px-4">Categoria</th>
                                    <th className="py-3 px-4">Militar</th>
                                    <th className="py-3 px-4">Matrícula</th>
                                    <th className="py-3 px-4">Alteração / Detalhes</th>
                                    <th className="py-3 px-4">Data / Período</th>
                                    <th className="py-3 px-4 text-center">Status SIGRH</th>
                                    <th className="py-3 px-4">Obs B1</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {itensFiltrados.map(item => (
                                    <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                                        <td className="py-3 px-4 font-bold text-stone-800 whitespace-nowrap">
                                            <span className="px-2 py-1 bg-stone-100 rounded-md text-[10px] text-stone-700 uppercase">
                                                {item.categoria}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-black text-gray-900 whitespace-nowrap">
                                            {item.militarNome}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-stone-600 font-semibold whitespace-nowrap">
                                            {item.militarMatricula}
                                        </td>
                                        <td className="py-3 px-4 text-stone-700 max-w-xs">
                                            {item.detalhes}
                                        </td>
                                        <td className="py-3 px-4 font-semibold text-stone-600 whitespace-nowrap">
                                            {item.periodoOuData}
                                        </td>
                                        <td className="py-3 px-4 text-center whitespace-nowrap">
                                            <select
                                                value={item.statusSigrh}
                                                onChange={e => handleStatusChange(item.id, e.target.value as any)}
                                                className={`px-3 py-1.5 rounded-xl font-black text-[11px] focus:outline-none cursor-pointer shadow-sm border transition-all ${
                                                    item.statusSigrh === 'Concluído'
                                                        ? 'bg-green-100 text-green-800 border-green-300'
                                                        : (item.statusSigrh === 'Em Andamento'
                                                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                                                            : 'bg-amber-100 text-amber-800 border-amber-300')
                                                }`}
                                            >
                                                <option value="Pendente">🟡 Pendente</option>
                                                <option value="Em Andamento">🔵 Em Andamento</option>
                                                <option value="Concluído">🟢 Concluído</option>
                                            </select>
                                        </td>
                                        <td className="py-3 px-4">
                                            <input
                                                type="text"
                                                placeholder="Anotação..."
                                                defaultValue={item.observacaoB1 || ''}
                                                onBlur={e => handleObsChange(item.id, e.target.value)}
                                                className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-[11px] text-stone-700 focus:outline-none focus:bg-white"
                                            />
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
