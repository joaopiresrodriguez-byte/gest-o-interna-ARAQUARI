import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SupabaseService, MateriaInstrucao, Training, MateriaApresentacao, MateriaVideo } from '../services/SupabaseService';

const InstrucaoB3: React.FC = () => {
  const [materias, setMaterias] = useState<MateriaInstrucao[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { profile } = useAuth();

  // Form State - Materia
  const [nome, setNome] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [categoria, setCategoria] = useState("Geral");
  const [nivel, setNivel] = useState<'basico' | 'intermediario' | 'avancado'>('basico');
  const [descricao, setDescricao] = useState("");
  const [instrutor, setInstrutor] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Materials Stage (Before saving materia)
  const [pendingPDFs, setPendingPDFs] = useState<File[]>([]);
  const [pendingVideos, setPendingVideos] = useState<File[]>([]);

  // Modal State
  const [selectedMateria, setSelectedMateria] = useState<MateriaInstrucao | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'apresentacoes' | 'videos'>('info');
  const [materiaApresentacoes, setMateriaApresentacoes] = useState<MateriaApresentacao[]>([]);
  const [materiaVideos, setMateriaVideos] = useState<MateriaVideo[]>([]);

  // Schedule State
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingTime, setTrainingTime] = useState("");
  const [trainingInstructor, setTrainingInstructor] = useState("");
  const [selectedMateriaId, setSelectedMateriaId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [m, t] = await Promise.all([
      SupabaseService.getMateriasInstrucao(),
      SupabaseService.getTrainings()
    ]);
    setMaterias(m);
    setTrainings(t);
    setLoading(false);
  };

  const handleSaveMateria = async () => {
    if (!nome || !cargaHoraria) {
      alert("Nome e Carga Horária são obrigatórios.");
      return;
    }

    setUploading(true);
    try {
      // 1. Save Materia Info
      const newMateria: MateriaInstrucao = {
        name: nome,
        credit_hours: parseInt(cargaHoraria),
        category: categoria,
        level: nivel,
        description: descricao,
        instructor: instrutor,
        notes: observacoes,
        status: 'active',
        created_by: "Capitão Instrutor"
      };

      const savedMateria = await SupabaseService.addMateriaInstrucao(newMateria);
      const materiaId = savedMateria.id;

      if (!materiaId) {
        throw new Error("Falha ao obter ID da matéria criada.");
      }

      // 2. Upload PDFs
      for (const file of pendingPDFs) {
        const path = `apresentacoes/${materiaId}/${Date.now()}_${file.name}`;
        await SupabaseService.uploadFile('materias-apresentacoes', path, file);
        const url = SupabaseService.getPublicUrl('materias-apresentacoes', path);

        await SupabaseService.addMateriaApresentacao({
          materia_id: materiaId,
          title: file.name.replace('.pdf', '') || 'Sem título',
          file_url: url || '',
          file_name: file.name,
          size_kb: Math.round(file.size / 1024)
        });
      }

      // 3. Upload Videos
      for (const file of pendingVideos) {
        const path = `videos/${materiaId}/${Date.now()}_${file.name}`;
        await SupabaseService.uploadFile('materias-videos', path, file);
        const url = SupabaseService.getPublicUrl('materias-videos', path);

        // For now, metadata is basic. Duration/Thumbnails would need heavy frontend logic or edge functions.
        await SupabaseService.addMateriaVideo({
          materia_id: materiaId,
          title: file.name || 'Sem título',
          file_url: url || '',
          file_name: file.name,
          size_mb: parseFloat((file.size / (1024 * 1024)).toFixed(2)),
          format: file.name.split('.').pop()
        });
      }

      alert("Matéria e materiais cadastrados com sucesso!");
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar matéria:", error);
      alert("Erro ao realizar o cadastro.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMateria = async (id: string) => {
    if (!confirm("Excluir esta matéria e TODOS os seus materiais vinculados?")) return;
    try {
      await SupabaseService.deleteMateriaInstrucao(id);
      loadData();
    } catch (error) {
      alert("Erro ao excluir matéria.");
    }
  };

  const handleDeleteTraining = async (id: string) => {
    if (!confirm("Remover treinamento do cronograma?")) return;
    try {
      await SupabaseService.deleteTraining(id);
      loadData();
    } catch (error) {
      alert("Erro ao remover treinamento.");
    }
  };

  const handleDeleteApresentacao = async (id: string, materiaId: string) => {
    if (!confirm("Excluir este arquivo PDF?")) return;
    try {
      await SupabaseService.deleteMateriaApresentacao(id, materiaId);
      if (selectedMateria?.id) {
        const p = await SupabaseService.getMateriaApresentacoes(selectedMateria.id);
        setMateriaApresentacoes(p);
      }
      loadData();
    } catch (error) {
      alert("Erro ao excluir apresentação.");
    }
  };

  const handleDeleteVideo = async (id: string, materiaId: string) => {
    if (!confirm("Excluir este vídeo?")) return;
    try {
      await SupabaseService.deleteMateriaVideo(id, materiaId);
      if (selectedMateria?.id) {
        const v = await SupabaseService.getMateriaVideos(selectedMateria.id);
        setMateriaVideos(v);
      }
      loadData();
    } catch (error) {
      alert("Erro ao excluir vídeo.");
    }
  };

  const resetForm = () => {
    setNome("");
    setCargaHoraria("");
    setCategoria("Geral");
    setNivel("basico");
    setDescricao("");
    setInstrutor("");
    setObservacoes("");
    setPendingPDFs([]);
    setPendingVideos([]);
  };

  const handleViewDetails = async (materia: MateriaInstrucao) => {
    setSelectedMateria(materia);
    setActiveTab('info');
    setLoading(true);
    if (materia.id) {
      const [p, v] = await Promise.all([
        SupabaseService.getMateriaApresentacoes(materia.id),
        SupabaseService.getMateriaVideos(materia.id)
      ]);
      setMateriaApresentacoes(p);
      setMateriaVideos(v);
    }
    setLoading(false);
  };

  const handleSchedule = async () => {
    if (!trainingDate || !trainingTime || !selectedMateriaId || !trainingInstructor) {
      alert("Preencha todos os campos do agendamento.");
      return;
    }

    const newTraining: Training = {
      materia_id: selectedMateriaId,
      date: trainingDate,
      time: trainingTime,
      instructor: trainingInstructor,
      status: 'Scheduled'
    };

    await SupabaseService.addTraining(newTraining);
    alert("Treinamento agendado com sucesso!");
    setTrainingDate("");
    setTrainingTime("");
    loadData();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F9F7F5] relative font-sans text-[#4A443F]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E5E1DA] bg-white/80 backdrop-blur-md px-8 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-black tracking-tight text-[#2D2926]">Instrução e Treinamento (B3)</h2>
            <p className="text-[#8C8379] text-base">Portal de materiais didáticos e cronograma de instrução do CBMSC.</p>
          </div>
          <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-[#D6CFC7] bg-white px-5 py-2.5 text-sm font-bold text-[#4A443F] hover:bg-[#F2EFE9] transition-all shadow-sm active:scale-95">
            <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            Atualizar Base
          </button>
        </div>
      </header>

      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="size-10 border-4 border-rustic-brown/30 border-t-rustic-brown rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-rustic-brown animate-pulse">Carregando dados...</p>
          </div>
        </div>
      )}

      <div className="flex-1 p-8">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-8 xl:grid-cols-12">

          {/* Left Column: Cadastro */}
          <div className="xl:col-span-5 space-y-8">
            <section className="rounded-2xl border border-[#D6CFC7] bg-white shadow-xl overflow-hidden">
              <div className="bg-[#FAF9F7] border-b border-[#E5E1DA] px-6 py-4 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#C62828] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">library_add</span>
                </div>
                <h3 className="text-xl font-black text-[#2D2926]">Cadastrar Nova Matéria</h3>
              </div>

              {profile?.p_instrucao === 'editor' ? (
                <div className="p-8 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Nome da Matéria *</label>
                      <input
                        value={nome} onChange={e => setNome(e.target.value)}
                        className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4 text-[#2D2926] placeholder:text-[#C4BEB7] focus:border-[#C62828] focus:ring-0 transition-all outline-none"
                        placeholder="Ex: APH Básico"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Carga Horária (h) *</label>
                      <input
                        type="number" value={cargaHoraria} onChange={e => setCargaHoraria(e.target.value)}
                        className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4 text-[#2D2926] placeholder:text-[#C4BEB7] focus:border-[#C62828] focus:ring-0 transition-all outline-none"
                        placeholder="Ex: 40"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Categoria</label>
                      <select
                        value={categoria} onChange={e => setCategoria(e.target.value)}
                        className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4 text-[#2D2926] focus:border-[#C62828] outline-none"
                      >
                        <option>APH</option>
                        <option>Combate a Incêndio</option>
                        <option>Salvamento</option>
                        <option>Operações Especiais</option>
                        <option>Prevenção</option>
                        <option>Administrativa</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Nível</label>
                      <select
                        value={nivel} onChange={e => setNivel(e.target.value as any)}
                        className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4 text-[#2D2926] focus:border-[#C62828] outline-none"
                      >
                        <option value="basico">Básico</option>
                        <option value="intermediario">Intermediário</option>
                        <option value="avancado">Avançado</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Descrição / Ementa</label>
                    <textarea
                      value={descricao} onChange={e => setDescricao(e.target.value)}
                      rows={3} className="rounded-xl border-2 border-[#E5E1DA] bg-white p-4 text-[#2D2926] focus:border-[#C62828] outline-none resize-none"
                      placeholder="Descreva o conteúdo programático..."
                    />
                  </div>

                  {/* Materials Section */}
                  <div className="space-y-4 pt-4 border-t border-[#E5E1DA]">
                    <h4 className="text-lg font-black text-[#2D2926] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#C62828]">folder_open</span>
                      Materiais Didáticos
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* PDF Upload */}
                      <div className="flex flex-col gap-3">
                        <label className="relative flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-[#D6CFC7] bg-[#FAF9F7] cursor-pointer hover:bg-[#F2EFE9] transition-all">
                          <span className="material-symbols-outlined text-[#C62828] text-3xl">picture_as_pdf</span>
                          <span className="text-xs font-bold mt-1">+ Apresentação PDF</span>
                          <input type="file" multiple accept=".pdf" className="hidden"
                            onChange={e => e.target.files && setPendingPDFs([...pendingPDFs, ...Array.from(e.target.files)])}
                          />
                        </label>
                        {pendingPDFs.length > 0 && (
                          <div className="space-y-1">
                            {pendingPDFs.map((f, i) => (
                              <div key={i} className="flex items-center justify-between bg-white border border-[#E5E1DA] rounded-lg px-3 py-2 text-[11px]">
                                <span className="truncate max-w-[150px] font-medium">{f.name}</span>
                                <button onClick={() => setPendingPDFs(pendingPDFs.filter((_, idx) => idx !== i))} className="text-red-500 material-symbols-outlined text-sm">cancel</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Video Upload */}
                      <div className="flex flex-col gap-3">
                        <label className="relative flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-[#D6CFC7] bg-[#FAF9F7] cursor-pointer hover:bg-[#F2EFE9] transition-all">
                          <span className="material-symbols-outlined text-[#2E7D32] text-3xl">movie</span>
                          <span className="text-xs font-bold mt-1">+ Adicionar Vídeo</span>
                          <input type="file" multiple accept="video/*" className="hidden"
                            onChange={e => e.target.files && setPendingVideos([...pendingVideos, ...Array.from(e.target.files)])}
                          />
                        </label>
                        {pendingVideos.length > 0 && (
                          <div className="space-y-1">
                            {pendingVideos.map((f, i) => (
                              <div key={i} className="flex items-center justify-between bg-white border border-[#E5E1DA] rounded-lg px-3 py-2 text-[11px]">
                                <span className="truncate max-w-[150px] font-medium">{f.name}</span>
                                <button onClick={() => setPendingVideos(pendingVideos.filter((_, idx) => idx !== i))} className="text-red-500 material-symbols-outlined text-sm">cancel</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveMateria} disabled={uploading}
                    className={`w-full h-14 rounded-2xl bg-[#C62828] text-white font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-red-200 hover:bg-[#A32020] transition-all active:scale-95 disabled:bg-gray-400 disabled:shadow-none mt-4`}
                  >
                    {uploading ? (
                      <>
                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processando Materiais...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">auto_stories</span>
                        Cadastrar Matéria
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-8">
                  <div className="p-6 bg-amber-50 border border-amber-100 rounded-xl text-center">
                    <span className="material-symbols-outlined text-amber-500 text-4xl mb-3">lock</span>
                    <h4 className="text-lg font-bold text-[#2D2926]">Acesso Restrito</h4>
                    <p className="text-sm text-[#8C8379] mt-1">Você não tem permissão para cadastrar novas matérias.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Scheduling Section */}
            <section className="rounded-2xl border border-[#D6CFC7] bg-white shadow-xl overflow-hidden">
              <div className="bg-[#FAF9F7] border-b border-[#E5E1DA] px-6 py-4 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#2E7D32] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">event</span>
                </div>
                <h3 className="text-xl font-black text-[#2D2926]">Agendar Instrução</h3>
              </div>
              {profile?.p_instrucao === 'editor' ? (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Data</label>
                    <input type="date" value={trainingDate} onChange={e => setTrainingDate(e.target.value)} className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4 text-sm" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Horário</label>
                    <input type="time" value={trainingTime} onChange={e => setTrainingTime(e.target.value)} className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4 text-sm" />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Matéria</label>
                    <select value={selectedMateriaId} onChange={e => setSelectedMateriaId(e.target.value)} className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4">
                      <option value="">Selecione...</option>
                      {materias.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-[#8C8379]">Instrutor</label>
                    <input value={trainingInstructor} onChange={e => setTrainingInstructor(e.target.value)} className="h-12 rounded-xl border-2 border-[#E5E1DA] bg-white px-4 text-sm" placeholder="Nome Completo" />
                  </div>
                  <button onClick={handleSchedule} className="md:col-span-2 h-14 rounded-2xl bg-[#2E7D32] text-white font-black text-lg flex items-center justify-center gap-2 hover:bg-[#205722] transition-all shadow-lg active:scale-95">
                    <span className="material-symbols-outlined">calendar_month</span>
                    Lançar Cronograma
                  </button>
                </div>
              ) : (
                <div className="p-8">
                  <div className="p-6 bg-amber-50 border border-amber-100 rounded-xl text-center">
                    <span className="material-symbols-outlined text-amber-500 text-4xl mb-3">lock</span>
                    <h4 className="text-lg font-bold text-[#2D2926]">Acesso Restrito</h4>
                    <p className="text-sm text-[#8C8379] mt-1">Você não tem permissão para agendar instruções.</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Collection & Grid */}
          <div className="xl:col-span-7 space-y-8">
            {/* Materias Grid */}
            <section className="space-y-4">
              <h3 className="text-2xl font-black text-[#2D2926] flex items-center gap-3 ml-2">
                <span className="material-symbols-outlined text-[#C62828] text-3xl">folder_managed</span>
                Acervo Técnico
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {materias.map(m => (
                  <div key={m.id} className="group flex flex-col rounded-2xl bg-white border border-[#D6CFC7] shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-default">
                    <div className="p-6 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex flex-col gap-1">
                          <span className={`self-start px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${m.level === 'basico' ? 'bg-green-100 text-green-700' :
                            m.level === 'intermediario' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                            {m.level}
                          </span>
                          <h4 className="text-xl font-black text-[#2D2926] mt-1 group-hover:text-[#C62828] transition-colors">{m.name}</h4>
                          <span className="text-xs font-bold text-[#8C8379] italic">{m.category}</span>
                        </div>
                        <div className="flex gap-4">
                          {profile?.p_instrucao === 'editor' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteMateria(m.id!); }}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Excluir Matéria"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                          <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-[#C62828]">{m.credit_hours}</span>
                            <span className="text-[10px] font-bold text-[#8C8379] uppercase">Horas</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-[#5C564F] mb-6 line-clamp-2 italic">{m.description || "Sem ementa cadastrada."}</p>

                      <div className="mt-auto pt-6 border-t border-[#F2EFE9] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-[#C62828]">
                            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                            <span className="text-xs font-bold">{m.total_presentations || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#2E7D32]">
                            <span className="material-symbols-outlined text-[18px]">movie</span>
                            <span className="text-xs font-bold">{m.total_videos || 0}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleViewDetails(m)}
                          className="px-4 py-2 rounded-xl bg-[#2D2926] text-white text-xs font-black uppercase tracking-wider hover:bg-[#C62828] transition-all shadow-md active:scale-90"
                        >
                          Explorar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {materias.length === 0 && <div className="col-span-full py-20 text-center text-[#8C8379] font-medium italic border-2 border-dashed border-[#D6CFC7] rounded-3xl">Nenhuma matéria no acervo.</div>}
              </div>
            </section>

            {/* Summary Schedule */}
            <section className="rounded-2xl border border-[#D6CFC7] bg-[#2D2926] text-white shadow-xl overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#C62828]">schedule</span>
                  Cronograma de Instrução
                </h3>
                <span className="text-xs font-bold opacity-60">Próximos 7 dias</span>
              </div>
              <div className="p-6 space-y-4">
                {trainings.map(t => (
                  <div key={t.id} className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-all group">
                    <div className="flex flex-col items-center justify-center size-14 bg-white text-[#2D2926] rounded-xl flex-shrink-0">
                      <span className="text-xs font-bold opacity-60 leading-none">DIA</span>
                      <span className="text-2xl font-black leading-none">{t.date.split('-')[2]}</span>
                    </div>
                    <div className="flex flex-1 flex-col truncate">
                      <h5 className="text-base font-black truncate">{t.materia?.name || "Treinamento"}</h5>
                      <div className="flex items-center gap-3 mt-1 text-sm opacity-60">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">timer</span> {t.time}</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">person</span> {t.instructor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {profile?.p_instrucao === 'editor' && (
                        <button
                          onClick={() => handleDeleteTraining(t.id!)}
                          className="size-10 rounded-full border border-white/20 flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-red-500 transition-all"
                          title="Remover Treinamento"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                      <div className="size-10 rounded-full border border-white/20 flex items-center justify-center opacity-40 group-hover:opacity-100 group-hover:bg-[#C62828] group-hover:border-transparent transition-all">
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </div>
                    </div>
                  </div>
                ))}
                {trainings.length === 0 && <p className="text-center opacity-40 italic py-4">Nenhum treinamento agendado.</p>}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedMateria && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2D2926]/80 backdrop-blur-sm" onClick={() => setSelectedMateria(null)}></div>
          <div className="relative w-full max-w-4xl bg-[#FAF9F7] rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            {/* Modal Header */}
            <div className="px-8 py-6 bg-white border-b border-[#E5E1DA] flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-[#C62828] text-white text-[10px] font-black uppercase rounded-full tracking-widest">{selectedMateria.category}</span>
                    <span className="px-3 py-1 bg-[#2D2926] text-white text-[10px] font-black uppercase rounded-full tracking-widest">{selectedMateria.level}</span>
                  </div>
                  <h2 className="text-3xl font-black text-[#2D2926] mt-2">{selectedMateria.name}</h2>
                  <p className="text-[#8C8379] font-bold mt-1 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">monitoring</span>
                    Base de Conhecimento • {selectedMateria.credit_hours} horas de instrução
                  </p>
                </div>
                <button onClick={() => setSelectedMateria(null)} className="size-12 rounded-2xl bg-[#E5E1DA] flex items-center justify-center text-[#4A443F] hover:bg-[#C62828] hover:text-white transition-all">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 bg-[#F2EFE9] rounded-2xl self-start">
                <button onClick={() => setActiveTab('info')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'info' ? 'bg-white text-[#2D2926] shadow-sm' : 'text-[#8C8379] hover:text-[#4A443F]'}`}>Ementa</button>
                <button onClick={() => setActiveTab('apresentacoes')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'apresentacoes' ? 'bg-white text-[#C62828] shadow-sm' : 'text-[#8C8379] hover:text-[#4A443F]'}`}>Apresentações ({materiaApresentacoes.length})</button>
                <button onClick={() => setActiveTab('videos')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'videos' ? 'bg-white text-[#2E7D32] shadow-sm' : 'text-[#8C8379] hover:text-[#4A443F]'}`}>Vídeos ({materiaVideos.length})</button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-white/40">
              {activeTab === 'info' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#C62828]">Descrição do Conteúdo</h4>
                    <p className="text-lg text-[#4A443F] leading-relaxed italic border-l-4 border-[#C62828] pl-6 bg-white py-6 rounded-r-2xl">
                      "{selectedMateria.description || "Nenhuma ementa detalhada disponível para esta matéria."}"
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl border border-[#E5E1DA]">
                      <h5 className="text-xs font-black uppercase text-[#8C8379] mb-4">Corpo Docente</h5>
                      <div className="flex items-center gap-4">
                        <div className="size-14 rounded-2xl bg-[#F2EFE9] flex items-center justify-center text-[#C62828]">
                          <span className="material-symbols-outlined text-3xl">school</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-lg font-black">{selectedMateria.instructor || "Não definido"}</span>
                          <span className="text-xs font-bold text-[#8C8379]">Instrutor Principal</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-[#E5E1DA]">
                      <h5 className="text-xs font-black uppercase text-[#8C8379] mb-4">Notas Internas</h5>
                      <p className="text-sm text-[#5C564F]">{selectedMateria.notes || "Nenhuma observação adicional registrada."}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'apresentacoes' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
                  {materiaApresentacoes.map(pres => (
                    <div key={pres.id} className="bg-white border border-[#E5E1DA] rounded-2xl p-5 hover:border-[#C62828] hover:shadow-lg transition-all flex flex-col">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="size-12 rounded-xl bg-red-50 text-[#C62828] flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined">picture_as_pdf</span>
                        </div>
                        <div className="flex flex-col truncate">
                          <h5 className="text-base font-black truncate text-[#2D2926]">{pres.title}</h5>
                          <span className="text-xs font-bold text-[#8C8379]">{pres.size_kb} KB • PDF</span>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-auto">
                        <a href={pres.file_url} target="_blank" rel="noreferrer" className="flex-1 h-10 rounded-lg bg-[#2D2926] text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center hover:bg-[#C62828] transition-colors">Visualizar</a>
                        {profile?.p_instrucao === 'editor' && (
                          <button onClick={() => handleDeleteApresentacao(pres.id!, pres.materia_id)} className="size-10 rounded-lg border-2 border-[#E5E1DA] text-[#8C8379] flex items-center justify-center hover:border-red-500 hover:text-red-500 transition-all">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {materiaApresentacoes.length === 0 && <div className="col-span-full py-20 text-center opacity-40 italic">Nenhum material de apoio em PDF anexado.</div>}
                </div>
              )}

              {activeTab === 'videos' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {materiaVideos.map(vid => (
                    <div key={vid.id} className="bg-white border border-[#E5E1DA] rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-xl transition-all h-auto md:h-48 group">
                      <div className="relative w-full md:w-80 bg-black flex items-center justify-center overflow-hidden">
                        {vid.thumbnail_url ? (
                          <img src={vid.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover opacity-80" loading="lazy" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <span className="material-symbols-outlined text-5xl text-white">movie</span>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button className="size-14 rounded-full bg-[#C62828] text-white flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-all opacity-0 group-hover:opacity-100">
                            <span className="material-symbols-outlined text-3xl">play_arrow</span>
                          </button>
                        </div>
                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-black text-white">{vid.format || 'HD'}</div>
                      </div>
                      <div className="flex-1 p-6 flex flex-col">
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col">
                            <h5 className="text-xl font-black text-[#2D2926]">{vid.title}</h5>
                            <p className="text-xs font-bold text-[#8C8379] mt-1">{vid.size_mb} MB • {vid.format?.toUpperCase() || 'MP4'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="size-10 rounded-xl border border-[#E5E1DA] flex items-center justify-center text-[#8C8379] hover:bg-[#C62828] hover:text-white transition-all">
                              <span className="material-symbols-outlined text-[18px]">download</span>
                            </button>
                            {profile?.p_instrucao === 'editor' && (
                              <button
                                onClick={() => handleDeleteVideo(vid.id!, vid.materia_id)}
                                className="size-10 rounded-xl border border-[#E5E1DA] flex items-center justify-center text-[#8C8379] hover:bg-red-500 hover:text-white hover:border-transparent transition-all"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[#2E7D32]">
                            <span className="material-symbols-outlined text-sm">done_all</span>
                            <span className="text-[10px] font-black uppercase">Material Verificado</span>
                          </div>
                          <button className="flex items-center gap-2 text-xs font-black uppercase text-[#C62828] hover:translate-x-1 transition-transform">
                            Reproduzir Vídeo <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {materiaVideos.length === 0 && <div className="py-20 text-center opacity-40 italic">Nenhum vídeo educativo vinculado a esta matéria.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstrucaoB3;