import React, { useState, useEffect, useMemo } from 'react';
import { SupabaseService, DailyMission, Vehicle, GuReport, Personnel, PendingNotice } from '../services/SupabaseService';
import { supabase } from '../services/supabase';
import { DefesaCivilTicker } from '../components/DefesaCivilTicker';
import { BirthdayCard } from '../components/BirthdayCard';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// Helper to format dates in pt-BR style
const formatDateBR = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// Helper to get day-of-week label
const getDayLabel = (dateStr: string) => {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const date = new Date(dateStr + 'T12:00:00');
  return days[date.getDay()];
};

// Helper for relative time
const timeAgo = (isoDate: string) => {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
};

const DashboardAvisos: React.FC = () => {
  const { user, profile } = useAuth();
  const isEditor = profile?.p_avisos === 'editor';

  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [previousMissions, setPreviousMissions] = useState<DailyMission[]>([]);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [reports, setReports] = useState<GuReport[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [pendingNotices, setPendingNotices] = useState<PendingNotice[]>([]);
  const [guReportText, setGuReportText] = useState("");
  const [selectedDate, setSelectedDate] = useState(SupabaseService.getTodayDate());
  const [loading, setLoading] = useState(true);

  const getYesterdayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  const targetDate = getYesterdayDate(selectedDate);

  const loadData = async () => {
    setLoading(true);
    try {
      const [missionsData, prevMissionsData, fleetData, reportsData, personnelData] = await Promise.all([
        SupabaseService.getDailyMissions({ data: selectedDate }),
        SupabaseService.getDailyMissions({ data: targetDate }),
        SupabaseService.getFleet(),
        SupabaseService.getGuReports(),
        SupabaseService.getPersonnel(),
      ]);

      // Try to load pending notices (might not exist)
      let noticesData: PendingNotice[] = [];
      try {
        const { data } = await supabase
          .from('pending_notices')
          .select('*')
          .eq('status', 'pendente')
          .order('created_at', { ascending: false });
        noticesData = data || [];
      } catch { /* table might not have data */ }

      setMissions(missionsData);
      setPreviousMissions(prevMissionsData.filter(m => m.status === 'concluida'));
      setFleet(fleetData);
      setReports(reportsData);
      setPersonnel(personnelData);
      setPendingNotices(noticesData);
    } catch (error) {
      console.error("Failed to load data", error);
      toast.error('Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  // Load escala for the selected date
  const [escala, setEscala] = useState<any>(null);
  useEffect(() => {
    const loadEscala = async () => {
      try {
        const { data } = await supabase
          .from('escalas')
          .select('*')
          .eq('data', selectedDate)
          .maybeSingle();
        setEscala(data);
      } catch { /* might not exist */ }
    };
    loadEscala();
  }, [selectedDate]);

  // Get names of military on duty for the selected date
  const escalaMilitares = useMemo(() => {
    if (!escala || !escala.militares || personnel.length === 0) return [];
    return escala.militares
      .map((id: number) => personnel.find(p => p.id === id))
      .filter(Boolean);
  }, [escala, personnel]);

  // Realtime Subscription
  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('missoes_realtime_avisos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_missions',
          filter: `mission_date=eq.${selectedDate}`
        },
        () => { loadData(); }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gu_reports',
        },
        () => { loadData(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const toggleMission = async (id: string, currentStatus: string) => {
    if (!isEditor) {
      toast.warning('Você não tem permissão para alterar missões.');
      return;
    }
    const newStatus = currentStatus === 'concluida' ? 'em_andamento' : 'concluida';
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status: newStatus as any } : m));
    try {
      await SupabaseService.updateDailyMission(id, { status: newStatus as any });
      toast.success(newStatus === 'concluida' ? 'Missão concluída!' : 'Missão reaberta.');
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error('Erro ao atualizar missão.');
      loadData();
    }
  };

  const handleSaveReport = async () => {
    if (!isEditor) {
      toast.warning('Você não tem permissão para criar avisos.');
      return;
    }
    if (!guReportText.trim()) {
      toast.warning('Digite algo no aviso antes de salvar.');
      return;
    }

    try {
      await SupabaseService.addGuReport({
        title: "Aviso Gerais",
        description: guReportText.trim(),
        type: "geral",
        responsible_id: user?.id || 'unknown',
        report_date: selectedDate
      });
      toast.success('Aviso salvo com sucesso!');
      setGuReportText("");
      loadData();
    } catch {
      toast.error('Erro ao salvar aviso.');
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!isEditor) {
      toast.warning('Você não tem permissão para excluir avisos.');
      return;
    }
    try {
      await SupabaseService.deleteGuReport(id);
      toast.success('Aviso excluído.');
      loadData();
    } catch {
      toast.error('Erro ao excluir aviso.');
    }
  };

  const avisoDoDia = reports.find(r => r.report_date === targetDate);

  // Stats
  const activeFleet = fleet.filter(v => v.status === 'active').length;
  const downFleet = fleet.filter(v => v.status !== 'active').length;
  const completedMissions = missions.filter(m => m.status === 'concluida').length;
  const urgentMissions = missions.filter(m => m.priority === 'urgente' || m.priority === 'alta').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-background-light overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-surface border-b border-rustic-border shadow-sm z-30">
        <div className="py-4 px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-[#2e1a16] tracking-tight">Painel de Avisos</h1>
            <p className="text-rustic-brown/60 text-sm">
              {getDayLabel(selectedDate)}, {formatDateBR(selectedDate)} — Passagem de Plantão
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                <span className="material-symbols-outlined text-[14px]">directions_car</span>
                {activeFleet} QAP
              </div>
              {downFleet > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                  <span className="material-symbols-outlined text-[14px]">build</span>
                  {downFleet} Baixada{downFleet > 1 ? 's' : ''}
                </div>
              )}
              {urgentMissions > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg animate-pulse">
                  <span className="material-symbols-outlined text-[14px]">priority_high</span>
                  {urgentMissions} Urgente{urgentMissions > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="flex items-center bg-white border border-rustic-border rounded-lg px-3 py-1.5 shadow-sm">
              <span className="material-symbols-outlined text-rustic-brown/50 mr-2 text-[20px]">calendar_today</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-rustic-brown outline-none"
              />
            </div>
            <button onClick={loadData} className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-red-700 transition-colors shadow-md" title="Atualizar">
              <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>

        <DefesaCivilTicker />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-[1600px] mx-auto">

          {/* Column 1: Aviso do Dia + Missões */}
          <div className="xl:col-span-2 space-y-6">

            {/* AVISO DO DIA (Yesterday's Report) */}
            <section className="bg-yellow-50 rounded-xl border border-yellow-200 shadow-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <span className="material-symbols-outlined text-9xl text-yellow-600">campaign</span>
              </div>
              <h2 className="font-black text-yellow-800 mb-4 flex items-center gap-2 text-lg">
                <span className="material-symbols-outlined">campaign</span>
                Aviso do Plantão Anterior ({formatDateBR(targetDate)})
              </h2>
              {avisoDoDia ? (
                <div className="bg-white/80 p-5 rounded-lg border border-yellow-100 shadow-sm backdrop-blur-sm">
                  <p className="text-[#2c1810] whitespace-pre-line text-lg font-medium leading-relaxed">
                    "{avisoDoDia.description}"
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-yellow-200 rounded-lg text-yellow-700/50">
                  <span className="material-symbols-outlined text-4xl mb-2">unpublished</span>
                  <p className="font-bold">Nenhum aviso deixado pelo plantão anterior.</p>
                </div>
              )}

              {/* Missões do Plantão Anterior (Concluídas) */}
              {previousMissions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-yellow-200/50">
                  <h3 className="text-xs font-black uppercase text-yellow-700 mb-2 flex items-center gap-2 opacity-70">
                    <span className="material-symbols-outlined text-[16px]">task_alt</span>
                    Missões Concluídas no Plantão Anterior
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {previousMissions.map(m => (
                      <div key={m.id} className="flex items-start gap-2 bg-white/50 p-2 rounded border border-yellow-100 text-yellow-900/80 text-xs">
                        <span className="material-symbols-outlined text-[14px] mt-0.5 text-green-600">check_circle</span>
                        <div>
                          <p className="font-bold leading-tight">{m.title}</p>
                          {m.responsible_name && <p className="text-[9px] opacity-70">{m.responsible_name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* MISSÕES DO DIA */}
            <section className="bg-surface rounded-xl border border-rustic-border shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#2c1810] to-[#4a2c20] px-6 py-4 flex justify-between items-center">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">Format_list_bulleted</span>
                  Missões do Dia
                  {missions.length > 0 && (
                    <span className="text-white/60 text-xs font-normal ml-1">({completedMissions}/{missions.length})</span>
                  )}
                </h2>
                {isEditor && (
                  <button onClick={() => window.location.href = '/operacional'} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors text-xs font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Nova Missão
                  </button>
                )}
              </div>
              <div className="p-0">
                {missions.length === 0 ? (
                  <div className="p-8 text-center text-rustic-brown/40">
                    <span className="material-symbols-outlined text-4xl mb-2">event_available</span>
                    <p>Nenhuma missão registrada para hoje.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-rustic-border/30">
                    {missions.map((mission) => (
                      <div key={mission.id} className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors ${mission.status === 'concluida' ? 'bg-gray-50/50' : ''}`}>
                        <div
                          onClick={() => mission.id && toggleMission(mission.id, mission.status)}
                          className={`w-6 h-6 mt-0.5 rounded border-2 flex items-center justify-center transition-all ${isEditor ? 'cursor-pointer' : 'cursor-default'} ${mission.status === 'concluida' ? 'bg-green-600 border-green-600' : 'border-rustic-border hover:border-primary'}`}
                        >
                          {mission.status === 'concluida' && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium text-[#2c1810] ${mission.status === 'concluida' ? 'line-through text-rustic-brown/50' : ''}`}>
                              {mission.title}
                            </p>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${mission.priority === 'urgente' ? 'bg-red-100 text-red-600' :
                              mission.priority === 'alta' ? 'bg-orange-100 text-orange-600' :
                                mission.priority === 'media' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600'
                              }`}>
                              {mission.priority}
                            </span>
                          </div>
                          {mission.description && <p className="text-[11px] text-gray-500 mt-0.5">{mission.description}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            {mission.start_time && (
                              <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                {mission.start_time}
                              </span>
                            )}
                            {mission.responsible_name && (
                              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">person</span>
                                {mission.responsible_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Progress Bar */}
                    <div className="p-4 bg-stone-50/50 border-t border-rustic-border/20">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase text-gray-400">Progresso do Dia</span>
                        <span className="text-[10px] font-black text-primary">
                          {completedMissions} de {missions.length} concluídas
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${completedMissions === missions.length ? 'bg-green-500' : 'bg-primary'}`}
                          style={{ width: `${(completedMissions / (missions.length || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Pendências (from checklist) */}
            {pendingNotices.length > 0 && (
              <section className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-6">
                <h2 className="font-black text-red-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">report_problem</span>
                  Pendências Ativas
                  <span className="text-[10px] font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded-full">{pendingNotices.length}</span>
                </h2>
                <div className="space-y-2">
                  {pendingNotices.slice(0, 5).map(notice => (
                    <div key={notice.id} className="flex items-start gap-3 bg-white/80 p-3 rounded-lg border border-red-100">
                      <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">error</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-red-900">{notice.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-bold uppercase bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{notice.type}</span>
                          {notice.created_at && (
                            <span className="text-[9px] text-red-400">{timeAgo(notice.created_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingNotices.length > 5 && (
                    <p className="text-xs text-red-500 font-bold text-center pt-1">
                      + {pendingNotices.length - 5} pendência(s) não exibida(s)
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Column 2: Sidebar */}
          <div className="space-y-6">

            {/* Birthday Card */}
            <BirthdayCard selectedDate={selectedDate} />

            {/* Efetivo de Serviço */}
            {escalaMilitares.length > 0 && (
              <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-5">
                <h2 className="font-bold text-[#2c1810] mb-4 flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary">shield_person</span>
                  Efetivo de Serviço
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-auto">{escalaMilitares.length}</span>
                </h2>
                {escala?.equipe && (
                  <div className="mb-3 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[16px]">group</span>
                    <span className="text-xs font-black text-primary uppercase">{escala.equipe}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {escalaMilitares.map((p: Personnel) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-background-light border border-rustic-border/50">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-rustic-border" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-[#2c1810]">{p.rank} {p.war_name || p.name}</p>
                        <p className="text-[9px] text-rustic-brown/50">{p.role || p.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Status da Frota */}
            <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-[#2c1810] flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary">directions_car</span>
                  Status da Frota
                </h2>
                <span className="text-[10px] font-bold text-primary bg-red-50 px-2 py-1 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                  Ao Vivo
                </span>
              </div>

              <div className="space-y-3">
                {loading ? <p className="text-gray-400 text-sm animate-pulse">Carregando frota...</p> : fleet.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-4 text-gray-400">
                    <span className="material-symbols-outlined text-3xl mb-1">directions_car</span>
                    <p className="text-sm font-medium">Nenhuma viatura cadastrada.</p>
                    <p className="text-xs">Cadastre viaturas no módulo B4.</p>
                  </div>
                ) : fleet.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-background-light border border-rustic-border/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${v.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                      <div>
                        <span className="font-bold text-[#2c1810] block text-sm">{v.name}</span>
                        <span className="text-[10px] uppercase font-bold text-rustic-brown/50">{v.type} • {v.plate || '---'}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${v.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {v.status === 'active' ? 'QAP' : 'BAIXADA'}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.href = '/logistica'} className="w-full mt-4 py-2 border border-rustic-border text-rustic-brown text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Gerenciar Frota (B4)
              </button>
            </section>

            {/* CREATE NEW AVISO (Para o Próximo Plantão) */}
            {isEditor && (
              <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-6">
                <h2 className="font-bold text-[#2c1810] mb-2 flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  Deixar Aviso para o Próximo Plantão
                </h2>
                <p className="text-[10px] text-rustic-brown/60 mb-3">Este aviso será exibido para o Chefe de Socorro que assumir.</p>
                <textarea
                  value={guReportText}
                  onChange={(e) => setGuReportText(e.target.value)}
                  className="w-full h-28 rounded-lg border border-rustic-border bg-background-light p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none mb-2"
                  placeholder="Ex: Viatura ABT com problema no freio. Aguardando peça..."
                  maxLength={1000}
                ></textarea>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-rustic-brown/40">
                    {guReportText.length}/1000 • {formatDateBR(selectedDate)}
                  </span>
                  <button
                    onClick={handleSaveReport}
                    disabled={!guReportText.trim()}
                    className="px-5 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Salvar Aviso
                  </button>
                </div>

                {/* History */}
                {reports.length > 0 && (
                  <div className="mt-5 border-t border-rustic-border pt-4">
                    <h3 className="text-xs font-bold text-rustic-brown mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">history</span>
                      Histórico de Avisos
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {reports.map((rep) => (
                        <div key={rep.id} className="text-xs p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-start gap-3 group">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold block text-primary text-[11px]">{formatDateBR(rep.report_date)}</span>
                            <p className="text-rustic-brown/80 line-clamp-2 mt-0.5">{rep.description}</p>
                            {rep.created_at && (
                              <span className="text-[9px] text-gray-400 mt-1 block">{timeAgo(rep.created_at)}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteReport(rep.id!)}
                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Excluir aviso"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Read-only view for readers */}
            {!isEditor && reports.length > 0 && (
              <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-6">
                <h2 className="font-bold text-[#2c1810] mb-3 flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary">history</span>
                  Histórico de Avisos
                </h2>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {reports.map((rep) => (
                    <div key={rep.id} className="text-xs p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="font-bold block text-primary text-[11px]">{formatDateBR(rep.report_date)}</span>
                      <p className="text-rustic-brown/80 line-clamp-3 mt-0.5">{rep.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAvisos;