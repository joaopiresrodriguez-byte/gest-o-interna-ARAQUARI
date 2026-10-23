import { supabase } from './supabase';
import { ScaleException, ScaleAudit } from './types';

export const ScaleAdjustmentService = {
    getExceptions: async (month?: string): Promise<ScaleException[]> => {
        let query = supabase.from('scale_exceptions').select('*');
        if (month) {
            const startDate = `${month}-01`;
            const [year, m] = month.split('-').map(Number);
            const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(year, m, 0).getDate()}`;
            query = query.gte('date', startDate).lte('date', endDate);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    addException: async (exception: Omit<ScaleException, 'id' | 'created_at'>): Promise<ScaleException> => {
        const { data, error } = await supabase
            .from('scale_exceptions')
            .insert(exception)
            .select()
            .single();
        if (error) throw error;

        // Atualizar também a tabela de escalas publicada para que o movimento reflita no calendário
        const { data: esc } = await supabase.from('escalas').select('*').eq('data', exception.date).maybeSingle();
        if (esc) {
            let mils: number[] = Array.isArray(esc.militares) ? esc.militares.map(Number) : [];
            if (exception.type === 'ADD') {
                if (!mils.includes(Number(exception.personnel_id))) {
                    mils.push(Number(exception.personnel_id));
                }
            } else if (exception.type === 'REMOVE') {
                mils = mils.filter(id => id !== Number(exception.personnel_id));
            }
            await supabase.from('escalas').update({
                militares: mils,
                manual_override: true,
                override_reason: exception.reason,
                updated_at: new Date().toISOString()
            }).eq('id', esc.id);
        }

        // Log audit
        await ScaleAdjustmentService.logAudit({
            action_type: exception.type === 'ADD' ? 'Adição Manual' : 'Remoção Manual',
            scale_date: exception.date,
            personnel_id: exception.personnel_id,
            personnel_name: 'Militar', // Ideally pass name from UI
            reason: exception.reason,
            performed_by: exception.performed_by
        });

        return data;
    },

    removeException: async (id: string): Promise<boolean> => {
        const { error } = await supabase
            .from('scale_exceptions')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    logAudit: async (log: Omit<ScaleAudit, 'id' | 'performed_at'>): Promise<void> => {
        await supabase.from('scale_audit_log').insert(log);
    },

    getAuditLogs: async (month?: string): Promise<ScaleAudit[]> => {
        let query = supabase.from('scale_audit_log').select('*').order('performed_at', { ascending: false });
        if (month) {
            const startDate = `${month}-01`;
            const [year, m] = month.split('-').map(Number);
            const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(year, m, 0).getDate()}`;
            query = query.gte('scale_date', startDate).lte('scale_date', endDate);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    // ─── BLOCO 3: 3 MODALIDADES DE ALTERAÇÃO DE ESCALA ─────────────────────────

    /**
     * MODALIDADE 1 — TROCA DE SERVIÇO ENTRE DOIS MILITARES
     * Troca os dias de serviço entre Militar A (dia A) e Militar B (dia B)
     */
    registrarTrocaMutua: async (params: {
        militarAId: number;
        diaA: string;
        militarBId: number;
        diaB: string;
        usuario: string;
        detalhes?: string;
    }) => {
        const { militarAId, diaA, militarBId, diaB, usuario, detalhes } = params;

        // 1. Buscar escalas dos dois dias
        const { data: escA } = await supabase.from('escalas').select('*').eq('data', diaA).single();
        const { data: escB } = await supabase.from('escalas').select('*').eq('data', diaB).single();

        if (escA && escB) {
            // Substituir Militar A por B no Dia A e vice-versa no Dia B
            const milsA = (escA.militares || []).map((id: number) => id === militarAId ? militarBId : id);
            const milsB = (escB.militares || []).map((id: number) => id === militarBId ? militarAId : id);

            await supabase.from('escalas').update({ militares: milsA, updated_at: new Date().toISOString() }).eq('id', escA.id);
            await supabase.from('escalas').update({ militares: milsB, updated_at: new Date().toISOString() }).eq('id', escB.id);
        }

        // 2. Registrar no Histórico escala_alteracoes / service_swaps
        const record = {
            tipo_alteracao: 'troca_militares',
            militar_a_id: militarAId,
            militar_b_id: militarBId,
            dia_original_a: diaA,
            dia_original_b: diaB,
            detalhes: detalhes || `Troca mútua de serviço: Militar #${militarAId} (Dia ${diaA}) por Militar #${militarBId} (Dia ${diaB})`,
            criado_por: usuario,
            criado_em: new Date().toISOString()
        };

        const { error } = await supabase.from('escala_alteracoes').insert(record);
        if (error) {
            console.warn('[ScaleAdjustmentService] Tabela escala_alteracoes indisponível, registrando fallback via audit log:', error.message);
            await ScaleAdjustmentService.logAudit({
                action_type: 'Troca Mútua',
                scale_date: diaA,
                personnel_id: militarAId,
                personnel_name: `Militar ${militarAId} <-> ${militarBId}`,
                reason: record.detalhes,
                performed_by: usuario
            });
        }
        return true;
    },

    /**
     * MODALIDADE 2 — TROCA INDIVIDUAL DE DIA DE SERVIÇO
     * Move um militar do dia de saída para o dia de entrada
     */
    registrarTrocaIndividual: async (params: {
        militarId: number;
        diaSaida: string;
        diaEntrada: string;
        militarSubstitudoId?: number;
        usuario: string;
        detalhes?: string;
    }) => {
        const { militarId, diaSaida, diaEntrada, militarSubstitudoId, usuario, detalhes } = params;

        // 1. Remover militar do dia de saída
        if (diaSaida) {
            const { data: escSaida } = await supabase.from('escalas').select('*').eq('data', diaSaida).single();
            if (escSaida) {
                const mils = (escSaida.militares || []).filter((id: number) => id !== militarId);
                await supabase.from('escalas').update({ militares: mils, updated_at: new Date().toISOString() }).eq('id', escSaida.id);
            }
        }

        // 2. Adicionar militar no dia de entrada (substituindo se informado)
        if (diaEntrada) {
            const { data: escEntrada } = await supabase.from('escalas').select('*').eq('data', diaEntrada).single();
            if (escEntrada) {
                let mils = escEntrada.militares || [];
                if (militarSubstitudoId) {
                    mils = mils.map((id: number) => id === militarSubstitudoId ? militarId : id);
                } else if (!mils.includes(militarId)) {
                    mils.push(militarId);
                }
                await supabase.from('escalas').update({ militares: mils, updated_at: new Date().toISOString() }).eq('id', escEntrada.id);
            }
        }

        // 3. Registrar no Histórico escala_alteracoes
        const record = {
            tipo_alteracao: 'troca_individual',
            militar_a_id: militarId,
            militar_b_id: militarSubstitudoId || null,
            dia_original_a: diaSaida,
            dia_original_b: diaEntrada,
            detalhes: detalhes || `Troca individual: Militar #${militarId} saiu do dia ${diaSaida} e entrou no dia ${diaEntrada}`,
            criado_por: usuario,
            criado_em: new Date().toISOString()
        };

        const { error } = await supabase.from('escala_alteracoes').insert(record);
        if (error) {
            await ScaleAdjustmentService.logAudit({
                action_type: 'Troca Individual',
                scale_date: diaEntrada || diaSaida,
                personnel_id: militarId,
                personnel_name: `Militar #${militarId}`,
                reason: record.detalhes,
                performed_by: usuario
            });
        }
        return true;
    },

    /**
     * MODALIDADE 3 — TRANSFERÊNCIA DE GUARNIÇÃO DO MILITAR
     * Transfere permanentemente o militar para nova guarnição a partir da data de vigência
     */
    registrarTransferenciaGuarnicao: async (params: {
        militarId: number;
        guarnicaoOrigemId?: string;
        guarnicaoDestinoId: string;
        dataVigencia: string;
        usuario: string;
        detalhes?: string;
    }) => {
        const { militarId, guarnicaoOrigemId, guarnicaoDestinoId, dataVigencia, usuario, detalhes } = params;

        // 1. Atualizar vinculo na tabela guarnicao_membros
        if (guarnicaoOrigemId) {
            await supabase.from('guarnicao_membros').delete().eq('militar_id', militarId).eq('guarnicao_id', guarnicaoOrigemId);
        } else {
            await supabase.from('guarnicao_membros').delete().eq('militar_id', militarId);
        }

        await supabase.from('guarnicao_membros').insert({
            guarnicao_id: guarnicaoDestinoId,
            militar_id: militarId,
            created_at: new Date().toISOString()
        });

        // Buscar dados da guarnição destino para saber o código/letra (A, B, C ou D)
        const { data: gData } = await supabase.from('guarnicoes').select('*').eq('id', guarnicaoDestinoId).maybeSingle();
        const nomeDestino = gData?.nome || guarnicaoDestinoId;

        const mapNomeToCodigo = (nome: string): string => {
            const normalizado = nome.trim().toUpperCase();
            if (normalizado.includes('ALPHA')   || normalizado.includes('AZUL'))     return 'A';
            if (normalizado.includes('BRAVO')   || normalizado.includes('VERMELH'))  return 'B';
            if (normalizado.includes('CHARLIE') || normalizado.includes('AMAREL'))   return 'C';
            if (normalizado.includes('DELTA')   || normalizado.includes('BRANC'))    return 'D';
            const ultimaPalavra = normalizado.split(/\s+/).pop() || '';
            if (['A', 'B', 'C', 'D'].includes(ultimaPalavra)) return ultimaPalavra;
            const ultimoChar = normalizado.slice(-1);
            if (['A', 'B', 'C', 'D'].includes(ultimoChar)) return ultimoChar;
            return 'A';
        };

        const codigoDestino = mapNomeToCodigo(nomeDestino);

        // 2. Projetar a transferência nas escalas publicadas já existentes a partir da dataVigencia
        const { data: escalasPublicadas } = await supabase
            .from('escalas')
            .select('*')
            .gte('data', dataVigencia);

        if (escalasPublicadas && escalasPublicadas.length > 0) {
            for (const esc of escalasPublicadas) {
                const codigoDia = mapNomeToCodigo(esc.turma || esc.equipe || '');
                let mils: number[] = Array.isArray(esc.militares) ? esc.militares.map(Number) : [];
                let alterado = false;

                if (codigoDia === codigoDestino) {
                    // Militar deve estar de serviço neste dia (se pertencer à guarnição destino)
                    if (!mils.includes(militarId)) {
                        mils.push(militarId);
                        alterado = true;
                    }
                } else {
                    // Militar sai de serviço neste dia (pertencia a outra guarnição)
                    if (mils.includes(militarId)) {
                        mils = mils.filter(id => id !== militarId);
                        alterado = true;
                    }
                }

                if (alterado) {
                    await supabase.from('escalas').update({
                        militares: mils,
                        manual_override: true,
                        override_reason: `Transferência para Guarnição ${codigoDestino} a partir de ${dataVigencia}`,
                        updated_at: new Date().toISOString()
                    }).eq('id', esc.id);
                }
            }
        }

        // 3. Registrar no Histórico escala_alteracoes
        const record = {
            tipo_alteracao: 'transferencia_guarnicao',
            militar_a_id: militarId,
            guarnicao_origem_id: guarnicaoOrigemId || null,
            guarnicao_destino_id: guarnicaoDestinoId,
            data_vigencia: dataVigencia,
            detalhes: detalhes || `Transferência de guarnição do Militar #${militarId} para Guarnição ${nomeDestino} a partir de ${dataVigencia}`,
            criado_por: usuario,
            criado_em: new Date().toISOString()
        };

        const { error } = await supabase.from('escala_alteracoes').insert(record);
        if (error) {
            await ScaleAdjustmentService.logAudit({
                action_type: 'Transferência Guarnição',
                scale_date: dataVigencia,
                personnel_id: militarId,
                personnel_name: `Militar #${militarId}`,
                reason: record.detalhes,
                performed_by: usuario
            });
        }
        return true;
    },

    /**
     * MODALIDADE 4 — EXCLUSÃO DEFINITIVA / DESLIGAMENTO DA ESCALA
     * Remove o militar da escala e da sua guarnição a partir de uma data específica (ex: transferência para outra unidade),
     * preservando 100% dos serviços anteriores e cancelando apenas férias/afastamentos futuros após a data de corte.
     */
    registrarDesligamentoEscala: async (params: {
        militarId: number;
        dataCorte: string;
        motivo: string;
        novoStatus?: 'Cedido' | 'Afastado' | 'Licença' | 'Ativo';
        usuario: string;
    }): Promise<{ totalEscalasRemovidas: number; totalFeriasCanceladas: number }> => {
        const { militarId, dataCorte, motivo, novoStatus = 'Cedido', usuario } = params;

        // 1. Remover militar da tabela guarnicao_membros (para não entrar mais em publicações de escalas)
        await supabase.from('guarnicao_membros').delete().eq('militar_id', militarId);

        // 2. Atualizar status do militar na tabela personnel
        await supabase.from('personnel').update({
            status: novoStatus,
        }).eq('id', militarId);

        // 3. Remover militar de todas as escalas publicadas a partir da data de corte (>= dataCorte)
        const { data: escalasFuturas } = await supabase
            .from('escalas')
            .select('*')
            .gte('data', dataCorte);

        let totalEscalasRemovidas = 0;
        if (escalasFuturas && escalasFuturas.length > 0) {
            for (const esc of escalasFuturas) {
                const mils: number[] = Array.isArray(esc.militares) ? esc.militares.map(Number) : [];
                if (mils.includes(militarId)) {
                    const novosMils = mils.filter(id => id !== militarId);
                    await supabase.from('escalas').update({
                        militares: novosMils,
                        manual_override: true,
                        override_reason: `Desligamento/Transferência a partir de ${dataCorte}: ${motivo}`,
                        updated_at: new Date().toISOString()
                    }).eq('id', esc.id);
                    totalEscalasRemovidas++;
                }
            }
        }

        // 4. Cancelar períodos de férias/afastamentos futuros que começam ou terminam a partir da data de corte
        // Mantém os registros no banco para histórico, marcando status = 'cancelado' e anotando o motivo da transferência
        const { data: feriasFuturas } = await supabase
            .from('personnel_vacations')
            .select('*')
            .eq('personnel_id', militarId)
            .gte('end_date', dataCorte);

        let totalFeriasCanceladas = 0;
        if (feriasFuturas && feriasFuturas.length > 0) {
            for (const f of feriasFuturas) {
                // Se o período começou estritamente após a data de corte, cancela
                if (f.start_date >= dataCorte) {
                    await supabase.from('personnel_vacations').update({
                        status: 'cancelado',
                        notes: (f.notes ? `${f.notes} | ` : '') + `Cancelado por transferência/desligamento em ${dataCorte}: ${motivo}`
                    }).eq('id', f.id);
                    totalFeriasCanceladas++;
                } else if (f.start_date < dataCorte && f.end_date >= dataCorte) {
                    // Se o período iniciou antes e terminaria depois, encurta o fim para a véspera do desligamento
                    const vespera = new Date(dataCorte + 'T00:00:00');
                    vespera.setDate(vespera.getDate() - 1);
                    const novaDataFim = vespera.toISOString().split('T')[0];
                    await supabase.from('personnel_vacations').update({
                        end_date: novaDataFim,
                        notes: (f.notes ? `${f.notes} | ` : '') + `Encurtado até ${novaDataFim} devido a transferência em ${dataCorte}`
                    }).eq('id', f.id);
                    totalFeriasCanceladas++;
                }
            }
        }

        // 5. Registrar no Histórico de Alterações Auditável
        const record = {
            tipo_alteracao: 'desligamento_transferencia',
            militar_a_id: militarId,
            data_vigencia: dataCorte,
            detalhes: `Desligamento definitivo da escala a partir de ${dataCorte}. Motivo: ${motivo}. Novo status: ${novoStatus}.`,
            criado_por: usuario,
            criado_em: new Date().toISOString()
        };

        const { error } = await supabase.from('escala_alteracoes').insert(record);
        if (error) {
            await ScaleAdjustmentService.logAudit({
                action_type: 'Desligamento/Transferência',
                scale_date: dataCorte,
                personnel_id: militarId,
                personnel_name: `Militar #${militarId}`,
                reason: record.detalhes,
                performed_by: usuario
            });
        }

        return { totalEscalasRemovidas, totalFeriasCanceladas };
    },

    /**
     * Busca o histórico unificado de alterações da escala
     */
    getHistoricoAlteracoes: async (): Promise<any[]> => {
        const { data, error } = await supabase
            .from('escala_alteracoes')
            .select(`
                *,
                militar_a:personnel!militar_a_id (id, name, war_name, graduation),
                militar_b:personnel!militar_b_id (id, name, war_name, graduation),
                guarnicao_origem:guarnicoes!guarnicao_origem_id (id, nome),
                guarnicao_destino:guarnicoes!guarnicao_destino_id (id, nome)
            `)
            .order('criado_em', { ascending: false });

        if (error) {
            // Se falhar o select com joins (por exemplo RLS ou relação), tenta select simples
            const { data: simpleData, error: simpleErr } = await supabase
                .from('escala_alteracoes')
                .select('*')
                .order('criado_em', { ascending: false });

            if (simpleErr || !simpleData) {
                // Fallback audit log
                const logs = await ScaleAdjustmentService.getAuditLogs();
                return logs.map(l => ({
                    id: l.id,
                    tipo_alteracao: l.action_type,
                    detalhes: l.reason,
                    criado_por: l.performed_by,
                    criado_em: l.performed_at
                }));
            }
            return simpleData;
        }
        return data || [];
    }
};
