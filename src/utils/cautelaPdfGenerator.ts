import { Cautela } from '../services/types';

export const imprimirDocumentoCautela = (cautela: Cautela) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir o termo de cautela.');
    return;
  }

  const formatarData = (d?: string | null) => {
    if (!d) return 'Não definida';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return d;
    }
  };

  const getCondicaoLabel = (cond?: string | null) => {
    switch (cond) {
      case 'perfeito_estado': return 'Perfeito Estado';
      case 'avaria_leve': return 'Com Avaria Leve';
      case 'avaria_grave': return 'Com Avaria Grave';
      case 'item_perdido': return 'Item Perdido ou Não Devolvido';
      default: return cond || '—';
    }
  };

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Termo de Cautela - ${cautela.numero_cautela}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 20px;
          line-height: 1.4;
          font-size: 12px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #b91c1c;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 14px;
          margin: 0;
          font-weight: 800;
          color: #b91c1c;
          text-transform: uppercase;
        }
        .header h2 {
          font-size: 12px;
          margin: 3px 0 0 0;
          font-weight: 700;
          color: #334155;
        }
        .header p {
          font-size: 10px;
          margin: 2px 0 0 0;
          color: #64748b;
        }
        .doc-title {
          text-align: center;
          margin: 15px 0;
          font-size: 15px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
        }
        .badge-numero {
          display: inline-block;
          background: #f1f5f9;
          border: 1.5px solid #cbd5e1;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 800;
          color: #b91c1c;
          letter-spacing: 1px;
          margin-top: 5px;
        }
        .grid-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .box {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .box-full {
          grid-column: span 2;
        }
        .box-title {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
          margin-bottom: 6px;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 4px;
        }
        .field {
          margin-bottom: 6px;
        }
        .field:last-child {
          margin-bottom: 0;
        }
        .label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .value {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }
        .termo-text {
          border: 1px solid #e2e8f0;
          border-left: 4px solid #b91c1c;
          background: #fff;
          padding: 12px;
          border-radius: 4px;
          font-size: 11px;
          text-align: justify;
          margin: 20px 0;
          line-height: 1.5;
          color: #334155;
        }
        .signatures {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
          text-align: center;
        }
        .sig-line {
          border-top: 1px solid #475569;
          padding-top: 6px;
          font-size: 10px;
          font-weight: 700;
          color: #1e293b;
        }
        .sig-sub {
          font-size: 9px;
          color: #64748b;
          margin-top: 2px;
        }
        .footer {
          margin-top: 30px;
          font-size: 9px;
          color: #94a3b8;
          text-align: center;
          border-top: 1px solid #f1f5f9;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Corpo de Bombeiros Militar de Santa Catarina</h1>
        <h2>7º Batallhão de Bombeiros Militar — Araquari</h2>
        <p>Sistema Gestão Interna | Módulo Operacional & B4</p>
      </div>

      <div class="doc-title">
        Termo de Cautela e Empréstimo
        <br/>
        <div class="badge-numero">${cautela.numero_cautela}</div>
      </div>

      <div class="grid-section">
        <div class="box">
          <div class="box-title">1. Dados do Item Cautelado</div>
          <div class="field">
            <div class="label">Item / Equipamento / Viatura</div>
            <div class="value">${cautela.item_nome}</div>
          </div>
          <div class="field">
            <div class="label">Tipo de Item</div>
            <div class="value">${cautela.tipo_item.toUpperCase()}</div>
          </div>
        </div>

        <div class="box">
          <div class="box-title">2. Responsáveis pelo Empréstimo</div>
          <div class="field">
            <div class="label">Solicitante Responsável</div>
            <div class="value">${cautela.solicitante}</div>
          </div>
          <div class="field">
            <div class="label">Retirado por</div>
            <div class="value">${cautela.retirado_por}</div>
          </div>
        </div>

        <div class="box">
          <div class="box-title">3. Prazos do Empréstimo</div>
          <div class="field">
            <div class="label">Data de Retirada</div>
            <div class="value">${formatarData(cautela.data_retirada)}</div>
          </div>
          <div class="field">
            <div class="label">Data Prevista de Devolução</div>
            <div class="value">${formatarData(cautela.data_prevista_devolucao)}</div>
          </div>
        </div>

        <div class="box">
          <div class="box-title">4. Status Atual</div>
          <div class="field">
            <div class="label">Status da Cautela</div>
            <div class="value" style="color: ${cautela.status === 'ativo' ? '#b91c1c' : cautela.status === 'devolvido' ? '#15803d' : '#64748b'}">
              ${cautela.status.toUpperCase()}
            </div>
          </div>
          ${cautela.data_devolucao_real ? `
            <div class="field">
              <div class="label">Data Real de Devolução</div>
              <div class="value">${formatarData(cautela.data_devolucao_real)}</div>
            </div>
            <div class="field">
              <div class="label">Condição no Retorno</div>
              <div class="value">${getCondicaoLabel(cautela.condicao_devolucao)}</div>
            </div>
          ` : ''}
        </div>

        ${cautela.observacoes ? `
          <div class="box box-full">
            <div class="box-title">Observações da Retirada</div>
            <div class="value" style="font-weight: 500;">${cautela.observacoes}</div>
          </div>
        ` : ''}

        ${cautela.observacoes_devolucao ? `
          <div class="box box-full">
            <div class="box-title">Observações da Devolução</div>
            <div class="value" style="font-weight: 500;">${cautela.observacoes_devolucao}</div>
          </div>
        ` : ''}

        ${cautela.motivo_cancelamento ? `
          <div class="box box-full" style="border-color: #fca5a5; background: #fef2f2;">
            <div class="box-title" style="color: #991b1b;">Motivo do Cancelamento</div>
            <div class="value" style="color: #991b1b; font-weight: 600;">${cautela.motivo_cancelamento}</div>
          </div>
        ` : ''}
      </div>

      <div class="termo-text">
        <strong>TERMO DE RESPONSABILIDADE:</strong> Declaro ter recebido o item acima discriminado em perfeitas condições de uso e funcionamento (salvo observações registradas). Assumo total responsabilidade pela sua guarda, conservação, fiel utilização exclusivamente para fins do serviço militar/operacional e devolução no prazo estipulado. Comprometo-me a ressarcir o Estado em caso de avaria por mau uso, negligência, imperícia ou perda do referido bem.
      </div>

      <div class="signatures">
        <div>
          <div class="sig-line">${cautela.retirado_por}</div>
          <div class="sig-sub">Quem Retirou / Solicitante</div>
        </div>
        <div>
          <div class="sig-line">Chefe de Socorro / B4</div>
          <div class="sig-sub">Responsável pela Emissão</div>
        </div>
        <div>
          <div class="sig-line">Visto da Devolução</div>
          <div class="sig-sub">Recebedor na Entrega</div>
        </div>
      </div>

      <div class="footer">
        Gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Documento de Controle Interno CBMSC Araquari
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
