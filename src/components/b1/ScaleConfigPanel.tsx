import React, { useState } from 'react';
import { Personnel, TeamConfig } from '../../services/types';
import { GuarnicoesConfig } from './GuarnicoesConfig';

interface ScaleConfigPanelProps {
    personnelList: Personnel[];
    initialAnchorDate?: string;
    onPublish: (month: string, shiftType: string, anchorDate: string) => void;
}

const ScaleConfigPanel: React.FC<ScaleConfigPanelProps> = ({ personnelList, initialAnchorDate, onPublish }) => {
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [anchorDate, setAnchorDate] = useState(initialAnchorDate || '2024-01-01');
    const [shiftType, setShiftType] = useState('24x72');
    const [stats, setStats] = useState({ guarnicoes: 0, membros: 0 });

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
