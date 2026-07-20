import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Vehicle, LocalEquipamento } from '../../services/types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ExtratoB4Props {
  local: LocalEquipamento;
  items: Vehicle[];
  onClose: () => void;
}

interface QrCodeImageProps {
  url: string;
  size?: number;
  className?: string;
}

// ─── Componente Helper para Renderizar QR Code em Imagem Base64 ────────────

const QrCodeImage: React.FC<QrCodeImageProps> = ({ url, size = 80, className }) => {
  const [imgSrc, setImgSrc] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
      .then(setImgSrc)
      .catch(console.error);
  }, [url, size]);

  if (!imgSrc) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-gray-100 animate-pulse rounded-md flex items-center justify-center text-[9px] text-gray-400"
      >
        ...
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt="QR Code"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
};

// ─── Etiqueta QR individual ─────────────────────────────────────────────────

const EtiquetaQR: React.FC<{ item: Vehicle }> = ({ item }) => {
  const qrUrl = `${window.location.origin}/patrimonio/item/${item.id}`;

  return (
    <div
      className="flex flex-col items-center gap-1 p-2 border border-gray-300 rounded-lg bg-white"
      style={{ width: '110px', minHeight: '130px', pageBreakInside: 'avoid' }}
    >
      <QrCodeImage url={qrUrl} size={80} />
      <p className="text-[8px] font-black text-center leading-tight text-gray-800 break-words mt-1" style={{ maxWidth: '96px' }}>
        {item.name}
      </p>
      {item.patrimonio_number && (
        <p className="text-[7px] font-mono text-gray-500 text-center">
          Nº {item.patrimonio_number}
        </p>
      )}
    </div>
  );
};

// ─── Linha de item no extrato tabular ────────────────────────────────────────

