import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Personnel } from '../../services/types';
import { sortPersonnelBySeniority, formatPersonnelMilitaryName } from '../../utils/personnelUtils';

export interface PersonnelSelectProps {
  personnelList: Personnel[];
  value: number | string;
  onChange: (value: number | string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filterFn?: (p: Personnel) => boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  showStatusBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  name?: string;
  required?: boolean;
}

export const PersonnelSelect: React.FC<PersonnelSelectProps> = ({
  personnelList,
  value,
  onChange,
  placeholder = 'Selecione o militar...',
  disabled = false,
  className = '',
  filterFn,
  allowEmpty = true,
  emptyLabel = 'Nenhum / Desmarcar',
  showStatusBadge = false,
  size = 'md',
  id,
  required,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Filtrar lista e ordenar por antiguidade hierárquica oficial (Cel -> Sd -> BCs)
  const sortedPersonnel = useMemo(() => {
    let list = personnelList;
    if (filterFn) {
      list = list.filter(filterFn);
    }
    return sortPersonnelBySeniority(list);
  }, [personnelList, filterFn]);

  // 2. Filtrar conforme pesquisa (busca por nome, nome de guerra, graduação ou primeira letra)
  const filteredList = useMemo(() => {
    if (!search.trim()) return sortedPersonnel;
    const term = search.toLowerCase().trim();
    return sortedPersonnel.filter(p => {
      const grad = (p.graduation || p.rank || '').toLowerCase();
      const warName = (p.war_name || '').toLowerCase();
      const fullName = (p.name || '').toLowerCase();
      const matricula = (p.matricula || '').toLowerCase();
      const militaryLabel = `${grad} ${warName || fullName}`.toLowerCase();

      return (
        militaryLabel.includes(term) ||
        fullName.includes(term) ||
        warName.includes(term) ||
        grad.includes(term) ||
        matricula.includes(term)
      );
    });
  }, [sortedPersonnel, search]);

  // Militar atualmente selecionado
  const selectedPersonnel = useMemo(() => {
    if (value === '' || value === null || value === undefined) return null;
    return personnelList.find(p => String(p.id) === String(value)) || null;
  }, [personnelList, value]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Foco no input de busca ao abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Navegação por teclado / atalho rápido de letra
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && isOpen && filteredList.length > 0) {
      e.preventDefault();
      handleSelect(filteredList[0].id);
    }
  };

  const handleSelect = (personnelId: number | string) => {
    onChange(personnelId);
    setIsOpen(false);
  };

  // Altura baseada no size
  const heightClass =
    size === 'sm' ? 'h-8 text-[11px] px-2.5' :
    size === 'lg' ? 'h-12 text-sm px-4' :
    'h-11 text-xs px-3';

  return (
    <div
      ref={containerRef}
      id={id}
      className={`relative w-full text-left font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Botão de Disparo do Select */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full ${heightClass} flex items-center justify-between gap-2 rounded-lg border border-rustic-border bg-white font-bold text-rustic-brown shadow-xs transition-all outline-none focus:ring-2 focus:ring-primary/20 ${
          disabled ? 'opacity-60 cursor-not-allowed bg-stone-100' : 'cursor-pointer hover:border-rustic-brown/40'
        } ${isOpen ? 'ring-2 ring-primary/30 border-primary' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedPersonnel ? (
            <>
              <span className="truncate font-black text-stone-900">
                {formatPersonnelMilitaryName(selectedPersonnel)}
              </span>
              {showStatusBadge && selectedPersonnel.status && selectedPersonnel.status !== 'Ativo' && (
                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800">
                  {selectedPersonnel.status}
                </span>
              )}
            </>
          ) : (
            <span className="truncate font-normal text-stone-400">
              {placeholder}
            </span>
          )}
        </div>
        <span className={`material-symbols-outlined text-[18px] text-stone-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}>
          arrow_drop_down
        </span>
      </button>

      {/* Painel Flutuante / Dropdown com Campo de Pesquisa */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-xl border border-stone-200 bg-white shadow-xl overflow-hidden animate-fadeIn">
          {/* Campo de Busca Rápida */}
          <div className="p-2 border-b border-stone-100 bg-stone-50/80">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-2.5 text-stone-400 text-[18px]">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, letra ou posto..."
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-stone-200 bg-white text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-stone-400 hover:text-stone-600 text-[16px]"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[9px] text-stone-400 font-bold uppercase tracking-wider px-1 pt-1.5">
              <span>Ordem de Antiguidade Militar</span>
              <span>{filteredList.length} militar(es)</span>
            </div>
          </div>

          {/* Lista de Opções Rolável */}
          <div className="max-h-60 overflow-y-auto divide-y divide-stone-100/60 p-1">
            {allowEmpty && !search && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-stone-400 hover:bg-stone-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] text-stone-400">block</span>
                <span>{emptyLabel}</span>
              </button>
            )}

            {filteredList.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-400 font-medium">
                Nenhum militar encontrado para "{search}".
              </div>
            ) : (
              filteredList.map(person => {
                const isSelected = String(person.id) === String(value);
                const militaryName = formatPersonnelMilitaryName(person);
                const grad = person.graduation || person.rank || '';

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSelect(person.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-50/80 text-amber-900 border border-amber-200/80'
                        : 'text-stone-700 hover:bg-stone-50 hover:text-stone-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />
                      <div className="flex flex-col truncate">
                        <span className="truncate">
                          <strong className="text-stone-900 mr-1">{grad}</strong>
                          {person.war_name || person.name}
                        </span>
                        {person.war_name && person.name && person.war_name !== person.name && (
                          <span className="text-[10px] text-stone-400 font-normal truncate">
                            {person.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {person.status && person.status !== 'Ativo' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-stone-100 text-stone-600">
                          {person.status}
                        </span>
                      )}
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] text-amber-600">
                          check
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelSelect;
