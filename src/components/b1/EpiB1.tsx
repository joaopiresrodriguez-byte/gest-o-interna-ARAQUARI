import React, { useState, useEffect } from 'react';
import { PersonnelService } from '../../services/personnelService';
import { GoogleSheetsService } from '../../services/googleSheetsService';
import { EpiDelivery, Personnel } from '../../services/types';
import { toast } from 'sonner';

const ITEM_TYPES = ['Uniforme', 'EPI', 'Equipamento Individual', 'Outros'] as const;
const CONDITIONS = ['Novo', 'Bom', 'Regular'] as const;

interface Props {
    personnelList: Personnel[];
}

const conditionColor = { 'Novo': 'text-emerald-400 bg-emerald-500/10', 'Bom': 'text-amber-400 bg-amber-500/10', 'Regular': 'text-red-400 bg-red-500/10' } as const;

const emptyForm = (): Omit<EpiDelivery, 'id'> => ({
    personnel_id: 0,
    item_type: 'Uniforme',
    item_name: '',
    item_description: '',
    delivery_date: new Date().toISOString().split('T')[0],
    replacement_date: undefined,
    quantity: 1,
    condition: 'Novo',
    patrimonio_number: '',
});

export default function EpiB1({ personnelList }: Props) {
    const [deliveries, setDeliveries] = useState<EpiDelivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [filterPersonnel, setFilterPersonnel] = useState('');
    const [filterType, setFilterType] = useState('');
    const [patrimonioInfo, setPatrimonioInfo] = useState<string | null>(null);

    const personnelMap = new Map(personnelList.map(p => [p.id!, p]));

    const load = async () => {
        setLoading(true);
        const data = await PersonnelService.getEpiDeliveries();
        const enriched = data.map(d => ({
            ...d,
            personnel_name: personnelMap.get(d.personnel_id)?.name || `ID ${d.personnel_id}`,
            personnel_rank: personnelMap.get(d.personnel_id)?.rank,
        }));
        setDeliveries(enriched);
        setLoading(false);
    };

    useEffect(() => { load(); }, [personnelList]);

    const handlePatrimonioLookup = async () => {
        if (!form.patrimonio_number?.trim()) return;
        const result = await PersonnelService.getFleetByPatrimonio(form.patrimonio_number.trim());
        if (result) {
            setPatrimonioInfo(`${result.name}${result.details ? ` – ${result.details}` : ''}`);
            if (!form.item_name) setForm(f => ({ ...f, item_name: result.name }));
        } else {
            setPatrimonioInfo('Patrimônio não encontrado no B4');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.personnel_id || !form.item_name.trim()) {
            toast.error('Selecione o militar e informe o item');
            return;
        }
        setSaving(true);
        try {
            await PersonnelService.addEpiDelivery({ ...form, personnel_id: Number(form.personnel_id) });
            const person = personnelList.find(p => p.id === Number(form.personnel_id));
            GoogleSheetsService.syncEpi(form, person?.name || '', person?.rank || '').catch(() => { });
            toast.success('Item registrado com sucesso');
            setShowForm(false);
            setForm(emptyForm());
            setPatrimonioInfo(null);
            await load();
        } catch {
            toast.error('Erro ao salvar entrega');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Remover entrega de "${name}"?`)) return;
        try {
            await PersonnelService.deleteEpiDelivery(id);
            toast.success('Registro removido');
            await load();
        } catch {
            toast.error('Erro ao remover');
        }
    };

    const filtered = deliveries.filter(d => {
        if (filterPersonnel && d.personnel_id !== Number(filterPersonnel)) return false;
        if (filterType && d.item_type !== filterType) return false;
        return true;
    });

    const overdueCount = deliveries.filter(d => d.replacement_date && new Date(d.replacement_date) <= new Date()).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-primary-text">Controle de Uniformes e EPIs</h3>
                    <p className="text-xs text-secondary-text mt-0.5">{deliveries.length} item(ns) registrado(s){overdueCount > 0 && <span className="ml-2 text-amber-400">· {overdueCount} com reposição vencida</span>}</p>
                </div>
                <button
                    onClick={() => { setShowForm(v => !v); setForm(emptyForm()); setPatrimonioInfo(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cbm-red text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-opacity"
                >
                    <span className="material-symbols-outlined text-base">{showForm ? 'close' : 'add'}</span>
                    {showForm ? 'Cancelar' : 'Registrar Entrega'}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-primary border border-rustic-border rounded-2xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-primary-text">Nova Entrega de EPI / Uniforme</h4>
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
                            <label className="text-xs text-secondary-text">Tipo de Item *</label>
                            <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value as EpiDelivery['item_type'] }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs text-secondary-text">Nº de Patrimônio (B4)</label>
                            <div className="flex gap-2">
                                <input type="text" value={form.patrimonio_number || ''} onChange={e => { setForm(f => ({ ...f, patrimonio_number: e.target.value })); setPatrimonioInfo(null); }}
                                    placeholder="Ex: 00123" className="flex-1 bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                                <button type="button" onClick={handlePatrimonioLookup}
                                    className="px-3 py-2 bg-secondary border border-rustic-border rounded-lg text-sm text-secondary-text hover:text-primary-text transition-colors hover:border-cbm-red/50">
                                    <span className="material-symbols-outlined text-base">search</span>
                                </button>
                            </div>
                            {patrimonioInfo && <p className="text-xs mt-1 text-amber-400">{patrimonioInfo}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Nome do Item *</label>
                            <input type="text" value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
                                placeholder="Ex: Capacete de Resgate" className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Condição</label>
                            <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value as EpiDelivery['condition'] }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Quantidade</label>
                            <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Data de Entrega</label>
                            <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-secondary-text">Previsão de Reposição</label>
                            <input type="date" value={form.replacement_date || ''} onChange={e => setForm(f => ({ ...f, replacement_date: e.target.value || undefined }))}
                                className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs text-secondary-text">Descrição / Observação</label>
                            <input type="text" value={form.item_description || ''} onChange={e => setForm(f => ({ ...f, item_description: e.target.value }))}
                                placeholder="Informações adicionais..." className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text focus:outline-none focus:border-cbm-red" />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-cbm-red text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-opacity disabled:opacity-50">
                            {saving ? 'Salvando...' : 'Salvar Entrega'}
                        </button>
                    </div>
                </form>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <select value={filterPersonnel} onChange={e => setFilterPersonnel(e.target.value)}
                    className="bg-primary border border-rustic-border rounded-lg px-3 py-1.5 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                    <option value="">Todos os militares</option>
                    {personnelList.map(p => <option key={p.id} value={p.id}>{p.rank} {p.name}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="bg-primary border border-rustic-border rounded-lg px-3 py-1.5 text-sm text-primary-text focus:outline-none focus:border-cbm-red">
                    <option value="">Todos os tipos</option>
                    {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-8 text-secondary-text text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-secondary-text">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">checkroom</span>
                    <p className="text-sm">Nenhum item registrado</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(d => {
                        const isOverdue = d.replacement_date && new Date(d.replacement_date) <= new Date();
                        return (
                            <div key={d.id} className={`bg-primary border rounded-xl p-3 flex items-start justify-between gap-3 transition-colors ${isOverdue ? 'border-amber-500/40' : 'border-rustic-border hover:border-cbm-red/30'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="material-symbols-outlined text-base text-secondary-text">{d.item_type === 'EPI' ? 'health_and_safety' : 'checkroom'}</span>
                                        <span className="text-sm font-semibold text-primary-text">{d.item_name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionColor[d.condition]}`}>{d.condition}</span>
                                        {isOverdue && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Reposição vencida</span>}
                                    </div>
                                    <p className="text-xs text-secondary-text mt-0.5">{d.personnel_rank} {d.personnel_name} · {d.item_type} · Qtd: {d.quantity}</p>
                                    <p className="text-xs text-secondary-text">Entregue: {new Date(d.delivery_date).toLocaleDateString('pt-BR')}{d.replacement_date ? ` · Repor em: ${new Date(d.replacement_date).toLocaleDateString('pt-BR')}` : ''}{d.patrimonio_number ? ` · Pat. ${d.patrimonio_number}` : ''}</p>
                                    {d.item_description && <p className="text-xs text-secondary-text/70 mt-0.5 italic">{d.item_description}</p>}
                                </div>
                                <button onClick={() => handleDelete(d.id!, d.item_name)}
                                    className="p-1.5 text-secondary-text hover:text-red-400 transition-colors shrink-0">
                                    <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
