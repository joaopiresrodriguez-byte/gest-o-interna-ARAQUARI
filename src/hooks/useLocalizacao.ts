import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useLocalizacao() {
  const [tipoLocal, setTipoLocal] = useState('');
  const [localId, setLocalId] = useState('');
  const [viaturaId, setViaturaId] = useState('');
  const [compartimentoId, setCompartimentoId] = useState('');

  const [locais, setLocais] = useState<any[]>([]);
  const [viaturas, setViaturas] = useState<any[]>([]);
  const [compartimentos, setCompartimentos] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('locais_equipamento')
      .select('id, nome, tipo')
      .eq('ativo', true)
      .order('ordem')
      .then(({ data }) => setLocais(data || []));

    supabase
      .from('viaturas')
      .select('id, nome, placa')
      .order('nome')
      .then(({ data }) => setViaturas(data || []));
  }, []);

  async function onSelecionarViatura(id: string) {
    setViaturaId(id);
    setCompartimentoId('');

    if (!id) {
      setCompartimentos([]);
      return;
    }

    const { data } = await supabase
      .from('compartimentos_viatura')
      .select('id, nome, posicao, ordem')
      .eq('viatura_id', id)
      .eq('ativo', true)
      .order('ordem');

    setCompartimentos(data || []);
  }

  function resetarLocalizacao() {
    setTipoLocal('');
    setLocalId('');
    setViaturaId('');
    setCompartimentoId('');
    setCompartimentos([]);
  }

  function obterPayload() {
    if (tipoLocal === 'ambiente') {
      return {
        local_id: localId || null,
        viatura_id: null,
        compartimento_id: null,
      };
    }
    if (tipoLocal === 'viatura') {
      return {
        local_id: null,
        viatura_id: viaturaId || null,
        compartimento_id: compartimentoId || null,
      };
    }
    return {
      local_id: null,
      viatura_id: null,
      compartimento_id: null,
    };
  }

  return {
    tipoLocal, setTipoLocal,
    localId, setLocalId,
    viaturaId,
    compartimentoId, setCompartimentoId,
    locais, viaturas, compartimentos,
    onSelecionarViatura,
    resetarLocalizacao,
    obterPayload,
  };
}
