import React from 'react';
import { Personnel, Vacation } from '../../services/types';

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
}

const ReadinessReport: React.FC<Props> = ({ personnelList, vacations }) => {
    const today = new Date();
    const totalRegistered = personnelList.length;
    const totalActive = personnelList.filter(p => p.status === 'Ativo').length;
    const totalVacation = personnelList.filter(p => p.status === 'Férias').length;
    const totalLeave = personnelList.filter(p => ['Licença', 'Afastado', 'Cedido'].includes(p.status)).length;
    const totalAvailable = totalActive;

    const expiredCVE = personnelList.filter(p => p.cve_expiry_date && new Date(p.cve_expiry_date) <= today).length;
    const expiringCVE = personnelList.filter(p => {
        if (!p.cve_expiry_date) return false;
        const exp = new Date(p.cve_expiry_date);
        const in60 = new Date(today);
        in60.setDate(in60.getDate() + 60);
        return exp > today && exp <= in60;
    }).length;

    const expiredTox = personnelList.filter(p => p.cnh_category?.includes('D') && p.toxicological_expiry_date && new Date(p.toxicological_expiry_date) <= today).length;
    const expiredCNH = personnelList.filter(p => p.cnh_expiry_date && new Date(p.cnh_expiry_date) <= today).length;

    // Week coverage
    const weekDays: { date: Date; available: number; onVacation: string[] }[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const onVac = vacations.filter(v => dateStr >= v.start_date && dateStr <= v.end_date).map(v => v.full_name);
        weekDays.push({ date: d, available: totalActive - onVac.length, onVacation: onVac });
    }

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-black text-xl">Relatório de Prontidão Operacional</h3>
                <button onClick={handlePrint} className="px-4 py-2 bg-primary text-white text-xs font-black rounded-lg flex items-center gap-2 hover:brightness-110">
                    <span className="material-symbols-outlined text-[16px]">print</span> IMPRIMIR / PDF
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-rustic-border shadow-sm p-8 print:shadow-none print:border-0" id="readiness-report">
                <div className="text-center mb-8 border-b pb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">CORPO DE BOMBEIROS MILITAR DE SANTA CATARINA</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">7º BATALHÃO DE BOMBEIROS MILITAR — ARAQUARI</p>
                    <h2 className="text-xl font-black mt-2">RELATÓRIO DE PRONTIDÃO</h2>
                    <p className="text-sm text-gray-500">{today.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                {/* Summary Table */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="text-center p-4 bg-stone-50 rounded-xl">
                        <p className="text-3xl font-black">{totalRegistered}</p>
                        <p className="text-[10px] font-bold uppercase text-gray-400">Efetivo Total</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                        <p className="text-3xl font-black text-green-700">{totalAvailable}</p>
                        <p className="text-[10px] font-bold uppercase text-green-600">Disponíveis</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                        <p className="text-3xl font-black text-blue-700">{totalVacation}</p>
                        <p className="text-[10px] font-bold uppercase text-blue-600">Em Férias</p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-xl">
                        <p className="text-3xl font-black text-amber-700">{totalLeave}</p>
                        <p className="text-[10px] font-bold uppercase text-amber-600">Licença/Afastado</p>
                    </div>
                </div>

                {/* Documents Status */}
                <div className="mb-8">
                    <h4 className="font-black text-sm uppercase mb-3 text-gray-700">Situação Documental</h4>
                    <table className="w-full text-sm">
                        <thead className="bg-stone-100 text-[10px] font-black uppercase text-gray-500">
                            <tr><th className="px-4 py-2 text-left">Documento</th><th className="px-4 py-2 text-center">Expirados</th><th className="px-4 py-2 text-center">Expirando (60d)</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            <tr><td className="px-4 py-2 font-bold">CVE</td><td className="px-4 py-2 text-center"><span className={expiredCVE > 0 ? 'text-red-600 font-black' : ''}>{expiredCVE}</span></td><td className="px-4 py-2 text-center"><span className={expiringCVE > 0 ? 'text-amber-600 font-black' : ''}>{expiringCVE}</span></td></tr>
                            <tr><td className="px-4 py-2 font-bold">Toxicológico (CNH D)</td><td className="px-4 py-2 text-center"><span className={expiredTox > 0 ? 'text-red-600 font-black' : ''}>{expiredTox}</span></td><td className="px-4 py-2 text-center">—</td></tr>
                            <tr><td className="px-4 py-2 font-bold">CNH</td><td className="px-4 py-2 text-center"><span className={expiredCNH > 0 ? 'text-red-600 font-black' : ''}>{expiredCNH}</span></td><td className="px-4 py-2 text-center">—</td></tr>
                        </tbody>
                    </table>
                </div>

                {/* Week Coverage */}
                <div className="mb-8">
                    <h4 className="font-black text-sm uppercase mb-3 text-gray-700">Cobertura Semanal</h4>
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((d, i) => (
                            <div key={i} className="text-center p-3 bg-stone-50 rounded-xl">
                                <p className="text-[9px] font-black uppercase text-gray-400">{d.date.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                                <p className="text-lg font-black">{d.available}</p>
                                <p className="text-[9px] text-gray-400">{d.date.getDate()}/{d.date.getMonth() + 1}</p>
                                {d.onVacation.length > 0 && <p className="text-[8px] text-blue-500 mt-1">-{d.onVacation.length} férias</p>}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center text-[9px] text-gray-400 mt-8 pt-4 border-t">
                    Gerado automaticamente pelo Sistema Interno de Gestão — 7ºBBM/CBMSC — {today.toLocaleString('pt-BR')}
                </div>
            </div>
        </div>
    );
};

export default ReadinessReport;
