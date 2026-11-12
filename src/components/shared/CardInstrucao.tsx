import React, { useState } from 'react';
import { Training, Personnel, MateriaInstrucao } from '../../services/types';
import { STATUS_INSTRUCAO, STATUS_RESULTADO_INSTRUCAO, StatusInstrucao, atualizarInstrucao } from '../../services/instrucoesService';
import { toast } from 'sonner';

interface CardInstrucaoProps {
  instrucao: Training;
  isEditor: boolean;
  isFuture?: boolean;
  personnelList?: Personnel[];
  materiasList?: MateriaInstrucao[];
  onAtualizar: () => void;
  onEditarCompleto?: (instrucao: Training) => void;
  onExcluir?: () => void;
  onIniciar?: () => void;
}

export const CardInstrucao: React.FC<CardInstrucaoProps> = ({
  instrucao,
  isEditor,
  isFuture,
  onAtualizar,
  onEditarCompleto,
  onExcluir,
  onIniciar,
}) => {
  const [editando, setEditando] = useState(false);
  const [status, setStatus] = useState<string>(instrucao.status || 'Scheduled');
  const [observacoes, setObservacoes] = useState(instrucao.observacoes || '');
  const [salvando, setSalvando] = useState(false);

  const materiaName = instrucao.tema || instrucao.materia?.tema || instrucao.materia?.name || instrucao.materia_id || 'Instrução Operacional';
  const cfgAtual = STATUS_INSTRUCAO[status] || STATUS_INSTRUCAO.Scheduled;

  async function handleSalvarResultado() {
    if (isFuture) return;
    setSalvando(true);
    try {
      await atualizarInstrucao(instrucao.id!, {
        status,
        observacoes,
      });
      toast.success('Resultado da instrução atualizado com sucesso!');
      setEditando(false);
      onAtualizar();
    } catch (err: any) {
      toast.error('Erro ao salvar resultado: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setSalvando(false);
    }
  }

  const isCanceled = status === 'Canceled' || status === 'Cancelado';

  return (
    <div className={`rounded-xl border shadow-sm transition-all overflow-hidden ${isFuture ? 'bg-slate-50/80 border-slate-200 opacity-80' : isCanceled ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-blue-200 hover:shadow-md'}`}>
      {/* CABEÇALHO */}
      <div
        className="flex flex-wrap items-start justify-between gap-3 p-5"
        style={{ borderLeft: `4px solid ${isFuture ? '#94a3b8' : cfgAtual.cor}` }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: isFuture ? '#f1f5f9' : cfgAtual.fundo }}
          >
            {cfgAtual.icone}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className={`font-bold text-base truncate ${isCanceled ? 'text-gray-500 line-through' : 'text-blue-900'}`}>
                {materiaName}
              </p>
              {isFuture && (
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                  FUTURO
                </span>
              )}
            </div>

            {instrucao.materia?.description && (
              <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">{instrucao.materia.description}</p>
            )}

            {/* Localização e Mapas */}
            {instrucao.location && (
              <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]">
                <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">location_on</span>
                  {instrucao.location}
                </span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(instrucao.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-bold flex items-center gap-0.5 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"
                >
                  <span className="material-symbols-outlined text-[12px]">map</span>
                  Google Maps
                </a>
                <a
                  href={`https://waze.com/ul?q=${encodeURIComponent(instrucao.location)}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 hover:underline font-bold flex items-center gap-0.5 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-100"
                >
                  <span className="material-symbols-outlined text-[12px]">navigation</span>
                  Waze
                </a>
              </div>
            )}

            {/* Badges de Informações */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                Instrução
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: cfgAtual.fundo, color: cfgAtual.cor }}
              >
                {cfgAtual.icone} {cfgAtual.label}
              </span>
              {instrucao.date && (
                <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                  {new Date(instrucao.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              {instrucao.time && (
                <span className="text-[10px] text-gray-500 font-bold">
                  <span className="material-symbols-outlined text-[12px] align-middle">schedule</span>{' '}
                  {instrucao.time}{instrucao.end_time ? ` — ${instrucao.end_time}` : ''}
                </span>
              )}
              {instrucao.instructor && (
                <span className="text-[10px] text-gray-500 font-bold">
                  <span className="material-symbols-outlined text-[12px] align-middle">person</span>{' '}
                  Instrutor: {instrucao.instructor}
                </span>
              )}
              {instrucao.completed_by && (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-100">
                  Concluído por: {instrucao.completed_by}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AÇÕES IGUAIS ÀS MISSÕES */}
        {isEditor && !isFuture && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEditarCompleto && (
              <button
                type="button"
                onClick={() => onEditarCompleto(instrucao)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                title="Editar dados completos da instrução"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            )}
            {(status === 'Scheduled' || status === 'agendada') && onIniciar && (
              <button
                type="button"
                onClick={onIniciar}
                className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                title="Iniciar instrução"
              >
                <span className="material-symbols-outlined text-[20px]">play_circle</span>
              </button>
            )}
            {/* Botão de resultado/observações 📝 */}
            <button
              type="button"
              onClick={() => setEditando(!editando)}
              title="Registrar Resultado / Observações"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px 8px',
                borderRadius: '6px',
                color: '#64748b',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              📝
            </button>
            {onExcluir && (
              <button
                type="button"
                onClick={onExcluir}
                className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                title="Excluir instrução"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* OBSERVAÇÕES (somente leitura) */}
      {!editando && instrucao.observacoes && (
        <div className="px-5 py-3 bg-slate-50 border-t border-blue-100 text-sm text-slate-600">
          <span className="font-bold text-slate-700">Obs: </span>
          {instrucao.observacoes}
        </div>
      )}

      {/* AUDITORIA */}
      {!editando && instrucao.editado_por_nome && (
        <div className="px-5 py-2 bg-slate-50 border-t border-blue-100 flex items-center gap-1.5">
          <span className="text-[11px]">🔏</span>
          <span className="text-[11px] text-slate-400">
            Editado por{' '}
            <strong className="text-slate-500">{instrucao.editado_por_nome}</strong>
            {instrucao.editado_em && (
              <> em {new Date(instrucao.editado_em).toLocaleString('pt-BR')}</>
            )}
          </span>
        </div>
      )}

      {/* PAINEL DE EDIÇÃO DE RESULTADO */}
      {editando && (
        <div className="p-5 bg-slate-50 border-t border-blue-200 flex flex-col gap-4 animate-in fade-in">
          {/* SELETOR DE RESULTADO */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Resultado da Instrução
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATUS_RESULTADO_INSTRUCAO.map((item) => {
                const selected = status === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatus(item.key)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      border: selected ? `2px solid ${item.cor}` : '2px solid #e2e8f0',
                      background: selected ? item.fundo : 'white',
                      color: selected ? item.cor : '#64748b',
                    }}
                  >
                    <span>{item.icone}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CAMPO OBSERVAÇÕES */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Observações / Ocorrências
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Descreva o conteúdo abordado, público presente, ocorrências ou justificativas..."
              className="w-full px-3 py-2 rounded-lg border border-rustic-border text-sm font-normal resize-vertical focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
            />
          </div>

          {/* BOTÕES */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setStatus(instrucao.status || 'Scheduled');
                setObservacoes(instrucao.observacoes || '');
              }}
              disabled={salvando}
              className="px-4 py-2 text-sm font-bold border border-rustic-border bg-white rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarResultado}
              disabled={salvando}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg transition-all cursor-pointer"
              style={{ background: salvando ? '#94a3b8' : '#1d4ed8' }}
            >
              {salvando ? '⏳ Salvando...' : '✅ Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
