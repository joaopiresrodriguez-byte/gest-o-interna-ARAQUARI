import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Personnel, DocumentB1, Vacation, AlertItem, RankHistory, ServiceSwap, DisciplinaryRecord, Bulletin, BulletinNote, BulletinVersion, SigrhExport, Escala, B1Course, EpiDelivery, InternalNotification } from '../services/types';
import { PersonnelService } from '../services/personnelService';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { supabase } from '../services/supabase';
import AlertsDashboard from '../components/b1/AlertsDashboard';
import DisciplinarySection from '../components/b1/DisciplinarySection';
import BulletinSection from '../components/b1/BulletinSection';
import ReadinessReport from '../components/b1/ReadinessReport';
import PersonnelProfile from '../components/b1/PersonnelProfile';
import ExportSection from '../components/b1/ExportSection';
import CursosB1 from '../components/b1/CursosB1';
import EpiB1 from '../components/b1/EpiB1';
import DisponibilidadeB1 from '../components/b1/DisponibilidadeB1';
import NotificacoesB1 from '../components/b1/NotificacoesB1';
import DashboardComandante from '../components/b1/DashboardComandante';

type Tab = 'ALERTAS' | 'EFETIVO' | 'CADASTRO' | 'ESCALA' | 'FERIAS' | 'BOLETIM' | 'DISCIPLINA' | 'PRONTIDAO' | 'PERFIL' | 'EXPORTAR' | 'DOCUMENTOS' | 'CURSOS' | 'EPI' | 'DISPONIBILIDADE' | 'NOTIFICACOES' | 'DASHBOARD';

const tabIcons: Record<Tab, string> = { ALERTAS: 'notifications_active', EFETIVO: 'groups', CADASTRO: 'person_add', ESCALA: 'calendar_month', FERIAS: 'beach_access', BOLETIM: 'article', DISCIPLINA: 'gavel', PRONTIDAO: 'shield', PERFIL: 'badge', EXPORTAR: 'upload_file', DOCUMENTOS: 'folder', CURSOS: 'school', EPI: 'checkroom', DISPONIBILIDADE: 'location_on', NOTIFICACOES: 'notifications', DASHBOARD: 'dashboard' };

const RANKS_BM = ['Sd', 'Cb', '3º Sgt', '2º Sgt', '1º Sgt', 'Sub Ten', 'Asp Of', '2º Ten', '1º Ten', 'Cap', 'Maj', 'Ten Cel', 'Cel'];
const STATUS_OPTIONS = ['Ativo', 'Férias', 'Licença', 'Afastado', 'Cedido'];
const LEAVE_TYPES = [{ value: 'ferias', label: 'Férias' }, { value: 'licenca_medica', label: 'Licença Médica' }, { value: 'licenca_especial', label: 'Licença Especial' }, { value: 'afastamento', label: 'Afastamento' }, { value: 'cedido', label: 'Cedido' }, { value: 'outros', label: 'Outros' }];

const validateCpf = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11 || /^(\d)\1+$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(cleaned[9]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return parseInt(cleaned[10]) === d2;
};

const calcExpiry = (issueDate: string, years: number): string => {
  const d = new Date(issueDate);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
};

const emptyForm = (): Partial<Personnel> => ({
  name: '', war_name: '', rank: 'Sd', role: '', status: 'Ativo' as const, type: 'BM' as const,
  address: '', email: '', birth_date: '', phone: '', blood_type: '', cnh: '', weapon_permit: false,
  education_level: '', cnh_category: '', cnh_number: '', cnh_expiry_date: '', cpf: '',
  emergency_phone: '', emergency_contact_name: '', cve_active: '', cve_issue_date: '', cve_expiry_date: '',
  toxicological_date: '', toxicological_expiry_date: '', graduation: '',
});

