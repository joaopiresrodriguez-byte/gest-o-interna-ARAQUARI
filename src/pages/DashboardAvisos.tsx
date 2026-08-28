import React, { useState, useEffect, useMemo } from 'react';
import {
  SupabaseService,
  DailyMission,
  Vehicle,
  GuReport,
  Personnel,
  PendingNotice,
  Training,
  Vacation,
  ServiceSwap
} from '../services/SupabaseService';
import { supabase } from '../services/supabase';
import { DefesaCivilTicker } from '../components/DefesaCivilTicker';
import { BirthdayCard } from '../components/BirthdayCard';
import { CardClimaAraquari } from '../components/CardClimaAraquari';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { formatLocalDate } from '../utils/dateUtils';

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

import { DailyMissionModal } from '../components/shared/DailyMissionModal';
import { ConcluirMissaoModal } from '../components/shared/ConcluirMissaoModal';
import { STATUS_MISSAO } from '../services/missoesService';

const DashboardAvisos: React.FC = () => {
  const { user, profile } = useAuth();
  const isEditor = profile?.p_avisos === 'editor';

  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [previousMissions, setPreviousMissions] = useState<DailyMission[]>([]);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [reports, setReports] = useState<GuReport[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [pendingNotices, setPendingNotices] = useState<PendingNotice[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [serviceSwaps, setServiceSwaps] = useState<ServiceSwap[]>([]);
  const [guReportText, setGuReportText] = useState("");
  const [selectedDate, setSelectedDate] = useState(SupabaseService.getTodayDate());
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(false);

  // Estados dos modais de missão
  const [isNewMissionModalOpen, setIsNewMissionModalOpen] = useState(false);
  const [selectedMissionForConclusion, setSelectedMissionForConclusion] = useState<DailyMission | null>(null);

  // Exibir por padrão apenas 1 ASU + 1 ABTR + 1 AR (ou primeiras ativas)
  const TIPOS_DESTAQUE = ['ASU', 'ABTR', 'AR'];
  const vtrsDestaque = fleet.filter(v =>
    v.name && TIPOS_DESTAQUE.some(tipo => v.name.toUpperCase().startsWith(tipo))
  );
  const vtrsResumidas = TIPOS_DESTAQUE.map(tipo =>
    vtrsDestaque.find(v => v.name.toUpperCase().startsWith(tipo))
  ).filter(Boolean) as Vehicle[];

  const vtrsExibidas = expandido ? fleet : (vtrsResumidas.length > 0 ? vtrsResumidas : fleet.slice(0, 3));

  const getYesterdayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  const targetDate = getYesterdayDate(selectedDate);

  const [escalaAlteracoes, setEscalaAlteracoes] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        missionsData,
        prevMissionsData,
        fleetData,
        reportsData,
        personnelData,
        trainingsData,
        vacationsData,
        swapsData,
        alteracoesRes
      ] = await Promise.all([
        SupabaseService.getDailyMissions({ data: selectedDate }),
        SupabaseService.getDailyMissions({ data: targetDate }),
        SupabaseService.getFleet(),
        SupabaseService.getGuReports(),
        SupabaseService.getPersonnel(),
        SupabaseService.getTrainings(),
        SupabaseService.getVacations(),
        SupabaseService.getServiceSwaps(),
        supabase.from('escala_alteracoes').select('*')
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
      setFleet(fleetData.filter(v => v.type === 'Viatura'));
      setTrainings(trainingsData.filter(t => t.status === 'Scheduled' || t.status === 'Canceled' || t.status === 'Cancelado'));
      setReports(reportsData);
      setPersonnel(personnelData);
      setPendingNotices(noticesData);
      setVacations(vacationsData || []);
      setServiceSwaps(swapsData || []);
      setEscalaAlteracoes(alteracoesRes.data || []);
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

  // Find service swaps & scale alterations for the selected date
  const swapsForToday = useMemo(() => {
    // 1. ServiceSwaps que abrangem a data selecionada
    const directSwaps = serviceSwaps.filter(s =>
      s.original_date === selectedDate ||
      s.new_date === selectedDate ||
      s.date_a_gives_to_b === selectedDate ||
      s.date_b_gives_to_a === selectedDate ||
      s.swap_date === selectedDate
    );

    // 2. Alterações da tabela escala_alteracoes que caíram nesta data
    const scaleAltSwaps: ServiceSwap[] = escalaAlteracoes
      .filter(alt => alt.dia_original_a === selectedDate || alt.dia_original_b === selectedDate || alt.data_vigencia === selectedDate)
      .map((alt, idx) => ({
        id: `alt-${alt.id || idx}`,
        personnel_id: alt.militar_a_id,
        swap_with_personnel_id: alt.militar_b_id,
        original_date: alt.dia_original_a || selectedDate,
        new_date: alt.dia_original_b || alt.data_vigencia || selectedDate,
        reason: alt.detalhes || 'Alteração de Escala Publicada',
        swap_date: alt.criado_em ? alt.criado_em.split('T')[0] : selectedDate,
        month_ref: selectedDate.substring(0, 7),
        approval_status: 'Aprovado' as const,
      }));

    // Mesclar ignorando duplicados por ID de militares + datas
    const combined = [...directSwaps];
    scaleAltSwaps.forEach(altSwap => {
      const exists = combined.some(s =>
        Number(s.personnel_id) === Number(altSwap.personnel_id) &&
        Number(s.swap_with_personnel_id) === Number(altSwap.swap_with_personnel_id) &&
        (s.original_date === altSwap.original_date || s.new_date === altSwap.new_date)
      );
      if (!exists) combined.push(altSwap);
    });

    return combined;
  }, [serviceSwaps, escalaAlteracoes, selectedDate]);

  // Find vacations and leaves active on the selectedDate
  const vacationsOnDate = useMemo(() => {
    return vacations.filter(v => {
      if (v.leave_type === 'desconto_ferias') return false;
      return v.start_date <= selectedDate && v.end_date >= selectedDate;
    });
  }, [vacations, selectedDate]);

  // Count military on scale who have active leaves
  const totalAfastadosNaEscala = useMemo(() => {
    return escalaMilitares.filter((p: Personnel) =>
      vacations.some(v => {
        if (v.leave_type === 'desconto_ferias') return false;
        const matchPerson = Number(v.personnel_id) === Number(p.id) ||
          (v.full_name && p.name && v.full_name.toLowerCase().trim() === p.name.toLowerCase().trim());
        return matchPerson && v.start_date <= selectedDate && v.end_date >= selectedDate;
      })
    ).length;
  }, [escalaMilitares, vacations, selectedDate]);

  // Helper to resolve personnel name
  const getPersonnelName = (id?: number) => {
    if (!id) return '—';
    const p = personnel.find(x => x.id === id);
    if (!p) return `Militar #${id}`;
    return `${p.rank} ${p.war_name || p.name}`;
  };

  // Helper to get detailed personnel info
  const getPersonnelDetails = (id?: number) => {
    if (!id) return null;
    const p = personnel.find(x => x.id === id);
    if (!p) return null;
    return {
      name: `${p.rank} ${p.war_name || p.name}`,
      matricula: p.matricula || '—',
      cveActive: p.cve_active === 'Sim',
      cnhCategory: p.cnh_category || '—'
    };
  };

  // Helper to map leave type value to label
  const getLeaveLabel = (type?: string) => {
    switch (type) {
      case 'ferias': return 'Férias';
      case 'licenca_medica': return 'Licença Médica';
      case 'licenca_especial': return 'Licença Especial';
      case 'afastamento': return 'Afastamento';
      case 'cedido': return 'Cedido';
      case 'outros': return 'Outros';
      default: return 'Férias';
    }
  };

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_schedule',
        },
        () => { loadData(); }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vacations',
        },
        () => { loadData(); }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_swaps',
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

  // Trainings for the selected date merged with missions
  const todayTrainings = useMemo(() => {
    return trainings.filter(t => t.date === selectedDate);
  }, [trainings, selectedDate]);

  // Unified list: missions + today's trainings, sorted by start time (missions take priority on equal times)
  const unifiedItems = useMemo(() => {
    const missionItems = missions.map(m => ({ type: 'mission' as const, data: m }));
    const trainingItems = todayTrainings.map(t => ({ type: 'training' as const, data: t }));
    const all = [...missionItems, ...trainingItems];
    return all.sort((a, b) => {
      const timeA = a.type === 'mission' ? (a.data.start_time || '99:99') : (a.data as Training).time || '99:99';
      const timeB = b.type === 'mission' ? (b.data.start_time || '99:99') : (b.data as Training).time || '99:99';
      const timeCompare = timeA.localeCompare(timeB);
      if (timeCompare !== 0) return timeCompare;
      
      // On equal times, mission comes first
      if (a.type === 'mission' && b.type === 'training') return -1;
      if (a.type === 'training' && b.type === 'mission') return 1;
      return 0;
    });
  }, [missions, todayTrainings]);

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
                  className="w-full h-24 rounded-lg border border-rustic-border bg-background-light p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none mb-2"
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
              </section>
            )}

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
                    &ldquo;{avisoDoDia.description}&rdquo;
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

            {/* MISSÕES DO DIA + TREINAMENTOS */}
            <section className="bg-surface rounded-xl border border-rustic-border shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#2c1810] to-[#4a2c20] px-6 py-4 flex justify-between items-center">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">format_list_bulleted</span>
                  Missões do Dia
                  {unifiedItems.length > 0 && (
                    <span className="text-white/60 text-xs font-normal ml-1">({completedMissions}/{missions.length})</span>
                  )}
                  {todayTrainings.length > 0 && (
                    <span className="bg-blue-500/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full ml-1">
                      {todayTrainings.length} instrução{todayTrainings.length > 1 ? 'ões' : ''}
                    </span>
                  )}
                </h2>
                {isEditor && (
                  <button
                    type="button"
                    onClick={() => setIsNewMissionModalOpen(true)}
                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Nova Missão
                  </button>
                )}
              </div>
              <div className="p-0">
                {unifiedItems.length === 0 ? (
                  <div className="p-8 text-center text-rustic-brown/40">
                    <span className="material-symbols-outlined text-4xl mb-2">event_available</span>
                    <p>Nenhuma missão ou instrução registrada para hoje.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-rustic-border/30">
                    {unifiedItems.map((item, idx) => {
                      if (item.type === 'training') {
                        const t = item.data as Training;
                        const materiaName = t.tema || (t.materia as any)?.tema || (t.materia as any)?.name || t.materia_id || 'Instrução';
                        const isCanceled = t.status === 'Canceled' || t.status === 'Cancelado';
                        return (
                          <div key={`training-${t.id || idx}`} className={`flex items-start gap-4 p-4 hover:bg-blue-50/40 transition-colors ${isCanceled ? 'bg-gray-50/50 border-l-2 border-gray-400 opacity-60' : 'bg-blue-50/20 border-l-2 border-blue-400'}`}>
                            <div className="w-6 h-6 mt-0.5 rounded flex items-center justify-center flex-shrink-0">
                              <span className={`material-symbols-outlined text-[20px] ${isCanceled ? 'text-gray-400' : 'text-blue-500'}`}>school</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-medium ${isCanceled ? 'text-gray-500 line-through' : 'text-blue-900'}`}>{materiaName}</p>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${isCanceled ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {isCanceled ? 'Instrução Cancelada' : 'Instrução Agendada'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {t.time && (
                                  <span className={`text-[10px] font-bold flex items-center gap-1 ${isCanceled ? 'text-gray-400' : 'text-blue-600'}`}>
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                    {t.time}
                                  </span>
                                )}
                                {t.instructor && (
                                  <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                    {t.instructor}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Regular mission
                      const mission = item.data as DailyMission;
                      const statusMeta = STATUS_MISSAO[mission.status as keyof typeof STATUS_MISSAO] || {
                        label: mission.status,
                        cor: '#4b5563',
                        fundo: '#f3f4f6',
                        icone: '📌'
                      };

                      const gmapsUrl = mission.location_link || (mission.location_address ? `https://maps.google.com/?q=${encodeURIComponent(mission.location_address)}` : '');
                      const wazeUrl = mission.is_pbm_araquari
                        ? 'https://waze.com/ul?ll=-26.3752,-48.7214&navigate=yes'
                        : (mission.location_address ? `https://waze.com/ul?q=${encodeURIComponent(mission.location_address)}&navigate=yes` : '');

                      return (
                        <div key={`mission-${mission.id}`} className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors ${mission.status === 'concluida' ? 'bg-gray-50/50' : ''}`}>
                          <div
                            onClick={() => isEditor && setSelectedMissionForConclusion(mission)}
                            title={isEditor ? "Clique para registrar conclusão ou resultado" : ""}
                            className={`w-7 h-7 mt-0.5 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 ${isEditor ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                            style={{ backgroundColor: statusMeta.fundo, borderColor: statusMeta.cor }}
                          >
                            <span className="text-sm">{statusMeta.icone}</span>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-semibold text-[#2c1810] ${mission.status === 'concluida' ? 'line-through opacity-60' : ''}`}>
                                {mission.title}
                              </p>
                              <span
                                className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                                style={{ backgroundColor: statusMeta.fundo, color: statusMeta.cor }}
                              >
                                {statusMeta.label}
                              </span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                mission.priority === 'urgente' ? 'bg-red-100 text-red-600' :
                                mission.priority === 'alta' ? 'bg-orange-100 text-orange-600' :
                                mission.priority === 'media' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600'
                              }`}>
                                {mission.priority || 'média'}
                              </span>
                            </div>

                            {mission.description && <p className="text-[11px] text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">{mission.description}</p>}

                            {/* Endereço / Links para Maps & Waze */}
                            {(mission.location_address || mission.is_pbm_araquari) && (
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px]">
                                <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">location_on</span>
                                  {mission.is_pbm_araquari ? 'PBM ARAQUARI' : mission.location_address}
                                </span>
                                {gmapsUrl && (
                                  <a
                                    href={gmapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-bold flex items-center gap-0.5 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">map</span>
                                    Google Maps
                                  </a>
                                )}
                                {wazeUrl && (
                                  <a
                                    href={wazeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-700 hover:underline font-bold flex items-center gap-0.5 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-100"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">navigation</span>
                                    Waze
                                  </a>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {mission.start_time && (
                                <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                                  {mission.start_time} {mission.end_time ? `- ${mission.end_time}` : ''}
                                </span>
                              )}
                              {mission.responsible_name && (
                                <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">person</span>
                                  Resp: {mission.responsible_name}
                                </span>
                              )}
                              {mission.completed_by && (
                                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  <span className="material-symbols-outlined text-[14px]">verified</span>
                                  Concluído por: {mission.completed_by}
                                </span>
                              )}
                            </div>

                            {/* Exibir observação de encerramento se houver */}
                            {mission.observacoes && (
                              <div className="mt-1.5 p-2 bg-amber-50/70 border border-amber-200/60 rounded text-[11px] text-amber-900">
                                <strong>Obs:</strong> {mission.observacoes}
                              </div>
                            )}
                          </div>

                          {isEditor && (
                            <button
                              type="button"
                              onClick={() => setSelectedMissionForConclusion(mission)}
                              className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit_note</span>
                              Resultado
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Progress Bar (missions only) */}
                    {missions.length > 0 && (
                      <div className="p-4 bg-stone-50/50 border-t border-rustic-border/20">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black uppercase text-gray-400">Progresso das Missões</span>
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
                    )}
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

            {/* Card de Clima de Araquari - SC */}
            <CardClimaAraquari />

            {/* Birthday Card */}
            <BirthdayCard selectedDate={selectedDate} />

            {/* Alteração de Efetivo */}
            <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-5 space-y-5">
              <h2 className="font-bold text-[#2c1810] flex items-center gap-2 text-sm border-b border-rustic-border/30 pb-3">
                <span className="material-symbols-outlined text-primary">groups</span>
                Alteração de Efetivo
              </h2>

              {/* 1. Guarnição de Serviço do Dia */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-rustic-brown/70 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">shield_person</span>
                  Guarnição de Serviço do Dia
                  {escalaMilitares.length > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      {totalAfastadosNaEscala > 0 && (
                        <span className="text-[10px] font-bold bg-amber-100/90 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1" title="Militares escalados com afastamento no dia">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                          {totalAfastadosNaEscala} afastado(s)
                        </span>
                      )}
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        {escalaMilitares.length}
                      </span>
                    </div>
                  )}
                </h3>
                {escala?.equipe && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[16px]">group</span>
                      <span className="text-xs font-black text-primary uppercase">{escala.equipe}</span>
                    </div>
                    {totalAfastadosNaEscala > 0 && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        ⚠️ Atenção: Militar(es) na escala com afastamento
                      </span>
                    )}
                  </div>
                )}
                {escalaMilitares.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                    {escalaMilitares.map((p: Personnel) => {
                      const afastamento = vacations.find(v => {
                        if (v.leave_type === 'desconto_ferias') return false;
                        const matchPerson = Number(v.personnel_id) === Number(p.id) ||
                          (v.full_name && p.name && v.full_name.toLowerCase().trim() === p.name.toLowerCase().trim());
                        return matchPerson && v.start_date <= selectedDate && v.end_date >= selectedDate;
                      });

                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                            afastamento
                              ? 'bg-amber-500/10 border-amber-500/30 relative overflow-hidden shadow-2xs'
                              : 'bg-background-light border-rustic-border/50'
                          }`}
                        >
                          {afastamento && (
                            <div className="w-1 bg-amber-500 absolute left-0 top-0 bottom-0"></div>
                          )}
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className={`w-7 h-7 rounded-full object-cover border ${
                                afastamento ? 'border-amber-400 ml-1' : 'border-rustic-border'
                              }`}
                            />
                          ) : (
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                afastamento ? 'bg-amber-500/20 ml-1' : 'bg-primary/10'
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-[14px] ${
                                  afastamento ? 'text-amber-700' : 'text-primary'
                                }`}
                              >
                                person
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="text-xs font-bold text-[#2c1810] truncate">
                                {p.rank} {p.war_name || p.name}
                              </p>
                              {afastamento && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-950 border border-amber-500/40 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                                  {getLeaveLabel(afastamento.leave_type)}
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-rustic-brown/60 truncate">
                              {p.role || p.type}
                              {afastamento && (
                                <span className="text-amber-800 font-semibold ml-1">
                                  • (Afastado: {formatLocalDate(afastamento.start_date)} a {formatLocalDate(afastamento.end_date)})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-rustic-brown/40 italic pl-1">Nenhuma guarnição escalada para hoje.</p>
                )}
              </div>

              {/* 2. Trocas de Serviço do Dia */}
              <div className="space-y-3 pt-3 border-t border-rustic-border/30">
                <h3 className="text-xs font-black uppercase text-rustic-brown/70 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">published_with_changes</span>
                  Trocas de Serviço do Dia
                  {swapsForToday.length > 0 && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full ml-auto">
                      {swapsForToday.length}
                    </span>
                  )}
                </h3>
                {swapsForToday.length > 0 ? (
                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                    {swapsForToday.map((s, idx) => {
                      const reqDetails = getPersonnelDetails(s.personnel_id);
                      const coverDetails = getPersonnelDetails(s.swap_with_personnel_id);
                      const isApproved = s.approval_status === 'Aprovado';
                      const isPending = s.approval_status === 'Pendente';
                      
                      return (
                        <div key={s.id || idx} className="p-3 rounded-lg bg-background-light border border-rustic-border/50 space-y-2.5 text-xs shadow-sm">
                          {/* Header with status and dates */}
                          <div className="flex justify-between items-center border-b border-rustic-border/20 pb-2">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                              isApproved ? 'bg-green-50 text-green-700 border-green-200' :
                              isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {s.approval_status || 'Pendente'}
                            </span>
                            <span className="text-[10px] text-rustic-brown/65 flex items-center gap-1 font-semibold">
                              <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                              {formatLocalDate(s.original_date)} ⇄ {formatLocalDate(s.new_date)}
                            </span>
                          </div>

                          {/* Saindo (Requester) */}
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[9px] font-black text-red-600 uppercase tracking-wider">
                              <span className="material-symbols-outlined text-[12px]">logout</span>
                              <span>Saindo</span>
                            </div>
                            {reqDetails ? (
                              <div className="pl-4 space-y-0.5">
                                <p className="font-bold text-xs text-[#2c1810]">{reqDetails.name}</p>
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-rustic-brown/60">
                                  <span>Mat: <span className="font-bold text-rustic-brown">{reqDetails.matricula}</span></span>
                                  <span>•</span>
                                  <span>CNH: <span className="font-bold text-rustic-brown">{reqDetails.cnhCategory}</span></span>
                                  <span>•</span>
                                  <span className={`font-bold ${reqDetails.cveActive ? 'text-green-600' : 'text-stone-500'}`}>
                                    {reqDetails.cveActive ? 'CVE Ativo' : 'CVE Inativo'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="pl-4 text-rustic-brown/50 italic text-[10px]">Militar não encontrado</p>
                            )}
                          </div>

                          {/* Connection Arrow */}
                          <div className="flex items-center justify-center -my-1 text-rustic-brown/30">
                            <span className="material-symbols-outlined text-sm font-black">arrow_downward</span>
                          </div>

                          {/* Assumindo (Substituto - Azul) */}
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase tracking-wider">
                              <span className="material-symbols-outlined text-[12px] text-blue-600">login</span>
                              <span>Assumindo</span>
                            </div>
                            {coverDetails ? (
                              <div className="pl-4 space-y-0.5">
                                <p className="font-bold text-xs text-blue-900">{coverDetails.name}</p>
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-blue-800/80">
                                  <span>Mat: <span className="font-bold text-blue-900">{coverDetails.matricula}</span></span>
                                  <span>•</span>
                                  <span>CNH: <span className="font-bold text-blue-900">{coverDetails.cnhCategory}</span></span>
                                  <span>•</span>
                                  <span className={`font-bold ${coverDetails.cveActive ? 'text-blue-700' : 'text-stone-500'}`}>
                                    {coverDetails.cveActive ? 'CVE Ativo' : 'CVE Inativo'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="pl-4">
                                <p className="font-bold text-xs text-blue-800/60">Folga / Serviço</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-rustic-brown/40 italic pl-1 py-1">
                    Não há trocas de serviço registradas para hoje.
                  </p>
                )}
              </div>

              {/* 3. Férias e Afastamentos Ativos no Dia */}
              <div className="space-y-3 pt-3 border-t border-rustic-border/30">
                <h3 className="text-xs font-black uppercase text-rustic-brown/70 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
                  Férias e Afastamentos Ativos
                  {vacationsOnDate.length > 0 && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full ml-auto">
                      {vacationsOnDate.length}
                    </span>
                  )}
                </h3>
                {vacationsOnDate.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {vacationsOnDate.map((v, idx) => {
                      const name = v.full_name || getPersonnelName(v.personnel_id);
                      const leaveLabel = getLeaveLabel(v.leave_type);
                      return (
                        <div key={v.id || idx} className="p-2.5 rounded-lg bg-background-light border border-rustic-border/50 space-y-1 text-xs">
                          <div className="flex justify-between items-start gap-1">
                            <p className="font-bold text-[#2c1810] leading-tight">{name}</p>
                            <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                              {leaveLabel}
                            </span>
                          </div>
                          <div className="text-[10px] text-rustic-brown/65 flex items-center gap-1 font-semibold">
                            <span className="material-symbols-outlined text-[12px]">date_range</span>
                            <span>{formatLocalDate(v.start_date)} a {formatLocalDate(v.end_date)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-rustic-brown/40 italic pl-1">Nenhum afastamento ou férias ativo nesta data.</p>
                )}
              </div>
            </section>

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
                ) : (
                  <>
                    {vtrsExibidas.map(v => (
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

                    {fleet.length > vtrsExibidas.length && !expandido && (
                      <button
                        onClick={() => setExpandido(true)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          marginTop: '8px',
                          background: 'none',
                          border: '1px dashed #cbd5e1',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: '#64748b',
                          fontSize: '13px',
                        }}
                      >
                        ▼ Ver todas as viaturas ({fleet.length - vtrsExibidas.length} a mais)
                      </button>
                    )}

                    {expandido && (
                      <button
                        onClick={() => setExpandido(false)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          marginTop: '8px',
                          background: 'none',
                          border: '1px dashed #cbd5e1',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: '#64748b',
                          fontSize: '13px',
                        }}
                      >
                        ▲ Mostrar menos
                      </button>
                    )}
                  </>
                )}
              </div>
              <button onClick={() => window.location.href = '/logistica'} className="w-full mt-4 py-2 border border-rustic-border text-rustic-brown text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Gerenciar Frota (B4)
              </button>
            </section>

            {/* HISTÓRICO DE AVISOS */}
            {reports.length > 0 && (
              <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-6">
                <h2 className="font-bold text-[#2c1810] mb-3 flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-primary">history</span>
                  Histórico de Avisos
                </h2>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {reports.map((rep) => (
                    <div key={rep.id} className="text-xs p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-start gap-3 group">
                      <div className="flex-1 min-w-0">
                        <span className="font-bold block text-primary text-[11px]">{formatDateBR(rep.report_date)}</span>
                        <p className="text-rustic-brown/80 line-clamp-3 mt-0.5">{rep.description}</p>
                        {rep.created_at && (
                          <span className="text-[9px] text-gray-400 mt-1 block">{timeAgo(rep.created_at)}</span>
                        )}
                      </div>
                      {isEditor && (
                        <button
                          onClick={() => handleDeleteReport(rep.id!)}
                          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                          title="Excluir aviso"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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

      {/* MODAIS UNIFICADOS DE MISSÃO */}
      <DailyMissionModal
        isOpen={isNewMissionModalOpen}
        onClose={() => setIsNewMissionModalOpen(false)}
        onSave={async (missionData) => {
          await SupabaseService.addDailyMission(missionData);
          loadData();
        }}
      />

      <ConcluirMissaoModal
        isOpen={!!selectedMissionForConclusion}
        onClose={() => setSelectedMissionForConclusion(null)}
        mission={selectedMissionForConclusion}
        onSuccess={() => loadData()}
      />
    </div>
  );
};

export default DashboardAvisos;