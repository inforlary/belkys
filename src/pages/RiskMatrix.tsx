import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Grid, FileDown, FileSpreadsheet, X, ExternalLink, TrendingDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface Risk {
  id: string;
  code: string;
  name: string;
  category_id: string;
  owner_department_id: string;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  status: string;
  created_at: string;
  categories?: Array<{
    category_id: string;
    category: {
      id: string;
      name: string;
      code: string;
    };
  }>;
  department?: {
    name: string;
  };
}

const LIKELIHOOD_LABELS = ['Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'];
const IMPACT_LABELS = ['Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'];

function getCellColor(score: number): string {
  if (score >= 20) return 'bg-gray-800 text-white';
  if (score >= 15) return 'bg-red-500 text-white';
  if (score >= 10) return 'bg-orange-500 text-white';
  if (score >= 5) return 'bg-yellow-500 text-black';
  return 'bg-green-500 text-white';
}

function getRiskLevelLabel(score: number): string {
  if (score >= 20) return 'Kritik';
  if (score >= 15) return 'Çok Yüksek';
  if (score >= 10) return 'Yüksek';
  if (score >= 5) return 'Orta';
  return 'Düşük';
}

function getRiskLevelEmoji(score: number): string {
  if (score >= 20) return '⬛';
  if (score >= 15) return '🔴';
  if (score >= 10) return '🟠';
  if (score >= 5) return '🟡';
  return '🟢';
}

