import React, { useState } from 'react';
import { Escala, Personnel, Vacation } from '../../services/types';

interface ScaleCalendarProps {
    month: string;
    escalas: Escala[];
    personnelList: Personnel[];
    vacations: Vacation[];
    onDayClick?: (date: string, personId: number) => void;
    onMonthChange?: (newMonth: string) => void;
}

const CORES: Record<string, { bg: string; text: string; hex: string; pillBg: string; borderHex: string }> = {
  A: { bg: 'bg-emerald-600', text: 'text-emerald-700', hex: '#16a34a', pillBg: '#dcfce7', borderHex: '#86efac' }, // VERDE
  B: { bg: 'bg-blue-600', text: 'text-blue-700', hex: '#2563eb', pillBg: '#dbeafe', borderHex: '#93c5fd' },   // AZUL
  C: { bg: 'bg-amber-500', text: 'text-amber-700', hex: '#ca8a04', pillBg: '#fef3c7', borderHex: '#fde047' },// AMARELO
  D: { bg: 'bg-rose-600', text: 'text-rose-700', hex: '#dc2626', pillBg: '#ffe4e6', borderHex: '#fca5a5' },    // VERMELHO
};

const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTurmaLetter = (turma?: string, equipe?: string): string => {
    const raw = (turma || equipe || '').trim().toUpperCase();
    if (raw.endsWith('A') || raw.includes('TURMA A') || raw.includes('GUARNIÇÃO A') || raw.includes('ALPHA') || raw.includes('AZUL')) return 'A';
    if (raw.endsWith('B') || raw.includes('TURMA B') || raw.includes('GUARNIÇÃO B') || raw.includes('BRAVO') || raw.includes('VERMELH')) return 'B';
    if (raw.endsWith('C') || raw.includes('TURMA C') || raw.includes('GUARNIÇÃO C') || raw.includes('CHARLIE') || raw.includes('AMAREL')) return 'C';
    if (raw.endsWith('D') || raw.includes('TURMA D') || raw.includes('GUARNIÇÃO D') || raw.includes('DELTA') || raw.includes('BRANC')) return 'D';
    if (raw.length === 1 && ['A', 'B', 'C', 'D'].includes(raw)) return raw;
    return 'A';
};

