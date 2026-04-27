import { Escala, ScaleRotationConfig, ServiceSwap, ScaleException } from './types';

export class RotationEngine {
    /**
     * Calcula qual turma está de serviço em uma data específica.
     * Baseado em um ciclo de 4 turmas (A, B, C, D) em regime 24x72.
     */
    static getTeamForDate(date: Date, config: ScaleRotationConfig): number {
        const anchor = new Date(config.anchorDate);
        anchor.setHours(0, 0, 0, 0);

        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        // Diferença em dias
        const diffTime = target.getTime() - anchor.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // Ciclo de 4 dias (A trabalha dia 0, B dia 1, C dia 2, D dia 3)
        // O operador % pode retornar negativo em JS para números negativos, por isso ( (n % 4) + 4) % 4
        const cycleIndex = ((diffDays % 4) + 4) % 4;

        return cycleIndex;
    }

    /**
     * Gera a escala projetada para um intervalo de datas.
     */
    static generateRotation(startDate: string, endDate: string, config: ScaleRotationConfig): Escala[] {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const results: Escala[] = [];

        const current = new Date(start);
        while (current <= end) {
            const teamIdx = this.getTeamForDate(current, config);
            const team = config.teams[teamIdx];

            if (team) {
                const dateStr = current.toISOString().split('T')[0];
                results.push({
                    data: dateStr,
                    equipe: team.name,
                    militares: team.personnelIds,
                    turma: team.name,
                    color: team.color,
                    shift_type: '24x72',
                    start_time: config.shiftStartTime || '07:30',
                    end_time: config.shiftStartTime || '07:30' // Próximo dia mesmo horário
                });
            }

            current.setDate(current.getDate() + 1);
        }

        return results;
    }

    /**
     * Aplica exceções (trocas, adições, remoções) sobre a rotação base.
     */
    static applyExceptions(
        baseEscala: Escala[],
        swaps: ServiceSwap[],
        exceptions: ScaleException[]
    ): Escala[] {
        let result = JSON.parse(JSON.stringify(baseEscala)) as Escala[];

        // 1. Aplicar Remoções Manuais
        exceptions.filter(ex => ex.type === 'REMOVE').forEach(ex => {
            const day = result.find(e => e.data === ex.date);
            if (day) {
                day.militares = (day.militares || []).filter(id => Number(id) !== Number(ex.personnel_id));
                day.manual_override = true;
                day.override_reason = ex.reason;
            }
        });

        // 2. Aplicar Adições Manuais
        exceptions.filter(ex => ex.type === 'ADD').forEach(ex => {
            let day = result.find(e => e.data === ex.date);
            if (day) {
                if (!day.militares.includes(Number(ex.personnel_id))) {
                    day.militares.push(Number(ex.personnel_id));
                    day.manual_override = true;
                    day.override_reason = ex.reason;
                }
            } else {
                // Se não existir o dia na rotação base (ex: escala administrativa ou dia extra)
                result.push({
                    data: ex.date,
                    equipe: 'Extra',
                    militares: [Number(ex.personnel_id)],
                    manual_override: true,
                    override_reason: ex.reason,
                    shift_type: '24x72'
                });
            }
        });

        // 3. Aplicar Trocas (ServiceSwaps)
        swaps.forEach(swap => {
            if (swap.approval_status && swap.approval_status !== 'Aprovado') return;

            // Militar A dá para B na data A
            if (swap.date_a_gives_to_b) {
                const dayA = result.find(e => e.data === swap.date_a_gives_to_b);
                if (dayA) {
                    dayA.militares = dayA.militares.filter(id => Number(id) !== Number(swap.personnel_id));
                    if (swap.swap_with_personnel_id && !dayA.militares.includes(Number(swap.swap_with_personnel_id))) {
                        dayA.militares.push(Number(swap.swap_with_personnel_id));
                    }
                    dayA.manual_override = true;
                    dayA.override_reason = `Troca: ${swap.reason}`;
                }
            }

            // Militar B dá para A na data B
            if (swap.date_b_gives_to_a) {
                const dayB = result.find(e => e.data === swap.date_b_gives_to_a);
                if (dayB) {
                    dayB.militares = dayB.militares.filter(id => Number(id) !== Number(swap.swap_with_personnel_id));
                    if (!dayB.militares.includes(Number(swap.personnel_id))) {
                        dayB.militares.push(Number(swap.personnel_id));
                    }
                    dayB.manual_override = true;
                    dayB.override_reason = `Troca: ${swap.reason}`;
                }
            }
        });

        return result.sort((a, b) => a.data.localeCompare(b.data));
    }

    /**
     * Valida a escala contra conflitos de férias e documentos vencidos.
     */
    static validateScale(
        escala: Escala[],
        vacations: any[],
        personnel: any[]
    ): Escala[] {
        const personnelMap = new Map(personnel.map(p => [p.id, p]));

        return escala.map(day => {
            const warnings: any[] = [];

            day.militares?.forEach(personId => {
                const person = personnelMap.get(personId);
                if (!person) return;

                // 1. Verificar Férias/Afastamento
                const isVacation = vacations.some(v =>
                    v.personnel_id === personId &&
                    day.data >= v.start_date &&
                    day.data <= v.end_date
                );

                if (isVacation) {
                    warnings.push({
                        personnel_id: personId,
                        type: 'VACATION',
                        message: `${person.war_name || person.name} está em período de férias/licença nesta data.`,
                        severity: 'critical'
                    });
                }

                // 2. Verificar Documentos Vencidos
                const checkExpiry = (expiryDate: string | undefined, docName: string) => {
                    if (expiryDate && new Date(expiryDate) <= new Date(day.data)) {
                        warnings.push({
                            personnel_id: personId,
                            type: 'DOCUMENT_EXPIRED',
                            message: `${docName} de ${person.war_name || person.name} vencido nesta data.`,
                            severity: 'warning'
                        });
                    }
                };

                checkExpiry(person.cve_expiry_date, 'CVE');
                checkExpiry(person.cnh_expiry_date, 'CNH');
                checkExpiry(person.toxicological_expiry_date, 'Toxicológico');
            });

            return { ...day, warnings: warnings.length > 0 ? warnings : undefined };
        });
    }
}
