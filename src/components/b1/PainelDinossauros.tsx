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
        <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 p-6 rounded-2xl border border-amber-900/40 text-white shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-amber-900/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">history_edu</span>
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-amber-100 flex items-center gap-2">
                            Os Dinossauros
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Veteranos
                            </span>
                        </h3>
                        <p className="text-xs text-amber-200/70">
                            Os 3 militares com maior tempo de serviço prestado na instituição
                        </p>
                    </div>
                </div>
                <span className="material-symbols-outlined text-amber-500/40 text-3xl hidden sm:block">
                    military_tech
                </span>
            </div>

            {dinossauros.length === 0 ? (
                <p className="text-xs text-amber-200/50 py-8 text-center italic">Nenhum militar encontrado.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {dinossauros.map((p, idx) => {
                        const rankColors = [
                            'from-amber-500/30 to-amber-600/10 border-amber-500/40 text-amber-200',
                            'from-stone-400/20 to-stone-500/10 border-stone-400/30 text-stone-200',
                            'from-amber-800/30 to-amber-900/10 border-amber-800/40 text-amber-300'
                        ];

                        return (
                            <div
                                key={p.id || idx}
                                className={`bg-gradient-to-b ${rankColors[idx]} p-4 rounded-xl border relative overflow-hidden backdrop-blur-xs flex flex-col justify-between`}
                            >
                                <div className="absolute top-2 right-3 text-3xl font-black opacity-15 text-white">
                                    #{idx + 1}
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                                            {p.graduation || p.rank || 'BM'}
                                        </span>
                                        {p.war_name && (
                                            <span className="text-[11px] font-bold text-amber-100/80">
                                                ({p.war_name})
                                            </span>
                                        )}
                                    </div>

                                    <h4 className="font-black text-sm text-white truncate mb-1">
                                        {p.name}
                                    </h4>

                                    <p className="text-[10px] text-amber-200/70">
                                        Ingresso: {p.data_inclusao ? formatLocalDate(p.data_inclusao) : 'Não cadastrado'}
                                    </p>
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-amber-200/60">
                                        Tempo de Serviço
                                    </span>
                                    <span className="text-xs font-black text-amber-300">
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
