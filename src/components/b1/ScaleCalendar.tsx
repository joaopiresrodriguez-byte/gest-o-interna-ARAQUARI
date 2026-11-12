import React, { useState, useEffect } from 'react';
import { Escala, Personnel, Vacation, BcSelecionado } from '../../services/types';
import { supabase } from '../../services/supabase';

interface ScaleCalendarProps {
    month: string;
    escalas: Escala[];
    personnelList: Personnel[];
    vacations: Vacation[];
    bcSelecionados?: BcSelecionado[];
    onDayClick?: (date: string, personId: number) => void;
    onMonthChange?: (newMonth: string) => void;
}

export type BcTurnoType = '12h Matutino' | '12h Noturno' | '24h';

export interface BcTurnoInfo {
    label: BcTurnoType;
    shortLabel: string;
    horarios: string;
    badgeCls: string;
    borderCls: string;
}

export const getBcTurnoInfo = (inicio?: string, fim?: string, totalHoras?: number): BcTurnoInfo => {
    const cleanInicio = (inicio || '').substring(0, 5);
    const cleanFim = (fim || '').substring(0, 5);

    // 24 horas: total_horas === 24 ou mesmo horário de início e fim
    if (totalHoras === 24 || (cleanInicio === '08:00' && cleanFim === '08:00')) {
        return {
            label: '24h',
            shortLabel: '24h',
            horarios: '08:00 às 08:00 (24h)',
            badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            borderCls: 'border-emerald-300'
        };
    }

    // 12h Noturno: início 20h ou fim 08h
    if (cleanInicio === '20:00' || cleanFim === '08:00') {
        return {
            label: '12h Noturno',
            shortLabel: '12h Noturno',
            horarios: '20:00 às 08:00 (12h)',
            badgeCls: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            borderCls: 'border-indigo-300'
        };
    }

    // 12h Matutino: padrão para 08:00 às 20:00
    return {
        label: '12h Matutino',
        shortLabel: '12h Matutino',
        horarios: '08:00 às 20:00 (12h)',
        badgeCls: 'bg-amber-100 text-amber-800 border-amber-300',
        borderCls: 'border-amber-300'
    };
};

// Categorias de CNH elegíveis para Condutor de Emergência
const CATEGORIAS_CONDUTOR_ELEGIVEIS = ['C', 'AC', 'AD', 'D', 'AE'];

/**
 * Retorna a graduação do Bombeiro Militar normalizada ou 'Sd' como fallback se for militar regular sem graduação preenchida.
 */
export const getMilitarGraduation = (p?: Partial<Personnel> | null): string => {
    if (!p) return '';
    const raw = (p.graduation || p.rank || '').trim();
    if (raw) {
        // Se já tiver alguma graduação preenchida, normaliza formato
        let clean = raw.replace(/\s*BM$/i, '').trim();
        clean = clean.replace(/(\d+)[°º]\s*Sgt/i, '$1º Sgt');
        clean = clean.replace(/Sub\s*-?\s*Ten/i, 'Sub Ten');
        clean = clean.replace(/Ten\s*-?\s*Cel/i, 'Ten Cel');
        clean = clean.replace(/Asp(\s*Of)?/i, 'Asp Of');
        return clean;
    }
    // Se for BM (ou não for BC) e a graduação estiver vazia, o padrão de praça de ingresso é Sd
    const isBC = p.type === 'BC' || (p.graduation && p.graduation.toLowerCase().includes('bc')) || (p.rank && p.rank.toLowerCase().includes('bc'));
    if (!isBC) {
        return 'Sd';
    }
    return '';
};

/**
 * Verifica se um Bombeiro Comunitário é condutor habilitado:
 * Possui CNH C, AC, AD, D ou AE E CVE ativo (Sim).
 */
export const isBcCondutorHabilitado = (p?: Partial<Personnel> | null): boolean => {
    if (!p) return false;
    const isBC = p.type === 'BC' || (p.graduation && p.graduation.toLowerCase().includes('bc')) || (p.rank && p.rank.toLowerCase().includes('bc'));
    if (!isBC) return false;

    // Verificar se CVE está ativo (Sim ou Ativo)
    const cveRaw = (p.cve_active || '').trim().toUpperCase();
    const cveAtivo = cveRaw === 'SIM' || cveRaw === 'ATIVO';
    if (!cveAtivo) return false;

    // Verificar se a categoria da CNH é C, AC, AD, D ou AE
    const cnhRaw = (p.cnh_category || p.cnh || '').trim().toUpperCase();
    // Limpar espaços ou barras se houver (ex: 'Cat D', 'D', 'AD')
    const cnhLimpa = cnhRaw.replace(/[^A-Z]/g, '');
    return CATEGORIAS_CONDUTOR_ELEGIVEIS.includes(cnhLimpa);
};

