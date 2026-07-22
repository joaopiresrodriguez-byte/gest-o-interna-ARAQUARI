import { useState } from 'react';
import { supabase } from '../services/supabase';

export function useEdicao<T extends { id: string }>(tabela: string) {
  const [itemEditando, setItemEditando] = useState<T | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

    const { id, ...dados } = itemEditando;

    const { error } = await supabase
      .from(tabela)
      .update({
        ...dados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSalvando(false);

    if (error) {
      setErro(error.message);
      return false;
    }

    setItemEditando(null);
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
