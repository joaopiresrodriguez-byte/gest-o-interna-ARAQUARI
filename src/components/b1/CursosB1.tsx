import React, { useState, useEffect } from 'react';
import { PersonnelService } from '../../services/personnelService';
import { GoogleSheetsService } from '../../services/googleSheetsService';
import { B1Course, Personnel } from '../../services/types';
import { toast } from 'sonner';

const CATEGORIES = ['Operacional', 'Administrativo', 'Saúde', 'Liderança', 'Especialização Técnica', 'Outros'] as const;

interface Props {
    personnelList: Personnel[];
}

function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ date }: { date?: string }) {
    if (!date) return null;
    const days = daysUntil(date);
    if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">Expirado</span>;
    if (days <= 60) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">{days}d restantes</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Válido</span>;
}

const emptyForm = (): Omit<B1Course, 'id'> => ({
    personnel_id: 0,
    course_name: '',
    institution: '',
    workload_hours: undefined,
    completion_date: new Date().toISOString().split('T')[0],
    expiry_date: undefined,
    category: 'Operacional',
    certificate_url: '',
    is_retroactive: false,
    retroactive_notes: '',
});

export default function CursosB1({ personnelList }: Props) {
    const [courses, setCourses] = useState<B1Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [filterPersonnel, setFilterPersonnel] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        const data = await PersonnelService.getCourses();
        // Enrich with personnel name
        const personnelMap = new Map(personnelList.map(p => [p.id!, p]));
        const enriched = data.map(c => ({
            ...c,
            personnel_name: personnelMap.get(c.personnel_id)?.name || `ID ${c.personnel_id}`,
            personnel_rank: personnelMap.get(c.personnel_id)?.rank,
        }));
        setCourses(enriched);
        setLoading(false);
    };

    useEffect(() => { load(); }, [personnelList]);

    const filtered = courses.filter(c => {
        if (filterPersonnel && c.personnel_id !== Number(filterPersonnel)) return false;
        if (filterCategory && c.category !== filterCategory) return false;
        if (search && !c.course_name.toLowerCase().includes(search.toLowerCase()) && !c.institution.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.personnel_id || !form.course_name.trim() || !form.institution.trim()) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }
        setSaving(true);
        try {
            await PersonnelService.addCourse({ ...form, personnel_id: Number(form.personnel_id) });
            const person = personnelList.find(p => p.id === Number(form.personnel_id));
            GoogleSheetsService.syncCourse(form, person?.name || '', person?.rank || '').catch(() => { });
            toast.success('Curso registrado com sucesso');
            setShowForm(false);
            setForm(emptyForm());
            await load();
        } catch {
            toast.error('Erro ao salvar curso');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Remover "${name}"?`)) return;
        try {
            await PersonnelService.deleteCourse(id);
            toast.success('Curso removido');
            await load();
        } catch {
            toast.error('Erro ao remover curso');
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-primary-text">Cursos e Qualificações</h3>
                    <p className="text-xs text-secondary-text mt-0.5">{courses.length} registro{courses.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                    onClick={() => { setShowForm(v => !v); setForm(emptyForm()); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cbm-red text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-opacity"
                >
                    <span className="material-symbols-outlined text-base">{showForm ? 'close' : 'add'}</span>
                    {showForm ? 'Cancelar' : 'Novo Curso'}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-primary border border-rustic-border rounded-2xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-primary-text">Registrar Curso / Qualificação</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Militar *</label>
                            <select value={form.personnel_id || ''} onChange={e => setForm(f => ({ ...f, personnel_id: Number(e.target.value) }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                                <option value="">Selecione...</option>
                                {personnelList.map(p => <option key={p.id} value={p.id}>{p.rank} {p.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Categoria *</label>
                            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as B1Course['category'] }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Nome do Curso *</label>
                            <input type="text" value={form.course_name} onChange={e => setForm(f => ({ ...f, course_name: e.target.value }))}
                                placeholder="Ex: Curso de Resgate Veicular" className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Instituição *</label>
                            <input type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                                placeholder="Ex: CEBMBSC" className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Carga Horária (h)</label>
                            <input type="number" value={form.workload_hours || ''} onChange={e => setForm(f => ({ ...f, workload_hours: Number(e.target.value) }))}
                                placeholder="40" className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Data de Conclusão *</label>
                            <input type="date" value={form.completion_date} onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Validade</label>
                            <input type="date" value={form.expiry_date || ''} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value || undefined }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">URL do Certificado</label>
                            <input type="url" value={form.certificate_url || ''} onChange={e => setForm(f => ({ ...f, certificate_url: e.target.value }))}
                                placeholder="https://..." className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                    </div>

                    {/* Retroactive toggle */}
                    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <input type="checkbox" id="is_retroactive" checked={!!form.is_retroactive}
                            onChange={e => setForm(f => ({ ...f, is_retroactive: e.target.checked, retroactive_notes: e.target.checked ? f.retroactive_notes : '' }))}
                            className="h-4 w-4 accent-amber-500" />
                        <label htmlFor="is_retroactive" className="text-sm font-medium text-amber-700 cursor-pointer">
                            Registro retroativo (curso já possuído antes do sistema)
                        </label>
                    </div>
                    {form.is_retroactive && (
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Observações do registro retroativo *</label>
                            <textarea value={form.retroactive_notes || ''} onChange={e => setForm(f => ({ ...f, retroactive_notes: e.target.value }))}
                                placeholder="Ex: Registro de curso realizado em 2018 no CEBM. Certificado digitalizado." rows={2}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-cbm-red text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-opacity disabled:opacity-50">
                            {saving ? 'Salvando...' : 'Salvar Curso'}
                        </button>
                    </div>
                </form>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <input type="text" placeholder="Buscar curso ou instituição..." value={search} onChange={e => setSearch(e.target.value)}
                    className="flex-1 min-w-40 bg-primary border border-rustic-border rounded-lg px-3 py-1.5 text-sm text-primary-text placeholder-secondary-text focus:outline-none focus:border-cbm-red" />
                <select value={filterPersonnel} onChange={e => setFilterPersonnel(e.target.value)}
                    className="bg-primary border border-rustic-border rounded-lg px-3 py-1.5 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                    <option value="">Todos os militares</option>
                    {personnelList.map(p => <option key={p.id} value={p.id}>{p.rank} {p.name}</option>)}
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                    className="bg-primary border border-rustic-border rounded-lg px-3 py-1.5 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                    <option value="">Todas as categorias</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-8 text-secondary-text text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-secondary-text">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">school</span>
                    <p className="text-sm">Nenhum curso encontrado</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(c => (
                        <div key={c.id} className="bg-primary border border-rustic-border rounded-xl p-3 flex items-start justify-between gap-3 hover:border-cbm-red/30 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-primary-text truncate">{c.course_name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-cbm-red/10 text-cbm-red font-medium">{c.category}</span>
                                    <ExpiryBadge date={c.expiry_date} />
                                </div>
                                <p className="text-xs text-secondary-text mt-0.5">{c.personnel_rank} {c.personnel_name} · {c.institution}{c.workload_hours ? ` · ${c.workload_hours}h` : ''}</p>
                                <p className="text-xs text-secondary-text">Conclusão: {new Date(c.completion_date).toLocaleDateString('pt-BR')}{c.expiry_date ? ` · Validade: ${new Date(c.expiry_date).toLocaleDateString('pt-BR')}` : ''}</p>
                                {c.is_retroactive && <p className="text-xs text-amber-600 mt-0.5">&#x26EF; Retroativo{c.retroactive_notes ? ` — ${c.retroactive_notes}` : ''}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {c.certificate_url && (
                                    <a href={c.certificate_url} target="_blank" rel="noreferrer"
                                        className="p-1.5 text-secondary-text hover:text-cbm-red transition-colors" title="Ver certificado">
                                        <span className="material-symbols-outlined text-base">open_in_new</span>
                                    </a>
                                )}
                                <button onClick={() => handleDelete(c.id!, c.course_name)}
                                    className="p-1.5 text-secondary-text hover:text-red-400 transition-colors">
                                    <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
