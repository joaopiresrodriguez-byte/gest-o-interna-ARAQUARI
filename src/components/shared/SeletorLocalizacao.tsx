import { useLocalizacao } from '@/hooks/useLocalizacao';

interface Props {
  hook: ReturnType<typeof useLocalizacao>;
}

export function SeletorLocalizacao({ hook }: Props) {
  const {
    tipoLocal, setTipoLocal,
    localId, setLocalId,
    viaturaId,
    compartimentoId, setCompartimentoId,
    locais, viaturas, compartimentos,
    onSelecionarViatura,
  } = hook;

  const locaisAmbiente = locais.filter(
    l => l.tipo === 'ambiente'
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* TIPO */}
      <div>
        <label>Localização</label>
        <select
          value={tipoLocal}
          onChange={e => {
            setTipoLocal(e.target.value);
            setLocalId('');
            onSelecionarViatura('');
          }}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}
        >
          <option value="">
            Selecione o tipo...
          </option>
          <option value="ambiente">
            🏠 Ambiente
          </option>
          <option value="viatura">
            🚒 Viatura
          </option>
        </select>
      </div>

      {/* AMBIENTE */}
      {tipoLocal === 'ambiente' && (
        <div>
          <label>Ambiente</label>
          <select
            value={localId}
            onChange={e =>
              setLocalId(e.target.value)
            }
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}
          >
            <option value="">
              Selecione o ambiente...
            </option>
            {locaisAmbiente.map(l => (
              <option 
                key={l.id} 
                value={l.id}
              >
                {l.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* VIATURA */}
      {tipoLocal === 'viatura' && (
        <>
          <div>
            <label>Viatura</label>
            <select
              value={viaturaId}
              onChange={e =>
                onSelecionarViatura(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}
            >
              <option value="">
                Selecione a viatura...
              </option>
              {viaturas.map(v => (
                <option 
                  key={v.id} 
                  value={v.id}
                >
                  {v.nome} — {v.placa}
                </option>
              ))}
            </select>
          </div>

          {/* COMPARTIMENTO */}
          {viaturaId && (
            <div>
              <label>
                Compartimento
                <span style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginLeft: '8px',
                }}>
                  (opcional)
                </span>
              </label>

              {compartimentos.length === 0
                ? (
                  <div style={{
                    padding: '10px',
                    background: '#fef9c3',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#854d0e',
                  }}>
                    ⚠️ Viatura sem compartimentos.{' '}
                    <a href="/b4/viaturas">
                      Cadastrar agora
                    </a>
                  </div>
                ) : (
                  <select
                    value={compartimentoId}
                    onChange={e =>
                      setCompartimentoId(
                        e.target.value
                      )
                    }
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <option value="">
                      Sem compartimento
                    </option>
                    {compartimentos.map(c => (
                      <option 
                        key={c.id} 
                        value={c.id}
                      >
                        {c.nome}
                        {c.posicao && 
                          ` — ${c.posicao}`
                        }
                      </option>
                    ))}
                  </select>
                )
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}
