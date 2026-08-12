import React, { useMemo } from 'react';
import { Personnel } from '../../services/types';
import { formatLocalDate } from '../../utils/dateUtils';

interface Props {
    personnelList: Personnel[];
}

export default function PainelDinossauros({ personnelList }: Props) {
    const dinossauros = useMemo(() => {
        // Calcula a idade de serviço em dias / anos
        const calculateServiceTime = (dateStr?: string) => {
            if (!dateStr) return { days: 0, text: 'Data não informada' };
            const start = new Date(dateStr + 'T00:00:00');
            const now = new Date();
            if (isNaN(start.getTime())) return { days: 0, text: 'Data inválida' };

            let years = now.getFullYear() - start.getFullYear();
            let months = now.getMonth() - start.getMonth();

            if (months < 0 || (months === 0 && now.getDate() < start.getDate())) {
                years--;
                months += 12;
            }
            if (now.getDate() < start.getDate()) {
                months--;
                if (months < 0) {
                    months += 12;
                    years--;
                }
            }

            const diffTime = Math.abs(now.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let text = `${years} ano${years !== 1 ? 's' : ''}`;
            if (months > 0) {
                text += ` e ${months} m${months !== 1 ? 'eses' : 'ês'}`;
            }

            return { days: diffDays, text, years, months };
        };

        // Filtra militares que têm data_inclusao ou simula ordenação válida
        return [...personnelList]
            .map(p => {
                const info = calculateServiceTime(p.data_inclusao);
                return {
                    ...p,
                    serviceDays: info.days,
                    serviceText: info.text
                };
            })
            .sort((a, b) => b.serviceDays - a.serviceDays)
            .slice(0, 3); // Os 3 mais antigos
    }, [personnelList]);

    return (
        <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 p-5 rounded-2xl border border-amber-900/40 text-white shadow-md space-y-3.5">
            <div className="flex items-center justify-between border-b border-amber-900/40 pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">history_edu</span>
                    </div>
                    <div>
                        <h3 className="font-black text-base text-amber-100 flex items-center gap-1.5 leading-tight">
                            Os Dinossauros
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Veteranos
                            </span>
                        </h3>
                        <p className="text-[11px] text-amber-200/70 leading-tight">
                            3 militares com maior tempo de serviço prestado
                        </p>
                    </div>
                </div>
                <span className="material-symbols-outlined text-amber-500/40 text-2xl hidden sm:block">
                    military_tech
                </span>
            </div>

            {dinossauros.length === 0 ? (
                <p className="text-xs text-amber-200/50 py-6 text-center italic">Nenhum militar encontrado.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {dinossauros.map((p, idx) => {
                        const rankColors = [
                            'from-amber-500/30 to-amber-600/10 border-amber-500/40 text-amber-200',
                            'from-stone-400/20 to-stone-500/10 border-stone-400/30 text-stone-200',
                            'from-amber-800/30 to-amber-900/10 border-amber-800/40 text-amber-300'
                        ];

                        return (
                            <div
                                key={p.id || idx}
                                className={`bg-gradient-to-b ${rankColors[idx]} p-3 rounded-xl border relative overflow-hidden backdrop-blur-xs flex flex-col justify-between`}
                            >
                                <div className="absolute top-1.5 right-2 text-2xl font-black opacity-15 text-white pointer-events-none">
                                    #{idx + 1}
                                </div>

                                <div>
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                        <span className="text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                                            {p.graduation || p.rank || 'BM'}
                                        </span>
                                        {p.war_name && (
                                            <span className="text-[10px] font-bold text-amber-100/80 truncate">
                                                ({p.war_name})
                                            </span>
                                        )}
                                    </div>

                                    <h4 className="font-black text-xs text-white truncate mb-0.5">
                                        {p.name}
                                    </h4>

                                    <p className="text-[9px] text-amber-200/70">
                                        Ingresso: {p.data_inclusao ? formatLocalDate(p.data_inclusao) : 'N/D'}
                                    </p>
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                                    <span className="text-[9px] font-bold uppercase text-amber-200/60">
                                        Tempo
                                    </span>
                                    <span className="text-[11px] font-black text-amber-300">
                                        {p.serviceText}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
