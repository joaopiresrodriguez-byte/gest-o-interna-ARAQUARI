import React, { useState, useEffect } from 'react';
import { Vacation } from '../../services/types';
import { toast } from 'sonner';

interface Props {
    open: boolean;
    vacation: Vacation | null;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Vacation>) => Promise<void>;
}

export default function ModalEdicaoFerias({ open, vacation, onClose, onSave }: Props) {
    const [formData, setFormData] = useState<Partial<Vacation>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (vacation) {
            setFormData({ ...vacation });
        }
    }, [vacation]);

    if (!open || !vacation) return null;

    const calcDays = (startStr?: string, endStr?: string) => {
        if (!startStr || !endStr) return 30;
        const d1 = new Date(startStr + 'T00:00:00');
        const d2 = new Date(endStr + 'T00:00:00');
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 30;
        const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return diff > 0 ? diff : 1;
    };

    const handleStartDateChange = (val: string) => {
        const days = calcDays(val, formData.end_date);
        setFormData(p => ({ ...p, start_date: val, day_count: days }));
    };

    const handleEndDateChange = (val: string) => {
        const days = calcDays(formData.start_date, val);
        setFormData(p => ({ ...p, end_date: val, day_count: days }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vacation.id) return;
        if (!formData.start_date || !formData.end_date) {
            toast.error('Informe as datas de início e fim!');
            return;
        }

        setSaving(true);
        try {
            await onSave(vacation.id, {
                start_date: formData.start_date,
                end_date: formData.end_date,
                day_count: formData.day_count || calcDays(formData.start_date, formData.end_date),
                leave_type: formData.leave_type || 'férias',
                status: formData.status || 'planejado',
                notes: formData.notes || ''
            });
            toast.success('Planejamento de férias atualizado com sucesso!');
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao atualizar férias.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-rustic-border overflow-hidden">
                <div className="bg-stone-50 p-6 border-b border-stone-200 flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">edit_calendar</span>
                            Editar Planejamento de Férias
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">{vacation.full_name || 'Militar'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-stone-200/60 text-stone-600 hover:bg-stone-300 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                Data de Início
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.start_date || ''}
                                onChange={e => handleStartDateChange(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                Data de Término
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.end_date || ''}
                                onChange={e => handleEndDateChange(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                Quantidade de Dias
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={formData.day_count || 30}
                                onChange={e => setFormData(p => ({ ...p, day_count: parseInt(e.target.value) || 1 }))}
                                className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                Tipo de Afastamento
                            </label>
                            <select
                                value={formData.leave_type || 'férias'}
                                onChange={e => setFormData(p => ({ ...p, leave_type: e.target.value as any }))}
                                className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            >
                                <option value="férias">Férias</option>
                                <option value="licença">Licença</option>
                                <option value="afastamento">Afastamento</option>
                                <option value="dispensa">Dispensa</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                            Status do Planejamento
                        </label>
                        <select
                            value={formData.status || 'planejado'}
                            onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
                            className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="planejado">Planejado</option>
                            <option value="em_andamento">Em Andamento</option>
                            <option value="concluido">Concluído</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                            Observações / Detalhes
                        </label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                            className="w-full h-20 p-3 rounded-lg border border-rustic-border text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                            placeholder="Adicione observações relevantes..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-stone-100 text-stone-600 font-bold text-xs rounded-xl"
                        >
                            CANCELAR
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 bg-primary text-white font-black text-xs rounded-xl hover:brightness-110 disabled:opacity-50"
                        >
                            {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
