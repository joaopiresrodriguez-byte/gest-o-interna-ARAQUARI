import React from 'react';
import { Personnel, DisciplinaryRecord } from '../../services/types';

interface Props {
    records: DisciplinaryRecord[];
    personnelList: Personnel[];
    onAdd: (record: Omit<DisciplinaryRecord, 'id'>) => void;
    onDelete: (id: string) => void;
    isEditor: boolean;
}

const recordTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
    elogio: { label: 'Elogio', color: 'bg-green-100 text-green-700', icon: 'thumb_up' },
    condecoracao: { label: 'Condecoração', color: 'bg-blue-100 text-blue-700', icon: 'military_tech' },
    punicao: { label: 'Punição', color: 'bg-red-100 text-red-700', icon: 'gavel' },
    comportamento: { label: 'Comportamento', color: 'bg-amber-100 text-amber-700', icon: 'psychology' },
};

const DisciplinarySection: React.FC<Props> = ({ records, personnelList, onAdd, onDelete, isEditor }) => {
    const [personId, setPersonId] = React.useState<number | ''>('');
    const [recordType, setRecordType] = React.useState<string>('elogio');
    const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = React.useState('');
    const [legalRef, setLegalRef] = React.useState('');
    const [responsible, setResponsible] = React.useState('');
    const [filterType, setFilterType] = React.useState('');
    const [filterPerson, setFilterPerson] = React.useState<number | ''>('');

    const handleSubmit = () => {
        if (!personId || !description) return;
        const person = personnelList.find(p => p.id === personId);
        onAdd({
            personnel_id: personId as number,
            record_type: recordType as any,
            date,
            description,
            legal_reference: legalRef,
            responsible_authority: responsible,
            personnel_name: person?.name,
        });
        setDescription('');
        setLegalRef('');
        setResponsible('');
    };

    const filtered = records.filter(r => {
        if (filterType && r.record_type !== filterType) return false;
        if (filterPerson && r.personnel_id !== filterPerson) return false;
        return true;
    });

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {isEditor && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm h-fit">
                    <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">description</span> Novo Registro
                    </h3>
                    <div className="space-y-4">
                        <select value={personId} onChange={e => setPersonId(Number(e.target.value))} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm">
                            <option value="">Selecionar Militar...</option>
                            {personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation ? `${p.graduation} ` : ''}{p.name}</option>)}
                        </select>
                        <select value={recordType} onChange={e => setRecordType(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm">
                            {Object.entries(recordTypeLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm" />
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 p-3 rounded-lg border border-rustic-border text-xs" placeholder="Descrição detalhada..." />
                        <input value={legalRef} onChange={e => setLegalRef(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Referência legal (ex: LC 801/2022)" />
                        <input value={responsible} onChange={e => setResponsible(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Autoridade responsável" />
                        <button onClick={handleSubmit} className="w-full py-3 bg-primary text-white font-black rounded-xl hover:brightness-110">REGISTRAR</button>
                    </div>
                </div>
            )}

            <div className={isEditor ? 'xl:col-span-2' : 'xl:col-span-3'}>
                <div className="bg-white rounded-2xl border border-rustic-border shadow-sm p-6">
                    <div className="flex flex-wrap gap-3 mb-6">
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 px-3 rounded-lg border text-xs font-bold">
                            <option value="">Todos os tipos</option>
                            {Object.entries(recordTypeLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select value={filterPerson} onChange={e => setFilterPerson(e.target.value ? Number(e.target.value) : '')} className="h-9 px-3 rounded-lg border text-xs font-bold">
                            <option value="">Todos os militares</option>
                            {personnelList.map(p => <option key={p.id} value={p.id}>{p.war_name || p.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-3">
                        {filtered.length === 0 && <p className="text-center py-12 text-gray-300 italic">Nenhum registro encontrado.</p>}
                        {filtered.map(r => {
                            const cfg = recordTypeLabels[r.record_type] || recordTypeLabels.comportamento;
                            const person = personnelList.find(p => p.id === r.personnel_id);
                            return (
                                <div key={r.id} className="p-4 rounded-xl border border-rustic-border hover:border-primary/30 transition-all flex items-start gap-4 group">
                                    <span className={`material-symbols-outlined ${cfg.color} p-2 rounded-lg`}>{cfg.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm">{person?.name || `ID ${r.personnel_id}`}</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${cfg.color} uppercase`}>{cfg.label}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 mb-1">{r.description}</p>
                                        {r.legal_reference && <p className="text-[10px] text-gray-400">Ref: {r.legal_reference}</p>}
                                        <p className="text-[10px] text-gray-400">{new Date(r.date).toLocaleDateString('pt-BR')} {r.responsible_authority ? `• ${r.responsible_authority}` : ''}</p>
                                    </div>
                                    {isEditor && (
                                        <button onClick={() => onDelete(r.id!)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisciplinarySection;
