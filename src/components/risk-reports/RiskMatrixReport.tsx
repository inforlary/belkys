import { useState, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export default function RiskMatrixReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('risks')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (data) setRisks(data);
    } catch (error) {
      console.error('Error loading risks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createMatrix = (useInherent: boolean) => {
    const matrix: number[][] = Array(5).fill(0).map(() => Array(5).fill(0));

    risks.forEach(risk => {
      const score = useInherent ? risk.inherent_score : risk.residual_score;
      const likelihood = risk.likelihood || Math.ceil(Math.sqrt(score));
      const impact = Math.ceil(score / likelihood);

      const row = Math.min(5, Math.max(1, likelihood)) - 1;
      const col = Math.min(5, Math.max(1, impact)) - 1;
      matrix[4 - row][col]++;
    });

    return matrix;
  };

  const inherentMatrix = createMatrix(true);
  const residualMatrix = createMatrix(false);

  const getLevelStats = (useInherent: boolean) => {
    const getRiskLevel = (score: number) => {
      if (score >= 15) return 'Çok Yüksek';
      if (score >= 10) return 'Yüksek';
      if (score >= 5) return 'Orta';
      return 'Düşük';
    };

    const levels = {
      'Çok Yüksek': 0,
      'Yüksek': 0,
      'Orta': 0,
      'Düşük': 0
    };

    risks.forEach(risk => {
      const score = useInherent ? risk.inherent_score : risk.residual_score;
      const level = getRiskLevel(score);
      levels[level]++;
    });

    return levels;
  };

  const inherentLevels = getLevelStats(true);
  const residualLevels = getLevelStats(false);

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('RISK MATRIS RAPORU', 14, 20);

    doc.setFontSize(10);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    let yPos = 40;

    doc.setFontSize(14);
    doc.text('1. DOGAL RISK MATRISI', 14, yPos);
    yPos += 10;

    (doc as any).autoTable({
      startY: yPos,
      head: [['O/E', '1', '2', '3', '4', '5']],
      body: inherentMatrix.map((row, i) => [`${5-i}`, ...row.map(v => v > 0 ? v.toString() : '')]),
      styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.text('2. ARTIK RISK MATRISI', 14, yPos);
    yPos += 10;

    (doc as any).autoTable({
      startY: yPos,
      head: [['O/E', '1', '2', '3', '4', '5']],
      body: residualMatrix.map((row, i) => [`${5-i}`, ...row.map(v => v > 0 ? v.toString() : '')]),
      styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.text('3. KARSILASTIRMA', 14, yPos);
    yPos += 10;

    const comparisonData = Object.keys(inherentLevels).map(level => [
      level,
      inherentLevels[level].toString(),
      residualLevels[level].toString(),
      (residualLevels[level] - inherentLevels[level]).toString()
    ]);

    (doc as any).autoTable({
      startY: yPos,
      head: [['Seviye', 'Dogal', 'Artik', 'Degisim']],
      body: comparisonData,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 }
    });

    doc.save('risk-matris-raporu.pdf');
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([
      ['DOĞAL RİSK MATRİSİ'],
      [''],
      ...inherentMatrix
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Doğal Risk');

    const ws2 = XLSX.utils.aoa_to_sheet([
      ['ARTIK RİSK MATRİSİ'],
      [''],
      ...residualMatrix
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Artık Risk');

    XLSX.writeFile(wb, 'risk-matris-raporu.xlsx');
  };

  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count <= 2) return 'bg-yellow-200';
    if (count <= 4) return 'bg-orange-300';
    return 'bg-red-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risk Matris Raporu</h1>
          <p className="text-sm text-slate-600 mt-1">5x5 risk matrisi ve karşılaştırma</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        <div className="flex gap-2 justify-end">
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">1. DOĞAL RİSK MATRİSİ</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-12 h-12 border border-slate-300 bg-slate-50 text-xs">O/E</th>
                  {[1, 2, 3, 4, 5].map(i => (
                    <th key={i} className="w-20 h-12 border border-slate-300 bg-slate-50 text-sm">{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inherentMatrix.map((row, i) => (
                  <tr key={i}>
                    <td className="w-12 h-16 border border-slate-300 bg-slate-50 text-center font-semibold">
                      {5 - i}
                    </td>
                    {row.map((count, j) => (
                      <td
                        key={j}
                        className={`w-20 h-16 border border-slate-300 text-center font-semibold ${getCellColor(count)}`}
                      >
                        {count > 0 ? count : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">O: Olasılık (1-5), E: Etki (1-5)</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">2. ARTIK RİSK MATRİSİ</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-12 h-12 border border-slate-300 bg-slate-50 text-xs">O/E</th>
                  {[1, 2, 3, 4, 5].map(i => (
                    <th key={i} className="w-20 h-12 border border-slate-300 bg-slate-50 text-sm">{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {residualMatrix.map((row, i) => (
                  <tr key={i}>
                    <td className="w-12 h-16 border border-slate-300 bg-slate-50 text-center font-semibold">
                      {5 - i}
                    </td>
                    {row.map((count, j) => (
                      <td
                        key={j}
                        className={`w-20 h-16 border border-slate-300 text-center font-semibold ${getCellColor(count)}`}
                      >
                        {count > 0 ? count : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">3. KARŞILAŞTIRMA</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Seviye</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Doğal</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Artık</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Değişim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.keys(inherentLevels).map(level => {
                  const inherent = inherentLevels[level];
                  const residual = residualLevels[level];
                  const change = residual - inherent;
                  const changePercent = inherent > 0 ? Math.abs((change / inherent) * 100).toFixed(0) : 0;

                  return (
                    <tr key={level}>
                      <td className="px-4 py-3 text-sm font-medium">{level}</td>
                      <td className="px-4 py-3 text-sm text-center">{inherent}</td>
                      <td className="px-4 py-3 text-sm text-center">{residual}</td>
                      <td className="px-4 py-3 text-sm">
                        {change !== 0 && (
                          <span className={change < 0 ? 'text-green-600' : 'text-red-600'}>
                            {change > 0 ? '+' : ''}{change} ({changePercent}% {change < 0 ? 'azalma' : 'artış'})
                          </span>
                        )}
                        {change === 0 && <span className="text-slate-500">Değişim yok</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
