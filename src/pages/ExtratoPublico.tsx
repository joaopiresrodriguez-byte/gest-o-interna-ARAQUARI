import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

interface ItemExtrato {
  id: string;
  name: string;
  type: string;
  patrimonio_number?: string;
  status: string;
  brand?: string;
  plate?: string;
}

export function ExtratoPublico() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const [itens, setItens] = useState<ItemExtrato[]>([]);
  const [titulo, setTitulo] = useState('');
  const [localTipo, setLocalTipo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function buscar() {
      try {
        if (!id) {
          setErro('Identificador do local não fornecido.');
          setCarregando(false);
          return;
        }

        // 1. Buscar dados do local (ambiente ou viatura) na tabela locais_equipamento
        const { data: local, error: errorLocal } = await supabase
          .from('locais_equipamento')
          .select('*')
          .eq('id', id)
          .single();

        if (errorLocal || !local) {
          console.error('Erro ao buscar local:', errorLocal);
          setErro('Localização não encontrada ou não cadastrada.');
          setCarregando(false);
          return;
        }

        setTitulo(local.nome);
        setLocalTipo(local.tipo === 'viatura' ? 'Viatura' : 'Ambiente');

        // 2. Buscar itens associados a este local na tabela fleet (equipamentos e materiais)
        // Buscamos itens vinculados via local_id OU com correspondência textual legada (location)
        const { data: fleetData, error: errorFleet } = await supabase
          .from('fleet')
          .select('id, name, type, patrimonio_number, status, brand, plate, location, local_id')
          .or(`local_id.eq.${id},location.ilike.${local.nome}`)
          .order('name');

        if (errorFleet) {
          console.error('Erro ao buscar itens da frota:', errorFleet);
          throw errorFleet;
        }

        // Filtramos para evitar que a própria viatura apareça listada dentro de si mesma
        const itensFiltrados = (fleetData || []).filter(item => item.id !== id);
        setItens(itensFiltrados);

      } catch (err: any) {
        console.error('Erro geral na consulta pública:', err);
        setErro('Ocorreu um erro ao carregar as informações do extrato.');
      } finally {
        setCarregando(false);
      }
    }

    buscar();
  }, [tipo, id]);

  if (carregando) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f8fafc',
        color: '#475569'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #cbd5e1',
          borderTopColor: '#dc2626',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>Carregando extrato público...</span>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{
        maxWidth: '500px',
        margin: '80px auto',
        padding: '32px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        border: '1px solid #fee2e2'
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#dc2626', marginBottom: '16px' }}>error</span>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#991b1b', margin: '0 0 8px' }}>Consulta Inválida</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px', lineHeight: '1.5' }}>{erro}</p>
        <a href="/" style={{
          display: 'inline-block',
          padding: '10px 20px',
          background: '#dc2626',
          color: '#ffffff',
          fontWeight: 'bold',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '13px'
        }}>Ir para o Sistema</a>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '24px 16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1e293b',
      background: '#ffffff',
      minHeight: '100vh'
    }}>
      {/* CABEÇALHO */}
      <div style={{
        borderBottom: '3px solid #dc2626',
        paddingBottom: '20px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <p style={{
            margin: '0 0 4px',
            fontSize: '11px',
            color: '#dc2626',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
          }}>
            CBMSC — Araquari/SC
          </p>
          <h2 style={{
            margin: '0 0 6px',
            fontSize: '22px',
            fontWeight: '900',
            color: '#1e293b',
            letterSpacing: '-0.5px'
          }}>
            Extrato de Carga e Material
          </h2>
          <p style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '700',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
              {localTipo}
            </span>
            {titulo}
          </p>
        </div>
        <div style={{
          textAlign: 'right',
          fontSize: '11px',
          color: '#64748b',
          lineHeight: '1.4'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>B4 LOGÍSTICA</p>
          <p style={{ margin: 0 }}>Carga Oficial</p>
        </div>
      </div>

      {/* INFORMAÇÕES DE LEITURA */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '12px',
        color: '#475569',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span>Consultado em: <strong>{new Date().toLocaleString('pt-BR')}</strong></span>
        <span>Total: <strong>{itens.length} itens cadastrados</strong></span>
      </div>

      {/* LISTA DE ITENS */}
      {itens.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: '#64748b',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px dashed #cbd5e1'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '8px' }}>inventory_2</span>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Nenhum item cadastrado neste local.</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>Os itens vinculados aparecerão aqui em tempo real.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          {itens.map((item, i) => {
            const statusLabel = item.status === 'active' ? 'Ativo' : 'Inoperante';
            const isAtivo = item.status === 'active';

            return (
              <div key={item.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                background: '#ffffff',
                transition: 'background 0.2s'
              }}>
                <div>
                  <p style={{
                    margin: 0,
                    fontWeight: '700',
                    fontSize: '14px',
                    color: '#0f172a'
                  }}>
                    {i + 1}. {item.name}
                  </p>
                  <p style={{
                    margin: '4px 0 0',
                    fontSize: '11px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontWeight: '600' }}>{item.type}</span>
                    {item.brand && <span>• {item.brand}</span>}
                    {item.patrimonio_number && (
                      <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>
                        Pat: {item.patrimonio_number}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: isAtivo ? '#dcfce7' : '#fee2e2',
                    color: isAtivo ? '#15803d' : '#b91c1c',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RODAPÉ */}
      <div style={{
        marginTop: '40px',
        padding: '20px 16px',
        background: '#f8fafc',
        borderRadius: '12px',
        textAlign: 'center',
        fontSize: '11px',
        color: '#64748b',
        border: '1px solid #e2e8f0',
        lineHeight: '1.6'
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>Sistema de Gestão Interna CBMSC Araquari</p>
        <p style={{ margin: 0 }}>Ficha pública de consulta para fins de conferência patrimonial e auditoria.</p>
        <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>
          Qualquer discrepância deve ser informada imediatamente ao B4 do Quartel.
        </p>
      </div>
    </div>
  );
}

export default ExtratoPublico;
