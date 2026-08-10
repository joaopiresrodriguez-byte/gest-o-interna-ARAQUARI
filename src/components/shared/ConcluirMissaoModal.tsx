import React, { useState, useEffect } from 'react';
import { DailyMission, Personnel } from '../../services/types';
import { STATUS_MISSAO, StatusMissao, atualizarMissao } from '../../services/missoesService';
import { SupabaseService } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

export interface ConcluirMissaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: DailyMission | null;
  onSuccess: () => void;
}

export const ConcluirMissaoModal: React.FC<ConcluirMissaoModalProps> = ({
  isOpen,
  onClose,
  mission,
  onSuccess
}) => {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<StatusMissao>('concluida');
  const [completedBy, setCompletedBy] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && mission) {
      SupabaseService.getPersonnel()
        .then(data => setPersonnelList(data || []))
        .catch(err => console.error("Erro ao carregar lista de pessoal:", err));

      setStatus((mission.status as StatusMissao) || 'concluida');
      setObservacoes(mission.observacoes || '');

      // Definir militar responsável / quem concluiu padrão com base no perfil logado
      const militarLogado = profile?.name || profile?.war_name || user?.email || '';
      setCompletedBy(mission.completed_by || militarLogado);
    }
  }, [isOpen, mission, profile, user]);

  if (!isOpen || !mission) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((status === 'parcialmente_concluida' || status === 'nao_realizada') && !observacoes.trim()) {
      toast.error('Informe uma observação / justificativa para missões não concluídas ou parcialmente concluídas.');
      return;
    }

    setLoading(true);
    try {
      if (mission.id) {
        await atualizarMissao(mission.id, {
          status,
          observacoes: observacoes.trim(),
          completed_by: completedBy.trim()
        });
        toast.success(`Status da missão atualizado para "${STATUS_MISSAO[status]?.label || status}"!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Erro ao atualizar resultado da missão:', err);
      toast.error('Erro ao atualizar resultado: ' + (err.message || 'tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-amber-400">assignment_turned_in</span>
            <div>
              <h3 className="font-bold text-base">Registrar Conclusão / Resultado</h3>
              <p className="text-xs text-slate-300 truncate max-w-xs">{mission.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-xl block">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Status Final */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Resultado da Missão <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('concluida')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                  status === 'concluida'
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-800 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-base">✅</span>
                Concluída
              </button>

              <button
                type="button"
                onClick={() => setStatus('parcialmente_concluida')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                  status === 'parcialmente_concluida'
                    ? 'bg-amber-100 border-amber-500 text-amber-900 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-base">⚠️</span>
                Parcialmente
              </button>

              <button
                type="button"
                onClick={() => setStatus('nao_realizada')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                  status === 'nao_realizada'
                    ? 'bg-red-100 border-red-500 text-red-900 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-base">❌</span>
                Não Realizada
              </button>
            </div>
          </div>

          {/* Quem Concluiu / Atualizou */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Quem Concluiu / Registrou <span className="text-red-500">*</span>
            </label>
            {personnelList.length > 0 ? (
              <select
                value={completedBy}
                onChange={e => setCompletedBy(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-slate-500"
              >
                <option value="">Selecione o militar...</option>
                {personnelList.map(p => {
                  const label = `${p.rank ? p.rank + ' ' : ''}${p.war_name || p.name}`;
                  return (
                    <option key={p.id} value={label}>
                      {label}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                required
                value={completedBy}
                onChange={e => setCompletedBy(e.target.value)}
                placeholder="Nome do militar"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            )}
          </div>

          {/* Observações / Justificativa */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Observações / Justificativa{' '}
              {(status === 'parcialmente_concluida' || status === 'nao_realizada') && (
                <span className="text-red-500">(Obrigatório em caso de pendência)</span>
              )}
            </label>
            <textarea
              rows={3}
              required={status === 'parcialmente_concluida' || status === 'nao_realizada'}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Descreva o motivo da não realização ou detalhes do encerramento..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 resize-none"
            />
          </div>

          {(status === 'parcialmente_concluida' || status === 'nao_realizada') && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-600 text-base shrink-0">mail</span>
              <p>
                <strong>Notificação Automática:</strong> Ao registrar como <em>{STATUS_MISSAO[status]?.label}</em>, um aviso será enviado automaticamente para o e-mail do Comando (<code>16_22cmt@cbm.sc.gov.br</code>) e gravado na central de avisos pendentes.
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
              Salvar Resultado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
