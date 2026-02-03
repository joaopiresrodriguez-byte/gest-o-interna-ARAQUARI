import React, { useState, useEffect } from 'react';
import { SupabaseService, SocialPost } from '../services/SupabaseService';

const SocialB5: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const data = await SupabaseService.getSocialPosts();
    setPosts(data);
  };

  const handleAlert = (msg: string) => alert(msg);

  const handleGenerate = () => {
    if (!prompt) {
      alert("Por favor, digite um tópico para gerar o post.");
      return;
    }
    setIsGenerating(true);
    // Mock AI generation delay
    setTimeout(() => {
      setGeneratedContent(`🔥 **CONFIRA ESTA DICA DE SEGURANÇA!** 🔥\n\n${prompt}\n\nPrevenir é sempre a melhor opção! Fique atento e proteja sua família. Em caso de emergência, ligue 193 🚒🚨 #Bombeiros #Segurança #Prevenção`);
      setIsGenerating(false);
    }, 1500);
  };

  const handlePublish = async () => {
    if (!generatedContent) return;

    const newPost: SocialPost = {
      content: generatedContent,
      platform: 'Instagram', // Default
      likes: 0,
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmaXU709rv8FwOkDCS-1ouwrNX8OQEtiyXWLttdNXzaW0sPec3BXmb486h9QwqBO7VQvOskKRODIzGwHNJUYG0FtULOsceI46W4RBbeXf6z-mnQgMpXRNpJiHBgn8KNMHBRepdqyoOOt9N5iFOv9trtpW2k2LwrEyJrDZHQWrxcCNiiwrymaY7qRpULS2dL9FRiPwcU3UCUSnXzjO2znUbqqki3FlOzK5ZCl5uyHF7t_uJ1-uj6gkhI5baUhD_5O9eCGtB8bwJu7w' // Placeholder image
    };

    await SupabaseService.addSocialPost(newPost);
    alert("Post publicado no feed interno!");
    setGeneratedContent("");
    setPrompt("");
    loadPosts();
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm("Deseja excluir este post permanentemente?")) return;
    try {
      await SupabaseService.deleteSocialPost(id);
      loadPosts();
    } catch (error) {
      alert("Erro ao excluir post.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background-light overflow-hidden relative">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-rustic-border">
            <div>
              <h1 className="text-4xl font-black text-[#2c1810] tracking-tight">Comunicação Social</h1>
              <p className="text-rustic-brown/70 mt-2 text-lg">Gerenciamento de Mídias, Eventos e Relações Públicas.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={loadPosts} className="flex items-center gap-2 px-4 py-2 border border-rustic-border bg-white rounded-lg hover:bg-gray-50 bg-white shadow-sm transition-colors">
                <span className="material-symbols-outlined">refresh</span>
                Atualizar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Left Column: AI Generator (2/3 width on large screens) */}
            <div className="xl:col-span-2 space-y-8">
              {/* Generator Card */}
              <section className="bg-surface rounded-2xl border border-rustic-border shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#2c1810] to-[#4a2c20] p-6 text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                      <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Gerador de Posts IA</h2>
                      <p className="text-white/70 text-sm">Crie conteúdo engajador em segundos</p>
                    </div>
                  </div>
                  <div className="hidden sm:block text-xs font-mono bg-white/10 px-3 py-1 rounded-full border border-white/20">
                    BETA v1.4
                  </div>
                </div>

                <div className="p-6">
                  <label className="block mb-2 text-sm font-bold text-rustic-brown">Sobre o que vamos falar hoje?</label>
                  <div className="relative">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full h-32 p-4 rounded-xl border border-rustic-border bg-background-light focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-[#2c1810] placeholder:text-rustic-brown/40"
                      placeholder="Ex: Dicas para evitar acidentes domésticos com gás de cozinha..."
                    ></textarea>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="absolute bottom-4 right-4 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-[18px]">sync</span>
                          Criando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">shutter_speed</span>
                          Gerar Rascunho
                        </>
                      )}
                    </button>
                  </div>

                  {/* Result Area */}
                  {generatedContent && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-bold text-rustic-brown flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">done_all</span>
                          Resultado Gerado
                        </label>
                      </div>
                      <div className="p-5 rounded-xl bg-[#fdfbf7] border border-orange-100 shadow-inner text-[#2c1810] leading-relaxed whitespace-pre-wrap font-sans">
                        {generatedContent}
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button onClick={handlePublish} className="flex-1 py-3 bg-secondary-green text-white rounded-xl font-bold shadow-md hover:bg-green-700 transition-transform active:scale-[0.98]">
                          Salvar & Publicar no Feed
                        </button>
                        <button onClick={() => handleAlert("Modo de edição ativado.")} className="px-6 py-3 border border-rustic-border bg-white text-rustic-brown rounded-xl font-bold hover:bg-gray-50 transition-colors">
                          Editar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Feed Preview */}
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-[#2c1810] flex items-center gap-2">
                  <span className="material-symbols-outlined">feed</span>
                  Últimas Publicações (Internas)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.map(post => (
                    <div key={post.id} className="group bg-surface border border-rustic-border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCUZNkodcOHH4UrQlQtGh_25jCttr3qR09LqM1ap07tQGS77H-zwADeaZq2WQpoy5MZXGtfQrKQEKwIlrc2lCPH76Pi8Gg1sUoiiLwBakYqHGHjHlW_mpvTQ36ivAQTz0YGnOrn7yCfFNy_Lb2FjMJHt2PzbA26Ddeb8diMbh2QlnSNepg2rDULcLqMr2a5fEhKOPJsJU5KiCE2tfj-NylUntS9bWUPRUu3Nu3a7WhIFBP3xLKf5bGE-Qy8HF75XVlaiHwqL8C6ZZY")' }}></div>
                        <div>
                          <h4 className="font-bold text-sm text-[#2c1810]">CBMSC Araquari</h4>
                          <span className="text-xs text-rustic-brown/60">Recente • {post.platform}</span>
                        </div>
                      </div>
                      <p className="text-sm text-rustic-brown/80 mb-3 line-clamp-3">
                        {post.content}
                      </p>
                      <div className="h-40 rounded-lg bg-gray-100 mb-3 overflow-hidden">
                        <img src={post.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Imagem do Post" />
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium text-rustic-brown/60 pt-2 border-t border-rustic-border/50">
                        <span>{post.likes} Curtidas</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id!); }}
                          className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-md transition-colors"
                          title="Excluir Post"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {posts.length === 0 && <p className="col-span-2 text-center text-gray-400">Nenhum post publicado.</p>}
                </div>
              </div>
            </div>

            {/* Right Column: Sidebar Widgets (Kept Static for now as user didn't ask for generic events DB yet, but could expand) */}
            <div className="space-y-6">
              <div className="bg-surface rounded-xl border border-rustic-border p-5 shadow-sm">
                <h3 className="font-bold text-[#2c1810] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">cake</span>
                  Aniversariantes
                </h3>
                <p className="text-sm text-gray-400">Funcionalidade conectada ao módulo de Pessoal.</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialB5;