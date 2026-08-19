import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from './useToast';

export function useEdicao<T extends { id?: string }>(tabela: string) {
  const [itemEditando, setItemEditando] = useState<T | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { mostrarToast } = useToast();

  function abrirEdicao(item: T) {
    setItemEditando({ ...item });
    setErro(null);
  }

  function cancelarEdicao() {
    setItemEditando(null);
    setErro(null);
  }

  function atualizarCampo(campo: keyof T, valor: any) {
    setItemEditando(prev => (prev ? { ...prev, [campo]: valor } : null));
  }

  async function salvarEdicao() {
    if (!itemEditando) return false;
    setSalvando(true);
    setErro(null);

    const { id, ...dados } = itemEditando as Record<string, any>;

    if (!id) {
      setErro('ID do registro não encontrado. Não é possível salvar.');
      setSalvando(false);
      return false;
    }

    // Filtrar campos de relacionamento e objetos virtuais que não são colunas reais
    const dadosLimpos: Record<string, any> = {};
    const ignoredKeys = [
      'local',
      'compartimento',
      'personnel',
      'bombeiro',
      'materia',
      'vehicle',
      'item',
      'time_ago',
      'personnel_name',
      'swap_with_name',
      'bombeiro_nome',
      'bombeiro_guerra',
      'bombeiro_posto',
      'bombeiro_telefone',
      'patrimonio_description',
    ];

    for (const [key, val] of Object.entries(dados)) {
      if (ignoredKeys.includes(key)) continue;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) continue;
      dadosLimpos[key] = val;
    }

    const { error } = await supabase
      .from(tabela)
      .update({
        ...dadosLimpos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSalvando(false);

    if (error) {
      setErro(error.message);
      mostrarToast('⚠️ Erro ao salvar alterações: ' + error.message, 'erro');
      return false;
    }

    setItemEditando(null);
    mostrarToast('✅ Salvo! Planilha Google atualizada automaticamente.', 'sucesso');
    return true;
  }

  return {
    itemEditando,
    salvando,
    erro,
    abrirEdicao,
    cancelarEdicao,
    atualizarCampo,
    salvarEdicao,
    editando: !!itemEditando,
  };
}
