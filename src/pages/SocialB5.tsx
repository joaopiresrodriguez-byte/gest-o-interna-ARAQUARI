import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SupabaseService, SocialPost, Personnel, Occurrence } from '../services/SupabaseService';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { toast } from 'sonner';

type TabKey = 'DIVULGAÇÃO' | 'OCORRÊNCIAS' | 'ANIVERSARIANTES';

const OCCURRENCE_TYPES = ['Incêndio', 'Resgate', 'Salvamento', 'APH', 'Busca', 'Materiais Perigosos', 'Prevenção', 'Outros'];
const POST_CATEGORIES = ['Institucional', 'Campanha', 'Operação', 'Evento', 'Treinamento', 'Comunicado'];

const SocialB5: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('DIVULGAÇÃO');
  const [loading, setLoading] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Institucional');
  const [postContent, setPostContent] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postFilter, setPostFilter] = useState('');
  const [postCategoryFilter, setPostCategoryFilter] = useState('');

  // Occurrences state
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [occType, setOccType] = useState('');
  const [occDate, setOccDate] = useState('');
  const [occLocation, setOccLocation] = useState('');
  const [occUnits, setOccUnits] = useState('');
  const [occDescription, setOccDescription] = useState('');
  const [occOutcome, setOccOutcome] = useState('');
  const [occVisibility, setOccVisibility] = useState<'public' | 'internal'>('internal');
  const [occFilterType, setOccFilterType] = useState('');
  const [occFilterVisibility, setOccFilterVisibility] = useState('');

  // Birthday state
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterDay, setFilterDay] = useState<number | ''>('');

  const isEditor = profile?.p_social === 'editor';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [postsData, occData, pData] = await Promise.all([
        SupabaseService.getSocialPosts(),
        SupabaseService.getOccurrences(),
        SupabaseService.getPersonnel(),
      ]);
      setPosts(postsData);
      setOccurrences(occData);
      setPersonnel(pData);
    } catch (e) {
      console.error('Error loading B5 data:', e);
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  // === POST HANDLERS ===
  const resetPostForm = () => {
    setPostTitle(''); setPostCategory('Institucional'); setPostContent(''); setPostImageUrl('');
  };

  const handlePublishPost = async () => {
    if (!postContent.trim()) return toast.error('O conteúdo é obrigatório.');

    setLoading(true);
    try {
      const newPost: Omit<SocialPost, 'id'> = {
        title: postTitle || undefined,
        content: postContent,
        category: postCategory,
        platform: 'Instagram',
        likes: 0,
        image_url: postImageUrl || '',
      };
      await SupabaseService.addSocialPost(newPost);
      toast.success('Publicação criada com sucesso!');
      resetPostForm();
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar publicação.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Deseja excluir esta publicação?')) return;
    try {
      await SupabaseService.deleteSocialPost(id);
      toast.success('Publicação excluída.');
      loadData();
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  // === OCCURRENCE HANDLERS ===
  const resetOccForm = () => {
    setOccType(''); setOccDate(''); setOccLocation(''); setOccUnits('');
    setOccDescription(''); setOccOutcome(''); setOccVisibility('internal');
  };

  const handleSaveOccurrence = async () => {
    if (!occType) return toast.error('Tipo de ocorrência é obrigatório.');
    if (!occDate) return toast.error('Data/hora é obrigatória.');
    if (!occLocation) return toast.error('Localização é obrigatória.');
    if (!occDescription) return toast.error('Descrição é obrigatória.');

    setLoading(true);
    try {
      const newOcc: Omit<Occurrence, 'id'> = {
        occurrence_type: occType,
        occurrence_date: occDate,
        location: occLocation,
        units_involved: occUnits || undefined,
        description: occDescription,
        outcome: occOutcome || undefined,
        visibility: occVisibility,
        status: 'registered',
      };
      await SupabaseService.addOccurrence(newOcc);

      // Google Sheets sync
      GoogleSheetsService.syncOccurrence(newOcc).then(ok => {
        if (ok) toast.info('📊 Ocorrência sincronizada com Google Sheets.');
      });

      toast.success('Ocorrência registrada com sucesso!');
      resetOccForm();
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar ocorrência.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOccurrence = async (id: string) => {
    if (!confirm('Deseja excluir esta ocorrência?')) return;
    try {
      await SupabaseService.deleteOccurrence(id);
      toast.success('Ocorrência excluída.');
      loadData();
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  // Filtered data
  const filteredPosts = posts.filter(p => {
    const matchSearch = !postFilter || p.content?.toLowerCase().includes(postFilter.toLowerCase()) || p.title?.toLowerCase().includes(postFilter.toLowerCase());
    const matchCat = !postCategoryFilter || p.category === postCategoryFilter;
    return matchSearch && matchCat;
  });

  const filteredOccurrences = occurrences.filter(o => {
    const matchType = !occFilterType || o.occurrence_type === occFilterType;
    const matchVis = !occFilterVisibility || o.visibility === occFilterVisibility;
    return matchType && matchVis;
  });

  const birthdayPersonnel = personnel
    .filter(p => {
      if (!p.birth_date) return false;
      const [, month, day] = p.birth_date.split('-').map(Number);
      return month === filterMonth && (filterDay === '' || day === filterDay);
    })
    .sort((a, b) => Number(a.birth_date!.split('-')[2]) - Number(b.birth_date!.split('-')[2]));

  const formatDateTime = (dt: string) => {
    try {
      return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dt; }
  };

  const TABS: { key: TabKey; icon: string; label: string }[] = [
    { key: 'DIVULGAÇÃO', icon: 'campaign', label: 'Divulgação' },
    { key: 'OCORRÊNCIAS', icon: 'local_fire_department', label: 'Ocorrências' },
    { key: 'ANIVERSARIANTES', icon: 'cake', label: 'Aniversariantes' },
  ];

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      'Institucional': 'bg-blue-50 text-blue-700',
      'Campanha': 'bg-amber-50 text-amber-700',
      'Operação': 'bg-red-50 text-red-700',
      'Evento': 'bg-green-50 text-green-700',
      'Treinamento': 'bg-indigo-50 text-indigo-700',
      'Comunicado': 'bg-stone-100 text-stone-700',
    };
    return colors[cat] || 'bg-gray-100 text-gray-600';
  };

  const getOccTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'Incêndio': 'local_fire_department',
      'Resgate': 'health_and_safety',
      'Salvamento': 'scuba_diving',
      'APH': 'emergency',
      'Busca': 'person_search',
      'Materiais Perigosos': 'warning',
      'Prevenção': 'shield',
      'Outros': 'more_horiz',
    };
    return icons[type] || 'article';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background-light overflow-hidden relative">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-rustic-border">
            <div>
              <h1 className="text-4xl font-black text-[#2c1810] tracking-tight">Comunicação Social</h1>
              <p className="text-rustic-brown/70 mt-2 text-lg">Divulgação Institucional, Ocorrências e Relações Públicas</p>
            </div>
            <div className="flex gap-3">
              <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 border border-rustic-border bg-white rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                <span className="material-symbols-outlined">refresh</span>
                Atualizar
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-stone-100 p-1 rounded-xl border border-rustic-border">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.key
                    ? 'bg-white text-primary shadow-sm border border-rustic-border/50'
                    : 'text-rustic-brown/60 hover:text-rustic-brown hover:bg-white/50'
                  }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
                {tab.key === 'OCORRÊNCIAS' && occurrences.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black rounded-full">{occurrences.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ============ TAB: DIVULGAÇÃO ============ */}
          {activeTab === 'DIVULGAÇÃO' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Form */}
              <div className="xl:col-span-1">
                <section className="bg-surface rounded-2xl border border-rustic-border shadow-sm overflow-hidden sticky top-0">
                  <div className="bg-gradient-to-r from-[#2c1810] to-[#4a2c20] p-5 text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <span className="material-symbols-outlined text-xl">edit_note</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Nova Publicação</h2>
                        <p className="text-white/70 text-xs">Crie conteúdo institucional</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Título</label>
                      <input value={postTitle} onChange={e => setPostTitle(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm" placeholder="Título da publicação" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Categoria</label>
                      <select value={postCategory} onChange={e => setPostCategory(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm">
                        {POST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Conteúdo</label>
                      <textarea value={postContent} onChange={e => setPostContent(e.target.value)} className="w-full h-32 p-3 rounded-xl border border-rustic-border bg-stone-50 text-sm resize-none" placeholder="Escreva o conteúdo da publicação..." />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">URL da Imagem (opcional)</label>
                      <input value={postImageUrl} onChange={e => setPostImageUrl(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm" placeholder="https://..." />
                    </div>

                    {isEditor ? (
                      <button onClick={handlePublishPost} disabled={loading} className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        Publicar
                      </button>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                        <span className="material-symbols-outlined text-amber-500 text-sm">lock</span>
                        <p className="text-[10px] font-black uppercase text-amber-700 mt-1">Apenas leitura</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Feed */}
              <div className="xl:col-span-2 space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <input value={postFilter} onChange={e => setPostFilter(e.target.value)} className="flex-1 min-w-[200px] h-10 px-4 rounded-xl border border-rustic-border bg-white text-sm" placeholder="🔍 Buscar publicações..." />
                  <select value={postCategoryFilter} onChange={e => setPostCategoryFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-rustic-border bg-white text-sm font-bold">
                    <option value="">Todas categorias</option>
                    {POST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Posts grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPosts.map(post => (
                    <div key={post.id} className="group bg-surface border border-rustic-border rounded-xl overflow-hidden hover:shadow-md transition-all">
                      {post.image_url && (
                        <div className="h-36 bg-gray-100 overflow-hidden">
                          <img src={post.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" loading="lazy" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getCategoryColor(post.category || 'Institucional')}`}>
                            {post.category || 'Institucional'}
                          </span>
                          <span className="text-[10px] text-gray-400">{post.created_at ? new Date(post.created_at).toLocaleDateString('pt-BR') : ''}</span>
                        </div>
                        {post.title && <h3 className="font-bold text-sm text-[#2c1810] mb-1">{post.title}</h3>}
                        <p className="text-xs text-rustic-brown/70 line-clamp-3 mb-3">{post.content}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-rustic-border/50">
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            <span className="material-symbols-outlined text-[14px]">campaign</span>
                            CBMSC Araquari
                          </div>
                          {isEditor && (
                            <button onClick={() => handleDeletePost(post.id!)} className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-md transition-colors" title="Excluir">
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredPosts.length === 0 && (
                    <div className="col-span-2 py-16 text-center opacity-40">
                      <span className="material-symbols-outlined text-5xl">article</span>
                      <p className="text-xs font-black uppercase mt-2">Nenhuma publicação encontrada</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============ TAB: OCORRÊNCIAS ============ */}
          {activeTab === 'OCORRÊNCIAS' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Form */}
              <div className="xl:col-span-1">
                <section className="bg-surface rounded-2xl border border-rustic-border shadow-sm overflow-hidden sticky top-0">
                  <div className="bg-gradient-to-r from-red-800 to-red-900 p-5 text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <span className="material-symbols-outlined text-xl">local_fire_department</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Registrar Ocorrência</h2>
                        <p className="text-white/70 text-xs">Cadastre eventos operacionais</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Tipo de Ocorrência *</label>
                      <select value={occType} onChange={e => setOccType(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm">
                        <option value="">Selecione...</option>
                        {OCCURRENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Data e Hora *</label>
                      <input type="datetime-local" value={occDate} onChange={e => setOccDate(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Localização *</label>
                      <input value={occLocation} onChange={e => setOccLocation(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm" placeholder="Endereço / referência" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Unidades Envolvidas</label>
                      <input value={occUnits} onChange={e => setOccUnits(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm" placeholder="Ex: ABT-01, ASE-03" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Descrição *</label>
                      <textarea value={occDescription} onChange={e => setOccDescription(e.target.value)} className="w-full h-24 p-3 rounded-xl border border-rustic-border bg-stone-50 text-sm resize-none" placeholder="Breve resumo da ocorrência..." />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Desfecho</label>
                      <textarea value={occOutcome} onChange={e => setOccOutcome(e.target.value)} className="w-full h-16 p-3 rounded-xl border border-rustic-border bg-stone-50 text-sm resize-none" placeholder="Resultado / ações tomadas" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Visibilidade</label>
                      <div className="flex gap-2">
                        <button onClick={() => setOccVisibility('internal')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${occVisibility === 'internal' ? 'bg-stone-700 text-white border-stone-700' : 'bg-white text-gray-500 border-rustic-border hover:bg-gray-50'}`}>
                          <span className="material-symbols-outlined text-[14px] mr-1 align-text-bottom">lock</span> Interno
                        </button>
                        <button onClick={() => setOccVisibility('public')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${occVisibility === 'public' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-rustic-border hover:bg-gray-50'}`}>
                          <span className="material-symbols-outlined text-[14px] mr-1 align-text-bottom">public</span> Público
                        </button>
                      </div>
                    </div>

                    {isEditor ? (
                      <button onClick={handleSaveOccurrence} disabled={loading} className="w-full py-3 bg-red-700 text-white rounded-xl font-bold shadow-md hover:bg-red-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        Registrar Ocorrência
                      </button>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                        <span className="material-symbols-outlined text-amber-500 text-sm">lock</span>
                        <p className="text-[10px] font-black uppercase text-amber-700 mt-1">Apenas leitura</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Listing */}
              <div className="xl:col-span-2 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <select value={occFilterType} onChange={e => setOccFilterType(e.target.value)} className="h-10 px-3 rounded-xl border border-rustic-border bg-white text-sm font-bold">
                    <option value="">Todos os tipos</option>
                    {OCCURRENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={occFilterVisibility} onChange={e => setOccFilterVisibility(e.target.value)} className="h-10 px-3 rounded-xl border border-rustic-border bg-white text-sm font-bold">
                    <option value="">Todas visibilidades</option>
                    <option value="public">Público</option>
                    <option value="internal">Interno</option>
                  </select>
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    {filteredOccurrences.length} registro(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {filteredOccurrences.map(occ => (
                    <div key={occ.id} className="bg-surface border border-rustic-border rounded-xl p-5 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${occ.occurrence_type === 'Incêndio' ? 'bg-red-100 text-red-600' : occ.occurrence_type === 'Resgate' || occ.occurrence_type === 'APH' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                            <span className="material-symbols-outlined text-xl">{getOccTypeIcon(occ.occurrence_type)}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-bold text-sm text-[#2c1810]">{occ.occurrence_type}</h3>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${occ.visibility === 'public' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                                {occ.visibility === 'public' ? 'PÚBLICO' : 'INTERNO'}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              {formatDateTime(occ.occurrence_date)}
                              <span className="mx-1">•</span>
                              <span className="material-symbols-outlined text-[12px]">location_on</span>
                              {occ.location}
                            </p>
                          </div>
                        </div>
                        {isEditor && (
                          <button onClick={() => handleDeleteOccurrence(occ.id!)} className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-md transition-colors" title="Excluir">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>

                      <p className="text-sm text-rustic-brown/80 mt-3 leading-relaxed">{occ.description}</p>

                      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-rustic-border/50 text-[10px] text-gray-400">
                        {occ.units_involved && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">fire_truck</span>
                            {occ.units_involved}
                          </span>
                        )}
                        {occ.outcome && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                            {occ.outcome}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredOccurrences.length === 0 && (
                    <div className="py-16 text-center opacity-40">
                      <span className="material-symbols-outlined text-5xl">local_fire_department</span>
                      <p className="text-xs font-black uppercase mt-2">Nenhuma ocorrência registrada</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============ TAB: ANIVERSARIANTES ============ */}
          {activeTab === 'ANIVERSARIANTES' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-surface rounded-2xl border border-rustic-border shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                      <span className="material-symbols-outlined text-xl">cake</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Aniversariantes do Efetivo</h2>
                      <p className="text-white/70 text-xs">Dados vinculados ao módulo B1</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm font-bold">
                      {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <select value={filterDay} onChange={e => setFilterDay(e.target.value === '' ? '' : Number(e.target.value))} className="h-10 px-3 rounded-xl border border-rustic-border bg-stone-50 text-sm font-bold">
                      <option value="">Todos os dias</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {birthdayPersonnel.map(p => {
                      const day = p.birth_date!.split('-')[2];
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-100">
                          <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-black text-sm border border-amber-100">
                            {day}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-[#2c1810] truncate uppercase">{p.war_name || p.name.split(' ')[0]}</p>
                            <p className="text-[10px] text-rustic-brown/60 uppercase font-black">{p.rank} • {p.type}</p>
                          </div>
                          <button onClick={() => toast.success(`Parabéns para ${p.war_name || p.name}! 🎉`)} className="p-2 text-rustic-brown/20 hover:text-amber-500 transition-colors">
                            <span className="material-symbols-outlined text-xl">celebration</span>
                          </button>
                        </div>
                      );
                    })}
                    {birthdayPersonnel.length === 0 && (
                      <div className="py-16 text-center opacity-40">
                        <span className="material-symbols-outlined text-5xl">event_busy</span>
                        <p className="text-xs font-black uppercase mt-2">Sem aniversariantes neste período</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SocialB5;