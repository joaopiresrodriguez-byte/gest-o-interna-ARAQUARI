import React from 'react';

interface Props {
  titulo: string;
  aberto: boolean;
  salvando: boolean;
  erro: string | null;
  onSalvar: () => void;
  onCancelar: () => void;
  children: React.ReactNode;
}

export function ModalEdicao({
  titulo,
  aberto,
  salvando,
  erro,
  onSalvar,
  onCancelar,
  children
}: Props) {
  if (!aberto) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            color: '#1e293b',
          }}>
            ✏️ {titulo}
          </h3>
          <button
            onClick={onCancelar}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ✕
          </button>
        </div>

        {/* CONTEÚDO */}
        <div style={{ padding: '24px' }}>
          {children}

          {erro && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#fee2e2',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '14px',
            }}>
              ⚠️ {erro}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          position: 'sticky',
          bottom: 0,
          background: 'white',
        }}>
          <button
            onClick={onCancelar}
            disabled={salvando}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onSalvar}
            disabled={salvando}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: salvando ? '#94a3b8' : '#1d4ed8',
              color: 'white',
              cursor: salvando ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {salvando ? '⏳ Salvando...' : '✅ Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