// Helper para exibição padronizada do nome:
// Bombeiro Comunitário (BC): BC NomeDeGuerra COND. (se condutor apto) ou BC NomeDeGuerra
// Bombeiro Militar (BM): Graduação + Nome de Guerra (ex: Sd ANTON, Cb JUDSON)
export const formatPersonnelName = (p?: Personnel | null): string => {
    if (!p) return '';
    const warName = p.war_name || p.name.split(' ')[0];
    const isBC = p.type === 'BC' || (p.graduation && p.graduation.toLowerCase().includes('bc')) || (p.rank && p.rank.toLowerCase().includes('bc'));
    if (isBC) {
        const isCond = isBcCondutorHabilitado(p);
        return isCond ? `BC ${warName} COND.` : `BC ${warName}`;
    }
    const grad = getMilitarGraduation(p);
    return `${grad} ${warName}`.trim();
};

/**
 * Ordenação de escalados no dia:
 * 1º Militares Regulares (BM) ordenados por antiguidade de graduação (Oficiais -> Sub Ten -> Sargentos -> Cabos -> Soldados).
 * 2º Bombeiros Comunitários (BC) ordenados por sua graduação interna (Grau mais alto -> mais novo) e nome.
 */
export const sortEscaladosPorGraduacao = (lista: Personnel[]): Personnel[] => {
    const militares: Personnel[] = [];
    const comunitarios: Personnel[] = [];

    lista.forEach(p => {
        const isBC = p.type === 'BC' || (p.graduation && p.graduation.toLowerCase().includes('bc')) || (p.rank && p.rank.toLowerCase().includes('bc'));
        if (isBC) {
            comunitarios.push(p);
        } else {
            militares.push(p);
        }
    });

    // Ordem de militares BM
    const ranksBMOrder: Record<string, number> = {
        'Cel': 0, 'Ten Cel': 1, 'Maj': 2, 'Cap': 3, '1º Ten': 4, '2º Ten': 5, 'Asp Of': 6,
        'Sub Ten': 7, '1º Sgt': 8, '2º Sgt': 9, '3º Sgt': 10, 'Cb': 11, 'Sd': 12
    };

    militares.sort((a, b) => {
        const gradA = getMilitarGraduation(a);
        const gradB = getMilitarGraduation(b);
        const scoreA = ranksBMOrder[gradA] !== undefined ? ranksBMOrder[gradA] : 99;
        const scoreB = ranksBMOrder[gradB] !== undefined ? ranksBMOrder[gradB] : 99;
        if (scoreA !== scoreB) return scoreA - scoreB;

        const nameA = a.war_name || a.name || '';
        const nameB = b.war_name || b.name || '';
        return nameA.localeCompare(nameB, 'pt-BR');
    });

    // Ordem de Bombeiros Comunitários BC (grau maior / ordem decrescente, seguido de nome)
    comunitarios.sort((a, b) => {
        const ordemA = typeof a.bc_graduacao_ordem === 'number' && a.bc_graduacao_ordem > 0
            ? a.bc_graduacao_ordem
            : (() => {
                const m = (a.graduation || a.rank || '').match(/(\d+)[°º]?\s*Grau/i);
                return m ? parseInt(m[1], 10) : 1;
            })();

        const ordemB = typeof b.bc_graduacao_ordem === 'number' && b.bc_graduacao_ordem > 0
            ? b.bc_graduacao_ordem
            : (() => {
                const m = (b.graduation || b.rank || '').match(/(\d+)[°º]?\s*Grau/i);
                return m ? parseInt(m[1], 10) : 1;
            })();

        // Maior grau primeiro (ordem decrescente: 10º Grau -> 1º Grau)
        if (ordemA !== ordemB) return ordemB - ordemA;

        const nameA = a.war_name || a.name || '';
        const nameB = b.war_name || b.name || '';
        return nameA.localeCompare(nameB, 'pt-BR');
    });

    return [...militares, ...comunitarios];
};

const CORES: Record<string, { bg: string; text: string; hex: string; pillBg: string; borderHex: string }> = {
  A: { bg: 'bg-emerald-600', text: 'text-emerald-700', hex: '#16a34a', pillBg: '#dcfce7', borderHex: '#86efac' }, // VERDE
  B: { bg: 'bg-blue-600', text: 'text-blue-700', hex: '#2563eb', pillBg: '#dbeafe', borderHex: '#93c5fd' },   // AZUL
  C: { bg: 'bg-amber-500', text: 'text-amber-700', hex: '#ca8a04', pillBg: '#fef3c7', borderHex: '#fde047' },// AMARELO
  D: { bg: 'bg-rose-600', text: 'text-rose-700', hex: '#dc2626', pillBg: '#ffe4e6', borderHex: '#fca5a5' },    // VERMELHO
};

