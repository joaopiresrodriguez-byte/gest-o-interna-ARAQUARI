import React from 'react';
import { Personnel, RankHistory, ServiceSwap, DisciplinaryRecord, Vacation, DocumentB1 } from '../../services/types';

interface Props {
    person: Personnel;
    rankHistory: RankHistory[];
    swaps: ServiceSwap[];
    disciplinary: DisciplinaryRecord[];
    vacations: Vacation[];
    documents: DocumentB1[];
    onClose: () => void;
}

const recordTypeLabels: Record<string, { label: string; color: string }> = {
    elogio: { label: 'Elogio', color: 'bg-green-100 text-green-700' },
    condecoracao: { label: 'Condecoração', color: 'bg-blue-100 text-blue-700' },
    punicao: { label: 'Punição', color: 'bg-red-100 text-red-700' },
    comportamento: { label: 'Comportamento', color: 'bg-amber-100 text-amber-700' },
};

const PersonnelProfile: React.FC<Props> = ({ person, rankHistory, swaps, disciplinary, vacations, documents, onClose }) => {
    const statusColors: Record<string, string> = { Ativo: 'bg-green-100 text-green-700', Férias: 'bg-blue-100 text-blue-700', Licença: 'bg-amber-100 text-amber-700', Afastado: 'bg-orange-100 text-orange-700', Cedido: 'bg-purple-100 text-purple-700' };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span> Voltar
                </button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-primary text-white text-xs font-black rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">print</span> IMPRIMIR
                </button>
            </div>

            {/* Header Card */}
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm flex flex-col md:flex-row items-start gap-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    {person.image ? <img src={person.image} className="w-20 h-20 rounded-2xl object-cover" /> : <span className="material-symbols-outlined text-3xl text-primary">person</span>}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-black">{person.graduation ? `${person.graduation} ` : ''}{person.name}</h2>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusColors[person.status] || 'bg-gray-100 text-gray-600'} uppercase`}>{person.status}</span>
                    </div>
                    {person.war_name && <p className="text-xs text-gray-400 mb-2">Nome de Guerra: {person.war_name}</p>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-gray-400 block">Tipo</span><span className="font-bold">{person.type}</span></div>
                        <div><span className="text-gray-400 block">Função</span><span className="font-bold">{person.role}</span></div>
                        <div><span className="text-gray-400 block">CPF</span><span className="font-bold">{person.cpf || '—'}</span></div>
                        <div><span className="text-gray-400 block">Nascimento</span><span className="font-bold">{person.birth_date ? new Date(person.birth_date).toLocaleDateString('pt-BR') : '—'}</span></div>
                        <div><span className="text-gray-400 block">Email</span><span className="font-bold">{person.email || '—'}</span></div>
                        <div><span className="text-gray-400 block">Telefone</span><span className="font-bold">{person.phone || '—'}</span></div>
                        <div><span className="text-gray-400 block">Tipo Sanguíneo</span><span className="font-bold">{person.blood_type || '—'}</span></div>
                        <div><span className="text-gray-400 block">Contato Emergência</span><span className="font-bold">{person.emergency_contact_name || '—'} {person.emergency_phone ? `(${person.emergency_phone})` : ''}</span></div>
                    </div>
                </div>
            </div>

            {/* Documents Card */}
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                <h3 className="font-black text-sm uppercase mb-4 text-gray-700">Documentos & Habilitações</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="p-3 bg-stone-50 rounded-xl"><span className="text-gray-400 block mb-1">CVE Ativo</span><span className="font-black">{person.cve_active || '—'}</span></div>
                    <div className="p-3 bg-stone-50 rounded-xl"><span className="text-gray-400 block mb-1">CVE Emissão</span><span className="font-black">{person.cve_issue_date ? new Date(person.cve_issue_date).toLocaleDateString('pt-BR') : '—'}</span></div>
                    <div className={`p-3 rounded-xl ${person.cve_expiry_date && new Date(person.cve_expiry_date) <= new Date() ? 'bg-red-50' : 'bg-stone-50'}`}><span className="text-gray-400 block mb-1">CVE Validade</span><span className="font-black">{person.cve_expiry_date ? new Date(person.cve_expiry_date).toLocaleDateString('pt-BR') : '—'}</span></div>
                    <div className="p-3 bg-stone-50 rounded-xl"><span className="text-gray-400 block mb-1">CNH</span><span className="font-black">{person.cnh_category || '—'} {person.cnh_number ? `(${person.cnh_number})` : ''}</span></div>
                    <div className={`p-3 rounded-xl ${person.cnh_expiry_date && new Date(person.cnh_expiry_date) <= new Date() ? 'bg-red-50' : 'bg-stone-50'}`}><span className="text-gray-400 block mb-1">CNH Validade</span><span className="font-black">{person.cnh_expiry_date ? new Date(person.cnh_expiry_date).toLocaleDateString('pt-BR') : '—'}</span></div>
                    <div className={`p-3 rounded-xl ${person.toxicological_expiry_date && new Date(person.toxicological_expiry_date) <= new Date() ? 'bg-red-50' : 'bg-stone-50'}`}><span className="text-gray-400 block mb-1">Toxicológico Validade</span><span className="font-black">{person.toxicological_expiry_date ? new Date(person.toxicological_expiry_date).toLocaleDateString('pt-BR') : '—'}</span></div>
                    <div className="p-3 bg-stone-50 rounded-xl"><span className="text-gray-400 block mb-1">Arma</span><span className="font-black">{person.weapon_permit ? 'Sim' : 'Não'}</span></div>
                    <div className="p-3 bg-stone-50 rounded-xl"><span className="text-gray-400 block mb-1">Instrução</span><span className="font-black">{person.education_level || '—'}</span></div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Rank History */}
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                    <h3 className="font-black text-sm uppercase mb-4 text-gray-700">Histórico de Graduação</h3>
                    {rankHistory.length === 0 ? <p className="text-xs text-gray-300 italic">Nenhum registro.</p> : (
                        <div className="space-y-2">
                            {rankHistory.map(r => (
                                <div key={r.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg text-xs">
                                    <span className="material-symbols-outlined text-primary text-[16px]">military_tech</span>
                                    <div className="flex-1">
                                        <span className="font-bold">{r.previous_rank} → {r.new_rank}</span>
                                        <span className="text-gray-400 block text-[10px]">{new Date(r.change_date).toLocaleDateString('pt-BR')} • {r.legal_basis}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Swap History */}
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                    <h3 className="font-black text-sm uppercase mb-4 text-gray-700">Histórico de Trocas de Serviço</h3>
                    {swaps.length === 0 ? <p className="text-xs text-gray-300 italic">Nenhuma troca registrada.</p> : (
                        <div className="space-y-2">
                            {swaps.map(s => (
                                <div key={s.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg text-xs">
                                    <span className="material-symbols-outlined text-amber-500 text-[16px]">swap_horiz</span>
                                    <div className="flex-1">
                                        <span className="font-bold">{new Date(s.original_date).toLocaleDateString('pt-BR')} → {new Date(s.new_date).toLocaleDateString('pt-BR')}</span>
                                        <span className="text-gray-400 block text-[10px]">{s.reason}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Disciplinary */}
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                    <h3 className="font-black text-sm uppercase mb-4 text-gray-700">Registros Disciplinares</h3>
                    {disciplinary.length === 0 ? <p className="text-xs text-gray-300 italic">Nenhum registro.</p> : (
                        <div className="space-y-2">
                            {disciplinary.map(d => {
                                const cfg = recordTypeLabels[d.record_type] || recordTypeLabels.comportamento;
                                return (
                                    <div key={d.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg text-xs">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-700">{d.description}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(d.date).toLocaleDateString('pt-BR')} {d.legal_reference ? `• ${d.legal_reference}` : ''}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Vacations */}
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                    <h3 className="font-black text-sm uppercase mb-4 text-gray-700">Férias & Licenças</h3>
                    {vacations.length === 0 ? <p className="text-xs text-gray-300 italic">Nenhum período registrado.</p> : (
                        <div className="space-y-2">
                            {vacations.map(v => (
                                <div key={v.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg text-xs">
                                    <span className="material-symbols-outlined text-blue-500 text-[16px]">event</span>
                                    <div className="flex-1">
                                        <span className="font-bold">{new Date(v.start_date).toLocaleDateString('pt-BR')} — {new Date(v.end_date).toLocaleDateString('pt-BR')} ({v.day_count}d)</span>
                                        <span className="text-gray-400 block text-[10px]">{v.leave_type || 'férias'} • {v.status || '—'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Documents */}
            {documents.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                    <h3 className="font-black text-sm uppercase mb-4 text-gray-700">Documentos Anexados</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {documents.map(d => (
                            <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="p-3 bg-stone-50 rounded-xl border border-rustic-border hover:border-primary/30 transition-all text-xs">
                                <span className="material-symbols-outlined text-primary block mb-1">description</span>
                                <span className="font-bold block truncate">{d.file_name}</span>
                                <span className="text-[10px] text-gray-400">{d.document_type}</span>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelProfile;
