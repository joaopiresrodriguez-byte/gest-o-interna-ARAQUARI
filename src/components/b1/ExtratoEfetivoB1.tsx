import React, { useState, useEffect, useMemo } from 'react';
import { Personnel, Vacation, B1Course, RankHistory, DisciplinaryRecord } from '../../services/types';
import { formatLocalDate } from '../../utils/dateUtils';
import { toast } from 'sonner';
import { supabase } from '../../services/supabase';

export interface ExtratoEfetivoProps {
  personnelList: Personnel[];
  vacations?: Vacation[];
  courses?: B1Course[];
  rankHistories?: RankHistory[];
  disciplinaryRecords?: DisciplinaryRecord[];
}

export interface CampoExtrato {
  id: string;
  label: string;
  categoria: 'IDENTIFICACAO' | 'PESSOAL' | 'HABILITACAO' | 'HISTORICO';
  extrair: (p: Personnel, extras: ExtrasEfetivo) => string;
}

interface ExtrasEfetivo {
  vacations: Vacation[];
  courses: B1Course[];
  rankHistories: RankHistory[];
  disciplinaryRecords: DisciplinaryRecord[];
}

// Mapeamento e Pesos Hierárquicos dos Postos e Graduações (CBMSC)
const RANKS_BM_PESO: Record<string, number> = {
  'cel': 1,
  'coronel': 1,
  'ten cel': 2,
  'tenente coronel': 2,
  'maj': 3,
  'major': 3,
  'cap': 4,
  'capitao': 4,
  'capitão': 4,
  '1º ten': 5,
  '1 ten': 5,
  '1º tenente': 5,
  '2º ten': 6,
  '2 ten': 6,
  '2º tenente': 6,
  'asp of': 7,
  'asp': 7,
  'aspirante': 7,
  'sub ten': 8,
  'subten': 8,
  'subtenente': 8,
  '1º sgt': 9,
  '1 sgt': 9,
  '1º sargento': 9,
  '2º sgt': 10,
  '2 sgt': 10,
  '2º sargento': 10,
  '3º sgt': 11,
  '3 sgt': 11,
  '3º sargento': 11,
  'sgt': 11,
  'sargento': 11,
  'cb': 12,
  'cabo': 12,
  'sd': 13,
  'soldado': 13,
};

function getRankPeso(p: Partial<Personnel>): number {
  const isBC = p.type === 'BC' || (p.graduation && p.graduation.toLowerCase().includes('bc')) || (p.rank && p.rank.toLowerCase().includes('bc'));

  if (isBC) {
    let ordem = typeof p.bc_graduacao_ordem === 'number' && p.bc_graduacao_ordem > 0 ? p.bc_graduacao_ordem : 0;
    if (!ordem) {
      const match = (p.graduation || p.rank || '').match(/(\d+)[°º]?\s*Grau/i);
      if (match) ordem = parseInt(match[1], 10);
    }
    // No BC, o 10º Grau (Pleno Classe 1) é o mais alto / mais graduado
    // e o 1º Grau (Bombeiro Comunitário) é o inicial.
    // Para ordenar do mais graduado ao menos graduado:
    // 10º grau => 101, 9º grau => 102, ..., 1º grau => 110
    const pesoBC = ordem > 0 ? (11 - ordem) : 12;
    return 100 + pesoBC;
  }

  const grad = (p.graduation || p.rank || 'Sd')
    .toLowerCase()
    .replace(/\s*bm$/i, '')
    .replace(/(\d+)[°º]\s*sgt/i, '$1º sgt')
    .replace(/\s+/g, ' ')
    .trim();

  if (RANKS_BM_PESO[grad] !== undefined) {
    return RANKS_BM_PESO[grad];
  }

  for (const [key, peso] of Object.entries(RANKS_BM_PESO)) {
    if (grad.startsWith(key) || grad.includes(key)) {
      return peso;
    }
  }

  return 50;
}

