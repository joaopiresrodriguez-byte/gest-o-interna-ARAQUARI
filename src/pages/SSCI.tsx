import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { SupabaseService, SSCIAnalysis, SSCIChatSession, SSCIChatMessage, SSCINormativeDocument } from '../services/SupabaseService';
import { GroqService } from '../services/GroqService';

const SSCI: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'ANALISE' | 'PESQUISA' | 'CONHECIMENTO'>('ANALISE');
    const [loading, setLoading] = useState(false);
    const { profile } = useAuth();

    // --- SECTION 1: ANALYSIS ---
    const [analyses, setAnalyses] = useState<SSCIAnalysis[]>([]);
    const [analysisFiles, setAnalysisFiles] = useState<File[]>([]);
    const [currentAnalysis, setCurrentAnalysis] = useState<SSCIAnalysis | null>(null);
    const [includeWebAnalysis, setIncludeWebAnalysis] = useState(true);
    const [analysisError, setAnalysisError] = useState('');

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
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [documentName, setDocumentName] = useState("");
    const [documentType, setDocumentType] = useState("Instrução Normativa");
    const [documentCode, setDocumentCode] = useState("");
    const [documentIssuer, setDocumentIssuer] = useState("CBMSC");
    const [documentCategory, setDocumentCategory] = useState("Técnico");

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
        const pdfFile = analysisFiles.find(f => f.type === 'application/pdf');

        if (!pdfFile) {
            setAnalysisError("Por favor, anexe um arquivo PDF para análise.");
            return;
        }

        setLoading(true);
        setAnalysisError('');

        try {
            // 1. Fetch relevant normative docs for context
            const docs = await SupabaseService.getSSCINormativeDocuments();

            // 2. Call Groq for deep analysis using PDF extraction
            const groqResult = await GroqService.analisarRequerimentoComGroq({
                arquivoPDF: pdfFile,
                incluir_web: includeWebAnalysis,
                // Legacy placeholders
                tipo: 'REQUERIMENTO',
                protocolo: 'AUTO',
                descricao: 'Análise automática de PDF'
            }, docs);

            // 3. Upload File
            const fileName = `${Date.now()}_${pdfFile.name}`;
            await SupabaseService.uploadFile('ssci-documentos-normativos', fileName, pdfFile);
            const fileUrl = SupabaseService.getPublicUrl('ssci-documentos-normativos', fileName);

            // 4. Save Analysis
            const analysisData: SSCIAnalysis = {
                request_type: 'requerimento', // Default
                protocol_number: `AUTO-${Date.now().toString().slice(-6)}`, // Generated ID
                request_description: `Análise do arquivo: ${pdfFile.name}`,
                ai_response: groqResult.ai_response,
                attached_documents: [fileUrl],
                responsible_user: profile?.id || "Usuário SSCI",
                web_source: groqResult.web_source,
                cbmsc_links: groqResult.cbmsc_links,
                ai_model: groqResult.ai_model,
                cited_normatives: GroqService.extrairNormativas(groqResult.ai_response)
            };

            const result = await SupabaseService.addSSCIAnalysis(analysisData);
            setCurrentAnalysis(result as any);
            setAnalysisFiles([]);
            loadData();
        } catch (error: any) {
            console.error("Erro na análise profunda:", error);
            setAnalysisError(`Erro ao processar análise: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAnalysis = async (id: string) => {
        if (!confirm("Excluir esta análise permanentemente? Os arquivos anexados também serão removidos.")) return;
        try {
            await SupabaseService.deleteSSCIAnalysis(id);
            // Storage cleanup logic could be added here if desired.
            loadData();
            if (currentAnalysis?.id === id) setCurrentAnalysis(null);
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
            session_title: `Consulta ${new Date().toLocaleTimeString()}`,
            user: "Usuário Logado"
        });
        setChatSessions([newSession, ...chatSessions]);
        handleSelectSession(newSession);
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || !currentSession) return;
        const msgText = userInput;

        // CHECK API KEY for Web Search fallback
        if (includeWebChat && !import.meta.env.VITE_GOOGLE_SEARCH_API_KEY) {
            // Just log/warn, don't alert blocking
            console.warn("Google Search API Key missing. Web search will be skipped.");
        }

        setUserInput("");
        setIsTyping(true);

        const userMsg: SSCIChatMessage = {
            session_id: currentSession.id!,
            user_message: msgText,
            ai_response: "..." // Temp
        };

        try {
            // 1. Get normativa context
            const docs = await SupabaseService.getSSCINormativeDocuments();

            // 2. Map history
            const history = messages.map(m => ([
                { role: 'user' as const, content: m.user_message },
                { role: 'model' as const, content: m.ai_response }
            ])).flat();

            // 3. Call Groq Chat
            const groqResult = await GroqService.chatNormativoGroq(msgText, history, docs, includeWebChat);

            const finalMsg = await SupabaseService.addSSCIChatMessage({
                ...userMsg,
                ai_response: groqResult.ai_response,
                referenced_documents: groqResult.referenced_documents,
                referenced_normatives: groqResult.referenced_normatives
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
        if (!documentFile || !documentName) return alert("Arquivo e Nome são obrigatórios.");
        setLoading(true);
        try {
            const fileName = `${Date.now()}_${documentFile.name}`;
            await SupabaseService.uploadFile('ssci-documentos-normativos', fileName, documentFile);
            const url = SupabaseService.getPublicUrl('ssci-documentos-normativos', fileName);

            await SupabaseService.addSSCINormativeDocument({
                document_name: documentName,
                document_type: documentType,
                code_number: documentCode,
                issuing_body: documentIssuer,
                category: documentCategory,
                file_url: url,
                size_kb: Math.round(documentFile.size / 1024),
                status: 'Active'
            });

            alert("Documento adicionado ao Banco de Conhecimento!");
            setIsAddingDoc(false);
            setDocumentFile(null);
            setDocumentName("");
            loadData();
        } catch (error) {
            alert("Erro ao salvar documento.");
        } finally {
            setLoading(false);
        }
    };

    const filteredDocs = normativeDocs.filter(doc => {
        const matchesSearch = doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.code_number?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === "Todos" || doc.document_type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light text-rustic-brown font-display">
            {/* Header */}
            <header className="px-8 py-6 bg-[#1a1c1e] border-b border-[#2d2f31] shadow-xl flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-white">Módulo SSCI</h1>
                        <span className="px-3 py-1 bg-primary/20 text-primary text-[11px] font-black rounded-full shadow-lg border border-primary/30">v2.0.0 PDF ANALYSIS</span>
                    </div>
                    <p className="text-sm text-gray-400 font-medium">Análise Estratégica & Inteligência Normativa</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-[#2d2f31] p-1.5 rounded-lg border border-[#3d3f41]">
                        <input
                            type="password"
                            placeholder="Groq API Key..."
                            className="bg-transparent text-white text-xs px-2 outline-none w-24 border-r border-gray-600"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    localStorage.setItem("MANUAL_GROQ_KEY", e.currentTarget.value);
                                    window.location.reload();
                                }
                            }}
                        />
                        <input
                            type="password"
                            placeholder="Google Search Key..."
                            className="bg-transparent text-white text-xs px-2 outline-none w-24 border-r border-gray-600"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    localStorage.setItem("MANUAL_GOOGLE_KEY", e.currentTarget.value);
                                    window.location.reload();
                                }
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Engine ID..."
                            className="bg-transparent text-white text-xs px-2 outline-none w-20"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    localStorage.setItem("MANUAL_SEARCH_ENGINE_ID", e.currentTarget.value);
                                    window.location.reload();
                                }
                            }}
                        />
                        <button
                            onClick={(e) => {
                                const container = e.currentTarget.parentElement;
                                const inputs = container?.querySelectorAll('input');
                                if (inputs) {
                                    if (inputs[0].value) localStorage.setItem("MANUAL_GROQ_KEY", inputs[0].value);
                                    if (inputs[1].value) localStorage.setItem("MANUAL_GOOGLE_KEY", inputs[1].value);
                                    if (inputs[2].value) localStorage.setItem("MANUAL_SEARCH_ENGINE_ID", inputs[2].value);
                                    window.location.reload();
                                }
                            }}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded"
                        >
                            SALVAR
                        </button>
                    </div>

                    <div className="flex bg-[#2d2f31] p-1 rounded-xl border border-[#3d3f41]">
                        {(['ANALISE', 'PESQUISA', 'CONHECIMENTO'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {tab === 'ANALISE' ? 'Análise Documental' : tab === 'PESQUISA' ? 'Chat Normativo' : 'Base de Conhecimento'}
                            </button>
                        ))}
                    </div>
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
                                    <h3 className="font-black text-xl flex items-center gap-2"><span className="material-symbols-outlined text-primary">upload_file</span> Análise de Documento</h3>
                                    <p className="text-sm text-gray-500">Faça upload de um requerimento ou consulta técnica (PDF) para análise automática pela IA.</p>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-gray-400 px-1">Arquivo do Requerimento (PDF)</label>
                                        <label className={`block w-full h-32 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer hover:bg-stone-50 transition-colors ${analysisFiles.length > 0 ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                                            <div className="flex flex-col items-center p-4 text-center">
                                                <span className="material-symbols-outlined text-gray-300 text-4xl mb-2">picture_as_pdf</span>
                                                <span className="text-sm font-bold text-gray-600">{analysisFiles.length > 0 ? analysisFiles[0].name : 'Clique para selecionar o PDF'}</span>
                                                <span className="text-[10px] text-gray-400 mt-1">Máximo 10MB</span>
                                            </div>
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                className="hidden"
                                                onChange={e => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        const file = e.target.files[0];
                                                        if (file.type !== 'application/pdf') {
                                                            alert("Apenas arquivos PDF são permitidos.");
                                                            return;
                                                        }
                                                        setAnalysisFiles([file]);
                                                        setAnalysisError('');
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>

                                    {analysisError && (
                                        <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 flex items-start gap-2">
                                            <span className="material-symbols-outlined text-sm">error</span>
                                            {analysisError}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-rustic-border select-none cursor-pointer hover:bg-stone-100 transition-all" onClick={() => setIncludeWebAnalysis(!includeWebAnalysis)}>
                                        <input
                                            type="checkbox"
                                            checked={includeWebAnalysis}
                                            onChange={() => { }}
                                            className="size-4 accent-primary"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-[#181111]">Buscar também no site do CBMSC</span>
                                            <span className="text-[10px] text-gray-400 font-bold">Consulta normas atualizadas na web se necessário</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmitAnalysis}
                                        disabled={loading || profile?.p_ssci !== 'editor' || analysisFiles.length === 0}
                                        className={`w-full py-4 ${loading || profile?.p_ssci !== 'editor' || analysisFiles.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary'} text-white font-black text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex flex-col items-center justify-center gap-1`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>{loading ? 'sync' : 'smart_toy'}</span>
                                            {loading ? 'ANALISANDO DOCUMENTO...' : 'ANALISAR DOCUMENTO'}
                                        </div>
                                        {loading && (
                                            <span className="text-[9px] font-bold opacity-80 uppercase tracking-widest animate-pulse">Lendo PDF e consultando normativas...</span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Result Area */}
                            <div className="xl:col-span-7">
                                {currentAnalysis ? (
                                    <div className="bg-white rounded-2xl border border-rustic-border shadow-md overflow-hidden flex flex-col h-full max-h-[700px]">
                                        <div className="bg-stone-50 border-b border-rustic-border p-6 flex justify-between items-center">
                                            <h3 className="font-black text-lg text-[#181111]">Parecer Técnico da IA</h3>
                                            <div className="flex gap-2">
                                                {profile?.p_ssci === 'editor' && (
                                                    <button onClick={() => handleDeleteAnalysis(currentAnalysis.id!)} className="p-2 bg-white border rounded-lg hover:bg-red-50 text-red-400"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                                                )}
                                                <button onClick={() => setCurrentAnalysis(null)} className="p-2 bg-primary text-white rounded-lg hover:brightness-110"><span className="material-symbols-outlined text-[20px]">close</span></button>
                                            </div>
                                        </div>
                                        <div className="p-8 overflow-y-auto bg-[#fafafa] flex flex-col gap-6">
                                            <div className="max-w-3xl mx-auto bg-white border border-stone-200 p-10 shadow-sm font-serif leading-relaxed whitespace-pre-wrap text-gray-800">
                                                {currentAnalysis.ai_response}
                                            </div>

                                            {currentAnalysis.web_source && currentAnalysis.web_source.length > 0 && (
                                                <div className="max-w-3xl mx-auto w-full bg-blue-50/30 border border-blue-100 p-6 rounded-xl">
                                                    <h4 className="text-xs font-black uppercase text-blue-600 mb-4 flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[16px]">language</span> Fontes Consultadas
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {currentAnalysis.web_source.map((fonte: any, idx: number) => (
                                                            <a key={idx} href={fonte.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-white border border-blue-100 rounded-lg hover:shadow-md transition-all">
                                                                <p className="text-sm font-bold text-blue-800">{fonte.title}</p>
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
                                        <h4 className="font-black text-gray-400 text-xl tracking-wide">ÁREA DE PARECER TÉCNICO</h4>
                                        <p className="text-gray-300 max-w-sm mt-2 font-bold">Faça upload de um PDF para visualizar a análise estruturada aqui.</p>
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
                                            <p className="font-bold text-sm truncate">{sess.session_title}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-gray-400 font-bold">{sess.start_date ? new Date(sess.start_date).toLocaleDateString('pt-BR') : 'N/A'}</span>
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
                                        {currentSession ? currentSession.session_title : 'Selecione ou inicie uma conversa'}
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
                                                    <p className="text-sm font-medium">{msg.user_message}</p>
                                                    <span className="text-[9px] font-black opacity-50 block mt-1 text-right">VOCÊ • {msg.query_timestamp ? new Date(msg.query_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                </div>
                                            </div>
                                            {/* IA Message */}
                                            <div className="flex justify-start">
                                                <div className="bg-gray-100 text-[#181111] p-4 rounded-2xl rounded-tl-none max-w-[80%] border border-gray-200 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.ai_response}</p>
                                                    <div className="flex justify-between items-center mt-2 border-t border-gray-200 pt-2">
                                                        <span className="text-[9px] font-black text-gray-400">ASSISTENTE SSCI • {msg.response_timestamp ? new Date(msg.response_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                        {msg.referenced_normatives && msg.referenced_normatives.length > 0 && (
                                                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1" title="Fontes Web Consultadas">
                                                                <span className="material-symbols-outlined text-[10px]">public</span> {msg.referenced_normatives.length}
                                                            </span>
                                                        )}
                                                    </div>
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

                                    {!currentAnalysis && analyses.length > 0 && (
                                        <div className="bg-white rounded-2xl border border-rustic-border shadow-sm p-6">
                                            <h3 className="font-black text-sm mb-4 uppercase text-gray-400">Análises Recentes</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {analyses.map(an => (
                                                    <div key={an.id} onClick={() => setCurrentAnalysis(an)} className="p-4 border rounded-xl hover:bg-stone-50 cursor-pointer transition-all">
                                                        <p className="font-bold text-sm">{an.protocol_number}</p>
                                                        <p className="text-[10px] text-gray-500 line-clamp-2">{an.request_description}</p>
                                                    </div>
                                                ))}
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
                                                <span className="text-[9px] font-black bg-stone-100 px-2 py-1 rounded uppercase tracking-tighter">{doc.document_type}</span>
                                                <button onClick={async () => {
                                                    if (confirm("Excluir normativa?")) {
                                                        const fileName = doc.file_url.split('/').pop()!;
                                                        await SupabaseService.deleteSSCINormativeDocument(doc.id!, fileName);
                                                        loadData();
                                                    }
                                                }} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600" disabled={profile?.p_ssci !== 'editor'}>
                                                    {profile?.p_ssci === 'editor' && <span className="material-symbols-outlined text-[18px]">delete</span>}
                                                </button>
                                            </div>
                                            <h4 className="font-bold text-[#181111] text-base leading-tight mb-1 line-clamp-2">{doc.document_name}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-4">{doc.code_number} • {doc.issuing_body}</p>

                                            <div className="mt-auto flex items-center justify-between border-t border-stone-50 pt-4">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                    {doc.times_referenced || 0}
                                                </div>
                                                <div className="flex gap-2">
                                                    <a href={doc.file_url} target="_blank" className="p-2 rounded-lg bg-stone-50 text-primary hover:bg-stone-100 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                    </a>
                                                    <a href={doc.file_url} download className="p-2 rounded-lg bg-stone-50 text-gray-400 hover:text-gray-600 hover:bg-stone-100 transition-colors">
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
                                                <input value={documentName} onChange={e => setDocumentName(e.target.value)} type="text" className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm" placeholder="Ex: Sistemas de Hidrantes" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Tipo</label>
                                                    <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm">
                                                        <option>Instrução Normativa</option><option>Portaria</option><option>Lei</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Código</label>
                                                    <input value={documentCode} onChange={e => setDocumentCode(e.target.value)} type="text" className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm" placeholder="Ex: IN 001/2023" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Órgão Emissor</label>
                                                    <input value={documentIssuer} onChange={e => setDocumentIssuer(e.target.value)} type="text" className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm" placeholder="Ex: CBMSC" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Categoria</label>
                                                    <select value={documentCategory} onChange={e => setDocumentCategory(e.target.value)} className="w-full h-11 border rounded-xl px-4 bg-stone-50 text-sm">
                                                        <option>Técnico</option><option>Operacional</option><option>Administrativo</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-stone-50 transition-all ${documentFile ? 'border-secondary-green bg-green-50/10' : 'border-gray-200'}`}>
                                                <span className="text-xs font-bold text-gray-400">{documentFile ? documentFile.name : 'Selecionar Arquivo PDF'}</span>
                                                <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setDocumentFile(e.target.files[0])} />
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
