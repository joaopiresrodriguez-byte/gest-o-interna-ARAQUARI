import { GoogleGenerativeAI } from "@google/generative-ai";
import { SearchService } from "./SearchService";

// Ultimate Key Detection
const env = (import.meta as any).env || {};
const globalEnv = (window as any).process?.env || {};
const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || globalEnv.GEMINI_API_KEY || globalEnv.API_KEY;

let modelName = "gemini-1.5-flash";

console.log("%c💖 [IA] VERSÃO RESILIENTE 1.0.7", "color: #fff; background: #ec4899; font-size: 14px; font-weight: bold; padding: 10px; border-radius: 5px;");
console.log(`[IA] Chave ok: ${!!apiKey}`);
console.log(`[IA] Tentando modelo: ${modelName}`);

const genAI = new GoogleGenerativeAI(apiKey || "");

// Função auxiliar para obter o modelo com fallback
const getModel = (name: string) => {
    return genAI.getGenerativeModel({
        model: name,
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
        }
    });
};

let currentModel = getModel(modelName);

export interface AnalysisInput {
    tipo_solicitacao: string;
    numero_protocolo: string;
    descricao_solicitacao: string;
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
            console.log(`[GeminiService] Iniciando análise profunda para protocolo: ${dados.numero_protocolo}`);

            let contextoWeb = "";
            let linksCbmsc: string[] = [];

            if (dados.incluir_web) {
                try {
                    const busca = await SearchService.buscarSiteCBMSC(dados.descricao_solicitacao);
                    if (busca) {
                        contextoWeb = busca.map(r => `FONTE: ${r.titulo}\nLINK: ${r.link}\nCONTEÚDO: ${r.snippet}`).join("\n\n");
                        linksCbmsc = busca.map(r => r.link);
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
                    ? JSON.stringify(documentosLocais.map(d => ({ nome: d.nome_documento, tipo: d.tipo_documento, codigo: d.numero_codigo, resumo: d.resumo_ementa })))
                    : '[]'}

CONTEXTO WEB (Pesquisa em cbm.sc.gov.br):
${contextoWeb || "Nenhum resultado de pesquisa na web."}

DADOS DA SOLICITAÇÃO:
Tipo: ${dados.tipo_solicitacao.toUpperCase()}
Protocolo: ${dados.numero_protocolo}
Descrição: ${dados.descricao_solicitacao}
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
                const result = await currentModel.generateContent(parts);
                const response = await result.response;
                const resposta = response.text();

                return {
                    resposta: resposta,
                    documentos_utilizados: documentosLocais.map(d => d.id),
                    fonte_web: contextoWeb ? "WEB" : "LOCAL",
                    links_cbmsc: linksCbmsc
                };
            } catch (innerError: any) {
                if (innerError.message?.includes("404") || innerError.message?.includes("not found")) {
                    console.warn("[GeminiService] Modelo Flash falhou, tentando Fallback para Pro...");
                    const fallbackModel = getModel("gemini-pro");
                    const result = await fallbackModel.generateContent(parts);
                    const response = await result.response;
                    return {
                        resposta: response.text(),
                        documentos_utilizados: documentosLocais.map(d => d.id),
                        fonte_web: contextoWeb ? "WEB" : "LOCAL",
                        links_cbmsc: linksCbmsc
                    };
                }
                throw innerError;
            }
        } catch (error: any) {
            console.error(`Erro detalhado no GeminiService (${modelName}):`, error);
            throw new Error(`Falha na análise profunda (${modelName}): ${error.message || "Erro desconhecido"}`);
        }
    },

    chatNormativoGemini: async (mensagemUsuario: string, historicoConversa: ChatMessage[], documentosRelevantes: any[], incluirWeb: boolean) => {
        try {
            console.log('[GeminiService] Iniciando chat normativo');

            // 1. Chave de API Check
            if (!(import.meta as any).env.VITE_GEMINI_API_KEY) {
                throw new Error("A chave de API do Gemini não está configurada.");
            }

            // 2. Buscar no CBMSC (opcional dependendo de incluirWeb)
            let informacoesWeb = null;
            if (incluirWeb) {
                try {
                    informacoesWeb = await SearchService.buscarSiteCBMSC(mensagemUsuario);
                } catch (e) {
                    console.warn('[GeminiService] Busca web no chat falhou:', e);
                }
            }

            // 3. Preparar contexto
            const contexto = `
        DOCUMENTOS LOCAIS DISPONÍVEIS:
        ${documentosRelevantes.length > 0
                    ? JSON.stringify(documentosRelevantes.map(doc => ({ nome: doc.nome_documento, tipo: doc.tipo_documento, codigo: doc.numero_codigo, resumo: doc.resumo_ementa })))
                    : '[]'}

        FONTES WEB (CBMSC):
        ${informacoesWeb ? JSON.stringify(informacoesWeb) : '[]'}
      `;

            // 4. Criar chat com histórico
            const chatOptions = {
                history: historicoConversa.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                })),
                generationConfig: {
                    maxOutputTokens: 2000,
                    temperature: 0.7,
                },
            };

            let chat = currentModel.startChat(chatOptions);

            // 5. Prompt do sistema
            const promptSistema = `
Você é um assistente especializado em normativas do Corpo de Bombeiros Militar de Santa Catarina (CBMSC).

INSTRUÇÕES:
- Responda baseado nos DOCUMENTOS LOCAIS e nas FONTES WEB (CBMSC) fornecidas.
- Cite sempre as fontes de forma clara.
- Se utilizar qualquer informação vinda das FONTES WEB, você deve obrigatoriamente indicar com a etiqueta "[WEB]" ao final da frase ou parágrafo.
- Se a informação não estiver disponível em nenhuma das fontes, decline educadamente e recomende consulta ao SSCI.
- Seja objetivo, claro e mantenha o tom profissional.
`;

            // 6. Enviar mensagem
            const result = await chat.sendMessage(`${promptSistema}\n\nPERGUNTA DO USUÁRIO: ${mensagemUsuario}\n\nCONTEXTO:\n${contexto}`);
            const response = await result.response;
            const resposta = response.text();

            return {
                resposta: resposta,
                documentos_referenciados: documentosRelevantes.map(d => d.id),
                links_externos: informacoesWeb?.map(info => info.link) || []
            };
        } catch (error: any) {
            console.error('Erro no Chat Gemini:', error);
            throw new Error(`Erro no Assistente: ${error.message || "Erro desconhecido"}`);
        }
    },

    extrairNormativas: (texto: string): string[] => {
        const regex = /(IN|Instrução Normativa|Lei|Decreto|Portaria)\s+(Nº\s+)?([0-9\.\/\-]+)/gi;
        const matches = texto.match(regex);
        return matches ? Array.from(new Set(matches.map(m => m.trim()))) : [];
    }
};
