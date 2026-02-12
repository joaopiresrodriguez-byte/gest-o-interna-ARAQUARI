export interface SearchResult {
    title: string;
    snippet: string;
    url: string;
}

export const SearchService = {
    searchCBMSCWebsite: async (searchTerm: string): Promise<SearchResult[] | null> => {
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
            const searchEngineId = import.meta.env.VITE_SEARCH_ENGINE_ID;

            if (!apiKey || !searchEngineId) {
                console.error('[SearchService] Google Search API Key or Search Engine ID not configured.');
                return null;
            }

            console.log(`[SearchService] Searching for: "${searchTerm}" using Engine ID: ${searchEngineId}`);

            const searchQuery = `site:cbm.sc.gov.br ${searchTerm}`;
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                console.error('[SearchService] Google Search API Error:', data.error);
                return null;
            }

            const results: SearchResult[] = data.items?.slice(0, 5).map((item: any) => ({
                title: item.title,
                snippet: item.snippet,
                url: item.link
            })) || [];

            console.log(`[SearchService] Found ${results.length} results.`);

            return results;
        } catch (error) {
            console.error('[SearchService] Error searching CBMSC website:', error);
            return null;
        }
    }
};
