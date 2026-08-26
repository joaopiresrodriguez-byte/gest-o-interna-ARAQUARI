import { useState, useEffect, useMemo } from 'react';
import { Personnel } from '../../services/types';
import { supabase } from '../../services/supabase';

interface Props {
    personnelList: Personnel[];
}

type PeriodoFilter = 'mes_atual' | '30_dias' | 'todos';

interface RankedUser {
    id: string | number;
    name: string;
    graduation: string;
    war_name?: string;
    totalAccesses: number;
}

export default function RankingAcesso({ personnelList }: Props) {
    const [periodo, setPeriodo] = useState<PeriodoFilter>('mes_atual');
    const [accessLogs, setAccessLogs] = useState<{ user_email: string; accessed_at: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchAccessLogs = async () => {
            try {
                setLoading(true);
                let query = supabase.from('user_access_logs').select('user_email, accessed_at');

                const now = new Date();
                if (periodo === 'mes_atual') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                    query = query.gte('accessed_at', startOfMonth);
                } else if (periodo === '30_dias') {
                    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
                    query = query.gte('accessed_at', thirtyDaysAgo);
                }

                const { data, error } = await query;
                if (error) throw error;
                setAccessLogs(data || []);
            } catch (err) {
                console.error('Erro ao buscar logs de acesso:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAccessLogs();
    }, [periodo]);

    // Calcular o ranking agrupando pelos registros reais de acesso
    const rankedPersonnel = useMemo(() => {
        // Contar acessos por e-mail
        const countsByEmail: Record<string, number> = {};
        accessLogs.forEach(log => {
            const email = (log.user_email || '').toLowerCase().trim();
            if (email) {
                countsByEmail[email] = (countsByEmail[email] || 0) + 1;
            }
        });

        // Mapear com os militares da lista de pessoal
        const ranked: RankedUser[] = personnelList.map(p => {
            const email = (p.email || '').toLowerCase().trim();
            const count = countsByEmail[email] || 0;
            return {
                id: p.id || p.email,
                name: p.name,
                graduation: p.graduation || p.rank || 'BM',
                war_name: p.war_name,
                totalAccesses: count,
            };
        });

        // Adicionar usuários que acessaram mas podem não estar na tabela personnel
        Object.keys(countsByEmail).forEach(email => {
            const exists = personnelList.some(p => (p.email || '').toLowerCase().trim() === email);
            if (!exists) {
                ranked.push({
                    id: email,
                    name: email.split('@')[0],
                    graduation: 'USER',
                    totalAccesses: countsByEmail[email],
                });
            }
        });

        // Ordenar do maior para o menor número de acessos
        return ranked
            .filter(r => r.totalAccesses > 0)
            .sort((a, b) => b.totalAccesses - a.totalAccesses);
    }, [personnelList, accessLogs]);

    const getBadgeStyle = (index: number) => {
        if (index === 0) return 'bg-amber-100 text-amber-800 border-amber-300 font-black'; // Ouro
        if (index === 1) return 'bg-stone-200 text-stone-800 border-stone-300 font-black'; // Prata
        if (index === 2) return 'bg-amber-700/10 text-amber-900 border-amber-700/30 font-black'; // Bronze
        return 'bg-stone-100 text-stone-600 border-stone-200 font-bold';
    };

    const getIcon = (index: number) => {
        if (index === 0) return 'workspace_premium';
        if (index === 1) return 'military_tech';
        if (index === 2) return 'award_star';
        return 'person';
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-stone-100 pb-4 gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">leaderboard</span>
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-gray-800">Ranking de Acesso ao Sistema</h3>
                        <p className="text-xs text-gray-500">Militares com maior engajamento e número de acessos registrados</p>
                    </div>
                </div>
                
                {/* Filtro por Período */}
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                    <button
                        onClick={() => setPeriodo('mes_atual')}
                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${periodo === 'mes_atual' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                    >
                        Mês Atual
                    </button>
                    <button
                        onClick={() => setPeriodo('30_dias')}
                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${periodo === '30_dias' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                    >
                        Últimos 30 dias
                    </button>
                    <button
                        onClick={() => setPeriodo('todos')}
                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${periodo === 'todos' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                    >
                        Todo o Período
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-8 text-center text-xs text-gray-400 animate-pulse">Carregando logs de acesso...</div>
            ) : rankedPersonnel.length === 0 ? (
                <p className="text-xs text-gray-400 py-8 text-center italic">Nenhum registro de acesso encontrado no período selecionado.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rankedPersonnel.map((p, index) => (
                        <div
                            key={p.id || index}
                            className="flex items-center justify-between p-3.5 bg-stone-50/70 hover:bg-stone-100/80 rounded-xl border border-stone-200/80 transition-all"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs ${getBadgeStyle(index)}`}>
                                    {index < 3 ? (
                                        <span className="material-symbols-outlined text-base">{getIcon(index)}</span>
                                    ) : (
                                        `#${index + 1}`
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-gray-800 truncate">
                                        {p.name}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                        <span className="font-black uppercase bg-stone-200/80 px-1.5 py-0.5 rounded text-stone-700">
                                            {p.graduation}
                                        </span>
                                        {p.war_name && <span>({p.war_name})</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <span className="text-base font-black text-blue-700 block">
                                    {p.totalAccesses}
                                </span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight block">
                                    acessos
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
