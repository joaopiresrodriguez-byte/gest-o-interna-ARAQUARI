import React, { useState, useEffect } from 'react';
import { Personnel } from '../../services/types';
import { toast } from 'sonner';

interface Props {
    open: boolean;
    initialData?: Partial<Personnel> | null;
    onClose: () => void;
    onSave: (data: Omit<Personnel, 'id'> | Personnel) => Promise<void>;
}

const RANKS_BM = [
    'Cel BM', 'Ten Cel BM', 'Maj BM', 'Cap BM',
    '1º Ten BM', '2º Ten BM', 'Asp Of BM',
    'Sub Ten BM', '1º Sgt BM', '2º Sgt BM', '3º Sgt BM',
    'Cb BM', 'Sd BM'
];

const STATUS_OPTIONS: Array<Personnel['status']> = ['Ativo', 'Férias', 'Licença', 'Afastado', 'Cedido'];

export default function ModalCadastroMilitar({ open, initialData, onClose, onSave }: Props) {
    const [formData, setFormData] = useState<Partial<Personnel>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                name: '',
                war_name: '',
                graduation: 'Sd BM',
                rank: 'Sd BM',
                type: 'BM',
                status: 'Ativo',
                role: 'Bombeiro Militar',
                matricula: '',
                cpf: '',
                birth_date: '',
                cidade_residencia: 'Araquari',
                data_inclusao: '',
                data_ultima_promocao: '',
                email: '',
                phone: '',
                education_level: 'Ensino Médio',
                blood_type: 'O+',
                address: '',
                emergency_contact_name: '',
                emergency_phone: '',
                cve_active: 'Não',
                cve_issue_date: '',
                cve_expiry_date: '',
                cnh_category: 'B',
                cnh_number: '',
                cnh_expiry_date: '',
                toxicological_expiry_date: '',
                weapon_permit: false
            });
        }
    }, [initialData, open]);

    if (!open) return null;

    const formatCpf = (val: string) => {
        const numbers = val.replace(/\D/g, '').slice(0, 11);
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
        if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
        return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
    };

    const calcExpiry = (dateStr: string, years = 5) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return '';
        d.setFullYear(d.getFullYear() + years);
        return d.toISOString().split('T')[0];
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim()) {
            toast.error('O Nome Completo é obrigatório!');
            return;
        }
        if (!formData.matricula?.trim()) {
            toast.error('A Matrícula é obrigatória!');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                graduation: formData.graduation || formData.rank || 'Sd BM',
                rank: formData.graduation || formData.rank || 'Sd BM',
                cve_expiry_date: formData.cve_issue_date ? calcExpiry(formData.cve_issue_date, 5) : formData.cve_expiry_date
            };
            await onSave(payload as Personnel);
            toast.success(initialData?.id ? 'Cadastro atualizado com sucesso!' : 'Militar cadastrado com sucesso!');
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao salvar cadastro do militar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-rustic-border">
                {/* Header Modal */}
                <div className="bg-stone-50 p-6 border-b border-stone-200 sticky top-0 z-10 flex items-center justify-between">
                    <div>
                        <h2 className="font-black text-xl text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-2xl">
                                {initialData?.id ? 'edit_note' : 'person_add'}
                            </span>
                            {initialData?.id ? `Editar Militar: ${initialData.name}` : 'Novo Cadastro de Militar'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">Preencha as informações do militar abaixo</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-stone-200/60 text-stone-600 hover:bg-stone-300 flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Informações Gerais */}
                    <div>
                        <h3 className="font-black text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base">badge</span>
                            Informações Pessoais & Funcionais
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                    Nome Completo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name || ''}
                                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Nome completo..."
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                    Nome de Guerra
                                </label>
                                <input
                                    type="text"
                                    value={formData.war_name || ''}
                                    onChange={e => setFormData(p => ({ ...p, war_name: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Ex: Pires"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                    Posto / Graduação
                                </label>
                                <select
                                    value={formData.graduation || formData.rank || 'Sd BM'}
                                    onChange={e => setFormData(p => ({ ...p, graduation: e.target.value, rank: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    {RANKS_BM.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                                    Matrícula <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.matricula || ''}
                                    onChange={e => setFormData(p => ({ ...p, matricula: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Ex: 930142-9"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">CPF</label>
                                <input
                                    type="text"
                                    value={formData.cpf || ''}
                                    onChange={e => setFormData(p => ({ ...p, cpf: formatCpf(e.target.value) }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="000.000.000-00"
                                    maxLength={14}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Status</label>
                                <select
                                    value={formData.status || 'Ativo'}
                                    onChange={e => setFormData(p => ({ ...p, status: e.target.value as Personnel['status'] }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Tipo</label>
                                <select
                                    value={formData.type || 'BM'}
                                    onChange={e => setFormData(p => ({ ...p, type: e.target.value as 'BM' | 'BC' }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    <option value="BM">BM (Bombeiro Militar)</option>
                                    <option value="BC">BC (Bombeiro Comunitário)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Função</label>
                                <input
                                    type="text"
                                    value={formData.role || ''}
                                    onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Ex: Socorrista / Motorista"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Data de Inclusão</label>
                                <input
                                    type="date"
                                    value={formData.data_inclusao || ''}
                                    onChange={e => setFormData(p => ({ ...p, data_inclusao: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Data da Última Promoção</label>
                                <input
                                    type="date"
                                    value={formData.data_ultima_promocao || ''}
                                    onChange={e => setFormData(p => ({ ...p, data_ultima_promocao: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Data Nascimento</label>
                                <input
                                    type="date"
                                    value={formData.birth_date || ''}
                                    onChange={e => setFormData(p => ({ ...p, birth_date: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Cidade de Residência</label>
                                <input
                                    type="text"
                                    value={formData.cidade_residencia || ''}
                                    onChange={e => setFormData(p => ({ ...p, cidade_residencia: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Ex: Araquari"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contatos & Endereço */}
                    <div>
                        <h3 className="font-black text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5 border-t border-stone-100 pt-4">
                            <span className="material-symbols-outlined text-base">contact_phone</span>
                            Contato & Emergência
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">E-mail</label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="militar@cbm.sc.gov.br"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Telefone</label>
                                <input
                                    type="tel"
                                    value={formData.phone || ''}
                                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="(47) 99999-9999"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Tipo Sanguíneo</label>
                                <select
                                    value={formData.blood_type || 'O+'}
                                    onChange={e => setFormData(p => ({ ...p, blood_type: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                                        <option key={bt} value={bt}>{bt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Contato de Emergência</label>
                                <input
                                    type="text"
                                    value={formData.emergency_contact_name || ''}
                                    onChange={e => setFormData(p => ({ ...p, emergency_contact_name: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Nome do parente/contato"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Tel. Emergência</label>
                                <input
                                    type="tel"
                                    value={formData.emergency_phone || ''}
                                    onChange={e => setFormData(p => ({ ...p, emergency_phone: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="(47) 99999-9999"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Endereço Residencial</label>
                                <input
                                    type="text"
                                    value={formData.address || ''}
                                    onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Rua, Número, Bairro..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Documentos & Habilitações */}
                    <div>
                        <h3 className="font-black text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5 border-t border-stone-100 pt-4">
                            <span className="material-symbols-outlined text-base">directions_car</span>
                            Documentação, CNH & CVE
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">CVE Ativo</label>
                                <select
                                    value={formData.cve_active || 'Não'}
                                    onChange={e => setFormData(p => ({ ...p, cve_active: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    <option value="Sim">Sim</option>
                                    <option value="Não">Não</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Data Emissão CVE</label>
                                <input
                                    type="date"
                                    value={formData.cve_issue_date || ''}
                                    onChange={e => setFormData(p => ({ ...p, cve_issue_date: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Validade CNH</label>
                                <input
                                    type="date"
                                    value={formData.cnh_expiry_date || ''}
                                    onChange={e => setFormData(p => ({ ...p, cnh_expiry_date: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Categoria CNH</label>
                                <select
                                    value={formData.cnh_category || 'B'}
                                    onChange={e => setFormData(p => ({ ...p, cnh_category: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    {['A', 'B', 'AB', 'C', 'D', 'E', 'AD', 'AE'].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Nº CNH</label>
                                <input
                                    type="text"
                                    value={formData.cnh_number || ''}
                                    onChange={e => setFormData(p => ({ ...p, cnh_number: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Vencimento Toxicológico</label>
                                <input
                                    type="date"
                                    value={formData.toxicological_expiry_date || ''}
                                    onChange={e => setFormData(p => ({ ...p, toxicological_expiry_date: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-stone-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs rounded-xl transition-colors"
                        >
                            CANCELAR
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-primary text-white font-black text-xs rounded-xl hover:brightness-110 shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-base">save</span>
                            {saving ? 'SALVANDO...' : initialData?.id ? 'ATUALIZAR' : 'CADASTRAR MILITAR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
