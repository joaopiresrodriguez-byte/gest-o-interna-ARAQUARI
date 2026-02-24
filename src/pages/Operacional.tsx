import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SupabaseService, ProductReceipt, ChecklistItem, DailyMission } from '../services/SupabaseService';
import { NotificationService } from '../services/NotificationService';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button, Input, TextArea } from '../components/ui';

// ============ SUB-COMPONENTS ============

const GarrisonDisplay = () => {
  const [escala, setEscala] = useState<any>(null);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscala = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [escalaData, personnelData] = await Promise.all([
          SupabaseService.getEscalaByDate(today),
          SupabaseService.getPersonnel()
        ]);
        setEscala(escalaData);
        setPersonnel(personnelData);
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-rustic-brown">Equipe:</span>
        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-black uppercase">{escala.equipe}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {escala.militares?.map((id: number) => {
          const p = personnel.find(px => px.id === id);
          return p ? (
            <div key={id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="w-8 h-8 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${p.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'})` }}></div>
              <div className="leading-tight">
                <p className="text-[10px] font-black text-primary uppercase">{p.rank}</p>
                <p className="text-xs font-bold text-gray-700">{p.war_name || p.name.split(' ')[0]}</p>
              </div>
            </div>
          ) : null;
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

const STATUS_CONFIG = {
  agendada: { label: 'Agendada', color: 'bg-blue-100 text-blue-700', icon: 'schedule' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700', icon: 'play_circle' },
  concluida: { label: 'Concluída', color: 'bg-green-100 text-green-700', icon: 'check_circle' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500', icon: 'cancel' },
};

type MainTab = 'resumo' | 'missoes' | 'conferencia' | 'recebimentos';

// ============ MAIN COMPONENT ============

const Operacional: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>('resumo');
  const { user, profile } = useAuth();
  const isEditor = profile?.p_operacional === 'editor';

  // Shared data states
  const [loading, setLoading] = useState(false);
  const [fleet, setFleet] = useState<{ id: string; name: string }[]>([]);

  // Checklist states
  const [activeChecklistTab, setActiveChecklistTab] = useState<'materiais' | 'equipamentos' | 'viaturas'>('materiais');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [selectedViaturaId, setSelectedViaturaId] = useState<string>("");
  const [reportStatuses, setReportStatuses] = useState<Record<string, { status: 'ok' | 'faltante'; obs: string }>>({});

  // Receipt states
  const [receipts, setReceipts] = useState<ProductReceipt[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptNF, setReceiptNF] = useState("");
  const [receiptObs, setReceiptObs] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Daily Missions states
  const [missions, setMissions] = useState<DailyMission[]>([]);
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
      const [items, recs, fleetData, missionsData] = await Promise.all([
        SupabaseService.getChecklistItems(activeChecklistTab, selectedViaturaId),
        SupabaseService.getProductsReceipts(),
        SupabaseService.getFleet(),
        SupabaseService.getDailyMissions({ data: missionForm.mission_date }),
      ]);
      setChecklistItems(items);
      setReceipts(recs);
      setFleet(fleetData.filter(v => v.type === 'Viatura'));
      setMissions(missionsData);

      const initial: typeof reportStatuses = {};
      items.forEach(it => {
        if (!reportStatuses[it.id]) {
          initial[it.id] = { status: 'ok', obs: '' };
        }
      });
      setReportStatuses(prev => ({ ...initial, ...prev }));
    } catch (error) {
      console.error("Error loading operational data:", error);
    } finally {
      setLoading(false);
    }
  }, [activeChecklistTab, selectedViaturaId, missionForm.mission_date]);

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

  // ============ CHECKLIST HANDLERS ============

  const updateReportStatus = useCallback((id: string, status: 'ok' | 'faltante', obs?: string) => {
    setReportStatuses(prev => ({
      ...prev,
      [id]: { ...prev[id], status, obs: obs !== undefined ? obs : prev[id].obs }
    }));
  }, []);

  const handleSaveChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const promises = checklistItems.map(item => {
        const report = reportStatuses[item.id];
        return SupabaseService.saveDailyChecklist({
          item_id: item.id,
          viatura_id: selectedViaturaId || item.viatura_id,
          status: report.status as any,
          notes: report.obs,
          responsible: user?.email || "Usuário não identificado"
        });
      });
      await Promise.all(promises);
      toast.success("Conferência salva com sucesso!", {
        description: "As pendências foram enviadas ao módulo B4."
      });

      // Show notification modal instead of auto-opening
      const notifData = NotificationService.getConferenceNotificationData({
        responsible: user?.email || "N/A",
        viatura: fleet.find(v => v.id === selectedViaturaId)?.name,
        items: checklistItems,
        statuses: reportStatuses
      });
      setNotifModal({ open: true, data: notifData, type: 'conference' });

      loadAllData();
    } catch (error) {
      console.error("Error saving checklist:", error);
      toast.error("Erro ao salvar conferência.");
    } finally {
      setLoading(false);
    }
  }, [checklistItems, reportStatuses, selectedViaturaId, user?.email, fleet, loadAllData]);

  // ============ COMPUTED VALUES ============

  const filteredMissions = useMemo(() => {
    if (missionFilter === 'all') return missions;
    return missions.filter(m => m.status === missionFilter);
  }, [missions, missionFilter]);

  const dashboardStats = useMemo(() => {
    const totalMissions = missions.length;
    const completedMissions = missions.filter(m => m.status === 'concluida').length;
    const activeMissions = missions.filter(m => m.status === 'em_andamento').length;
    const checkedItems = Object.values(reportStatuses).filter(r => r.status === 'ok').length;
    const totalItems = checklistItems.length;
    const pendingItems = Object.values(reportStatuses).filter(r => r.status === 'faltante').length;
    return { totalMissions, completedMissions, activeMissions, checkedItems, totalItems, pendingItems, recentReceipts: receipts.slice(0, 3) };
  }, [missions, reportStatuses, checklistItems, receipts]);

  const checklistProgress = useMemo(() => {
    if (checklistItems.length === 0) return 0;
    const done = Object.keys(reportStatuses).length;
    return Math.round((done / checklistItems.length) * 100);
  }, [checklistItems, reportStatuses]);

  // ============ TAB CONFIG ============

  const TABS: { key: MainTab; label: string; icon: string; badge?: number }[] = [
    { key: 'resumo', label: 'Resumo', icon: 'dashboard' },
    { key: 'missoes', label: 'Missões do Dia', icon: 'target', badge: dashboardStats.activeMissions },
    { key: 'conferencia', label: 'Conferência', icon: 'checklist', badge: dashboardStats.pendingItems },
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
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600">inventory_2</span>
                  </div>
                  <span className="text-2xl font-black text-[#181111]">{dashboardStats.checkedItems}/{dashboardStats.totalItems}</span>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase">Itens Conferidos</p>
              </div>
              <div className="bg-white rounded-xl border border-rustic-border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-600">receipt_long</span>
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

            {/* Active Missions Quick View */}
            {missions.filter(m => m.status !== 'concluida' && m.status !== 'cancelada').length > 0 && (
              <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
                <div className="p-4 border-b border-rustic-border flex items-center justify-between">
                  <h3 className="text-sm font-black text-[#181111] uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">target</span>
                    Missões Ativas
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
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>
              {isEditor && (
                <Button variant="primary" size="md" icon="add" onClick={() => setShowMissionForm(!showMissionForm)}>
                  {showMissionForm ? 'Cancelar' : 'Nova Missão'}
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

            {/* Missions List */}
            <div className="space-y-3">
              {filteredMissions.map(mission => {
                const priorityCfg = PRIORITY_CONFIG[mission.priority || 'media'];
                const statusCfg = STATUS_CONFIG[mission.status];

                return (
                  <div key={mission.id} className="bg-white rounded-xl border border-rustic-border shadow-sm p-5 transition-all hover:shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusCfg.color}`}>
                          <span className="material-symbols-outlined">{statusCfg.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#181111] text-base truncate">{mission.title}</p>
                          {mission.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{mission.description}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityCfg.color}`}>{priorityCfg.label}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusCfg.color}`}>{statusCfg.label}</span>
                            {mission.start_time && (
                              <span className="text-[10px] text-gray-400 font-bold">
                                <span className="material-symbols-outlined text-[12px] align-middle">schedule</span> {mission.start_time}{mission.end_time ? ` — ${mission.end_time}` : ''}
                              </span>
                            )}
                            {mission.responsible_name && (
                              <span className="text-[10px] text-gray-400 font-bold">
                                <span className="material-symbols-outlined text-[12px] align-middle">person</span> {mission.responsible_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status buttons */}
                      {isEditor && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {mission.status === 'agendada' && (
                            <button onClick={() => handleUpdateMissionStatus(mission.id!, 'em_andamento')} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Iniciar">
                              <span className="material-symbols-outlined text-[20px]">play_circle</span>
                            </button>
                          )}
                          {mission.status === 'em_andamento' && (
                            <button onClick={() => handleUpdateMissionStatus(mission.id!, 'concluida')} className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Concluir">
                              <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            </button>
                          )}
                          {(mission.status === 'agendada' || mission.status === 'em_andamento') && (
                            <button onClick={() => handleUpdateMissionStatus(mission.id!, 'cancelada')} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Cancelar">
                              <span className="material-symbols-outlined text-[20px]">cancel</span>
                            </button>
                          )}
                          <button onClick={() => handleDeleteMission(mission.id!)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors" title="Excluir">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredMissions.length === 0 && (
                <div className="text-center py-16">
                  <span className="material-symbols-outlined text-5xl text-gray-200 mb-3">event_busy</span>
                  <p className="text-sm text-gray-400 font-bold">Nenhuma missão encontrada para este dia.</p>
                  {isEditor && <p className="text-xs text-gray-300 mt-1">Clique em "Nova Missão" para criar.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB: CONFERÊNCIA ========== */}
        {activeTab === 'conferencia' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <section className="bg-white rounded-xl shadow-sm border border-rustic-border flex flex-col">
              <div className="p-6 pb-0 border-b border-rustic-border">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-bold text-[#181111] flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">analytics</span>
                    Conferência Diária do Serviço
                  </h3>
                  <div className="flex gap-2">
                    {(['materiais', 'equipamentos', 'viaturas'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveChecklistTab(tab)}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-wider ${activeChecklistTab === tab ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vehicle filter */}
                <div className="flex flex-col gap-2 p-4 bg-stone-50 rounded-xl border border-rustic-border/50 mb-2">
                  <label className="text-[10px] font-black uppercase text-rustic-brown/60 ml-1">Conferir Viatura Específica (Filtrar Materiais)</label>
                  <div className="flex gap-3">
                    <select
                      value={selectedViaturaId}
                      onChange={e => setSelectedViaturaId(e.target.value)}
                      className="flex-1 h-11 px-4 rounded-xl border border-rustic-border bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">Todos os Materiais / Sem Viatura Específica</option>
                      {fleet.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    {selectedViaturaId && (
                      <button onClick={() => setSelectedViaturaId("")} className="px-4 py-2 text-primary font-bold text-xs hover:bg-red-50 rounded-lg transition-all">
                        LIMPAR FILTRO
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#fcfbfb]">
                {/* Progress Bar */}
                {checklistItems.length > 0 && (
                  <div className="mb-4 p-3 bg-white rounded-lg border border-rustic-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-gray-400">Progresso da Conferência</span>
                      <span className="text-xs font-black text-[#181111]">{Object.keys(reportStatuses).length} / {checklistItems.length} itens</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-secondary-green rounded-full transition-all duration-500" style={{ width: `${checklistProgress}%` }}></div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {checklistItems.map(item => (
                    <div key={item.id} className="bg-white rounded-xl border border-rustic-border shadow-sm p-4 transition-all hover:bg-gray-50">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeChecklistTab === 'viaturas' ? 'bg-blue-100 text-blue-600' : activeChecklistTab === 'equipamentos' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                            <span className="material-symbols-outlined">{activeChecklistTab === 'viaturas' ? 'emergency' : activeChecklistTab === 'equipamentos' ? 'construction' : 'inventory_2'}</span>
                          </div>
                          <div>
                            <p className="font-bold text-[#181111] text-base">{item.item_name}</p>
                            <span className="text-[10px] text-gray-400 font-bold uppercase">{item.category}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => updateReportStatus(item.id, 'ok')}
                            variant={reportStatuses[item.id]?.status === 'ok' ? 'success' : 'ghost'}
                            size="sm"
                            icon="check_circle"
                          >
                            DISPONÍVEL
                          </Button>
                          <Button
                            onClick={() => updateReportStatus(item.id, 'faltante')}
                            variant={reportStatuses[item.id]?.status === 'faltante' ? 'primary' : 'ghost'}
                            size="sm"
                            icon="report"
                          >
                            FALTANTE
                          </Button>
                        </div>
                      </div>

                      {reportStatuses[item.id]?.status === 'faltante' && (
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 animate-in fade-in duration-300">
                          <label className="text-xs font-bold text-primary block mb-2">Relatar Pendência</label>
                          <input
                            type="text"
                            value={reportStatuses[item.id].obs}
                            onChange={e => updateReportStatus(item.id, 'faltante', e.target.value)}
                            placeholder="Ex: Equipamento em manutenção..."
                            className="w-full h-10 px-3 rounded-lg border border-primary/30 bg-red-50/20 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {checklistItems.length === 0 && <p className="text-center py-12 text-gray-400">Nenhum item cadastrado para esta categoria.</p>}

                  {checklistItems.length > 0 && (
                    isEditor ? (
                      <Button onClick={handleSaveChecklist} loading={loading} variant="primary" size="lg" fullWidth icon={loading ? undefined : 'task_alt'} className="mt-4">
                        {loading ? 'SALVANDO...' : 'FINALIZAR E ENVIAR CONFERÊNCIA'}
                      </Button>
                    ) : (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-center">
                        <span className="material-symbols-outlined text-amber-500 mb-2">lock</span>
                        <p className="text-xs font-black uppercase text-amber-700">Você não tem permissão para enviar a conferência.</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ========== TAB: RECEBIMENTOS ========== */}
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
    </div>
  );
};

export default Operacional;