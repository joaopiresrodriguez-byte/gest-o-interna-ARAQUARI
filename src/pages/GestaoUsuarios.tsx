import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile } from '../context/AuthContext';
import { toast } from 'sonner';

// Extended profile with status fields for the admin panel
interface ProfileWithStatus extends UserProfile {
    status: string;
    full_name?: string | null;
    avatar_url?: string | null;
    created_at?: string;
    provider?: string;
}

type ApprovalRole = {
    is_manager: boolean;
    p_avisos: 'reader' | 'editor' | null;
    p_operacional: 'reader' | 'editor' | null;
    p_ssci: 'reader' | 'editor' | null;
    p_pessoal: 'reader' | 'editor' | null;
    p_instrucao: 'reader' | 'editor' | null;
    p_logistica: 'reader' | 'editor' | null;
    p_social: 'reader' | 'editor' | null;
};

const DEFAULT_ROLE: ApprovalRole = {
    is_manager: false,
    p_avisos: null,
    p_operacional: null,
    p_ssci: null,
    p_pessoal: null,
    p_instrucao: null,
    p_logistica: null,
    p_social: null,
};

const MODULES = [
    { id: 'p_avisos', label: 'Avisos' },
    { id: 'p_operacional', label: 'Operacional' },
    { id: 'p_ssci', label: 'SSCI' },
    { id: 'p_pessoal', label: 'B1 Pessoal' },
    { id: 'p_instrucao', label: 'B3 Instrução' },
    { id: 'p_logistica', label: 'B4 Logística' },
    { id: 'p_social', label: 'B5 Social' },
];