export const CAMPOS_DISPONIVEIS: CampoExtrato[] = [
  // 1. Identificação Funcional
  {
    id: 'matricula',
    label: 'Matrícula',
    categoria: 'IDENTIFICACAO',
    extrair: p => p.matricula || 'N/D',
  },
  {
    id: 'posto_grad',
    label: 'Posto / Graduação',
    categoria: 'IDENTIFICACAO',
    extrair: p => p.graduation || p.rank || 'N/D',
  },
  {
    id: 'nome_completo',
    label: 'Nome Completo',
    categoria: 'IDENTIFICACAO',
    extrair: p => p.name || '',
  },
  {
    id: 'nome_guerra',
    label: 'Nome de Guerra',
    categoria: 'IDENTIFICACAO',
    extrair: p => p.war_name || 'N/D',
  },
  {
    id: 'tipo_efetivo',
    label: 'Tipo (BM / BC)',
    categoria: 'IDENTIFICACAO',
    extrair: p => (p.type === 'BC' ? 'BC (Comunitário)' : 'BM (Militar)'),
  },
  {
    id: 'status',
    label: 'Status Funcional',
    categoria: 'IDENTIFICACAO',
    extrair: p => p.status || 'Ativo',
  },
  {
    id: 'funcao',
    label: 'Função Principal',
    categoria: 'IDENTIFICACAO',
    extrair: p => p.role || 'N/D',
  },
  {
    id: 'data_inclusao',
    label: 'Data de Inclusão',
    categoria: 'IDENTIFICACAO',
    extrair: p => (p.data_inclusao ? formatLocalDate(p.data_inclusao) : 'N/D'),
  },
  {
    id: 'data_ultima_promocao',
    label: 'Última Promoção',
    categoria: 'IDENTIFICACAO',
    extrair: p => (p.data_ultima_promocao ? formatLocalDate(p.data_ultima_promocao) : 'N/D'),
  },
  {
    id: 'atividades_b4',
    label: 'Atividades Responsável (B4)',
    categoria: 'IDENTIFICACAO',
    extrair: p => (p.atividades_responsavel && p.atividades_responsavel.length > 0 ? p.atividades_responsavel.join(', ') : 'Nenhuma'),
  },

  // 2. Dados Pessoais & Contato
  {
    id: 'cpf',
    label: 'CPF',
    categoria: 'PESSOAL',
    extrair: p => p.cpf || 'N/D',
  },
  {
    id: 'data_nasc',
    label: 'Data de Nascimento',
    categoria: 'PESSOAL',
    extrair: p => (p.birth_date ? formatLocalDate(p.birth_date) : 'N/D'),
  },
  {
    id: 'idade',
    label: 'Idade',
    categoria: 'PESSOAL',
    extrair: p => {
      if (!p.birth_date) return 'N/D';
      const nasc = new Date(p.birth_date);
      if (isNaN(nasc.getTime())) return 'N/D';
      const hoje = new Date();
      let idade = hoje.getFullYear() - nasc.getFullYear();
      const m = hoje.getMonth() - nasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
      return `${idade} anos`;
    },
  },
  {
    id: 'cidade_residencia',
    label: 'Cidade de Residência',
    categoria: 'PESSOAL',
    extrair: p => p.cidade_residencia || 'N/D',
  },
  {
    id: 'endereco',
    label: 'Endereço Completo',
    categoria: 'PESSOAL',
    extrair: p => p.address || 'N/D',
  },
  {
    id: 'telefone',
    label: 'Telefone / WhatsApp',
    categoria: 'PESSOAL',
    extrair: p => p.phone || 'N/D',
  },
  {
    id: 'email',
    label: 'E-mail',
    categoria: 'PESSOAL',
    extrair: p => p.email || 'N/D',
  },
  {
    id: 'escolaridade',
    label: 'Escolaridade',
    categoria: 'PESSOAL',
    extrair: p => p.education_level || 'N/D',
  },

  // 3. Habilitação, Saúde & Operacional
  {
    id: 'cnh_categoria',
    label: 'Categoria CNH',
    categoria: 'HABILITACAO',
    extrair: p => p.cnh_category || 'N/D',
  },
  {
    id: 'cnh_numero',
    label: 'Nº Registro CNH',
    categoria: 'HABILITACAO',
    extrair: p => p.cnh_number || p.cnh || 'N/D',
  },
  {
    id: 'cnh_validade',
    label: 'Validade da CNH',
    categoria: 'HABILITACAO',
    extrair: p => (p.cnh_expiry_date ? formatLocalDate(p.cnh_expiry_date) : 'N/D'),
  },
  {
    id: 'toxicol_validade',
    label: 'Validade Toxicológico',
    categoria: 'HABILITACAO',
    extrair: p => (p.toxicological_expiry_date ? formatLocalDate(p.toxicological_expiry_date) : 'N/D'),
  },
  {
    id: 'cve_ativo',
    label: 'CVE Ativo',
    categoria: 'HABILITACAO',
    extrair: p => p.cve_active || 'Não',
  },
  {
    id: 'cve_validade',
    label: 'Validade CVE',
    categoria: 'HABILITACAO',
    extrair: p => (p.cve_expiry_date ? formatLocalDate(p.cve_expiry_date) : 'N/D'),
  },
  {
    id: 'tipo_sanguineo',
    label: 'Tipo Sanguíneo',
    categoria: 'HABILITACAO',
    extrair: p => p.blood_type || 'N/D',
  },
  {
    id: 'porte_arma',
    label: 'Porte de Arma',
    categoria: 'HABILITACAO',
    extrair: p => (p.weapon_permit ? 'Sim' : 'Não'),
  },
  {
    id: 'contato_emergencia',
    label: 'Contato de Emergência',
    categoria: 'HABILITACAO',
    extrair: p => p.emergency_contact_name || 'N/D',
  },
  {
    id: 'telefone_emergencia',
    label: 'Tel. de Emergência',
    categoria: 'HABILITACAO',
    extrair: p => p.emergency_phone || 'N/D',
  },

  // 4. Históricos Complementares
  {
    id: 'cursos_concluidos',
    label: 'Cursos Concluídos',
    categoria: 'HISTORICO',
    extrair: (p, extras) => {
      const cList = extras.courses.filter(c => c.personnel_id === p.id);
      if (cList.length === 0) return 'Nenhum curso';
      return cList.map(c => c.sigla_curso || c.course_name).join(', ');
    },
  },
  {
    id: 'ferias_afastamentos',
    label: 'Férias / Afastamentos',
    categoria: 'HISTORICO',
    extrair: (p, extras) => {
      const vList = extras.vacations.filter(v => v.personnel_id === p.id);
      if (vList.length === 0) return 'Sem afastamentos';
      return vList.map(v => `${v.leave_type || 'Férias'} (${formatLocalDate(v.start_date)} a ${formatLocalDate(v.end_date)})`).join('; ');
    },
  },
  {
    id: 'historico_promocoes',
    label: 'Histórico de Promoções',
    categoria: 'HISTORICO',
    extrair: (p, extras) => {
      const rList = extras.rankHistories.filter(r => r.personnel_id === p.id);
      if (rList.length === 0) return 'Sem histórico';
      return rList.map(r => `${r.previous_rank} ➔ ${r.new_rank} (${formatLocalDate(r.change_date)})`).join('; ');
    },
  },
  {
    id: 'disciplina',
    label: 'Registros Disciplinares',
    categoria: 'HISTORICO',
    extrair: (p, extras) => {
      const dList = extras.disciplinaryRecords.filter(d => d.personnel_id === p.id);
      if (dList.length === 0) return 'Sem registros';
      return dList.map(d => `${d.record_type}: ${d.description} (${formatLocalDate(d.date)})`).join('; ');
    },
  },
];

