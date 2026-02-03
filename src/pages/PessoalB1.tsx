import React, { useState, useEffect } from 'react';
import { SupabaseService, Personnel, DocumentB1, Vacation } from '../services/SupabaseService';

const PessoalB1: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LISTAGEM' | 'CADASTRO' | 'DOCUMENTOS' | 'FERIAS' | 'ESCALA' | 'REUNIAO'>('LISTAGEM');
  const [searchTerm, setSearchTerm] = useState("");
  const [isJoinedMeeting, setIsJoinedMeeting] = useState(false);

  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [documents, setDocuments] = useState<DocumentB1[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State Personnel
  const [formData, setFormData] = useState({ nome: '', nascimento: '', status: 'ATIVO', tipo: 'BM' });

  // Form State Documents
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState("Certidão");
  const [docObs, setDocObs] = useState("");

  // Form State Vacations
  const [vacaPersonId, setVacaPersonId] = useState<number | ''>('');
  const [vacaStart, setVacaStart] = useState("");
  const [vacaEnd, setVacaEnd] = useState("");
  const [vacaObs, setVacaObs] = useState("");

  useEffect(() => {
    loadData();
  }, [activeTab]);

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
    } catch (error) {
      console.error("Error loading B1 data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonnel = async () => {
    if (!formData.nome) return alert("Nome é obrigatório!");
    await SupabaseService.addPersonnel({
      name: formData.nome,
      rank: formData.tipo === 'BM' ? 'Sd.' : 'BC',
      role: 'Novo Cadastro',
      status: formData.status as any,
      type: formData.tipo as any
    });
    alert("Militar cadastrado!");
    setActiveTab('LISTAGEM');
  };

  const handleUploadDocument = async () => {
    if (!docFile) return alert("Selecione um arquivo PDF.");
    setLoading(true);
    try {
      const fileName = `${Date.now()}_${docFile.name}`;
      await SupabaseService.uploadFile('documentos-b1', fileName, docFile);
      const url = SupabaseService.getPublicUrl('documentos-b1', fileName);

      await SupabaseService.addDocumentB1({
        nome_arquivo: docFile.name,
        tipo_documento: docCategory,
        arquivo_url: url,
        tamanho_kb: Math.round(docFile.size / 1024),
        data_upload: new Date().toISOString(),
        observacoes: docObs
      });
      alert("Documento anexado!");
      setDocFile(null);
      loadData();
    } catch (error) {
      alert("Erro no upload.");
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
      (start >= new Date(v.data_inicio) && start <= new Date(v.data_fim)) ||
      (end >= new Date(v.data_inicio) && end <= new Date(v.data_fim))
    ));

    if (conflict) {
      if (!confirm(`Atenção: Já existe um período de férias agendado entre ${conflict.data_inicio} e ${conflict.data_fim} (${conflict.nome_completo}). Deseja continuar?`)) return;
    }

    await SupabaseService.addVacation({
      bm_bc_id: vacaPersonId,
      nome_completo: person?.name || "Desconhecido",
      data_inicio: vacaStart,
      data_fim: vacaEnd,
      quantidade_dias: days,
      status: 'planejado',
      observacoes: vacaObs
    });
    alert("Férias programadas com sucesso!");
    setVacaStart(""); setVacaEnd(""); loadData();
  };

  const handleDeletePersonnel = async (id: number) => {
    if (!confirm("Excluir este militar da base de dados? Esta ação não pode ser desfeita.")) return;
    try {
      await SupabaseService.deletePersonnel(id);
      loadData();
    } catch (error) {
      alert("Erro ao excluir militar. Verifique se existem dependências (como férias agendadas).");
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (!confirm("Cancelar esta programação de férias?")) return;
    try {
      await SupabaseService.deleteVacation(id);
      loadData();
    } catch (error) {
      alert("Erro ao cancelar férias.");
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
                {tab === 'LISTAGEM' ? 'Efetivo' : tab === 'DOCUMENTOS' ? 'Docs' : tab === 'FERIAS' ? 'Férias' : tab === 'CADASTRO' ? 'Novo' : 'Escala'}
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
              {personnelList.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-2xl border border-rustic-border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-cover bg-center mb-4 border-2 border-primary/20" style={{ backgroundImage: `url(${p.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'})` }}></div>
                  <h4 className="font-bold text-lg leading-tight">{p.rank} {p.name}</h4>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">{p.type} • {p.status}</span>
                  <button
                    onClick={() => handleDeletePersonnel(p.id!)}
                    className="mt-4 p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Excluir Militar"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_remove</span>
                  </button>
                </div>
              ))}
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
                        <td className="px-6 py-4 font-bold"><span className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">description</span> {doc.nome_arquivo}</span></td>
                        <td className="px-6 py-4"><span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded">{doc.tipo_documento}</span></td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{doc.tamanho_kb} KB</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <a href={doc.arquivo_url} target="_blank" className="p-2 hover:bg-stone-100 rounded-lg text-primary"><span className="material-symbols-outlined text-[18px]">visibility</span></a>
                            <button onClick={() => handleDeleteDocument(doc.id!, doc.arquivo_url)} className="p-2 hover:bg-red-50 rounded-lg text-red-600"><span className="material-symbols-outlined text-[18px]">delete</span></button>
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
                        <span className="text-[10px] uppercase">{new Date(v.data_inicio).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                        <span className="text-lg leading-none">{v.data_inicio.split('-')[2]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{v.nome_completo}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{v.quantidade_dias} DIAS • {v.data_inicio} ATÉ {v.data_fim}</p>
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

          {/* ESCALA & REUNIAO (Keeping Simplified) */}
          {activeTab === 'ESCALA' && (
            <div className="bg-white p-8 rounded-2xl border border-rustic-border text-center py-20 text-gray-400 italic">Módulo de Escala Padrão. Consulte o B1 para detalhes.</div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PessoalB1;