import React, { useEffect, useState } from 'react';

interface NewsItem {
    title: string;
    link: string;
}

export const DefesaCivilTicker: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);

    useEffect(() => {
        // Attempt to fetch from Defesa Civil SC via RSS to JSON bridge
        // Using rss2json.com as a public bridge to avoid CORS issues with direct XML fetch
        const fetchNews = async () => {
            try {
                const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.defesacivil.sc.gov.br/feed/');
                const data = await response.json();
                if (data.items) {
                    setNews(data.items.map((item: any) => ({
                        title: item.title,
                        link: item.link
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch Defesa Civil news", error);
                // Fallback mock data if fetch fails
                setNews([
                    { title: "Defesa Civil de SC emite alerta para temporais isolados.", link: "https://www.defesacivil.sc.gov.br/" },
                    { title: "Confira a previsão do tempo para o fim de semana.", link: "https://www.defesacivil.sc.gov.br/" },
                    { title: "Defesa Civil orienta sobre cuidados no calor intenso.", link: "https://www.defesacivil.sc.gov.br/" }
                ]);
            }
        };

        fetchNews();
    }, []);

    if (news.length === 0) return null;

    return (
        <div className="w-full bg-orange-600 text-white overflow-hidden py-2 border-b-4 border-orange-800 shadow-sm relative z-20">
            <div className="flex items-center gap-4 animate-marquee whitespace-nowrap">
                <span className="font-black bg-orange-800 px-2 py-1 text-xs rounded uppercase tracking-wider ml-4 sticky left-0 z-30 shadow-lg">
                    Defesa Civil SC
                </span>
                <div className="flex gap-8 items-center">
                    {news.map((item, index) => (
                        <React.Fragment key={index}>
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm font-bold hover:underline flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">warning</span>
                                {item.title}
                            </a>
                            <span className="text-orange-300 mx-2">•</span>
                        </React.Fragment>
                    ))}
                    {/* Duplicate for smooth loop */}
                    {news.map((item, index) => (
                        <React.Fragment key={`dup-${index}`}>
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm font-bold hover:underline flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">warning</span>
                                {item.title}
                            </a>
                            <span className="text-orange-300 mx-2">•</span>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
            animation-play-state: paused;
        }
      `}</style>
        </div>
    );
};
