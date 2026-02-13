import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker usando CDN para evitar problemas de build com Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function extrairTextoDoPDF(arquivo: File): Promise<string> {
    try {
        const arrayBuffer = await arquivo.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let textoCompleto = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const textoPagina = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            textoCompleto += textoPagina + '\n\n';
        }

        return textoCompleto;
    } catch (erro) {
        console.error('Erro ao extrair texto do PDF:', erro);
        throw new Error('Falha ao processar o arquivo PDF');
    }
}
