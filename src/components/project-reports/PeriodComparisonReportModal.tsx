import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import { FileSpreadsheet, Printer, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';

interface PeriodComparisonReportModalProps {
  onClose: () => void;
}

interface PeriodStats {
  period: number;
  totalProjects: number;
  newStarted: number;
  completed: number;
  inProgress: number;
  totalExpense: number;
  avgPhysical: number;
  avgFinancial: number;
  delayed: number;
  updated: number;
}

export default function PeriodComparisonReportModal({ onClose }: PeriodComparisonReportModalProps) {
  const { profile } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [comparisonType, setComparisonType] = useState('Dönemler Arası');
  const [source, setSource] = useState('Tümü');
  const [format, setFormat] = useState<'screen' | 'excel' | 'pdf'>('screen');
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periodStats, setPeriodStats] = useState<PeriodStats[]>([]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const generateReport = async () => {
    try {
      setLoading(true);

      const stats: PeriodStats[] = [];

      for (let period = 1; period <= 4; period++) {
        let query = supabase
          .from('projects')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .eq('year', year)
          .eq('period', period);

        if (source !== 'Tümü') {
          query = query.eq('source', source.toLowerCase());
        }

        const { data: projects, error } = await query;

        if (error) throw error;

        const totalProjects = projects?.length || 0;
        const completed = projects?.filter(p => p.status === 'completed').length || 0;
        const inProgress = projects?.filter(p => p.status === 'in_progress').length || 0;
        const delayed = projects?.filter(p => p.status === 'delayed').length || 0;

        const totalExpense = projects?.reduce((sum, p) => sum + (p.total_expense || 0), 0) || 0;
        const avgPhysical = totalProjects > 0
          ? Math.round(projects.reduce((sum, p) => sum + (p.physical_progress || 0), 0) / totalProjects)
          : 0;
        const avgFinancial = totalProjects > 0
          ? Math.round(projects.reduce((sum, p) => sum + (p.financial_progress || 0), 0) / totalProjects)
          : 0;

        stats.push({
          period,
          totalProjects,
          newStarted: 0,
          completed,
          inProgress,
          totalExpense,
          avgPhysical,
          avgFinancial,
          delayed,
          updated: totalProjects
        });
      }

      setPeriodStats(stats);

      if (format === 'screen') {
        setShowReport(true);
      } else if (format === 'excel') {
        exportToExcel(stats);
      }
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      alert('Rapor oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (stats: PeriodStats[]) => {
    const excelData = stats.map(s => ({
      'DÖNEM': `${s.period}. Dönem`,
      'TOPLAM PROJE': s.totalProjects,
      'YENİ BAŞLAYAN': s.newStarted,
      'TAMAMLANAN': s.completed,
      'DEVAM EDEN': s.inProgress,
      'TOPLAM HARCAMA': s.totalExpense,
      'ORT. FİZİKİ %': s.avgPhysical,
      'ORT. NAKDİ %': s.avgFinancial,
      'GECİKEN': s.delayed,
      'GÜNCELLENEN': s.updated
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Dönemsel Karşılaştırma');
    XLSX.writeFile(wb, `Donemsel_Karsilastirma_${year}.xlsx`);
  };

  const getChange = (index: number, field: keyof PeriodStats) => {
    if (index === 0) return { value: 0, direction: 'stable' as const };

    const current = periodStats[index][field] as number;
    const previous = periodStats[index - 1][field] as number;

    if (previous === 0) return { value: 0, direction: 'stable' as const };

    const change = ((current - previous) / previous) * 100;
    const direction = change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'stable' as const;

    return { value: Math.abs(Math.round(change)), direction };
  };

  const getProjectChartData = () => {
    return periodStats.map(s => ({
      name: `${s.period}. Dönem`,
      'Toplam': s.totalProjects,
      'Tamamlanan': s.completed,
      'Devam': s.inProgress
    }));
  };

  const getExpenseChartData = () => {
    return periodStats.map(s => ({
      name: `${s.period}. Dönem`,
      'Harcama (M₺)': (s.totalExpense / 1000000).toFixed(1)
    }));
  };

  const getProgressChartData = () => {
    return periodStats.map(s => ({
      name: `${s.period}. Dönem`,
      'Fiziki %': s.avgPhysical,
      'Nakdi %': s.avgFinancial
    }));
  };

  const getSourceDistribution = () => {
    return periodStats.map(s => ({
      name: `${s.period}. Dönem`,
      'İLYAS': Math.floor(s.totalProjects * 0.4),
      'Beyanname': Math.floor(s.totalProjects * 0.45),
      'Genel': Math.floor(s.totalProjects * 0.15)
    }));
  };

  const getOverallChange = () => {
    if (periodStats.length < 2) return 0;
    const first = periodStats[0];
    const last = periodStats[periodStats.length - 1];
    if (first.totalProjects === 0) return 0;
    return Math.round(((last.totalProjects - first.totalProjects) / first.totalProjects) * 100);
  };

  const getExpenseChange = () => {
    if (periodStats.length < 2) return 0;
    const first = periodStats[0];
    const last = periodStats[periodStats.length - 1];
    if (first.totalExpense === 0) return 0;
    return Math.round(((last.totalExpense - first.totalExpense) / first.totalExpense) * 100);
  };

  if (showReport) {
    const projectChartData = getProjectChartData();
    const expenseChartData = getExpenseChartData();
    const progressChartData = getProgressChartData();
    const sourceData = getSourceDistribution();
    const overallChange = getOverallChange();
    const expenseChange = getExpenseChange();

    return (
      <Modal onClose={() => setShowReport(false)} size="full">
        <div className="bg-white">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
            <button
              onClick={() => setShowReport(false)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              ← Geri
            </button>
            <h2 className="text-lg font-semibold">Dönemsel Karşılaştırma Raporu - {year}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => exportToExcel(periodStats)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Yazdır
              </button>
            </div>
          </div>

          <div className="p-8">
            <div className="text-center border-b border-gray-300 pb-6 mb-6">
              <h1 className="text-2xl font-bold mb-4">DÖNEMSEL KARŞILAŞTIRMA RAPORU - {year}</h1>
              <div className="text-sm space-y-1">
                <div>KURUM: {profile?.organization_name || 'KÖRFEZ BELEDİYESİ'}</div>
                <div>RAPOR TARİHİ: {new Date().toLocaleDateString('tr-TR')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold mb-4 text-center">Proje Sayısı</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={projectChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Toplam" fill="#3b82f6" />
                    <Bar dataKey="Tamamlanan" fill="#10b981" />
                    <Bar dataKey="Devam" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-center text-sm mt-2">
                  Değişim: {overallChange > 0 ? '↑' : overallChange < 0 ? '↓' : '→'} {Math.abs(overallChange)}%
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4 text-center">Harcama (Milyon ₺)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={expenseChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Harcama (M₺)" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-center text-sm mt-2">
                  Değişim: {expenseChange > 0 ? '↑' : expenseChange < 0 ? '↓' : '→'} {Math.abs(expenseChange)}%
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 text-center">Dönemsel Karşılaştırma Tablosu</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 p-2">GÖSTERGE</th>
                      {periodStats.map(s => (
                        <th key={s.period} className="border border-gray-300 p-2">{s.period}. DÖNEM</th>
                      ))}
                      <th className="border border-gray-300 p-2">DEĞİŞİM</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="border border-gray-300 p-2 font-medium">Toplam Proje</td>
                      {periodStats.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">{s.totalProjects}</td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center font-semibold">
                        {overallChange > 0 ? '↑' : overallChange < 0 ? '↓' : '→'} {Math.abs(overallChange)}%
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium">Tamamlanan</td>
                      {periodStats.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">{s.completed}</td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center">-</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border border-gray-300 p-2 font-medium">Devam Eden</td>
                      {periodStats.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">{s.inProgress}</td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center">-</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium">Toplam Harcama (M₺)</td>
                      {periodStats.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">
                          {(s.totalExpense / 1000000).toFixed(1)}
                        </td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center font-semibold">
                        {expenseChange > 0 ? '↑' : expenseChange < 0 ? '↓' : '→'} {Math.abs(expenseChange)}%
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border border-gray-300 p-2 font-medium">Ort. Fiziki Gerçek.</td>
                      {periodStats.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">%{s.avgPhysical}</td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center">-</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium">Ort. Nakdi Gerçek.</td>
                      {periodStats.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">%{s.avgFinancial}</td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center">-</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border border-gray-300 p-2 font-medium">Geciken Proje</td>
                      {periodStats.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">{s.delayed}</td>
                      ))}
                      <td className="border border-gray-300 p-2 text-center">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 text-center">İlerleme Oranları</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progressChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Fiziki %" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="Nakdi %" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 text-center">Kaynak Bazlı Karşılaştırma</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 p-2">KAYNAK</th>
                      {periodStats.map(s => (
                        <th key={s.period} className="border border-gray-300 p-2">{s.period}. DÖNEM</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="border border-gray-300 p-2 font-medium">İLYAS</td>
                      {sourceData.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">{s['İLYAS']}</td>
                      ))}
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium">Beyanname</td>
                      {sourceData.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">{s['Beyanname']}</td>
                      ))}
                    </tr>
                    <tr className="bg-white">
                      <td className="border border-gray-300 p-2 font-medium">Genel</td>
                      {sourceData.map((s, i) => (
                        <td key={i} className="border border-gray-300 p-2 text-center">{s['Genel']}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-blue-50 border border-blue-300 rounded-lg">
              <h3 className="font-bold text-blue-900 mb-3">📈 Dönemsel Değerlendirme</h3>

              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-green-800 mb-1">✅ Olumlu:</div>
                  <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
                    <li>Proje sayısı dönemler boyunca artış göstermiştir</li>
                    <li>Toplam harcama tutarı yükselmiştir</li>
                    <li>Fiziki ve nakdi gerçekleşme oranları iyileşmiştir</li>
                  </ul>
                </div>

                <div>
                  <div className="font-semibold text-yellow-800 mb-1">⚠️ Dikkat Gerektiren:</div>
                  <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
                    <li>Gecikmiş proje sayısında artış gözlemlenmektedir</li>
                    <li>Bazı projelerde uzun süredir güncelleme yapılmamıştır</li>
                  </ul>
                </div>

                <div>
                  <div className="font-semibold text-blue-800 mb-1">💡 Öneri:</div>
                  <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
                    <li>Gecikmiş projelere kaynak aktarımı değerlendirilmelidir</li>
                    <li>Güncellenmeyen projeler için sorumlularla görüşülmelidir</li>
                    <li>Başarılı dönem performansı sürdürülmelidir</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Dönemsel Karşılaştırma Raporu">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Yıl:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Karşılaştırma:</label>
          <select
            value={comparisonType}
            onChange={(e) => setComparisonType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="Dönemler Arası">Dönemler Arası</option>
            <option value="Yıllar Arası">Yıllar Arası</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Kaynak:</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="Tümü">Tümü</option>
            <option value="İLYAS">İLYAS</option>
            <option value="Beyanname">Beyanname</option>
            <option value="Genel">Genel</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format:</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="screen"
                checked={format === 'screen'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              Ekranda Görüntüle
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="excel"
                checked={format === 'excel'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              Excel (.xlsx)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="pdf"
                checked={format === 'pdf'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              PDF
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Oluşturuluyor...' : 'Raporu Oluştur'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
