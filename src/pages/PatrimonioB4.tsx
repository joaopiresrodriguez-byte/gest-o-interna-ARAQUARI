import React, { useState, useEffect } from 'react';
import { SupabaseService, Vehicle, PendingNotice, Purchase, DailyMission, Personnel } from '../services/SupabaseService';
import { toast } from 'sonner';
import { useRealtimeNotices } from '../hooks/useRealtimeNotices';
import { useAuth } from '../context/AuthContext';

const PatrimonioB4: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'cadastro' | 'listagem' | 'compras' | 'missoes' | 'conferencias'>('missoes');
  const [searchTerm, setSearchTerm] = useState("");
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [initialNotices, setInitialNotices] = useState<PendingNotice[]>([]);
  const { notices } = useRealtimeNotices(initialNotices);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dailyMissions, setDailyMissions] = useState<DailyMission[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State for Manual Entry (Vehicles)
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState<Vehicle['type']>('Equipamento');
  const [newItemStatus] = useState<Vehicle['status']>('active');
  const [newItemDetails, setNewItemDetails] = useState("");
  const [newItemViaturaId, setNewItemViaturaId] = useState("");

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

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fleetData, noticesData, purchasesData, missionsData, personnelData] = await Promise.all([
        SupabaseService.getFleet(),
        SupabaseService.getPendingNotices(),
        SupabaseService.getPurchases(),
        SupabaseService.getDailyMissions(),
        SupabaseService.getPersonnel()
      ]);
      setFleet(fleetData);
      setInitialNotices(noticesData);
      setPurchases(purchasesData);
      setDailyMissions(missionsData);
      setPersonnel(personnelData);
    } catch (error) {
      console.error("Error loading B4 data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveNotice = async (id: string) => {
    try {
      await SupabaseService.resolveNotice(id);
      alert("Pendência marcada como resolvida!");
      loadData();
    } catch (error) {
      alert("Erro ao resolver pendência.");
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
      alert("Solicitação de compra criada!");
      setActiveTab('compras');
      loadData();
    } catch (error) {
      alert("Erro ao criar solicitação.");
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
      details: newItemDetails || "Sem detalhes adicionais"
    };

    try {
      await SupabaseService.addVehicle(newItem);

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
      setActiveTab('listagem');
      loadData();
    } catch (error: any) {
      console.error("Error saving item:", error);
      toast.error(`Erro ao salvar item: ${error.message || error.details || JSON.stringify(error)}`);
    }
  };

  const handleCreateMission = async () => {
    if (!missionTitle || !missionDate) return alert("Título e Data são obrigatórios!");

    const resp = personnel.find(p => p.id?.toString() === missionRespId);

    const newMission: DailyMission = {
      title: missionTitle,
      description: missionDesc,
      mission_date: missionDate,
      start_time: missionStart || undefined,
      end_time: missionEnd || undefined,
      responsible_id: missionRespId || undefined,
      responsible_name: resp ? `${resp.rank} ${resp.name}` : undefined,
      priority: missionPriority,
      status: missionStatus,
      notes: missionObs,
      created_by: "Administrador B4"
    };

    try {
      await SupabaseService.addDailyMission(newMission);
      alert("Missão cadastrada com sucesso!");
      setMissionTitle("");
      setMissionDesc("");
      setMissionObs("");
      loadData();
    } catch (error) {
      alert("Erro ao cadastrar missão.");
    }
  };

  const handleUpdateMissionStatus = async (id: string, status: DailyMission['status']) => {
    try {
      await SupabaseService.updateDailyMission(id, { status });
      loadData();
    } catch (error) {
      alert("Erro ao atualizar status.");
    }
  };

  const handleDeleteMission = async (id: string) => {
    if (!confirm("Excluir esta missão?")) return;
    try {
      await SupabaseService.deleteDailyMission(id);
      loadData();
    } catch (error) {
      alert("Erro ao excluir missão.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm(`Remover item ${id} permanentemente?`)) return;
    try {
      await SupabaseService.deleteVehicle(id);
      loadData();
    } catch (error) {
      alert("Erro ao remover item.");
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (!confirm("Excluir registro de compra?")) return;
    try {
      await SupabaseService.deletePurchase(id);
      loadData();
    } catch (error) {
      alert("Erro ao excluir compra.");
    }
  };

  const filteredFleet = fleet.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              {(['missoes', 'listagem', 'cadastro', 'compras', 'conferencias'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-col items-center gap-1 pb-3 border-b-[3px] font-bold text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-rustic-brown/40 hover:text-rustic-brown'}`}
                >
                  <span className="material-symbols-outlined">{tab === 'missoes' ? 'assignment' : tab === 'listagem' ? 'inventory' : tab === 'cadastro' ? 'add_box' : tab === 'compras' ? 'shopping_basket' : 'checklist'}</span>
                  {tab === 'missoes' ? 'Missões Diárias' : tab === 'conferencias' ? 'Conferências' : tab}
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
                            {personnel.map(p => <option key={p.id} value={p.id}>{p.rank} {p.name}</option>)}
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
                  <div className="relative w-full lg:w-96">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rustic-brown/40 material-symbols-outlined">search</span>
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-rustic-border bg-stone-50/30"
                      placeholder="Filtrar patrimônio..."
                      type="text"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredFleet.map(item => {
                      const itemNotices = notices.filter(n => n.status === 'pendente' && (n.viatura_id === item.id || n.description.includes(item.name)));

                      return (
                        <div key={item.id} className="bg-white rounded-xl border border-rustic-border p-5 hover:shadow-md transition-all relative">
                          <div className="flex justify-between items-start mb-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {item.status}
                            </span>
                            <div className="flex gap-2">
                              <span className="text-[10px] font-bold text-rustic-brown/40">{item.id}</span>
                              {profile?.p_logistica === 'editor' && (
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <h3 className="text-lg font-bold mb-1">{item.name}</h3>
                          <p className="text-xs text-rustic-brown/60 mb-4 line-clamp-2">{item.details}</p>

                          {/* Alerts Section */}
                          {itemNotices.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {itemNotices.map(notice => (
                                <div key={notice.id} className="bg-red-50 border border-primary/20 rounded-lg p-2 animate-pulse">
                                  <div className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">warning</span>
                                    <div className="flex-1">
                                      <p className="text-[10px] font-bold text-primary">{notice.description}</p>
                                      {profile?.p_logistica === 'editor' && (
                                        <button
                                          onClick={() => handleResolveNotice(notice.id!)}
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
                    })}
                  </div>
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
                    <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined">notification_important</span>
                      Solicitações de Compra Pendentes (Operacional)
                    </h3>
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
                  <div className="bg-white border border-rustic-border rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Conferências Diárias (Pendências)</h3>
                    <div className="space-y-4">
                      {notices.map(notice => (
                        <div key={notice.id} className="p-4 border border-rustic-border rounded-lg flex justify-between items-center bg-stone-50">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${notice.status === 'pendente' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{notice.status}</span>
                              <span className="font-bold text-sm">{notice.description}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Registrado em: {new Date(notice.created_at!).toLocaleDateString()}</p>
                          </div>
                          {profile?.p_logistica === 'editor' && notice.status === 'pendente' && (
                            <button onClick={() => handleResolveNotice(notice.id!)} className="text-xs font-bold text-primary border border-primary px-3 py-1 rounded hover:bg-primary hover:text-white transition-colors">
                              RESOLVER
                            </button>
                          )}
                        </div>
                      ))}
                      {notices.length === 0 && <p className="text-center text-gray-400 italic">Nenhuma conferência/pendência registrada.</p>}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div >
    </div >
  );
};

export default PatrimonioB4;