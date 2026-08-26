import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
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
    const curMonth = now.getMonth(); // 0-indexed (0 = Jan)

    // Próximo mês (YYYY-MM)
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

    const getLeaveLabel = (type?: string) => {
        if (!type) return 'FÉRIAS';
        const map: Record<string, string> = {
            ferias: 'FÉRIAS',
            desconto_ferias: 'DESCONTO FÉRIAS',
            licenca_medica: 'LIC. MÉDICA',
            licenca_especial: 'LIC. ESPECIAL',
            afastamento: 'AFASTAMENTO',
            cedido: 'CEDIDO',
            outros: 'OUTROS'
        };
        return map[type] || type.toUpperCase();
    };

    // SEÇÃO A — PRÓXIMO MÊS
    const proximoMes = vacations.filter(v => {
        if (v.status === 'cancelado') return false;
        return v.start_date && v.start_date.startsWith(nextMonthPrefix);
    });

    // SEÇÃO B — EM AFASTAMENTO
    const emAfastamento = vacations.filter(v => {
        if (v.status === 'cancelado') return false;
        return v.start_date && v.end_date && v.start_date <= todayStr && v.end_date >= todayStr;
    });

    // SEÇÃO C — RETORNARAM ESTE MÊS
    const retornaramEsteMes = vacations.filter(v => {
        if (v.status === 'cancelado') return false;
        return v.end_date && v.end_date.startsWith(curMonthPrefix) && v.end_date < todayStr;
    });

    return (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/60 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">beach_access</span>
                </div>
                <div>
                    <h3 className="font-black text-base text-stone-800 leading-tight">Painel de Afastamentos</h3>
                    <p className="text-[11px] text-stone-500 leading-tight">Acompanhamento mensal de férias e licenças</p>
                </div>
            </div>

            {/* Grid 3 colunas em telas grandes, 1 coluna em telas normais de painel */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-stretch">
                {/* SEÇÃO A — PRÓXIMO MÊS */}
                <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-3 flex flex-col justify-start h-full min-w-0">
                    <div>
                        <div className="flex items-center justify-between mb-2.5 border-b border-stone-200/60 pb-2">
                            <span className="font-black text-[11px] uppercase tracking-wide text-blue-700 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">event_upcoming</span>
                                Próximo Mês
                            </span>
                            <span className="text-[10px] font-black bg-blue-100/80 text-blue-800 px-1.5 py-0.5 rounded-full border border-blue-200 shrink-0">
                                {proximoMes.length}
                            </span>
                        </div>

                        {proximoMes.length === 0 ? (
                            <p className="text-[10px] text-stone-400 py-4 text-center italic">Nenhum afastamento previsto.</p>
                        ) : (
                            <div className="space-y-2">
                                {proximoMes.map((v, idx) => (
                                    <div key={v.id || idx} className="bg-white p-2 rounded-lg border border-stone-200 text-xs shadow-2xs space-y-1 overflow-hidden">
                                        <p className="font-bold text-stone-800 truncate text-[11px]">{getMilitarName(v)}</p>
                                        <div className="flex flex-wrap items-center justify-between text-[9px] text-stone-500 pt-1 border-t border-stone-100 gap-1">
                                            <span className="font-extrabold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 shrink-0">{getLeaveLabel(v.leave_type)}</span>
                                            <span className="font-medium text-stone-600 truncate">Início: {formatLocalDate(v.start_date)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SEÇÃO B — EM AFASTAMENTO */}
                <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-3 flex flex-col justify-start h-full min-w-0">
                    <div>
                        <div className="flex items-center justify-between mb-2.5 border-b border-amber-200/60 pb-2">
                            <span className="font-black text-[11px] uppercase tracking-wide text-amber-800 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">beach_access</span>
                                Em Afastamento
                            </span>
                            <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                                {emAfastamento.length}
                            </span>
                        </div>

                        {emAfastamento.length === 0 ? (
                            <p className="text-[10px] text-stone-400 py-4 text-center italic">Nenhum militar em afastamento.</p>
                        ) : (
                            <div className="space-y-2">
                                {emAfastamento.map((v, idx) => (
                                    <div key={v.id || idx} className="bg-white p-2 rounded-lg border border-amber-200/80 text-xs shadow-2xs space-y-1 overflow-hidden">
                                        <p className="font-bold text-stone-800 truncate text-[11px]">{getMilitarName(v)}</p>
                                        <div className="flex items-center justify-between text-[9px] gap-1">
                                            <span className="font-extrabold text-amber-800 bg-amber-100/60 px-1 py-0.5 rounded border border-amber-200 shrink-0 truncate max-w-[90px]">{getLeaveLabel(v.leave_type)}</span>
                                            <span className="font-bold text-stone-700 shrink-0">{v.day_count ? `${v.day_count} dias` : ''}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between text-[9px] text-stone-500 pt-1 border-t border-stone-100 font-medium gap-1">
                                            <span className="truncate">Início: {formatLocalDate(v.start_date)}</span>
                                            <span className="font-bold text-amber-900 truncate">Ret: {formatLocalDate(v.end_date)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SEÇÃO C — RETORNARAM ESTE MÊS */}
                <div className="bg-emerald-50/30 border border-emerald-200/80 rounded-xl p-3 flex flex-col justify-start h-full min-w-0">
                    <div>
                        <div className="flex items-center justify-between mb-2.5 border-b border-emerald-200/60 pb-2">
                            <span className="font-black text-[11px] uppercase tracking-wide text-emerald-800 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">assignment_return</span>
                                Retornaram Este Mês
                            </span>
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                                {retornaramEsteMes.length}
                            </span>
                        </div>

                        {retornaramEsteMes.length === 0 ? (
                            <p className="text-[10px] text-stone-400 py-4 text-center italic">Nenhum retorno neste mês.</p>
                        ) : (
                            <div className="space-y-2">
                                {retornaramEsteMes.map((v, idx) => (
                                    <div key={v.id || idx} className="bg-white p-2 rounded-lg border border-emerald-200/80 text-xs shadow-2xs space-y-1 overflow-hidden">
                                        <p className="font-bold text-stone-800 truncate text-[11px]">{getMilitarName(v)}</p>
                                        <div className="flex flex-wrap items-center justify-between text-[9px] text-stone-500 pt-1 border-t border-stone-100 gap-1">
                                            <span className="font-extrabold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 shrink-0 truncate max-w-[80px]">{getLeaveLabel(v.leave_type)}</span>
                                            <span className="font-semibold text-emerald-900 truncate">Retornou: {formatLocalDate(v.end_date)}</span>
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
