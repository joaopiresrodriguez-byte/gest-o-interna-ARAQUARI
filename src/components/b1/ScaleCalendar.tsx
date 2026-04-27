import React from 'react';
import { Escala, Personnel, Vacation } from '../../services/types';

interface ScaleCalendarProps {
    month: string;
    escalas: Escala[];
    personnelList: Personnel[];
    vacations: Vacation[];
}

const ScaleCalendar: React.FC<ScaleCalendarProps> = ({ month, escalas, personnelList, vacations }) => {
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getStatusForDay = (day: number, personId: number) => {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Check vacation
        const isVacation = vacations.some(v =>
            v.personnel_id === personId &&
            dateStr >= v.start_date &&
            dateStr <= v.end_date
        );
        if (isVacation) return { label: 'Férias', cls: 'bg-amber-100 text-amber-700' };

        // Check scale
        const escala = escalas.find(e => e.data === dateStr && e.militares?.includes(personId));
        if (escala) {
            if (escala.is_folga) return { label: 'Folga', cls: 'bg-stone-100 text-stone-400' };
            return { label: 'Serviço', cls: 'bg-primary/10 text-primary font-bold border border-primary/20' };
        }

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
                                        const status = getStatusForDay(d, person.id!);
                                        return (
                                            <td key={d} className="p-1 border-r border-stone-50 h-10 text-center">
                                                {status && (
                                                    <div className={`w-full h-full flex items-center justify-center rounded-lg ${status.cls}`}>
                                                        {status.label === 'Serviço' ? (
                                                            <span className="material-symbols-outlined text-[14px]">military_tech</span>
                                                        ) : (
                                                            <span className="uppercase font-black text-[7px]">{status.label}</span>
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
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/30"></span> Serviço</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-100 border border-stone-200"></span> Folga</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200"></span> Férias/Licença</div>
            </div>
        </div>
    );
};

export default ScaleCalendar;
