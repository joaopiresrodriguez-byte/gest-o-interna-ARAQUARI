import React, { useEffect, useState, useMemo } from 'react';
import { PersonnelService } from '../services/personnelService';
import { Personnel } from '../services/types';

interface BirthdayCardProps {
    selectedDate: string;
}

export const BirthdayCard = React.memo<BirthdayCardProps>(({ selectedDate }) => {
    const [personnel, setPersonnel] = useState<Personnel[]>([]);

    useEffect(() => {
        const fetchPersonnel = async () => {
            const data = await PersonnelService.getPersonnel();
            setPersonnel(data);
        };
        fetchPersonnel();
    }, []);

    // Memoize birthday filtering to avoid recalculation on every render
    const birthdays = useMemo(() => {
        if (personnel.length === 0) return [];

        const [, month, day] = selectedDate.split('-');
        return personnel.filter(p => {
            if (!p.birth_date) return false;
            const [, pMonth, pDay] = p.birth_date.split('-');
            return pMonth === month && pDay === day;
        });
    }, [selectedDate, personnel]);

    if (birthdays.length === 0) return null;

    return (
        <div className="bg-surface rounded-xl border border-rustic-border shadow-sm p-4 animate-slide-in">
            <h3 className="text-sm font-black text-[#2c1810] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">cake</span>
                Aniversariantes do Dia
            </h3>
            <div className="space-y-3">
                {birthdays.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-background-light p-2 rounded-lg border border-rustic-border/50">
                        <div className="relative">
                            {p.image ? (
                                <img src={p.image} alt={p.name} className="w-10 h-10 rounded-full object-cover border-2 border-primary" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                                    <span className="material-symbols-outlined text-primary">person</span>
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">
                                🎉
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#2c1810]">{p.rank} {p.war_name || p.name}</p>
                            <p className="text-[10px] text-rustic-brown/60">Parabéns!</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

BirthdayCard.displayName = 'BirthdayCard';
