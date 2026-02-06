import React, { useState, useEffect } from 'react';
import { SupabaseService, ProductReceipt, ChecklistItem, DailyChecklist } from '../services/SupabaseService';
import { NotificationService } from '../services/NotificationService';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const Operacional: React.FC = () => {
  // New States for Advanced Features
  const [activeChecklistTab, setActiveChecklistTab] = useState<'materiais' | 'equipamentos' | 'viaturas'>('materiais');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [fleet, setFleet] = useState<{ id: string, name: string }[]>([]);
  const [selectedViaturaId, setSelectedViaturaId] = useState<string>("");
  const [receipts, setReceipts] = useState<ProductReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();

  // Receipt Form State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptNF, setReceiptNF] = useState("");
  const [receiptObs, setReceiptObs] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Checklist Reporting State
  const [reportStatuses, setReportStatuses] = useState<Record<string, { status: 'ok' | 'faltante', obs: string }>>({});

  useEffect(() => {
    loadOperationalData();
  }, [activeChecklistTab, selectedViaturaId]);

  const loadOperationalData = async () => {
    setLoading(true);
    try {
      const [items, recs, fleetData] = await Promise.all([
        SupabaseService.getChecklistItems(activeChecklistTab, selectedViaturaId),
        SupabaseService.getProductsReceipts(),
        SupabaseService.getFleet()
      ]);
      setChecklistItems(items);
      setReceipts(recs);
      setFleet(fleetData.filter(v => v.type === 'Viatura'));

      // Initialize statuses if not set
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
  };

  const handleRegisterReceipt = async () => {
    if (!receiptFile || !receiptNF) {
      toast.error("Por favor, selecione uma foto e insira o número da nota fiscal.");
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_${receiptFile.name}`;
      await SupabaseService.uploadFile('produto-fotos', fileName, receiptFile);
      const publicUrl = SupabaseService.getPublicUrl('produto-fotos', fileName);

      await SupabaseService.addProductReceipt({
        foto_url: publicUrl,
        numero_nota_fiscal: receiptNF,
        observacoes: receiptObs,
        data_recebimento: new Date().toISOString()
      });

      toast.success("Recebimento registrado com sucesso!");

      // Send Notification
      NotificationService.sendReceiptNotification({
        nf: receiptNF,
        obs: receiptObs,
        photoUrl: publicUrl,
        user: user?.email || 'N/A'
      });

      setReceiptFile(null);
      setReceiptNF("");
      setReceiptObs("");
      loadOperationalData();
    } catch (error) {
      console.error("Error uploading product:", error);
      toast.error("Erro ao registrar recebimento.");
    } finally {
      setIsUploading(false);
    }
  };

  const updateReportStatus = (id: string, status: 'ok' | 'faltante', obs?: string) => {
    setReportStatuses(prev => ({
      ...prev,
      [id]: { ...prev[id], status, obs: obs !== undefined ? obs : prev[id].obs }
    }));
  };

  const handleSaveChecklist = async () => {
    setLoading(true);
    try {
      const promises = checklistItems.map(item => {
        const report = reportStatuses[item.id];
        return SupabaseService.saveDailyChecklist({
          item_id: item.id,
          viatura_id: selectedViaturaId || item.viatura_id,
          status: report.status,
          observacoes: report.obs,
          responsavel: user?.email || "Usuário não identificado"
        });
      });
      await Promise.all(promises);
      toast.success("Conferência salva com sucesso!", {
        description: "As pendências foram enviadas automaticamente ao módulo B4."
      });

      // Send Notification
      NotificationService.sendConferenceNotification({
        responsible: user?.email || "N/A",
        viatura: fleet.find(v => v.id === selectedViaturaId)?.name,
        items: checklistItems,
        statuses: reportStatuses
      });

      loadOperationalData();
    } catch (error) {
      console.error("Error saving checklist:", error);
      toast.error("Erro ao salvar conferência.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light h-full w-full flex flex-col overflow-y-auto">
      {/* Page Header */}
      <header className="bg-white border-b border-rustic-border px-8 py-6 sticky top-0 z-20 shadow-sm/50">
        <div className="max-w-7xl mx-auto w-full flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[#181111] text-3xl font-black leading-tight tracking-[-0.033em]">Módulo Operacional</h1>
            <p className="text-[#886363] text-base font-normal">Controle de Materiais, Conferência e Recebimento</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-secondary-green/10 text-secondary-green rounded-full text-xs font-bold uppercase tracking-wider border border-secondary-green/20">
              Operacional Online
            </span>
            <button onClick={loadOperationalData} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-rustic-border transition-all">
              <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full flex-1 space-y-8">
        <div className="flex flex-col gap-8">

          {/* 1. Recebimento de Produtos */}
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
                  <input
                    type="text"
                    value={receiptNF}
                    onChange={e => setReceiptNF(e.target.value)}
                    placeholder="Nº da Nota Fiscal"
                    className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-white text-sm focus:ring-2 focus:ring-primary/20"
                  />
                  <textarea
                    value={receiptObs}
                    onChange={e => setReceiptObs(e.target.value)}
                    placeholder="Observações (Opcional)"
                    className="w-full h-24 p-4 rounded-lg border border-rustic-border bg-white text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                  {profile?.p_operacional === 'editor' ? (
                    <button
                      onClick={handleRegisterReceipt}
                      disabled={isUploading}
                      className="w-full py-3 bg-secondary-green text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 hover:bg-green-700 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">{isUploading ? 'sync' : 'save'}</span>
                      {isUploading ? 'Registrando...' : 'Registrar Recebimento'}
                    </button>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                      <span className="material-symbols-outlined text-amber-500 mb-2">lock</span>
                      <p className="text-xs font-black uppercase text-amber-700">Modo Leitura: Apenas p/ Editor</p>
                    </div>
                  )}
                </div>

                {/* Recent Receipts List */}
                <div className="h-full">
                  <h4 className="text-sm font-bold text-rustic-brown mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">history</span>
                    Recebimentos Recentes
                  </h4>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                    {receipts.map(rec => (
                      <div key={rec.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-rustic-border/50">
                        <img src={rec.foto_url} className="w-16 h-16 rounded object-cover border border-gray-200" alt="Produto" />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#181111]">NF: {rec.numero_nota_fiscal}</span>
                          <span className="text-[10px] text-gray-500">{new Date(rec.data_recebimento!).toLocaleDateString('pt-BR')}</span>
                          <span className="text-[10px] text-gray-400 mt-1 line-clamp-1">{rec.observacoes}</span>
                        </div>
                      </div>
                    ))}
                    {receipts.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhum recebimento registrado.</p>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Conferência do Trem de Socorro */}
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

              {/* Vehicle Selection for Filtering */}
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
                    <button
                      onClick={() => setSelectedViaturaId("")}
                      className="px-4 py-2 text-primary font-bold text-xs hover:bg-red-50 rounded-lg transition-all"
                    >
                      LIMPAR FILTRO
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#fcfbfb]">
              <div className="space-y-4">
                {checklistItems.map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-rustic-border shadow-sm p-4 transition-all hover:bg-gray-50">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeChecklistTab === 'viaturas' ? 'bg-blue-100 text-blue-600' : activeChecklistTab === 'equipamentos' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                          <span className="material-symbols-outlined">{activeChecklistTab === 'viaturas' ? 'emergency' : activeChecklistTab === 'equipamentos' ? 'construction' : 'inventory_2'}</span>
                        </div>
                        <div>
                          <p className="font-bold text-[#181111] text-base">{item.nome_item}</p>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{item.categoria}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateReportStatus(item.id, 'ok')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${reportStatuses[item.id]?.status === 'ok' ? 'bg-secondary-green text-white border-secondary-green shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-secondary-green'}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          DISPONÍVEL
                        </button>
                        <button
                          onClick={() => updateReportStatus(item.id, 'faltante')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${reportStatuses[item.id]?.status === 'faltante' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-primary'}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">report</span>
                          FALTANTE
                        </button>
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
                  profile?.p_operacional === 'editor' ? (
                    <button
                      onClick={handleSaveChecklist}
                      disabled={loading}
                      className="w-full mt-4 py-4 bg-primary text-white font-black text-sm rounded-xl shadow-lg border-b-4 border-red-800 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                      <span className="material-symbols-outlined">{loading ? 'sync' : 'task_alt'}</span>
                      {loading ? 'SALVANDO...' : 'FINALIZAR E ENVIAR CONFERÊNCIA'}
                    </button>
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
      </div>
    </div>
  );
};

export default Operacional;