import React, { useState } from 'react';
import { Personnel, TeamConfig } from '../../services/types';

interface ScaleConfigPanelProps {
    personnelList: Personnel[];
    initialTeams?: TeamConfig[];
    initialAnchorDate?: string;
    onSave: (config: { teams: TeamConfig[], anchorDate: string }) => void;
    onPublish: (month: string, shiftType: string, teams: TeamConfig[], anchorDate: string) => void;
}

const ScaleConfigPanel: React.FC<ScaleConfigPanelProps> = ({ personnelList, initialTeams, initialAnchorDate, onSave, onPublish }) => {
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [anchorDate, setAnchorDate] = useState(initialAnchorDate || '2024-01-01');
    const [shiftType, setShiftType] = useState('24x72');
    const [teams, setTeams] = useState<TeamConfig[]>(initialTeams || [
        { name: 'Turma A', color: '#ef4444', personnelIds: [] },
        { name: 'Turma B', color: '#3b82f6', personnelIds: [] },
        { name: 'Turma C', color: '#10b981', personnelIds: [] },
        { name: 'Turma D', color: '#f59e0b', personnelIds: [] }
    ]);

    const handleAddPersonnel = (teamIdx: number, id: number) => {
        const newTeams = [...teams];
        if (newTeams[teamIdx].personnelIds.includes(id)) return;
        newTeams[teamIdx].personnelIds = [...newTeams[teamIdx].personnelIds, id];
        setTeams(newTeams);
    };

    const handleRemovePersonnel = (teamIdx: number, id: number) => {
        const newTeams = [...teams];
        newTeams[teamIdx].personnelIds = newTeams[teamIdx].personnelIds.filter((tId: number) => tId !== id);
        setTeams(newTeams);
    };

    const handleUpdateTeam = (teamIdx: number, updates: Partial<TeamConfig>) => {
        const newTeams = [...teams];
        newTeams[teamIdx] = { ...newTeams[teamIdx], ...updates } as TeamConfig;
        setTeams(newTeams);
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {teams.map((team, idx) => (
                    <div key={idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                        <div className="mb-4">
                            <input
                                value={team.name}
                                onChange={e => handleUpdateTeam(idx, { name: e.target.value })}
                                className="font-black text-sm w-full bg-transparent border-b border-stone-300 focus:border-primary outline-none pb-1"
                                placeholder="Nome da Turma"
                            />
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="color"
                                    value={team.color}
                                    onChange={e => handleUpdateTeam(idx, { color: e.target.value })}
                                    className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                                />
                                <span className="text-[10px] text-gray-400">Cor Identificação</span>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                            {team.personnelIds.map((pId: number) => {
                                const p = personnelList.find(mil => mil.id === pId);
                                return (
                                    <div key={pId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-100 text-xs shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }}></div>
                                            <span className="font-bold truncate max-w-[120px]">{p?.graduation || ''} {p?.war_name || p?.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemovePersonnel(idx, pId)}
                                            className="text-stone-300 hover:text-red-500 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                );
                            })}
                            {team.personnelIds.length === 0 && (
                                <p className="text-[10px] text-stone-400 italic text-center py-4">Nenhum militar</p>
                            )}
                        </div>

                        <select
                            value=""
                            onChange={e => e.target.value && handleAddPersonnel(idx, Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg border border-stone-200 text-[10px] bg-white cursor-pointer"
                        >
                            <option value="">+ Adicionar militar...</option>
                            {personnelList
                                .filter(p => p.status === 'Ativo' && !teams.some(t => t.personnelIds.includes(p.id!)))
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
                    onClick={() => onSave({ teams, anchorDate })}
                    className="px-6 py-3 bg-stone-100 text-stone-600 font-black text-xs rounded-xl hover:bg-stone-200 transition-all uppercase tracking-widest"
                >
                    Salvar Configuração
                </button>
                <button
                    onClick={() => onPublish(month, shiftType, teams, anchorDate)}
                    className="px-8 py-3 bg-primary text-white font-black text-xs rounded-xl hover:shadow-lg transition-all uppercase tracking-widest"
                >
                    Projetar e Publicar Escala
                </button>
            </div>
        </div>
    );
};

export default ScaleConfigPanel;
