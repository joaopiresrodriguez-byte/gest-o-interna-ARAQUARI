import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { SupabaseService, SSCIAnalysis, SSCIChatSession, SSCIChatMessage, SSCINormativeDocument } from '../services/SupabaseService';
import { GeminiService } from '../services/GeminiService';

const SSCI: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'ANALISE' | 'PESQUISA' | 'CONHECIMENTO'>('ANALISE');
    const [loading, setLoading] = useState(false);
    const { profile } = useAuth();

    // --- SECTION 1: ANALYSIS ---
    const [analyses, setAnalyses] = useState<SSCIAnalysis[]>([]);
    const [requestType, setRequestType] = useState<'requerimento' | 'recurso'>('requerimento');
    const [protocol, setProtocol] = useState("");
    const [description, setDescription] = useState("");
    const [analysisFiles, setAnalysisFiles] = useState<File[]>([]);
    const [currentAnalysis, setCurrentAnalysis] = useState<SSCIAnalysis | null>(null);
    const [includeWebAnalysis, setIncludeWebAnalysis] = useState(true);

    // --- SECTION 2: CHAT ---
    const [chatSessions, setChatSessions] = useState<SSCIChatSession[]>([]);
    const [currentSession, setCurrentSession] = useState<SSCIChatSession | null>(null);
    const [messages, setMessages] = useState<SSCIChatMessage[]>([]);
    const [userInput, setUserInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [includeWebChat, setIncludeWebChat] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- SECTION 3: KNOWLEDGE BASE ---
    const [normativeDocs, setNormativeDocs] = useState<SSCINormativeDocument[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("Todos");
    const [isAddingDoc, setIsAddingDoc] = useState(false);

    // Doc Form
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docName, setDocName] = useState("");
    const [docType, setDocType] = useState("Instrução Normativa");
    const [docCode, setDocCode] = useState("");
    const [docIssuer, setDocIssuer] = useState("CBMSC");
    const [docCategory, setDocCategory] = useState("Técnico");

    useEffect(() => {
        loadData();
    }, [activeTab]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'ANALISE') {
                const data = await SupabaseService.getSSCIAnalyses();
                setAnalyses(data);
            } else if (activeTab === 'PESQUISA') {
                const sessions = await SupabaseService.getSSCIChatSessions();
                setChatSessions(sessions);
                if (sessions.length > 0 && !currentSession) {
                    handleSelectSession(sessions[0]);
                }
            } else if (activeTab === 'CONHECIMENTO') {
                const docs = await SupabaseService.getSSCINormativeDocuments();
                setNormativeDocs(docs);
            }
        } catch (error) {
            console.error("Error loading SSCI data:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- ANALYSIS HANDLERS ---
    const handleSubmitAnalysis = async () => {
        if (!protocol || !description) return alert("Protocolo e descrição são obrigatórios.");
        setLoading(true);
        try {
            // 1. Fetch relevant normative docs for context
            const docs = await SupabaseService.getSSCINormativeDocuments();
            // Filter or just send titles/ementas for context (GeminiService handles formatting)

            // 2. Prepare files for Gemini (Multimodal)
            const processedFiles = await Promise.all(analysisFiles.map(async (file) => {
                return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve({ mimeType: file.type, data: base64 });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }));

            // 3. Call Gemini for deep analysis with files
            const geminiResult = await GeminiService.analisarRequerimentoComGemini({
                tipo_solicitacao: requestType,
                numero_protocolo: protocol,
                descricao_solicitacao: description,
                incluir_web: includeWebAnalysis,
                arquivos: processedFiles
            }, docs);

            const uploadedUrls: string[] = [];
            for (const file of analysisFiles) {
                const fileName = `${Date.now()}_${file.name}`;
                await SupabaseService.uploadFile('ssci-anexos', fileName, file);
                uploadedUrls.push(SupabaseService.getPublicUrl('ssci-anexos', fileName));
            }

            const analysisData: SSCIAnalysis = {
                tipo_solicitacao: requestType,
                numero_protocolo: protocol,
                descricao_solicitacao: description,
                resposta_ia: geminiResult.resposta,
                documentos_anexados: uploadedUrls,
                usuario_responsavel: "Capitão Técnico",
                fonte_web: geminiResult.fonte_web,
                links_cbmsc: geminiResult.links_cbmsc,
                modelo_ia: 'gemini-pro',
                normativas_citadas: GeminiService.extrairNormativas(geminiResult.resposta)
            };

            const result = await SupabaseService.addSSCIAnalysis(analysisData);
            setCurrentAnalysis(result[0]);
            setProtocol("");
            setDescription("");
            setAnalysisFiles([]);
            loadData();
        } catch (error: any) {
            console.error("Erro na análise profunda do Gemini:", error);
            alert(`Erro ao processar análise profunda: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAnalysis = async (id: string, files: string[]) => {
        if (!confirm("Excluir esta análise permanentemente? Os arquivos anexados também serão removidos.")) return;
        try {
            await SupabaseService.deleteSSCIAnalysis(id);
            // Storage cleanup logic could be added here if desired.
            loadData();
        } catch (error) {
            alert("Erro ao excluir análise.");
        }
    };

    const handleDeleteChatSession = async (id: string) => {
        if (!confirm("Excluir esta sessão de chat e todas as mensagens?")) return;
        try {
            await SupabaseService.deleteSSCIChatSession(id);
            if (currentSession?.id === id) {
                setCurrentSession(null);
                setMessages([]);
            }
            loadData();
        } catch (error) {
            alert("Erro ao excluir sessão.");
        }
    };

    // --- CHAT HANDLERS ---
    const handleSelectSession = async (session: SSCIChatSession) => {
        setCurrentSession(session);
        const msgs = await SupabaseService.getSSCIChatMessages(session.id!);
        setMessages(msgs);
    };

    const handleNewChat = async () => {
        const newSession = await SupabaseService.createSSCIChatSession({
            titulo_sessao: `Consulta ${new Date().toLocaleTimeString()}`,
            usuario: "Usuário Logado"
        });
        setChatSessions([newSession, ...chatSessions]);
        handleSelectSession(newSession);
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || !currentSession) return;
        const msgText = userInput;
        setUserInput("");
        setIsTyping(true);

        const userMsg: SSCIChatMessage = {
            sessao_id: currentSession.id!,
            mensagem_usuario: msgText,
            resposta_ia: "..." // Temp
        };

        try {
            // 1. Get normativa context
            const docs = await SupabaseService.getSSCINormativeDocuments();

            // 2. Map history
            const history = messages.map(m => ([
                { role: 'user' as const, content: m.mensagem_usuario },
                { role: 'model' as const, content: m.resposta_ia }
            ])).flat();

            // 3. Call Gemini Chat
            const geminiResult = await GeminiService.chatNormativoGemini(msgText, history, docs, includeWebChat);

            const finalMsg = await SupabaseService.addSSCIChatMessage({
                ...userMsg,
                resposta_ia: geminiResult.resposta,
                documentos_referenciados: geminiResult.documentos_referenciados,
                normativas_referenciadas: geminiResult.links_externos
            });
            setMessages(prev => [...prev, finalMsg]);
        } catch (error: any) {
            console.error('[SSCI Chat] Error:', error);
            alert(`Erro ao obter resposta da IA: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setIsTyping(false);
        }
    };

    // --- KNOWLEDGE BASE HANDLERS ---
    const handleAddDocument = async () => {
        if (!docFile || !docName) return alert("Arguivo e Nome são obrigatórios.");
        setLoading(true);
        try {
            const fileName = `${Date.now()}_${docFile.name}`;
            await SupabaseService.uploadFile('ssci-documentos-normativos', fileName, docFile);
            const url = SupabaseService.getPublicUrl('ssci-documentos-normativos', fileName);

            await SupabaseService.addSSCINormativeDocument({
                nome_documento: docName,
                tipo_documento: docType,
                numero_codigo: docCode,
                orgao_emissor: docIssuer,
                categoria: docCategory,
                arquivo_url: url,
                tamanho_kb: Math.round(docFile.size / 1024),
                status: 'ativo'
            });

            alert("Documento adicionado ao Banco de Conhecimento!");
            setIsAddingDoc(false);
            setDocFile(null);
            setDocName("");
            loadData();
        } catch (error) {
            alert("Erro ao salvar documento.");
        } finally {
            setLoading(false);
        }
    };

    const filteredDocs = normativeDocs.filter(doc => {
        const matchesSearch = doc.nome_documento.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.numero_codigo?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === "Todos" || doc.tipo_documento === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light text-rustic-brown font-display">
            {/* Header */}
            <header className="px-8 py-6 bg-white border-b border-rustic-border shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-black tracking-tight text-[#181111]">Módulo SSCI</h1>
                        <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-black rounded-full shadow-sm">v1.0.4</span>
                    </div>
                    <p className="text-sm opacity-60">Análise Técnica, Pesquisa Normativa e Banco de Conhecimento</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    {(['ANALISE', 'PESQUISA', 'CONHECIMENTO'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {tab === 'ANALISE' ? 'Análise' : tab === 'PESQUISA' ? 'Chat IA' : 'Documentos'}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto h-full">

                    {/* --- SECTION 1: TECHNICAL ANALYSIS --- */}
                    {activeTab === 'ANALISE' && (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">
                            {/* Input Form */}
                            <div className="xl:col-span-5 flex flex-col gap-6">
                                <div className="bg-white p-8 rounded-2xl border border-rustic-border shadow-sm space-y-6">
                                    <h3 className="font-black text-xl flex items-center gap-2"><span className="material-symbols-outlined text-primary">gavel</span> Nova Solicitação</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Tipo</label>
                                            <select
                                                value={requestType}
                                                onChange={e => setRequestType(e.target.value as any)}
                                                className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-stone-50 font-bold text-sm"
                                            >
                                                <option value="requerimento">Requerimento Técnico</option>
                                                <option value="recurso">Recurso Técnico</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Nº Protocolo</label>
                                            <input
                                                type="text"
                                                value={protocol}
                                                onChange={e => setProtocol(e.target.value)}
                                                placeholder="Ex: 2024/001"
                                                className="w-full h-11 px-4 rounded-xl border border-rustic-border bg-white font-bold text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400 px-1">Descrição</label>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Descreva detalhadamente a demanda..."
                                            className="w-full h-40 p-4 rounded-xl border border-rustic-border bg-stone-50 text-sm resize-none"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400 px-1">Anexos (Opcional)</label>
                                        <label className="block w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-stone-50 transition-colors">
                                            <div className="flex flex-col items-center">
                                                <span className="material-symbols-outlined text-gray-300">upload_file</span>
                                                <span className="text-xs text-gray-400 font-bold mt-1">{analysisFiles.length > 0 ? `${analysisFiles.length} arquivos` : 'Selecionar Documentos'}</span>
                                            </div>
                                            <input type="file" multiple accept=".pdf,image/*" className="hidden" onChange={e => e.target.files && setAnalysisFiles(Array.from(e.target.files))} />
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-rustic-border select-none cursor-pointer hover:bg-stone-100 transition-all" onClick={() => setIncludeWebAnalysis(!includeWebAnalysis)}>
                                        <input
                                            type="checkbox"
                                            checked={includeWebAnalysis}
                                            onChange={() => { }}
                                            className="size-4 accent-primary"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-[#181111]">Buscar também no site do CBMSC</span>
                                            <span className="text-[10px] text-gray-400 font-bold">Consulta normas atualizadas na web</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmitAnalysis}
                                        disabled={loading || profile?.p_ssci !== 'editor'}
                                        className={`w-full py-4 ${loading || profile?.p_ssci !== 'editor' ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary'} text-white font-black text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex flex-col items-center justify-center gap-1`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>{loading ? 'sync' : 'smart_toy'}</span>
                                            {loading ? 'PROCESSANDO ANÁLISE...' : profile?.p_ssci === 'editor' ? 'SUBMETER PARA ANÁLISE DA IA' : 'SOMENTE LEITURA'}
                                        </div>
                                        {loading && includeWebAnalysis && (
                                            <span className="text-[9px] font-bold opacity-80 uppercase tracking-widest animate-pulse">Consultando cbm.sc.gov.br...</span>
                                        )}
                                        {profile?.p_ssci !== 'editor' && (
                                            <span className="text-[9px] font-bold opacity-80 uppercase tracking-widest text-amber-200">Você só tem permissão de LEITURA</span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Result Area */}
                            <div className="xl:col-span-7">
                                {currentAnalysis ? (
                                    <div className="bg-white rounded-2xl border border-rustic-border shadow-md overflow-hidden flex flex-col h-full max-h-[700px]">
                                        <div className="bg-stone-50 border-b border-rustic-border p-6 flex justify-between items-center">
                                            <h3 className="font-black text-lg text-[#181111]">Manifestação Jurídica Estruturada</h3>
                                            <div className="flex gap-2">
                                                {profile?.p_ssci === 'editor' && (
                                                    <button onClick={() => handleDeleteAnalysis(currentAnalysis.id!, currentAnalysis.documentos_anexados || [])} className="p-2 bg-white border rounded-lg hover:bg-red-50 text-red-400"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                                                )}
                                                <button className="p-2 bg-white border rounded-lg hover:bg-gray-50"><span className="material-symbols-outlined text-[20px]">print</span></button>
                                                <button className="p-2 bg-white border rounded-lg hover:bg-gray-50"><span className="material-symbols-outlined text-[20px]">content_copy</span></button>
                                                <button onClick={() => setCurrentAnalysis(null)} className="p-2 bg-primary text-white rounded-lg hover:brightness-110"><span className="material-symbols-outlined text-[20px]">close</span></button>
                                            </div>
                                        </div>
                                        <div className="p-8 overflow-y-auto bg-[#fafafa] flex flex-col gap-6">
                                            <div className="max-w-3xl mx-auto bg-white border border-stone-200 p-10 shadow-sm font-serif leading-relaxed whitespace-pre-wrap text-gray-800">
                                                {currentAnalysis.resposta_ia}
                                            </div>

                                            {currentAnalysis.fonte_web && currentAnalysis.fonte_web.length > 0 && (
                                                <div className="max-w-3xl mx-auto w-full bg-blue-50/30 border border-blue-100 p-6 rounded-xl">
                                                    <h4 className="text-xs font-black uppercase text-blue-600 mb-4 flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[16px]">language</span> Fontes Consultadas no Site CBMSC
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {currentAnalysis.fonte_web.map((fonte: any, idx: number) => (
                                                            <a key={idx} href={fonte.link} target="_blank" rel="noopener noreferrer" className="block p-3 bg-white border border-blue-100 rounded-lg hover:shadow-md transition-all">
                                                                <p className="text-sm font-bold text-blue-800">{fonte.titulo}</p>
                                                                <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{fonte.snippet}</p>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-stone-100/50 border-2 border-dashed border-gray-200 rounded-2xl h-full flex flex-col items-center justify-center text-center p-12 opacity-50">
                                        <span className="material-symbols-outlined text-[80px] text-gray-200 mb-4">description</span>
                                        <h4 className="font-black text-gray-400 text-xl tracking-wide">ÁREA DE MANIFESTAÇÃO TÉCNICA</h4>
                                        <p className="text-gray-300 max-w-sm mt-2 font-bold">As respostas formatadas serão exibidas aqui após o processamento da IA.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- SECTION 2: NORMATIVE RESEARCH CHAT --- */}
                    {activeTab === 'PESQUISA' && (
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 h-[calc(100vh-250px)]">
                            {/* Sessions Sidebar */}
                            <div className="bg-white rounded-2xl border border-rustic-border shadow-sm flex flex-col overflow-hidden">
                                <div className="p-4 border-b">
                                    <button onClick={handleNewChat} className="w-full py-3 bg-secondary-green text-white font-black text-xs rounded-xl shadow-md hover:brightness-110 flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">add</span> NOVO CHAT
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {chatSessions.map(sess => (
                                        <button
                                            key={sess.id}
                                            onClick={() => handleSelectSession(sess)}
                                            className={`group w-full text-left p-4 border-b hover:bg-stone-50 transition-colors ${currentSession?.id === sess.id ? 'bg-stone-100 border-l-4 border-primary' : ''}`}
                                        >
                                            <p className="font-bold text-sm truncate">{sess.titulo_sessao}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-gray-400 font-bold">{new Date(sess.data_inicio!).toLocaleDateString('pt-BR')}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteChatSession(sess.id!); }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-300 hover:text-red-500 rounded transition-all"
                                                    disabled={profile?.p_ssci !== 'editor'}
                                                >
                                                    {profile?.p_ssci === 'editor' && <span className="material-symbols-outlined text-[14px]">delete</span>}
                                                </button>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Chat Area */}
                            <div className="xl:col-span-3 bg-white rounded-2xl border border-rustic-border shadow-sm flex flex-col overflow-hidden">
                                <div className="p-4 bg-stone-50 border-b flex justify-between items-center">
                                    <h3 className="font-black text-sm flex items-center gap-2 text-primary">
                                        <span className="material-symbols-outlined">forum</span>
                                        {currentSession ? currentSession.titulo_sessao : 'Selecione ou inicie uma conversa'}
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
                                            <span className="text-[10px] font-black uppercase text-gray-400">Incluir Web</span>
                                            <button
                                                onClick={() => setIncludeWebChat(!includeWebChat)}
                                                className={`w-8 h-4 rounded-full relative transition-colors ${includeWebChat ? 'bg-primary' : 'bg-gray-200'}`}
                                            >
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${includeWebChat ? 'left-[18px]' : 'left-0.5'}`} />
                                            </button>
                                        </div>
                                        <button onClick={() => setMessages([])} className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition-colors">Limpar Histórico</button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {messages.map((msg, i) => (
                                        <div key={i} className="space-y-4">
                                            {/* User Message */}
                                            <div className="flex justify-end">
                                                <div className="bg-secondary-green text-white p-4 rounded-2xl rounded-tr-none max-w-[80%] shadow-sm">
                                                    <p className="text-sm font-medium">{msg.mensagem_usuario}</p>
                                                    <span className="text-[9px] font-black opacity-50 block mt-1 text-right">VOCÊ • {new Date(msg.timestamp_pergunta!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            {/* IA Message */}
                                            <div className="flex justify-start">
                                                <div className="bg-gray-100 text-[#181111] p-4 rounded-2xl rounded-tl-none max-w-[80%] border border-gray-200 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                                    <p className="text-sm leading-relaxed">{msg.resposta_ia}</p>
                                                    <span className="text-[9px] font-black text-gray-400 block mt-2">ASSISTENTE SSCI • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isTyping && (
                                        <div className="flex justify-start">
                                            <div className="flex flex-col gap-1 items-start">
                                                <div className="bg-gray-100 p-4 rounded-xl flex gap-1 w-fit">
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                                                </div>
                                                {includeWebChat && (
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest ml-1 animate-pulse flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">language</span> Buscando no site CBMSC...
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                <div className="p-4 border-t bg-stone-50">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={userInput}
                                            onChange={e => setUserInput(e.target.value)}
                                            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Digite sua dúvida sobre Instruções Normativas (Ex: sinalização, hidrantes...)"
                                            className="flex-1 h-12 px-5 rounded-xl border border-rustic-border shadow-inner text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            className="size-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg hover:brightness-110 active:scale-90 transition-all"
                                        >
                                            <span className="material-symbols-outlined">send</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SECTION 3: KNOWLEDGE BASE --- */}
                    {activeTab === 'CONHECIMENTO' && (
                        <div className="space-y-8">
                            {/* Toolbar & Filters */}
                            <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm flex flex-wrap items-center justify-between gap-6">
                                <div className="flex items-center gap-6 flex-1">
                                    <div className="relative flex-1 max-w-md">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-300">search</span>
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="Buscar normativa por nome ou número..."
                                            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-100 bg-stone-50 text-sm focus:bg-white transition-all shadow-inner"
                                        />
                                    </div>
                                    <select
                                        value={filterType}
                                        onChange={e => setFilterType(e.target.value)}
                                        className="h-11 px-4 rounded-xl border border-gray-100 bg-stone-50 font-bold text-xs uppercase"
                                    >
                                        <option>Todos</option>
                                        <option>Instrução Normativa</option>
                                        <option>Portaria</option>
                                        <option>Lei</option>
                                        <option>Decreto</option>
                                    </select>
                                </div>
                                {profile?.p_ssci === 'editor' && (
                                    <button
                                        onClick={() => setIsAddingDoc(true)}
                                        className="px-6 py-3 bg-secondary-green text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 hover:brightness-110"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add_circle</span> NOVO DOCUMENTO
                                    </button>
                                )}
                            </div>

                            {/* Documents Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredDocs.map(doc => (
                                    <div key={doc.id} className="bg-white rounded-2xl border border-rustic-border shadow-sm hover:shadow-md transition-all overflow-hidden relative group">
                                        <div className="p-5 h-full flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-[9px] font-black bg-stone-100 px-2 py-1 rounded uppercase tracking-tighter">{doc.tipo_documento}</span>
                                                <button onClick={async () => {
                                                    if (confirm("Excluir normativa?")) {
                                                        const fileName = doc.arquivo_url.split('/').pop()!;
                                                        await SupabaseService.deleteSSCINormativeDocument(doc.id!, fileName);
                                                        loadData();
                                                    }
                                                }} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600" disabled={profile?.p_ssci !== 'editor'}>
                                                    {profile?.p_ssci === 'editor' && <span className="material-symbols-outlined text-[18px]">delete</span>}
                                                </button>
                                            </div>
                                            <h4 className="font-bold text-[#181111] text-base leading-tight mb-1 line-clamp-2">{doc.nome_documento}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-4">{doc.numero_codigo} • {doc.orgao_emissor}</p>

                                            <div className="mt-auto flex items-center justify-between border-t border-stone-50 pt-4">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                    {doc.vezes_referenciado || 0}
                                                </div>
                                                <div className="flex gap-2">
                                                    <a href={doc.arquivo_url} target="_blank" className="p-2 rounded-lg bg-stone-50 text-primary hover:bg-stone-100 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                    </a>
                                                    <a href={doc.arquivo_url} download className="p-2 rounded-lg bg-stone-50 text-gray-400 hover:text-gray-600 hover:bg-stone-100 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Add Doc Modal */}
                            {isAddingDoc && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                                    <div className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                                        <div className="p-6 bg-stone-50 border-b border-rustic-border flex justify-between items-center">
                                            <h3 className="font-black text-xl">Cadastrar Normativa</h3>
                                            <button onClick={() => setIsAddingDoc(false)} className="size-8 rounded-full bg-white border flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all font-bold">×</button>
                                        </div>
                                        <div className="p-8 space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Nome do Documento</label>
                                                <input value={docName} onChange={e => setDocName(e.target.value)} type="text" className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm" placeholder="Ex: Sistemas de Hidrantes" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Tipo</label>
                                                    <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm">
                                                        <option>Instrução Normativa</option><option>Portaria</option><option>Lei</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Código</label>
                                                    <input value={docCode} onChange={e => setDocCode(e.target.value)} type="text" className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm" placeholder="Ex: IN 001/2023" />
                                                </div>
                                            </div>
                                            <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-stone-50 transition-all ${docFile ? 'border-secondary-green bg-green-50/10' : 'border-gray-200'}`}>
                                                <span className="text-xs font-bold text-gray-400">{docFile ? docFile.name : 'Selecionar Arquivo PDF'}</span>
                                                <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setDocFile(e.target.files[0])} />
                                            </label>
                                            <button onClick={handleAddDocument} disabled={loading} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all">
                                                SALVAR NA BASE DE CONHECIMENTO
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default SSCI;
