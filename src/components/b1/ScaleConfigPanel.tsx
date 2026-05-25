import React, { useState } from 'react';
import { Personnel } from '../../services/types';
import { GuarnicoesConfig } from './GuarnicoesConfig';

type PeriodoOption = 'atual' | '3meses' | '6meses' | 'custom';

interface ScaleConfigPanelProps {
    personnelList: Personnel[];
    initialAnchorDate?: string;
    onPublish: (month: string, shiftType: string, anchorDate: string) => void;
    onSyncCalendar?: (months: { mes: number; ano: number }[]) => void;
    calendarSyncing?: boolean;
    calendarProgress?: string;
}

const ScaleConfigPanel: React.FC<ScaleConfigPanelProps> = ({
    personnelList: _personnelList,
    initialAnchorDate,
    onPublish,
    onSyncCalendar,
    calendarSyncing,
    calendarProgress,
}) => {
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [anchorDate, setAnchorDate] = useState(initialAnchorDate || '2024-01-01');
    const [shiftType, setShiftType] = useState('24x72');
    const [stats, setStats] = useState({ guarnicoes: 0, membros: 0 });

    // Multi-month calendar sync
    const [periodo, setPeriodo] = useState<PeriodoOption>('atual');
    const [customStart, setCustomStart] = useState(month);
    const [customEnd, setCustomEnd] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 2);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const getMonthsForPeriodo = (): { mes: number; ano: number }[] => {
        const [baseYear, baseMonth] = month.split('-').map(Number);
        const result: { mes: number; ano: number }[] = [];

        if (periodo === 'atual') {
            result.push({ mes: baseMonth, ano: baseYear });
        } else if (periodo === '3meses') {
            for (let i = 0; i < 3; i++) {
                const d = new Date(baseYear, baseMonth - 1 + i, 1);
                result.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
            }
        } else if (periodo === '6meses') {
            for (let i = 0; i < 6; i++) {
                const d = new Date(baseYear, baseMonth - 1 + i, 1);
                result.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
            }
        } else if (periodo === 'custom') {
            const [sy, sm] = customStart.split('-').map(Number);
            const [ey, em] = customEnd.split('-').map(Number);
            const startD = new Date(sy, sm - 1, 1);
            const endD = new Date(ey, em - 1, 1);
            const cur = new Date(startD);
            while (cur <= endD) {
                result.push({ mes: cur.getMonth() + 1, ano: cur.getFullYear() });
                cur.setMonth(cur.getMonth() + 1);
            }
        }

        return result;
    };

    const periodoLabel = () => {
        const months = getMonthsForPeriodo();
        if (months.length === 1) return '1 mês';
        return `${months.length} meses`;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Mês de Referência</label>
                    <input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-stone-200 text-sm font-bold"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1 flex items-center gap-1">
                        Data Âncora (Início Ciclo A) <span className="material-symbols-outlined text-[12px]">help_outline</span>
                    </label>
                    <input
                        type="date"
                        value={anchorDate}
                        onChange={e => setAnchorDate(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-stone-200 text-sm font-bold text-primary"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 block mb-1">Regime de Serviço</label>
                    <select
                        value={shiftType}
                        onChange={e => setShiftType(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-stone-200 text-sm font-bold"
                    >
                        <option value="24x72">24x72 (Padrão)</option>
                        <option value="12x36">12x36</option>
                        <option value="administrative">Administrativo</option>
                    </select>
                </div>
            </div>

            <GuarnicoesConfig onDataChange={(g, m) => setStats({ guarnicoes: g, membros: m })} />

            {stats.membros === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <span className="material-symbols-outlined text-[16px] text-amber-500">warning</span>
                    <span><strong>Atenção:</strong> Nenhuma turma possui militares. Adicione militares às turmas antes de publicar a escala.</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
                    <span className="material-symbols-outlined text-[16px] text-green-500">check_circle</span>
                    <span><strong>✅ {stats.guarnicoes} guarnições configuradas com {stats.membros} militares</strong></span>
                </div>
            )}

            {/* ─── Período de publicação no Google Calendar ─── */}
            {onSyncCalendar && (
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-[18px]">calendar_month</span>
                        <span className="font-black text-xs uppercase text-blue-700">Publicar escala no Google Calendar</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {([
                            { value: 'atual' as const, label: 'Apenas este mês' },
                            { value: '3meses' as const, label: 'Próximos 3 meses' },
                            { value: '6meses' as const, label: 'Próximos 6 meses' },
                            { value: 'custom' as const, label: 'Personalizado' },
                        ]).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setPeriodo(opt.value)}
                                className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                                    periodo === opt.value
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                        : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {periodo === 'custom' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-blue-500 block mb-1">De:</label>
                                <input
                                    type="month"
                                    value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-blue-200 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-blue-500 block mb-1">Até:</label>
                                <input
                                    type="month"
                                    value={customEnd}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-blue-200 text-sm font-bold"
                                />
                            </div>
                        </div>
                    )}

                    {calendarProgress && (
                        <div className="flex items-center gap-2 p-2 bg-white/80 rounded-lg text-xs font-bold text-blue-700">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                            {calendarProgress}
                        </div>
                    )}

                    <button
                        onClick={() => onSyncCalendar(getMonthsForPeriodo())}
                        disabled={calendarSyncing || stats.membros === 0}
                        className={`w-full py-3 font-black text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 ${
                            calendarSyncing || stats.membros === 0
                                ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                        }`}
                    >
                        <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
                        {calendarSyncing
                            ? 'Sincronizando...'
                            : `Sincronizar Google Calendar (${periodoLabel()})`
                        }
                    </button>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                    onClick={() => {
                        if (stats.membros === 0) {
                            alert('⚠️ Adicione militares às turmas antes de publicar!');
                            return;
                        }
                        onPublish(month, shiftType, anchorDate);
                    }}
                    disabled={stats.membros === 0}
                    className={`px-8 py-3 font-black text-xs rounded-xl transition-all uppercase tracking-widest ${stats.membros === 0 ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : 'bg-primary text-white hover:shadow-lg'}`}
                >
                    Projetar e Publicar Escala
                </button>
            </div>
        </div>
    );
};

export default ScaleConfigPanel;
