import React, { useState, useEffect } from 'react';
import { Training, MateriaInstrucao } from '../../services/types';
import { SupabaseService } from '../../services/SupabaseService';
import { toast } from 'sonner';

interface ModalEditarInstrucaoProps {
  isOpen: boolean;
  onClose: () => void;
  instrucao: Training | null;
  materiasList: MateriaInstrucao[];
  onSuccess: () => void;
}

export const ModalEditarInstrucao: React.FC<ModalEditarInstrucaoProps> = ({
  isOpen,
  onClose,
  instrucao,
  materiasList,
  onSuccess,
}) => {
  const [tema, setTema] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [instructor, setInstructor] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (instrucao && isOpen) {
      setTema(instrucao.tema || '');
      setMateriaId(instrucao.materia_id || '');
      setDate(instrucao.date || '');
      setTime(instrucao.time || '');
      setEndTime(instrucao.end_time || '');
      setInstructor(instrucao.instructor || '');
      setLocation(instrucao.location || '');
    }
  }, [instrucao, isOpen]);

  if (!isOpen || !instrucao) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || !instructor.trim()) {
      toast.error('Preencha os campos obrigatórios (Data, Horário de início e Instrutor).');
      return;
    }

    setLoading(true);
    try {
      await SupabaseService.updateTraining(instrucao.id!, {
        materia_id: materiaId || undefined,
        tema: tema.trim() || undefined,
        date,
        time,
        end_time: endTime.trim() || undefined,
        instructor: instructor.trim(),
        location: location.trim() || undefined,
      });

      toast.success('Instrução atualizada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar instrução:', err);
      toast.error('Erro ao salvar alterações da instrução: ' + (err?.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-blue-400">school</span>
            <div>
              <h3 className="font-bold text-base">Editar Instrução Marcada</h3>
              <p className="text-xs text-slate-300">Alterar dados da instrução agendada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl block">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Matéria de Referência (Opcional) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Vincular a Matéria do B3 (Opcional)
            </label>
            <select
              value={materiaId}
              onChange={(e) => {
                setMateriaId(e.target.value);
                const mat = materiasList.find(m => m.id === e.target.value);
                if (mat && !tema) {
                  setTema(mat.tema || mat.name);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Nenhuma matéria vinculada (Tema livre)</option>
              {materiasList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.tema ? `— ${m.tema}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tema Específico */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Tema / Conteúdo da Instrução
            </label>
            <input
              type="text"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex: Resgate Veicular - Técnicas de Desencarceramento"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Data e Horários */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Início <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Fim
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Instrutor */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Instrutor / Responsável <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Ex: 2º Sgt BM Fulano / Cap BM Beltrano"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Local */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Localização / Sala
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: PBM Araquari - Pátio de Treinamento"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Rodapé de Ações */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
