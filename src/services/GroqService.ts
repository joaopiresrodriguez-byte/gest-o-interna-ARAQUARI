
import Groq from "groq-sdk";
import { SearchService } from "./SearchService";
import { extrairTextoPDF, validarPDF } from "./pdfExtractor";

const env = (import.meta as any).env || {};

export interface AnalysisInput {
    arquivoPDF: File;
    incluir_web?: boolean;
    // Legacy fields kept optional to avoid breaking other calls if any
    tipo?: string;
    protocolo?: string;
    descricao?: string;
    arquivos?: any[];
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
    dangerouslyAllowBrowser: true
});

export const GroqService = {
    analisarRequerimentoComGroq: async (dados: AnalysisInput, documentosLocais: any[]) => {
        try {
            // 1. VALIDAR ARQUIVO
            console.log('[GroqService] Validando arquivo PDF...');
            await validarPDF(dados.arquivoPDF);

            // 2. EXTRAIR TEXTO DO PDF
            console.log('[GroqService] Extraindo texto do PDF...');
            const textoExtraido = await extrairTextoPDF(dados.arquivoPDF);

            if (!textoExtraido || textoExtraido.trim().length === 0) {
                throw new Error('O PDF está vazio ou não contém texto extraível.');
            }
            console.log('[GroqService] Texto extraído com sucesso. Tamanho:', textoExtraido.length);

            // 3. BUSCA WEB (OPCIONAL/FALLBACK)
            let contextoWeb = "";
            let webResults: any[] = [];

            if (dados.incluir_web) {
                try {
                    // Extract keywords from PDF text (first 200 chars as robust guess)
                    const searchHub = textoExtraido.substring(0, 200).replace(/\n/g, " ");
                    const busca = await SearchService.searchCBMSCWebsite(searchHub);

                    if (busca && busca.length > 0) {
                        console.log(`[GroqService] ${busca.length} resultados encontrados na web.`);
                        contextoWeb = busca.map(r => `FONTE: ${r.title}\nLINK: ${r.url}\nCONTEÚDO: ${r.snippet}`).join("\n\n");
                        webResults = busca;
                    } else {
                        console.log('[GroqService] Nenhum resultado relevante encontrado na web (ou chaves não configuradas).');
                        contextoWeb = "Busca web realizada, mas nenhum resultado encontrado.";
                    }

                } catch (searchError) {
                    console.warn('[GroqService] Busca no site do CBMSC falhou (não bloqueante):', searchError);
                }
            }


            // 4. PREPARAR PROMPT PARA A IA
            const promptSistema = `Você é um Analista Técnico-Jurídico do Corpo de Bombeiros Militar de Santa Catarina (CBMSC).

Sua função é analisar requerimentos, consultas técnicas e solicitações à luz das normativas do CBMSC, especialmente a IN nº 001/CBMSC.

IMPORTANTE: Você receberá o texto completo de um documento PDF. Analise EXCLUSIVAMENTE o conteúdo deste documento.

FORMATO OBRIGATÓRIO DA RESPOSTA:

I. RELATO DA SOLICITAÇÃO
[Resumo objetivo do que está sendo solicitado no documento, citando partes específicas do texto]

II. FUNDAMENTAÇÃO NORMATIVA
[Explicação técnico-jurídica com citação de:
- Artigos (Art. X)
- Incisos (I, II, III)
- Parágrafos (§1º, §2º)
- Alíneas (a, b, c)
Das normativas do CBMSC aplicáveis ao caso]

III. ANÁLISE DA SOLICITAÇÃO ESPECÍFICA
[O que as normativas dizem especificamente sobre o pedido do solicitante. Cite artigos e incisos relevantes]

IV. PARECER TÉCNICO
Decisão: [DEFERIDO / INDEFERIDO / DEFERIDO COM RESSALVAS]

Fundamentação do Parecer:
[Explicação detalhada da decisão, baseada nas normativas citadas]

V. RESPONSABILIDADES DO RESPONSÁVEL TÉCNICO
[Liste as responsabilidades jurídicas e normativas do responsável técnico, citando:
- Artigos específicos
- Incisos
- Parágrafos
Das normativas do CBMSC]

REFERÊNCIAS NORMATIVAS:
[Liste todas as normativas citadas no formato: IN nº XXX/CBMSC, Portaria nº XXX, etc.]

CONTEXTO LOCAL (Documentos do Banco de Conhecimento):
${documentosLocais.length > 0
                    ? JSON.stringify(documentosLocais.map(d => ({
                        document_name: d.document_name,
                        code_number: d.code_number,
                        summary: d.summary
                    })))
                    : '[]'}

CONTEXTO WEB:
${contextoWeb}
`;

            const promptUsuario = `Analise o seguinte documento e forneça um parecer técnico-jurídico completo:

===== INÍCIO DO DOCUMENTO =====
${textoExtraido}
===== FIM DO DOCUMENTO =====

Forneça a análise no formato especificado, citando artigos, incisos e parágrafos das normativas aplicáveis.`;

            // 5. ENVIAR PARA A IA
            console.log('[GroqService] Enviando para análise da IA...');
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: promptSistema
                    },
                    {
                        role: "user",
                        content: promptUsuario
                    }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 4096
            });

            const respostaIA = completion.choices[0].message.content || "Sem resposta da IA.";

            return {
                ai_response: respostaIA,
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

            // 1. Buscar no CBMSC (Fallback safe)
            let informacoesWeb = null;
            if (incluirWeb) {
                try {
                    informacoesWeb = await SearchService.searchCBMSCWebsite(mensagemUsuario);
                    if (informacoesWeb && informacoesWeb.length > 0) {
                        console.log(`[GroqService Chat] ${informacoesWeb.length} resultados encontrados na web.`);
                    } else {
                        console.log('[GroqService Chat] Nenhum resultado web encontrado (ou chaves ausentes).');
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
                role: "system" as const,
                content: `
                Você é um assistente especializado em normativas do Corpo de Bombeiros Militar de Santa Catarina (CBMSC).

                INSTRUÇÕES CRITICAS:
                1. O usuário FORNECEU contexto externo no campo "FONTES WEB (CBMSC)" e "DOCUMENTOS LOCAIS".
                2. Use essas informações como base principal.
                3. Se a informação estiver em "FONTES WEB", cite a fonte.
                4. Se a informação NÃO estiver nos contextos, diga: "Não encontrei informações sobre isso nas normativas consultadas."

                REGRAS DE RESPOSTA:
                - Seja direto e técnico.
            `};

            const userMessage = { role: "user" as const, content: `PERGUNTA DO USUÁRIO: ${mensagemUsuario}\n\nCONTEXTO:\n${contexto}` };

            // Converter histórico
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
                temperature: 0.5,
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
