import { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface RiskData {
  id: string;
  code: string;
  title: string;
  category: string;
  inherent_score: number;
  residual_score: number;
  response_strategy: string;
  status: string;
}

export default function RiskStatusReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [risks, setRisks] = useState<RiskData[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    category: '',
    department: '',
    level: '',
    status: ''
  });

  const [reportOptions, setReportOptions] = useState({
    summary: true,
    levelChart: true,
    categoryChart: true,
    riskList: true,
    controlSummary: true,
    activityStatus: false
  });

  const [exportFormat, setExportFormat] = useState<'screen' | 'pdf' | 'excel'>('screen');

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    try {
      const [risksRes, categoriesRes, deptRes] = await Promise.all([
        supabase
          .from('risks')
          .select('id, code, title, category_id, inherent_score, residual_score, response_strategy, status, owner_department_id')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('risk_categories')
          .select('*')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile.organization_id)
      ]);

      if (risksRes.data && categoriesRes.data) {
        const enrichedRisks = risksRes.data.map(risk => ({
          ...risk,
          category: categoriesRes.data.find(c => c.id === risk.category_id)?.name || 'Diğer'
        }));
        setRisks(enrichedRisks);
      }

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRisks = () => {
    return risks.filter(risk => {
      if (filters.category && risk.category !== filters.category) return false;
      if (filters.status && risk.status !== filters.status) return false;
      if (filters.level) {
        const level = getRiskLevel(risk.residual_score);
        if (level !== filters.level) return false;
      }
      return true;
    });
  };

  const getRiskLevel = (score: number) => {
    if (score >= 20) return 'Kritik';
    if (score >= 15) return 'Çok Yüksek';
    if (score >= 10) return 'Yüksek';
    if (score >= 5) return 'Orta';
    return 'Düşük';
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Kritik': return '#dc2626';
      case 'Çok Yüksek': return '#ea580c';
      case 'Yüksek': return '#f59e0b';
      case 'Orta': return '#eab308';
      case 'Düşük': return '#22c55e';
      default: return '#64748b';
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    setShowFilters(false);

    if (exportFormat === 'pdf') {
      await exportToPDF();
    } else if (exportFormat === 'excel') {
      await exportToExcel();
    }

    setGenerating(false);
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();
    const filteredRisks = getFilteredRisks();

    doc.setFontSize(18);
    doc.text('RISK DURUM RAPORU', 14, 20);

    doc.setFontSize(10);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);
    doc.text(`Hazirlayan: ${profile?.full_name || 'Sistem'}`, 14, 34);

    let yPos = 45;

    if (reportOptions.summary) {
      doc.setFontSize(14);
      doc.text('1. OZET ISTATISTIKLER', 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      const stats = [
        ['Toplam Risk Sayisi:', filteredRisks.length.toString()],
        ['Aktif Risk Sayisi:', filteredRisks.filter(r => r.status === 'active').length.toString()],
        ['Kapatilan Risk Sayisi:', filteredRisks.filter(r => r.status === 'closed').length.toString()],
        ['Ortalama Risk Skoru:', (filteredRisks.reduce((sum, r) => sum + r.residual_score, 0) / filteredRisks.length || 0).toFixed(1)],
        ['Kritik Risk Sayisi:', filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Kritik').length.toString()]
      ];

      stats.forEach(([label, value]) => {
        doc.text(`${label} ${value}`, 14, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    if (reportOptions.levelChart) {
      doc.setFontSize(14);
      doc.text('2. SEVIYE DAGILIMI', 14, yPos);
      yPos += 8;

      const levelStats = [
        ['Kritik', filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Kritik').length],
        ['Cok Yuksek', filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Çok Yüksek').length],
        ['Yuksek', filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Yüksek').length],
        ['Orta', filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Orta').length],
        ['Dusuk', filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Düşük').length]
      ];

      doc.setFontSize(10);
      levelStats.forEach(([level, count]) => {
        const percentage = filteredRisks.length > 0 ? ((count / filteredRisks.length) * 100).toFixed(0) : 0;
        doc.text(`${level}: ${count} (${percentage}%)`, 14, yPos);
        yPos += 6;
      });
      yPos += 10;
    }

    if (reportOptions.riskList && yPos < 250) {
      doc.setFontSize(14);
      doc.text('3. RISK LISTESI', 14, yPos);
      yPos += 8;

      const tableData = filteredRisks.slice(0, 20).map(risk => [
        risk.code || '-',
        risk.title.substring(0, 30) || '-',
        risk.category || '-',
        risk.inherent_score?.toString() || '0',
        risk.residual_score?.toString() || '0',
        getRiskLevel(risk.residual_score)
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['KOD', 'RISK ADI', 'KATEGORI', 'DOGAL', 'ARTIK', 'SEVIYE']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 }
      });
    }

    doc.save('risk-durum-raporu.pdf');
  };

  const exportToExcel = async () => {
    const filteredRisks = getFilteredRisks();
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['RİSK DURUM RAPORU'],
      ['Rapor Tarihi:', new Date().toLocaleDateString('tr-TR')],
      [''],
      ['ÖZET İSTATİSTİKLER'],
      ['Toplam Risk Sayısı', filteredRisks.length],
      ['Aktif Risk Sayısı', filteredRisks.filter(r => r.status === 'active').length],
      ['Kapatılan Risk Sayısı', filteredRisks.filter(r => r.status === 'closed').length],
      ['Ortalama Risk Skoru', (filteredRisks.reduce((sum, r) => sum + r.residual_score, 0) / filteredRisks.length || 0).toFixed(1)]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const riskData = filteredRisks.map(risk => ({
      'KOD': risk.code,
      'RİSK ADI': risk.title,
      'KATEGORİ': risk.category,
      'DOĞAL SKOR': risk.inherent_score,
      'ARTIK SKOR': risk.residual_score,
      'SEVİYE': getRiskLevel(risk.residual_score),
      'YANIT STRATEJİSİ': risk.response_strategy || '-',
      'DURUM': risk.status === 'active' ? 'Aktif' : 'Kapalı'
    }));

    const ws2 = XLSX.utils.json_to_sheet(riskData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Risk Listesi');

    XLSX.writeFile(wb, 'risk-durum-raporu.xlsx');
  };

  const filteredRisks = getFilteredRisks();

  const levelData = [
    { name: 'Kritik', value: filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Kritik').length, color: '#dc2626' },
    { name: 'Ç.Yüksek', value: filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Çok Yüksek').length, color: '#ea580c' },
    { name: 'Yüksek', value: filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Yüksek').length, color: '#f59e0b' },
    { name: 'Orta', value: filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Orta').length, color: '#eab308' },
    { name: 'Düşük', value: filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Düşük').length, color: '#22c55e' }
  ];

  const categoryData = Array.from(new Set(filteredRisks.map(r => r.category))).map(cat => ({
    name: cat,
    value: filteredRisks.filter(r => r.category === cat).length
  }));

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

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
          <h1 className="text-2xl font-bold text-slate-900">Risk Durum Raporu</h1>
          <p className="text-sm text-slate-600 mt-1">Tüm risklerin güncel durumu ve analizi</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h3 className="font-semibold text-slate-900">Filtreler ve Rapor Seçenekleri</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Tümü</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Seviye</label>
              <select
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Tümü</option>
                <option value="Kritik">Kritik</option>
                <option value="Çok Yüksek">Çok Yüksek</option>
                <option value="Yüksek">Yüksek</option>
                <option value="Orta">Orta</option>
                <option value="Düşük">Düşük</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Durum</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Tümü</option>
                <option value="active">Aktif</option>
                <option value="closed">Kapalı</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Rapor İçeriği</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(reportOptions).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setReportOptions({ ...reportOptions, [key]: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">
                    {key === 'summary' && 'Özet istatistikler'}
                    {key === 'levelChart' && 'Seviye dağılımı grafiği'}
                    {key === 'categoryChart' && 'Kategori dağılımı grafiği'}
                    {key === 'riskList' && 'Risk listesi'}
                    {key === 'controlSummary' && 'Kontrol özeti'}
                    {key === 'activityStatus' && 'Faaliyet durumu'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="screen"
                  checked={exportFormat === 'screen'}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="text-blue-600"
                />
                <span className="text-sm">Ekranda Görüntüle</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="pdf"
                  checked={exportFormat === 'pdf'}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="text-blue-600"
                />
                <span className="text-sm">PDF İndir</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="excel"
                  checked={exportFormat === 'excel'}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="text-blue-600"
                />
                <span className="text-sm">Excel İndir</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              İptal
            </button>
            <button
              onClick={generateReport}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Rapor Oluştur
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!showFilters && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">RİSK DURUM RAPORU</h2>
              <p className="text-sm text-slate-600">Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
            </div>
            <div className="flex gap-2">
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
          </div>

          <div className="p-6 space-y-8">
            {reportOptions.summary && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">1. ÖZET İSTATİSTİKLER</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600">Toplam Risk</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{filteredRisks.length}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600">Aktif Risk</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {filteredRisks.filter(r => r.status === 'active').length}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600">Kapatılan</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {filteredRisks.filter(r => r.status === 'closed').length}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600">Ortalama Skor</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {(filteredRisks.reduce((sum, r) => sum + r.residual_score, 0) / filteredRisks.length || 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600">Kritik Risk</div>
                    <div className="text-2xl font-bold text-red-600 mt-1">
                      {filteredRisks.filter(r => getRiskLevel(r.residual_score) === 'Kritik').length}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {reportOptions.levelChart && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">2. SEVİYE DAĞILIMI</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={levelData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6">
                      {levelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportOptions.categoryChart && categoryData.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">3. KATEGORİ DAĞILIMI</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportOptions.riskList && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">4. RİSK LİSTESİ</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">KOD</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">RİSK ADI</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">KATEGORİ</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">DOĞAL</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">ARTIK</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">SEVİYE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredRisks.slice(0, 20).map((risk) => {
                        const level = getRiskLevel(risk.residual_score);
                        return (
                          <tr key={risk.id}>
                            <td className="px-4 py-3 text-sm text-slate-900">{risk.code}</td>
                            <td className="px-4 py-3 text-sm text-slate-900">{risk.title}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{risk.category}</td>
                            <td className="px-4 py-3 text-sm text-slate-900">{risk.inherent_score}</td>
                            <td className="px-4 py-3 text-sm text-slate-900">{risk.residual_score}</td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className="px-2 py-1 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: getLevelColor(level) }}
                              >
                                {level}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