export const ExtratoEfetivoB1: React.FC<ExtratoEfetivoProps> = ({
  personnelList,
  vacations = [],
  courses: propCourses = [],
  rankHistories: propRankHistories = [],
  disciplinaryRecords: propDisciplinary = [],
}) => {
  // Filtros de Efetivo
  const [tipoEfetivo, setTipoEfetivo] = useState<'TODOS' | 'BM' | 'BC'>('TODOS');
  const [statusFiltro, setStatusFiltro] = useState<string>('TODOS');
  const [buscaTexto, setBuscaTexto] = useState<string>('');
  const [criterioOrdenacao, setCriterioOrdenacao] = useState<'HIERARQUIA' | 'NOME' | 'INCLUSAO' | 'MATRICULA'>('HIERARQUIA');

  // Seleção de Militares: 'TODOS_FILTRADOS' ou 'SELECAO_MANUAL'
  const [modoSelecao, setModoSelecao] = useState<'TODOS_FILTRADOS' | 'SELECAO_MANUAL'>('TODOS_FILTRADOS');
  const [militaresSelecionadosIds, setMilitaresSelecionadosIds] = useState<number[]>([]);

  // Caixa de Seleção de Campos a Baixar
  const [camposSelecionados, setCamposSelecionados] = useState<string[]>([
    'posto_grad',
    'nome_completo',
    'nome_guerra',
    'matricula',
    'tipo_efetivo',
    'status',
    'telefone',
    'cidade_residencia',
  ]);

  // Estados extras carregados sob demanda se necessário
  const [loadedCourses, setLoadedCourses] = useState<B1Course[]>(propCourses);
  const [loadedRankHistories, setLoadedRankHistories] = useState<RankHistory[]>(propRankHistories);
  const [loadedDisciplinary, setLoadedDisciplinary] = useState<DisciplinaryRecord[]>(propDisciplinary);
  const [loadedVacations, setLoadedVacations] = useState<Vacation[]>(vacations);
  const [gerandoDocumento, setGerandoDocumento] = useState<boolean>(false);

  // Efeito para carregar dados complementares se o usuário marcar a categoria HISTORICO
  useEffect(() => {
    const temHistorico = camposSelecionados.some(id => {
      const c = CAMPOS_DISPONIVEIS.find(item => item.id === id);
      return c?.categoria === 'HISTORICO';
    });

    if (temHistorico) {
      const carregarExtras = async () => {
        try {
          if (loadedCourses.length === 0) {
            const { data: cData } = await supabase.from('courses').select('*');
            if (cData) setLoadedCourses(cData);
          }
          if (loadedRankHistories.length === 0) {
            const { data: rData } = await supabase.from('rank_history').select('*');
            if (rData) setLoadedRankHistories(rData);
          }
          if (loadedDisciplinary.length === 0) {
            const { data: dData } = await supabase.from('disciplinary_records').select('*');
            if (dData) setLoadedDisciplinary(dData);
          }
          if (loadedVacations.length === 0) {
            const { data: vData } = await supabase.from('vacations').select('*');
            if (vData) setLoadedVacations(vData);
          }
        } catch (err) {
          console.warn('Aviso ao carregar dados complementares para extrato:', err);
        }
      };
      carregarExtras();
    }
  }, [camposSelecionados]);

  // Função de ordenação
  const ordenarLista = (lista: Personnel[]): Personnel[] => {
    return [...lista].sort((a, b) => {
      if (criterioOrdenacao === 'HIERARQUIA') {
        // 1. Posto / Graduação (Hierarquia militar: Cel -> Sd -> BCs)
        const pesoA = getRankPeso(a);
        const pesoB = getRankPeso(b);
        if (pesoA !== pesoB) return pesoA - pesoB;

        // 2. Data da última promoção (mais antiga primeiro = mais antigo no posto)
        if (a.data_ultima_promocao && b.data_ultima_promocao) {
          const diff = a.data_ultima_promocao.localeCompare(b.data_ultima_promocao);
          if (diff !== 0) return diff;
        } else if (a.data_ultima_promocao) {
          return -1;
        } else if (b.data_ultima_promocao) {
          return 1;
        }

        // 3. Data de inclusão (mais antiga primeiro = mais tempo de serviço na corporação)
        if (a.data_inclusao && b.data_inclusao) {
          const diff = a.data_inclusao.localeCompare(b.data_inclusao);
          if (diff !== 0) return diff;
        } else if (a.data_inclusao) {
          return -1;
        } else if (b.data_inclusao) {
          return 1;
        }

        // 4. Nome alfabético como critério final de desempate
        const nA = a.war_name || a.name || '';
        const nB = b.war_name || b.name || '';
        return nA.localeCompare(nB, 'pt-BR');
      }

      if (criterioOrdenacao === 'NOME') {
        const nA = a.name || '';
        const nB = b.name || '';
        return nA.localeCompare(nB, 'pt-BR');
      }

      if (criterioOrdenacao === 'INCLUSAO') {
        const dtA = a.data_inclusao || '9999-99-99';
        const dtB = b.data_inclusao || '9999-99-99';
        return dtA.localeCompare(dtB);
      }

      if (criterioOrdenacao === 'MATRICULA') {
        const matA = a.matricula || '';
        const matB = b.matricula || '';
        return matA.localeCompare(matB);
      }

      return 0;
    });
  };

  // Lista de Militares após filtros e ordenados
  const militaresFiltrados = useMemo(() => {
    const filtrados = personnelList.filter(p => {
      // 1. Tipo (BM / BC)
      if (tipoEfetivo === 'BM' && p.type === 'BC') return false;
      if (tipoEfetivo === 'BC' && p.type !== 'BC') return false;

      // 2. Status
      if (statusFiltro !== 'TODOS' && p.status !== statusFiltro) return false;

      // 3. Busca de texto
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase().trim();
        const nome = (p.name || '').toLowerCase();
        const guerra = (p.war_name || '').toLowerCase();
        const mat = (p.matricula || '').toLowerCase();
        const cpf = (p.cpf || '').toLowerCase();
        const grad = (p.graduation || p.rank || '').toLowerCase();
        if (!nome.includes(termo) && !guerra.includes(termo) && !mat.includes(termo) && !cpf.includes(termo) && !grad.includes(termo)) {
          return false;
        }
      }

      return true;
    });

    return ordenarLista(filtrados);
  }, [personnelList, tipoEfetivo, statusFiltro, buscaTexto, criterioOrdenacao]);

  // Efetivo final a ser impresso/exportado
  const efetivoFinal = useMemo(() => {
    if (modoSelecao === 'TODOS_FILTRADOS') {
      return militaresFiltrados;
    }
    const selecionados = militaresFiltrados.filter(p => p.id && militaresSelecionadosIds.includes(p.id));
    return ordenarLista(selecionados);
  }, [militaresFiltrados, modoSelecao, militaresSelecionadosIds, criterioOrdenacao]);

  // Toggle campo
  const toggleCampo = (campoId: string) => {
    setCamposSelecionados(prev =>
      prev.includes(campoId) ? prev.filter(id => id !== campoId) : [...prev, campoId]
    );
  };

  // Presets de Seleção de Campos
  const aplicarPreset = (preset: 'TODOS' | 'LIMPAR' | 'CADASTRAL' | 'HABILITACAO' | 'SAUDE' | 'HISTORICO') => {
    switch (preset) {
      case 'TODOS':
        setCamposSelecionados(CAMPOS_DISPONIVEIS.map(c => c.id));
        break;
      case 'LIMPAR':
        setCamposSelecionados([]);
        break;
      case 'CADASTRAL':
        setCamposSelecionados([
          'posto_grad',
          'nome_completo',
          'nome_guerra',
          'matricula',
          'cpf',
          'tipo_efetivo',
          'status',
          'telefone',
          'cidade_residencia',
        ]);
        break;
      case 'HABILITACAO':
        setCamposSelecionados([
          'posto_grad',
          'nome_completo',
          'nome_guerra',
          'cnh_categoria',
          'cnh_numero',
          'cnh_validade',
          'toxicol_validade',
          'cve_ativo',
          'cve_validade',
        ]);
        break;
      case 'SAUDE':
        setCamposSelecionados([
          'posto_grad',
          'nome_completo',
          'nome_guerra',
          'tipo_sanguineo',
          'contato_emergencia',
          'telefone_emergencia',
          'cidade_residencia',
          'telefone',
        ]);
        break;
      case 'HISTORICO':
        setCamposSelecionados([
          'posto_grad',
          'nome_completo',
          'nome_guerra',
          'matricula',
          'cursos_concluidos',
          'ferias_afastamentos',
          'historico_promocoes',
          'disciplina',
        ]);
        break;
    }
  };

  // Funções de Seleção de Militares
  const marcarTodosMilitares = () => {
    const ids = militaresFiltrados.map(p => p.id).filter(Boolean) as number[];
    setMilitaresSelecionadosIds(ids);
  };

  const desmarcarTodosMilitares = () => {
    setMilitaresSelecionadosIds([]);
  };

  const toggleMilitar = (id: number) => {
    setMilitaresSelecionadosIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const objetoExtras: ExtrasEfetivo = {
    vacations: loadedVacations.length > 0 ? loadedVacations : vacations,
    courses: loadedCourses.length > 0 ? loadedCourses : propCourses,
    rankHistories: loadedRankHistories.length > 0 ? loadedRankHistories : propRankHistories,
    disciplinaryRecords: loadedDisciplinary.length > 0 ? loadedDisciplinary : propDisciplinary,
  };

  // ==========================================
  // EXPORTAR PLANILHA (CSV / EXCEL COM BOM)
  // ==========================================
  const exportarPlanilhaCSV = () => {
    if (efetivoFinal.length === 0) {
      toast.error('Nenhum efetivo selecionado para exportação.');
      return;
    }
    if (camposSelecionados.length === 0) {
      toast.error('Selecione pelo menos um tipo de dado para baixar.');
      return;
    }

    try {
      const camposAtivos = CAMPOS_DISPONIVEIS.filter(c => camposSelecionados.includes(c.id));
      const headers = camposAtivos.map(c => c.label);

      const rows: string[][] = [];
      rows.push(headers);

      efetivoFinal.forEach(p => {
        const row = camposAtivos.map(c => c.extrair(p, objetoExtras));
        rows.push(row);
      });

      const csvContent = rows
        .map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
        .join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dataHoje = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Extrato_Efetivo_${tipoEfetivo}_${dataHoje}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Planilha com ${efetivoFinal.length} militares baixada com sucesso!`);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao gerar planilha CSV: ' + (e?.message || 'Falha'));
    }
  };

  // ==========================================
  // IMPRIMIR / BAIXAR DOCUMENTO OFICIAL (PDF)
  // ==========================================
  const gerarDocumentoOficialPDF = (modo: 'TABELA' | 'DOSSIE') => {
    if (efetivoFinal.length === 0) {
      toast.error('Nenhum efetivo selecionado para impressão.');
      return;
    }
    if (camposSelecionados.length === 0) {
      toast.error('Selecione pelo menos um tipo de dado para baixar.');
      return;
    }

    setGerandoDocumento(true);
    try {
      const camposAtivos = CAMPOS_DISPONIVEIS.filter(c => camposSelecionados.includes(c.id));
      const ehPaisagem = modo === 'TABELA' && camposAtivos.length > 5;
      const dataHoraExtracao = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;

      let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Extrato de Efetivo - CBMSC Araquari</title>
<style>
  @page {
    size: A4 ${ehPaisagem ? 'landscape' : 'portrait'};
    margin: 10mm 12mm;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 9.5px;
    line-height: 1.35;
    margin: 0;
    padding: 0;
    color: #1e293b;
    background: #fff;
  }
  .header-box {
    border-bottom: 2px solid #991b1b;
    padding-bottom: 8px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-titles h1 {
    font-size: 11px;
    font-weight: bold;
    margin: 0;
    text-transform: uppercase;
    color: #0f172a;
  }
  .header-titles h2 {
    font-size: 12px;
    font-weight: 900;
    margin: 2px 0 0 0;
    color: #991b1b;
    text-transform: uppercase;
  }
  .header-titles h3 {
    font-size: 9px;
    font-weight: 600;
    margin: 2px 0 0 0;
    color: #64748b;
  }
  .meta-tag {
    text-align: right;
    font-size: 8.5px;
    color: #64748b;
  }
  .badge-tipo {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 8.5px;
    background-color: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  /* ESTILO MODO TABELA */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 9px;
  }
  table.data-table th, table.data-table td {
    border: 1px solid #cbd5e1;
    padding: 4.5px 6px;
    text-align: left;
    vertical-align: middle;
  }
  table.data-table th {
    background-color: #f1f5f9;
    font-weight: 900;
    text-transform: uppercase;
    font-size: 8px;
    color: #334155;
  }
  table.data-table tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  /* ESTILO MODO DOSSIE / FICHAS */
  .dossie-card {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 12px;
    background: #fff;
    page-break-inside: avoid;
  }
  .dossie-header {
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 4px;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .dossie-nome {
    font-size: 11px;
    font-weight: 900;
    color: #0f172a;
  }
  .grid-dossie {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 6px;
  }
  .dossie-item {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 4px 6px;
  }
  .dossie-label {
    font-size: 7.5px;
    font-weight: 800;
    text-transform: uppercase;
    color: #64748b;
    display: block;
  }
  .dossie-value {
    font-size: 9px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 1px;
    word-break: break-word;
  }

  .footer {
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 8px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>
</head>
<body>

  <div class="header-box">
    <div class="header-titles">
      <h1>ESTADO DE SANTA CATARINA — CORPO DE BOMBEIROS MILITAR</h1>
      <h2>16º BBM / 2º PELOTÃO — ARAQUARI</h2>
      <h3>EXTRATO DE DADOS DO EFETIVO (${tipoEfetivo === 'TODOS' ? 'BM e BC' : tipoEfetivo})</h3>
    </div>
    <div class="meta-tag">
      <span class="badge-tipo">TOTAL: ${efetivoFinal.length} EFETIVOS</span><br>
      <b>Ordem:</b> ${criterioOrdenacao === 'HIERARQUIA' ? 'Posto / Graduação' : criterioOrdenacao === 'NOME' ? 'Alfabética' : criterioOrdenacao === 'INCLUSAO' ? 'Data Inclusão' : 'Matrícula'}<br>
      Extraído em: ${dataHoraExtracao}
    </div>
  </div>`;

      if (modo === 'TABELA') {
        html += `
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        ${camposAtivos.map(c => `<th>${c.label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${efetivoFinal
        .map(
          (p, idx) => `
        <tr>
          <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
          ${camposAtivos
            .map(c => {
              const val = c.extrair(p, objetoExtras);
              return `<td>${val}</td>`;
            })
            .join('')}
        </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
      } else {
        // MODO DOSSIÊ / FICHAS
        html += `
  <div class="dossie-container">
    ${efetivoFinal
      .map(
        (p, idx) => `
      <div class="dossie-card">
        <div class="dossie-header">
          <div class="dossie-nome">
            #${idx + 1} — ${p.graduation || p.rank || ''} ${p.name}
            ${p.war_name ? `<span style="color:#64748b; font-weight:normal;"> (${p.war_name})</span>` : ''}
          </div>
          <span class="badge-tipo">${p.type === 'BC' ? 'BC' : 'BM'} · ${p.status || 'Ativo'}</span>
        </div>
        <div class="grid-dossie">
          ${camposAtivos
            .map(c => {
              const val = c.extrair(p, objetoExtras);
              return `
            <div class="dossie-item">
              <span class="dossie-label">${c.label}</span>
              <div class="dossie-value">${val}</div>
            </div>`;
            })
            .join('')}
        </div>
      </div>`
      )
      .join('')}
  </div>`;
      }

      html += `
  <div class="footer">
    <div>Documento oficial extraído do Sistema de Gestão Interna (Módulo B1) — 2º/2º/16º BBM Araquari</div>
    <div>Página gerada eletronicamente · Total de registros: ${efetivoFinal.length}</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
      } else {
        toast.error('O navegador bloqueou a abertura da janela. Permita pop-ups.');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao gerar documento PDF: ' + (e?.message || 'Falha'));
    } finally {
      setGerandoDocumento(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-xs space-y-6">
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h3 className="font-black text-lg text-rustic-brown flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">badge</span>
            Extrato Personalizado de Dados do Efetivo (BM & BC)
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Selecione qual efetivo deseja consultar e marque individualmente os dados necessários para gerar o documento oficial (PDF/Impressão) ou baixar em planilha.
          </p>
        </div>

        {/* Contador rápido */}
        <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
          <span className="text-[10px] uppercase font-black text-stone-400">Total Selecionado:</span>
          <span className="text-sm font-black text-primary">{efetivoFinal.length} militares</span>
        </div>
      </div>

      {/* BLOCO 1: SELEÇÃO DE QUAL EFETIVO (BM / BC) E FILTROS */}
      <div className="bg-stone-50/70 p-4 rounded-xl border border-stone-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-rustic-brown flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-primary">groups</span>
            1. Qual Efetivo Deseja Baixar?
          </span>
          <span className="text-[10px] text-stone-500">Filtrando entre {personnelList.length} cadastrados</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Seletor de Tipo de Efetivo */}
          <div>
            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">
              Tipo de Efetivo:
            </label>
            <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-stone-200">
              <button
                type="button"
                onClick={() => setTipoEfetivo('TODOS')}
                className={`py-1.5 text-xs font-black rounded-md transition-all ${
                  tipoEfetivo === 'TODOS' ? 'bg-primary text-white shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTipoEfetivo('BM')}
                className={`py-1.5 text-xs font-black rounded-md transition-all ${
                  tipoEfetivo === 'BM' ? 'bg-red-700 text-white shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                BM
              </button>
              <button
                type="button"
                onClick={() => setTipoEfetivo('BC')}
                className={`py-1.5 text-xs font-black rounded-md transition-all ${
                  tipoEfetivo === 'BC' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                BC
              </button>
            </div>
          </div>

          {/* Seletor de Status */}
          <div>
            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">
              Status Funcional:
            </label>
            <select
              value={statusFiltro}
              onChange={e => setStatusFiltro(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-xs font-bold text-stone-800 focus:outline-none focus:border-primary"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Férias">Férias</option>
              <option value="Licença">Licença</option>
              <option value="Afastado">Afastado</option>
              <option value="Cedido">Cedido</option>
            </select>
          </div>

          {/* Seletor de Ordenação */}
          <div>
            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">
              Ordem dos Dados:
            </label>
            <select
              value={criterioOrdenacao}
              onChange={e => setCriterioOrdenacao(e.target.value as any)}
              className="w-full h-10 px-3 rounded-lg border border-amber-300 bg-amber-50/60 text-xs font-black text-amber-900 focus:outline-none focus:border-amber-600 shadow-2xs"
            >
              <option value="HIERARQUIA">🎖️ Posto / Graduação</option>
              <option value="NOME">🔤 Nome Alfabético</option>
              <option value="INCLUSAO">📅 Data de Inclusão</option>
              <option value="MATRICULA">🔢 Matrícula</option>
            </select>
          </div>

          {/* Busca por nome / matricula */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">
              Buscar Militar Específico:
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-stone-400 text-base">search</span>
              <input
                type="text"
                value={buscaTexto}
                onChange={e => setBuscaTexto(e.target.value)}
                placeholder="Buscar por nome, nome de guerra, matrícula ou CPF..."
                className="w-full h-10 pl-9 pr-4 rounded-lg border border-stone-200 bg-white text-xs font-medium focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Opção de seleção manual vs todos */}
        <div className="pt-2 border-t border-stone-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 font-bold text-stone-700 cursor-pointer">
              <input
                type="radio"
                name="modoSelecao"
                checked={modoSelecao === 'TODOS_FILTRADOS'}
                onChange={() => setModoSelecao('TODOS_FILTRADOS')}
                className="text-primary focus:ring-primary"
              />
              Incluir todos os {militaresFiltrados.length} militares filtrados
            </label>
            <label className="flex items-center gap-1.5 font-bold text-stone-700 cursor-pointer">
              <input
                type="radio"
                name="modoSelecao"
                checked={modoSelecao === 'SELECAO_MANUAL'}
                onChange={() => {
                  setModoSelecao('SELECAO_MANUAL');
                  if (militaresSelecionadosIds.length === 0) {
                    marcarTodosMilitares();
                  }
                }}
                className="text-primary focus:ring-primary"
              />
              Escolher militares individualmente
            </label>
          </div>

          {modoSelecao === 'SELECAO_MANUAL' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={marcarTodosMilitares}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Marcar Todos ({militaresFiltrados.length})
              </button>
              <span className="text-stone-300">|</span>
              <button
                type="button"
                onClick={desmarcarTodosMilitares}
                className="text-[11px] font-bold text-stone-500 hover:underline"
              >
                Desmarcar Todos
              </button>
            </div>
          )}
        </div>

        {/* Lista de Checkboxes de Militares (se seleção manual ativa) */}
        {modoSelecao === 'SELECAO_MANUAL' && (
          <div className="max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-stone-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
            {militaresFiltrados.map(m => {
              const isChecked = m.id ? militaresSelecionadosIds.includes(m.id) : false;
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                    isChecked ? 'bg-red-50/50 border-red-200 text-rustic-brown font-bold' : 'border-transparent hover:bg-stone-50 text-stone-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => m.id && toggleMilitar(m.id)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="truncate">
                    <span className="text-[10px] text-stone-400 font-mono mr-1">[{m.type}]</span>
                    {m.graduation || m.rank || ''} {m.war_name || m.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* BLOCO 2: CAIXA DE SELEÇÃO DOS TIPOS DE DADOS A BAIXAR */}
      <div className="bg-stone-50/70 p-4 rounded-xl border border-stone-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-rustic-brown flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-primary">checklist</span>
              2. Quais Dados de Cada Efetivo Deseja Baixar?
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Marque as caixas de seleção correspondentes aos campos que deseja incluir no documento.
            </p>
          </div>

          {/* Presets Rápidos */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-stone-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => aplicarPreset('TODOS')}
              className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-[10px] font-bold text-stone-700"
            >
              Todos os Dados
            </button>
            <button
              type="button"
              onClick={() => aplicarPreset('CADASTRAL')}
              className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-[10px] font-bold text-stone-700"
            >
              Cadastral
            </button>
            <button
              type="button"
              onClick={() => aplicarPreset('HABILITACAO')}
              className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-[10px] font-bold text-stone-700"
            >
              CNH / CVE
            </button>
            <button
              type="button"
              onClick={() => aplicarPreset('SAUDE')}
              className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-[10px] font-bold text-stone-700"
            >
              Saúde / Emergência
            </button>
            <button
              type="button"
              onClick={() => aplicarPreset('HISTORICO')}
              className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-[10px] font-bold text-stone-700"
            >
              Históricos
            </button>
            <button
              type="button"
              onClick={() => aplicarPreset('LIMPAR')}
              className="px-2 py-1 bg-stone-200/70 hover:bg-stone-300 text-stone-600 rounded text-[10px] font-bold"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Grid de Campos Organizados por Categoria */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CATEGORIA 1: IDENTIFICAÇÃO FUNCIONAL */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
              <span className="text-[10px] font-black uppercase text-rustic-brown flex items-center gap-1">
                🏷️ Identificação
              </span>
              <span className="text-[9px] font-bold text-stone-400">
                {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'IDENTIFICACAO' && camposSelecionados.includes(c.id)).length} / {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'IDENTIFICACAO').length}
              </span>
            </div>
            <div className="space-y-1.5">
              {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'IDENTIFICACAO').map(campo => (
                <label key={campo.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary">
                  <input
                    type="checkbox"
                    checked={camposSelecionados.includes(campo.id)}
                    onChange={() => toggleCampo(campo.id)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className={camposSelecionados.includes(campo.id) ? 'font-bold text-stone-800' : 'text-stone-600'}>
                    {campo.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* CATEGORIA 2: DADOS PESSOAIS & CONTATO */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
              <span className="text-[10px] font-black uppercase text-rustic-brown flex items-center gap-1">
                🪪 Dados Pessoais & Contato
              </span>
              <span className="text-[9px] font-bold text-stone-400">
                {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'PESSOAL' && camposSelecionados.includes(c.id)).length} / {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'PESSOAL').length}
              </span>
            </div>
            <div className="space-y-1.5">
              {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'PESSOAL').map(campo => (
                <label key={campo.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary">
                  <input
                    type="checkbox"
                    checked={camposSelecionados.includes(campo.id)}
                    onChange={() => toggleCampo(campo.id)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className={camposSelecionados.includes(campo.id) ? 'font-bold text-stone-800' : 'text-stone-600'}>
                    {campo.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* CATEGORIA 3: HABILITAÇÃO & SAÚDE */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
              <span className="text-[10px] font-black uppercase text-rustic-brown flex items-center gap-1">
                🚗 CNH, Saúde & Emergência
              </span>
              <span className="text-[9px] font-bold text-stone-400">
                {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'HABILITACAO' && camposSelecionados.includes(c.id)).length} / {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'HABILITACAO').length}
              </span>
            </div>
            <div className="space-y-1.5">
              {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'HABILITACAO').map(campo => (
                <label key={campo.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary">
                  <input
                    type="checkbox"
                    checked={camposSelecionados.includes(campo.id)}
                    onChange={() => toggleCampo(campo.id)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className={camposSelecionados.includes(campo.id) ? 'font-bold text-stone-800' : 'text-stone-600'}>
                    {campo.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* CATEGORIA 4: HISTÓRICOS COMPLEMENTARES */}
          <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
              <span className="text-[10px] font-black uppercase text-rustic-brown flex items-center gap-1">
                📚 Históricos Complementares
              </span>
              <span className="text-[9px] font-bold text-stone-400">
                {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'HISTORICO' && camposSelecionados.includes(c.id)).length} / {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'HISTORICO').length}
              </span>
            </div>
            <div className="space-y-1.5">
              {CAMPOS_DISPONIVEIS.filter(c => c.categoria === 'HISTORICO').map(campo => (
                <label key={campo.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary">
                  <input
                    type="checkbox"
                    checked={camposSelecionados.includes(campo.id)}
                    onChange={() => toggleCampo(campo.id)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className={camposSelecionados.includes(campo.id) ? 'font-bold text-stone-800' : 'text-stone-600'}>
                    {campo.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 3: BOTÕES DE DOWNLOAD / EXPORTAÇÃO */}
      <div className="p-5 bg-stone-900 text-white rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1 text-center md:text-left">
          <p className="font-black text-sm text-amber-400 uppercase flex items-center justify-center md:justify-start gap-1.5">
            <span className="material-symbols-outlined text-lg">download</span>
            Opções de Baixa do Documento
          </p>
          <p className="text-xs text-stone-300">
            Você selecionou <b>{camposSelecionados.length} tipos de dados</b> para <b>{efetivoFinal.length} efetivos</b> ({tipoEfetivo}).
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {/* Botão Baixar Documento Oficial em Tabela (PDF / Impressão) */}
          <button
            type="button"
            onClick={() => gerarDocumentoOficialPDF('TABELA')}
            disabled={gerandoDocumento || efetivoFinal.length === 0 || camposSelecionados.length === 0}
            className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Documento Oficial / PDF
          </button>

          {/* Botão Baixar Fichas / Dossiê (PDF) */}
          <button
            type="button"
            onClick={() => gerarDocumentoOficialPDF('DOSSIE')}
            disabled={gerandoDocumento || efetivoFinal.length === 0 || camposSelecionados.length === 0}
            className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">contact_page</span>
            Fichas em Dossiê
          </button>

          {/* Botão Baixar Planilha CSV */}
          <button
            type="button"
            onClick={exportarPlanilhaCSV}
            disabled={efetivoFinal.length === 0 || camposSelecionados.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">table_view</span>
            Baixar Planilha (CSV)
          </button>
        </div>
      </div>

      {/* BLOCO 4: PRÉVIA DOS DADOS (TABELA COMPACTA) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-rustic-brown flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-primary">visibility</span>
            Prévia dos Dados Selecionados ({efetivoFinal.length} registros — Ordem: {criterioOrdenacao === 'HIERARQUIA' ? 'Posto / Graduação' : criterioOrdenacao === 'NOME' ? 'Alfabética' : criterioOrdenacao === 'INCLUSAO' ? 'Data Inclusão' : 'Matrícula'})
          </span>
          <span className="text-[10px] text-stone-400 italic">
            Exibindo os dados que serão incluídos no documento final
          </span>
        </div>

        <div className="overflow-x-auto border border-stone-200 rounded-xl max-h-72">
          {efetivoFinal.length === 0 ? (
            <div className="p-8 text-center text-stone-400 italic text-xs">
              Nenhum efetivo encontrado para os filtros selecionados.
            </div>
          ) : camposSelecionados.length === 0 ? (
            <div className="p-8 text-center text-stone-400 italic text-xs">
              Marque ao menos um tipo de dado nas caixas de seleção acima para visualizar a prévia.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-stone-100 text-[10px] font-black uppercase text-stone-600 sticky top-0 border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  {CAMPOS_DISPONIVEIS.filter(c => camposSelecionados.includes(c.id)).map(c => (
                    <th key={c.id} className="py-2.5 px-3 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {efetivoFinal.slice(0, 30).map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-stone-50/80">
                    <td className="py-2 px-3 text-center text-[10px] text-stone-400 font-bold">
                      {idx + 1}
                    </td>
                    {CAMPOS_DISPONIVEIS.filter(c => camposSelecionados.includes(c.id)).map(c => (
                      <td key={c.id} className="py-2 px-3 whitespace-nowrap text-[11px]">
                        {c.extrair(p, objetoExtras)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {efetivoFinal.length > 30 && (
          <p className="text-[10px] text-stone-400 text-right">
            Mostrando os primeiros 30 registros na prévia. O documento completo conterá todos os {efetivoFinal.length} efetivos.
          </p>
        )}
      </div>
    </div>
  );
};
