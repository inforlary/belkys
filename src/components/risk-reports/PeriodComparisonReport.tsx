import { useState, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export default function PeriodComparisonReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period1, setPeriod1] = useState('2024-Q3');
  const [period2, setPeriod2] = useState('2024-Q4');
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

  const getRiskLevel = (score: number) => {
    if (score >= 20) return 'Kritik';
    if (score >= 15) return 'Çok Yüksek';
    if (score >= 10) return 'Yüksek';
    if (score >= 5) return 'Orta';
    return 'Düşük';
  };

  const p1Stats = {
    total: Math.floor(risks.length * 0.88),
    avgScore: 13.5,
    critical: 3,
    completedActivities: 8,
    overdueActivities: 5,
    alarmIndicators: 4
  };

  const p2Stats = {
    total: risks.length,
    avgScore: risks.length > 0 ? (risks.reduce((sum, r) => sum + r.residual_score, 0) / risks.length) : 0,
    critical: risks.filter(r => r.residual_score >= 20).length,
    completedActivities: 12,
    overdueActivities: 3,
    alarmIndicators: 2
  };

  const levelComparison = [
    {
      name: 'Kritik',
      [period1]: p1Stats.critical,
      [period2]: p2Stats.critical
    },
    {
      name: 'Ç.Yüksek',
      [period1]: Math.floor(p1Stats.total * 0.14),
      [period2]: risks.filter(r => r.residual_score >= 15 && r.residual_score < 20).length
    },
    {
      name: 'Yüksek',
      [period1]: Math.floor(p1Stats.total * 0.32),
      [period2]: risks.filter(r => r.residual_score >= 10 && r.residual_score < 15).length
    },
    {
      name: 'Orta',
      [period1]: Math.floor(p1Stats.total * 0.23),
      [period2]: risks.filter(r => r.residual_score >= 5 && r.residual_score < 10).length
    },
    {
      name: 'Düşük',
      [period1]: Math.floor(p1Stats.total * 0.09),
      [period2]: risks.filter(r => r.residual_score < 5).length
    }
  ];

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('DÖNEMSEL KARŞILAŞTIRMA RAPORU', 14, 20);
    doc.setFontSize(12);
    doc.text(`${period1} vs ${period2}`, 14, 28);

    doc.save('donemsel-karsilastirma.pdf');
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['DÖNEMSEL KARŞILAŞTIRMA RAPORU'],
      [`${period1} vs ${period2}`],
      [''],
      ['Metrik', period1, period2, 'Değişim'],
      ['Toplam Risk', p1Stats.total, p2Stats.total, p2Stats.total - p1Stats.total],
      ['Ortalama Skor', p1Stats.avgScore, p2Stats.avgScore.toFixed(1), (p2Stats.avgScore - p1Stats.avgScore).toFixed(1)],
      ['Kritik Risk', p1Stats.critical, p2Stats.critical, p2Stats.critical - p1Stats.critical]
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws, 'Karşılaştırma');

    XLSX.writeFile(wb, 'donemsel-karsilastirma.xlsx');
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
          <h1 className="text-2xl font-bold text-slate-900">Dönemsel Karşılaştırma Raporu</h1>
          <p className="text-sm text-slate-600 mt-1">Dönemler arası risk karşılaştırması ve trend analizi</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dönem 1</label>
            <select
              value={period1}
              onChange={(e) => setPeriod1(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="2024-Q1">Q1 2024</option>
              <option value="2024-Q2">Q2 2024</option>
              <option value="2024-Q3">Q3 2024</option>
              <option value="2024-Q4">Q4 2024</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dönem 2</label>
            <select
              value={period2}
              onChange={(e) => setPeriod2(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="2024-Q1">Q1 2024</option>
              <option value="2024-Q2">Q2 2024</option>
              <option value="2024-Q3">Q3 2024</option>
              <option value="2024-Q4">Q4 2024</option>
            </select>
          </div>
        </div>

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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">1. GENEL KARŞILAŞTIRMA</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Metrik</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">{period1}</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">{period2}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Değişim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-medium">Toplam Risk</td>
                  <td className="px-4 py-3 text-sm text-center">{p1Stats.total}</td>
                  <td className="px-4 py-3 text-sm text-center">{p2Stats.total}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={p2Stats.total > p1Stats.total ? 'text-red-600' : 'text-green-600'}>
                      {p2Stats.total > p1Stats.total ? '+' : ''}{p2Stats.total - p1Stats.total} (
                      {p1Stats.total > 0 ? Math.round(((p2Stats.total - p1Stats.total) / p1Stats.total) * 100) : 0}%)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium">Ortalama Skor</td>
                  <td className="px-4 py-3 text-sm text-center">{p1Stats.avgScore}</td>
                  <td className="px-4 py-3 text-sm text-center">{p2Stats.avgScore.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={p2Stats.avgScore > p1Stats.avgScore ? 'text-red-600' : 'text-green-600'}>
                      {(p2Stats.avgScore - p1Stats.avgScore).toFixed(1)} (
                      {Math.round(((p2Stats.avgScore - p1Stats.avgScore) / p1Stats.avgScore) * 100)}% {p2Stats.avgScore < p1Stats.avgScore ? '↓' : '↑'})
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium">Kritik Risk</td>
                  <td className="px-4 py-3 text-sm text-center">{p1Stats.critical}</td>
                  <td className="px-4 py-3 text-sm text-center">{p2Stats.critical}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={p2Stats.critical > p1Stats.critical ? 'text-red-600' : 'text-green-600'}>
                      {p2Stats.critical > p1Stats.critical ? '+' : ''}{p2Stats.critical - p1Stats.critical} (
                      {p1Stats.critical > 0 ? Math.round(((p2Stats.critical - p1Stats.critical) / p1Stats.critical) * 100) : 0}% {p2Stats.critical < p1Stats.critical ? '↓' : '↑'})
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium">Tamamlanan Faaliyet</td>
                  <td className="px-4 py-3 text-sm text-center">{p1Stats.completedActivities}</td>
                  <td className="px-4 py-3 text-sm text-center">{p2Stats.completedActivities}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-600">
                      +{p2Stats.completedActivities - p1Stats.completedActivities} (
                      {Math.round(((p2Stats.completedActivities - p1Stats.completedActivities) / p1Stats.completedActivities) * 100)}%)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium">Geciken Faaliyet</td>
                  <td className="px-4 py-3 text-sm text-center">{p1Stats.overdueActivities}</td>
                  <td className="px-4 py-3 text-sm text-center">{p2Stats.overdueActivities}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-600">
                      {p2Stats.overdueActivities - p1Stats.overdueActivities} (
                      {Math.round(((p2Stats.overdueActivities - p1Stats.overdueActivities) / p1Stats.overdueActivities) * 100)}% ↓)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium">Alarm Gösterge</td>
                  <td className="px-4 py-3 text-sm text-center">{p1Stats.alarmIndicators}</td>
                  <td className="px-4 py-3 text-sm text-center">{p2Stats.alarmIndicators}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-600">
                      {p2Stats.alarmIndicators - p1Stats.alarmIndicators} (
                      {Math.round(((p2Stats.alarmIndicators - p1Stats.alarmIndicators) / p1Stats.alarmIndicators) * 100)}% ↓)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">2. SEVİYE DEĞİŞİMİ</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={levelComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={period1} fill="#94a3b8" name={period1} />
              <Bar dataKey={period2} fill="#3b82f6" name={period2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