const ItemRow: React.FC<{ item: Vehicle; index: number }> = ({ item, index }) => {
  const qrUrl = `${window.location.origin}/patrimonio/item/${item.id}`;

  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ pageBreakInside: 'avoid' }}>
      <td className="px-3 py-2 text-xs font-bold text-center text-gray-600 border border-gray-200">{index + 1}</td>
      <td className="px-3 py-2 border border-gray-200 w-16">
        <QrCodeImage url={qrUrl} size={48} />
      </td>
      <td className="px-3 py-2 border border-gray-200">
        <p className="text-xs font-bold text-gray-900">{item.name}</p>
        {item.brand && <p className="text-[10px] text-gray-500">{item.brand}</p>}
      </td>
      <td className="px-3 py-2 text-[10px] text-gray-700 border border-gray-200">
        {item.type}
      </td>
      <td className="px-3 py-2 text-[10px] font-mono text-gray-700 border border-gray-200">
        {item.patrimonio_number || '—'}
      </td>
      <td className="px-3 py-2 text-[10px] border border-gray-200">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
          item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {item.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td className="px-3 py-2 text-[10px] text-gray-500 border border-gray-200">
        {item.plate || item.year || '—'}
      </td>
    </tr>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

const ExtratoB4: React.FC<ExtratoB4Props> = ({ local, items, onClose }) => {
  const [viewMode, setViewMode] = useState<'tabela' | 'etiquetas'>('tabela');
  const printRef = useRef<HTMLDivElement>(null);
  const geracaoData = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const urlExtrato = `${window.location.origin}/extrato/${local.tipo}/${local.id}`;

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Extrato B4 — ${local.nome}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a1a; }
          @media print {
            body { padding: 10px; }
            button { display: none !important; }
          }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #d1d5db; padding: 6px 10px; font-size: 11px; }
          th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
          tr:nth-child(even) td { background: #f9fafb; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #dc2626; padding-bottom: 12px; }
          .header h1 { font-size: 18px; font-weight: 900; }
          .header p { font-size: 11px; color: #6b7280; margin-top: 4px; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; }
          .ativo { background: #d1fae5; color: #065f46; }
          .inativo { background: #fee2e2; color: #991b1b; }
          .etiqueta-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
          .etiqueta { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px; width: 110px; text-align: center; page-break-inside: avoid; }
          img { display: block; margin: 0 auto; }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const tipoIcon = local.tipo === 'ambiente' ? 'location_city' : 'local_shipping';
  const tipoLabel = local.tipo === 'ambiente' ? 'Ambiente' : 'Viatura';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,10,8,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-red-700 to-red-900 rounded-t-2xl">
          <div className="flex items-center gap-4">
            {/* QR Code Geral do Extrato para Visualização Rápida */}
            <div className="bg-white p-1.5 rounded-xl shadow-inner flex flex-col items-center flex-shrink-0">
              <QrCodeImage url={urlExtrato} size={64} />
              <span className="text-[8px] font-black text-red-900 mt-0.5 uppercase tracking-wide">QR Extrato</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-red-200 text-[18px]">{tipoIcon}</span>
                <span className="text-red-200 text-xs font-bold uppercase tracking-widest">{tipoLabel}</span>
              </div>
              <h2 className="text-2xl font-black text-white">{local.nome}</h2>
              <p className="text-red-300 text-xs mt-0.5">
                {items.length} item(s) registrado(s) · Gerado em {geracaoData}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle de visualização */}
            <div className="flex bg-red-800/50 rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode('tabela')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'tabela' ? 'bg-white text-red-800 shadow-sm' : 'text-red-200 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">table_view</span>
                Tabela
              </button>
              <button
                onClick={() => setViewMode('etiquetas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'etiquetas' ? 'bg-white text-red-800 shadow-sm' : 'text-red-200 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                Etiquetas
              </button>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-800 font-bold rounded-xl text-xs hover:bg-red-50 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-red-800/50 text-red-200 hover:bg-red-800 hover:text-white transition-colors"
              aria-label="Fechar extrato"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Conteúdo imprimível */}
        <div ref={printRef} className="p-6">
          {/* Cabeçalho do extrato (visível na impressão) */}
          <div className="header mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* QR Code Geral do Extrato para Impressão */}
                <div className="border border-gray-300 p-1 rounded-lg bg-white flex flex-col items-center flex-shrink-0" style={{ width: '74px' }}>
                  <QrCodeImage url={urlExtrato} size={64} />
                  <span className="text-[7px] font-bold text-gray-500 mt-0.5 uppercase tracking-wide text-center">QR Extrato</span>
                </div>
                <div>
                  <h1 className="text-xl font-black text-gray-900">
                    Extrato de Patrimônio — {local.nome}
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">
                    Corpo de Bombeiros Militar de Santa Catarina · {tipoLabel} · {items.length} item(s) · {geracaoData}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p className="font-bold">B4 — Logística e Patrimônio</p>
                <p>Quartel Araquari</p>
              </div>
            </div>
          </div>

          {/* Modo: Tabela */}
          {viewMode === 'tabela' && (
            <div className="overflow-x-auto">
              {items.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <span className="material-symbols-outlined text-[48px] mb-2">inventory_2</span>
                  <p className="font-bold text-sm">Nenhum item registrado neste local.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-500 text-center w-8">#</th>
                      <th className="border border-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-500 w-14">QR</th>
                      <th className="border border-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-500 text-left">Item</th>
                      <th className="border border-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-500">Tipo</th>
                      <th className="border border-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-500">Nº Patrimônio</th>
                      <th className="border border-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-500">Status</th>
                      <th className="border border-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-500">Placa/Ano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <ItemRow key={item.id} item={item} index={idx} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                      <td colSpan={7} className="px-3 py-2 text-right text-xs font-bold text-gray-500">
                        Total: {items.length} item(s) · Ativos: {items.filter(i => i.status === 'active').length}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* Modo: Etiquetas QR */}
          {viewMode === 'etiquetas' && (
            <div>
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">info</span>
                <p className="text-xs text-amber-800 font-medium">
                  Imprima e recorte as etiquetas abaixo para afixar nos equipamentos. Cada QR code aponta para a ficha do item no sistema.
                </p>
              </div>
              {items.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <span className="material-symbols-outlined text-[48px] mb-2">qr_code_2</span>
                  <p className="font-bold text-sm">Nenhum item registrado neste local.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {items.map(item => (
                    <EtiquetaQR key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rodapé do extrato */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400">
            <span>Sistema de Gestão Interna CBMSC Araquari · B4 Patrimônio</span>
            <span>Documento gerado em {geracaoData}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtratoB4;
