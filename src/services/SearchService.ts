export interface SearchResult {
    titulo: string;
    snippet: string;
    link: string;
}

export const SearchService = {
    buscarSiteCBMSC: async (termosBusca: string): Promise<SearchResult[] | null> => {
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
            const searchEngineId = import.meta.env.VITE_SEARCH_ENGINE_ID;

            if (!apiKey || !searchEngineId) {
                console.warn('Google Search API Key or Search Engine ID not configured.');
                return null;
            }

            const searchQuery = `site:cbm.sc.gov.br ${termosBusca}`;
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                console.error('Google Search API Error:', data.error);
                return null;
            }

            const resultados: SearchResult[] = data.items?.slice(0, 5).map((item: any) => ({
                titulo: item.title,
                snippet: item.snippet,
                link: item.link
            })) || [];

            return resultados;
        } catch (error) {
            console.error('Erro ao buscar no site CBMSC:', error);
            return null;
        }
    }
};