export default function RiskMatrix() {
  const { navigate } = useLocation();
  const { profile } = useAuth();
  const matrixRef = useRef<HTMLDivElement>(null);

  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    department: '',
    category: '',
    status: ''
  });

  const [viewMode, setViewMode] = useState<'inherent' | 'residual'>('residual');
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [profile?.organization_id]);

  async function loadData() {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [risksRes, categoriesRes, departmentsRes] = await Promise.all([
        supabase
          .from('risks')
          .select(`
            *,
            categories:risk_category_mappings(category_id, category:risk_categories(id, name, code)),
            department:departments!owner_department_id(name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('risk_categories')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('name', { ascending: true }),
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('name', { ascending: true })
      ]);

      if (risksRes.error) throw risksRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;

      setRisks(risksRes.data || []);
      setCategories(categoriesRes.data || []);
      setDepartments(departmentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRisks = risks.filter(risk => {
    if (filters.department && risk.owner_department_id !== filters.department) return false;
    if (filters.category) {
      const hasCategory = risk.categories?.some((c: any) => c.category_id === filters.category);
      if (!hasCategory) return false;
    }
    if (filters.status && risk.status !== filters.status) return false;
    return true;
  });

  function getRisksInCell(likelihood: number, impact: number): Risk[] {
    return filteredRisks.filter(risk => {
      if (viewMode === 'inherent') {
        return risk.inherent_likelihood === likelihood && risk.inherent_impact === impact;
      } else {
        return risk.residual_likelihood === likelihood && risk.residual_impact === impact;
      }
    });
  }

  function getCellRisks(): Risk[] {
    if (!selectedCell) return [];
    return getRisksInCell(selectedCell.likelihood, selectedCell.impact);
  }

  const statistics = {
    total: filteredRisks.length,
    critical: filteredRisks.filter(r => {
      const score = viewMode === 'inherent' ? r.inherent_score : r.residual_score;
      return score >= 20;
    }).length,
    veryHigh: filteredRisks.filter(r => {
      const score = viewMode === 'inherent' ? r.inherent_score : r.residual_score;
      return score >= 15 && score <= 19;
    }).length,
    high: filteredRisks.filter(r => {
      const score = viewMode === 'inherent' ? r.inherent_score : r.residual_score;
      return score >= 10 && score <= 14;
    }).length,
    medium: filteredRisks.filter(r => {
      const score = viewMode === 'inherent' ? r.inherent_score : r.residual_score;
      return score >= 5 && score <= 9;
    }).length,
    low: filteredRisks.filter(r => {
      const score = viewMode === 'inherent' ? r.inherent_score : r.residual_score;
      return score >= 1 && score <= 4;
    }).length
  };

  async function exportToPDF() {
    if (!matrixRef.current) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(matrixRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`risk-matrisi-${viewMode}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF oluşturulurken hata oluştu.');
    } finally {
      setExporting(false);
    }
  }

  async function exportToExcel() {
    try {
      const wsData = [
        ['Risk Matrisi - ' + (viewMode === 'inherent' ? 'Doğal Risk' : 'Artık Risk')],
        ['Tarih: ' + new Date().toLocaleDateString('tr-TR')],
        [],
        ['Kod', 'Risk Adı', 'Kategori', 'Birim', 'Olasılık', 'Etki', 'Skor', 'Seviye']
      ];

      filteredRisks.forEach(risk => {
        const likelihood = viewMode === 'inherent' ? risk.inherent_likelihood : risk.residual_likelihood;
        const impact = viewMode === 'inherent' ? risk.inherent_impact : risk.residual_impact;
        const score = viewMode === 'inherent' ? risk.inherent_score : risk.residual_score;

        wsData.push([
          risk.code,
          risk.name,
          risk.categories && risk.categories.length > 0
            ? risk.categories.map(c => c.category?.name).filter(Boolean).join(', ')
            : '-',
          risk.department?.name || '-',
          likelihood,
          impact,
          score,
          getRiskLevelLabel(score)
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Risk Matrisi');
      XLSX.writeFile(wb, `risk-matrisi-${viewMode}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Excel export error:', error);
      alert('Excel oluşturulurken hata oluştu.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  const topRisks = [...filteredRisks]
    .sort((a, b) => {
      const scoreA = viewMode === 'inherent' ? a.inherent_score : a.residual_score;
      const scoreB = viewMode === 'inherent' ? b.inherent_score : b.residual_score;
      return scoreB - scoreA;
    })
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Grid className="w-7 h-7" />
            Risk Matrisi
          </h1>
          <p className="text-gray-600 mt-1">5x5 risk değerlendirme matrisi</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <FileDown className="w-4 h-4" />
            PDF İndir
          </button>
          <button
            onClick={exportToExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel İndir
          </button>
        </div>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1">
              <div>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Kategori ▼</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Birim ▼</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Durum ▼</option>
                  <option value="DRAFT">Taslak</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="IDENTIFIED">Tespit Edildi</option>
                  <option value="ASSESSING">Değerlendiriliyor</option>
                  <option value="TREATING">Tedavi Ediliyor</option>
                  <option value="MONITORING">İzlemede</option>
                  <option value="CLOSED">Kapalı</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Görünüm:</span>
              <button
                onClick={() => setViewMode('residual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'residual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ● Artık
              </button>
              <button
                onClick={() => setViewMode('inherent')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'inherent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ○ Doğal
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3" ref={matrixRef}>
          <Card>
            <div className="p-6">
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="text-center font-semibold text-gray-700 mb-4">ETKİ</div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="w-24 p-2 text-center"></th>
                        {[1, 2, 3, 4, 5].map(impact => (
                          <th key={impact} className="p-2 text-center text-sm font-semibold text-gray-700 min-w-[100px]">
                            <div className="text-base">{impact}</div>
                            <div className="text-xs font-normal text-gray-500">{IMPACT_LABELS[impact - 1]}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[5, 4, 3, 2, 1].map(likelihood => (
                        <tr key={likelihood}>
                          <td className="p-2 text-center">
                            <div className="text-sm font-semibold text-gray-700">{likelihood}</div>
                            <div className="text-xs text-gray-500 font-normal">{LIKELIHOOD_LABELS[likelihood - 1]}</div>
                          </td>
                          {[1, 2, 3, 4, 5].map(impact => {
                            const score = likelihood * impact;
                            const cellRisks = getRisksInCell(likelihood, impact);
                            const count = cellRisks.length;

                            return (
                              <td
                                key={impact}
                                className={`p-0 border-2 border-gray-300 cursor-pointer transition-all ${getCellColor(score)} ${
                                  count > 0 ? 'hover:opacity-80' : 'opacity-60'
                                }`}
                                onClick={() => {
                                  if (count > 0) {
                                    setSelectedCell({ likelihood, impact });
                                  }
                                }}
                                style={{ height: '100px', position: 'relative' }}
                              >
                                <div className="flex flex-col items-center justify-center h-full p-2">
                                  <div className="text-xs font-semibold mb-1">{score}</div>
                                  {count > 0 && (
                                    <div className="text-2xl font-bold">({count})</div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-600">OLASILIK</span>
                    <span className="text-sm text-gray-600">→</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Seviye Dağılımı</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">⬛ Kritik (20-25)</span>
                    <span className="text-gray-600">{statistics.critical} ({statistics.total > 0 ? Math.round((statistics.critical / statistics.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gray-800 h-2 rounded-full transition-all"
                      style={{ width: `${statistics.total > 0 ? (statistics.critical / statistics.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">🔴 Çok Yüksek (15-19)</span>
                    <span className="text-gray-600">{statistics.veryHigh} ({statistics.total > 0 ? Math.round((statistics.veryHigh / statistics.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${statistics.total > 0 ? (statistics.veryHigh / statistics.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">🟠 Yüksek (10-14)</span>
                    <span className="text-gray-600">{statistics.high} ({statistics.total > 0 ? Math.round((statistics.high / statistics.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${statistics.total > 0 ? (statistics.high / statistics.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">🟡 Orta (5-9)</span>
                    <span className="text-gray-600">{statistics.medium} ({statistics.total > 0 ? Math.round((statistics.medium / statistics.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full transition-all"
                      style={{ width: `${statistics.total > 0 ? (statistics.medium / statistics.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">🟢 Düşük (1-4)</span>
                    <span className="text-gray-600">{statistics.low} ({statistics.total > 0 ? Math.round((statistics.low / statistics.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${statistics.total > 0 ? (statistics.low / statistics.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
                  <div className="text-sm text-gray-600">TOPLAM RISK</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Tüm Riskler</h3>
            <button
              onClick={() => navigate('risk-management/risks')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              Tüm Listeye Git <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Adı</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Doğal</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Artık</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Değişim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topRisks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Risk bulunamadı
                    </td>
                  </tr>
                ) : (
                  topRisks.map(risk => {
                    const change = risk.inherent_score - risk.residual_score;
                    const changePercent = risk.inherent_score > 0 ? Math.round((change / risk.inherent_score) * 100) : 0;

                    return (
                      <tr key={risk.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{risk.code}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{risk.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-sm font-medium">
                            <span>{getRiskLevelEmoji(risk.inherent_score)}</span>
                            <span>{risk.inherent_score}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-sm font-medium">
                            <span>{getRiskLevelEmoji(risk.residual_score)}</span>
                            <span>{risk.residual_score}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {change > 0 && <TrendingDown className="w-4 h-4" />}
                            <span>↓ {change}</span>
                            <span className="text-xs">({changePercent}%)</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {selectedCell && getCellRisks().length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Skor {selectedCell.likelihood * selectedCell.impact} - {getRiskLevelLabel(selectedCell.likelihood * selectedCell.impact)} Risk
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {getCellRisks().length} risk bulundu
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {getCellRisks().map(risk => (
                  <div key={risk.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{risk.code} {risk.name}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span>Kategori: <span className="font-medium">
                            {risk.categories && risk.categories.length > 0
                              ? risk.categories.map(c => c.category?.name).filter(Boolean).join(', ')
                              : '-'}
                          </span></span>
                          <span>Birim: <span className="font-medium">{risk.department?.name || '-'}</span></span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCell(null);
                          navigate(`risk-management/risks/${risk.id}`);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1 whitespace-nowrap ml-4"
                      >
                        Detay <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
