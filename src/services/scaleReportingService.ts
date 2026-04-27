import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Escala, Personnel, Vacation } from './types';

export const ScaleReportingService = {
    generateMonthlyScalePDF: (
        month: string,
        escalas: Escala[],
        personnel: Personnel[],
        vacations: Vacation[]
    ) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const [year, monthNum] = month.split('-').map(Number);
        const date = new Date(year, monthNum - 1);
        const monthName = date.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        // 1. Cabeçalho Institucional
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('ESTADO DE SANTA CATARINA', 148, 15, { align: 'center' });
        doc.text('CORPO DE BOMBEIROS MILITAR', 148, 20, { align: 'center' });
        doc.text('7º BATALHÃO DE BOMBEIROS MILITAR - ARAQUARI', 148, 25, { align: 'center' });

        doc.setFontSize(14);
        doc.text(`ESCALA DE SERVIÇO OPERACIONAL - ${monthName} / ${year}`, 148, 35, { align: 'center' });

        // 2. Preparar Dados da Tabela
        const headers = ['Militar', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())];
        const rows = personnel
            .filter(p => p.status === 'Ativo')
            .map(p => {
                const rowData: string[] = [`${p.graduation || ''} ${p.war_name || p.name}`];

                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                    // Check Vacation
                    const isVacation = vacations.some(v =>
                        v.personnel_id === p.id &&
                        dateStr >= v.start_date &&
                        dateStr <= v.end_date
                    );

                    // Check Scale
                    const dayEscala = escalas.find(e => e.data === dateStr);
                    const isScaled = dayEscala?.militares?.includes(p.id!);

                    if (isVacation) {
                        rowData.push('F');
                    } else if (isScaled) {
                        rowData.push(dayEscala?.manual_override ? 'T' : 'S');
                    } else {
                        rowData.push('-');
                    }
                }
                return rowData;
            });

        // 3. Renderizar Tabela
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 45,
            styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
            headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', minCellWidth: 35 } },
            theme: 'grid'
        });

        // 4. Legenda e Assinatura
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.text('Legenda: (S) Serviço Ordinário | (T) Troca/Exceção | (F) Férias/Licença', 15, finalY);

        doc.text('__________________________________________', 148, finalY + 30, { align: 'center' });
        doc.text('Comandante do 7º BBM - Araquari', 148, finalY + 35, { align: 'center' });

        // 5. Download
        doc.save(`Escala_B1_${month}.pdf`);
    }
};
