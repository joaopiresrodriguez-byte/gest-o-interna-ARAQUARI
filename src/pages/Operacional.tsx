import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SupabaseService, ProductReceipt, DailyMission, Training } from '../services/SupabaseService';
import { NotificationService } from '../services/NotificationService';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button, Input, TextArea } from '../components/ui';
import { STATUS_MISSAO, STATUS_RESULTADO, StatusMissao, atualizarMissao } from '../services/missoesService';
import ConferenciaDiaria from '../components/operacional/ConferenciaDiaria';
import SecaoCautelasOperacional from '../components/operacional/SecaoCautelasOperacional';
import HistoricoConferencias from '../components/b4/HistoricoConferencias';
import { DailyMissionModal } from '../components/shared/DailyMissionModal';

// ============ SUB-COMPONENTS ============

const GarrisonDisplay = () => {
  const [escala, setEscala] = useState<any>(null);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getLeaveLabel = (type?: string) => {
    switch (type) {
      case 'ferias': return 'Férias';
      case 'licenca_medica': return 'Licença Médica';
      case 'licenca_especial': return 'Licença Especial';
      case 'afastamento': return 'Afastamento';
      case 'cedido': return 'Cedido';
      case 'outros': return 'Outros';
      default: return 'Afastamento';
    }
  };

  useEffect(() => {
    const fetchEscala = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [escalaData, personnelData, vacationsData] = await Promise.all([
          SupabaseService.getEscalaByDate(today),
          SupabaseService.getPersonnel(),
          SupabaseService.getVacations()
        ]);
        setEscala(escalaData);
        setPersonnel(personnelData);
        setVacations(vacationsData || []);
      } catch (error) {
        console.error("Erro ao buscar guarnição:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEscala();
  }, []);

  if (loading) return <div className="text-xs text-gray-500 animate-pulse">Carregando guarnição...</div>;
  if (!escala) return <div className="text-xs text-gray-400 italic">Nenhuma escala publicada para hoje. (Verifique com o B1)</div>;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-rustic-brown">Equipe:</span>
          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-black uppercase">{escala.equipe}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {escala.militares?.map((id: number) => {
          const p = personnel.find(px => px.id === id);
          if (!p) return null;

          const afastamento = vacations.find(v => {
            if (v.leave_type === 'desconto_ferias') return false;
            const matchPerson = Number(v.personnel_id) === Number(p.id) ||
              (v.full_name && p.name && v.full_name.toLowerCase().trim() === p.name.toLowerCase().trim());
            return matchPerson && v.start_date <= today && v.end_date >= today;
          });

          return (
            <div
              key={id}
              className={`flex items-center gap-2.5 p-2 rounded-lg shadow-xs transition-all border ${
                afastamento
                  ? 'bg-amber-500/10 border-amber-500/30 relative overflow-hidden'
                  : 'bg-white border-gray-200'
              }`}
            >
              {afastamento && (
                <div className="w-1 bg-amber-500 absolute left-0 top-0 bottom-0"></div>
              )}
              <div
                className={`w-8 h-8 rounded-full bg-cover bg-center shrink-0 ${
                  afastamento ? 'ml-1 border border-amber-300' : ''
                }`}
                style={{ backgroundImage: `url(${p.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'})` }}
              ></div>
              <div className="leading-tight flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-[10px] font-black text-primary uppercase">{p.rank}</p>
                  {afastamento && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-950 border border-amber-500/40 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                      {getLeaveLabel(afastamento.leave_type)}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-gray-700 truncate">{p.war_name || p.name.split(' ')[0]}</p>
                {afastamento && (
                  <p className="text-[9px] text-amber-800 font-semibold truncate">
                    • (Afastado no período)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const NotificationModal = ({ isOpen, onClose, notificationData, type }: {
  isOpen: boolean;
  onClose: () => void;
  notificationData: { waText: string; emailSubject: string; emailBody: string } | null;
  type: 'receipt' | 'conference';
}) => {
  if (!isOpen || !notificationData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-secondary-green mb-2">notifications_active</span>
          <h3 className="text-lg font-black text-[#181111]">
            {type === 'receipt' ? 'Recebimento Registrado!' : 'Conferência Finalizada!'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">Deseja enviar notificação?</p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => { NotificationService.openWhatsApp(notificationData.waText); onClose(); }}
            className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-all group"
          >
            <span className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">chat</span>
            </span>
            <div className="text-left">
              <p className="text-sm font-bold text-green-800">WhatsApp</p>
              <p className="text-[10px] text-green-600">Enviar via WhatsApp Web</p>
            </div>
          </button>

          <button
            onClick={() => { NotificationService.openEmail(notificationData.emailSubject, notificationData.emailBody); onClose(); }}
            className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all group"
          >
            <span className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">email</span>
            </span>
            <div className="text-left">
              <p className="text-sm font-bold text-blue-800">Email</p>
              <p className="text-[10px] text-blue-600">Enviar por Email Institucional</p>
            </div>
          </button>

          <button
            onClick={() => {
              NotificationService.openWhatsApp(notificationData.waText);
              setTimeout(() => NotificationService.openEmail(notificationData.emailSubject, notificationData.emailBody), 800);
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all group"
          >
            <span className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">forward_to_inbox</span>
            </span>
            <div className="text-left">
              <p className="text-sm font-bold text-amber-800">Ambos</p>
              <p className="text-[10px] text-amber-600">WhatsApp + Email</p>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="w-full py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
          Pular notificação
        </button>
      </div>
    </div>
  );
};

// Priority config
const PRIORITY_CONFIG = {
  urgente: { label: 'URGENTE', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  alta: { label: 'ALTA', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  media: { label: 'MÉDIA', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  baixa: { label: 'BAIXA', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  agendada: { label: 'Agendada', color: 'bg-blue-100 text-blue-700', icon: 'schedule' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700', icon: 'play_circle' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700', icon: 'check_circle' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500', icon: 'cancel' },
  parcialmente_concluida: { label: 'Parcialmente Concluída', color: 'bg-amber-100 text-amber-700', icon: 'warning' },
  nao_realizada: { label: 'Não Realizada', color: 'bg-red-100 text-red-700', icon: 'cancel' },
};

// ============ CARD DE MISSÃO COM STATUS + OBSERVAÇÕES + AUDITORIA ============

const CardMissao: React.FC<{
  missao: DailyMission;
  isEditor: boolean;
  onAtualizar: () => void;
  onIniciar?: () => void;
  onExcluir?: () => void;
  onEditarCompleto?: (missao: DailyMission) => void;
}> = ({ missao, isEditor, onAtualizar, onIniciar, onExcluir, onEditarCompleto }) => {
  const [editando, setEditando] = useState(false);
  const [status, setStatus] = useState<StatusMissao>((missao.status as StatusMissao) || 'agendada');
  const [observacoes, setObservacoes] = useState(missao.observacoes || '');
  const [salvando, setSalvando] = useState(false);

  const cfgAtual = STATUS_MISSAO[status] || STATUS_MISSAO.agendada;
  const priorityCfg = PRIORITY_CONFIG[missao.priority || 'media'];

  async function handleSalvar() {
    setSalvando(true);
    try {
      await atualizarMissao(missao.id!, { status, observacoes });
      toast.success('Missão atualizada com sucesso!');
      setEditando(false);
      onAtualizar();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-rustic-border shadow-sm transition-all hover:shadow-md overflow-hidden">
      {/* CABEÇALHO */}
      <div
        className="flex flex-wrap items-start justify-between gap-3 p-5"
        style={{ borderLeft: `4px solid ${cfgAtual.cor}` }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: cfgAtual.fundo }}
          >
            {cfgAtual.icone}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#181111] text-base truncate">{missao.title}</p>
            {missao.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{missao.description}</p>
            )}
            {/* Endereço e Links de Mapa */}
            {(missao.location_address || missao.is_pbm_araquari) && (
              <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]">
                <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">location_on</span>
                  {missao.is_pbm_araquari ? 'PBM ARAQUARI' : missao.location_address}
                </span>
                {(missao.location_link || missao.location_address) && (
                  <a
                    href={missao.location_link || `https://maps.google.com/?q=${encodeURIComponent(missao.location_address!)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-bold flex items-center gap-0.5 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"
                  >
                    <span className="material-symbols-outlined text-[12px]">map</span>
                    Google Maps
                  </a>
                )}
                <a
                  href={missao.is_pbm_araquari
                    ? 'https://waze.com/ul?ll=-26.3752,-48.7214&navigate=yes'
                    : `https://waze.com/ul?q=${encodeURIComponent(missao.location_address!)}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 hover:underline font-bold flex items-center gap-0.5 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-100"
                >
                  <span className="material-symbols-outlined text-[12px]">navigation</span>
                  Waze
                </a>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityCfg.color}`}>
                {priorityCfg.label}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: cfgAtual.fundo, color: cfgAtual.cor }}
              >
                {cfgAtual.icone} {cfgAtual.label}
              </span>
              {missao.start_time && (
                <span className="text-[10px] text-gray-400 font-bold">
                  <span className="material-symbols-outlined text-[12px] align-middle">schedule</span>{' '}
                  {missao.start_time}{missao.end_time ? ` — ${missao.end_time}` : ''}
                </span>
              )}
              {missao.responsible_name && (
                <span className="text-[10px] text-gray-400 font-bold">
                  <span className="material-symbols-outlined text-[12px] align-middle">person</span>{' '}
                  {missao.responsible_name}
                </span>
              )}
              {missao.chefe_socorro_nome && (
                <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-bold border border-red-100">
                  <span className="material-symbols-outlined text-[12px] align-middle">local_fire_department</span>{' '}
                  Chefe: {missao.chefe_socorro_nome}
                </span>
              )}
              {missao.completed_by && (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-100">
                  Concluído por: {missao.completed_by}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AÇÕES */}
        {isEditor && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEditarCompleto && (
              <button
                onClick={() => onEditarCompleto(missao)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                title="Editar dados completos da missão"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            )}
            {missao.status === 'agendada' && onIniciar && (
              <button
                onClick={onIniciar}
                className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                title="Iniciar missão"
              >
                <span className="material-symbols-outlined text-[20px]">play_circle</span>
              </button>
            )}
            {/* Botão de edição inline ✏️ — altera status/observações */}
            <button
              onClick={() => setEditando(!editando)}
              title="Editar status/resultado"
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
                onClick={onExcluir}
                className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                title="Excluir"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* OBSERVAÇÕES (somente leitura) */}
      {!editando && missao.observacoes && (
        <div className="px-5 py-3 bg-slate-50 border-t border-rustic-border text-sm text-slate-600">
          <span className="font-bold text-slate-700">Obs: </span>
          {missao.observacoes}
        </div>
      )}

      {/* RODAPÉ DE AUDITORIA */}
      {!editando && missao.editado_por_nome && (
        <div className="px-5 py-2 bg-slate-50 border-t border-rustic-border flex items-center gap-1.5">
          <span className="text-[11px]">🔏</span>
          <span className="text-[11px] text-slate-400">
            Editado por{' '}
            <strong className="text-slate-500">{missao.editado_por_nome}</strong>
            {missao.editado_em && (
              <> em {new Date(missao.editado_em).toLocaleString('pt-BR')}</>
            )}
          </span>
        </div>
      )}

      {/* PAINEL DE EDIÇÃO */}
      {editando && (
        <div className="p-5 bg-slate-50 border-t border-rustic-border flex flex-col gap-4">

          {/* SELETOR DE RESULTADO */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Resultado da Missão
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATUS_RESULTADO.map((key) => {
                const cfg = STATUS_MISSAO[key];
                const selected = status === key;
                return (
                  <button
                    key={key}
                    onClick={() => setStatus(key)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      border: selected ? `2px solid ${cfg.cor}` : '2px solid #e2e8f0',
                      background: selected ? cfg.fundo : 'white',
                      color: selected ? cfg.cor : '#64748b',
                    }}
                  >
                    <span>{cfg.icone}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CAMPO OBSERVAÇÕES */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Descreva o resultado, ocorrências ou justificativas..."
              className="w-full px-3 py-2 rounded-lg border border-rustic-border text-sm font-normal resize-vertical focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              style={{ fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* BOTÕES */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setEditando(false); setStatus((missao.status as StatusMissao) || 'agendada'); setObservacoes(missao.observacoes || ''); }}
              disabled={salvando}
              className="px-4 py-2 text-sm font-bold border border-rustic-border bg-white rounded-lg hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg transition-all"
              style={{ background: salvando ? '#94a3b8' : '#1d4ed8', cursor: salvando ? 'not-allowed' : 'pointer' }}
            >
              {salvando ? '⏳ Salvando...' : '✅ Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

type MainTab = 'resumo' | 'missoes' | 'conferencia' | 'cautelas' | 'recebimentos';

// ============ MAIN COMPONENT ============

const Operacional: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>('resumo');
  const { user, profile } = useAuth();
  const isEditor = profile?.p_operacional === 'editor';

  // Shared data states
  const [loading, setLoading] = useState(false);

  // Receipt states
  const [receipts, setReceipts] = useState<ProductReceipt[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptNF, setReceiptNF] = useState("");
  const [receiptObs, setReceiptObs] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Daily Missions states
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [missionToEdit, setMissionToEdit] = useState<DailyMission | null>(null);
  const [missionForm, setMissionForm] = useState({
    title: '', description: '', mission_date: new Date().toISOString().split('T')[0],
    start_time: '', end_time: '', priority: 'media' as DailyMission['priority'],
    responsible_name: '', status: 'agendada' as DailyMission['status'],
  });
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [missionFilter, setMissionFilter] = useState<string>('all');

  // Notification modal
  const [notifModal, setNotifModal] = useState<{ open: boolean; data: any; type: 'receipt' | 'conference' }>({ open: false, data: null, type: 'receipt' });

  // ============ DATA LOADING ============

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, missionsData, trainingsData] = await Promise.all([
        SupabaseService.getProductsReceipts(),
        SupabaseService.getDailyMissions({ data: missionForm.mission_date }),
        SupabaseService.getTrainings(),
      ]);
      setReceipts(recs);
      setMissions(missionsData);
      setTrainings(trainingsData.filter(t => t.status === 'Scheduled' || t.status === 'Canceled' || t.status === 'Cancelado'));
    } catch (error) {
      console.error("Error loading operational data:", error);
    } finally {
      setLoading(false);
    }
  }, [missionForm.mission_date]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  // ============ MISSION HANDLERS ============

  const handleAddMission = useCallback(async () => {
    if (!missionForm.title) return toast.error("Título da missão é obrigatório!");
    setLoading(true);
    try {
      await SupabaseService.addDailyMission({
        ...missionForm,
        created_by: user?.email || 'N/A',
      });
      toast.success("Missão criada com sucesso!");
      setMissionForm(prev => ({ ...prev, title: '', description: '', start_time: '', end_time: '', responsible_name: '' }));
      setShowMissionForm(false);
      loadAllData();
    } catch (error) {
      console.error("Error adding mission:", error);
      toast.error("Erro ao criar missão.");
    } finally {
      setLoading(false);
    }
  }, [missionForm, user?.email, loadAllData]);

  const handleUpdateMissionStatus = useCallback(async (id: string, status: DailyMission['status']) => {
    try {
      await SupabaseService.updateDailyMission(id, { status });
      toast.success(`Missão ${STATUS_CONFIG[status].label.toLowerCase()}.`);
      loadAllData();
    } catch (error) {
      console.error("Error updating mission:", error);
      toast.error("Erro ao atualizar missão.");
    }
  }, [loadAllData]);

  const handleDeleteMission = useCallback(async (id: string) => {
    if (!confirm('Excluir esta missão?')) return;
    try {
      await SupabaseService.deleteDailyMission(id);
      toast.success('Missão excluída.');
      loadAllData();
    } catch {
      toast.error('Erro ao excluir missão.');
    }
  }, [loadAllData]);

  // ============ RECEIPT HANDLERS ============

  const handleRegisterReceipt = useCallback(async () => {
    if (!receiptFile || !receiptNF) {
      toast.error("Selecione uma foto e insira o Nº da Nota Fiscal.");
      return;
    }
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_${receiptFile.name}`;
      await SupabaseService.uploadFile('produto-fotos', fileName, receiptFile);
      const publicUrl = SupabaseService.getPublicUrl('produto-fotos', fileName);

      await SupabaseService.addProductReceipt({
        photo_url: publicUrl,
        fiscal_note_number: receiptNF,
        notes: receiptObs,
        receipt_date: new Date().toISOString()
      });

      toast.success("Recebimento registrado com sucesso!");

      // Show notification modal instead of auto-opening
      const notifData = NotificationService.getReceiptNotificationData({
        nf: receiptNF, obs: receiptObs, photoUrl: publicUrl, user: user?.email || 'N/A'
      });
      setNotifModal({ open: true, data: notifData, type: 'receipt' });

      setReceiptFile(null);
      setReceiptNF("");
      setReceiptObs("");
      loadAllData();
    } catch (error) {
      console.error("Error uploading product:", error);
      toast.error("Erro ao registrar recebimento.");
    } finally {
      setIsUploading(false);
    }
  }, [receiptFile, receiptNF, receiptObs, user?.email, loadAllData]);

  // ============ COMPUTED VALUES ============

  const filteredMissions = useMemo(() => {
    if (missionFilter === 'all') return missions;
    return missions.filter(m => m.status === missionFilter);
  }, [missions, missionFilter]);

  const todayTrainings = useMemo(() => {
    return trainings.filter(t => t.date === missionForm.mission_date);
  }, [trainings, missionForm.mission_date]);

  const unifiedMissions = useMemo(() => {
    const missionItems = filteredMissions.map(m => ({ type: 'mission' as const, data: m }));
    const trainingItems = todayTrainings.map(t => ({ type: 'training' as const, data: t }));
    return [...missionItems, ...trainingItems].sort((a, b) => {
      const timeA = a.type === 'mission' ? (a.data.start_time || '99:99') : (a.data as Training).time || '99:99';
      const timeB = b.type === 'mission' ? (b.data.start_time || '99:99') : (b.data as Training).time || '99:99';
      const timeCompare = timeA.localeCompare(timeB);
      if (timeCompare !== 0) return timeCompare;
      if (a.type === 'mission' && b.type === 'training') return -1;
      if (a.type === 'training' && b.type === 'mission') return 1;
      return 0;
    });
  }, [filteredMissions, todayTrainings]);

  const dashboardStats = useMemo(() => {
    const totalMissions = missions.length;
    const completedMissions = missions.filter(m => m.status === 'concluida').length;
    const activeMissions = missions.filter(m => m.status === 'em_andamento').length;
    return { totalMissions, completedMissions, activeMissions, recentReceipts: receipts.slice(0, 3) };
  }, [missions, receipts]);

  // ============ TAB CONFIG ============

  const TABS: { key: MainTab; label: string; icon: string; badge?: number }[] = [
    { key: 'resumo', label: 'Resumo', icon: 'dashboard' },
    { key: 'missoes', label: 'Missões do Dia', icon: 'target', badge: dashboardStats.activeMissions },
    { key: 'conferencia', label: 'Conferência', icon: 'checklist' },
    { key: 'cautelas', label: 'Cautelas', icon: 'assignment_return' },
    { key: 'recebimentos', label: 'Recebimentos', icon: 'local_shipping' },
  ];

  // ============ RENDER ============

  return (
    <div className="bg-background-light h-full w-full flex flex-col overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-rustic-border px-8 py-5 sticky top-0 z-20 shadow-sm/50">
        <div className="max-w-7xl mx-auto w-full flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[#181111] text-3xl font-black leading-tight tracking-[-0.033em]">Módulo Operacional</h1>
            <p className="text-[#886363] text-sm font-normal">Controle de Missões, Conferência e Recebimento</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-secondary-green/10 text-secondary-green rounded-full text-xs font-bold uppercase tracking-wider border border-secondary-green/20">
              Operacional Online
            </span>
            <button onClick={loadAllData} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-rustic-border transition-all" title="Atualizar dados">
              <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto w-full mt-4 flex gap-1 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all uppercase tracking-wider whitespace-nowrap ${activeTab === tab.key
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab.key ? 'bg-white/30 text-white' : 'bg-red-500 text-white'
                  }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full flex-1">

        {/* ========== TAB: RESUMO ========== */}
        {activeTab === 'resumo' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-rustic-border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-600">target</span>
                  </div>
                  <span className="text-2xl font-black text-[#181111]">{dashboardStats.totalMissions}</span>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase">Missões Hoje</p>
              </div>
              <div className="bg-white rounded-xl border border-rustic-border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                  </div>
                  <span className="text-2xl font-black text-[#181111]">{dashboardStats.completedMissions}</span>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase">Concluídas</p>
              </div>
              <div className="bg-white rounded-xl border border-rustic-border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-teal-600">receipt_long</span>
                  </div>
                  <span className="text-2xl font-black text-[#181111]">{receipts.length}</span>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase">Recebimentos</p>
              </div>
            </div>

            {/* Guarnição */}
            <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
              <div className="bg-gradient-to-r from-red-700 to-red-900 p-4 text-white flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined">groups</span> Guarnição do Dia
                </h3>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded">{new Date().toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="p-4">
                <GarrisonDisplay />
              </div>
            </section>

            {/* Active Missions + Trainings Quick View */}
            {(missions.filter(m => m.status !== 'concluida' && m.status !== 'cancelada').length > 0 || todayTrainings.length > 0) && (
              <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
                <div className="p-4 border-b border-rustic-border flex items-center justify-between">
                  <h3 className="text-sm font-black text-[#181111] uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">target</span>
                    Missões Ativas
                    {todayTrainings.length > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        +{todayTrainings.length} instrução
                      </span>
                    )}
                  </h3>
                  <button onClick={() => setActiveTab('missoes')} className="text-xs font-bold text-primary hover:underline">Ver todas →</button>
                </div>
                <div className="p-4 space-y-2">
                  {missions.filter(m => m.status !== 'concluida' && m.status !== 'cancelada').slice(0, 4).map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[m.priority || 'media'].dot}`}></div>
                      <span className="text-sm font-bold text-[#181111] flex-1">{m.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_CONFIG[m.status].color}`}>
                        {STATUS_CONFIG[m.status].label}
                      </span>
                    </div>
                  ))}
                  {todayTrainings.map(t => {
                    const isCanceled = t.status === 'Canceled' || t.status === 'Cancelado';
                    return (
                      <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isCanceled ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-blue-50 border-blue-100'}`}>
                        <span className={`material-symbols-outlined text-[18px] ${isCanceled ? 'text-gray-400' : 'text-blue-500'}`}>school</span>
                        <span className={`text-sm font-bold flex-1 ${isCanceled ? 'text-gray-500 line-through' : 'text-blue-900'}`}>
                          {(t.materia as any)?.name || 'Instrução'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCanceled ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isCanceled ? 'Cancelada' : t.time || 'Agendada'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recent Receipts Quick View */}
            {dashboardStats.recentReceipts.length > 0 && (
              <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
                <div className="p-4 border-b border-rustic-border flex items-center justify-between">
                  <h3 className="text-sm font-black text-[#181111] uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">local_shipping</span>
                    Últimos Recebimentos
                  </h3>
                  <button onClick={() => setActiveTab('recebimentos')} className="text-xs font-bold text-primary hover:underline">Ver todos →</button>
                </div>
                <div className="p-4 space-y-2">
                  {dashboardStats.recentReceipts.map(rec => (
                    <div key={rec.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <img src={rec.photo_url} className="w-10 h-10 rounded object-cover border border-gray-200" alt="Produto" loading="lazy" />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-[#181111]">NF: {rec.fiscal_note_number}</span>
                        <span className="text-[10px] text-gray-400 ml-2">{rec.receipt_date ? new Date(rec.receipt_date).toLocaleDateString('pt-BR') : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ========== TAB: MISSÕES DO DIA ========== */}
        {activeTab === 'missoes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={missionForm.mission_date}
                  onChange={e => setMissionForm(prev => ({ ...prev, mission_date: e.target.value }))}
                  className="h-10 px-3 rounded-xl border border-rustic-border bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20"
                />
                <select
                  value={missionFilter}
                  onChange={e => setMissionFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-rustic-border bg-white text-sm font-bold"
                >
                  <option value="all">Todos os Status</option>
                  <option value="agendada">Agendadas</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluida">Concluídas</option>
                  <option value="parcialmente_concluida">Parcialmente Concluídas</option>
                  <option value="nao_realizada">Não Realizadas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>
              {isEditor && (
                <Button variant="primary" size="md" icon="add" onClick={() => { setMissionToEdit(null); setShowMissionForm(true); }}>
                  Nova Missão
                </Button>
              )}
            </div>

            {/* Mission Form */}
            {showMissionForm && isEditor && (
              <section className="bg-white rounded-xl shadow-sm border border-rustic-border p-6 animate-in slide-in-from-top duration-300">
                <h3 className="text-sm font-black text-[#181111] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">edit_note</span> Nova Missão
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Input value={missionForm.title} onChange={v => setMissionForm(p => ({ ...p, title: v }))} placeholder="Título da Missão *" />
                  </div>
                  <div className="md:col-span-2">
                    <TextArea value={missionForm.description || ''} onChange={v => setMissionForm(p => ({ ...p, description: v }))} placeholder="Descrição (opcional)" rows={2} />
                  </div>
                  <Input value={missionForm.start_time} onChange={v => setMissionForm(p => ({ ...p, start_time: v }))} placeholder="Hora Início (ex: 08:00)" />
                  <Input value={missionForm.end_time} onChange={v => setMissionForm(p => ({ ...p, end_time: v }))} placeholder="Hora Fim (ex: 17:00)" />
                  <Input value={missionForm.responsible_name} onChange={v => setMissionForm(p => ({ ...p, responsible_name: v }))} placeholder="Responsável" />
                  <select
                    value={missionForm.priority}
                    onChange={e => setMissionForm(p => ({ ...p, priority: e.target.value as any }))}
                    className="h-12 px-4 rounded-xl border border-rustic-border bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="baixa">🟢 Baixa</option>
                    <option value="media">🟡 Média</option>
                    <option value="alta">🟠 Alta</option>
                    <option value="urgente">🔴 Urgente</option>
                  </select>
                </div>
                <div className="mt-4">
                  <Button variant="success" size="lg" fullWidth icon="save" onClick={handleAddMission} loading={loading}>
                    Criar Missão
                  </Button>
                </div>
              </section>
            )}

            {/* Missions + Trainings List */}
            <div className="space-y-3">
              {unifiedMissions.map((item, idx) => {
                // Render training item
                if (item.type === 'training') {
                  const t = item.data as Training;
                  const materiaName = (t.materia as any)?.name || t.materia_id || 'Instrução';
                  const isCanceled = t.status === 'Canceled' || t.status === 'Cancelado';
                  return (
                    <div key={`training-${t.id || idx}`} className={`rounded-xl border shadow-sm p-5 transition-all hover:shadow-md ${isCanceled ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-blue-50 border-blue-200'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isCanceled ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                            <span className="material-symbols-outlined">school</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-bold text-base truncate ${isCanceled ? 'text-gray-500 line-through' : 'text-blue-900'}`}>{materiaName}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isCanceled ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>Instrução</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCanceled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isCanceled ? 'Cancelada' : 'Agendada'}
                              </span>
                              {t.time && (
                                <span className="text-[10px] text-gray-500 font-bold">
                                  <span className="material-symbols-outlined text-[12px] align-middle">schedule</span> {t.time}
                                </span>
                              )}
                              {t.instructor && (
                                <span className="text-[10px] text-gray-500 font-bold">
                                  <span className="material-symbols-outlined text-[12px] align-middle">person</span> {t.instructor}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-blue-500 font-bold">Gerenciar em B3</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Render mission item
                const mission = item.data as DailyMission;

                return (
                  <CardMissao
                    key={`mission-${mission.id}`}
                    missao={mission}
                    isEditor={isEditor}
                    onAtualizar={loadAllData}
                    onEditarCompleto={(m) => {
                      setMissionToEdit(m);
                      setShowMissionForm(true);
                    }}
                    onIniciar={
                      mission.status === 'agendada'
                        ? () => handleUpdateMissionStatus(mission.id!, 'em_andamento')
                        : undefined
                    }
                    onExcluir={() => handleDeleteMission(mission.id!)}
                  />
                );
              })}

              {unifiedMissions.length === 0 && (
                <div className="text-center py-16">
                  <span className="material-symbols-outlined text-5xl text-gray-200 mb-3">event_busy</span>
                  <p className="text-sm text-gray-400 font-bold">Nenhuma missão ou instrução para este dia.</p>
                  {isEditor && <p className="text-xs text-gray-300 mt-1">Clique em &quot;Nova Missão&quot; para criar.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB: CONFERÊNCIA ========== */}
        {activeTab === 'conferencia' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <section className="bg-white rounded-xl shadow-sm border border-rustic-border">
              <div className="p-5 border-b border-rustic-border">
                <h3 className="text-lg font-bold text-[#181111] flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Conferência Diária do Serviço
                </h3>
                <p className="text-xs text-gray-400 mt-1">Viaturas → Compartimentos → Itens</p>
              </div>
              <div className="p-6">
                <ConferenciaDiaria />
              </div>
            </section>

            {/* Histórico B4 */}
            <section className="bg-white rounded-xl shadow-sm border border-rustic-border">
              <div className="p-5 border-b border-rustic-border">
                <h3 className="text-lg font-bold text-[#181111] flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600">history</span>
                  Histórico — Avarias e Não Encontrados
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Itens marcados como avariado ou não encontrado · Notificações WhatsApp e e-mail
                </p>
              </div>
              <div className="p-6">
                <HistoricoConferencias />
              </div>
            </section>
          </div>
        )}

        {/* ========== TAB: RECEBIMENTOS ========== */}
        {activeTab === 'cautelas' && (
          <div className="animate-in fade-in duration-300">
            <SecaoCautelasOperacional isEditor={isEditor} />
          </div>
        )}

        {activeTab === 'recebimentos' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
              <div className="bg-gradient-to-r from-rustic-brown to-[#4c2d27] p-5 text-white flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">local_shipping</span>
                  Recebimento de Produtos
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all relative overflow-hidden ${receiptFile ? 'border-secondary-green bg-green-50' : 'border-gray-300 bg-stone-50 hover:bg-stone-100'}`}>
                      {receiptFile ? (
                        <div className="flex flex-col items-center text-secondary-green">
                          <span className="material-symbols-outlined text-4xl mb-1">check_circle</span>
                          <span className="text-xs font-bold truncate max-w-[200px]">{receiptFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <span className="material-symbols-outlined text-4xl mb-1">add_a_photo</span>
                          <span className="text-xs font-medium">Foto dos Produtos</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files && setReceiptFile(e.target.files[0])} />
                    </label>
                    <Input value={receiptNF} onChange={setReceiptNF} placeholder="Nº da Nota Fiscal" />
                    <TextArea value={receiptObs} onChange={setReceiptObs} placeholder="Observações (Opcional)" rows={3} />
                    {isEditor ? (
                      <Button onClick={handleRegisterReceipt} loading={isUploading} variant="success" size="lg" fullWidth icon={isUploading ? undefined : 'save'}>
                        {isUploading ? 'Registrando...' : 'Registrar Recebimento'}
                      </Button>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                        <span className="material-symbols-outlined text-amber-500 mb-2">lock</span>
                        <p className="text-xs font-black uppercase text-amber-700">Modo Leitura: Apenas p/ Editor</p>
                      </div>
                    )}
                  </div>

                  {/* Recent Receipts */}
                  <div className="h-full">
                    <h4 className="text-sm font-bold text-rustic-brown mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">history</span>
                      Recebimentos Recentes
                    </h4>
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                      {receipts.map(rec => (
                        <div key={rec.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-rustic-border/50">
                          <img src={rec.photo_url} className="w-16 h-16 rounded object-cover border border-gray-200" alt="Produto" loading="lazy" />
                          <div className="flex flex-col flex-1">
                            <span className="text-xs font-bold text-[#181111]">NF: {rec.fiscal_note_number}</span>
                            <span className="text-[10px] text-gray-500">{rec.receipt_date ? new Date(rec.receipt_date).toLocaleDateString('pt-BR') : 'N/A'}</span>
                            <span className="text-[10px] text-gray-400 mt-1 line-clamp-1">{rec.notes}</span>
                          </div>
                          {isEditor && (
                            <button
                              onClick={async () => {
                                if (!confirm('Excluir este recebimento?')) return;
                                try {
                                  await SupabaseService.deleteProductReceipt(rec.id!);
                                  toast.success('Recebimento excluído.');
                                  loadAllData();
                                } catch { toast.error('Erro ao excluir.'); }
                              }}
                              className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors flex-shrink-0"
                              title="Excluir recebimento"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      ))}
                      {receipts.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhum recebimento registrado.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notifModal.open}
        onClose={() => setNotifModal({ open: false, data: null, type: 'receipt' })}
        notificationData={notifModal.data}
        type={notifModal.type}
      />

      {/* Daily Mission Modal (Criação e Edição) */}
      <DailyMissionModal
        isOpen={showMissionForm}
        initialData={missionToEdit}
        titleText={missionToEdit ? 'Editar Missão Diária' : 'Nova Missão Diária'}
        onClose={() => {
          setShowMissionForm(false);
          setMissionToEdit(null);
        }}
        onSave={async (missionData) => {
          if (missionToEdit?.id) {
            // Edição
            await SupabaseService.updateDailyMission(missionToEdit.id, {
              ...missionData,
              editado_por_nome: (profile as any)?.name || (profile as any)?.war_name || user?.email || 'Usuário Operacional',
              editado_por_id: user?.id || undefined,
              editado_em: new Date().toISOString(),
            });
            toast.success('Missão atualizada!');
          } else {
            // Criação
            await SupabaseService.addDailyMission({
              ...missionData,
              created_by: user?.email || 'N/A',
            });
            toast.success('Missão cadastrada!');
          }
          setShowMissionForm(false);
          setMissionToEdit(null);
          loadAllData();
        }}
      />
    </div>
  );
};

export default Operacional;