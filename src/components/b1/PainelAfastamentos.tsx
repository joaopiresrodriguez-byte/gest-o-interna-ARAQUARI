import React from 'react';
import { Personnel, Vacation } from '../../services/types';
import { formatLocalDate } from '../../utils/dateUtils';

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
}

export default function PainelAfastamentos({ personnelList, vacations }: Props) {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)

    // Próximo mês (1-indexed string format YYYY-MM)
    const nextMonthObj = new Date(curYear, curMonth + 1, 1);
    const nextYear = nextMonthObj.getFullYear();
    const nextMonthNum = nextMonthObj.getMonth();
    const nextMonthPrefix = `${nextYear}-${String(nextMonthNum + 1).padStart(2, '0')}`;

    // Mês atual YYYY-MM
    const curMonthPrefix = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;

    // Nome auxiliar do militar
    const getMilitarName = (v: Vacation) => {
        const p = personnelList.find(item => item.id === v.personnel_id);
        if (p) return `${p.graduation ? p.graduation + ' ' : ''}${p.war_name || p.name}`;
        return v.full_name || 'Militar Desconhecido';
    };

    // SEÇÃO A — PRÓXIMO MÊS (iniciando férias/afastamento no próximo mês)
    const proximoMes = vacations.filter(v => {
        if (v.status === 'cancelado') return false;
        return v.start_date.startsWith(nextMonthPrefix);
    });

    // SEÇÃO B — EM AFASTAMENTO (atualmente entre start_date e end_date)
    const emAfastamento = vacations.filter(v => {
        if (v.status === 'cancelado') return false;
        return v.start_date <= todayStr && v.end_date >= todayStr;
    });

    // SEÇÃO C — RETORNARAM ESTE MÊS (end_date no mês atual e já passou/encerrou)
    const retornaramEsteMes = vacations.filter(v => {
        if (v.status === 'cancelado') return false;
        return v.end_date.startsWith(curMonthPrefix) && v.end_date < todayStr;
    });

    return (
        <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">beach_access</span>
                </div>
                <div>
                    <h3 className="font-black text-lg text-gray-800">Painel de Afastamentos</h3>
                    <p className="text-xs text-gray-500">Acompanhamento mensal de férias, licenças e dispensa do efetivo</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* SEÇÃO A — PRÓXIMO MÊS */}
                <div className="bg-stone-50/80 border border-stone-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3 border-b border-stone-200/60 pb-2">
                            <span className="font-black text-xs uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base">event_upcoming</span>
                                Próximo Mês
                            </span>
                            <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                {proximoMes.length}
                            </span>
                        </div>

                        {proximoMes.length === 0 ? (
                            <p className="text-xs text-gray-400 py-6 text-center italic">Nenhum afastamento previsto no próximo mês.</p>
                        ) : (
                            <div className="space-y-2.5">
                                {proximoMes.map((v, idx) => (
                                    <div key={v.id || idx} className="bg-white p-3 rounded-lg border border-stone-200 text-xs shadow-xs">
                                        <p className="font-bold text-gray-800">{getMilitarName(v)}</p>
                                        <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                                            <span className="font-bold text-blue-600 uppercase">{v.leave_type || 'Férias'}</span>
                                            <span>Início: {formatLocalDate(v.start_date)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SEÇÃO B — EM AFASTAMENTO */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3 border-b border-orange-200/60 pb-2">
                            <span className="font-black text-xs uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base">beach_access</span>
                                Em Afastamento
                            </span>
                            <span className="text-[10px] font-black bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                                {emAfastamento.length}
                            </span>
                        </div>

                        {emAfastamento.length === 0 ? (
                            <p className="text-xs text-gray-400 py-6 text-center italic">Nenhum militar em afastamento no momento.</p>
                        ) : (
                            <div className="space-y-2.5">
                                {emAfastamento.map((v, idx) => (
                                    <div key={v.id || idx} className="bg-white p-3 rounded-lg border border-orange-200 text-xs shadow-xs">
                                        <p className="font-bold text-gray-800">{getMilitarName(v)}</p>
                                        <p className="text-[10px] font-bold text-orange-600 uppercase mt-0.5">{v.leave_type || 'Férias'}</p>
                                        <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1 pt-1 border-t border-stone-100">
                                            <span>Início: {formatLocalDate(v.start_date)}</span>
                                            <span className="font-semibold text-gray-700">Retorno: {formatLocalDate(v.end_date)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SEÇÃO C — RETORNARAM ESTE MÊS */}
                <div className="bg-green-50/50 border border-green-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3 border-b border-green-200/60 pb-2">
                            <span className="font-black text-xs uppercase tracking-wider text-green-700 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base">assignment_return</span>
                                Retornaram Este Mês
                            </span>
                            <span className="text-[10px] font-black bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                {retornaramEsteMes.length}
                            </span>
                        </div>

                        {retornaramEsteMes.length === 0 ? (
                            <p className="text-xs text-gray-400 py-6 text-center italic">Nenhum retorno registrado neste mês.</p>
                        ) : (
                            <div className="space-y-2.5">
                                {retornaramEsteMes.map((v, idx) => (
                                    <div key={v.id || idx} className="bg-white p-3 rounded-lg border border-green-200 text-xs shadow-xs">
                                        <p className="font-bold text-gray-800">{getMilitarName(v)}</p>
                                        <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                                            <span className="font-bold text-green-700 uppercase">{v.leave_type || 'Férias'}</span>
                                            <span>Retornou em: {formatLocalDate(v.end_date)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