const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTurmaLetter = (turma?: string, equipe?: string): string => {
    const raw = (turma || equipe || '').trim().toUpperCase();
    if (raw.endsWith('A') || raw.includes('TURMA A') || raw.includes('GUARNIÇÃO A') || raw.includes('ALPHA') || raw.includes('AZUL')) return 'A';
    if (raw.endsWith('B') || raw.includes('TURMA B') || raw.includes('GUARNIÇÃO B') || raw.includes('BRAVO') || raw.includes('VERMELH')) return 'B';
    if (raw.endsWith('C') || raw.includes('TURMA C') || raw.includes('GUARNIÇÃO C') || raw.includes('CHARLIE') || raw.includes('AMAREL')) return 'C';
    if (raw.endsWith('D') || raw.includes('TURMA D') || raw.includes('GUARNIÇÃO D') || raw.includes('DELTA') || raw.includes('BRANC')) return 'D';
    if (raw.length === 1 && ['A', 'B', 'C', 'D'].includes(raw)) return raw;
    return 'A';
};

const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export type TipoAlteracaoEscala = 'troca_mutua' | 'troca_individual' | 'transferencia_guarnicao' | null;

export interface EscalaAlteracaoInfo {
    tipo: TipoAlteracaoEscala;
    descricao?: string;
    badgeStyle?: string;
}

