import * as pdfjsLib from 'pdfjs-dist';

// Configure worker Using Vite's ?url import to ensure correct production build
// This requires `pdf.worker.min.mjs` to be available in node_modules
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extrairTextoPDF(arquivo: File): Promise<string> {
    try {
        const arrayBuffer = await arquivo.arrayBuffer();

        // Use standard font for rendering if needed (optional)
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`, // Optional: external CMaps if needed for special chars, keep external or verify local availability
            cMapPacked: true,
        });

        const pdf = await loadingTask.promise;

        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }

        return fullText;
    } catch (erro: any) {
        console.error('Erro ao extrair texto do PDF:', erro);
        throw new Error(`Não foi possível extrair o texto do documento PDF. Detalhes: ${erro.message || JSON.stringify(erro)}`);
    }
}

export async function validarPDF(arquivo: File): Promise<boolean> {
    // Validar se é realmente um PDF
    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('O arquivo deve ser um PDF.');
    }

    // Validar tamanho (máximo 10MB)
    if (arquivo.size > 10 * 1024 * 1024) {
        throw new Error('O arquivo PDF não pode exceder 10MB.');
    }

    return true;
}
