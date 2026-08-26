import React, { useState, useEffect } from 'react';

interface WeatherData {
  temperature: number;
  humidity: number;
  uvIndex: number;
  precipitationProbability: number;
  weatherCode: number;
  updatedAt: string;
}

export const CardClimaAraquari: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(false);
      // Coordinates for Araquari - SC: latitude -26.3731, longitude -48.7239
      const response = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=-26.3731&longitude=-48.7239&current=temperature_2m,relative_humidity_2m,weather_code,uv_index&hourly=precipitation_probability&timezone=America%2FSao_Paulo'
      );
      const data = await response.json();

      if (data && data.current) {
        const currentHour = new Date().getHours();
        const nextHoursProb = data.hourly?.precipitation_probability?.slice(currentHour, currentHour + 6) || [];
        const maxProb = nextHoursProb.length > 0 ? Math.max(...nextHoursProb) : 0;

        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          humidity: data.current.relative_humidity_2m,
          uvIndex: Math.round(data.current.uv_index || 0),
          precipitationProbability: maxProb,
          weatherCode: data.current.weather_code,
          updatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do clima:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getUvInfo = (uv: number) => {
    if (uv <= 2) return { text: 'Baixo', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (uv <= 5) return { text: 'Moderado', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    if (uv <= 7) return { text: 'Alto', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (uv <= 10) return { text: 'Muito Alto', color: 'bg-red-100 text-red-800 border-red-300' };
    return { text: 'Extremo', color: 'bg-purple-100 text-purple-800 border-purple-300' };
  };

  const getWeatherVisual = (code: number) => {
    if (code === 0) return { icon: 'wb_sunny', label: 'Céu Limpo', color: 'text-amber-500' };
    if (code >= 1 && code <= 3) return { icon: 'partly_cloudy_day', label: 'Parcialmente Nublado', color: 'text-amber-600' };
    if (code >= 45 && code <= 48) return { icon: 'foggy', label: 'Nevoeiro', color: 'text-slate-400' };
    if (code >= 51 && code <= 67) return { icon: 'rainy', label: 'Chuva Leve/Moderada', color: 'text-blue-500' };
    if (code >= 80 && code <= 82) return { icon: 'rainy', label: 'Pancadas de Chuva', color: 'text-blue-600' };
    if (code >= 95) return { icon: 'thunderstorm', label: 'Tempestade', color: 'text-purple-600' };
    return { icon: 'cloud', label: 'Nublado', color: 'text-slate-500' };
  };

  if (loading && !weather) {
    return (
      <div className="bg-white rounded-xl border border-rustic-border p-5 shadow-xs animate-pulse">
        <div className="h-5 bg-stone-200 rounded w-1/2 mb-3"></div>
        <div className="h-10 bg-stone-200 rounded mb-2"></div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-white rounded-xl border border-rustic-border p-4 shadow-xs text-xs text-stone-500">
        <div className="flex items-center justify-between">
          <span className="font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-500 text-base">thermostat</span>
            Clima Araquari - SC
          </span>
          <button onClick={fetchWeather} className="text-primary hover:underline font-semibold">Tentar novamente</button>
        </div>
      </div>
    );
  }

  const uvInfo = getUvInfo(weather.uvIndex);
  const visual = getWeatherVisual(weather.weatherCode);

  return (
    <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-xl border border-blue-800/60 p-4 shadow-md space-y-3 relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-blue-700/50 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sky-400 text-lg">location_on</span>
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-100">Araquari - SC</h3>
        </div>
        <span className="text-[9px] font-bold bg-blue-800/80 px-2 py-0.5 rounded text-sky-200 border border-blue-700">
          Ao Vivo
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`material-symbols-outlined text-4xl ${visual.color}`}>{visual.icon}</span>
          <div>
            <div className="text-2xl font-black leading-none">{weather.temperature}°C</div>
            <div className="text-[10px] font-semibold text-slate-300 mt-0.5">{visual.label}</div>
          </div>
        </div>

        <div className="text-right bg-blue-950/60 p-2 rounded-lg border border-blue-800/40">
          <div className="flex items-center justify-end gap-1 text-[10px] text-sky-300 font-bold">
            <span className="material-symbols-outlined text-xs">water_drop</span>
            Chuva (próx. hs)
          </div>
          <div className="text-sm font-black text-white">{weather.precipitationProbability}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-blue-950/40 p-2 rounded-lg border border-blue-800/30 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-sky-400">humidity_percentage</span>
            Umidade
          </span>
          <span className="text-xs font-black text-white">{weather.humidity}%</span>
        </div>

        <div className="bg-blue-950/40 p-2 rounded-lg border border-blue-800/30 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-amber-400">wb_sunny</span>
            Índice UV
          </span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${uvInfo.color}`}>
            {weather.uvIndex} ({uvInfo.text})
          </span>
        </div>
      </div>

      <div className="text-[9px] text-slate-400 text-right pt-1 border-t border-blue-800/40">
        Atualizado às {weather.updatedAt}
      </div>
    </div>
  );
};
