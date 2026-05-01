import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface Militar {
  id: number;
  nome_completo: string;
  nome_guerra: string;
  posto_graduacao: string;
}

interface Guarnicao {
  id: number;
  nome: string;
  codigo: string; // 'A', 'B', 'C', 'D'
  membros: Militar[];
}

const CORES: Record<string, string> = {
  A: '#1d4ed8',
  B: '#15803d',
  C: '#c2410c',
  D: '#7e22ce',
};

const mapNomeToCodigo = (nome: string) => {
  if (nome === 'Alpha') return 'A';
  if (nome === 'Bravo') return 'B';
  if (nome === 'Charlie') return 'C';
  if (nome === 'Delta') return 'D';
  return nome.charAt(0);
};

export function GuarnicoesConfig({ onDataChange }: { onDataChange?: (totalGuarnicoes: number, totalMembros: number) => void }) {
  const [guarnicoes, setGuarnicoes] = useState<Guarnicao[]>([]);
  const [militaresDisponiveis, setMilitares] = useState<Militar[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);
    try {
      // Buscar guarnições com seus membros
      const { data: gData, error: gError } = await supabase
        .from('guarnicoes')
        .select(`
          id, nome,
          guarnicao_membros(
            militar_id,
            personnel(
              id, name, 
              war_name, rank
            )
          )
        `)
        .order('nome');

      if (gError) {
        console.error('Supabase gError:', gError);
      }

      // Buscar todos os militares ativos
      const { data: mData, error: mError } = await supabase
        .from('personnel')
        .select('id, name, war_name, rank')
        .eq('status', 'Ativo')
        .order('name');

      if (mError) {
        console.error('Supabase mError:', mError);
      }

      if (gData) {
        const formatadas = gData.map((g: any) => ({
          id: g.id,
          nome: g.nome,
          codigo: mapNomeToCodigo(g.nome),
          membros: g.guarnicao_membros
            ?.map((m: any) => m.personnel)
            .filter(Boolean)
            .map((p: any) => ({
              id: p.id,
              nome_completo: p.name,
              nome_guerra: p.war_name,
              posto_graduacao: p.rank
            })) || []
        }));
        
        // Ensure A B C D order
        formatadas.sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));
        setGuarnicoes(formatadas);
        if (onDataChange) {
          const totalMembers = formatadas.reduce((acc: number, g: any) => acc + g.membros.length, 0);
          onDataChange(formatadas.length, totalMembers);
        }
      }

      if (mData) {
        setMilitares(mData.map((p: any) => ({
          id: p.id,
          nome_completo: p.name,
          nome_guerra: p.war_name,
          posto_graduacao: p.rank
        })));
      }
    } finally {
      setCarregando(false);
    }
  }

  async function adicionarMilitar(guarnicaoId: number, militarId: number) {
    const jaEscalado = guarnicoes.some(g =>
      g.membros.some(m => m.id === militarId)
    );

    if (jaEscalado) {
      alert('Este militar já pertence a uma guarnição. Remova-o primeiro antes de transferir.');
      return;
    }

    const { error } = await supabase
      .from('guarnicao_membros')
      .insert({
        guarnicao_id: guarnicaoId,
        militar_id: militarId
      });

    if (!error) carregarDados();
    else console.error(error);
  }

  async function removerMilitar(guarnicaoId: number, militarId: number) {
    const confirmou = window.confirm('Remover este militar da guarnição?');
    if (!confirmou) return;

    const { error } = await supabase
      .from('guarnicao_membros')
      .delete()
      .eq('guarnicao_id', guarnicaoId)
      .eq('militar_id', militarId);

    if (!error) carregarDados();
    else console.error(error);
  }

  function getMilitaresLivres() {
    const idsEscalados = guarnicoes.flatMap(g => g.membros.map(m => m.id));
    return militaresDisponiveis.filter(m => !idsEscalados.includes(m.id));
  }

  if (carregando) return <div className="p-4 text-center">Carregando guarnições...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">groups</span>
          Configurar Guarnições
        </h3>
        {getMilitaresLivres().length > 0 && (
          <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            ⚠️ {getMilitaresLivres().length} militar(es) sem guarnição
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {guarnicoes.map(guarnicao => (
          <div key={guarnicao.id} className="border rounded-lg overflow-hidden bg-white">
            <div className="p-3 text-white font-bold text-sm flex items-center justify-between"
              style={{ backgroundColor: CORES[guarnicao.codigo] || '#374151' }}>
              <span>Guarnição {guarnicao.codigo}</span>
              <span className="text-xs opacity-75 bg-white/20 px-2 py-0.5 rounded-full">
                {guarnicao.membros.length} mil.
              </span>
            </div>

            <div className="p-2 min-h-[120px] bg-white">
              {guarnicao.membros.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-4">Nenhum militar</p>
              ) : (
                guarnicao.membros.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded text-xs">
                    <span className="truncate">
                      <span className="text-gray-400 mr-1">{m.posto_graduacao}</span>
                      {m.nome_guerra || m.nome_completo.split(' ')[0]}
                    </span>
                    <button
                      onClick={() => removerMilitar(guarnicao.id, m.id)}
                      className="text-red-400 hover:text-red-600 ml-1 flex-shrink-0 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-2 border-t bg-gray-50">
              <select
                className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                defaultValue=""
                onChange={e => {
                  if (e.target.value) {
                    adicionarMilitar(guarnicao.id, Number(e.target.value));
                    e.target.value = '';
                  }
                }}>
                <option value="">+ Adicionar militar...</option>
                {getMilitaresLivres().map(m => (
                  <option key={m.id} value={m.id}>
                    {m.posto_graduacao} — {m.nome_guerra || m.nome_completo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Legenda de cores:</strong>
        {guarnicoes.map(g => (
          <span key={g.id} className="inline-flex items-center gap-1 ml-3">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: CORES[g.codigo] }} />
            Guarnição {g.codigo}
          </span>
        ))}
      </div>
    </div>
  );
}
