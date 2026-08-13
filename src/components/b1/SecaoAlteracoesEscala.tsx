import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Personnel, Escala, Vacation } from '../../services/types';
import { ScaleAdjustmentService } from '../../services/scaleAdjustmentService';
import { supabase } from '../../services/supabase';

interface SecaoAlteracoesEscalaProps {
  personnelList: Personnel[];
  escalas: Escala[];
  vacations: Vacation[];
  onReload: () => void;
}

export const SecaoAlteracoesEscala: React.FC<SecaoAlteracoesEscalaProps> = ({
  personnelList,
  escalas,
  vacations,
  onReload,
}) => {
  const [modalidade, setModalidade] = useState<'mútua' | 'individual' | 'transferencia'>('mútua');
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [guarnicoesList, setGuarnicoesList] = useState<any[]>([]);

  // Form State — Modalidade 1 (Mútua)
  const [militarAId, setMilitarAId] = useState<number | ''>('');
  const [diaA, setDiaA] = useState('');
  const [militarBId, setMilitarBId] = useState<number | ''>('');
  const [diaB, setDiaB] = useState('');

  // Form State — Modalidade 2 (Individual)
  const [indMilitarId, setIndMilitarId] = useState<number | ''>('');
  const [indDiaSaida, setIndDiaSaida] = useState('');
  const [indDiaEntrada, setIndDiaEntrada] = useState('');
  const [indSubstituidoId, setIndSubstituidoId] = useState<number | ''>('');

  // Form State — Modalidade 3 (Transferência)
  const [transfMilitarId, setTransfMilitarId] = useState<number | ''>('');
  const [transfGuarnicaoDestino, setTransfGuarnicaoDestino] = useState('');
  const [transfDataVigencia, setTransfDataVigencia] = useState('');
  const [motivo, setMotivo] = useState('');

  const loadData = async () => {
    try {
      const logs = await ScaleAdjustmentService.getHistoricoAlteracoes();
      setHistorico(logs || []);

      const { data: gData } = await supabase.from('guarnicoes').select('*');
      if (gData) setGuarnicoesList(gData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Verificar férias/afastamento de um militar em uma data
  const checarAfastamento = (militarId: number, data: string) => {
    if (!militarId || !data) return false;
    return vacations.some(
      v => v.personnel_id === militarId && data >= v.start_date && data <= v.end_date
    );
  };

  // 1. Executar Troca Mútua
  const handleTrocaMutua = async () => {
    if (!militarAId || !diaA || !militarBId || !diaB) {
      toast.error('Preencha os dois militares e seus respectivos dias de serviço.');
      return;
    }

    if (militarAId === militarBId) {
      toast.error('Selecione dois militares diferentes para a troca mútua.');
      return;
    }

    // Validar conflito de férias/licença
    if (checarAfastamento(militarAId, diaB)) {
      const milA = personnelList.find(p => p.id === militarAId);
      toast.warning(`⚠️ Alerta: ${milA?.war_name || milA?.name} possui férias/afastamento cadastrado para o dia ${diaB}.`);
    }
    if (checarAfastamento(militarBId, diaA)) {
      const milB = personnelList.find(p => p.id === militarBId);
      toast.warning(`⚠️ Alerta: ${milB?.war_name || milB?.name} possui férias/afastamento cadastrado para o dia ${diaA}.`);
    }

    const milA = personnelList.find(p => p.id === militarAId);
    const milB = personnelList.find(p => p.id === militarBId);

    const confirma = confirm(
      `CONFIRMAÇÃO DA TROCA MÚTUA:\n\n` +
      `• ${milA?.graduation || ''} ${milA?.war_name || milA?.name} (Dia ${diaA}) passará para o dia ${diaB}.\n` +
      `• ${milB?.graduation || ''} ${milB?.war_name || milB?.name} (Dia ${diaB}) passará para o dia ${diaA}.\n\n` +
      `Deseja aplicar a alteração na escala publicada?`
    );

    if (!confirma) return;

    setLoading(true);
    try {
      await ScaleAdjustmentService.registrarTrocaMutua({
        militarAId: Number(militarAId),
        diaA,
        militarBId: Number(militarBId),
        diaB,
        usuario: 'Administrador B1',
        detalhes: motivo || `Troca mútua: ${milA?.war_name} (${diaA}) por ${milB?.war_name} (${diaB})`
      });

      toast.success('✅ Troca mútua de serviço realizada com sucesso!');
      setMilitarAId(''); setDiaA(''); setMilitarBId(''); setDiaB(''); setMotivo('');
      loadData();
      onReload();
    } catch (err: any) {
      toast.error('Erro ao realizar troca: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Executar Troca Individual
  const handleTrocaIndividual = async () => {
    if (!indMilitarId || !indDiaSaida || !indDiaEntrada) {
      toast.error('Informe o militar, o dia de saída e o novo dia de entrada.');
      return;
    }

    if (checarAfastamento(indMilitarId, indDiaEntrada)) {
      const mil = personnelList.find(p => p.id === indMilitarId);
      toast.warning(`⚠️ Alerta: ${mil?.war_name || mil?.name} possui férias/afastamento cadastrado no dia ${indDiaEntrada}.`);
    }

    const mil = personnelList.find(p => p.id === indMilitarId);
    const sub = indSubstituidoId ? personnelList.find(p => p.id === indSubstituidoId) : null;

    const mensagem = sub
      ? `• ${mil?.war_name || mil?.name} sairá do dia ${indDiaSaida} e entrará no dia ${indDiaEntrada} substituindo ${sub.war_name || sub.name}.`
      : `• ${mil?.war_name || mil?.name} sairá do serviço do dia ${indDiaSaida} e entrará no serviço do dia ${indDiaEntrada}.`;

    if (!confirm(`CONFIRMAÇÃO DA TROCA INDIVIDUAL:\n\n${mensagem}\n\nConfirmar alteração na escala?`)) return;

    setLoading(true);
    try {
      await ScaleAdjustmentService.registrarTrocaIndividual({
        militarId: Number(indMilitarId),
        diaSaida: indDiaSaida,
        diaEntrada: indDiaEntrada,
        militarSubstitudoId: indSubstituidoId ? Number(indSubstituidoId) : undefined,
        usuario: 'Administrador B1',
        detalhes: motivo || `Troca individual: ${mil?.war_name} saiu do dia ${indDiaSaida} e entrou no dia ${indDiaEntrada}`
      });

      toast.success('✅ Troca individual registrada!');
      setIndMilitarId(''); setIndDiaSaida(''); setIndDiaEntrada(''); setIndSubstituidoId(''); setMotivo('');
      loadData();
      onReload();
    } catch (err: any) {
      toast.error('Erro ao registrar troca individual: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Executar Transferência de Guarnição
  const handleTransferenciaGuarnicao = async () => {
    if (!transfMilitarId || !transfGuarnicaoDestino || !transfDataVigencia) {
      toast.error('Selecione o militar, a guarnição de destino e a data de vigência.');
      return;
    }

    const mil = personnelList.find(p => p.id === transfMilitarId);
    const gDest = guarnicoesList.find(g => g.id === transfGuarnicaoDestino || g.cor === transfGuarnicaoDestino);

    const confirma = confirm(
      `CONFIRMAÇÃO DE TRANSFERÊNCIA DE GUARNIÇÃO:\n\n` +
      `• Militar: ${mil?.graduation || ''} ${mil?.war_name || mil?.name}\n` +
      `• Guarnição de Destino: ${gDest?.nome || transfGuarnicaoDestino.toUpperCase()}\n` +
      `• Data de Vigência: ${transfDataVigencia}\n\n` +
      `A partir do dia ${transfDataVigencia}, este militar passará a integrar a nova guarnição. Serviços anteriores permanecerão inalterados. Confirmar?`
    );

    if (!confirma) return;

    setLoading(true);
    try {
      await ScaleAdjustmentService.registrarTransferenciaGuarnicao({
        militarId: Number(transfMilitarId),
        guarnicaoDestinoId: transfGuarnicaoDestino,
        dataVigencia: transfDataVigencia,
        usuario: 'Administrador B1',
        detalhes: motivo || `Transferência para Guarnição ${gDest?.nome || transfGuarnicaoDestino} a partir de ${transfDataVigencia}`
      });

      toast.success('✅ Transferência de guarnição realizada com sucesso!');
      setTransfMilitarId(''); setTransfGuarnicaoDestino(''); setTransfDataVigencia(''); setMotivo('');
      loadData();
      onReload();
    } catch (err: any) {
      toast.error('Erro ao transferir guarnição: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <h3 className="font-black text-lg flex items-center gap-2 text-[#3e2723]">
            <span className="material-symbols-outlined text-amber-500">published_with_changes</span>
            Alterações na Escala Publicada
          </h3>
          <p className="text-xs text-rustic-brown/60">
            Gerencie trocas mútuas, substituições individuais e transferências com histórico auditável.
          </p>
        </div>

        {/* Modalidade Selector */}
        <div className="flex bg-stone-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setModalidade('mútua')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              modalidade === 'mútua' ? 'bg-white text-primary shadow-sm font-black' : 'text-stone-600 hover:text-rustic-brown'
            }`}
          >
            1. Troca Mútua
          </button>
          <button
            onClick={() => setModalidade('individual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              modalidade === 'individual' ? 'bg-white text-primary shadow-sm font-black' : 'text-stone-600 hover:text-rustic-brown'
            }`}
          >
            2. Troca Individual
          </button>
          <button
            onClick={() => setModalidade('transferencia')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              modalidade === 'transferencia' ? 'bg-white text-primary shadow-sm font-black' : 'text-stone-600 hover:text-rustic-brown'
            }`}
          >
            3. Transferência
          </button>
        </div>
      </div>

      {/* FORM: MODALIDADE 1 — TROCA MÚTUA */}
      {modalidade === 'mútua' && (
        <div className="space-y-4 bg-amber-50/50 p-5 rounded-xl border border-amber-200/60">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">swap_horizontal_circle</span>
            Modalidade 1 — Troca de Serviço entre Dois Militares
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Militar A</label>
              <select
                value={militarAId}
                onChange={e => setMilitarAId(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              >
                <option value="">Selecione Militar A...</option>
                {personnelList.filter(p => p.status === 'Ativo').map(p => (
                  <option key={p.id} value={p.id}>{p.graduation || ''} {p.war_name || p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Dia de Serviço do Militar A</label>
              <input
                type="date"
                value={diaA}
                onChange={e => setDiaA(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Militar B</label>
              <select
                value={militarBId}
                onChange={e => setMilitarBId(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              >
                <option value="">Selecione Militar B...</option>
                {personnelList.filter(p => p.status === 'Ativo' && p.id !== militarAId).map(p => (
                  <option key={p.id} value={p.id}>{p.graduation || ''} {p.war_name || p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Dia de Serviço do Militar B</label>
              <input
                type="date"
                value={diaB}
                onChange={e => setDiaB(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end pt-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Motivo / Justificativa</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ex: Troca de plantão por motivo particular..."
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-medium"
              />
            </div>

            <button
              onClick={handleTrocaMutua}
              disabled={loading}
              className="h-11 px-6 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">sync_alt</span>
              CONFIRMAR TROCA MÚTUA
            </button>
          </div>
        </div>
      )}

      {/* FORM: MODALIDADE 2 — TROCA INDIVIDUAL */}
      {modalidade === 'individual' && (
        <div className="space-y-4 bg-blue-50/50 p-5 rounded-xl border border-blue-200/60">
          <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">person_pin</span>
            Modalidade 2 — Troca Individual de Dia de Serviço
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Militar</label>
              <select
                value={indMilitarId}
                onChange={e => setIndMilitarId(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              >
                <option value="">Selecione o Militar...</option>
                {personnelList.filter(p => p.status === 'Ativo').map(p => (
                  <option key={p.id} value={p.id}>{p.graduation || ''} {p.war_name || p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Dia de Saída (Origem)</label>
              <input
                type="date"
                value={indDiaSaida}
                onChange={e => setIndDiaSaida(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Novo Dia de Entrada (Destino)</label>
              <input
                type="date"
                value={indDiaEntrada}
                onChange={e => setIndDiaEntrada(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Militar Substituído (Opcional)</label>
              <select
                value={indSubstituidoId}
                onChange={e => setIndSubstituidoId(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              >
                <option value="">Ninguém (Apenas entra no dia)</option>
                {personnelList.filter(p => p.status === 'Ativo' && p.id !== indMilitarId).map(p => (
                  <option key={p.id} value={p.id}>{p.graduation || ''} {p.war_name || p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end pt-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Motivo / Justificativa</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ex: Ajuste de escala individual..."
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-medium"
              />
            </div>

            <button
              onClick={handleTrocaIndividual}
              disabled={loading}
              className="h-11 px-6 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">rule</span>
              CONFIRMAR TROCA INDIVIDUAL
            </button>
          </div>
        </div>
      )}

      {/* FORM: MODALIDADE 3 — TRANSFERÊNCIA DE GUARNIÇÃO */}
      {modalidade === 'transferencia' && (
        <div className="space-y-4 bg-green-50/50 p-5 rounded-xl border border-green-200/60">
          <h4 className="text-xs font-black uppercase tracking-wider text-green-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">groups_3</span>
            Modalidade 3 — Transferência de Guarnição do Militar
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Militar</label>
              <select
                value={transfMilitarId}
                onChange={e => setTransfMilitarId(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              >
                <option value="">Selecione o Militar...</option>
                {personnelList.filter(p => p.status === 'Ativo').map(p => (
                  <option key={p.id} value={p.id}>{p.graduation || ''} {p.war_name || p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Guarnição de Destino (Cor)</label>
              <select
                value={transfGuarnicaoDestino}
                onChange={e => setTransfGuarnicaoDestino(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              >
                <option value="">Selecione a Guarnição por Cor...</option>
                <option value="330e8bf5-9712-4483-8ae5-b5ca110d97ff">🟢 Guarnição A — VERDE</option>
                <option value="be1d50e1-7ab0-4572-9fe0-a1872fc27e6c">🔵 Guarnição B — AZUL</option>
                <option value="9c58324e-0da3-4f8c-bc4b-dcca02b90784">🟡 Guarnição C — AMARELO</option>
                <option value="3b7c783b-c76b-4825-9d82-5d60a30c8b88">🔴 Guarnição D — VERMELHO</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Data de Vigência</label>
              <input
                type="date"
                value={transfDataVigencia}
                onChange={e => setTransfDataVigencia(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end pt-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-500">Motivo / Portaria de Transferência</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ex: Remanejamento interno de efetivo..."
                className="w-full h-11 px-3 rounded-lg border border-rustic-border bg-white text-xs font-medium"
              />
            </div>

            <button
              onClick={handleTransferenciaGuarnicao}
              disabled={loading}
              className="h-11 px-6 bg-green-700 hover:bg-green-800 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">swap_calls</span>
              CONFIRMAR TRANSFERÊNCIA
            </button>
          </div>
        </div>
      )}

      {/* BLOCO 4: TABELA DE HISTÓRICO DE ALTERAÇÕES */}
      <div className="pt-4 border-t border-stone-100">
        <h4 className="text-xs font-black uppercase tracking-wider text-rustic-brown/70 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-stone-400">history</span>
          Histórico Auditável de Alterações de Escala (`escala_alteracoes`)
        </h4>

        <div className="overflow-x-auto border border-rustic-border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-[10px] font-black uppercase text-rustic-brown/60 border-b border-rustic-border">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Tipo de Alteração</th>
                <th className="py-2.5 px-3">Descrição / Detalhes</th>
                <th className="py-2.5 px-3">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rustic-border/30">
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-stone-400 italic">
                    Nenhuma alteração registrada até o momento.
                  </td>
                </tr>
              ) : (
                historico.map((h, idx) => (
                  <tr key={h.id || idx} className="hover:bg-stone-50/50">
                    <td className="py-2.5 px-3 font-medium text-stone-500 whitespace-nowrap">
                      {new Date(h.criado_em || h.created_at || Date.now()).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        h.tipo_alteracao?.includes('troca_militares') || h.tipo_alteracao?.includes('Mútua')
                          ? 'bg-amber-100 text-amber-800'
                          : h.tipo_alteracao?.includes('individual') || h.tipo_alteracao?.includes('Individual')
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {h.tipo_alteracao}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-rustic-brown">{h.detalhes || h.reason || '—'}</td>
                    <td className="py-2.5 px-3 font-bold text-stone-600">{h.criado_por || h.performed_by || 'Administrador B1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
