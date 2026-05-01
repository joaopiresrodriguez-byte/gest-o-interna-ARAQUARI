import React from 'react';
import { Escala, Personnel, Vacation } from '../../services/types';

interface ScaleCalendarProps {
    month: string;
    escalas: Escala[];
    personnelList: Personnel[];
    vacations: Vacation[];
    onDayClick?: (date: string, personId: number) => void;
}

const CORES: Record<string, string> = {
  A: '#1d4ed8',
  B: '#15803d',
  C: '#c2410c',
  D: '#7e22ce',
};

const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ScaleCalendar: React.FC<ScaleCalendarProps> = ({ month, escalas, personnelList, vacations, onDayClick }) => {
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getStatusForDay = (dayNum: number, personId: number) => {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        // Find if scaled
        const dayEscala = escalas.find(e => e.data === dateStr);
        const isScaled = dayEscala?.militares?.includes(personId);

        // Find warnings for this specific person on this day
        const warning = dayEscala?.warnings?.find(w => w.personnel_id === personId);

        // Check vacation
        const isVacation = vacations.some(v =>
            v.personnel_id === personId &&
            dateStr >= v.start_date &&
            dateStr <= v.end_date
        );

        if (isScaled && dayEscala) {
            const teamLetter = dayEscala.turma || '?';
            const teamColor = CORES[teamLetter] || '#1d4ed8';
            
            // Build tooltip with names of all members on duty this day
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
                style: { backgroundColor: hexToRgba(teamColor, 0.2), color: teamColor },
                tooltip: `Serviço: ${onDutyMembers}`,
                warning: warning || (isVacation ? { type: 'VACATION', message: 'Militar em férias/licença' } : null)
            };
        }

        if (isVacation) return { label: 'Férias', cls: 'bg-amber-100 text-amber-700' };

        return null;
    };

    return (
        <div className="bg-white border text-rustic-brown border-stone-200 rounded-2xl overflow-hidden shadow-sm">
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
                        <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: hexToRgba(cor, 0.2), borderColor: cor }}></span> 
                        Guarnição {letra}
                    </div>
                ))}
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-100 border border-stone-200"></span> Folga</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200"></span> Férias/Licença</div>
            </div>
        </div>
    );
};

export default ScaleCalendar;
