import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { b3SolicitacoesService } from '../services/b3SolicitacoesService';
import { B3WhatsappCadastro, B3SolicitacaoApoio } from '../services/types';

export const SolicitarApoioPublico: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cadastro, setCadastro] = useState<B3WhatsappCadastro | null>(null);

  // Form State
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  const [tema, setTema] = useState('');
  const [dia, setDia] = useState('');
  const [horario, setHorario] = useState('');
  const [endereco, setEndereco] = useState('');
  const [complemento, setComplemento] = useState('');

  const [submetendo, setSubmetendo] = useState(false);
  const [solicitacaoConcluida, setSolicitacaoConcluida] = useState<B3SolicitacaoApoio | null>(null);

  // Data mínima (hoje em YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const validarToken = async () => {
      if (!token) {
        setErrorMsg('Link de solicitação inválido ou não fornecido.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg(null);
        const cad = await b3SolicitacoesService.buscarCadastroPorToken(token);

        if (!cad || !cad.ativo) {
          setErrorMsg('Este link de solicitação de apoio expirou, está inativo ou é inválido.');
        } else {
          setCadastro(cad);
        }
      } catch (err) {
        console.error('Erro ao validar token:', err);
        setErrorMsg('Ocorreu um erro ao validar o link de acesso. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    validarToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cadastro?.id) {
      alert('Cadastro de origem não encontrado.');
      return;
    }

    if (!responsavelNome || !tema || !dia || !horario || !endereco) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (dia < todayStr) {
      alert('A data da solicitação não pode ser no passado.');
      return;
    }

    try {
      setSubmetendo(true);
      const res = await b3SolicitacoesService.enviarSolicitacaoPublica({
        whatsapp_origem_id: cadastro.id,
        responsavel_nome: responsavelNome,
        responsavel_telefone: responsavelTelefone,
        tema,
        dia,
        horario,
        endereco,
        complemento,
      });

      setSolicitacaoConcluida(res);
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err);
      alert('Falha ao enviar a solicitação. Verifique os dados e tente novamente.');
    } finally {
      setSubmetendo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></span>
          <p className="text-white text-sm font-semibold tracking-wide">Validando link de solicitação...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-display">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-stone-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">link_off</span>
          </div>
          <h2 className="text-xl font-bold text-stone-800">Link Indisponível</h2>
          <p className="text-stone-600 text-sm leading-relaxed">{errorMsg}</p>
          <div className="pt-4 text-xs text-stone-400">
            Corpo de Bombeiros Militar de Santa Catarina — 2º Pel/Araquari
          </div>
        </div>
      </div>
    );
  }

  if (solicitacaoConcluida) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-display">
        <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-stone-200 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>

          <div>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full uppercase tracking-wider">
              Solicitação Enviada
            </span>
            <h2 className="text-2xl font-black text-stone-800 mt-2">
              Nº {solicitacaoConcluida.numero_solicitacao || 'SAP-REGISTRADO'}
            </h2>
            <p className="text-stone-600 text-sm mt-2">
              Sua solicitação de apoio foi recebida com sucesso pela equipe do CBMSC Araquari.
            </p>
          </div>

          <div className="bg-stone-50 p-4 rounded-xl text-left border border-stone-200 space-y-2 text-xs text-stone-700">
            <p><strong>Solicitante:</strong> {solicitacaoConcluida.responsavel_nome}</p>
            <p><strong>Tema/Assunto:</strong> {solicitacaoConcluida.tema}</p>
            <p><strong>Data Solicitada:</strong> {new Date(solicitacaoConcluida.dia + 'T00:00:00').toLocaleDateString('pt-BR')} às {solicitacaoConcluida.horario}</p>
            <p><strong>Endereço:</strong> {solicitacaoConcluida.endereco}</p>
          </div>

          <p className="text-xs text-stone-500 italic">
            Nossa equipe analisará o pedido e entrará em contato através do telefone informado em breve.
          </p>

          <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-400">
            🔴 2º Pelotão de Bombeiros Militar — Araquari - SC
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 font-display flex flex-col justify-between p-4 md:p-8">
      <div className="max-w-2xl w-full mx-auto space-y-6">
        {/* Cabeçalho da Página Pública */}
        <header className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Bras%C3%A3o_do_Corpo_de_Bombeiros_Militar_de_Santa_Catarina.svg/200px-Bras%C3%A3o_do_Corpo_de_Bombeiros_Militar_de_Santa_Catarina.svg.png"
            alt="Brasão CBMSC"
            className="w-16 h-16 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/brasao_cbmsc.png';
            }}
          />
          <div>
            <h1 className="text-base font-black text-stone-900 tracking-wide uppercase leading-tight">
              Corpo de Bombeiros Militar de Santa Catarina
            </h1>
            <h2 className="text-sm font-bold text-red-700 uppercase tracking-wider">
              2º Pelotão de Bombeiros Militar — Araquari - SC
            </h2>
            <p className="text-xs text-stone-500 mt-1">Formulário Oficial de Solicitação de Apoio Institucional</p>
          </div>
        </header>

        {/* Formulário de Solicitação */}
        <main className="bg-white rounded-2xl shadow-md border border-stone-200 overflow-hidden">
          <div className="bg-gradient-to-r from-red-700 to-red-900 p-5 text-white">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined">assignment</span>
              Dados da Solicitação
            </h3>
            <p className="text-xs text-red-100 mt-0.5">
              Preencha os campos abaixo com as informações do apoio pretendido.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Responsável pelo Pedido *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo do solicitante"
                  value={responsavelNome}
                  onChange={e => setResponsavelNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Telefone de Contato / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="(47) 99999-9999"
                  value={responsavelTelefone}
                  onChange={e => setResponsavelTelefone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Tema / Descrição do Apoio *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ex: Palestra de prevenção de incêndios na escola, Instrução de Primeiros Socorros, Apoio em evento comunitário..."
                value={tema}
                onChange={e => setTema(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Data Prevista *
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={dia}
                  onChange={e => setDia(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Horário de Início *
                </label>
                <input
                  type="time"
                  required
                  value={horario}
                  onChange={e => setHorario(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Endereço Completo do Evento/Local *
              </label>
              <input
                type="text"
                required
                placeholder="Logradouro, Nº, Bairro e Cidade"
                value={endereco}
                onChange={e => setEndereco(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                Complemento / Observações Adicionais
              </label>
              <input
                type="text"
                placeholder="Ponto de referência, auditório, número de participantes..."
                value={complemento}
                onChange={e => setComplemento(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submetendo}
                className="w-full py-3.5 bg-red-700 hover:bg-red-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submetendo ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Enviando Solicitação...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">send</span>
                    Submeter Solicitação de Apoio
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>

      <footer className="text-center text-xs text-stone-400 mt-8 py-4">
        🔴 Corpo de Bombeiros Militar de Santa Catarina — 2º Pelotão Araquari
      </footer>
    </div>
  );
};

export default SolicitarApoioPublico;
