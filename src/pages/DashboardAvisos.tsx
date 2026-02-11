import React, { useState, useEffect } from 'react';
import { SupabaseService, DailyMission, Vehicle, GuReport } from '../services/SupabaseService';
import { supabase } from '../services/supabase';
import { DefesaCivilTicker } from '../components/DefesaCivilTicker';
import { BirthdayCard } from '../components/BirthdayCard';

const DashboardAvisos: React.FC = () => {
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [reports, setReports] = useState<GuReport[]>([]);
  const [guReportText, setGuReportText] = useState("");
  const [selectedDate, setSelectedDate] = useState(SupabaseService.getTodayDate());
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [missionsData, fleetData, reportsData] = await Promise.all([
        SupabaseService.getDailyMissions({ data: selectedDate }),
        SupabaseService.getFleet(),
        SupabaseService.getGuReports()
      ]);
      setMissions(missionsData);
      setFleet(fleetData);
      setReports(reportsData);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
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
          table: 'missoes_diarias',
          filter: `mission_date=eq.${selectedDate}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const toggleMission = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'concluida' ? 'em_andamento' : 'concluida';
    // Optimistic Update
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status: newStatus as any } : m));
    try {
      await SupabaseService.updateDailyMission(id, { status: newStatus as any });
    } catch (error) {
      console.error("Error updating status:", error);
      loadData(); // Revert on error
    }
  };

  const handleAddMission = () => {
    // Redirect to B4 to keep it centralized
    window.location.href = '/logistica?tab=missoes';
  };

  const handleSaveReport = async () => {
    if (!guReportText) return alert("Digite algo no aviso.");

    await SupabaseService.addGuReport({
      title: "Aviso Gerais",
      description: guReportText,
      type: "geral",
      responsible_id: "user-id-placeholder", // TODO: Get actual user ID
      report_date: selectedDate
    });

    alert("Aviso salvo!");
    setGuReportText(""); // Clear after save
    loadData(); // Update history
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm("Excluir este aviso do histórico?")) return;
    try {
      await SupabaseService.deleteGuReport(id);
      loadData();
    } catch (error) {
      alert("Erro ao excluir aviso.");
    }
  };

  // Logic to find "Yesterday's" report relative to selectedDate
  const getYesterdayDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  const targetDate = getYesterdayDate(selectedDate);
  const avisoDoDia = reports.find(r => r.report_date === targetDate);

  // We also want to display Today's report if I (the current Chief) wrote one, 
  // but the prompt stresses "aviso diversa ao chefe que entra... aparecer o texto do dia anterior".
  // So the MAIN display component should be `avisoDoDia` (Yesterday's text).
  // The input is for ME (Today's Chief) to write for Tomorrow's Chief.

  return (
    <div className="flex-1 flex flex-col h-full bg-background-light overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-surface border-b border-rustic-border shadow-sm z-30">
        <div className="py-4 px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-[#2e1a16] tracking-tight">Aviso diversa ao chefe de socorro</h1>
            <p className="text-rustic-brown/60 text-sm">Visão Geral e Passagem de Plantão</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white border border-rustic-border rounded-lg px-3 py-1.5 shadow-sm">
              <span className="material-symbols-outlined text-rustic-brown/50 mr-2 text-[20px]">calendar_today</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-rustic-brown outline-none"
              />
            </div>
            <button onClick={loadData} className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-red-700 transition-colors shadow-md">
              <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>

        {/* Defesa Civil Ticker */}
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
                Aviso do Plantão Anterior ({targetDate.split('-').reverse().join('/')})
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
            </section>

            <section className="bg-surface rounded-xl border border-rustic-border shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#2c1810] to-[#4a2c20] px-6 py-4 flex justify-between items-center">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">Format_list_bulleted</span>
                  Missões do Dia
                </h2>
                <button onClick={handleAddMission} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
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
                          className={`w-6 h-6 mt-0.5 rounded border-2 cursor-pointer flex items-center justify-center transition-all ${mission.status === 'concluida' ? 'bg-green-600 border-green-600' : 'border-rustic-border hover:border-primary'}`}
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
                          {missions.filter(m => m.status === 'concluida').length} de {missions.length} concluídas
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${(missions.filter(m => m.status === 'concluida').length / (missions.length || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Column 2: Status da Frota + Birthday */}
          <div className="space-y-6">

            {/* Birthday Card */}
            <BirthdayCard selectedDate={selectedDate} />

            <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-[#2c1810] flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">directions_car</span>
                  Status da Frota
                </h2>
                <span className="text-xs font-bold text-primary bg-red-50 px-2 py-1 rounded-md">Ao Vivo</span>
              </div>

              <div className="space-y-4">
                {fleet.length === 0 ? <p className="text-gray-400 text-sm">Carregando frota...</p> : fleet.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-background-light border border-rustic-border/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${v.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                      <div>
                        <span className="font-bold text-[#2c1810] block">{v.name}</span>
                        <span className="text-[10px] uppercase font-bold text-rustic-brown/50">{v.type} • {v.plate || '---'}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${v.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {v.status === 'active' ? 'QAP' : 'BAIXADA'}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.href = '/logistica'} className="w-full mt-4 py-2 border border-rustic-border text-rustic-brown text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Gerenciar Frota (B4)
              </button>
            </section>

            {/* CREATE NEW AVISO (Para o Próximo Plantão) */}
            <section className="bg-surface rounded-xl border border-rustic-border shadow-sm p-6">
              <h2 className="font-bold text-[#2c1810] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                Deixar Aviso
              </h2>
              <p className="text-xs text-rustic-brown/60 mb-2">Este aviso será exibido para o Chefe de Socorro de amanhã.</p>
              <textarea
                value={guReportText}
                onChange={(e) => setGuReportText(e.target.value)}
                className="w-full h-32 rounded-lg border border-rustic-border bg-background-light p-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none mb-2"
                placeholder="Digite o aviso para o próximo plantão..."
              ></textarea>
              <div className="flex justify-between items-center">
                <span className="text-xs text-rustic-brown/50 italic">Salvo como registro do dia {selectedDate.split('-').reverse().join('/')}</span>
                <button onClick={handleSaveReport} className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-all active:scale-95">
                  Salvar Aviso
                </button>
              </div>

              {/* Simple History List */}
              {reports.length > 0 && (
                <div className="mt-6 border-t border-rustic-border pt-4">
                  <h3 className="text-sm font-bold text-rustic-brown mb-2">Histórico de Avisos Enviados</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {reports.map((rep) => (
                      <div key={rep.id} className="text-xs p-2 bg-gray-50 rounded border border-gray-100 flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <span className="font-bold block text-primary">{rep.report_date}</span>
                          <p className="text-rustic-brown/80 line-clamp-2">{rep.description}</p>
                        </div>
                        <button onClick={() => handleDeleteReport(rep.id!)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

          </div>

        </div>
      </div>
    </div>
  );
};

export default DashboardAvisos;