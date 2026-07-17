import React, { useState, useEffect } from 'react';
import { SupabaseService, Vehicle, PendingNotice, Purchase, DailyMission, Personnel, DailyChecklist } from '../services/SupabaseService';
import { toast } from 'sonner';
import { useRealtimeNotices } from '../hooks/useRealtimeNotices';
import { useAuth } from '../context/AuthContext';
import RelatoriosMensais from '../components/b4/RelatoriosMensais';

// ─── Helper sub-components ───────────────────────────────────────────────────

const Detail: React.FC<{ label: string; value?: string; icon?: string }> = ({ label, value, icon }) => (
  <div className="bg-stone-50 border border-rustic-border/60 rounded-lg p-3">
    <p className="text-[9px] font-black uppercase tracking-wider text-rustic-brown/40 mb-0.5">{label}</p>
    <p className="text-sm font-bold text-rustic-brown flex items-center gap-1">
      {icon && <span className="material-symbols-outlined text-[14px] text-rustic-brown/50">{icon}</span>}
      {value || '—'}
    </p>
  </div>
);

interface ItemCardProps {
  item: Vehicle;
  notices: PendingNotice[];
  profile: any;
  onSelect: (item: Vehicle) => void;
  onDelete: (id: string) => void;
  onResolve: (id: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, notices, profile, onSelect, onDelete, onResolve }) => {
  const itemNotices = notices.filter(n => n.status === 'pendente' && (n.viatura_id === item.id || n.description.includes(item.name)));

  return (
    <div
      className="bg-white rounded-xl border border-rustic-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer relative group"
      onClick={() => onSelect(item)}
    >
      {/* Click hint */}
      <span className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity material-symbols-outlined text-rustic-brown/30 text-[18px]">open_in_full</span>

      <div className="flex justify-between items-start mb-3">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {item.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] font-bold text-rustic-brown/30 font-mono">{item.type}</span>
          {profile?.p_logistica === 'editor' && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(item.id); }}
              className="text-gray-300 hover:text-red-500 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
      </div>

      <h3 className="text-base font-bold mb-1 leading-tight">{item.name}</h3>
      <p className="text-xs text-rustic-brown/60 mb-3 line-clamp-2">{item.details}</p>

      {/* Atividades badges */}
      {item.atividades && item.atividades.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 items-center">
          {item.atividades.slice(0, 2).map((at, idx) => (
            <span key={idx} className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              {at}
            </span>
          ))}
          {item.atividades.length > 2 && (
            <span className="text-[9px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full border border-stone-200">
              +{item.atividades.length - 2} mais
            </span>
          )}
        </div>
      )}

      {/* Badges: placa, marca, local, ano */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.plate && <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{item.plate}</span>}
        {item.brand && <span className="text-[9px] font-bold bg-stone-100 text-gray-600 px-2 py-0.5 rounded">{item.brand}</span>}
        {item.location && (
          <span className="text-[9px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[12px]">location_on</span>{item.location}
          </span>
        )}
        {item.year && <span className="text-[9px] font-bold bg-stone-100 text-gray-500 px-2 py-0.5 rounded">{item.year}</span>}
      </div>

      {/* Alerts */}
      {itemNotices.length > 0 && (
        <div className="mt-2 space-y-2">
          {itemNotices.map(notice => (
            <div key={notice.id} className="bg-red-50 border border-primary/20 rounded-lg p-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">warning</span>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-primary">{notice.description}</p>
                  {profile?.p_logistica === 'editor' && (
                    <button
                      onClick={e => { e.stopPropagation(); onResolve(notice.id!); }}
                      className="mt-1 text-[9px] font-bold text-white bg-primary px-2 py-0.5 rounded hover:bg-red-700"
                    >
                      MARCAR COMO RESOLVIDO
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const PatrimonioB4: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'cadastro' | 'listagem' | 'compras' | 'missoes' | 'conferencias' | 'relatorios'>('missoes');
  const [searchTerm, setSearchTerm] = useState("");
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [initialNotices, setInitialNotices] = useState<PendingNotice[]>([]);
  const { notices } = useRealtimeNotices(initialNotices);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dailyMissions, setDailyMissions] = useState<DailyMission[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [dailyChecklists, setDailyChecklists] = useState<DailyChecklist[]>([]);
  const [loading, setLoading] = useState(false);

  // Manual Purchase State
  const [showManualPurchase, setShowManualPurchase] = useState(false);
  const [manualPurchaseItem, setManualPurchaseItem] = useState("");
  const [manualPurchaseReason, setManualPurchaseReason] = useState("");

  // Form State for Manual Entry (Vehicles)
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState<Vehicle['type']>('Equipamento');
  const [newItemStatus] = useState<Vehicle['status']>('active');
  const [newItemDetails, setNewItemDetails] = useState("");
  const [newItemViaturaId, setNewItemViaturaId] = useState("");
  // Viatura-specific fields
  const [newItemBrand, setNewItemBrand] = useState("");
  const [newItemPlate, setNewItemPlate] = useState("");
  const [newItemRenavam, setNewItemRenavam] = useState("");
  const [newItemChassis, setNewItemChassis] = useState("");
  const [newItemYear, setNewItemYear] = useState("");
  const [newItemOilType, setNewItemOilType] = useState("");
  const [newItemLocation, setNewItemLocation] = useState("");
  // Equipamento-specific fields
  const [newItemNfNumber, setNewItemNfNumber] = useState("");
  // Common patrimônio fields
  const [newItemPatrimonioNumber, setNewItemPatrimonioNumber] = useState("");
  const [newItemPatrimonioType, setNewItemPatrimonioType] = useState("");
  const [newItemAtividades, setNewItemAtividades] = useState<string[]>([]);

  // Plate mask (AAA-0A00 Mercosul format)
  const applyPlateMask = (value: string) => {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]{3})(\d.*)$/, '$1-$2').slice(0, 8);
  };

  // Mission Form State
  const [missionTitle, setMissionTitle] = useState("");
  const [missionDesc, setMissionDesc] = useState("");
  const [missionDate, setMissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [missionStart, setMissionStart] = useState("");
  const [missionEnd, setMissionEnd] = useState("");
  const [missionRespId, setMissionRespId] = useState("");
  const [missionPriority, setMissionPriority] = useState<DailyMission['priority']>('media');
  const [missionStatus, setMissionStatus] = useState<DailyMission['status']>('agendada');
  const [missionObs, setMissionObs] = useState("");

  // Filters for Missions
  const [missionFilterStatus, setMissionFilterStatus] = useState<string>("todos");
  const [missionFilterPriority, setMissionFilterPriority] = useState<string>("todos");

  // Listing filters & grouping
  const [filterAtividade, setFilterAtividade] = useState<string>("todos");
  const [filterLocation, setFilterLocation] = useState<string>("todos");
  const [groupByAtividade, setGroupByAtividade] = useState<boolean>(false);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState<Vehicle | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fleetData, noticesData, purchasesData, missionsData, personnelData, checklistsData] = await Promise.all([
        SupabaseService.getFleet(),
        SupabaseService.getPendingNotices(),
        SupabaseService.getPurchases(),
        SupabaseService.getDailyMissions(),
        SupabaseService.getPersonnel(),
        SupabaseService.getDailyChecklists()
      ]);
      setFleet(fleetData);
      setInitialNotices(noticesData);
      setPurchases(purchasesData);
      setDailyMissions(missionsData);
      setPersonnel(personnelData);
      setDailyChecklists(checklistsData);
    } catch (error) {
      console.error("Error loading B4 data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveNotice = async (id: string) => {
    try {
      await SupabaseService.resolveNotice(id);
      toast.success("Pendência marcada como resolvida!");
      loadData();
    } catch {
      toast.error("Erro ao resolver pendência.");
    }
  };

  const handleCreatePurchaseRequest = async (notice: PendingNotice) => {
    try {
      await SupabaseService.addPurchase({
        item: notice.description.replace('Faltante: ', '').replace(' reportado na conferência diária.', ''),
        quantity: 1,
        unit_price: 0,
        status: 'Pendente',
        requester: 'Sistema Automático (B4)'
      });
      await SupabaseService.resolveNotice(notice.id!);
      toast.success("Solicitação de compra criada!");
      setActiveTab('compras');
      loadData();
    } catch {
      toast.error("Erro ao criar solicitação.");
    }
  };

  const handleManualPurchase = async () => {
    if (!manualPurchaseItem) return toast.error("Nome do item é obrigatório");

    try {
      await SupabaseService.addPurchase({
        item: manualPurchaseItem,
        quantity: 1,
        unit_price: 0,
        status: 'Pendente',
        requester: `Manual (B4) - ${manualPurchaseReason || 'Sem motivo'}`
      });
      toast.success("Solicitação de compra manual criada!");
      setManualPurchaseItem("");
      setManualPurchaseReason("");
      setShowManualPurchase(false);
      loadData();
    } catch {
      toast.error("Erro ao criar solicitação manual.");
    }
  };

  const handleSaveItem = async () => {
    if (!newItemName) return toast.error("Nome é obrigatório!");

    const itemId = `ITEM-${Date.now()}`;

    // 1. Add to Fleet (Patrimony)
    const newItem: Vehicle = {
      id: itemId,
      name: newItemName,
      type: newItemType,
      status: newItemStatus,
      details: newItemDetails || "Sem detalhes adicionais",
      brand: newItemBrand || undefined,
      plate: newItemPlate || undefined,
      renavam: newItemRenavam || undefined,
      chassis: newItemChassis || undefined,
      year: newItemYear || undefined,
      oil_type: newItemOilType || undefined,
      location: newItemLocation || undefined,
      nf_number: newItemNfNumber || undefined,
      patrimonio_number: newItemPatrimonioNumber || undefined,
      patrimonio_type: newItemPatrimonioType || undefined,
      atividades: newItemAtividades,
    };

    try {
      await SupabaseService.addVehicle(newItem);

      // Sync is triggered automatically via Supabase DB webhook → Edge Function

      // 2. If it's an Equipment, Viatura or Material, also add to Daily Conference (itens_conferencia)
      // This links it to the Operational module
      if (newItemType === 'Equipamento' || newItemType === 'Viatura' || newItemType === 'Material') {
        let categoryValue: 'materiais' | 'equipamentos' | 'viaturas' = 'materiais';
        if (newItemType === 'Equipamento') categoryValue = 'equipamentos';
        else if (newItemType === 'Viatura') categoryValue = 'viaturas';

        await SupabaseService.addChecklistItem({
          item_name: newItemName,
          category: categoryValue,
          viatura_id: newItemViaturaId || undefined,
          is_active: true,
          description: newItemDetails
        });
      }

      toast.success("Item salvo com sucesso!");
      setNewItemName("");
      setNewItemDetails("");
      setNewItemViaturaId("");
      setNewItemBrand("");
      setNewItemPlate("");
      setNewItemRenavam("");
      setNewItemChassis("");
      setNewItemYear("");
      setNewItemOilType("");
      setNewItemLocation("");
      setNewItemNfNumber("");
      setNewItemPatrimonioNumber("");
      setNewItemPatrimonioType("");
      setNewItemAtividades([]);
      setActiveTab('listagem');
      loadData();
    } catch (error: any) {
      console.error("Error saving item:", error);
      toast.error(`Erro ao salvar item: ${error.message || error.details || JSON.stringify(error)}`);
    }
  };

  const handleCreateMission = async () => {
    if (!missionTitle || !missionDate) return toast.error("Título e Data são obrigatórios!");

    const resp = personnel.find(p => p.id?.toString() === missionRespId);

    const newMission: DailyMission = {
      title: missionTitle,
      description: missionDesc,
      mission_date: missionDate,
      start_time: missionStart || undefined,
      end_time: missionEnd || undefined,
      responsible_id: missionRespId || undefined,
      responsible_name: resp ? `${resp.graduation || resp.rank || ''} ${resp.name}`.trim() : undefined,
      priority: missionPriority,
      status: missionStatus,
      notes: missionObs,
      created_by: "Administrador B4"
    };

    setLoading(true);
    try {
      await SupabaseService.addDailyMission(newMission);
      toast.success("Missão cadastrada com sucesso!");
      setMissionTitle("");
      setMissionDesc("");
      setMissionObs("");
      setMissionStart("");
      setMissionEnd("");
      setMissionRespId("");
      loadData();
    } catch (error) {
      console.error('Error creating mission:', error);
      toast.error("Erro ao cadastrar missão.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMissionStatus = async (id: string, status: DailyMission['status']) => {
    try {
      await SupabaseService.updateDailyMission(id, { status });
      toast.success(`Status atualizado para ${status.replace('_', ' ')}.`);
      loadData();
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDeleteMission = async (id: string) => {
    if (!confirm("Excluir esta missão?")) return;
    try {
      await SupabaseService.deleteDailyMission(id);
      toast.success('Missão excluída.');
      loadData();
    } catch {
      toast.error("Erro ao excluir missão.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm(`Remover item ${id} permanentemente?`)) return;
    try {
      await SupabaseService.deleteVehicle(id);
      toast.success('Item removido do patrimônio.');
      loadData();
    } catch {
      toast.error("Erro ao remover item.");
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (!confirm("Excluir registro de compra?")) return;
    try {
      await SupabaseService.deletePurchase(id);
      toast.success('Registro de compra excluído.');
      loadData();
    } catch {
      toast.error("Erro ao excluir compra.");
    }
  };

  const ATIVIDADES_LIST = [
    'Incêndio Urbano', 'Incêndio Florestal', 'Salvamento Terrestre',
    'Salvamento em Altura', 'Salvamento Aquático', 'APH',
    'Produtos Perigosos', 'Defesa Civil', 'Administrativo'
  ];

  const uniqueLocations = Array.from(
    new Set(fleet.map(i => i.location).filter(Boolean) as string[])
  ).sort();

  const filteredFleet = fleet.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAtividade =
      filterAtividade === 'todos' ||
      (item.atividades && item.atividades.includes(filterAtividade));
    const matchLocation =
      filterLocation === 'todos' ||
      (item.location && item.location === filterLocation);
    return matchSearch && matchAtividade && matchLocation;
  });

  // Group items by atividade
  const groupedFleet: Record<string, Vehicle[]> = {};
  if (groupByAtividade) {
    const semAtividade: Vehicle[] = [];
    filteredFleet.forEach(item => {
      if (!item.atividades || item.atividades.length === 0) {
        semAtividade.push(item);
      } else {
        item.atividades.forEach(at => {
          if (!groupedFleet[at]) groupedFleet[at] = [];
          groupedFleet[at].push(item);
        });
      }
    });
    if (semAtividade.length > 0) groupedFleet['Sem Atividade'] = semAtividade;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light relative text-rustic-brown">
      {/* Top Header */}
      <header className="h-16 bg-surface border-b border-rustic-border flex items-center justify-between px-8 flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-rustic-brown font-bold px-2 py-0.5 rounded-md bg-stone-100 border border-rustic-border/50">Logística e Patrimônio B4</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={loadData} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-rustic-brown hover:bg-stone-200 transition-all">
            <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
          <div className="relative">
            <span className="material-symbols-outlined text-rustic-brown/60">notifications</span>
            {notices.filter(n => n.status === 'pendente').length + dailyMissions.filter(m => m.priority === 'urgente' && m.status !== 'concluida').length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] flex items-center justify-center rounded-full border border-white font-bold">
                {notices.filter(n => n.status === 'pendente').length + dailyMissions.filter(m => m.priority === 'urgente' && m.status !== 'concluida').length}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-8">

          {/* Page Heading */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#3e2723]">Gestão Patrimonial</h1>
              <p className="text-rustic-brown/70 mt-1 max-w-2xl">Visualização de ativos, pendências operacionais e logística de compras.</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-surface rounded-xl shadow-sm border border-rustic-border overflow-hidden">
            <div className="border-b border-rustic-border bg-stone-50/50 px-6 pt-4 flex gap-8 overflow-x-auto">
              {(['missoes', 'listagem', 'cadastro', 'compras', 'conferencias', 'relatorios'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-col items-center gap-1 pb-3 border-b-[3px] font-bold text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-rustic-brown/40 hover:text-rustic-brown'}`}
                >
                  <span className="material-symbols-outlined">{tab === 'missoes' ? 'assignment' : tab === 'listagem' ? 'inventory' : tab === 'cadastro' ? 'add_box' : tab === 'compras' ? 'shopping_basket' : tab === 'relatorios' ? 'analytics' : 'checklist'}</span>
                  {tab === 'missoes' ? 'Missões Diárias' : tab === 'conferencias' ? 'Conferências' : tab === 'relatorios' ? 'Relatórios' : tab}
                </button>
              ))}
            </div>

            <div className="p-6 bg-surface min-h-[500px]">

              {activeTab === 'missoes' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  {/* Form Column */}
                  <div className="xl:col-span-4 space-y-6">
                    <div className="bg-stone-50 border border-rustic-border p-6 rounded-2xl shadow-inner">
                      <h3 className="font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">add_task</span> Nova Missão</h3>
                      {profile?.p_logistica === 'editor' ? (
                        <div className="space-y-4">
                          <input value={missionTitle} onChange={e => setMissionTitle(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm" placeholder="Título da Missão *" />
                          <textarea value={missionDesc} onChange={e => setMissionDesc(e.target.value)} className="w-full h-24 p-3 rounded-lg border border-rustic-border text-sm" placeholder="Descrição Detalhada" />
                          <div className="grid grid-cols-2 gap-4">
                            <input type="date" value={missionDate} onChange={e => setMissionDate(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm" />
                            <select value={missionPriority} onChange={e => setMissionPriority(e.target.value as any)} className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm">
                              <option value="baixa">Baixa</option>
                              <option value="media">Média</option>
                              <option value="alta">Alta</option>
                              <option value="urgente">Urgente</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <input type="time" value={missionStart} onChange={e => setMissionStart(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm" />
                            <input type="time" value={missionEnd} onChange={e => setMissionEnd(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm" />
                          </div>
                          <select value={missionRespId} onChange={e => setMissionRespId(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm">
                            <option value="">Selecionar Responsável</option>
                            {personnel.map(p => <option key={p.id} value={p.id}>{p.graduation || p.rank || ''} {p.name}</option>)}
                          </select>
                          <select value={missionStatus} onChange={e => setMissionStatus(e.target.value as any)} className="w-full h-10 px-3 rounded-lg border border-rustic-border text-sm">
                            <option value="agendada">Agendada</option>
                            <option value="em_andamento">Em Andamento</option>
                          </select>
                          <textarea value={missionObs} onChange={e => setMissionObs(e.target.value)} className="w-full h-20 p-3 rounded-lg border border-rustic-border text-sm" placeholder="Observações" />
                          <button onClick={handleCreateMission} className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all">
                            CADASTRAR MISSÃO
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-center">
                          <span className="material-symbols-outlined text-amber-500 mb-2">lock</span>
                          <p className="text-[10px] font-black uppercase text-amber-700">Apenas leitura</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* List Column */}
                  <div className="xl:col-span-8 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-rustic-border shadow-sm">
                      <div className="flex gap-4">
                        <select value={missionFilterStatus} onChange={e => setMissionFilterStatus(e.target.value)} className="h-9 px-3 rounded-lg border border-rustic-border text-xs font-bold bg-white">
                          <option value="todos">Todos Status</option>
                          <option value="agendada">Agendada</option>
                          <option value="em_andamento">Em Andamento</option>
                          <option value="concluida">Concluída</option>
                          <option value="cancelada">Cancelada</option>
                        </select>
                        <select value={missionFilterPriority} onChange={e => setMissionFilterPriority(e.target.value)} className="h-9 px-3 rounded-lg border border-rustic-border text-xs font-bold bg-white">
                          <option value="todos">Todas Prioridades</option>
                          <option value="baixa">Baixa</option>
                          <option value="media">Média</option>
                          <option value="alta">Alta</option>
                          <option value="urgente">Urgente</option>
                        </select>
                      </div>
                      <div className="text-[10px] font-black uppercase text-gray-400">Total: {dailyMissions.length} Missões</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[800px] pr-2">
                      {dailyMissions
                        .filter(m => (missionFilterStatus === 'todos' || m.status === missionFilterStatus))
                        .filter(m => (missionFilterPriority === 'todos' || m.priority === missionFilterPriority))
                        .map(mission => (
                          <div key={mission.id} className="bg-white border border-rustic-border rounded-xl p-4 hover:shadow-md transition-all flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${mission.priority === 'urgente' ? 'bg-red-100 text-red-600' :
                                mission.priority === 'alta' ? 'bg-orange-100 text-orange-600' :
                                  mission.priority === 'media' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600'
                                }`}>
                                {mission.priority}
                              </span>
                              <div className="flex gap-1">
                                {profile?.p_logistica === 'editor' && (
                                  <button onClick={() => handleDeleteMission(mission.id!)} className="text-gray-300 hover:text-red-500 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-bold text-sm leading-tight mb-1">{mission.title}</h4>
                              <p className="text-[11px] text-gray-500 line-clamp-2">{mission.description}</p>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 mt-1">
                              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> {new Date(mission.mission_date).toLocaleDateString('pt-BR')}</span>
                              {mission.start_time && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span> {mission.start_time}</span>}
                              {mission.responsible_name && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">person</span> {mission.responsible_name}</span>}
                            </div>
                            <div className="border-t border-stone-50 pt-3 flex items-center justify-between mt-auto">
                              <select
                                value={mission.status}
                                onChange={e => handleUpdateMissionStatus(mission.id!, e.target.value as any)}
                                className={`text-[10px] font-black border-none bg-stone-100 rounded-md px-2 py-1 outline-none ${mission.status === 'concluida' ? 'text-green-600' :
                                  mission.status === 'em_andamento' ? 'text-blue-600' :
                                    mission.status === 'cancelada' ? 'text-red-400' : 'text-gray-600'
                                  }`}
                              >
                                <option value="agendada">AGENDADA</option>
                                <option value="em_andamento">EM ANDAMENTO</option>
                                <option value="concluida">CONCLUÍDA</option>
                                <option value="cancelada">CANCELADA</option>
                              </select>
                              <span className="text-[9px] text-gray-300 italic">Cadastrado em {new Date(mission.created_at!).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'listagem' && (
                <div className="space-y-6">
                  {/* Filter Bar */}
                  <div className="flex flex-wrap gap-3 items-center p-4 bg-stone-50 border border-rustic-border rounded-xl">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rustic-brown/40 material-symbols-outlined text-[18px]">search</span>
                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-rustic-border bg-white text-sm"
                        placeholder="Buscar por nome ou tipo..."
                        type="text"
                      />
                    </div>

                    {/* Location Filter */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 material-symbols-outlined text-[16px]">location_on</span>
                      <select
                        value={filterLocation}
                        onChange={e => setFilterLocation(e.target.value)}
                        className="pl-8 pr-3 h-10 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown appearance-none cursor-pointer"
                      >
                        <option value="todos">Todas Localizações</option>
                        {uniqueLocations.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>

                    {/* Atividade Filter */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 material-symbols-outlined text-[16px]">local_fire_department</span>
                      <select
                        value={filterAtividade}
                        onChange={e => setFilterAtividade(e.target.value)}
                        className="pl-8 pr-3 h-10 rounded-lg border border-rustic-border bg-white text-xs font-bold text-rustic-brown appearance-none cursor-pointer"
                      >
                        <option value="todos">Todas Atividades</option>
                        {ATIVIDADES_LIST.map(at => (
                          <option key={at} value={at}>{at}</option>
                        ))}
                      </select>
                    </div>

                    {/* Group toggle */}
                    <button
                      onClick={() => setGroupByAtividade(p => !p)}
                      className={`flex items-center gap-1.5 px-3 h-10 rounded-lg border text-xs font-bold transition-all ${
                        groupByAtividade
                          ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                          : 'border-rustic-border bg-white text-rustic-brown hover:border-amber-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">category</span>
                      Agrupar por Atividade
                    </button>

                    <span className="ml-auto text-[10px] font-black uppercase text-gray-400">
                      {filteredFleet.length} item(s)
                    </span>
                  </div>

                  {/* Listing — flat or grouped */}
                  {groupByAtividade ? (
                    <div className="space-y-8">
                      {Object.entries(groupedFleet).map(([atividade, items]) => (
                        <div key={atividade}>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="material-symbols-outlined text-amber-600">local_fire_department</span>
                            <h3 className="font-black text-sm uppercase tracking-widest text-rustic-brown">{atividade}</h3>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{items.length}</span>
                            <div className="flex-1 h-px bg-rustic-border/40" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {items.map(item => <ItemCard key={item.id} item={item} notices={notices} profile={profile} onSelect={setSelectedItem} onDelete={handleDeleteItem} onResolve={handleResolveNotice} />)}
                          </div>
                        </div>
                      ))}
                      {Object.keys(groupedFleet).length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                          <span className="material-symbols-outlined text-[48px] mb-2">inventory_2</span>
                          <p className="text-sm font-bold">Nenhum item encontrado.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredFleet.map(item => (
                        <ItemCard key={item.id} item={item} notices={notices} profile={profile} onSelect={setSelectedItem} onDelete={handleDeleteItem} onResolve={handleResolveNotice} />
                      ))}
                      {filteredFleet.length === 0 && (
                        <div className="col-span-3 text-center py-16 text-gray-400">
                          <span className="material-symbols-outlined text-[48px] mb-2">search_off</span>
                          <p className="text-sm font-bold">Nenhum item encontrado.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detail Modal */}
                  {selectedItem && (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center p-4"
                      style={{ background: 'rgba(30,15,10,0.55)', backdropFilter: 'blur(4px)' }}
                      onClick={() => setSelectedItem(null)}
                    >
                      <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between p-6 border-b border-rustic-border">
                          <div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase mb-2 inline-block ${
                              selectedItem.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>{selectedItem.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                            <h2 className="text-2xl font-black text-[#3e2723] mt-1">{selectedItem.name}</h2>
                            <p className="text-xs text-rustic-brown/50 mt-0.5 font-mono">{selectedItem.id}</p>
                          </div>
                          <button
                            onClick={() => setSelectedItem(null)}
                            className="p-2 rounded-lg hover:bg-stone-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">

                          {/* Identificação */}
                          <section>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-3 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px]">info</span> Identificação
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              <Detail label="Tipo" value={selectedItem.type} />
                              {selectedItem.brand && <Detail label="Marca" value={selectedItem.brand} />}
                              {selectedItem.plate && <Detail label="Placa" value={selectedItem.plate} icon="directions_car" />}
                              {selectedItem.year && <Detail label="Ano" value={selectedItem.year} />}
                              {selectedItem.renavam && <Detail label="RENAVAM" value={selectedItem.renavam} />}
                              {selectedItem.chassis && <Detail label="Chassi" value={selectedItem.chassis} />}
                              {selectedItem.oil_type && <Detail label="Tipo de Óleo" value={selectedItem.oil_type} />}
                              {selectedItem.nf_number && <Detail label="Nº NF Compra" value={selectedItem.nf_number} />}
                            </div>
                          </section>

                          {/* Patrimônio */}
                          {(selectedItem.patrimonio_number || selectedItem.patrimonio_type) && (
                            <section>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-3 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">inventory</span> Patrimônio
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                {selectedItem.patrimonio_number && <Detail label="Número" value={selectedItem.patrimonio_number} />}
                                {selectedItem.patrimonio_type && <Detail label="Tipo" value={selectedItem.patrimonio_type} />}
                              </div>
                            </section>
                          )}

                          {/* Localização */}
                          {selectedItem.location && (
                            <section>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-green-700/80 mb-3 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">location_on</span> Localização Atual
                              </h4>
                              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                                <span className="material-symbols-outlined text-green-600 text-[28px]">location_on</span>
                                <span className="font-bold text-green-800 text-sm">{selectedItem.location}</span>
                              </div>
                            </section>
                          )}

                          {/* Atividades Operacionais */}
                          {selectedItem.atividades && selectedItem.atividades.length > 0 && (
                            <section>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700/80 mb-3 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">local_fire_department</span> Atividades Operacionais
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedItem.atividades.map((at, i) => (
                                  <span key={i} className="text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full">{at}</span>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Detalhes */}
                          {selectedItem.details && (
                            <section>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-rustic-brown/60 mb-3 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">description</span> Observações
                              </h4>
                              <p className="text-sm text-rustic-brown/80 bg-stone-50 rounded-xl p-4 border border-rustic-border leading-relaxed">{selectedItem.details}</p>
                            </section>
                          )}

                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-rustic-border flex justify-between items-center">
                          <span className="text-[10px] text-gray-400 font-mono">{selectedItem.id}</span>
                          {profile?.p_logistica === 'editor' && (
                            <button
                              onClick={() => { handleDeleteItem(selectedItem.id); setSelectedItem(null); }}
                              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-xs transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              Remover Item
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'cadastro' && (
                <div className="max-w-xl mx-auto bg-stone-50 border border-rustic-border p-8 rounded-2xl shadow-inner">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">add_circle</span>
                    Novo Cadastro
                  </h2>
                  <div className="space-y-4">
                    <input value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-rustic-border" placeholder="Nome do Item" />
                    <select value={newItemType} onChange={e => setNewItemType(e.target.value as any)} className="w-full h-11 px-4 rounded-lg border border-rustic-border">
                      <option value="Equipamento">Equipamento</option>
                      <option value="Material">Material (Conserto/Consumo)</option>
                      <option value="Viatura">Viatura</option>
                    </select>

                    {/* Viatura-specific fields */}
                    {newItemType === 'Viatura' && (
                      <div className="space-y-4 p-4 bg-white border border-rustic-border/50 rounded-xl shadow-sm">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 border-b border-primary/10 pb-2">Dados da Viatura</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Marca</label>
                            <input value={newItemBrand} onChange={e => setNewItemBrand(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Ex: Iveco, Ford" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Placa</label>
                            <input value={newItemPlate} onChange={e => setNewItemPlate(applyPlateMask(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="ABC-1D23" maxLength={8} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">RENAVAM</label>
                            <input value={newItemRenavam} onChange={e => setNewItemRenavam(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Número RENAVAM" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Chassi</label>
                            <input value={newItemChassis} onChange={e => setNewItemChassis(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Número do Chassi" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Ano</label>
                            <input value={newItemYear} onChange={e => setNewItemYear(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Ex: 2023" maxLength={4} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Tipo de Óleo</label>
                            <input value={newItemOilType} onChange={e => setNewItemOilType(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Ex: 15W40" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Localização Atual da Viatura</label>
                          <input value={newItemLocation} onChange={e => setNewItemLocation(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Ex: Quartel Araquari, Oficina, Manutenção" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Número de Patrimônio</label>
                            <input value={newItemPatrimonioNumber} onChange={e => setNewItemPatrimonioNumber(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Nº de Patrimônio" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Tipo de Patrimônio</label>
                            <select value={newItemPatrimonioType} onChange={e => setNewItemPatrimonioType(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm">
                              <option value="">Selecione...</option>
                              <option value="Municipal">Municipal</option>
                              <option value="Estadual">Estadual</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Equipamento-specific fields */}
                    {newItemType === 'Equipamento' && (
                      <div className="space-y-4 p-4 bg-white border border-rustic-border/50 rounded-xl shadow-sm">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 border-b border-primary/10 pb-2">Dados do Equipamento</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Marca</label>
                            <input value={newItemBrand} onChange={e => setNewItemBrand(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Marca do equipamento" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Nº NF de Compra</label>
                            <input value={newItemNfNumber} onChange={e => setNewItemNfNumber(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Número da Nota Fiscal" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Localização Atual do Equipamento</label>
                          <input value={newItemLocation} onChange={e => setNewItemLocation(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Ex: Viatura ABT-01, Quartel, Empréstimo" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Número de Patrimônio</label>
                            <input value={newItemPatrimonioNumber} onChange={e => setNewItemPatrimonioNumber(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm" placeholder="Nº de Patrimônio" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Tipo de Patrimônio</label>
                            <select value={newItemPatrimonioType} onChange={e => setNewItemPatrimonioType(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm">
                              <option value="">Selecione...</option>
                              <option value="Municipal">Municipal</option>
                              <option value="Estadual">Estadual</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {(newItemType === 'Equipamento' || newItemType === 'Material') && (
                      <div className="space-y-1 p-3 bg-white border border-rustic-border/50 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-primary text-sm">link</span>
                          <label className="text-xs font-bold text-rustic-brown">Vincular à Viatura</label>
                        </div>
                        <select
                          value={newItemViaturaId}
                          onChange={e => setNewItemViaturaId(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        >
                          <option value="">Item de Uso Geral (Quartel)</option>
                          {fleet.filter(v => v.type === 'Viatura').map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-400 italic">O item aparecerá na conferência diária da viatura selecionada.</p>
                      </div>
                    )}

                    {/* Atividades checkboxes */}
                    <div className="space-y-1 p-3 bg-white border border-rustic-border/50 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-sm">construction</span>
                        <label className="text-xs font-bold text-rustic-brown">Atividades Operacionais</label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {['Incêndio Urbano', 'Incêndio Florestal', 'Salvamento Terrestre', 'Salvamento em Altura', 'Salvamento Aquático', 'APH', 'Produtos Perigosos', 'Defesa Civil', 'Administrativo'].map(at => {
                          const hasAt = newItemAtividades.includes(at);
                          return (
                            <label key={at} className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:text-primary transition-colors">
                              <input
                                type="checkbox"
                                checked={hasAt}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setNewItemAtividades(prev => [...prev, at]);
                                  } else {
                                    setNewItemAtividades(prev => prev.filter(x => x !== at));
                                  }
                                }}
                                className="h-4 w-4 rounded border-rustic-border text-primary focus:ring-primary/20"
                              />
                              {at}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <textarea value={newItemDetails} onChange={e => setNewItemDetails(e.target.value)} className="w-full h-32 p-4 rounded-lg border border-rustic-border" placeholder="Detalhes" />
                    {profile?.p_logistica === 'editor' ? (
                      <button onClick={handleSaveItem} className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:brightness-110">Salvar no Patrimônio e Conferência</button>
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-center">
                        <span className="material-symbols-outlined text-amber-500 mb-2">lock</span>
                        <p className="text-xs font-black uppercase text-amber-700">Apenas leitura</p>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {activeTab === 'compras' && (
                <div className="space-y-8">
                  {/* Notifications Section */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined">notification_important</span>
                        Solicitações e Pendências
                      </span>
                      {profile?.p_logistica === 'editor' && (
                        <button onClick={() => setShowManualPurchase(!showManualPurchase)} className="text-xs bg-white border border-orange-200 text-orange-800 px-3 py-1 rounded hover:bg-orange-50 font-bold transition-colors">
                          {showManualPurchase ? 'CANCELAR MANUAL' : '+ NOVA COMPRA MANUAL'}
                        </button>
                      )}
                    </h3>

                    {showManualPurchase && (
                      <div className="bg-white p-4 rounded-lg border border-orange-200 mb-4 animate-in fade-in slide-in-from-top-2">
                        <h4 className="font-bold text-sm mb-2 text-rustic-brown">Nova Solicitação Manual</h4>
                        <div className="flex gap-2 mb-2">
                          <input
                            value={manualPurchaseItem}
                            onChange={e => setManualPurchaseItem(e.target.value)}
                            placeholder="Nome do item/material"
                            className="flex-1 h-9 px-3 text-sm border border-rustic-border rounded-md"
                          />
                          <input
                            value={manualPurchaseReason}
                            onChange={e => setManualPurchaseReason(e.target.value)}
                            placeholder="Motivo/Justificativa"
                            className="flex-1 h-9 px-3 text-sm border border-rustic-border rounded-md"
                          />
                        </div>
                        <button onClick={handleManualPurchase} className="w-full h-9 bg-orange-600 text-white font-bold text-xs rounded-md hover:bg-orange-700">
                          ADICIONAR SOLICITAÇÃO
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {notices.filter(n => n.type === 'material' && n.status === 'pendente').map(notice => (
                        <div key={notice.id} className="bg-white border border-orange-200 p-4 rounded-lg shadow-sm flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-rustic-brown">{notice.description}</p>
                            <span className="text-[10px] text-gray-500">{new Date(notice.created_at!).toLocaleDateString('pt-BR')}</span>
                          </div>
                          {profile?.p_logistica === 'editor' && (
                            <button
                              onClick={() => handleCreatePurchaseRequest(notice)}
                              className="flex flex-col items-center gap-1 p-2 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                              <span className="text-[9px] font-black">GERAR PEDIDO</span>
                            </button>
                          )}
                        </div>
                      ))}
                      {notices.filter(n => n.type === 'material' && n.status === 'pendente').length === 0 && (
                        <p className="text-sm text-orange-700 italic col-span-2">Nenhuma nova necessidade de material reportada.</p>
                      )}
                    </div>
                  </div>

                  {/* Existing Purchases List */}
                  <div className="bg-white border border-rustic-border rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Histórico de Aquisições</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-rustic-border text-xs font-bold uppercase text-rustic-brown/50">
                          <tr>
                            <th className="py-3 px-4">Item</th>
                            <th className="py-3 px-4">Qtd</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">P. Unit</th>
                            <th className="py-3 px-4 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rustic-border/30">
                          {purchases.map(p => (
                            <tr key={p.id}>
                              <td className="py-3 px-4 font-bold">{p.item}</td>
                              <td className="py-3 px-4">{p.quantity}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === 'Aprovado' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">R$ {(p.unit_price || 0).toFixed(2)}</td>
                              <td className="py-3 px-4 text-right">
                                {profile?.p_logistica === 'editor' && (
                                  <button onClick={() => handleDeletePurchase(p.id!)} className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded">
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'conferencias' && (
                <div className="space-y-6">
                  {/* Pending Notices Section */}
                  <div className="bg-white border border-rustic-border rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-500">warning</span>
                      Pendências em Aberto
                    </h3>
                    <div className="space-y-4">
                      {notices.map(notice => (
                        <div key={notice.id} className="p-4 border border-rustic-border rounded-lg flex justify-between items-center bg-stone-50">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${notice.status === 'pendente' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{notice.status}</span>
                              <span className="font-bold text-sm">{notice.description}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Registrado em: {new Date(notice.created_at!).toLocaleDateString()} - Viatura: {fleet.find(v => v.id === notice.viatura_id)?.name || 'N/A'}</p>
                          </div>
                          {profile?.p_logistica === 'editor' && notice.status === 'pendente' && (
                            <button onClick={() => handleResolveNotice(notice.id!)} className="text-xs font-bold text-primary border border-primary px-3 py-1 rounded hover:bg-primary hover:text-white transition-colors">
                              RESOLVER
                            </button>
                          )}
                        </div>
                      ))}
                      {notices.length === 0 && <p className="text-center text-gray-400 italic">Nenhuma pendência em aberto.</p>}
                    </div>
                  </div>

                  {/* Daily Checklists History */}
                  <div className="bg-white border border-rustic-border rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">history</span>
                      Histórico de Conferências Diárias
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-rustic-border text-xs font-bold uppercase text-rustic-brown/50">
                          <tr>
                            <th className="py-3 px-4">Data</th>
                            <th className="py-3 px-4">Viatura/Item</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Obs</th>
                            <th className="py-3 px-4">Responsável</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rustic-border/30">
                          {dailyChecklists.slice(0, 50).map((checklist) => (
                            <tr key={checklist.id}>
                              <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-500">
                                {checklist.created_at ? new Date(checklist.created_at).toLocaleString('pt-BR') : '-'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs">{checklist.vehicle?.name || checklist.viatura_id || '-'}</span>
                                  <span className="text-[10px] text-gray-500">{checklist.item?.item_name || checklist.item_id}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${checklist.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {checklist.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs italic text-gray-600 max-w-[200px] truncate">{checklist.notes || '-'}</td>
                              <td className="py-3 px-4 text-xs">{checklist.responsible || '-'}</td>
                            </tr>
                          ))}
                          {dailyChecklists.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-gray-400 italic">Nenhum registro de conferência encontrado.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'relatorios' && (
                <RelatoriosMensais />
              )}

            </div>
          </div>
        </div>
      </div >
    </div >
  );
};

export default PatrimonioB4;