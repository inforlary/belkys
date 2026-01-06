import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Grid, FileDown, Image as ImageIcon, X, ExternalLink } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  risk_level: string;
  created_at: string;
  category?: {
    name: string;
  };
  department?: {
    name: string;
  };
}

const LIKELIHOOD_LABELS = ['Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'];
const IMPACT_LABELS = ['Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'];

function getCellColor(score: number): string {
  if (score >= 21) return 'bg-red-900';
  if (score >= 17) return 'bg-red-500';
  if (score >= 10) return 'bg-orange-500';
  if (score >= 5) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getRiskLevelLabel(score: number): string {
  if (score >= 21) return 'Kritik';
  if (score >= 17) return 'Çok Yüksek';
  if (score >= 10) return 'Yüksek';
  if (score >= 5) return 'Orta';
  return 'Düşük';
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
    year: '',
    department: '',
    category: '',
    status: 'ACTIVE'
  });

  const [viewMode, setViewMode] = useState<'inherent' | 'residual'>('residual');
  const [selectedCell, setSelectedCell] = useState<{ likelihood: number; impact: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ likelihood: number; impact: number } | null>(null);

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
            category:risk_categories(name),
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
    if (filters.year) {
      const riskYear = new Date(risk.created_at).getFullYear().toString();
      if (riskYear !== filters.year) return false;
    }
    if (filters.department && risk.owner_department_id !== filters.department) return false;
    if (filters.category && risk.category_id !== filters.category) return false;
    if (filters.status === 'ACTIVE' && (risk.status === 'CLOSED' || !risk.is_active)) return false;
    if (filters.status === 'CLOSED' && risk.status !== 'CLOSED') return false;
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
      return score >= 21;
    }).length,
    veryHigh: filteredRisks.filter(r => {
      const score = viewMode === 'inherent' ? r.inherent_score : r.residual_score;
      return score >= 17 && score <= 20;
    }).length,
    high: filteredRisks.filter(r => {
      const score = viewMode === 'inherent' ? r.inherent_score : r.residual_score;
      return score >= 10 && score <= 16;
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
      pdf.save(`risk-matrisi-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF oluşturulurken hata oluştu.');
    } finally {
      setExporting(false);
    }
  }

  async function exportToPNG() {
    if (!matrixRef.current) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(matrixRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `risk-matrisi-${new Date().toISOString().split('T')[0]}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('PNG export error:', error);
      alert('PNG oluşturulurken hata oluştu.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  const years = Array.from(new Set(risks.map(r => new Date(r.created_at).getFullYear()))).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Grid className="w-7 h-7" />
            Risk Matrisi 5x5
          </h1>
          <p className="text-gray-600 mt-1">Riskleri olasılık ve etki bazında görselleştirin</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={exportToPNG}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            PNG
          </button>
        </div>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dönem</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                <option value="ACTIVE">Aktif</option>
                <option value="CLOSED">Kapalı</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Görünüm</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('inherent')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'inherent'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Doğal Risk
                </button>
                <button
                  onClick={() => setViewMode('residual')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'residual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Artık Risk
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div ref={matrixRef}>
        <Card>
          <div className="p-6">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="w-32 p-2 text-center text-sm font-semibold text-gray-700 border border-gray-300">
                        <div>ETKİ</div>
                        <div className="text-xs text-gray-500 mt-1">↓</div>
                      </th>
                      {[1, 2, 3, 4, 5].map(impact => (
                        <th key={impact} className="p-2 text-center text-sm font-semibold text-gray-700 border border-gray-300 min-w-[140px]">
                          <div>{impact}</div>
                          <div className="text-xs font-normal">{IMPACT_LABELS[impact - 1]}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[5, 4, 3, 2, 1].map(likelihood => (
                      <tr key={likelihood}>
                        <td className="p-2 text-center text-sm font-semibold text-gray-700 border border-gray-300">
                          <div>{likelihood}</div>
                          <div className="text-xs font-normal">{LIKELIHOOD_LABELS[likelihood - 1]}</div>
                        </td>
                        {[1, 2, 3, 4, 5].map(impact => {
                          const score = likelihood * impact;
                          const cellRisks = getRisksInCell(likelihood, impact);
                          const isHovered = hoveredCell?.likelihood === likelihood && hoveredCell?.impact === impact;
                          const isSelected = selectedCell?.likelihood === likelihood && selectedCell?.impact === impact;

                          return (
                            <td
                              key={impact}
                              className={`p-3 border border-gray-300 cursor-pointer transition-all ${getCellColor(score)} ${
                                isHovered ? 'ring-4 ring-blue-400' : ''
                              } ${isSelected ? 'ring-4 ring-blue-600' : ''}`}
                              onClick={() => {
                                if (cellRisks.length > 0) {
                                  setSelectedCell(selectedCell?.likelihood === likelihood && selectedCell?.impact === impact ? null : { likelihood, impact });
                                }
                              }}
                              onMouseEnter={() => setHoveredCell({ likelihood, impact })}
                              onMouseLeave={() => setHoveredCell(null)}
                              style={{ minHeight: '120px', position: 'relative' }}
                            >
                              <div className="text-white">
                                <div className="text-xs font-bold mb-2">({score})</div>
                                <div className="space-y-1">
                                  {cellRisks.slice(0, 3).map(risk => (
                                    <div
                                      key={risk.id}
                                      className="bg-white/20 backdrop-blur-sm rounded px-2 py-1 text-xs hover:bg-white/40"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`risks/register/${risk.id}`);
                                      }}
                                    >
                                      {risk.code}
                                    </div>
                                  ))}
                                  {cellRisks.length > 3 && (
                                    <div className="text-xs text-white/80">+{cellRisks.length - 3} daha</div>
                                  )}
                                </div>
                              </div>

                              {isHovered && cellRisks.length > 0 && (
                                <div className="absolute z-10 left-full ml-2 top-0 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-3 w-64">
                                  <div className="text-sm font-semibold text-gray-900 mb-2">
                                    Riskler ({cellRisks.length})
                                  </div>
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {cellRisks.map(risk => (
                                      <div key={risk.id} className="text-xs text-gray-700 hover:bg-gray-50 p-1 rounded">
                                        <span className="font-medium">{risk.code}:</span> {risk.name}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                                    Tıklayarak filtrele
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-2 text-center text-sm font-semibold text-gray-700">
                  OLASILIK →
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {selectedCell && getCellRisks().length > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Seçili Hücredeki Riskler ({getCellRisks().length})
              </h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Risk Adı</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu Birim</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getCellRisks().map(risk => (
                    <tr key={risk.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{risk.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{risk.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{risk.department?.name || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`risks/register/${risk.id}`)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
                        >
                          Detay <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Özet İstatistikler</h3>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
              <div className="text-sm text-gray-600">Toplam Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-900">{statistics.critical}</div>
              <div className="text-sm text-gray-600">Kritik</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{statistics.veryHigh}</div>
              <div className="text-sm text-gray-600">Çok Yüksek</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{statistics.high}</div>
              <div className="text-sm text-gray-600">Yüksek</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{statistics.medium}</div>
              <div className="text-sm text-gray-600">Orta</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{statistics.low}</div>
              <div className="text-sm text-gray-600">Düşük</div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Renk Açıklaması</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded"></div>
                <span>Düşük (1-4)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-500 rounded"></div>
                <span>Orta (5-9)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-500 rounded"></div>
                <span>Yüksek (10-16)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-500 rounded"></div>
                <span>Çok Yüksek (17-20)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-900 rounded"></div>
                <span>Kritik (21-25)</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
