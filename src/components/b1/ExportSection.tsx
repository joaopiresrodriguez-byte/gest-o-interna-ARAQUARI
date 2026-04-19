import React from 'react';
import { Personnel, Vacation, SigrhExport } from '../../services/types';

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
    exports: SigrhExport[];
    onAddExport: (exp: Omit<SigrhExport, 'id'>) => void;
}

const ExportSection: React.FC<Props> = ({ personnelList, vacations, exports, onAddExport }) => {
    const [activeSubTab, setActiveSubTab] = React.useState<'sigrh' | 'sgpe' | 'checklist'>('sigrh');
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const handleMarkSubmitted = (exportType: string, system: 'SIGRH' | 'SGP-e') => {
        onAddExport({ export_type: exportType, month_ref: currentMonth, submitted_date: today.toISOString().split('T')[0], responsible: 'Operador B1', system });
    };

    const generateSIGRHData = () => {
        const lines = personnelList.map(p => [
            p.name, p.war_name || '', p.graduation || '', p.cpf || '', p.birth_date || '',
            p.cnh_category || '', p.cnh_number || '', p.status, p.email || '', p.phone || '',
            p.education_level || '', p.cve_active || '', p.cve_issue_date || '', p.cve_expiry_date || '',
        ].join('\t'));
        const blob = new Blob([['Nome\tGuerra\tGraduação\tCPF\tNascimento\tCNH Cat\tCNH Nº\tStatus\tEmail\tTelefone\tInstrução\tCVE\tCVE Emissão\tCVE Validade', ...lines].join('\n')], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `sigrh_efetivo_${currentMonth}.tsv`; a.click();
        URL.revokeObjectURL(url);
    };

    const generateFrequencySheet = (person: Personnel) => {
        const month = today.getMonth();
        const year = today.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthName = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        let html = `<html><head><style>
      body{font-family:Arial;font-size:11px;margin:20px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #000;padding:4px;text-align:center}
      h2{text-align:center;margin:0}
      .header{text-align:center;font-size:10px;margin-bottom:5px}
      @media print{@page{size:A4;margin:15mm}}
    </style></head><body>
    <div class="header">CORPO DE BOMBEIROS MILITAR DE SANTA CATARINA<br>7º BATALHÃO DE BOMBEIROS MILITAR</div>
    <h2>FICHA DE FREQUÊNCIA</h2>
    <p><b>Nome:</b> ${person.name} | <b>Graduação:</b> ${person.graduation || '—'} | <b>CPF:</b> ${person.cpf || '—'}</p>
    <p><b>Mês de Referência:</b> ${monthName}</p>
    <table><tr><th>Dia</th><th>Presença</th><th>Horas</th><th>Justificativa</th></tr>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const onVac = vacations.some(v => v.personnel_id === person.id && dateStr >= v.start_date && dateStr <= v.end_date);
            html += `<tr><td>${d}</td><td>${onVac ? 'FÉRIAS' : ''}</td><td>${onVac ? '—' : ''}</td><td></td></tr>`;
        }

        html += `</table><br><br>
    <table style="width:60%;margin:auto"><tr><td style="border:0;border-top:1px solid #000;text-align:center;padding-top:5px">
    Assinatura do Responsável</td></tr></table>
    <p style="text-align:center;font-size:9px;margin-top:30px">Gerado pelo Sistema Interno de Gestão — 7ºBBM/CBMSC</p>
    </body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) win.onload = () => { win.print(); };
    };

    const generateVacationSchedule = () => {
        const lines = vacations.map(v => {
            const p = personnelList.find(pp => pp.id === v.personnel_id);
            return [p?.name || v.full_name, p?.graduation || '', p?.cpf || '', v.start_date, v.end_date, String(v.day_count), v.status || '', v.notes || ''].join('\t');
        });
        const blob = new Blob([['Nome\tGraduação\tCPF\tInício\tFim\tDias\tStatus\tObs', ...lines].join('\n')], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `sgpe_ferias_${currentMonth}.tsv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                {(['sigrh', 'sgpe', 'checklist'] as const).map(t => (
                    <button key={t} onClick={() => setActiveSubTab(t)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase ${activeSubTab === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {t === 'sigrh' ? 'SIGRH' : t === 'sgpe' ? 'SGP-e' : 'Checklist'}
                    </button>
                ))}
            </div>

            {activeSubTab === 'sigrh' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
                    <h3 className="font-black text-lg">Exportações SIGRH</h3>
                    <p className="text-xs text-gray-500">Gere dados formatados para inserção manual no SIGRH.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button onClick={generateSIGRHData} className="p-4 bg-stone-50 rounded-xl border border-rustic-border hover:bg-stone-100 transition-all text-left">
                            <span className="material-symbols-outlined text-primary mb-2 block">table_view</span>
                            <span className="font-bold text-sm block">Cadastro Completo</span>
                            <span className="text-[10px] text-gray-400">Dados de todos os militares em formato SIGRH</span>
                        </button>
                    </div>
                </div>
            )}

            {activeSubTab === 'sgpe' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
                    <h3 className="font-black text-lg">Exportações SGP-e</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-stone-50 rounded-xl border border-rustic-border">
                            <span className="material-symbols-outlined text-primary mb-2 block">badge</span>
                            <span className="font-bold text-sm block mb-2">Fichas de Frequência</span>
                            <p className="text-[10px] text-gray-400 mb-3">Selecione um militar para gerar a ficha mensal em formato A4.</p>
                            <select onChange={e => { if (e.target.value) { const p = personnelList.find(pp => pp.id === Number(e.target.value)); if (p) generateFrequencySheet(p); e.target.value = ''; } }} className="w-full h-9 px-3 rounded-lg border text-xs">
                                <option value="">Selecionar militar...</option>
                                {personnelList.map(p => <option key={p.id} value={p.id}>{p.graduation ? `${p.graduation} ` : ''}{p.name}</option>)}
                            </select>
                        </div>
                        <button onClick={generateVacationSchedule} className="p-4 bg-stone-50 rounded-xl border border-rustic-border hover:bg-stone-100 transition-all text-left">
                            <span className="material-symbols-outlined text-primary mb-2 block">calendar_month</span>
                            <span className="font-bold text-sm block">Programação de Férias</span>
                            <span className="text-[10px] text-gray-400">Exportar para formato SGP-e</span>
                        </button>
                    </div>
                </div>
            )}

            {activeSubTab === 'checklist' && (
                <div className="bg-white p-6 rounded-2xl border border-rustic-border shadow-sm space-y-4">
                    <h3 className="font-black text-lg">Checklist de Submissões</h3>
                    <p className="text-xs text-gray-500">Registre quais exportações já foram submetidas aos sistemas oficiais.</p>
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-[10px] font-black uppercase text-gray-500">
                            <tr><th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3">Sistema</th><th className="px-4 py-3">Mês Ref.</th><th className="px-4 py-3">Data Submissão</th><th className="px-4 py-3">Responsável</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {exports.map(e => (
                                <tr key={e.id}><td className="px-4 py-2 font-bold">{e.export_type}</td><td className="px-4 py-2 text-center">{e.system}</td><td className="px-4 py-2 text-center">{e.month_ref}</td><td className="px-4 py-2 text-center">{e.submitted_date ? new Date(e.submitted_date).toLocaleDateString('pt-BR') : '—'}</td><td className="px-4 py-2 text-center">{e.responsible || '—'}</td></tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="flex gap-3 flex-wrap pt-4">
                        <button onClick={() => handleMarkSubmitted('Cadastro Efetivo', 'SIGRH')} className="px-4 py-2 bg-green-600 text-white text-[10px] font-black rounded-lg">✓ Cadastro → SIGRH</button>
                        <button onClick={() => handleMarkSubmitted('Ficha Frequência', 'SGP-e')} className="px-4 py-2 bg-green-600 text-white text-[10px] font-black rounded-lg">✓ Frequência → SGP-e</button>
                        <button onClick={() => handleMarkSubmitted('Prog. Férias', 'SGP-e')} className="px-4 py-2 bg-green-600 text-white text-[10px] font-black rounded-lg">✓ Férias → SGP-e</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportSection;