const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const ScaleCalendar: React.FC<ScaleCalendarProps> = ({ month, escalas, personnelList, vacations, onDayClick, onMonthChange }) => {
    const [viewMode, setViewMode] = useState<'grid' | 'matrix'>('grid');
    const [year, monthNum] = month.split('-').map(Number);
    
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const changeMonth = (delta: number) => {
        const d = new Date(year, monthNum - 1 + delta, 1);
        const newMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        onMonthChange?.(newMonthStr);
    };

    // Obter data do mês anterior e próximo para os minicalendários
    const prevMonthDate = new Date(year, monthNum - 2, 1);
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth() + 1;

    const nextMonthDate = new Date(year, monthNum, 1);
    const nextMonthYear = nextMonthDate.getFullYear();
    const nextMonthNum = nextMonthDate.getMonth() + 1;

    const getStatusForDay = (dayNum: number, personId: number) => {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        const dayEscala = (escalas || []).find(e => e && e.data === dateStr);
        const isScaled = dayEscala?.militares?.includes(personId);
        const warning = dayEscala?.warnings?.find(w => w && w.personnel_id === personId);

        const isVacation = (vacations || []).some(v =>
            v && v.personnel_id === personId &&
            v.start_date && v.end_date &&
            dateStr >= v.start_date &&
            dateStr <= v.end_date
        );

        if (isScaled && dayEscala) {
            const teamLetter = getTurmaLetter(dayEscala.turma, dayEscala.equipe);
            const teamInfo = CORES[teamLetter] || CORES['A'];
            
            const onDutyMembers = dayEscala.militares
                ?.map((id: number) => {
                    const p = personnelList.find(mil => mil.id === id);
                    return p ? `${p.graduation || ''} ${p.war_name || p.name.split(' ')[0]}`.trim() : null;
                })
                .filter(Boolean)
                .join(', ');

            return {
                label: teamLetter,
                cls: 'font-bold border-none',
                style: { backgroundColor: hexToRgba(teamInfo.hex, 0.2), color: teamInfo.hex },
                tooltip: `Guarnição ${teamLetter} - Serviço: ${onDutyMembers}`,
                warning: warning || (isVacation ? { type: 'VACATION', message: 'Militar em férias/licença' } : null)
            };
        }

        if (isVacation) return { label: 'Férias', cls: 'bg-amber-100 text-amber-700' };

        return null;
    };

    // Auxiliar para gerar o grid de 7 colunas (Segunda a Domingo)
    const getGridWeeks = () => {
        const firstDayObj = new Date(year, monthNum - 1, 1);
        const jsDay = firstDayObj.getDay(); // 0: Sun, 1: Mon...
        const paddingDays = jsDay === 0 ? 6 : jsDay - 1; // 0 para Segunda, 6 para Domingo

        const totalCells = Math.ceil((paddingDays + daysInMonth) / 7) * 7;
        const cells = [];

        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - paddingDays + 1;
            if (dayNum > 0 && dayNum <= daysInMonth) {
                cells.push({ dayNum, inMonth: true });
            } else {
                cells.push({ dayNum: null, inMonth: false });
            }
        }
        return cells;
    };

    // Auxiliar para renderizar um minicalendário
    const renderMiniCalendar = (mYear: number, mMonthNum: number) => {
        const mDaysInMonth = new Date(mYear, mMonthNum, 0).getDate();
        const firstDayObj = new Date(mYear, mMonthNum - 1, 1);
        const jsDay = firstDayObj.getDay();
        const paddingDays = jsDay === 0 ? 6 : jsDay - 1;
        const totalCells = Math.ceil((paddingDays + mDaysInMonth) / 7) * 7;

        const cells = [];
        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - paddingDays + 1;
            cells.push(dayNum > 0 && dayNum <= mDaysInMonth ? dayNum : null);
        }

        return (
            <div className="w-44 border border-blue-900/30 rounded overflow-hidden shadow-xs bg-white text-[9px]">
                <div className="bg-[#1e3a8a] text-white text-center py-0.5 font-bold tracking-tight text-[10px]">
                    {monthNames[mMonthNum - 1]} {mYear}
                </div>
                <div className="grid grid-cols-7 text-center font-bold bg-stone-100 text-stone-700 py-0.5 border-b border-stone-200">
                    <span>Se</span><span>Te</span><span>Qu</span><span>Qu</span><span>Se</span><span>Sá</span><span>Do</span>
                </div>
                <div className="grid grid-cols-7 text-center py-1 gap-y-0.5 text-stone-700">
                    {cells.map((d, idx) => (
                        <span key={idx} className={`${d === null ? 'text-transparent' : ''} ${idx % 7 === 6 ? 'font-bold' : ''}`}>
                            {d || '•'}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white border border-stone-300 rounded-xl overflow-hidden shadow-md">
            {/* Header de Ações e Navegação */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                            viewMode === 'grid'
                                ? 'bg-blue-700 text-white shadow-sm'
                                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">grid_on</span>
                        Calendário Mensal (Grid)
                    </button>
                    <button
                        onClick={() => setViewMode('matrix')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                            viewMode === 'matrix'
                                ? 'bg-blue-700 text-white shadow-sm'
                                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">view_timeline</span>
                        Matriz por Militar
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shadow-xs"
                    >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                        Anterior
                    </button>
                    <input
                        type="month"
                        value={month}
                        onChange={e => e.target.value && onMonthChange?.(e.target.value)}
                        className="h-8 px-2 bg-white border border-stone-300 text-xs font-bold rounded-lg text-stone-800"
                    />
                    <button
                        onClick={() => changeMonth(1)}
                        className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shadow-xs"
                    >
                        Próximo
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* LAYOUT MENSAL TIPO FOLHA DE CALENDÁRIO (CONFORME IMAGEM DE REFERÊNCIA) */}
            {viewMode === 'grid' && (
                <div className="p-6 bg-white space-y-4">
                    {/* Topo do Calendário: Título do Mês à esquerda + Mini Calendários à direita */}
                    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pb-2 border-b border-stone-100">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-[#2554a3] tracking-tight lowercase">
                                {monthNames[monthNum - 1]} <span className="font-bold">{year}</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-3 self-end">
                            {renderMiniCalendar(prevMonthYear, prevMonthNum)}
                            {renderMiniCalendar(nextMonthYear, nextMonthNum)}
                        </div>
                    </div>

                    {/* Grade Principal do Mês (7 Colunas: segunda-feira a domingo) */}
                    <div className="border-2 border-[#1e40af] rounded-lg overflow-hidden shadow-sm">
                        {/* Header das colunas dos dias da semana */}
                        <div className="grid grid-cols-7 bg-[#1e40af] text-white text-center text-xs md:text-sm font-extrabold py-2 border-b border-[#1e40af]">
                            <div>segunda-feira</div>
                            <div>terça-feira</div>
                            <div>quarta-feira</div>
                            <div>quinta-feira</div>
                            <div>sexta-feira</div>
                            <div>sábado</div>
                            <div>domingo</div>
                        </div>

                        {/* Células dos Dias */}
                        <div className="grid grid-cols-7 bg-blue-300/40 gap-[1px]">
                            {getGridWeeks().map((cell, index) => {
                                const isSunday = index % 7 === 6;
                                const isFirstDay = cell.dayNum === 1;
                                const dateStr = cell.dayNum
                                    ? `${year}-${String(monthNum).padStart(2, '0')}-${String(cell.dayNum).padStart(2, '0')}`
                                    : '';

                                const safeEscalas = Array.isArray(escalas) ? escalas : [];
                                const safePersonnel = Array.isArray(personnelList) ? personnelList : [];
                                const safeVacations = Array.isArray(vacations) ? vacations : [];

                                // Buscar dados da escala do dia
                                const dayEscala = cell.dayNum ? safeEscalas.find(e => e && e.data === dateStr) : null;
                                const teamLetter = dayEscala ? getTurmaLetter(dayEscala.turma, dayEscala.equipe) : null;
                                const teamInfo = teamLetter ? CORES[teamLetter] : null;

                                // Buscar bombeiros escalados no dia (excluindo os que estiverem em férias/afastamento na data)
                                const escaladosNoDia = (dayEscala?.militares && Array.isArray(dayEscala.militares))
                                    ? dayEscala.militares
                                        .filter(id => {
                                            const emAfastamento = safeVacations.some(v =>
                                                v && v.personnel_id === id &&
                                                v.start_date && v.end_date &&
                                                dateStr >= v.start_date &&
                                                dateStr <= v.end_date
                                            );
                                            return !emAfastamento;
                                        })
                                        .map(id => safePersonnel.find(p => p && p.id === id))
                                        .filter(Boolean) as Personnel[]
                                    : [];

                                return (
                                    <div
                                        key={index}
                                        onClick={() => cell.dayNum && onDayClick?.(dateStr, escaladosNoDia[0]?.id || 0)}
                                        className={`min-h-[105px] md:min-h-[125px] p-1.5 flex flex-col justify-start transition-all relative ${
                                            cell.inMonth
                                                ? 'bg-white hover:bg-blue-50/50 cursor-pointer'
                                                : 'bg-slate-50/70'
                                        }`}
                                    >
                                        {cell.dayNum && (
                                            <>
                                                {/* Número do Dia */}
                                                <div className="flex items-center justify-between w-full mb-1">
                                                    <span className={`text-sm md:text-base font-extrabold ${
                                                        isFirstDay || isSunday ? 'text-red-600' : 'text-stone-900'
                                                    }`}>
                                                        {cell.dayNum}
                                                    </span>

                                                    {teamLetter && teamInfo && (
                                                        <span
                                                            className="text-[9px] font-black px-1.5 py-0.5 rounded border shadow-2xs"
                                                            style={{
                                                                backgroundColor: teamInfo.pillBg,
                                                                color: teamInfo.hex,
                                                                borderColor: teamInfo.borderHex
                                                            }}
                                                        >
                                                            Gua {teamLetter}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Militares Escalados no Dia */}
                                                <div className="space-y-1 overflow-y-auto max-h-[85px] scrollbar-thin">
                                                    {escaladosNoDia.slice(0, 4).map((p, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="text-[10px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200/80 px-1.5 py-0.5 rounded truncate border border-stone-200 flex items-center justify-between"
                                                            title={`${p?.graduation || ''} ${p?.name}`}
                                                        >
                                                            <span className="truncate">
                                                                <strong className="text-stone-900 mr-1">{p?.graduation || ''}</strong>
                                                                {p?.war_name || p?.name.split(' ')[0]}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {escaladosNoDia.length > 4 && (
                                                        <div className="text-[9px] font-extrabold text-blue-700 text-center bg-blue-50 py-0.5 rounded">
                                                            +{escaladosNoDia.length - 4} militares
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rodapé e Legenda */}
                    <div className="flex flex-wrap items-center justify-between pt-2 border-t border-stone-200 text-xs text-stone-500 font-medium">
                        <div className="flex flex-wrap gap-4">
                            {Object.entries(CORES).map(([letra, cor]) => (
                                <div key={letra} className="flex items-center gap-1.5 font-bold">
                                    <span className="w-3 h-3 rounded border shadow-2xs" style={{ backgroundColor: cor.pillBg, borderColor: cor.borderHex }}></span>
                                    Guarnição {letra}
                                </div>
                            ))}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                            CBMSC — 3º/7ºBBM (Araquari)
                        </div>
                    </div>
                </div>
            )}

            {/* VISÃO MATRIZ TRADICIONAL POR MILITAR */}
            {viewMode === 'matrix' && (
                <div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[10px] border-collapse">
                            <thead>
                                <tr className="bg-stone-50 border-b border-stone-200">
                                    <th className="p-3 text-left border-r border-stone-200 min-w-[150px] sticky left-0 bg-stone-50 z-10 font-black uppercase text-stone-500">Militar</th>
                                    {days.map(d => (
                                        <th key={d} className="p-2 text-center border-r border-stone-100 min-w-[40px] font-black text-stone-400">
                                            {d}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {personnelList
                                    .filter(p => p.status === 'Ativo')
                                    .map(person => (
                                        <tr key={person.id} className="hover:bg-stone-50/50">
                                            <td className="p-3 border-r border-stone-200 sticky left-0 bg-white z-10 font-bold shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                {person.graduation || ''} {person.war_name || person.name}
                                            </td>
                                            {days.map(d => {
                                                const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const status = getStatusForDay(d, person.id!);
                                                return (
                                                    <td
                                                        key={d}
                                                        className="p-1 border-r border-stone-50 h-10 text-center cursor-pointer hover:bg-stone-50 transition-colors"
                                                        onClick={() => onDayClick?.(dateStr, person.id!)}
                                                    >
                                                        {status && (
                                                            <div
                                                                className={`w-full h-full flex items-center justify-center rounded-lg ${status.cls}`}
                                                                style={status.style}
                                                                title={status.tooltip}
                                                            >
                                                                {status.label === 'Férias' ? (
                                                                    <span className="uppercase font-black text-[7px]">{status.label}</span>
                                                                ) : (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-sm">{status.label}</span>
                                                                        {status.warning && (
                                                                            <span
                                                                                className="material-symbols-outlined text-[12px] text-amber-500 animate-pulse"
                                                                                title={status.warning.message}
                                                                            >
                                                                                warning
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap gap-4 text-[10px] font-bold uppercase text-stone-500">
                        {Object.entries(CORES).map(([letra, cor]) => (
                            <div key={letra} className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: hexToRgba(cor.hex, 0.2), borderColor: cor.hex }}></span> 
                                Guarnição {letra}
                            </div>
                        ))}
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-100 border border-stone-200"></span> Folga</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200"></span> Férias/Licença</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScaleCalendar;