const GestaoUsuarios: React.FC = () => {
    const [profiles, setProfiles] = useState<ProfileWithStatus[]>([]);
    const [pendentes, setPendentes] = useState<ProfileWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvalTarget, setApprovalTarget] = useState<ProfileWithStatus | null>(null);
    const [approvalRole, setApprovalRole] = useState<ApprovalRole>(DEFAULT_ROLE);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('email');

        if (error) {
            toast.error('Erro ao carregar usuários');
        } else {
            const all = (data || []) as ProfileWithStatus[];
            setPendentes(all.filter(p => p.status === 'pendente'));
            setProfiles(all.filter(p => p.status !== 'pendente'));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const t = setTimeout(fetchProfiles, 0);
        return () => clearTimeout(t);
    }, [fetchProfiles]);

    const handleUpdatePermission = async (userId: string, column: string, value: string | boolean | null) => {
        const { error } = await supabase
            .from('profiles')
            .update({ [column]: value })
            .eq('id', userId);

        if (error) {
            toast.error('Erro ao atualizar permissão');
        } else {
            toast.success('Permissão atualizada');
            fetchProfiles();
        }
    };

    const handleDesativar = async (userId: string, email: string) => {
        if (!confirm(`Desativar acesso de ${email}?`)) return;
        const { error } = await supabase
            .from('profiles')
            .update({ status: 'inativo', updated_at: new Date().toISOString() })
            .eq('id', userId);
        if (error) {
            toast.error('Erro ao desativar usuário');
        } else {
            toast.success('Acesso desativado');
            fetchProfiles();
        }
    };

    const handleRejeitar = async (userId: string, email: string) => {
        if (!confirm(`Rejeitar e desativar acesso de ${email}?`)) return;
        const { error } = await supabase
            .from('profiles')
            .update({ status: 'inativo', updated_at: new Date().toISOString() })
            .eq('id', userId);
        if (error) {
            toast.error('Erro ao rejeitar usuário');
        } else {
            toast.success('Usuário rejeitado');
            fetchProfiles();
        }
    };

    const handleAprovar = async () => {
        if (!approvalTarget) return;
        const { error } = await supabase
            .from('profiles')
            .update({
                status: 'ativo',
                updated_at: new Date().toISOString(),
                ...approvalRole,
            })
            .eq('id', approvalTarget.id);

        if (error) {
            toast.error('Erro ao aprovar usuário');
        } else {
            toast.success(`Acesso aprovado para ${approvalTarget.email}`);
            setApprovalTarget(null);
            setApprovalRole(DEFAULT_ROLE);
            fetchProfiles();
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-stone-50">
                <div className="flex flex-col items-center gap-4">
                    <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="font-bold text-rustic-brown animate-pulse">Carregando Usuários...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-stone-50 overflow-hidden">
            <div className="p-8 md:p-12 max-w-[1600px] mx-auto w-full space-y-8 overflow-y-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-stone-200">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-primary text-3xl">admin_panel_settings</span>
                            <h1 className="text-4xl font-black text-[#2c1810] tracking-tight">Gestão de Acessos</h1>
                        </div>
                        <p className="text-rustic-brown/70 text-lg">Controle as permissões de cada usuário por módulo do sistema.</p>
                    </div>
                </div>

                {/* Pending Users Section */}
                {pendentes.length > 0 && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-3">
                            <span className="material-symbols-outlined text-amber-500">schedule</span>
                            <h2 className="text-lg font-black text-amber-900">Usuários Aguardando Aprovação</h2>
                            <span className="ml-auto bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
                                {pendentes.length}
                            </span>
                        </div>
                        <div className="divide-y divide-amber-100">
                            {pendentes.map(u => (
                                <div key={u.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {u.avatar_url ? (
                                            <img
                                                src={u.avatar_url}
                                                alt={u.full_name || u.email}
                                                className="w-10 h-10 rounded-full border-2 border-amber-200 flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                                                <span className="material-symbols-outlined text-amber-600 text-lg">person</span>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-bold text-amber-900 truncate">{u.full_name || u.email}</p>
                                            <p className="text-xs text-amber-700 truncate">{u.email}</p>
                                            <p className="text-[10px] text-amber-600 mt-0.5">
                                                Solicitado em {formatDate(u.created_at)} · via {u.provider || 'google'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => { setApprovalTarget(u); setApprovalRole(DEFAULT_ROLE); }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <span className="material-symbols-outlined text-base">check_circle</span>
                                            Aprovar
                                        </button>
                                        <button
                                            onClick={() => handleRejeitar(u.id, u.email)}
                                            className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <span className="material-symbols-outlined text-base">cancel</span>
                                            Rejeitar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Active Users Table */}
                <div>
                    <h2 className="text-lg font-black text-[#2c1810] mb-4">Usuários com Acesso</h2>
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-stone-100 border-b border-stone-200">
                                    <th className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest">Usuário</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest">Gestor</th>
                                    {MODULES.map(m => (
                                        <th key={m.id} className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest text-center">{m.label}</th>
                                    ))}
                                    <th className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {profiles.map(profile => (
                                    <tr key={profile.id} className="hover:bg-stone-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                {profile.avatar_url ? (
                                                    <img src={profile.avatar_url} alt={profile.email} className="w-8 h-8 rounded-full border border-stone-200" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-stone-400 text-sm">person</span>
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-[#2c1810]">{profile.email}</span>
                                                    {profile.full_name && <span className="text-[10px] text-stone-400">{profile.full_name}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                                                profile.status === 'ativo'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-red-50 text-red-600'
                                            }`}>
                                                {profile.status || 'ativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={profile.is_manager}
                                                    onChange={(e) => handleUpdatePermission(profile.id, 'is_manager', e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                                            </label>
                                        </td>
                                        {MODULES.map(m => (
                                            <td key={m.id} className="px-6 py-5">
                                                <select
                                                    className="text-[10px] font-bold uppercase py-1 px-2 rounded-md bg-stone-100 border-transparent focus:bg-white focus:border-primary outline-none"
                                                    value={profile[m.id as keyof UserProfile] as string || ''}
                                                    onChange={(e) => handleUpdatePermission(profile.id, m.id, e.target.value || null)}
                                                >
                                                    <option value="">Sem Acesso</option>
                                                    <option value="reader">Leitor</option>
                                                    <option value="editor">Editor</option>
                                                </select>
                                            </td>
                                        ))}
                                        <td className="px-6 py-5 text-center">
                                            {profile.status !== 'inativo' && (
                                                <button
                                                    onClick={() => handleDesativar(profile.id, profile.email)}
                                                    title="Desativar acesso"
                                                    className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">person_off</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Approval Modal */}
            {approvalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-stone-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-800">Aprovar Acesso</h3>
                                    <p className="text-sm text-gray-500">{approvalTarget.email}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">Defina as permissões deste usuário antes de aprovar:</p>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={approvalRole.is_manager}
                                    onChange={e => setApprovalRole(r => ({ ...r, is_manager: e.target.checked }))}
                                    className="w-4 h-4 accent-primary"
                                />
                                <span className="text-sm font-bold text-gray-700">Gestor de Acessos</span>
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                {MODULES.map(m => (
                                    <div key={m.id}>
                                        <label className="text-xs font-bold text-stone-500 uppercase mb-1 block">{m.label}</label>
                                        <select
                                            className="w-full text-xs font-bold py-1.5 px-2 rounded-lg bg-stone-100 border-transparent focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                                            value={approvalRole[m.id as keyof ApprovalRole] as string || ''}
                                            onChange={e => setApprovalRole(r => ({ ...r, [m.id]: e.target.value || null }))}
                                        >
                                            <option value="">Sem Acesso</option>
                                            <option value="reader">Leitor</option>
                                            <option value="editor">Editor</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t border-stone-100 flex gap-3">
                            <button
                                onClick={() => { setApprovalTarget(null); setApprovalRole(DEFAULT_ROLE); }}
                                className="flex-1 py-2.5 border border-stone-200 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAprovar}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold text-white transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                Confirmar Aprovação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestaoUsuarios;
