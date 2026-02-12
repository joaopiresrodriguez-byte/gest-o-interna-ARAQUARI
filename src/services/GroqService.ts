
import Groq from "groq-sdk";
import { SearchService } from "./SearchService";

const env = (import.meta as any).env || {};

export interface AnalysisInput {
    tipo: string;
    protocolo: string;
    descricao: string;
    incluir_web?: boolean;
    arquivos?: { mimeType: string, data: string }[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

const getApiKey = () => {
    const localKey = localStorage.getItem("MANUAL_GROQ_KEY");
    return localKey || env.VITE_GROQ_API_KEY || "";
}

const groq = new Groq({
    apiKey: getApiKey(),
    dangerouslyAllowBrowser: true // Required for client-side usage
});

export const GroqService = {
    analisarRequerimentoComGroq: async (dados: AnalysisInput, documentosLocais: any[]) => {
        try {
            console.log(`[GroqService] Iniciando análise para protocolo: ${dados.protocolo}`);

            let contextoWeb = "";
            let webResults: any[] = [];

            if (dados.incluir_web) {
                try {
                    const busca = await SearchService.searchCBMSCWebsite(dados.descricao);
                    if (busca && busca.length > 0) {
                        console.log(`[GroqService] ${busca.length} resultados encontrados na web.`);
                        contextoWeb = busca.map(r => `FONTE: ${r.title}\nLINK: ${r.url}\nCONTEÚDO: ${r.snippet}`).join("\n\n");
                        webResults = busca;
                    } else {
                        console.log('[GroqService] Nenhum resultado relevante encontrado na web.');
                    }
                } catch (searchError) {
                    console.warn('[GroqService] Busca no site do CBMSC falhou (não bloqueante):', searchError);
                }
            }

            const promptSistema = `
            Você é um Auditor Técnico do SSCI (Serviço de Segurança Contra Incêndio) do CBMSC.
            Sua missão é realizar uma análise técnica PROFUNDA e EXAUSTIVA da solicitação.

            DIRETRIZES DE ANÁLISE:
            1. EXTRAÇÃO DE DADOS: Extraia todos os nomes, datas, endereços, valores técnicos e fatos relevantes.
            2. FUNDAMENTAÇÃO LEGAL: Baseie-se ESTRITAMENTE nas Instruções Normativas (INs) e leis de SCI do CBMSC.
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
            Tipo: ${dados.tipo.toUpperCase()}
            Protocolo: ${dados.protocolo}
            Descrição: ${dados.descricao}
            `;

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "Você é um especialista em análise jurídica e normativas do Corpo de Bombeiros Militar de Santa Catarina."
                    },
                    {
                        role: "user",
                        content: promptSistema
                    }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.7,
                max_tokens: 2048
            });

            return {
                ai_response: completion.choices[0].message.content || "Sem resposta da IA.",
                used_documents: documentosLocais.map(d => d.id),
                web_source: webResults,
                cbmsc_links: webResults.map(r => r.url),
                ai_model: 'llama-3.3-70b-versatile'
            };

        } catch (error: any) {
            console.error("Erro no Groq:", error);
            throw new Error(`Erro na análise com Groq: ${error.message}`);
        }
    },

    chatNormativoGroq: async (mensagemUsuario: string, historicoConversa: ChatMessage[], documentosRelevantes: any[], incluirWeb: boolean) => {
        try {
            console.log('[GroqService] Iniciando chat normativo');

            // 1. Buscar no CBMSC (opcional dependendo de incluirWeb)
            let informacoesWeb = null;
            if (incluirWeb) {
                try {
                    informacoesWeb = await SearchService.searchCBMSCWebsite(mensagemUsuario);
                    if (informacoesWeb && informacoesWeb.length > 0) {
                        console.log(`[GroqService Chat] ${informacoesWeb.length} resultados encontrados na web.`);
                    } else {
                        console.log('[GroqService Chat] Nenhum resultado web encontrado.');
                    }
                } catch (e) {
                    console.warn('[GroqService] Busca web no chat falhou (não bloqueante):', e);
                }
            }

            // 2. Preparar contexto
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

            const systemMessage = {
                role: "system" as const, // Type assertion for role
                content: `
                Você é um assistente especializado em normativas do Corpo de Bombeiros Militar de Santa Catarina (CBMSC).

                INSTRUÇÕES CRITICAS:
                1. O usuário FORNECEU contexto externo no campo "FONTES WEB (CBMSC)".
                2. Você DEVE usar essas informações como se fosse seu próprio conhecimento.
                3. NUNCA diga "não posso pesquisar na internet" ou "meu conhecimento é limitado", pois a pesquisa JÁ FOI FEITA e os resultados estão abaixo.
                4. Se a informação estiver em "FONTES WEB", cite a fonte e use a tag [WEB].
                5. Se a informação NÃO estiver nem nos documentos locais nem na web, diga apenas: "Não encontrei informações sobre isso nas normativas ou no site do CBMSC consultados."

                REGRAS DE RESPOSTA:
                - Seja direto e técnico.
                - Priorize Documentos Locais.
                - Use Fontes Web para complementar.
            `};

            const userMessage = { role: "user" as const, content: `PERGUNTA DO USUÁRIO: ${mensagemUsuario}\n\nCONTEXTO:\n${contexto}` };

            // Converter histórico (Groq usa 'user', 'assistant', 'system')
            const messages = [
                systemMessage,
                ...historicoConversa.map(msg => ({
                    role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
                    content: msg.content
                })),
                userMessage
            ];

            const completion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.7,
                max_tokens: 2048
            });

            return {
                ai_response: completion.choices[0].message.content || "Sem resposta.",
                referenced_documents: documentosRelevantes.map(d => d.id),
                referenced_normatives: informacoesWeb?.map(info => info.url) || []
            };

        } catch (error: any) {
            console.error("Erro no Chat Groq:", error);
            throw new Error(`Erro no Chat Groq: ${error.message}`);
        }
    },

    extrairNormativas: (texto: string): string[] => {
        const regex = /(IN|Instrução Normativa|Lei|Decreto|Portaria)\s+(Nº\s+)?([0-9\.\/\-]+)/gi;
        const matches = texto.match(regex);
        return matches ? Array.from(new Set(matches.map(m => m.trim()))) : [];
    }
};