const ScaleCalendar: React.FC<ScaleCalendarProps> = ({ month, escalas, personnelList, vacations, bcSelecionados: propBcSelecionados, onDayClick, onMonthChange }) => {
    const [viewMode, setViewMode] = useState<'grid' | 'matrix'>('grid');
    const [internalBcSelecionados, setInternalBcSelecionados] = useState<BcSelecionado[]>([]);
    const [escalaAlteracoes, setEscalaAlteracoes] = useState<any[]>([]);
    const [serviceSwaps, setServiceSwaps] = useState<any[]>([]);
    const [selectedDayDetails, setSelectedDayDetails] = useState<{
        dateStr: string;
        dayNum: number;
        teamLetter: string | null;
        escalados: Personnel[];
        dayEscala: Escala | null;
    } | null>(null);
    const [year, monthNum] = month.split('-').map(Number);
    
    // Sincronizar/carregar bc_selecionados e escala_alteracoes para o mês
    useEffect(() => {
        let isMounted = true;
        const [anoStr, mesStr] = month.split('-');
        const anoNum = parseInt(anoStr, 10);
        const mesNum = parseInt(mesStr, 10);
        const primeiroDia = `${month}-01`;
        const ultimoDiaNum = new Date(anoNum, mesNum, 0).getDate();
        const ultimoDia = `${month}-${String(ultimoDiaNum).padStart(2, '0')}`;

        if (!propBcSelecionados || propBcSelecionados.length === 0) {
            supabase
                .from('bc_selecionados')
                .select('*')
                .gte('dia', primeiroDia)
                .lte('dia', ultimoDia)
                .then(res => {
                    if (isMounted && res.data) {
                        setInternalBcSelecionados(res.data as BcSelecionado[]);
                    }
                })
                .catch(err => {
                    console.warn('Erro ao carregar bc_selecionados no ScaleCalendar:', err);
                });
        } else {
            setInternalBcSelecionados(propBcSelecionados);
        }

        // Carregar alterações de escala e trocas
        Promise.all([
            supabase.from('escala_alteracoes').select('*'),
            supabase.from('service_swaps').select('*').eq('approval_status', 'Aprovado')
        ]).then(([altRes, swapRes]) => {
            if (isMounted) {
                if (altRes.data) setEscalaAlteracoes(altRes.data);
                if (swapRes.data) setServiceSwaps(swapRes.data);
            }
        }).catch(err => {
            console.warn('Erro ao carregar escala_alteracoes no ScaleCalendar:', err);
        });

        return () => {
            isMounted = false;
        };
    }, [month, propBcSelecionados]);

    const activeBcSelecionados = (propBcSelecionados && propBcSelecionados.length > 0) ? propBcSelecionados : internalBcSelecionados;

    // Helper para identificar o tipo de alteração do militar em uma data específica
    const getPersonnelAlteracao = (dateStr: string, personId: number): EscalaAlteracaoInfo => {
        if (!dateStr || !personId) return { tipo: null };

        // 1. Verificar escala_alteracoes
        if (escalaAlteracoes && escalaAlteracoes.length > 0) {
            for (const alt of escalaAlteracoes) {
                const mA = Number(alt.militar_a_id);
                const mB = Number(alt.militar_b_id);

                // MODALIDADE 1: Troca Mútua (Azul Céu)
                if (alt.tipo_alteracao === 'troca_militares' || alt.tipo_alteracao === 'Troca Mútua') {
                    // No dia A, o militar B está assumindo a vaga
                    if (alt.dia_original_a === dateStr && mB === personId) {
                        return {
                            tipo: 'troca_mutua',
                            descricao: alt.detalhes || 'Troca Mútua de Serviço',
                            badgeStyle: 'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200/80'
                        };
                    }
                    // No dia B, o militar A está assumindo a vaga
                    if (alt.dia_original_b === dateStr && mA === personId) {
                        return {
                            tipo: 'troca_mutua',
                            descricao: alt.detalhes || 'Troca Mútua de Serviço',
                            badgeStyle: 'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200/80'
                        };
                    }
                }

                // MODALIDADE 2: Troca Individual (Verde Água)
                if (alt.tipo_alteracao === 'troca_individual' || alt.tipo_alteracao === 'Troca Individual') {
                    // No dia de entrada (dia_original_b), o militar A entra
                    if (alt.dia_original_b === dateStr && mA === personId) {
                        return {
                            tipo: 'troca_individual',
                            descricao: alt.detalhes || 'Troca Individual de Escala',
                            badgeStyle: 'bg-teal-100 text-teal-950 border-teal-300 hover:bg-teal-200/80'
                        };
                    }
                }

                // MODALIDADE 3: Transferência de Guarnição (Laranja Cenoura)
                if (alt.tipo_alteracao === 'transferencia_guarnicao' || alt.tipo_alteracao === 'Transf. Guarnição') {
                    // Aparecer apenas no dia em que o militar está assumindo a outra guarnição (data_vigencia)
                    if (alt.data_vigencia === dateStr && mA === personId) {
                        return {
                            tipo: 'transferencia_guarnicao',
                            descricao: alt.detalhes || 'Transferência de Guarnição',
                            badgeStyle: 'bg-orange-200 text-orange-950 border-orange-400 hover:bg-orange-300/80'
                        };
                    }
                }
            }
        }

        // 2. Verificar service_swaps legados (Aprovados)
        if (serviceSwaps && serviceSwaps.length > 0) {
            for (const swap of serviceSwaps) {
                const pId = Number(swap.personnel_id);
                const sId = Number(swap.swap_with_personnel_id);

                // Date A gives to B: sId assume no dia swap.date_a_gives_to_b ou new_date
                const dataEntradaB = swap.date_a_gives_to_b || swap.new_date;
                if (dataEntradaB === dateStr && sId === personId) {
                    return {
                        tipo: sId ? 'troca_mutua' : 'troca_individual',
                        descricao: swap.reason || 'Troca de Serviço Aprovada',
                        badgeStyle: sId
                            ? 'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200/80'
                            : 'bg-teal-100 text-teal-950 border-teal-300 hover:bg-teal-200/80'
                    };
                }

                const dataEntradaA = swap.date_b_gives_to_a || swap.original_date;
                if (dataEntradaA === dateStr && pId === personId && swap.swap_with_personnel_id) {
                    return {
                        tipo: 'troca_mutua',
                        descricao: swap.reason || 'Troca Mútua Aprovada',
                        badgeStyle: 'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200/80'
                    };
                }
            }
        }

        return { tipo: null };
    };

    // Helper para buscar o turno selecionado de um BC específico em uma data
    const findBcTurno = (dateStr: string, personId: number): BcTurnoInfo | null => {
        const item = activeBcSelecionados.find(s => s && s.dia === dateStr && Number(s.bombeiro_id) === Number(personId));
        if (item) {
            return getBcTurnoInfo(item.horario_inicio, item.horario_fim, item.total_horas);
        }
        return null;
    };
    
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const changeMonth = (delta: number) => {
        const d = new Date(year, monthNum - 1 + delta, 1);
        const newMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        onMonthChange?.(newMonthStr);
    };

    // Obter data do mês anterior e próximo para os minicalendários
    const prevMonthDate = new Date(year, monthNum - 2, 1);
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth() + 1;

    const nextMonthDate = new Date(year, monthNum, 1);
    const nextMonthYear = nextMonthDate.getFullYear();
    const nextMonthNum = nextMonthDate.getMonth() + 1;

    const getStatusForDay = (dayNum: number, personId: number) => {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        const dayEscala = (escalas || []).find(e => e && e.data === dateStr);
        const isScaled = dayEscala?.militares?.includes(personId);
        const warning = dayEscala?.warnings?.find(w => w && w.personnel_id === personId);

        const isVacation = (vacations || []).some(v =>
            v && v.personnel_id === personId &&
            v.start_date && v.end_date &&
            dateStr >= v.start_date &&
            dateStr <= v.end_date
        );

        if (isScaled && dayEscala) {
            const teamLetter = getTurmaLetter(dayEscala.turma, dayEscala.equipe);
            const teamInfo = CORES[teamLetter] || CORES['A'];
            
            const onDutyMembers = dayEscala.militares
                ?.map((id: number) => {
                    const p = personnelList.find(mil => mil.id === id);
                    return p ? formatPersonnelName(p) : null;
                })
                .filter(Boolean)
                .join(', ');

            return {
                label: teamLetter,
                cls: 'font-bold border-none',
                style: { backgroundColor: hexToRgba(teamInfo.hex, 0.2), color: teamInfo.hex },
                tooltip: `Guarnição ${teamLetter} - Serviço: ${onDutyMembers}`,
                warning: warning || (isVacation ? { type: 'VACATION', message: 'Militar em férias/licença' } : null)
            };
        }

        if (isVacation) return { label: 'Férias', cls: 'bg-amber-100 text-amber-700' };

        return null;
    };

    // Auxiliar para gerar o grid de 7 colunas (Segunda a Domingo)
    const getGridWeeks = () => {
        const firstDayObj = new Date(year, monthNum - 1, 1);
        const jsDay = firstDayObj.getDay(); // 0: Sun, 1: Mon...
        const paddingDays = jsDay === 0 ? 6 : jsDay - 1; // 0 para Segunda, 6 para Domingo

        const totalCells = Math.ceil((paddingDays + daysInMonth) / 7) * 7;
        const cells = [];

        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - paddingDays + 1;
            if (dayNum > 0 && dayNum <= daysInMonth) {
                cells.push({ dayNum, inMonth: true });
            } else {
                cells.push({ dayNum: null, inMonth: false });
            }
        }
        return cells;
    };

    // Auxiliar para renderizar um minicalendário
    const renderMiniCalendar = (mYear: number, mMonthNum: number) => {
        const mDaysInMonth = new Date(mYear, mMonthNum, 0).getDate();
        const firstDayObj = new Date(mYear, mMonthNum - 1, 1);
        const jsDay = firstDayObj.getDay();
        const paddingDays = jsDay === 0 ? 6 : jsDay - 1;
        const totalCells = Math.ceil((paddingDays + mDaysInMonth) / 7) * 7;

        const cells = [];
        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - paddingDays + 1;
            cells.push(dayNum > 0 && dayNum <= mDaysInMonth ? dayNum : null);
        }

        return (
            <div className="w-44 border border-blue-900/30 rounded overflow-hidden shadow-xs bg-white text-[9px]">
                <div className="bg-[#1e3a8a] text-white text-center py-0.5 font-bold tracking-tight text-[10px]">
                    {monthNames[mMonthNum - 1]} {mYear}
                </div>
                <div className="grid grid-cols-7 text-center font-bold bg-stone-100 text-stone-700 py-0.5 border-b border-stone-200">
                    <span>Se</span><span>Te</span><span>Qu</span><span>Qu</span><span>Se</span><span>Sá</span><span>Do</span>
                </div>
                <div className="grid grid-cols-7 text-center py-1 gap-y-0.5 text-stone-700">
                    {cells.map((d, idx) => (
                        <span key={idx} className={`${d === null ? 'text-transparent' : ''} ${idx % 7 === 6 ? 'font-bold' : ''}`}>
                            {d || '•'}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white border border-stone-300 rounded-xl overflow-hidden shadow-md">
            {/* Header de Ações e Navegação */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                            viewMode === 'grid'
                                ? 'bg-blue-700 text-white shadow-sm'
                                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">grid_on</span>
                        Calendário Mensal (Grid)
                    </button>
                    <button
                        onClick={() => setViewMode('matrix')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                            viewMode === 'matrix'
                                ? 'bg-blue-700 text-white shadow-sm'
                                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">view_timeline</span>
                        Matriz por Militar
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shadow-xs"
                    >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                        Anterior
                    </button>
                    <input
                        type="month"
                        value={month}
                        onChange={e => e.target.value && onMonthChange?.(e.target.value)}
                        className="h-8 px-2 bg-white border border-stone-300 text-xs font-bold rounded-lg text-stone-800"
                    />
                    <button
                        onClick={() => changeMonth(1)}
                        className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors shadow-xs"
                    >
                        Próximo
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* LAYOUT MENSAL TIPO FOLHA DE CALENDÁRIO (CONFORME IMAGEM DE REFERÊNCIA) */}
            {viewMode === 'grid' && (
                <div className="p-6 bg-white space-y-4">
                    {/* Topo do Calendário: Título do Mês à esquerda + Mini Calendários à direita */}
                    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pb-2 border-b border-stone-100">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-[#2554a3] tracking-tight lowercase">
                                {monthNames[monthNum - 1]} <span className="font-bold">{year}</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-3 self-end">
                            {renderMiniCalendar(prevMonthYear, prevMonthNum)}
                            {renderMiniCalendar(nextMonthYear, nextMonthNum)}
                        </div>
                    </div>

                    {/* Grade Principal do Mês (7 Colunas: segunda-feira a domingo) */}
                    <div className="border-2 border-[#1e40af] rounded-lg overflow-hidden shadow-sm">
                        {/* Header das colunas dos dias da semana */}
                        <div className="grid grid-cols-7 bg-[#1e40af] text-white text-center text-xs md:text-sm font-extrabold py-2 border-b border-[#1e40af]">
                            <div>segunda-feira</div>
                            <div>terça-feira</div>
                            <div>quarta-feira</div>
                            <div>quinta-feira</div>
                            <div>sexta-feira</div>
                            <div>sábado</div>
                            <div>domingo</div>
                        </div>

                        {/* Células dos Dias */}
                        <div className="grid grid-cols-7 bg-blue-300/40 gap-[1px]">
                            {getGridWeeks().map((cell, index) => {
                                const isSunday = index % 7 === 6;
                                const isFirstDay = cell.dayNum === 1;
                                const dateStr = cell.dayNum
                                    ? `${year}-${String(monthNum).padStart(2, '0')}-${String(cell.dayNum).padStart(2, '0')}`
                                    : '';

                                const safeEscalas = Array.isArray(escalas) ? escalas : [];
                                const safePersonnel = Array.isArray(personnelList) ? personnelList : [];
                                const safeVacations = Array.isArray(vacations) ? vacations : [];

                                // Buscar dados da escala do dia
                                const dayEscala = cell.dayNum ? safeEscalas.find(e => e && e.data === dateStr) : null;
                                const teamLetter = dayEscala ? getTurmaLetter(dayEscala.turma, dayEscala.equipe) : null;
                                const teamInfo = teamLetter ? CORES[teamLetter] : null;

                                // Buscar bombeiros escalados no dia (excluindo os que estiverem em férias/afastamento na data)
                                const escaladosBrutos = (dayEscala?.militares && Array.isArray(dayEscala.militares))
                                    ? dayEscala.militares
                                        .filter(id => {
                                            const emAfastamento = safeVacations.some(v =>
                                                v && v.personnel_id === id &&
                                                v.start_date && v.end_date &&
                                                dateStr >= v.start_date &&
                                                dateStr <= v.end_date
                                            );
                                            return !emAfastamento;
                                        })
                                        .map(id => safePersonnel.find(p => p && p.id === id))
                                        .filter(Boolean) as Personnel[]
                                    : [];

                                // Ordenar: militares primeiro por graduação militar, depois BCs por grau comunitário
                                const escaladosNoDia = sortEscaladosPorGraduacao(escaladosBrutos);

                                return (
                                    <div
                                        key={index}
                                        onClick={() => cell.dayNum && onDayClick?.(dateStr, escaladosNoDia[0]?.id || 0)}
                                        className={`min-h-[105px] md:min-h-[125px] p-1.5 flex flex-col justify-start transition-all relative ${
                                            cell.inMonth
                                                ? 'bg-white hover:bg-blue-50/50 cursor-pointer'
                                                : 'bg-slate-50/70'
                                        }`}
                                    >
                                        {cell.dayNum && (
                                            <>
                                                {/* Número do Dia */}
                                                <div className="flex items-center justify-between w-full mb-1">
                                                    <span className={`text-sm md:text-base font-extrabold ${
                                                        isFirstDay || isSunday ? 'text-red-600' : 'text-stone-900'
                                                    }`}>
                                                        {cell.dayNum}
                                                    </span>

                                                    {teamLetter && teamInfo && (
                                                        <span
                                                            className="text-[9px] font-black px-1.5 py-0.5 rounded border shadow-2xs"
                                                            style={{
                                                                backgroundColor: teamInfo.pillBg,
                                                                color: teamInfo.hex,
                                                                borderColor: teamInfo.borderHex
                                                            }}
                                                        >
                                                            Gua {teamLetter}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Militares Escalados no Dia */}
                                                <div className="space-y-1 overflow-y-auto max-h-[85px] scrollbar-thin">
                                                    {escaladosNoDia.slice(0, 4).map((p, idx) => {
                                                        const isBC = p?.type === 'BC' || (p?.graduation && p.graduation.toLowerCase().includes('bc')) || (p?.rank && p.rank.toLowerCase().includes('bc'));
                                                        const warName = p?.war_name || p?.name.split(' ')[0];
                                                        const bcTurno = (isBC && p?.id) ? findBcTurno(dateStr, p.id) : null;
                                                        const isCond = isBC && isBcCondutorHabilitado(p);
                                                        const gradMilitar = !isBC ? getMilitarGraduation(p) : '';
                                                        const altInfo = p?.id ? getPersonnelAlteracao(dateStr, p.id) : { tipo: null };

                                                        // Definir estilos de acordo com a modalidade de alteração daquele militar
                                                        // Sem alteração: segue padrão BC (laranja claro) ou BM (cinza pedra)
                                                        let containerCls = 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200/80';
                                                        if (altInfo.badgeStyle) {
                                                            containerCls = altInfo.badgeStyle;
                                                        } else if (isBC) {
                                                            containerCls = 'bg-orange-50/70 text-orange-950 border-orange-200 hover:bg-orange-100/70';
                                                        }

                                                        const tooltipTitle = altInfo.descricao
                                                            ? `[Alteração de Escala] ${altInfo.descricao} • ${p?.name}`
                                                            : isBC
                                                            ? `Bombeiro Comunitário: ${p?.name}${isCond ? ` (CONDUTOR DE EMERGÊNCIA - CNH ${p?.cnh_category || p?.cnh || ''} / CVE Ativo)` : ''} ${bcTurno ? `• Turno: ${bcTurno.label} (${bcTurno.horarios})` : ''}`
                                                            : `${gradMilitar} ${p?.name}`;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate border flex items-center justify-between gap-1 transition-colors ${containerCls}`}
                                                                title={tooltipTitle}
                                                            >
                                                                <span className="truncate flex items-center gap-1 min-w-0">
                                                                    {isBC ? (
                                                                        <span className="truncate flex items-center">
                                                                            <strong className="text-orange-950 shrink-0 mr-1">BC</strong>
                                                                            <span className="truncate">{warName}</span>
                                                                            {isCond && (
                                                                                <span className="ml-1 text-[8.5px] font-black uppercase px-1 py-0.2 rounded bg-amber-500 text-white shadow-2xs border border-amber-600 shrink-0 tracking-wide">
                                                                                    COND.
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    ) : (
                                                                        <>
                                                                            {gradMilitar && (
                                                                                <strong className="text-stone-900 shrink-0">{gradMilitar}</strong>
                                                                            )}
                                                                            <span className="truncate">{warName}</span>
                                                                        </>
                                                                    )}
                                                                </span>

                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {isBC && bcTurno && (
                                                                        <span
                                                                            className={`text-[8px] font-black uppercase px-1 py-0.2 rounded border ${bcTurno.badgeCls}`}
                                                                            title={`Turno escolhido: ${bcTurno.horarios}`}
                                                                        >
                                                                            {bcTurno.shortLabel}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {escaladosNoDia.length > 4 && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDayDetails({
                                                                    dateStr,
                                                                    dayNum: cell.dayNum!,
                                                                    teamLetter,
                                                                    escalados: escaladosNoDia,
                                                                    dayEscala
                                                                });
                                                            }}
                                                            className="w-full text-[9px] font-black text-blue-700 hover:text-blue-900 text-center bg-blue-50 hover:bg-blue-100/90 py-0.5 rounded border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                                                            title="Clique para ver todos os escalados do dia"
                                                        >
                                                            +{escaladosNoDia.length - 4} escalados (ver todos)
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rodapé e Legenda */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-3 border-t border-stone-200 text-xs text-stone-500 font-medium">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Guarnições */}
                            <div className="flex flex-wrap items-center gap-3">
                                {Object.entries(CORES).map(([letra, cor]) => (
                                    <div key={letra} className="flex items-center gap-1.5 font-bold">
                                        <span className="w-3 h-3 rounded border shadow-2xs" style={{ backgroundColor: cor.pillBg, borderColor: cor.borderHex }}></span>
                                        Guarnição {letra}
                                    </div>
                                ))}
                            </div>

                            <span className="hidden md:inline text-stone-300">|</span>

                            {/* Legenda de Alterações de Escala */}
                            <div className="flex flex-wrap items-center gap-3 text-[11px]">
                                <span className="font-extrabold text-stone-700">Alterações:</span>
                                <div className="flex items-center gap-1.5 font-bold text-sky-950">
                                    <span className="w-3 h-3 rounded bg-sky-200 border border-sky-400 shadow-2xs"></span>
                                    Troca Mútua (Azul Céu)
                                </div>
                                <div className="flex items-center gap-1.5 font-bold text-teal-950">
                                    <span className="w-3 h-3 rounded bg-teal-200 border border-teal-400 shadow-2xs"></span>
                                    Troca Individual (Verde Água)
                                </div>
                                <div className="flex items-center gap-1.5 font-bold text-orange-950">
                                    <span className="w-3 h-3 rounded bg-orange-300 border border-orange-500 shadow-2xs"></span>
                                    Transf. Guarnição (Laranja Cenoura)
                                </div>
                                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                    <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-500 text-white border border-amber-600 shadow-2xs">COND.</span>
                                    Condutor de Emergência (BC)
                                </div>
                            </div>
                        </div>

                        <div className="text-[10px] text-stone-400 font-mono shrink-0">
                            CBMSC — 3º/7ºBBM (Araquari)
                        </div>
                    </div>
                </div>
            )}

            {/* VISÃO MATRIZ TRADICIONAL POR MILITAR */}
            {viewMode === 'matrix' && (
                <div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[10px] border-collapse">
                            <thead>
                                <tr className="bg-stone-50 border-b border-stone-200">
                                    <th className="p-3 text-left border-r border-stone-200 min-w-[150px] sticky left-0 bg-stone-50 z-10 font-black uppercase text-stone-500">Militar</th>
                                    {days.map(d => (
                                        <th key={d} className="p-2 text-center border-r border-stone-100 min-w-[40px] font-black text-stone-400">
                                            {d}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {personnelList
                                    .filter(p => p.status === 'Ativo')
                                    .map(person => (
                                        <tr key={person.id} className="hover:bg-stone-50/50">
                                            <td className="p-3 border-r border-stone-200 sticky left-0 bg-white z-10 font-bold shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                {formatPersonnelName(person)}
                                            </td>
                                            {days.map(d => {
                                                const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const status = getStatusForDay(d, person.id!);
                                                return (
                                                    <td
                                                        key={d}
                                                        className="p-1 border-r border-stone-50 h-10 text-center cursor-pointer hover:bg-stone-50 transition-colors"
                                                        onClick={() => onDayClick?.(dateStr, person.id!)}
                                                    >
                                                        {status && (
                                                            <div
                                                                className={`w-full h-full flex items-center justify-center rounded-lg ${status.cls}`}
                                                                style={status.style}
                                                                title={status.tooltip}
                                                            >
                                                                {status.label === 'Férias' ? (
                                                                    <span className="uppercase font-black text-[7px]">{status.label}</span>
                                                                ) : (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-sm">{status.label}</span>
                                                                        {status.warning && (
                                                                            <span
                                                                                className="material-symbols-outlined text-[12px] text-amber-500 animate-pulse"
                                                                                title={status.warning.message}
                                                                            >
                                                                                warning
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap gap-4 text-[10px] font-bold uppercase text-stone-500">
                        {Object.entries(CORES).map(([letra, cor]) => (
                            <div key={letra} className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: hexToRgba(cor.hex, 0.2), borderColor: cor.hex }}></span> 
                                Guarnição {letra}
                            </div>
                        ))}
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-100 border border-stone-200"></span> Folga</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200"></span> Férias/Licença</div>
                    </div>
                </div>
            )}

            {/* MODAL DETALHADO: GUARNICAO COMPLETA DO DIA */}
            {selectedDayDetails && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
                    onClick={() => setSelectedDayDetails(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden text-stone-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal */}
                        <div className="bg-[#1e40af] text-white p-4 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-200">Guarnição de Serviço</span>
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    <span>Dia {String(selectedDayDetails.dayNum).padStart(2, '0')}/{String(monthNum).padStart(2, '0')}/{year}</span>
                                    {selectedDayDetails.teamLetter && (
                                        <span className="text-xs bg-white text-[#1e40af] font-black px-2 py-0.5 rounded-full shadow-xs">
                                            Guarnição {selectedDayDetails.teamLetter}
                                        </span>
                                    )}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDayDetails(null)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        {/* Conteúdo */}
                        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
                            {selectedDayDetails.dayEscala?.manual_override && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                                    <div className="font-bold flex items-center gap-1.5 mb-1">
                                        <span className="material-symbols-outlined text-sm text-amber-600">published_with_changes</span>
                                        Alteração / Troca registrada nesta escala
                                    </div>
                                    <p className="text-stone-700">{selectedDayDetails.dayEscala.override_reason || 'Alteração manual efetuada.'}</p>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                                        Total Escalados ({selectedDayDetails.escalados.length})
                                    </span>
                                </div>

                                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden bg-stone-50/50">
                                    {selectedDayDetails.escalados.map((p, idx) => {
                                        const isBC = p.type === 'BC' || (p.graduation && p.graduation.toLowerCase().includes('bc')) || (p.rank && p.rank.toLowerCase().includes('bc'));
                                        const warName = p.war_name || p.name.split(' ')[0];
                                        const bcTurno = (isBC && p.id) ? findBcTurno(selectedDayDetails.dateStr, p.id) : null;
                                        const isCond = isBC && isBcCondutorHabilitado(p);
                                        const gradMilitar = !isBC ? getMilitarGraduation(p) : '';
                                        const altInfo = p.id ? getPersonnelAlteracao(selectedDayDetails.dateStr, p.id) : { tipo: null };

                                        return (
                                            <div key={idx} className={`p-3 flex items-center justify-between transition-colors ${altInfo.badgeStyle ? altInfo.badgeStyle : 'bg-white hover:bg-blue-50/40'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                        isBC ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <div className="font-black text-sm text-stone-900 flex items-center gap-1.5 flex-wrap">
                                                            {isBC ? (
                                                                <>
                                                                    <span className="text-[10px] font-black text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200">
                                                                        BC
                                                                    </span>
                                                                    <span>{warName}</span>
                                                                    {isCond && (
                                                                        <span className="text-[10px] font-black uppercase text-white bg-amber-500 px-2 py-0.5 rounded shadow-2xs border border-amber-600 tracking-wider">
                                                                            COND.
                                                                        </span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {gradMilitar && (
                                                                        <span className="text-xs font-extrabold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                                            {gradMilitar}
                                                                        </span>
                                                                    )}
                                                                    <span>{warName}</span>
                                                                </>
                                                            )}
                                                            {isBC && bcTurno && (
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${bcTurno.badgeCls}`}>
                                                                    {bcTurno.label} ({bcTurno.horarios})
                                                                </span>
                                                            )}
                                                            {altInfo.descricao && (
                                                                <span className="text-[10px] font-semibold text-stone-600 ml-1">
                                                                    ({altInfo.descricao})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-stone-500 mt-0.5">
                                                            {p.name} {p.role ? `• ${p.role}` : ''}
                                                            {isBC && (p.cnh_category || p.cnh) && (
                                                                <span className="ml-1 text-stone-400">
                                                                    • CNH {p.cnh_category || p.cnh} (CVE: {p.cve_active || 'Não'})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {onDayClick && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedDayDetails(null);
                                                            onDayClick(selectedDayDetails.dateStr, p.id || 0);
                                                        }}
                                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors"
                                                    >
                                                        Ajustar
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-3 bg-stone-50 border-t border-stone-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedDayDetails(null)}
                                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScaleCalendar;

