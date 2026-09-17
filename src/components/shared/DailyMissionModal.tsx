import React, { useState, useEffect } from 'react';
import { DailyMission, Personnel } from '../../services/types';
import { SupabaseService } from '../../services/SupabaseService';
import { getMilitaresRegularesOrdenados } from '../../utils/personnelUtils';
import { toast } from 'sonner';

export interface DailyMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (missionData: Omit<DailyMission, 'id'> | Omit<DailyMission, 'id'>[]) => Promise<void>;
  initialData?: Partial<DailyMission> | null;
  titleText?: string;
}

// Coordenadas e Endereço PBM ARAQUARI (Quartel do Corpo de Bombeiros Militar de Araquari)
export const PBM_ARAQUARI_DATA = {
  address: 'Rodovia BR-101, Km 67, Centro, Araquari - SC, 89245-000 (PBM ARAQUARI)',
  gmapsLink: 'https://maps.google.com/?q=-26.3752,-48.7214',
  wazeLink: 'https://waze.com/ul?ll=-26.3752,-48.7214&navigate=yes'
};

export const DailyMissionModal: React.FC<DailyMissionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  titleText = 'Nova Missão Diária'
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [missionDate, setMissionDate] = useState(SupabaseService.getTodayDate());
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [newExtraDate, setNewExtraDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [chefeSocorroId, setChefeSocorroId] = useState('');
  const [chefeSocorroNome, setChefeSocorroNome] = useState('');
  const [priority, setPriority] = useState<DailyMission['priority']>('media');

  // Fila de missões preparadas em lote
  const [queuedMissions, setQueuedMissions] = useState<Omit<DailyMission, 'id'>[]>([]);
  
  // Localização
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [isPbmAraquari, setIsPbmAraquari] = useState(false);

  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      SupabaseService.getPersonnel()
        .then(data => setPersonnelList(getMilitaresRegularesOrdenados(data || [])))
        .catch(err => console.error("Erro ao carregar lista de pessoal:", err));

      if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setMissionDate(initialData.mission_date ? initialData.mission_date.split('T')[0] : SupabaseService.getTodayDate());
        setExtraDates([]);
        setStartTime(initialData.start_time || '');
        setEndDate(initialData.end_date ? initialData.end_date.split('T')[0] : '');
        setEndTime(initialData.end_time || '');
        setResponsibleId(initialData.responsible_id || '');
        setResponsibleName(initialData.responsible_name || '');
        setChefeSocorroId(initialData.chefe_socorro_id || '');
        setChefeSocorroNome(initialData.chefe_socorro_nome || '');
        setPriority(initialData.priority || 'media');
        setLocationAddress(initialData.location_address || '');
        setLocationLink(initialData.location_link || '');
        setIsPbmAraquari(!!initialData.is_pbm_araquari);
        setQueuedMissions([]);
      } else {
        // Reset form
        setTitle('');
        setDescription('');
        setMissionDate(SupabaseService.getTodayDate());
        setExtraDates([]);
        setNewExtraDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
        setResponsibleId('');
        setResponsibleName('');
        setChefeSocorroId('');
        setChefeSocorroNome('');
        setPriority('media');
        setLocationAddress('');
        setLocationLink('');
        setIsPbmAraquari(false);
        setQueuedMissions([]);
      }
    }
  }, [isOpen, initialData]);

  const handleTogglePbmAraquari = (checked: boolean) => {
    setIsPbmAraquari(checked);
    if (checked) {
      setLocationAddress(PBM_ARAQUARI_DATA.address);
      setLocationLink(PBM_ARAQUARI_DATA.gmapsLink);
    }
  };

  const handleAddressChange = (val: string) => {
    setLocationAddress(val);
    if (isPbmAraquari && val !== PBM_ARAQUARI_DATA.address) {
      setIsPbmAraquari(false);
    }
    // Gerar link padrão do Google Maps se houver endereço digitado e nenhum link explícito
    if (val.trim() && !locationLink) {
      setLocationLink(`https://maps.google.com/?q=${encodeURIComponent(val.trim())}`);
    }
  };

  const handleSelectResponsible = (pId: string) => {
    setResponsibleId(pId);
    const p = personnelList.find(item => item.id === pId);
    if (p) {
      const rank = p.rank ? `${p.rank} ` : '';
      setResponsibleName(`${rank}${p.name || p.war_name || ''}`.trim());
    }
  };

  const handleAddExtraDate = () => {
    if (!newExtraDate) return;
    if (newExtraDate === missionDate || extraDates.includes(newExtraDate)) {
      toast.error('Data já adicionada.');
      return;
    }
    setExtraDates(prev => [...prev, newExtraDate]);
    setNewExtraDate('');
  };

  const handleRemoveExtraDate = (dateToRemove: string) => {
    setExtraDates(prev => prev.filter(d => d !== dateToRemove));
  };

  const buildCurrentMissionPayloads = (): Omit<DailyMission, 'id'>[] => {
    const allDates = Array.from(new Set([missionDate, ...extraDates].filter(Boolean)));
    return allDates.map(date => ({
      title: title.trim(),
      description: description.trim() || undefined,
      mission_date: date,
      start_time: startTime.trim() || undefined,
      end_date: endDate.trim() || undefined,
      end_time: endTime.trim() || undefined,
      responsible_id: responsibleId || undefined,
      responsible_name: responsibleName.trim() || undefined,
      priority: priority || 'media',
      status: initialData?.status || 'agendada',
      location_address: locationAddress.trim() || undefined,
      location_link: locationLink.trim() || undefined,
      is_pbm_araquari: isPbmAraquari,
    }));
  };

  const handleQueueCurrentMission = () => {
    if (!title.trim()) {
      toast.error('Informe o título da missão para adicionar à fila.');
      return;
    }
    const payloads = buildCurrentMissionPayloads();
    setQueuedMissions(prev => [...prev, ...payloads]);
    toast.success(`${payloads.length} item(ns) adicionado(s) à fila de envio!`);
    
    // Limpar formulário para próxima missão da fila
    setTitle('');
    setDescription('');
    setExtraDates([]);
  };

  const handleRemoveQueuedMission = (index: number) => {
    setQueuedMissions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent, keepOpenAfterSave = false) => {
    e.preventDefault();

    // Se houver dados no formulário atual, inclui no lote
    let finalPayloads: Omit<DailyMission, 'id'>[] = [...queuedMissions];
    if (title.trim()) {
      finalPayloads = [...finalPayloads, ...buildCurrentMissionPayloads()];
    }

    if (finalPayloads.length === 0) {
      toast.error('Informe ao menos o título de uma missão ou adicione itens à fila.');
      return;
    }

    setLoading(true);
    try {
      if (finalPayloads.length === 1) {
        await onSave(finalPayloads[0]);
      } else {
        await onSave(finalPayloads);
      }
      toast.success(`${finalPayloads.length} missão(ões) salva(s) com sucesso!`);
      
      if (keepOpenAfterSave) {
        // Limpar dados e manter janela aberta
        setTitle('');
        setDescription('');
        setExtraDates([]);
        setQueuedMissions([]);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('Erro ao salvar missões:', err);
      toast.error('Erro ao salvar missões: ' + (err.message || 'tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Gerar URLs rápidas para visualização
  const gmapsUrl = locationLink || (locationAddress ? `https://maps.google.com/?q=${encodeURIComponent(locationAddress)}` : '');
  const wazeUrl = isPbmAraquari
    ? PBM_ARAQUARI_DATA.wazeLink
    : (locationAddress ? `https://waze.com/ul?q=${encodeURIComponent(locationAddress)}&navigate=yes` : '');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-600 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">event_available</span>
            <h3 className="font-bold text-lg">{titleText}</h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-xl block">close</span>
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Título da Missão <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Inspeção no Comércio X, Manutenção de Viaturas, Treinamento..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Descrição
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhes adicionais da missão, equipamentos necessários, orientações..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none"
            />
          </div>

          {/* Datas e Horários (Início e Fim Opcional) + Múltiplas Datas */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200/70 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Data Início <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={missionDate}
                  onChange={e => setMissionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Hora Início <span className="text-gray-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Data Fim <span className="text-gray-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Hora Fim <span className="text-gray-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Múltiplas Datas Adicionais */}
            {!initialData && (
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 flex items-center justify-between">
                  <span>📅 Repetir em mais datas? (Opcional)</span>
                  {extraDates.length > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                      +{extraDates.length} data(s) extra(s)
                    </span>
                  )}
                </label>

                {extraDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {extraDates.map(d => (
                      <span key={d} className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                        {new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')}
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraDate(d)}
                          className="text-red-500 hover:text-red-800 font-bold ml-1"
                          title="Remover data"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newExtraDate}
                    onChange={e => setNewExtraDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddExtraDate}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Incluir Data
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Responsável e Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Responsável pela Missão
              </label>
              {personnelList.length > 0 && (
                <select
                  value={responsibleId}
                  onChange={e => handleSelectResponsible(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 mb-2"
                >
                  <option value="">Selecione da lista de militares...</option>
                  {personnelList.map(p => {
                    const label = `${p.rank ? p.rank + ' ' : ''}${p.war_name || p.name}`;
                    return (
                      <option key={p.id} value={p.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              )}
              <input
                type="text"
                value={responsibleName}
                onChange={e => {
                  setResponsibleName(e.target.value);
                  if (responsibleId) setResponsibleId('');
                }}
                placeholder="Ou digite o nome do responsável manualmente..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Endereço e Localização com Links para Maps/Waze */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-red-600 text-sm">location_on</span>
                Endereço / Localização
              </label>

              {/* Botão de Atalho PBM ARAQUARI */}
              <label className="inline-flex items-center gap-2 cursor-pointer bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold px-2.5 py-1 rounded-md transition-colors border border-red-200">
                <input
                  type="checkbox"
                  checked={isPbmAraquari}
                  onChange={e => handleTogglePbmAraquari(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                PBM ARAQUARI
              </label>
            </div>

            <div>
              <input
                type="text"
                value={locationAddress}
                onChange={e => handleAddressChange(e.target.value)}
                placeholder="Ex: Rua Cel. Procópio Gomes, 123 - Centro ou Selecione PBM ARAQUARI"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Links rápidos para Google Maps / Waze */}
            {(locationAddress || isPbmAraquari) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {gmapsUrl && (
                  <a
                    href={gmapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-blue-200"
                  >
                    <span className="material-symbols-outlined text-base">map</span>
                    Abrir no Google Maps
                  </a>
                )}
                {wazeUrl && (
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-cyan-200"
                  >
                    <span className="material-symbols-outlined text-base">navigation</span>
                    Abrir no Waze
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Fila de Missões Preparadas em Lote */}
          {queuedMissions.length > 0 && (
            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 uppercase">
                <span>📋 Fila de Cadastro em Lote ({queuedMissions.length} missões preparadas)</span>
                <button
                  type="button"
                  onClick={() => setQueuedMissions([])}
                  className="text-[10px] text-amber-700 hover:text-amber-900 underline lowercase"
                >
                  limpar fila
                </button>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {queuedMissions.map((q, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-amber-200/80 text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{q.title}</span>
                      <span className="text-[10px] text-gray-500">
                        📅 {new Date(q.mission_date + 'T00:00:00').toLocaleDateString('pt-BR')} {q.responsible_name ? `• Resp: ${q.responsible_name}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQueuedMission(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remover da fila"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            {!initialData && (
              <button
                type="button"
                onClick={handleQueueCurrentMission}
                className="px-3 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center gap-1 border border-amber-300"
              >
                <span className="material-symbols-outlined text-sm">playlist_add</span>
                Adicionar à Fila de Lote
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>

              {!initialData && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={e => handleSubmit(e, true)}
                  className="px-4 py-2 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="Salva a missão atual e mantém a janela aberta para a próxima"
                >
                  <span className="material-symbols-outlined text-sm">add_task</span>
                  Salvar & Nova
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                {queuedMissions.length > 0 ? `Salvar Todas (${queuedMissions.length + (title.trim() ? 1 : 0)})` : 'Salvar Missão'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
