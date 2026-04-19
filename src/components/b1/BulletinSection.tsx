import React from 'react';
import { Bulletin, BulletinNote, BulletinVersion } from '../../services/types';

interface Props {
    bulletins: Bulletin[];
    onAddBulletin: (b: Omit<Bulletin, 'id'>) => void;
    onUpdateBulletin: (id: string, updates: Partial<Bulletin>) => void;
    onGetNotes: (bulletinId: string) => Promise<BulletinNote[]>;
    onAddNote: (note: Omit<BulletinNote, 'id'>) => void;
    onGetVersions: (bulletinId: string) => Promise<BulletinVersion[]>;
    isEditor: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
    rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
    em_revisao: { label: 'Em Revisão', color: 'bg-amber-100 text-amber-700' },
    aguardando_assinatura: { label: 'Aguardando Assinatura', color: 'bg-blue-100 text-blue-700' },
    publicado: { label: 'Publicado', color: 'bg-green-100 text-green-700' },
};

const BulletinSection: React.FC<Props> = ({ bulletins, onAddBulletin, onUpdateBulletin, onGetNotes, onAddNote, onGetVersions, isEditor }) => {
    const [weekStart, setWeekStart] = React.useState('');
    const [weekEnd, setWeekEnd] = React.useState('');
    const [selectedBulletin, setSelectedBulletin] = React.useState<Bulletin | null>(null);
    const [notes, setNotes] = React.useState<BulletinNote[]>([]);
    const [versions, setVersions] = React.useState<BulletinVersion[]>([]);
    const [newNoteSection, setNewNoteSection] = React.useState('');
    const [newNoteContent, setNewNoteContent] = React.useState('');
    const [editContent, setEditContent] = React.useState('');
    const [searchTerm, setSearchTerm] = React.useState('');

    const handleCreate = () => {
        if (!weekStart || !weekEnd) return;
        onAddBulletin({ week_start: weekStart, week_end: weekEnd, status: 'rascunho', content: '' });
        setWeekStart('');
        setWeekEnd('');
    };

    const handleSelect = async (b: Bulletin) => {
        setSelectedBulletin(b);
        setEditContent(b.content || '');
        if (b.id) {
            const [n, v] = await Promise.all([onGetNotes(b.id), onGetVersions(b.id)]);
            setNotes(n);
            setVersions(v);
        }
    };

    const handleAddNote = () => {
        if (!selectedBulletin?.id || !newNoteSection || !newNoteContent) return;
        onAddNote({ bulletin_id: selectedBulletin.id, section: newNoteSection, content: newNoteContent, submitted_at: new Date().toISOString(), status: 'pendente' });
        setNewNoteSection('');
        setNewNoteContent('');
    };

    const filteredBulletins = bulletins.filter(b => {
        if (!searchTerm) return true;
        return b.number?.toString().includes(searchTerm) || b.week_start.includes(searchTerm) || b.status.includes(searchTerm);
    });

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Create + List */}
            <div className="space-y-6">
                {isEditor && (
                    <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                        <h3 className="font-black text-lg mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">post_add</span> Novo Boletim</h3>
                        <div className="space-y-3">
                            <label className="text-xs font-bold block">Semana Início: <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="w-full mt-1 h-10 px-2 border rounded-lg" /></label>
                            <label className="text-xs font-bold block">Semana Fim: <input type="date" value={weekEnd} onChange={e => setWeekEnd(e.target.value)} className="w-full mt-1 h-10 px-2 border rounded-lg" /></label>
                            <button onClick={handleCreate} className="w-full py-3 bg-primary text-white font-black rounded-xl hover:brightness-110">CRIAR BOLETIM</button>
                        </div>
                    </div>
                )}
                <div className="bg-white rounded-2xl border border-rustic-border shadow-sm p-4">
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-9 px-3 rounded-lg border text-xs mb-4" placeholder="Buscar boletim..." />
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {filteredBulletins.map(b => {
                            const st = statusLabels[b.status] || statusLabels.rascunho;
                            return (
                                <div key={b.id} onClick={() => handleSelect(b)} className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${selectedBulletin?.id === b.id ? 'border-primary bg-red-50/30' : 'border-rustic-border'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm">BI {b.number || '—'}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${st.color} uppercase`}>{st.label}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">{new Date(b.week_start).toLocaleDateString('pt-BR')} — {new Date(b.week_end).toLocaleDateString('pt-BR')}</p>
                                </div>
                            );
                        })}
                        {filteredBulletins.length === 0 && <p className="text-center py-8 text-gray-300 italic text-sm">Nenhum boletim encontrado.</p>}
                    </div>
                </div>
            </div>

            {/* Right: Detail/Edit */}
            <div className="xl:col-span-2">
                {selectedBulletin ? (
                    <div className="bg-white rounded-2xl border border-rustic-border shadow-sm p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-xl">BI {selectedBulletin.number || 'Novo'} — Semana {new Date(selectedBulletin.week_start).toLocaleDateString('pt-BR')}</h3>
                            <div className="flex gap-2">
                                {isEditor && selectedBulletin.status === 'rascunho' && (
                                    <button onClick={() => onUpdateBulletin(selectedBulletin.id!, { status: 'em_revisao', content: editContent })} className="px-4 py-2 bg-amber-500 text-white text-xs font-black rounded-lg">ENVIAR P/ REVISÃO</button>
                                )}
                                {isEditor && selectedBulletin.status === 'em_revisao' && (
                                    <button onClick={() => onUpdateBulletin(selectedBulletin.id!, { status: 'aguardando_assinatura', content: editContent })} className="px-4 py-2 bg-blue-500 text-white text-xs font-black rounded-lg">APROVAR</button>
                                )}
                                {isEditor && selectedBulletin.status === 'aguardando_assinatura' && (
                                    <button onClick={() => onUpdateBulletin(selectedBulletin.id!, { status: 'publicado', content: editContent })} className="px-4 py-2 bg-green-600 text-white text-xs font-black rounded-lg">PUBLICAR</button>
                                )}
                            </div>
                        </div>

                        {/* Content editor */}
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Conteúdo do Boletim</h4>
                            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full h-48 p-4 rounded-lg border border-rustic-border text-sm" placeholder="Conteúdo consolidado do boletim interno..." disabled={!isEditor || selectedBulletin.status === 'publicado'} />
                            {isEditor && selectedBulletin.status !== 'publicado' && (
                                <button onClick={() => onUpdateBulletin(selectedBulletin.id!, { content: editContent })} className="mt-2 px-4 py-2 bg-primary text-white text-xs font-black rounded-lg">SALVAR CONTEÚDO</button>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Notas Recebidas</h4>
                            {notes.map(n => (
                                <div key={n.id} className="p-3 rounded-lg border border-gray-100 mb-2">
                                    <div className="flex items-center gap-2 mb-1"><span className="font-bold text-xs">{n.section}</span><span className="text-[9px] text-gray-400">{n.submitted_at ? new Date(n.submitted_at).toLocaleDateString('pt-BR') : ''}</span></div>
                                    <p className="text-xs text-gray-600">{n.content}</p>
                                </div>
                            ))}
                            {isEditor && selectedBulletin.status !== 'publicado' && (
                                <div className="mt-3 p-3 bg-stone-50 rounded-lg space-y-2">
                                    <input value={newNoteSection} onChange={e => setNewNoteSection(e.target.value)} className="w-full h-9 px-3 rounded border text-xs" placeholder="Seção (ex: B3, B4, Operacional)" />
                                    <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} className="w-full h-20 p-2 rounded border text-xs" placeholder="Conteúdo da nota..." />
                                    <button onClick={handleAddNote} className="px-4 py-2 bg-primary text-white text-[10px] font-black rounded-lg">ADICIONAR NOTA</button>
                                </div>
                            )}
                        </div>

                        {/* Versions */}
                        {versions.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Histórico de Versões</h4>
                                {versions.map(v => (
                                    <div key={v.id} className="p-2 rounded border border-gray-100 mb-1 text-xs text-gray-500">
                                        {v.edited_at ? new Date(v.edited_at).toLocaleString('pt-BR') : ''} — {v.edited_by || 'Sistema'}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-rustic-border shadow-sm text-gray-300">
                        <div className="text-center">
                            <span className="material-symbols-outlined text-5xl mb-2 block">article</span>
                            <p className="font-bold">Selecione um boletim para visualizar</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulletinSection;
