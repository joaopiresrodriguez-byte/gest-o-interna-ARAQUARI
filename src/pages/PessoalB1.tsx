import React, { useState, useEffect } from 'react';
import { SupabaseService, Personnel, DocumentB1, Vacation } from '../services/SupabaseService';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const PessoalB1: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'LISTAGEM' | 'CADASTRO' | 'DOCUMENTOS' | 'FERIAS' | 'ESCALA' | 'REUNIAO'>('LISTAGEM');
  const [searchTerm, setSearchTerm] = useState("");

  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [documents, setDocuments] = useState<DocumentB1[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);

  // Form State Personnel
  const [formData, setFormData] = useState<Partial<Personnel>>({
    name: '',
    war_name: '',
    status: 'ATIVO',
    type: 'BM',
    address: '',
    email: '',
    birth_date: '',
    phone: '',
    blood_type: '',
    cnh: '',
    weapon_permit: false,
    role: 'Serviço Ativo'
  });

  // Form State Documents
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState("Certidão");
  const [docObs, setDocObs] = useState("");

  // Form State Vacations
  const [vacaPersonId, setVacaPersonId] = useState<number | ''>('');
  const [vacaStart, setVacaStart] = useState("");
  const [vacaEnd, setVacaEnd] = useState("");
  const [vacaObs, setVacaObs] = useState("");

  // Roster State
  const [rosterStartDate, setRosterStartDate] = useState("2024-01-01");
  const [teamA, setTeamA] = useState<number[]>([]);
  const [teamB, setTeamB] = useState<number[]>([]);
  const [teamC, setTeamC] = useState<number[]>([]);
  const [teamD, setTeamD] = useState<number[]>([]);
  const [rosterMonth, setRosterMonth] = useState(new Date().getMonth());
  const [rosterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const saved = localStorage.getItem('roster_config');
    if (saved) {
      const config = JSON.parse(saved);
      setRosterStartDate(config.startDate || "2024-01-01");

      // Cleanup orphan IDs from localStorage if they don't exist in personnelList anymore
      // We'll do this once personnelList is loaded below
    }
  }, []);

  // New Effect to sync localStorage with current personnelList
  useEffect(() => {
    if (personnelList.length > 0) {
      const saved = localStorage.getItem('roster_config');
      if (saved) {
        const config = JSON.parse(saved);
        const validIds = new Set(personnelList.map(p => p.id));

        const cleanTeam = (team: number[]) => (team || []).filter(id => validIds.has(id));

        setTeamA(cleanTeam(config.teamA));
        setTeamB(cleanTeam(config.teamB));
        setTeamC(cleanTeam(config.teamC));
        setTeamD(cleanTeam(config.teamD));
      }
    }
  }, [personnelList]);

  const saveRosterConfig = () => {
    localStorage.setItem('roster_config', JSON.stringify({
      startDate: rosterStartDate, teamA, teamB, teamC, teamD
    }));
    toast.success("Configuração da escala salva!");
  };

  const getTeamForDate = (date: Date) => {
    const start = new Date(rosterStartDate);
    start.setHours(0, 0, 0, 0); // normalize
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Cycle: 0=A, 1=B, 2=C, 3=D
    let cycle = diffDays % 4;
    if (cycle < 0) cycle += 4; // handle past dates

    if (cycle === 0) return { name: 'Alpha', color: 'bg-red-100 text-red-700', members: teamA };
    if (cycle === 1) return { name: 'Bravo', color: 'bg-blue-100 text-blue-700', members: teamB };
    if (cycle === 2) return { name: 'Charlie', color: 'bg-green-100 text-green-700', members: teamC };
    return { name: 'Delta', color: 'bg-yellow-100 text-yellow-700', members: teamD };
  };

  const daysInMonth = new Date(rosterYear, rosterMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(rosterYear, rosterMonth, 1).getDay();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Ensure data is loaded on mount as well, to populate personnelList for Roster even if not on LISTAGEM
  useEffect(() => {
    if (personnelList.length === 0) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [people, docs, vacas] = await Promise.all([
        SupabaseService.getPersonnel(),
        SupabaseService.getDocumentsB1(),
        SupabaseService.getVacations()
      ]);
      setPersonnelList(people);
      setDocuments(docs);
      setVacations(vacas);
      console.log(`B1: Loaded ${people.length} personnel for roster selection.`);
    } catch (error) {
      console.error("Error loading B1 data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonnel = async () => {
    if (!formData.name) return toast.error("Nome é obrigatório!");

    setLoading(true);
    try {
      // Clean empty strings to null to avoid Supabase 400 errors on date/optional columns
      const cleanedData: Record<string, any> = {
        ...formData,
        rank: formData.type === 'BM' ? 'Sd.' : 'BC',
      };

      // Remove empty strings and undefined values for optional fields
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === '' || cleanedData[key] === undefined) {
          delete cleanedData[key];
        }
      });

      await SupabaseService.addPersonnel(cleanedData as Personnel);

      toast.success("Militar cadastrado com sucesso!");
      setFormData({
        name: '',
        war_name: '',
        status: 'ATIVO',
        type: 'BM',
        address: '',
        email: '',
        birth_date: '',
        phone: '',
        blood_type: '',
        cnh: '',
        weapon_permit: false,
        role: 'Serviço Ativo'
      });
      setActiveTab('LISTAGEM');
      loadData();
    } catch (error) {
      console.error("Error saving personnel:", error);
      toast.error("Erro ao cadastrar militar.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!docFile) return alert("Selecione um arquivo PDF.");
    setLoading(true);
    try {
      const fileName = `${Date.now()}_${docFile.name}`;
      await SupabaseService.uploadFile('documentos-b1', fileName, docFile);
      const url = SupabaseService.getPublicUrl('documentos-b1', fileName);

      await SupabaseService.addDocumentB1({
        file_name: docFile.name,
        document_type: docCategory,
        file_url: url,
        size_kb: Math.round(docFile.size / 1024),
        upload_date: new Date().toISOString(),
        notes: docObs
      });
      toast.success("Documento anexado!");
      setDocFile(null);
      loadData();
    } catch (error) {
      toast.error("Erro no upload.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (id: string, url: string) => {
    if (!confirm("Excluir documento permanentemente?")) return;
    const path = url.split('/').pop()!;
    await SupabaseService.deleteDocumentB1(id, path);
    loadData();
  };

  const handleSaveVacation = async () => {
    if (!vacaPersonId || !vacaStart || !vacaEnd) return alert("Preencha todos os campos.");

    const start = new Date(vacaStart);
    const end = new Date(vacaEnd);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    if (days <= 0) return alert("Data de fim deve ser após o início.");

    const person = personnelList.find(p => p.id === vacaPersonId);

    // Conflict detection
    const conflict = vacations.find(v => (
      (start >= new Date(v.start_date) && start <= new Date(v.end_date)) ||
      (end >= new Date(v.start_date) && end <= new Date(v.end_date))
    ));

    if (conflict) {
      if (!confirm(`Atenção: Já existe um período de férias agendado entre ${conflict.start_date} e ${conflict.end_date} (${conflict.full_name}). Deseja continuar?`)) return;
    }

    await SupabaseService.addVacation({
      personnel_id: vacaPersonId,
      full_name: person?.name || "Desconhecido",
      start_date: vacaStart,
      end_date: vacaEnd,
      day_count: days,
      status: 'planejado',
      notes: vacaObs
    });
    alert("Férias programadas com sucesso!");
    setVacaStart(""); setVacaEnd(""); loadData();
  };

  const handleDeletePersonnel = async (id: number) => {
    if (!confirm("Excluir este militar da base de dados? Esta ação não pode ser desfeita.")) return;
    try {
      await SupabaseService.deletePersonnel(id);
      toast.success("Militar removido com sucesso.");
      loadData();
    } catch (error) {
      toast.error("Erro ao excluir militar. Verifique se existem dependências.");
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (!confirm("Cancelar esta programação de férias?")) return;
    try {
      await SupabaseService.deleteVacation(id);
      toast.success("Férias canceladas.");
      loadData();
    } catch (error) {
      toast.error("Erro ao cancelar férias.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light text-rustic-brown">
      {/* Header with improved Tabs */}
      <header className="flex-shrink-0 px-8 py-6 bg-white border-b border-rustic-border shadow-sm">
        <div className="max-w-[1400px] mx-auto w-full flex flex-wrap justify-between items-center gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#181111]">Gestão B1 - Pessoal</h2>
            <p className="text-sm opacity-60">Efetivo, Documentação e Férias</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['LISTAGEM', 'CADASTRO', 'DOCUMENTOS', 'FERIAS', 'ESCALA'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-widest ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                {tab === 'LISTAGEM' ? 'Efetivo' : tab === 'DOCUMENTOS' ? 'Docs' : tab === 'FERIAS' ? 'Férias' : tab === 'CADASTRO' ? 'Cadastrar' : 'Escala'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[1400px] mx-auto space-y-8">

          {/* TAB: LISTAGEM */}
          {activeTab === 'LISTAGEM' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {personnelList.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.war_name?.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                <div key={p.id} className="bg-white p-5 rounded-2xl border border-rustic-border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
                  <div className="w-20 h-20 rounded-full bg-cover bg-center mb-4 border-2 border-primary/20" style={{ backgroundImage: `url(${p.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'})` }}></div>
                  <h4 className="font-bold text-lg leading-tight">{p.rank} {p.war_name || p.name.split(' ')[0]}</h4>
                  <p className="text-xs text-gray-400 mb-2 truncate w-full px-4">{p.name}</p>
                  <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${p.type === 'BM' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{p.type}</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-stone-100 text-gray-600 uppercase">{p.status}</span>
                  </div>
                  <div className={`grid ${profile?.p_pessoal === 'editor' ? 'grid-cols-2' : 'grid-cols-1'} w-full gap-2 border-t border-stone-50 pt-4 mt-auto opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <button onClick={() => setSelectedPerson(p)} className="text-[10px] font-bold text-primary hover:bg-red-50 py-1.5 rounded-lg transition-colors">DETALHES</button>
                    {profile?.p_pessoal === 'editor' && (
                      <button onClick={() => handleDeletePersonnel(p.id!)} className="text-[10px] font-bold text-red-600 hover:bg-red-50 py-1.5 rounded-lg transition-colors">EXCLUIR</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'CADASTRO' && (
            <div className="max-w-4xl mx-auto bg-white p-10 rounded-3xl border border-rustic-border shadow-sm">
              <div className="mb-10 text-center">
                <h3 className="text-2xl font-black text-[#181111] mb-2">Cadastrar Efetivo</h3>
                <p className="text-sm text-gray-400">Preencha os dados do militar (BM) ou bombeiro comunitário (BC).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 border-b border-primary/10 pb-2 mb-4">Informações Básicas</h4>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Nome Completo *</label>
                    <div className="flex gap-2">
                      <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="flex-1 h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Nome completo" />
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rustic-brown/40 material-symbols-outlined text-sm">search</span>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-32 h-11 pl-8 pr-2 rounded-xl border border-rustic-border bg-stone-50 text-[10px] focus:ring-2 focus:ring-primary/20 transition-all font-bold" placeholder="Filtrar..." />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Nome de Guerra</label>
                    <input value={formData.war_name} onChange={e => setFormData({ ...formData, war_name: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Ex: Sd. Pires" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Tipo</label>
                      <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm">
                        <option value="BM">Militares (BM)</option>
                        <option value="BC">Comunitário (BC)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Status</label>
                      <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm">
                        <option value="ATIVO">Ativo</option>
                        <option value="FÉRIAS">Férias</option>
                        <option value="EM CURSO">Em Curso</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">E-mail</label>
                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 transition-all" placeholder="email@exemplo.com" />
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 border-b border-primary/10 pb-2 mb-4">Dados Adicionais</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Data de Nasc.</label>
                      <input type="date" value={formData.birth_date} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Telefone</label>
                      <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm" placeholder="(47) 99999-9999" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Tipo Sanguíneo</label>
                      <select value={formData.blood_type} onChange={e => setFormData({ ...formData, blood_type: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm">
                        <option value="">Selecione...</option>
                        <option value="A+">A+</option><option value="A-">A-</option>
                        <option value="B+">B+</option><option value="B-">B-</option>
                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                        <option value="O+">O+</option><option value="O-">O-</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">CNH / Categoria</label>
                      <input value={formData.cnh} onChange={e => setFormData({ ...formData, cnh: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm" placeholder="Ex: ABC - AD" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Endereço Residencial</label>
                    <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 text-sm focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Rua, Número, Bairro, Cidade" />
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-rustic-border/50">
                    <input type="checkbox" checked={formData.weapon_permit} onChange={e => setFormData({ ...formData, weapon_permit: e.target.checked })} className="w-4 h-4 text-primary rounded" />
                    <label className="text-xs font-bold text-gray-600">Possui Porte de Arma / Acautelamento</label>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex justify-center">
                {profile?.p_pessoal === 'editor' && (
                  <button
                    onClick={handleSavePersonnel}
                    disabled={loading}
                    className="px-12 py-4 bg-primary text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">{loading ? 'sync' : 'how_to_reg'}</span>
                    {loading ? 'SALVANDO...' : 'FINALIZAR CADASTRO'}
                  </button>
                )}
                {profile?.p_pessoal === 'reader' && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700">
                    <span className="material-symbols-outlined">lock</span>
                    <p className="text-xs font-bold uppercase tracking-tight">Você possui apenas permissão de LEITURA neste módulo.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTOS */}
          {activeTab === 'DOCUMENTOS' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Upload Form */}
              <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm h-fit">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-primary">upload_file</span> Anexar PDF</h3>
                <div className="space-y-4">
                  <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl cursor-pointer hover:bg-stone-50 transition-all ${docFile ? 'border-primary bg-red-50/10' : 'border-gray-200'}`}>
                    {docFile ? <span className="text-xs font-bold text-primary">{docFile.name}</span> : <span className="text-xs text-gray-400">Clique para selecionar PDF</span>}
                    <input type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files && setDocFile(e.target.files[0])} />
                  </label>
                  <select value={docCategory} onChange={e => setDocCategory(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm">
                    <option>Certidão</option><option>Portaria</option><option>Requerimento</option><option>Ficha Médica</option>
                  </select>
                  <textarea value={docObs} onChange={e => setDocObs(e.target.value)} className="w-full h-20 p-3 rounded-lg border border-rustic-border text-xs" placeholder="Observações/Notas" />
                  <button onClick={handleUploadDocument} disabled={loading} className="w-full py-3 bg-primary text-white font-black rounded-xl hover:brightness-110 disabled:opacity-50">SUBIR DOCUMENTO</button>
                </div>
              </div>
              {/* Docs List */}
              <div className="xl:col-span-2 bg-white rounded-2xl border border-rustic-border shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 border-b border-rustic-border text-[10px] font-black uppercase text-gray-400">
                    <tr><th className="px-6 py-4">Arquivo</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Tamanho</th><th className="px-6 py-4 text-right">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {documents.map(doc => (
                      <tr key={doc.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-6 py-4 font-bold"><span className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">description</span> {doc.file_name}</span></td>
                        <td className="px-6 py-4"><span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded">{doc.document_type}</span></td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{doc.size_kb} KB</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <a href={doc.file_url} target="_blank" className="p-2 hover:bg-stone-100 rounded-lg text-primary"><span className="material-symbols-outlined text-[18px]">visibility</span></a>
                            <button onClick={() => handleDeleteDocument(doc.id!, doc.file_url)} className="p-2 hover:bg-red-50 rounded-lg text-red-600"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: FERIAS */}
          {activeTab === 'FERIAS' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Vacation Form */}
              <div className="xl:col-span-4 bg-white p-6 rounded-2xl border border-rustic-border shadow-sm h-fit">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-primary">calendar_month</span> Nova Programação</h3>
                <div className="space-y-4">
                  <select value={vacaPersonId} onChange={e => setVacaPersonId(Number(e.target.value))} className="w-full h-11 px-4 rounded-lg border border-rustic-border bg-stone-50 text-sm">
                    <option value="">Selecionar Militar...</option>
                    {personnelList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="text-xs font-bold block">Início: <input type="date" value={vacaStart} onChange={e => setVacaStart(e.target.value)} className="w-full mt-1 h-10 px-2 border rounded-lg" /></label>
                    <label className="text-xs font-bold block">Fim: <input type="date" value={vacaEnd} onChange={e => setVacaEnd(e.target.value)} className="w-full mt-1 h-10 px-2 border rounded-lg" /></label>
                  </div>
                  <textarea value={vacaObs} onChange={e => setVacaObs(e.target.value)} className="w-full h-20 p-3 rounded-lg border border-rustic-border text-xs" placeholder="Observações das férias" />
                  <button onClick={handleSaveVacation} className="w-full py-4 bg-primary text-white font-black rounded-xl hover:brightness-110">PROGRAMAR FÉRIAS</button>
                </div>
              </div>
              {/* Vacations Timeline/List */}
              <div className="xl:col-span-8 bg-white rounded-2xl border border-rustic-border shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg">Cronograma de Férias 2023/2024</h3>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><span className="text-[10px] font-bold">Planejado</span></div>
                  </div>
                </div>
                <div className="space-y-3">
                  {vacations.map(v => (
                    <div key={v.id} className="flex items-center gap-4 p-4 rounded-xl border border-rustic-border hover:border-primary/30 group transition-all">
                      <div className="w-12 h-12 rounded-lg bg-blue-50 flex flex-col items-center justify-center text-blue-700 font-black">
                        <span className="text-[10px] uppercase">{new Date(v.start_date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                        <span className="text-lg leading-none">{v.start_date.split('-')[2]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{v.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{v.day_count} DIAS • {v.start_date} ATÉ {v.end_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-tighter">PLANEJADO</span>
                        <button
                          onClick={() => handleDeleteVacation(v.id!)}
                          className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                          title="Excluir Férias"
                        >
                          <span className="material-symbols-outlined text-[18px]">calendar_today_delay</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {vacations.length === 0 && <p className="text-center py-12 text-gray-300 italic">Nenhuma programação de férias encontrada.</p>}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ESCALA - 24x72 Generator */}
          {activeTab === 'ESCALA' && (
            <div className="space-y-8">
              {/* Configuration Panel */}
              <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-rustic-border pb-4">
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">groups</span>
                    Configuração das Equipes (24x72)
                  </h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={async () => {
                        const today = new Date();
                        const team = getTeamForDate(today);
                        if (!confirm(`Publicar escala de hoje (${today.toLocaleDateString()}) para a Equipe ${team.name}?`)) return;

                        try {
                          await SupabaseService.saveEscala({
                            data: today.toISOString().split('T')[0],
                            equipe: team.name,
                            militares: team.members
                          });
                          toast.success("Escala publicada com sucesso!");
                        } catch (err) {
                          toast.error("Erro ao publicar escala.");
                        }
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-md hover:brightness-110 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">publish</span>
                      PUBLICAR HOJE
                    </button>
                    <label className="text-xs font-bold text-gray-500">
                      Data Base (Equipe A):
                      <input type="date" value={rosterStartDate} onChange={e => setRosterStartDate(e.target.value)} className="ml-2 border rounded p-1 text-sm bg-stone-50" />
                    </label>
                    <button onClick={saveRosterConfig} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-black shadow-md hover:brightness-110">SALVAR CONFIG</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { id: 'A', name: 'Equipe Alpha', state: teamA, setter: setTeamA, color: 'bg-red-50 border-red-100' },
                    { id: 'B', name: 'Equipe Bravo', state: teamB, setter: setTeamB, color: 'bg-blue-50 border-blue-100' },
                    { id: 'C', name: 'Equipe Charlie', state: teamC, setter: setTeamC, color: 'bg-green-50 border-green-100' },
                    { id: 'D', name: 'Equipe Delta', state: teamD, setter: setTeamD, color: 'bg-yellow-50 border-yellow-100' },
                  ].map(team => (
                    <div key={team.id} className={`p-4 rounded-xl border ${team.color}`}>
                      <h4 className="font-black text-sm uppercase mb-3 text-center opacity-70">{team.name}</h4>
                      <div className="h-48 overflow-y-auto bg-white rounded-lg border border-gray-100 p-2 space-y-1">
                        {personnelList.filter(p => !team.state.includes(p.id!) && p.status === 'ATIVO').length === 0 && (
                          <p className="text-[10px] text-center text-gray-300 py-2">Todos alocados</p>
                        )}
                        {/* Selected Members */}
                        {team.state.map(id => {
                          const p = personnelList.find(x => x.id === id);
                          return p ? (
                            <div key={id} className="flex justify-between items-center text-xs p-1.5 bg-gray-50 rounded border border-gray-100">
                              <span className="font-bold truncate">{p.war_name || p.name.split(' ')[0]}</span>
                              <button onClick={() => team.setter(prev => prev.filter(x => x !== id))} className="text-red-400 hover:text-red-600">×</button>
                            </div>
                          ) : null;
                        })}

                        <hr className="my-2 border-dashed" />

                        {/* Available Members Selector */}
                        <select
                          className="w-full text-[10px] p-1 border rounded bg-stone-50"
                          onChange={(e) => {
                            if (e.target.value) {
                              team.setter(prev => [...prev, Number(e.target.value)]);
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">+ Adicionar Militar...</option>
                          {personnelList
                            .filter(p => !teamA.includes(p.id!) && !teamB.includes(p.id!) && !teamC.includes(p.id!) && !teamD.includes(p.id!) && p.status === 'ATIVO')
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.rank} {p.war_name}</option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar View */}
              <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg">Escala Mensal</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setRosterMonth(prev => prev - 1)} className="p-1 rounded bg-stone-100 hover:bg-stone-200">
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <span className="font-bold uppercase w-32 text-center pt-1">
                      {new Date(rosterYear, rosterMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => setRosterMonth(prev => prev + 1)} className="p-1 rounded bg-stone-100 hover:bg-stone-200">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  {/* Headers */}
                  {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                    <div key={d} className="bg-stone-100 p-2 text-center text-[10px] font-black uppercase text-gray-500">{d}</div>
                  ))}

                  {/* Empty Days */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-white min-h-[100px]" />
                  ))}

                  {/* Days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(rosterYear, rosterMonth, day);
                    const team = getTeamForDate(date);
                    const isToday = new Date().toDateString() === date.toDateString();

                    return (
                      <div key={day} className={`bg-white min-h-[100px] p-2 hover:bg-stone-50 transition-colors ${isToday ? 'ring-2 ring-primary/20 bg-red-50/10' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold ${isToday ? 'bg-primary text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>{day}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${team.color}`}>{team.name}</span>
                        </div>
                        <div className="space-y-1">
                          {team.members.map(mid => {
                            const p = personnelList.find(x => x.id === mid);
                            return p ? (
                              <div key={mid} className="text-[10px] font-medium text-gray-600 truncate flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                {p.war_name || p.name.split(' ')[0]}
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: DETALHES DO PESSOAL */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#2c1810] to-[#4a2c20] p-8 text-white relative">
              <button onClick={() => setSelectedPerson(null)} className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 bg-cover bg-center" style={{ backgroundImage: `url(${selectedPerson.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'})` }}></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-primary/20 border border-white/10 rounded text-[10px] font-black uppercase tracking-widest">{selectedPerson.rank}</span>
                    <span className="px-2 py-0.5 bg-white/10 border border-white/10 rounded text-[10px] font-black uppercase tracking-widest">{selectedPerson.type}</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tight">{selectedPerson.name}</h3>
                  <p className="text-white/60 font-bold uppercase text-[11px] tracking-widest mt-1">Guerra: {selectedPerson.war_name || 'Não informado'}</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 grid grid-cols-2 gap-8 bg-stone-50/50">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3 border-b border-primary/10 pb-1">Informações de Contato</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary/40 text-[20px]">mail</span>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">E-mail</p>
                        <p className="text-sm font-bold text-rustic-brown">{selectedPerson.email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary/40 text-[20px]">call</span>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Telefone</p>
                        <p className="text-sm font-bold text-rustic-brown">{selectedPerson.phone || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary/40 text-[20px] mt-1">home</span>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Endereço</p>
                        <p className="text-sm font-bold text-rustic-brown leading-snug">{selectedPerson.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3 border-b border-primary/10 pb-1">Dados Funcionais</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary/40 text-[20px]">badge</span>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Função/Role</p>
                        <p className="text-sm font-bold text-rustic-brown">{selectedPerson.role || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3 border-b border-primary/10 pb-1">Identificação & Saúde</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary/40 text-[20px]">cake</span>
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Nascimento</p>
                          <p className="text-sm font-bold text-rustic-brown">{selectedPerson.birth_date ? new Date(selectedPerson.birth_date).toLocaleDateString('pt-BR') : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary/40 text-[20px]">water_drop</span>
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Tipo Sanguíneo</p>
                          <p className="text-sm font-bold text-rustic-brown">{selectedPerson.blood_type || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary/40 text-[20px]">drive_eta</span>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">CNH</p>
                        <p className="text-sm font-bold text-rustic-brown">{selectedPerson.cnh || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                      <span className={`material-symbols-outlined ${selectedPerson.weapon_permit ? 'text-green-600' : 'text-gray-400'}`}>
                        {selectedPerson.weapon_permit ? 'verified_user' : 'cancel'}
                      </span>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Porte de Arma</p>
                        <p className={`text-[10px] font-black uppercase ${selectedPerson.weapon_permit ? 'text-green-600' : 'text-gray-400'}`}>
                          {selectedPerson.weapon_permit ? 'AUTORIZADO / ACAUTELADO' : 'NÃO POSSUI'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex justify-end">
                  <button onClick={() => setSelectedPerson(null)} className="px-6 py-2 bg-stone-200 text-rustic-brown font-black text-xs rounded-xl hover:bg-stone-300 transition-colors">FECHAR</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PessoalB1;