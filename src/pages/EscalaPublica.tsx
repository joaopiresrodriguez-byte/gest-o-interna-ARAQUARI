import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Escala, Personnel, Vacation } from '../services/types';
import ScaleCalendar from '../components/b1/ScaleCalendar';
import { ScaleReportingService } from '../services/scaleReportingService';

export const EscalaPublica: React.FC = () => {
  const [searchParams] = useSearchParams();
  const mesParam = searchParams.get('mes') || '';
  const militarParam = searchParams.get('militar') || '';

  const [month, setMonth] = useState<string>(() => {
    if (mesParam) return mesParam;
    const agora = new Date();
    const a = agora.getFullYear();
    const m = agora.getMonth() + 1;
    return `${a}-${String(m).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [filtroMilitar, setFiltroMilitar] = useState<string>(militarParam);

  const carregarDados = async () => {
    try {
      setLoading(true);

      const [resEscalas, resPersonnel, resVacations] = await Promise.all([
        supabase.from('escalas').select('*').order('data'),
        supabase.from('personnel').select('*').eq('status', 'Ativo').order('name'),
        supabase.from('personnel_vacations').select('*'),
      ]);

      setEscalas((resEscalas.data as Escala[]) || []);
      setPersonnelList((resPersonnel.data as Personnel[]) || []);
      setVacations((resVacations.data as Vacation[]) || []);
    } catch (err) {
      console.error('Erro ao carregar escala pública:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [month]);

  // Formatação do mês
  const [ano, mes] = month.split('-');
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesExtenso = `${meses[parseInt(mes, 10) - 1] || mes} de ${ano}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-3 sm:p-6 md:p-8 selection:bg-red-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800/60 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                CBMSC Araquari — 3º/1ª/7ºBBM
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Escala Operacional Publicada</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Visualização oficial de serviço — Mês de <strong className="text-red-400">{mesExtenso}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => ScaleReportingService.generateMonthlyScalePDF(month, escalas, personnelList, vacations)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-red-950/50"
              >
                <span>📄</span> Baixar PDF Oficial
              </button>
            </div>
          </div>
        </div>

        {/* CALENDÁRIO OFICIAL B1 */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3"></div>
            <p className="text-xs font-semibold text-slate-400">Carregando calendário da escala...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xl text-slate-900">
            <ScaleCalendar
              month={month}
              escalas={escalas}
              personnelList={personnelList}
              vacations={vacations}
              onMonthChange={setMonth}
            />
          </div>
        )}

        {/* RODAPÉ */}
        <div className="text-center text-xs text-slate-500 pt-4 pb-8">
          Corpo de Bombeiros Militar de Santa Catarina — Araquari • Atualizado em tempo real pelo sistema interno.
        </div>

      </div>
    </div>
  );
};
