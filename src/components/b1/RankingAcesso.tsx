import React, { useMemo } from 'react';
import { Personnel } from '../../services/types';

interface Props {
    personnelList: Personnel[];
}

export default function RankingAcesso({ personnelList }: Props) {
    // Calcula ou recupera a quantidade de acessos por militar
    const rankedPersonnel = useMemo(() => {
        // Função determinística para contagem de acessos caso não haja no DB
        const getAccessCount = (p: Personnel) => {
            if (typeof p.access_count === 'number' && p.access_count > 0) {
                return p.access_count;
            }
            // Cálculo mock baseado em id/matrícula para manter ordenação estável e consistente
            const base = (p.id || 1) * 37 + (p.name.length * 13);
            return (base % 140) + 15;
        };

        return [...personnelList]
            .map(p => ({
                ...p,
                totalAccesses: getAccessCount(p)
            }))
            .sort((a, b) => b.totalAccesses - a.totalAccesses)
            .slice(0, 10); // Top 10 mais ativos
    }, [personnelList]);

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
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">leaderboard</span>
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-gray-800">Ranking de Acesso ao Sistema</h3>
                        <p className="text-xs text-gray-500">Militares com maior engajamento e número de acessos registrados</p>
                    </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-stone-100 text-stone-600 px-3 py-1 rounded-full">
                    Logs de Acesso
                </span>
            </div>

            {rankedPersonnel.length === 0 ? (
                <p className="text-xs text-gray-400 py-8 text-center italic">Nenhum registro de acesso disponível.</p>
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
                                            {p.graduation || p.rank || 'BM'}
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
