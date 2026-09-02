import React, { useState, useEffect } from 'react';
import { b3SolicitacoesService } from '../../services/b3SolicitacoesService';
import { B3WhatsappCadastro } from '../../services/types';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

export const SubmoduloCadastroWhatsapp: React.FC = () => {
  const { user } = useAuth();

  const [cadastros, setCadastros] = useState<B3WhatsappCadastro[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [numero, setNumero] = useState('');
  const [nomeContato, setNomeContato] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregarCadastros = async () => {
    try {
      setLoading(true);
      const data = await b3SolicitacoesService.listarCadastrosWhatsapp();
      setCadastros(data);
    } catch (err) {
      console.error('Erro ao carregar cadastros de WhatsApp:', err);
      toast.error('Erro ao carregar cadastros de WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCadastros();
  }, []);

  // Máscara para número (ex: 5547999999999)
  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val.startsWith('55') && val.length > 0) {
      val = '55' + val;
    }
    if (val.length > 13) val = val.substring(0, 13);
    setNumero(val);
  };

  const dispararWhatsappLink = (cad: B3WhatsappCadastro) => {
    const origin = window.location.origin;
    const urlGerada = `${origin}/solicitar-apoio?token=${cad.token_link}`;

    const mensagem =
      `Olá! O link abaixo foi gerado pelo 2º Pelotão de Bombeiros Militar de Araquari para que você possa registrar uma solicitação de apoio ao CBMSC:\n\n` +
      `${urlGerada}\n\n` +
      `Clique no link, preencha o formulário e nossa equipe analisará seu pedido em breve.\n` +
      `🔴 Corpo de Bombeiros Militar de Santa Catarina — Araquari`;

    const encodedMsg = encodeURIComponent(mensagem);
    const numeroLimpo = cad.numero.replace(/\D/g, '');
    window.open(`https://wa.me/${numeroLimpo}?text=${encodedMsg}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numero || numero.length < 10) {
      toast.error('Informe um número de WhatsApp válido no formato 55 + DDD + número.');
      return;
    }

    try {
      setSalvando(true);
      const novocad = await b3SolicitacoesService.cadastrarWhatsapp({
        numero,
        nome_contato: nomeContato,
        descricao,
        cadastrado_por: (user as any)?.id,
      });

      toast.success('Número cadastrado com sucesso!');

      // Disparar WhatsApp automaticamente
      dispararWhatsappLink(novocad);

      // Limpar formulário
      setNumero('');
      setNomeContato('');
      setDescricao('');

      carregarCadastros();
    } catch (err: any) {
      console.error('Erro ao cadastrar WhatsApp:', err);
      if (err?.code === '23505') {
        toast.error('Este número de WhatsApp já está cadastrado.');
      } else {
        toast.error('Erro ao salvar o cadastro.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtivo = async (cad: B3WhatsappCadastro) => {
    const novoStatus = !cad.ativo;
    try {
      await b3SolicitacoesService.toggleAtivoWhatsapp(cad.id!, novoStatus);
      toast.success(novoStatus ? 'Cadastro ativado!' : 'Cadastro desativado com sucesso!');
      setCadastros(prev =>
        prev.map(item => (item.id === cad.id ? { ...item, ativo: novoStatus } : item))
      );
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro ao alterar status do cadastro.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Form de Cadastro */}
      <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
        <div className="bg-gradient-to-r from-rustic-brown to-[#4c2d27] p-5 text-white flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">send_to_mobile</span>
            Envio de Link de Solicitação de Apoio
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-rustic-brown uppercase mb-1">
                Número de WhatsApp *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="5547999999999"
                  value={numero}
                  onChange={handleNumeroChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
              <span className="text-[10px] text-stone-500">Formato: 55 + DDD + Número (ex: 5547999999999)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-rustic-brown uppercase mb-1">
                Nome do Contato / Órgão / Escola
              </label>
              <input
                type="text"
                placeholder="Ex: João - Diretor da Escola Almirante"
                value={nomeContato}
                onChange={e => setNomeContato(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-rustic-brown uppercase mb-1">
                Finalidade / Público Alvo (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Solicitante de palestra comunitária"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {salvando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Gerando Link & WhatsApp...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">link</span>
                  Cadastrar e Enviar Link via WhatsApp
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Listagem de Cadastros */}
      <section className="bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden">
        <div className="p-5 border-b border-rustic-border flex items-center justify-between">
          <h3 className="text-base font-bold text-rustic-brown flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">contacts</span>
            Números Cadastrados & Links Gerados
          </h3>
          <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-bold">
            Total: {cadastros.length}
          </span>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-stone-400 animate-pulse text-xs">
              Carregando cadastros de WhatsApp...
            </div>
          ) : cadastros.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              Nenhum número cadastrado até o momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-rustic-brown font-bold uppercase bg-stone-50">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">WhatsApp / Contato</th>
                    <th className="py-3 px-4">Finalidade</th>
                    <th className="py-3 px-4">Link Público</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {cadastros.map(cad => {
                    const urlGerada = `${window.location.origin}/solicitar-apoio?token=${cad.token_link}`;

                    return (
                      <tr key={cad.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              cad.ativo
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-red-100 text-red-700 border border-red-200'
                            }`}
                          >
                            {cad.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-stone-800">{cad.nome_contato || 'Contato Sem Nome'}</div>
                          <div className="font-mono text-stone-500 text-[11px]">{cad.numero}</div>
                        </td>

                        <td className="py-3.5 px-4 text-stone-600">
                          {cad.descricao || '—'}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 max-w-xs">
                            <input
                              type="text"
                              readOnly
                              value={urlGerada}
                              className="w-full bg-stone-100 border border-stone-200 px-2 py-1 rounded text-[11px] font-mono truncate text-stone-600 select-all"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(urlGerada);
                                toast.success('Link copiado para a área de transferência!');
                              }}
                              className="p-1 text-stone-500 hover:text-stone-800"
                              title="Copiar Link"
                            >
                              <span className="material-symbols-outlined text-[16px]">content_copy</span>
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => dispararWhatsappLink(cad)}
                            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                            title="Reenviar link via WhatsApp"
                          >
                            <span className="material-symbols-outlined text-[14px]">send</span>
                            Reenviar Link
                          </button>

                          <button
                            onClick={() => handleToggleAtivo(cad)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer ${
                              cad.ativo
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {cad.ativo ? 'block' : 'check_circle'}
                            </span>
                            {cad.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SubmoduloCadastroWhatsapp;
