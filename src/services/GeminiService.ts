import { GoogleGenerativeAI } from "@google/generative-ai";
import { SearchService } from "./SearchService";

const env = (import.meta as any).env || {};
// Tenta pegar do localStorage primeiro, depois das env vars
const getApiKey = () => {
    const localKey = localStorage.getItem("MANUAL_API_KEY");
    return localKey || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || "";
}
const apiKey = getApiKey();

// Lista de modelos para tentar (em ordem de preferência)
const AVAILABLE_MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
];

let workingModelName: string | null = null;

// --- HYBRID AI SERVICE (Gemini + OpenAI) ---
// Versão 1.7.0 - Production
// Suporta chave Google (começa com nada ou outra coisa) e OpenAI (começa com sk-)

// --- OPENAI IMPLEMENTATION ---
const generateWithOpenAI = async (messages: any[], model: string, apiKey: string) => {
    try {
        // console.log(`[AIService] Usando OpenAI (${model})...`);

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`OpenAI Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            text: data.choices[0].message.content,
            model: model
        };
    } catch (error: any) {
        console.error("[AIService] Erro OpenAI:", error);
        throw error;
    }
};

// --- GEMINI IMPLEMENTATION ---
// Função para tentar gerar conteúdo com fallback exaustivo
const generateWithFallback = async (parts: any[]) => {
    // 1. DETECÇÃO DE PROVEDOR DE IA
    if (apiKey?.startsWith("sk-")) {
        // É uma chave OpenAI
        const openAIModel = "gpt-4o-mini"; // ou gpt-3.5-turbo
        // console.log(`[AIService] Chave OpenAI detectada. Usando ${openAIModel}`);

        // Converter formato Gemini para OpenAI
        // O Gemini usa [{text: "..."}], OpenAI usa [{role: "user", content: "..."}]
        const messages = parts.map(p => ({
            role: "user",
            content: p.text || JSON.stringify(p)
        }));

        // Se tiver arquivos (imagens), o formato é mais complexo, mas para texto simples:
        return await generateWithOpenAI(messages, openAIModel, apiKey);
    }

    // 2. DETECÇÃO GOOGLE GEMINI (Fluxo Original)
    const genAI = new GoogleGenerativeAI(apiKey || "");
    // Tentar o último modelo que funcionou (se houver)
    const modelsToTry = workingModelName
        ? [workingModelName, ...AVAILABLE_MODELS.filter(m => m !== workingModelName)]
        : AVAILABLE_MODELS;

    let firstError: any = null;
    let lastError: any = null;

    for (let i = 0; i < modelsToTry.length; i++) {
        const name = modelsToTry[i];
        try {
            // console.log(`[GeminiService] Tentando modelo: ${name}...`);
            const model = genAI.getGenerativeModel({ model: name });
            const result = await model.generateContent(parts);
            const response = await result.response;
            const text = response.text();

            if (text) {
                workingModelName = name; // Salva o modelo que funcionou
                // console.log(`[GeminiService] Sucesso com o modelo: ${name}`);
                return { text, model: name };
            }
        } catch (error: any) {
            console.warn(`[GeminiService] Modelo ${name} falhou:`, error.message);
            if (i === 0) firstError = error;
            lastError = error;
        }
    }

    const errorToShow = firstError || lastError;
    console.error("Todos os modelos falharam. Erro principal:", errorToShow);
    throw new Error(`Falha na IA. Verifique sua Chave de API ou limites. Detalhes: ${errorToShow?.message || "Erro desconhecido"}`);
};

export interface AnalysisInput {
    request_type: string;
    protocol_number: string;
    request_description: string;
    incluir_web?: boolean;
    arquivos?: { mimeType: string, data: string }[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export const GeminiService = {
    analisarRequerimentoComGemini: async (dados: AnalysisInput, documentosLocais: any[]) => {
        try {
            console.log(`[GeminiService] Iniciando análise profunda para protocolo: ${dados.protocol_number}`);

            let contextoWeb = "";
            let webResults: any[] = [];

            if (dados.incluir_web) {
                try {
                    const busca = await SearchService.searchCBMSCWebsite(dados.request_description);
                    if (busca) {
                        contextoWeb = busca.map(r => `FONTE: ${r.title}\nLINK: ${r.url}\nCONTEÚDO: ${r.snippet}`).join("\n\n");
                        webResults = busca;
                    }
                } catch (searchError) {
                    console.warn('[GeminiService] Busca no site do CBMSC falhou:', searchError);
                }
            }

            const promptSistema = `
Você é um Auditor Técnico do SSCI (Serviço de Segurança Contra Incêndio) do CBMSC.
Sua missão é realizar uma análise técnica PROFUNDA e EXAUSTIVA da solicitação e de todos os documentos anexados.

DIRETRIZES DE ANÁLISE:
1. EXTRAÇÃO DE DADOS: Extraia todos os nomes, datas, endereços, valores técnicos e fatos relevantes citados nos documentos e na descrição. Compare o que o usuário escreveu com o que está de fato nos documentos (Verdade Material).
2. FUNDAMENTAÇÃO LEGAL: Baseie-se ESTRITAMENTE nas Instruções Normativas (INs) e leis de SCI do CBMSC (disponíveis em https://www.cbm.sc.gov.br/index.php/sci/instrucoes-normativas).
3. ESTRUTURA DA RESPOSTA: A resposta deve ser uma manifestação técnica estruturada em artigos, incisos e parágrafos (Art./Inc./§).
4. REFERÊNCIAS: Finalize com uma seção clara de "REFERÊNCIAS NORMATIVAS".

CONTEXTO LOCAL (Documentos do Banco de Conhecimento):
${documentosLocais.length > 0
                    ? JSON.stringify(documentosLocais.map(d => ({
                        document_name: d.document_name,
                        document_type: d.document_type,
                        code_number: d.code_number,
                        summary: d.summary
                    })))
                    : '[]'}

CONTEXTO WEB (Pesquisa em cbm.sc.gov.br):
${contextoWeb || "Nenhum resultado de pesquisa na web."}

DADOS DA SOLICITAÇÃO:
Tipo: ${dados.request_type.toUpperCase()}
Protocolo: ${dados.protocol_number}
Descrição: ${dados.request_description}
`;

            const parts: any[] = [{ text: promptSistema }];

            if (dados.arquivos && dados.arquivos.length > 0) {
                dados.arquivos.forEach(file => {
                    parts.push({
                        inlineData: {
                            mimeType: file.mimeType,
                            data: file.data
                        }
                    });
                });
            }

            try {
                const { text, model } = await generateWithFallback(parts);

                return {
                    ai_response: text,
                    used_documents: documentosLocais.map(d => d.id),
                    web_source: webResults,
                    cbmsc_links: webResults.map(r => r.url),
                    ai_model: model
                };
            } catch (error: any) {
                console.error("[GeminiService] Erro em todos os modelos:", error);
                throw error;
            }
        } catch (error: any) {
            console.error(`Erro detalhado no GeminiService:`, error);
            throw new Error(`Falha na análise profunda: ${error.message || "Erro desconhecido"}`);
        }
    },

    chatNormativoGemini: async (mensagemUsuario: string, historicoConversa: ChatMessage[], documentosRelevantes: any[], incluirWeb: boolean) => {
        try {
            console.log('[GeminiService] Iniciando chat normativo');

            // 1. Chave de API Check
            if (!apiKey) {
                throw new Error("A chave de API do Gemini não foi encontrada no ambiente (VITE_GEMINI_API_KEY).");
            }

            // 2. Buscar no CBMSC (opcional dependendo de incluirWeb)
            let informacoesWeb = null;
            if (incluirWeb) {
                try {
                    informacoesWeb = await SearchService.searchCBMSCWebsite(mensagemUsuario);
                } catch (e) {
                    console.warn('[GeminiService] Busca web no chat falhou:', e);
                }
            }

            // 3. Preparar contexto
            const contexto = `
        DOCUMENTOS LOCAIS DISPONÍVEIS:
        ${documentosRelevantes.length > 0
                    ? JSON.stringify(documentosRelevantes.map(doc => ({
                        document_name: doc.document_name,
                        document_type: doc.document_type,
                        code_number: doc.code_number,
                        summary: doc.summary
                    })))
                    : '[]'}

        FONTES WEB (CBMSC):
        ${informacoesWeb ? JSON.stringify(informacoesWeb) : '[]'}
      `;

            // 4. Iniciar Chat com Fallback (Hybrid)
            if (apiKey?.startsWith("sk-")) {
                // --- MODO OPENAI ---
                const openAIModel = "gpt-4o-mini";
                const systemMessage = {
                    role: "system", content: `
Você é um assistente especializado em normativas do Corpo de Bombeiros Militar de Santa Catarina (CBMSC).

INSTRUÇÕES:
- Responda baseado nos DOCUMENTOS LOCAIS e nas FONTES WEB (CBMSC) fornecidas.
- Cite sempre as fontes de forma clara.
- Se utilizar qualquer informação vinda das FONTES WEB, você deve obrigatoriamente indicar com a etiqueta "[WEB]" ao final da frase ou parágrafo.
- Se a informação não estiver disponível em nenhuma das fontes, decline educadamente e recomende consulta ao SSCI.
- Seja objetivo, clara e mantenha o tom profissional.
`};
                const userMessage = { role: "user", content: `PERGUNTA DO USUÁRIO: ${mensagemUsuario}\n\nCONTEXTO:\n${contexto}` };

                // Converter histórico
                const messages = [
                    systemMessage,
                    ...historicoConversa.map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content })),
                    userMessage
                ];

                const { text } = await generateWithOpenAI(messages, openAIModel, apiKey);

                return {
                    ai_response: text,
                    referenced_documents: documentosRelevantes.map(d => d.id),
                    referenced_normatives: informacoesWeb?.map(info => info.url) || []
                };

            } else {
                // --- MODO GEMINI (LEGADO) ---
                const genAI = new GoogleGenerativeAI(apiKey || "");

                if (!workingModelName) {
                    await generateWithFallback([{ text: "oi" }]);
                }

                const model = genAI.getGenerativeModel({ model: workingModelName || AVAILABLE_MODELS[0] });
                const chat = model.startChat({
                    history: historicoConversa.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    })),
                    generationConfig: {
                        maxOutputTokens: 2000,
                        temperature: 0.7,
                    },
                });

                // 5. Prompt do sistema
                const promptSistema = `
    Você é um assistente especializado em normativas do Corpo de Bombeiros Militar de Santa Catarina (CBMSC).
    
    INSTRUÇÕES:
    - Responda baseado nos DOCUMENTOS LOCAIS e nas FONTES WEB (CBMSC) fornecidas.
    - Cite sempre as fontes de forma clara.
    - Se utilizar qualquer informação vinda das FONTES WEB, você deve obrigatoriamente indicar com a etiqueta "[WEB]" ao final da frase ou parágrafo.
    - Se a informação não estiver disponível em nenhuma das fontes, decline educadamente e recomende consulta ao SSCI.
    - Seja objetivo, claro e mantenha o tone profissional.
    `;

                // 6. Enviar mensagem
                const result = await chat.sendMessage(`${promptSistema}\n\nPERGUNTA DO USUÁRIO: ${mensagemUsuario}\n\nCONTEXTO:\n${contexto}`);
                const response = await result.response;
                const resposta = response.text();

                return {
                    ai_response: resposta,
                    referenced_documents: documentosRelevantes.map(d => d.id),
                    referenced_normatives: informacoesWeb?.map(info => info.url) || []
                };
            }
        } catch (error: any) {
            console.error('Erro no Chat Gemini:', error);
            throw new Error(`Erro no Assistente: ${error.message || "Erro desconhecido"}`);
        }
    },

    extrairNormativas: (texto: string): string[] => {
        const regex = /(IN|Instrução Normativa|Lei|Decreto|Portaria)\s+(Nº\s+)?([0-9\.\/\-]+)/gi;
        const matches = texto.match(regex);
        return matches ? Array.from(new Set(matches.map(m => m.trim()))) : [];
    },

    setManualKey: (key: string) => {
        localStorage.setItem("MANUAL_API_KEY", key);
        window.location.reload(); // Recarrega para aplicar a nova chave
    },

    getMaskedKey: () => {
        const key = getApiKey();
        if (!key) return "NENHUMA";
        return key.substring(0, 5) + "..." + key.substring(key.length - 3);
    }
};
