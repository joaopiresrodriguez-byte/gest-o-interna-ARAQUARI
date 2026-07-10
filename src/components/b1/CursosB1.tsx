import React, { useState, useEffect, useCallback } from 'react';
import { PersonnelService } from '../../services/personnelService';
import { GoogleSheetsService } from '../../services/googleSheetsService';
import { B1Course, Personnel } from '../../services/types';
import { toast } from 'sonner';
import { syncCursoDrive } from '../../services/driveSync';

const CATEGORIES = ['Operacional', 'Administrativo', 'Saúde', 'Liderança', 'Especialização Técnica', 'Outros'] as const;

interface Props {
    personnelList: Personnel[];
}

function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ date }: { date?: string }) {
    if (!date) return <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 font-medium">Sem validade</span>;
    const days = daysUntil(date);
    if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Expirado</span>;
    if (days <= 60) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{days}d restantes</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Válido</span>;
}

const emptyForm = (): Omit<B1Course, 'id'> => ({
    personnel_id: 0,
    course_name: '',
    sigla_curso: '',
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
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [filterPersonnel, setFilterPersonnel] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const data = await PersonnelService.getCourses();
        const personnelMap = new Map(personnelList.map(p => [p.id!, p]));
        const enriched = data.map(c => ({
            ...c,
            personnel_name: personnelMap.get(c.personnel_id)?.name || `ID ${c.personnel_id}`,
            personnel_rank: personnelMap.get(c.personnel_id)?.rank,
        }));
        setCourses(enriched);
        setLoading(false);
    }, [personnelList]);

    useEffect(() => { load(); }, [load]);

    // Close modal on Escape key
    useEffect(() => {
        if (!showModal) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [showModal]);

    const openModal = () => { setForm(emptyForm()); setShowModal(true); };
    const closeModal = () => { setShowModal(false); setForm(emptyForm()); };

    const filtered = courses.filter(c => {
        if (filterPersonnel && c.personnel_id !== Number(filterPersonnel)) return false;
        if (filterCategory && c.category !== filterCategory) return false;
        if (search && !c.course_name.toLowerCase().includes(search.toLowerCase()) && !c.institution.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.personnel_id || !form.course_name.trim() || !form.completion_date) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }
        setSaving(true);
        try {
            await PersonnelService.addCourse({ ...form, personnel_id: Number(form.personnel_id) });
            const person = personnelList.find(p => p.id === Number(form.personnel_id));
            GoogleSheetsService.syncCourse(form, person?.name || '', person?.rank || '').catch(() => { });
            syncCursoDrive({ name: person?.name || '', rank: person?.rank || person?.graduation }, form).catch(() => { });
            toast.success('Curso registrado com sucesso!');
            closeModal();
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
                    <h3 className="text-base font-semibold text-stone-800">Cursos e Qualificações</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{courses.length} registro{courses.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                    onClick={openModal}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#C62828] text-white rounded-xl text-sm font-semibold hover:bg-[#A32020] transition-all shadow-md active:scale-95"
                >
                    <span className="material-symbols-outlined text-base">add</span>
                    Novo Curso
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-stone-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar curso ou instituição..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:border-[#C62828]"
                    />
                </div>
                <select
                    value={filterPersonnel}
                    onChange={e => setFilterPersonnel(e.target.value)}
                    className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:border-[#C62828]"
                >
                    <option value="">Todos os militares</option>
                    {personnelList.map(p => <option key={p.id} value={p.id}>{p.rank} {p.name}</option>)}
                </select>
                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:border-[#C62828]"
                >
                    <option value="">Todas as categorias</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Course List */}
            {loading ? (
                <div className="flex items-center justify-center py-12 gap-3">
                    <div className="w-6 h-6 border-2 border-cbm-red border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-secondary-text">Carregando cursos...</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-stone-200 rounded-2xl">
                    <span className="material-symbols-outlined text-5xl block mb-3 text-stone-400">school</span>
                    <p className="text-sm text-stone-500 font-medium">Nenhum curso encontrado</p>
                    <p className="text-xs text-stone-400 mt-1">Use o botão "Novo Curso" para adicionar</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(c => (
                        <div
                            key={c.id}
                            className="bg-white border border-stone-200 rounded-xl p-3.5 flex items-start justify-between gap-3 hover:border-[#C62828]/30 hover:shadow-sm transition-all"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {c.sigla_curso && (
                                        <span className="text-[10px] font-black bg-red-50 text-[#C62828] border border-red-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            {c.sigla_curso}
                                        </span>
                                    )}
                                    <span className="text-sm font-semibold text-stone-800 truncate">{c.course_name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">{c.category}</span>
                                    <ExpiryBadge date={c.expiry_date} />
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-stone-600 font-medium">{c.personnel_rank} {c.personnel_name}</span>
                                    {c.institution && <span className="text-xs text-stone-400">· {c.institution}</span>}
                                    {c.workload_hours && (
                                        <span className="text-xs text-stone-400 flex items-center gap-0.5">
                                            · <span className="material-symbols-outlined text-[12px]">timer</span> {c.workload_hours}h
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-stone-400 mt-0.5">
                                    Conclusão: {new Date(c.completion_date).toLocaleDateString('pt-BR')}
                                    {c.expiry_date ? ` · Validade: ${new Date(c.expiry_date).toLocaleDateString('pt-BR')}` : ''}
                                </p>
                                {c.is_retroactive && (
                                    <p className="text-xs text-amber-600 mt-0.5">⊙ Retroativo{c.retroactive_notes ? ` — ${c.retroactive_notes}` : ''}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {c.certificate_url && (
                                    <a
                                        href={c.certificate_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1.5 text-stone-400 hover:text-[#C62828] transition-colors"
                                        title="Ver certificado"
                                    >
                                        <span className="material-symbols-outlined text-base">open_in_new</span>
                                    </a>
                                )}
                                <button
                                    onClick={() => handleDelete(c.id!, c.course_name)}
                                    className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                                    title="Remover curso"
                                >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── MODAL DE CADASTRO ─── */}
            {showModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={closeModal}
                    />

                    {/* Modal Panel */}
                    <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-7 py-5 border-b border-stone-100">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-cbm-red flex items-center justify-center text-white shadow-md shadow-red-200">
                                    <span className="material-symbols-outlined text-[20px]">school</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-stone-800">Registrar Curso</h3>
                                    <p className="text-xs text-stone-400 font-medium">Associar qualificação a um militar</p>
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                className="size-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

                            {/* Militar (dropdown) */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                                    Militar <span className="text-cbm-red">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-stone-300">badge</span>
                                    <select
                                        value={form.personnel_id || ''}
                                        onChange={e => setForm(f => ({ ...f, personnel_id: Number(e.target.value) }))}
                                        className="w-full pl-10 pr-4 h-11 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors appearance-none"
                                        required
                                    >
                                        <option value="">Selecione o militar...</option>
                                        {personnelList
                                            .slice()
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{p.rank} {p.name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            {/* Nome do Curso */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                                    Nome do Curso <span className="text-cbm-red">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.course_name}
                                    onChange={e => setForm(f => ({ ...f, course_name: e.target.value }))}
                                    placeholder="Ex: Curso de Resgate Veicular"
                                    className="w-full h-11 bg-stone-50 border-2 border-stone-200 rounded-xl px-4 text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors"
                                    required
                                />
                            </div>

                            {/* Sigla + Carga Horária (lado a lado) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Sigla</label>
                                    <input
                                        type="text"
                                        value={form.sigla_curso || ''}
                                        onChange={e => setForm(f => ({ ...f, sigla_curso: e.target.value.toUpperCase() }))}
                                        placeholder="Ex: CFO"
                                        maxLength={10}
                                        className="w-full h-11 bg-stone-50 border-2 border-stone-200 rounded-xl px-4 text-sm text-stone-700 font-bold uppercase tracking-widest focus:outline-none focus:border-cbm-red transition-colors"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Carga Horária (h)</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-stone-300">timer</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={form.workload_hours || ''}
                                            onChange={e => setForm(f => ({ ...f, workload_hours: Number(e.target.value) || undefined }))}
                                            placeholder="40"
                                            className="w-full pl-10 h-11 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Data de Realização + Validade (lado a lado) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                                        Data de Realização <span className="text-cbm-red">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={form.completion_date}
                                        onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))}
                                        className="w-full h-11 bg-stone-50 border-2 border-stone-200 rounded-xl px-4 text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Validade</label>
                                    <input
                                        type="date"
                                        value={form.expiry_date || ''}
                                        onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value || undefined }))}
                                        className="w-full h-11 bg-stone-50 border-2 border-stone-200 rounded-xl px-4 text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Categoria + Instituição */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Categoria</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value as B1Course['category'] }))}
                                        className="w-full h-11 bg-stone-50 border-2 border-stone-200 rounded-xl px-4 text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors"
                                    >
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Instituição</label>
                                    <input
                                        type="text"
                                        value={form.institution}
                                        onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                                        placeholder="Ex: CEBMBSC"
                                        className="w-full h-11 bg-stone-50 border-2 border-stone-200 rounded-xl px-4 text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors"
                                    />
                                </div>
                            </div>

                            {/* URL Certificado */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">URL do Certificado</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-stone-300">link</span>
                                    <input
                                        type="url"
                                        value={form.certificate_url || ''}
                                        onChange={e => setForm(f => ({ ...f, certificate_url: e.target.value }))}
                                        placeholder="https://..."
                                        className="w-full pl-10 h-11 bg-stone-50 border-2 border-stone-200 rounded-xl text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Registro Retroativo */}
                            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                <input
                                    type="checkbox"
                                    id="modal_is_retroactive"
                                    checked={!!form.is_retroactive}
                                    onChange={e => setForm(f => ({
                                        ...f,
                                        is_retroactive: e.target.checked,
                                        retroactive_notes: e.target.checked ? f.retroactive_notes : ''
                                    }))}
                                    className="mt-0.5 h-4 w-4 accent-amber-500 cursor-pointer"
                                />
                                <label htmlFor="modal_is_retroactive" className="text-sm font-medium text-amber-700 cursor-pointer leading-snug">
                                    Registro retroativo
                                    <span className="block text-xs font-normal text-amber-500 mt-0.5">Curso já possuído antes do sistema ser implantado</span>
                                </label>
                            </div>
                            {form.is_retroactive && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Observações do registro retroativo *</label>
                                    <textarea
                                        value={form.retroactive_notes || ''}
                                        onChange={e => setForm(f => ({ ...f, retroactive_notes: e.target.value }))}
                                        placeholder="Ex: Registro de curso realizado em 2018 no CEBM. Certificado digitalizado."
                                        rows={2}
                                        className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 font-medium focus:outline-none focus:border-cbm-red transition-colors resize-none"
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2 border-t border-stone-100">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 h-11 rounded-xl border-2 border-stone-200 text-stone-500 text-sm font-bold hover:bg-stone-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 h-11 rounded-xl bg-cbm-red text-white text-sm font-black flex items-center justify-center gap-2 hover:bg-opacity-90 transition-all shadow-md shadow-red-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">save</span>
                                            Salvar Curso
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
