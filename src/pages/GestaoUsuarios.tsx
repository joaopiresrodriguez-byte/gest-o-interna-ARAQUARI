import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserProfile } from '../context/AuthContext';
import { toast } from 'sonner';

const GestaoUsuarios: React.FC = () => {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('email');

        if (error) {
            toast.error('Erro ao carregar usuários');
        } else {
            setProfiles(data || []);
        }
        setLoading(false);
    };

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

    const modules = [
        { id: 'p_avisos', label: 'Avisos' },
        { id: 'p_operacional', label: 'Operacional' },
        { id: 'p_ssci', label: 'SSCI' },
        { id: 'p_pessoal', label: 'B1 Pessoal' },
        { id: 'p_instrucao', label: 'B3 Instrução' },
        { id: 'p_logistica', label: 'B4 Logística' },
        { id: 'p_social', label: 'B5 Social' },
    ];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-stone-50">
                <div className="flex flex-col items-center gap-4">
                    <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
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
                        <p className="text-rustic-brown/70 text-lg">Controle as permissões de cada militar por módulo do sistema.</p>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-100 border-b border-stone-200">
                                <th className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest">Usuário</th>
                                <th className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest">Gestor</th>
                                {modules.map(m => (
                                    <th key={m.id} className="px-6 py-4 text-[11px] font-black text-stone-500 uppercase tracking-widest text-center">{m.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {profiles.map(profile => (
                                <tr key={profile.id} className="hover:bg-stone-50/50 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-[#2c1810]">{profile.email}</span>
                                            <span className="text-[10px] text-stone-400 font-mono tracking-tighter">{profile.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={profile.is_manager}
                                                onChange={(e) => handleUpdatePermission(profile.id, 'is_manager', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </td>
                                    {modules.map(m => (
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GestaoUsuarios;
