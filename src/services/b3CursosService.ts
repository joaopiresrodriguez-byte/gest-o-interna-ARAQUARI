import { supabase } from './supabase';
import { B1Course } from './types';

export const B3CursosService = {
  listarTodosCursos: async (filtros?: {
    matricula?: string;
    sigla_curso?: string;
    categoria?: string;
    militar_id?: number;
    email?: string;
  }) => {
    try {
      let query = supabase
        .from('b1_courses')
        .select(`
          *,
          personnel:personnel_id (
            id,
            name,
            war_name,
            rank,
            matricula,
            email
          )
        `)
        .order('completion_date', { ascending: false });

      if (filtros) {
        if (filtros.militar_id) {
          query = query.eq('personnel_id', filtros.militar_id);
        }
        if (filtros.sigla_curso) {
          query = query.ilike('sigla_curso', `%${filtros.sigla_curso}%`);
        }
        if (filtros.categoria) {
          query = query.eq('category', filtros.categoria);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by matricula or email if provided (since personnel fields are nested)
      let result = (data || []) as any[];
      if (filtros?.matricula) {
        result = result.filter(
          item => item.personnel?.matricula?.toLowerCase().includes(filtros.matricula!.toLowerCase())
        );
      }
      if (filtros?.email) {
        result = result.filter(
          item => item.personnel?.email?.toLowerCase() === filtros.email!.toLowerCase()
        );
      }

      return result.map(c => ({
        ...c,
        personnel_name: c.personnel?.name || `ID ${c.personnel_id}`,
        personnel_rank: c.personnel?.rank,
        personnel_war_name: c.personnel?.war_name,
        personnel_matricula: c.personnel?.matricula,
      })) as (B1Course & {
        personnel_name: string;
        personnel_rank?: string;
        personnel_war_name?: string;
        personnel_matricula?: string;
      })[];
    } catch (error) {
      console.error('Erro ao listar cursos B3:', error);
      throw error;
    }
  },

  resumoCursos: async () => {
    try {
      const { data, error } = await supabase
        .from('b1_courses')
        .select('id, expiry_date, category');
      if (error) throw error;

      const total = data.length;
      const hoje = new Date();
      const expirados = data.filter(c => c.expiry_date && new Date(c.expiry_date) < hoje).length;
      const validos = total - expirados;

      // Agrupamento por categoria
      const categorias = data.reduce((acc: Record<string, number>, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
      }, {});

      return {
        total,
        expirados,
        validos,
        categorias
      };
    } catch (error) {
      console.error('Erro ao obter resumo de cursos B3:', error);
      throw error;
    }
  }
};
