import React, { useState } from 'react';
import { Personnel } from '../../services/types';

interface ScaleConfigPanelProps {
    personnelList: Personnel[];
    initialTeams?: Record<string, number[]>;
    onSave: (config: any) => void;
    onPublish: (month: string, shiftType: string, teams: Record<string, number[]>) => void;
}

const ScaleConfigPanel: React.FC<ScaleConfigPanelProps> = ({ personnelList, initialTeams, onSave, onPublish }) => {
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [shiftType, setShiftType] = useState('24x72');
    const [teams, setTeams] = useState<Record<string, number[]>>(initialTeams || {
        'Alpha': [],
        'Bravo': [],
        'Charlie': [],
        'Delta': []
    });

    const handleAddPersonnel = (team: string, id: number) => {
        if (teams[team].includes(id)) return;
        setTeams(prev => ({
            ...prev,
            [team]: [...prev[team], id]
        }));
    };

    const handleRemovePersonnel = (team: string, id: number) => {
        setTeams(prev => ({
            ...prev,
            [team]: prev[team].filter(tId => tId !== id)
        }));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.keys(teams).map(teamName => (
                    <div key={teamName} className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                        <h4 className="font-black text-sm mb-3 flex items-center justify-between">
                            Turma {teamName}
                            <span className="text-[10px] bg-stone-200 px-2 py-0.5 rounded-full">{teams[teamName].length} mil.</span>
                        </h4>

                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                            {teams[teamName].map(pId => {
                                const p = personnelList.find(mil => mil.id === pId);
                                return (
                                    <div key={pId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-100 text-xs">
                                        <span className="font-bold truncate max-w-[120px]">{p?.graduation || ''} {p?.war_name || p?.name}</span>
                                        <button
                                            onClick={() => handleRemovePersonnel(teamName, pId)}
                                            className="text-stone-300 hover:text-red-500 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                );
                            })}
                            {teams[teamName].length === 0 && (
                                <p className="text-[10px] text-stone-400 italic text-center py-4">Nenhum militar</p>
                            )}
                        </div>

                        <select
                            value=""
                            onChange={e => e.target.value && handleAddPersonnel(teamName, Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg border border-stone-200 text-[10px] bg-white cursor-pointer"
                        >
                            <option value="">+ Adicionar militar...</option>
                            {personnelList
                                .filter(p => p.status === 'Ativo' && !Object.values(teams).flat().includes(p.id!))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.graduation || ''} {p.war_name || p.name}
                                    </option>
                                ))
                            }
                        </select>
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                    onClick={() => onSave(teams)}
                    className="px-6 py-3 bg-stone-100 text-stone-600 font-black text-xs rounded-xl hover:bg-stone-200 transition-all uppercase tracking-widest"
                >
                    Salvar Turmas
                </button>
                <button
                    onClick={() => onPublish(month, shiftType, teams)}
                    className="px-8 py-3 bg-primary text-white font-black text-xs rounded-xl hover:shadow-lg transition-all uppercase tracking-widest"
                >
                    Projetar e Publicar Escala
                </button>
            </div>
        </div>
    );
};

export default ScaleConfigPanel;