const PessoalB1: React.FC = () => {
  const [tab, setTab] = useState<Tab>('ALERTAS');
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [documents, setDocuments] = useState<DocumentB1[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState<Partial<Personnel>>(emptyForm());
  const [editId, setEditId] = useState<number | null>(null);

  // Vacation form
  const [vacPersonnelId, setVacPersonnelId] = useState<number | ''>('');
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacType, setVacType] = useState('ferias');
  const [vacNotes, setVacNotes] = useState('');

  // Scale state
  const [scaleMonth, setScaleMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; });
  const [scaleTeams, setScaleTeams] = useState<Record<string, number[]>>(() => {
    try { return JSON.parse(localStorage.getItem('b1_scale_teams') || '{}'); } catch { return {}; }
  });
  const [scaleShiftType, setScaleShiftType] = useState<'24x72' | '12x36' | 'administrative'>('24x72');

  // Swap form
  const [swapPersonId, setSwapPersonId] = useState<number | ''>('');
  const [swapOrigDate, setSwapOrigDate] = useState('');
  const [swapNewDate, setSwapNewDate] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapWithId, setSwapWithId] = useState<number | ''>('');

  // Profile view
  const [profilePerson, setProfilePerson] = useState<Personnel | null>(null);
  const [profileRankHistory, setProfileRankHistory] = useState<RankHistory[]>([]);
  const [profileSwaps, setProfileSwaps] = useState<ServiceSwap[]>([]);
  const [profileDisciplinary, setProfileDisciplinary] = useState<DisciplinaryRecord[]>([]);
  const [profileVacations, setProfileVacations] = useState<Vacation[]>([]);
  const [profileDocs, setProfileDocs] = useState<DocumentB1[]>([]);

  // Sub-section data
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<DisciplinaryRecord[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [sigrhExports, setSigrhExports] = useState<SigrhExport[]>([]);

  // New modules state
  const [courses, setCourses] = useState<B1Course[]>([]);
  const [epiDeliveries, setEpiDeliveries] = useState<EpiDelivery[]>([]);
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);

  // Rank change
  const [rankChangeNewRank, setRankChangeNewRank] = useState('');
  const [rankChangeLegalBasis, setRankChangeLegalBasis] = useState('');

  // Document upload
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('');
  const [docPersonId, setDocPersonId] = useState<number | ''>('');
  const [docNotes, setDocNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pList, vList, dList] = await Promise.all([
        PersonnelService.getPersonnel(),
        PersonnelService.getVacations(),
        PersonnelService.getDocumentsB1(),
      ]);
      setPersonnelList(pList);
      setVacations(vList);
      setDocuments(dList);

      // Generate alerts with swap counts
      const swapCounts = new Map<number, number>();
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      for (const p of pList) {
        if (p.id) {
          const count = await PersonnelService.getSwapCountThisMonth(p.id, currentMonth);
          if (count > 0) swapCounts.set(p.id, count);
        }
      }
      setAlerts(PersonnelService.generateAlerts(pList, vList, swapCounts));

      // Load new module data in parallel
      const [courseList, epiList, notifList, escalasData] = await Promise.all([
        PersonnelService.getCourses(),
        PersonnelService.getEpiDeliveries(),
        PersonnelService.getNotifications(),
        supabase.from('escalas').select('*').order('data', { ascending: false }).limit(90),
      ]);
      setCourses(courseList);
      setEpiDeliveries(epiList);
      setNotifications(notifList);
      setEscalas((escalasData.data || []) as Escala[]);
    } catch (err: any) {
      toast.error('Erro ao carregar dados: ' + (err.message || 'Desconhecido'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDisciplinary = async () => {
    try { setDisciplinaryRecords(await PersonnelService.getDisciplinaryRecords()); } catch { }
  };
  const loadBulletins = async () => {
    try { setBulletins(await PersonnelService.getBulletins()); } catch { }
  };
  const loadExports = async () => {
    try { setSigrhExports(await PersonnelService.getSigrhExports()); } catch { }
  };

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (tab === 'DISCIPLINA') loadDisciplinary();
    if (tab === 'BOLETIM') loadBulletins();
    if (tab === 'EXPORTAR') loadExports();
  }, [tab]);

  // ===== CRUD Handlers =====
  const handleSavePersonnel = async () => {
    if (!formData.name) return toast.error('Nome é obrigatório!');
    if (formData.cpf && !validateCpf(formData.cpf)) return toast.error('CPF inválido!');

    // Auto-calculate expiry dates
    const cleanedData = { ...formData };
    if (cleanedData.cve_issue_date) cleanedData.cve_expiry_date = calcExpiry(cleanedData.cve_issue_date, 5);
    if (cleanedData.toxicological_date) cleanedData.toxicological_expiry_date = calcExpiry(cleanedData.toxicological_date, 2);
    cleanedData.last_cadastro_review = new Date().toISOString().split('T')[0];

    // Remove empty strings for DB
    Object.keys(cleanedData).forEach(k => { if ((cleanedData as any)[k] === '') delete (cleanedData as any)[k]; });

    try {
      if (editId) {
        await PersonnelService.updatePersonnel(editId, cleanedData);
        toast.success('Militar atualizado!');
      } else {
        await PersonnelService.addPersonnel(cleanedData as Personnel);
        toast.success('Militar cadastrado!');
      }
      GoogleSheetsService.syncPersonnel(cleanedData).then(ok => { if (ok) toast.info('📊 Sincronizado com Google Sheets.'); });
      setFormData(emptyForm());
      setEditId(null);
      loadData();
      setTab('EFETIVO');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  };

  const handleDeletePersonnel = async (id: number) => {
    if (!confirm('Remover militar?')) return;
    try { await PersonnelService.deletePersonnel(id); toast.success('Removido!'); loadData(); } catch (err: any) { toast.error('Erro: ' + err.message); }
  };

  const handleEdit = (p: Personnel) => {
    setFormData(p);
    setEditId(p.id || null);
    setTab('CADASTRO');
  };

  const handleViewProfile = async (person: Personnel) => {
    setProfilePerson(person);
    if (person.id) {
      const [rh, sw, dc, vc, docs] = await Promise.all([
        PersonnelService.getRankHistory(person.id),
        PersonnelService.getServiceSwaps(person.id),
        PersonnelService.getDisciplinaryRecords(person.id),
        PersonnelService.getVacations(person.id),
        PersonnelService.getDocumentsB1(person.id),
      ]);
      setProfileRankHistory(rh);
      setProfileSwaps(sw);
      setProfileDisciplinary(dc);
      setProfileVacations(vc);
      setProfileDocs(docs);
    }
    setTab('PERFIL');
  };

  // Save Vacation
  const handleSaveVacation = async () => {
    if (!vacPersonnelId || !vacStart || !vacEnd) return toast.error('Preencha todos os campos!');
    const person = personnelList.find(p => p.id === vacPersonnelId);
    const dayCount = Math.ceil((new Date(vacEnd).getTime() - new Date(vacStart).getTime()) / 86400000) + 1;
    try {
      await PersonnelService.addVacation({ personnel_id: vacPersonnelId as number, full_name: person?.name || '', start_date: vacStart, end_date: vacEnd, day_count: dayCount, leave_type: vacType, status: 'planejado', notes: vacNotes });
      PersonnelService.addNotification({
        title: 'Férias/Licença Registrada',
        message: `${person?.name || 'Militar'}: ${LEAVE_TYPES.find(lt => lt.value === vacType)?.label || vacType} de ${vacStart} a ${vacEnd}.`,
        source_event: 'vacation_registered', is_read: false,
        target_personnel_id: vacPersonnelId as number,
      }).catch(() => { });
      toast.success('Período registrado!');
      setVacPersonnelId(''); setVacStart(''); setVacEnd(''); setVacNotes('');
      loadData();
    } catch (err: any) { toast.error('Erro: ' + err.message); }
  };

  // Handle Swap
  const handleSaveSwap = async () => {
    if (!swapPersonId || !swapOrigDate || !swapNewDate || !swapReason) return toast.error('Preencha todos os campos!');
    const monthRef = swapOrigDate.substring(0, 7);
    const count = await PersonnelService.getSwapCountThisMonth(swapPersonId as number, monthRef);
    if (count >= 2) return toast.error(`⛔ BLOQUEADO: Militar já possui ${count} trocas neste mês. Limite de 2 trocas/mês atingido.`);
    try {
      await PersonnelService.addServiceSwap({ personnel_id: swapPersonId as number, original_date: swapOrigDate, new_date: swapNewDate, swap_with_personnel_id: swapWithId ? swapWithId as number : undefined, reason: swapReason, swap_date: new Date().toISOString().split('T')[0], month_ref: monthRef });
      const swapPerson = personnelList.find(p => p.id === swapPersonId);
      PersonnelService.addNotification({
        title: 'Troca de Serviço Registrada',
        message: `${swapPerson?.name || 'Militar'}: troca de ${swapOrigDate} para ${swapNewDate}. Motivo: ${swapReason}`,
        source_event: 'swap_registered', is_read: false,
        target_personnel_id: swapPersonId as number,
      }).catch(() => { });
      toast.success('Troca de serviço registrada!');
      setSwapPersonId(''); setSwapOrigDate(''); setSwapNewDate(''); setSwapReason(''); setSwapWithId('');
      loadData();
    } catch (err: any) { toast.error('Erro: ' + err.message); }
  };

  // Handle rank change
  const handleRankChange = async (person: Personnel) => {
    if (!rankChangeNewRank || !rankChangeLegalBasis) return toast.error('Informe a nova graduação e base legal!');
    try {
      await PersonnelService.addRankHistory({ personnel_id: person.id!, previous_rank: person.graduation || person.rank, new_rank: rankChangeNewRank, change_date: new Date().toISOString().split('T')[0], legal_basis: rankChangeLegalBasis });
      await PersonnelService.updatePersonnel(person.id!, { graduation: rankChangeNewRank });
      toast.success('Graduação atualizada e histórico registrado!');
      setRankChangeNewRank(''); setRankChangeLegalBasis('');
      loadData();
    } catch (err: any) { toast.error('Erro: ' + err.message); }
  };

  // Handle document upload
  const handleUploadDoc = async () => {
    if (!docFile || !docType || !docPersonId) return toast.error('Preencha todos os campos!');
    try {
      const path = `b1/${docPersonId}/${Date.now()}_${docFile.name}`;
      const { error: uploadError } = await supabase.storage.from('personnel-documents').upload(path, docFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('personnel-documents').getPublicUrl(path);
      await PersonnelService.addDocumentB1({ file_name: docFile.name, document_type: docType, file_url: urlData.publicUrl, size_kb: Math.round(docFile.size / 1024), personnel_id: docPersonId as number, upload_date: new Date().toISOString() });
      toast.success('Documento anexado!');
      setDocFile(null); setDocType(''); setDocNotes('');
      loadData();
    } catch (err: any) { toast.error('Erro: ' + err.message); }
  };

  // Scale helpers
  const saveTeamConfig = (teams: Record<string, number[]>) => {
    setScaleTeams(teams);
    localStorage.setItem('b1_scale_teams', JSON.stringify(teams));
  };

  const publishScale = async () => {
    const [year, month] = scaleMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const teamKeys = Object.keys(scaleTeams).filter(k => scaleTeams[k].length > 0);
    if (teamKeys.length === 0) return toast.error('Configure pelo menos uma equipe!');

    let saved = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const teamIdx = (d - 1) % teamKeys.length;
      const team = teamKeys[teamIdx];
      try {
        await PersonnelService.saveEscala({ data: dateStr, equipe: team, militares: scaleTeams[team], shift_type: scaleShiftType });
        saved++;
      } catch { }
    }
    toast.success(`Escala publicada: ${saved} dias gerados!`);
    PersonnelService.sendBulkNotification(
      'Escala Publicada',
      `A escala de serviço para ${scaleMonth} foi publicada com ${saved} dias e regime ${scaleShiftType}.`,
      'scale_published'
    ).catch(() => { });
  };

  const filteredPersonnel = personnelList.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.war_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.graduation || '').toLowerCase().includes(search.toLowerCase())
  );

  // ===== RENDER =====
  const formField = (label: string, field: keyof Personnel, type = 'text', options?: string[]) => (
    <div key={field}>
      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">{label}</label>
      {options ? (
        <select value={(formData as any)[field] || ''} onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm">
          <option value="">Selecionar...</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'checkbox' ? (
        <input type="checkbox" checked={!!(formData as any)[field]} onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.checked }))} className="h-5 w-5" />
      ) : (
        <input type={type} value={(formData as any)[field] || ''} onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-2xl">military_tech</span></div>
            <div>
              <h1 className="text-2xl font-black">Seção B1 — Pessoal</h1>
              <p className="text-xs text-gray-400">Gestão completa de efetivo, escalas, documentos e exportações</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center"><span className="text-2xl font-black text-primary block">{personnelList.length}</span><span className="text-gray-400">Total</span></div>
            <div className="text-center"><span className="text-2xl font-black text-green-600 block">{personnelList.filter(p => p.status === 'Ativo').length}</span><span className="text-gray-400">Ativos</span></div>
            {alerts.filter(a => a.severity === 'critical').length > 0 && <div className="text-center"><span className="text-2xl font-black text-red-600 block">{alerts.filter(a => a.severity === 'critical').length}</span><span className="text-gray-400">⚠ Alertas</span></div>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-t border-rustic-border pt-4">
          {(['DASHBOARD', 'ALERTAS', 'EFETIVO', 'CADASTRO', 'DOCUMENTOS', 'ESCALA', 'FERIAS', 'BOLETIM', 'DISCIPLINA', 'PRONTIDAO', 'EXPORTAR', 'CURSOS', 'EPI', 'DISPONIBILIDADE', 'NOTIFICACOES'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${tab === t ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:bg-stone-50'}`}>
              <span className="material-symbols-outlined text-[16px]">{tabIcons[t]}</span>{t.replace('FERIAS', 'FÉRIAS').replace('PRONTIDAO', 'PRONTIDÃO').replace('DISPONIBILIDADE', 'DISPON.').replace('NOTIFICACOES', 'AVISOS').replace('DASHBOARD', 'DASHBOARD')}
              {t === 'ALERTAS' && alerts.filter(a => a.severity === 'critical').length > 0 && <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center ml-1">{alerts.filter(a => a.severity === 'critical').length}</span>}
              {t === 'NOTIFICACOES' && notifications.filter(n => !n.is_read).length > 0 && <span className="w-5 h-5 rounded-full bg-cbm-red text-white text-[9px] flex items-center justify-center ml-1">{notifications.filter(n => !n.is_read).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>}

      {!loading && (
        <>
          {/* TAB: ALERTAS */}
          {tab === 'ALERTAS' && <AlertsDashboard alerts={alerts} onNavigateToProfile={(id) => { const p = personnelList.find(pp => pp.id === id); if (p) handleViewProfile(p); }} />}

          {/* TAB: EFETIVO */}
          {tab === 'EFETIVO' && (
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative"><span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-300 text-[18px]">search</span><input value={search} onChange={e => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-4 rounded-lg border border-rustic-border text-sm" placeholder="Buscar por nome, guerra ou graduação..." /></div>
                <button onClick={() => { setFormData(emptyForm()); setEditId(null); setTab('CADASTRO'); }} className="px-4 py-2.5 bg-primary text-white text-xs font-black rounded-xl flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">add</span> NOVO</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm"><thead className="bg-stone-50"><tr className="text-[10px] font-black uppercase text-gray-400"><th className="px-4 py-3 text-left">Militar</th><th className="px-4 py-3">Graduação</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">CVE Val.</th><th className="px-4 py-3">CNH Val.</th><th className="px-4 py-3">Ações</th></tr></thead>
                  <tbody className="divide-y">{filteredPersonnel.map(p => {
                    const statusColors: Record<string, string> = { Ativo: 'bg-green-100 text-green-700', Férias: 'bg-blue-100 text-blue-700', Licença: 'bg-amber-100 text-amber-700', Afastado: 'bg-orange-100 text-orange-700', Cedido: 'bg-purple-100 text-purple-700' };
                    return (
                      <tr key={p.id} className="hover:bg-stone-50/50 cursor-pointer" onClick={() => handleViewProfile(p)}>
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-[16px]">person</span></div><div><span className="font-bold block">{p.name}</span>{p.war_name && <span className="text-[10px] text-gray-400">({p.war_name})</span>}</div></div></td>
                        <td className="px-4 py-3 text-center font-bold">{p.graduation || p.rank}</td>
                        <td className="px-4 py-3 text-center"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusColors[p.status] || 'bg-gray-100'}`}>{p.status}</span></td>
                        <td className="px-4 py-3 text-center">{p.type}</td>
                        <td className="px-4 py-3 text-center text-[10px]">{p.cve_expiry_date ? <span className={new Date(p.cve_expiry_date) <= new Date() ? 'text-red-600 font-black' : ''}>{new Date(p.cve_expiry_date).toLocaleDateString('pt-BR')}</span> : '—'}</td>
                        <td className="px-4 py-3 text-center text-[10px]">{p.cnh_expiry_date ? <span className={new Date(p.cnh_expiry_date) <= new Date() ? 'text-red-600 font-black' : ''}>{new Date(p.cnh_expiry_date).toLocaleDateString('pt-BR')}</span> : '—'}</td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleEdit(p)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                            <button onClick={() => handleDeletePersonnel(p.id!)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
                {filteredPersonnel.length === 0 && <p className="text-center py-12 text-gray-300">Nenhum militar encontrado.</p>}
              </div>
            </div>
          )}

          {/* TAB: CADASTRO */}
          {tab === 'CADASTRO' && (
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
              <h2 className="font-black text-xl mb-6">{editId ? 'Editar Militar' : 'Novo Cadastro de Militar'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {formField('Nome Completo', 'name')}
                {formField('Nome de Guerra', 'war_name')}
                {formField('Posto / Graduação', 'graduation', 'text', RANKS_BM)}
                {formField('Tipo', 'type', 'text', ['BM', 'BC'])}
                {formField('Status', 'status', 'text', STATUS_OPTIONS)}
                {formField('Função', 'role')}
                {formField('CPF', 'cpf')}
                {formField('Data Nascimento', 'birth_date', 'date')}
                {formField('Email', 'email', 'email')}
                {formField('Telefone', 'phone', 'tel')}
                {formField('Nível de Instrução', 'education_level', 'text', ['Ensino Fundamental', 'Ensino Médio', 'Ensino Superior', 'Pós-Graduação', 'Mestrado', 'Doutorado'])}
                {formField('Tipo Sanguíneo', 'blood_type', 'text', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])}
                {formField('Endereço', 'address')}
                {formField('Contato Emergência', 'emergency_contact_name')}
                {formField('Tel. Emergência', 'emergency_phone', 'tel')}
              </div>
              <h3 className="font-black text-sm uppercase text-gray-500 mb-4 border-t pt-4">Documentos & Habilitações</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {formField('Possui CVE Ativo', 'cve_active', 'text', ['Sim', 'Não'])}
                {formField('Data Emissão CVE', 'cve_issue_date', 'date')}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Validade CVE (auto: +5 anos)</label>
                  <input type="date" value={formData.cve_issue_date ? calcExpiry(formData.cve_issue_date, 5) : formData.cve_expiry_date || ''} readOnly className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-gray-100 text-sm" />
                </div>
                {formField('Cat. CNH', 'cnh_category', 'text', ['A', 'B', 'AB', 'C', 'D', 'E', 'AD', 'AE'])}
                {formField('Nº CNH', 'cnh_number')}
                {formField('Validade CNH', 'cnh_expiry_date', 'date')}
                {formField('Data Toxicológico', 'toxicological_date', 'date')}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Validade Toxicológico (auto: +2 anos)</label>
                  <input type="date" value={formData.toxicological_date ? calcExpiry(formData.toxicological_date, 2) : formData.toxicological_expiry_date || ''} readOnly className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-gray-100 text-sm" />
                </div>
                {formField('Porte de Arma', 'weapon_permit', 'checkbox')}
              </div>

              {/* Rank Change Section (edit mode only) */}
              {editId && (
                <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <h4 className="font-black text-sm mb-3 text-amber-700">Promoção / Alteração de Graduação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="text-[10px] font-black block mb-1">Nova Graduação</label><select value={rankChangeNewRank} onChange={e => setRankChangeNewRank(e.target.value)} className="w-full h-10 px-3 rounded-lg border text-sm"><option value="">Selecionar...</option>{RANKS_BM.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                    <div><label className="text-[10px] font-black block mb-1">Base Legal</label><input value={rankChangeLegalBasis} onChange={e => setRankChangeLegalBasis(e.target.value)} className="w-full h-10 px-3 rounded-lg border text-sm" placeholder="Ex: LC 801/2022 Art. XX" /></div>
                    <div className="flex items-end"><button onClick={() => handleRankChange(formData as Personnel)} className="px-4 py-2.5 bg-amber-600 text-white text-xs font-black rounded-lg">REGISTRAR PROMOÇÃO</button></div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button onClick={handleSavePersonnel} className="px-6 py-3 bg-primary text-white font-black rounded-xl hover:brightness-110">{editId ? 'ATUALIZAR' : 'CADASTRAR'}</button>
                <button onClick={() => { setFormData(emptyForm()); setEditId(null); setTab('EFETIVO'); }} className="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl">CANCELAR</button>
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTOS */}
          {tab === 'DOCUMENTOS' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm h-fit">
                <h3 className="font-black text-lg mb-4">Anexar Documento</h3>
                <div className="space-y-4">
                  <select value={docPersonId} onChange={e => setDocPersonId(Number(e.target.value))} className="w-full h-11 px-4 rounded-lg border text-sm"><option value="">Selecionar militar...</option>{personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation ? `${p.graduation} ` : ''}{p.name}</option>)}</select>
                  <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full h-11 px-4 rounded-lg border text-sm"><option value="">Tipo de documento...</option>{['Certidão', 'Atestado', 'Requerimento', 'Ofício', 'Portaria', 'Outro'].map(o => <option key={o} value={o}>{o}</option>)}</select>
                  <input type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                  <textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} className="w-full h-20 p-3 rounded-lg border text-xs" placeholder="Observações..." />
                  <button onClick={handleUploadDoc} className="w-full py-3 bg-primary text-white font-black rounded-xl">ENVIAR</button>
                </div>
              </div>
              <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                <h3 className="font-black text-lg mb-4">Documentos ({documents.length})</h3>
                <div className="space-y-2">{documents.map(d => {
                  const person = personnelList.find(p => p.id === d.personnel_id);
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-rustic-border hover:border-primary/30 transition-all">
                      <span className="material-symbols-outlined text-primary">description</span>
                      <div className="flex-1 min-w-0"><span className="font-bold text-sm block truncate">{d.file_name}</span><span className="text-[10px] text-gray-400">{d.document_type} {person ? `• ${person.name}` : ''} {d.upload_date ? `• ${new Date(d.upload_date).toLocaleDateString('pt-BR')}` : ''}</span></div>
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500"><span className="material-symbols-outlined text-[16px]">download</span></a>
                    </div>
                  );
                })}{documents.length === 0 && <p className="text-center py-8 text-gray-300 italic">Nenhum documento anexado.</p>}</div>
              </div>
            </div>
          )}

          {/* TAB: ESCALA */}
          {tab === 'ESCALA' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-black text-xl">Escala de Serviço</h2>
                  <div className="flex items-center gap-3">
                    <select value={scaleShiftType} onChange={e => setScaleShiftType(e.target.value as any)} className="h-10 px-3 rounded-lg border text-xs font-bold">
                      <option value="24x72">24×72</option><option value="12x36">12×36</option><option value="administrative">Administrativo</option>
                    </select>
                    <input type="month" value={scaleMonth} onChange={e => setScaleMonth(e.target.value)} className="h-10 px-3 rounded-lg border text-xs font-bold" />
                  </div>
                </div>

                {/* Team config */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {['Alpha', 'Bravo', 'Charlie', 'Delta'].map(team => (
                    <div key={team} className="p-4 bg-stone-50 rounded-xl border border-rustic-border">
                      <h4 className="font-black text-sm mb-3">{team}</h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {(scaleTeams[team] || []).map(pid => {
                          const p = personnelList.find(pp => pp.id === pid);
                          return p ? <div key={pid} className="flex items-center justify-between text-xs p-1.5 bg-white rounded-lg"><span>{p.graduation || ''} {p.war_name || p.name}</span><button onClick={() => { const updated = { ...scaleTeams, [team]: scaleTeams[team].filter(id => id !== pid) }; saveTeamConfig(updated); }} className="text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-[14px]">close</span></button></div> : null;
                        })}
                      </div>
                      <select onChange={e => { if (e.target.value) { const pid = Number(e.target.value); const current = scaleTeams[team] || []; if (!current.includes(pid)) saveTeamConfig({ ...scaleTeams, [team]: [...current, pid] }); e.target.value = ''; } }} className="w-full h-8 px-2 rounded border text-[10px] mt-2">
                        <option value="">+ Adicionar militar...</option>
                        {personnelList.filter(p => p.status === 'Ativo' && !Object.values(scaleTeams).flat().includes(p.id!)).map(p => <option key={p.id} value={p.id}>{p.graduation || ''} {p.war_name || p.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <button onClick={publishScale} className="px-6 py-3 bg-primary text-white font-black rounded-xl hover:brightness-110">PUBLICAR ESCALA DO MÊS</button>
              </div>

              {/* Swap Registration */}
              <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-amber-500">swap_horiz</span> Troca de Serviço <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Limite: 2/mês/militar</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <select value={swapPersonId} onChange={e => setSwapPersonId(Number(e.target.value))} className="h-11 px-3 rounded-lg border text-sm"><option value="">Militar...</option>{personnelList.filter(p => p.status === 'Ativo').map(p => <option key={p.id} value={p.id}>{p.graduation || ''} {p.war_name || p.name}</option>)}</select>
                  <input type="date" value={swapOrigDate} onChange={e => setSwapOrigDate(e.target.value)} className="h-11 px-3 rounded-lg border text-sm" placeholder="Data original" />
                  <input type="date" value={swapNewDate} onChange={e => setSwapNewDate(e.target.value)} className="h-11 px-3 rounded-lg border text-sm" placeholder="Nova data" />
                  <input value={swapReason} onChange={e => setSwapReason(e.target.value)} className="h-11 px-3 rounded-lg border text-sm" placeholder="Motivo" />
                  <button onClick={handleSaveSwap} className="h-11 bg-amber-500 text-white font-black rounded-xl text-xs">REGISTRAR TROCA</button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FERIAS */}
          {tab === 'FERIAS' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm h-fit">
                <h3 className="font-black text-lg mb-4">Registrar Férias / Licença</h3>
                <div className="space-y-4">
                  <select value={vacPersonnelId} onChange={e => setVacPersonnelId(Number(e.target.value))} className="w-full h-11 px-4 rounded-lg border text-sm"><option value="">Selecionar militar...</option>{personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation ? `${p.graduation} ` : ''}{p.name}</option>)}</select>
                  <select value={vacType} onChange={e => setVacType(e.target.value)} className="w-full h-11 px-4 rounded-lg border text-sm">{LEAVE_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}</select>
                  <input type="date" value={vacStart} onChange={e => setVacStart(e.target.value)} className="w-full h-11 px-4 rounded-lg border text-sm" />
                  <input type="date" value={vacEnd} onChange={e => setVacEnd(e.target.value)} className="w-full h-11 px-4 rounded-lg border text-sm" />
                  <textarea value={vacNotes} onChange={e => setVacNotes(e.target.value)} className="w-full h-20 p-3 rounded-lg border text-xs" placeholder="Observações..." />
                  <button onClick={handleSaveVacation} className="w-full py-3 bg-primary text-white font-black rounded-xl">REGISTRAR</button>
                </div>
              </div>
              <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                <h3 className="font-black text-lg mb-4">Períodos Registrados ({vacations.length})</h3>
                <div className="space-y-2">{vacations.map(v => {
                  const leaveLabel = LEAVE_TYPES.find(lt => lt.value === v.leave_type)?.label || v.leave_type || 'Férias';
                  return (
                    <div key={v.id} className="flex items-center gap-4 p-4 rounded-xl border border-rustic-border hover:border-primary/30">
                      <span className="material-symbols-outlined text-blue-500">event</span>
                      <div className="flex-1"><span className="font-bold text-sm block">{v.full_name}</span><span className="text-xs text-gray-400">{leaveLabel} • {new Date(v.start_date).toLocaleDateString('pt-BR')} — {new Date(v.end_date).toLocaleDateString('pt-BR')} ({v.day_count}d)</span></div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${v.status === 'concluido' ? 'bg-green-100 text-green-700' : v.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'} uppercase`}>{v.status || 'planejado'}</span>
                      <button onClick={async () => { if (confirm('Remover?')) { await PersonnelService.deleteVacation(v.id!); loadData(); toast.success('Removido!'); } }} className="p-1 text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                    </div>
                  );
                })}{vacations.length === 0 && <p className="text-center py-12 text-gray-300 italic">Nenhum período registrado.</p>}</div>
              </div>
            </div>
          )}

          {/* TAB: BOLETIM */}
          {tab === 'BOLETIM' && (
            <BulletinSection bulletins={bulletins} onAddBulletin={async (b) => { await PersonnelService.addBulletin(b); loadBulletins(); toast.success('Boletim criado!'); }} onUpdateBulletin={async (id, u) => { await PersonnelService.updateBulletin(id, u); loadBulletins(); toast.success('Boletim atualizado!'); }} onGetNotes={PersonnelService.getBulletinNotes} onAddNote={async (n) => { await PersonnelService.addBulletinNote(n); toast.success('Nota adicionada!'); }} onGetVersions={PersonnelService.getBulletinVersions} isEditor={true} />
          )}

          {/* TAB: DISCIPLINA */}
          {tab === 'DISCIPLINA' && (
            <DisciplinarySection records={disciplinaryRecords} personnelList={personnelList} onAdd={async (r) => { await PersonnelService.addDisciplinaryRecord(r); loadDisciplinary(); toast.success('Registro adicionado!'); }} onDelete={async (id) => { if (confirm('Remover registro?')) { await PersonnelService.deleteDisciplinaryRecord(id); loadDisciplinary(); toast.success('Removido!'); } }} isEditor={true} />
          )}

          {/* TAB: PRONTIDAO */}
          {tab === 'PRONTIDAO' && <ReadinessReport personnelList={personnelList} vacations={vacations} />}

          {/* TAB: PERFIL */}
          {tab === 'PERFIL' && profilePerson && (
            <PersonnelProfile person={profilePerson} rankHistory={profileRankHistory} swaps={profileSwaps} disciplinary={profileDisciplinary} vacations={profileVacations} documents={profileDocs} onClose={() => { setProfilePerson(null); setTab('EFETIVO'); }} />
          )}
          {tab === 'PERFIL' && !profilePerson && <div className="text-center py-12 text-gray-300"><p>Selecione um militar na aba Efetivo para ver o perfil completo.</p></div>}

          {/* TAB: EXPORTAR */}
          {tab === 'EXPORTAR' && (
            <ExportSection personnelList={personnelList} vacations={vacations} exports={sigrhExports} onAddExport={async (e) => { await PersonnelService.addSigrhExport(e); loadExports(); toast.success('Submissão registrada!'); }} />
          )}

          {/* TAB: DASHBOARD */}
          {tab === 'DASHBOARD' && (
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
              <DashboardComandante personnelList={personnelList} vacations={vacations} courses={courses} epiDeliveries={epiDeliveries} notifications={notifications} alerts={alerts} onNavigate={(t) => setTab(t as Tab)} />
            </div>
          )}

          {/* TAB: CURSOS */}
          {tab === 'CURSOS' && (
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
              <CursosB1 personnelList={personnelList} />
            </div>
          )}

          {/* TAB: EPI */}
          {tab === 'EPI' && (
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
              <EpiB1 personnelList={personnelList} />
            </div>
          )}

          {/* TAB: DISPONIBILIDADE */}
          {tab === 'DISPONIBILIDADE' && (
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
              <DisponibilidadeB1 personnelList={personnelList} vacations={vacations} escalas={escalas} />
            </div>
          )}

          {/* TAB: NOTIFICACOES */}
          {tab === 'NOTIFICACOES' && (
            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
              <NotificacoesB1 />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PessoalB1;