import { useMemo } from 'react';
import { Personnel, Vacation, Escala } from '../../services/types';

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
    escalas: Escala[];
}

type AvailabilityStatus = 'disponível' | 'de_serviço' | 'férias' | 'afastado';

interface PersonStatus {
    person: Personnel;
    status: AvailabilityStatus;
    detail: string;
}

const statusConfig: Record<AvailabilityStatus, { label: string; color: string; dot: string; icon: string }> = {
    'disponível': { label: 'Disponível', color: 'text-emerald-400', dot: 'bg-emerald-400', icon: 'check_circle' },
    'de_serviço': { label: 'De Serviço', color: 'text-amber-400', dot: 'bg-amber-400 animate-pulse', icon: 'emergency' },
    'férias': { label: 'Férias', color: 'text-blue-400', dot: 'bg-blue-400', icon: 'beach_access' },
    'afastado': { label: 'Afastado', color: 'text-gray-500', dot: 'bg-gray-500', icon: 'person_off' },
};

export default function DisponibilidadeB1({ personnelList, vacations, escalas }: Props) {
    const today = new Date().toISOString().split('T')[0];

    const todayEscalaIds: Set<number> = useMemo(() => {
        const esc = escalas.find(e => e.data === today);
        return new Set(esc?.militares || []);
    }, [escalas, today]);

    const onVacationIds: Set<number> = useMemo(() => {
        return new Set(
            vacations
                .filter(v => {
                    if (v.status === 'cancelado') return false;
                    const start = v.start_date;
                    const end = v.end_date;
                    return start <= today && today <= end;
                })
                .map(v => v.personnel_id)
        );
    }, [vacations, today]);

    const statusList: PersonStatus[] = useMemo(() => {
        return personnelList.map(p => {
            if (p.status === 'Afastado' || p.status === 'Licença') {
                return { person: p, status: 'afastado', detail: p.status };
            }
            if (onVacationIds.has(p.id!)) {
                const v = vacations.find(v2 => v2.personnel_id === p.id && v2.start_date <= today && today <= v2.end_date);
                return { person: p, status: 'férias', detail: `Retorno: ${v ? new Date(v.end_date).toLocaleDateString('pt-BR') : '—'}` };
            }
            if (todayEscalaIds.has(p.id!)) {
                return { person: p, status: 'de_serviço', detail: 'Plantão hoje' };
            }
            return { person: p, status: 'disponível', detail: 'Expediente / folga' };
        });
    }, [personnelList, onVacationIds, todayEscalaIds, today]);

    const grouped = useMemo(() => {
        const g: Record<AvailabilityStatus, PersonStatus[]> = {
            'de_serviço': [],
            'disponível': [],
            'férias': [],
            'afastado': [],
        };
        for (const s of statusList) g[s.status].push(s);
        return g;
    }, [statusList]);

    const summary = {
        total: personnelList.length,
        deServico: grouped['de_serviço'].length,
        disponiveis: grouped['disponível'].length,
        ferias: grouped['férias'].length,
        afastados: grouped['afastado'].length,
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h3 className="text-base font-semibold text-primary-text">Mapa de Disponibilidade</h3>
                <p className="text-xs text-secondary-text mt-0.5">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'De Serviço', value: summary.deServico, color: 'border-amber-500/30 bg-amber-500/5', textColor: 'text-amber-400' },
                    { label: 'Disponíveis', value: summary.disponiveis, color: 'border-emerald-500/30 bg-emerald-500/5', textColor: 'text-emerald-400' },
                    { label: 'Em Férias', value: summary.ferias, color: 'border-blue-500/30 bg-blue-500/5', textColor: 'text-blue-400' },
                    { label: 'Afastados', value: summary.afastados, color: 'border-gray-400/30 bg-gray-400/10', textColor: 'text-gray-500' },
                ].map(kpi => (
                    <div key={kpi.label} className={`bg-primary border rounded-xl p-3 ${kpi.color}`}>
                        <p className={`text-2xl font-bold ${kpi.textColor}`}>{kpi.value}</p>
                        <p className="text-xs text-secondary-text mt-0.5">{kpi.label}</p>
                        <p className="text-xs text-secondary-text/60">{summary.total > 0 ? Math.round(kpi.value / summary.total * 100) : 0}% do efetivo</p>
                    </div>
                ))}
            </div>

            {/* Status breakdown */}
            {(['de_serviço', 'disponível', 'férias', 'afastado'] as AvailabilityStatus[]).map(status => {
                const items = grouped[status];
                if (items.length === 0) return null;
                const cfg = statusConfig[status];
                return (
                    <div key={status}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-xs text-secondary-text">({items.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {items.map(({ person, detail }) => (
                                <div key={person.id} className="bg-primary border border-rustic-border rounded-xl p-2.5 flex items-center gap-2.5">
                                    {person.image ? (
                                        <img src={person.image} alt={person.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-base text-secondary-text">person</span>
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-primary-text truncate">{person.war_name || person.name}</p>
                                        <p className="text-xs text-secondary-text truncate">{person.rank} · {detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
