import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Shield, AlertTriangle, Download, Filter, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RiskStatistics {
  total_risks: number;
  by_category: any;
  by_status: any;
  by_level: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averages: {
    inherent_score: number;
    residual_score: number;
    risk_reduction: number;
    risk_reduction_pct: number;
  };
  appetite_violations: number;
  controls: {
    total: number;
    effective: number;
  };
  findings: {
    total: number;
    open: number;
  };
}

interface MatrixCell {
  likelihood: number;
  impact: number;
  risk_count: number;
  risk_ids: string[];
}

interface CategoryStat {
  risk_category: string;
  total_risks: number;
  avg_inherent_score: number;
  avg_residual_score: number;
  avg_risk_reduction: number;
  inherent_critical: number;
  inherent_high: number;
  inherent_medium: number;
  inherent_low: number;
  residual_critical: number;
  residual_high: number;
  residual_medium: number;
  residual_low: number;
}

interface OwnerStat {
  risk_owner_id: string;
  risk_owner_name: string;
  department_name: string;
  total_risks: number;
  high_risks: number;
  medium_risks: number;
  low_risks: number;
  avg_residual_score: number;
  avg_risk_reduction: number;
  open_findings: number;
  appetite_violations: number;
}

interface TrendData {
  assessment_month: string;
  avg_inherent_score: number;
  avg_residual_score: number;
  total_assessments: number;
  critical_risks: number;
  high_risks: number;
  medium_risks: number;
  low_risks: number;
}

const COLORS = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#facc15',
  low: '#22c55e',
  very_low: '#94a3b8'
};

const CATEGORY_LABELS: Record<string, string> = {
  strategic: 'Stratejik',
  operational: 'Operasyonel',
  financial: 'Finansal',
  compliance: 'Uyumluluk',
  reputational: 'İtibar'
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Tanımlanmış',
  assessed: 'Değerlendirilmiş',
  mitigating: 'Azaltma',
  monitored: 'İzleniyor',
  accepted: 'Kabul Edildi',
  closed: 'Kapatıldı'
};

export default function RiskReports() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();

  const [statistics, setStatistics] = useState<RiskStatistics | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixCell[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [ownerStats, setOwnerStats] = useState<OwnerStat[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'overview' | 'matrix' | 'category' | 'owner' | 'trend' | 'controls'>('overview');
  const [matrixType, setMatrixType] = useState<'inherent' | 'residual'>('residual');

  useEffect(() => {
    if (profile?.organization_id && selectedPlanId) {
      loadReportData();
    }
  }, [profile?.organization_id, selectedPlanId, reportType]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      if (reportType === 'overview' || reportType === 'controls') {
        await loadStatistics();
      }

      if (reportType === 'matrix') {
        await loadMatrixData();
      }

      if (reportType === 'category') {
        await loadCategoryStats();
      }

      if (reportType === 'owner') {
        await loadOwnerStats();
      }

      if (reportType === 'trend') {
        await loadTrendData();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    const { data, error } = await supabase.rpc('get_risk_statistics', {
      p_organization_id: profile?.organization_id,
      p_plan_id: selectedPlanId
    });

    if (error) throw error;
    setStatistics(data);
  };

  const loadMatrixData = async () => {
    const { data, error } = await supabase.rpc('get_risk_matrix_data', {
      p_organization_id: profile?.organization_id,
      p_plan_id: selectedPlanId,
      p_risk_type: matrixType
    });

    if (error) throw error;
    setMatrixData(data || []);
  };

  const loadCategoryStats = async () => {
    const { data, error } = await supabase
      .from('v_risk_category_stats')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .eq('ic_plan_id', selectedPlanId);

    if (error) throw error;
    setCategoryStats(data || []);
  };

  const loadOwnerStats = async () => {
    const { data, error } = await supabase
      .from('v_risk_owner_stats')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .eq('ic_plan_id', selectedPlanId)
      .order('total_risks', { ascending: false });

    if (error) throw error;
    setOwnerStats(data || []);
  };

  const loadTrendData = async () => {
    const { data, error } = await supabase.rpc('get_risk_trend_data', {
      p_organization_id: profile?.organization_id,
      p_plan_id: selectedPlanId,
      p_months: 12
    });

    if (error) throw error;
    setTrendData((data || []).reverse());
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Risk Yönetimi Raporu', 14, 20);

    doc.setFontSize(11);
    doc.text(`Organizasyon: ${profile?.organization_name || ''}`, 14, 30);
    doc.text(`Plan: ${selectedPlan?.plan_name || ''}`, 14, 36);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 42);

    if (reportType === 'overview' && statistics) {
      doc.setFontSize(14);
      doc.text('Genel Bakış', 14, 55);

      const overviewData = [
        ['Toplam Risk Sayısı', statistics.total_risks.toString()],
        ['Kritik Risk', statistics.by_level.critical.toString()],
        ['Yüksek Risk', statistics.by_level.high.toString()],
        ['Orta Risk', statistics.by_level.medium.toString()],
        ['Düşük Risk', statistics.by_level.low.toString()],
        ['Ortalama Doğal Risk', statistics.averages.inherent_score.toFixed(2)],
        ['Ortalama Artık Risk', statistics.averages.residual_score.toFixed(2)],
        ['Ortalama Risk Azalması', `${statistics.averages.risk_reduction_pct.toFixed(1)}%`],
        ['İştah İhlali', statistics.appetite_violations.toString()],
        ['Toplam Kontrol', statistics.controls.total.toString()],
        ['Etkin Kontrol', statistics.controls.effective.toString()],
        ['Açık Bulgu', statistics.findings.open.toString()]
      ];

      autoTable(doc, {
        startY: 60,
        head: [['Metrik', 'Değer']],
        body: overviewData,
      });
    }

    if (reportType === 'category' && categoryStats.length > 0) {
      doc.setFontSize(14);
      doc.text('Kategori Analizi', 14, 55);

      const categoryData = categoryStats.map(cat => [
        CATEGORY_LABELS[cat.risk_category] || cat.risk_category,
        cat.total_risks.toString(),
        cat.avg_inherent_score.toFixed(2),
        cat.avg_residual_score.toFixed(2),
        cat.residual_critical.toString(),
        cat.residual_high.toString(),
        cat.residual_medium.toString()
      ]);

      autoTable(doc, {
        startY: 60,
        head: [['Kategori', 'Toplam', 'Ort. Doğal', 'Ort. Artık', 'Kritik', 'Yüksek', 'Orta']],
        body: categoryData,
      });
    }

    if (reportType === 'owner' && ownerStats.length > 0) {
      doc.setFontSize(14);
      doc.text('Risk Sahibi Performansı', 14, 55);

      const ownerData = ownerStats.map(owner => [
        owner.risk_owner_name,
        owner.department_name || '-',
        owner.total_risks.toString(),
        owner.high_risks.toString(),
        owner.avg_residual_score.toFixed(2),
        owner.open_findings.toString()
      ]);

      autoTable(doc, {
        startY: 60,
        head: [['Risk Sahibi', 'Departman', 'Toplam', 'Yüksek', 'Ort. Skor', 'Açık Bulgu']],
        body: ownerData,
      });
    }

    doc.save(`risk-raporu-${new Date().getTime()}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Raporları</h1>
          <p className="text-gray-500">Kapsamlı risk analizi ve raporlama</p>
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          <span>PDF İndir</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Genel Bakış', icon: BarChart3 },
              { id: 'matrix', label: 'Risk Matrisi', icon: AlertTriangle },
              { id: 'category', label: 'Kategori Analizi', icon: Filter },
              { id: 'owner', label: 'Risk Sahipleri', icon: Shield },
              { id: 'trend', label: 'Trend Analizi', icon: TrendingUp },
              { id: 'controls', label: 'Kontrol Etkinliği', icon: Shield }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setReportType(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  reportType === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {reportType === 'overview' && statistics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                  <div className="text-sm text-blue-600 mb-2">Toplam Risk</div>
                  <div className="text-3xl font-bold text-blue-900">{statistics.total_risks}</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6">
                  <div className="text-sm text-red-600 mb-2">Kritik + Yüksek</div>
                  <div className="text-3xl font-bold text-red-900">
                    {statistics.by_level.critical + statistics.by_level.high}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                  <div className="text-sm text-green-600 mb-2">Ortalama Azalma</div>
                  <div className="text-3xl font-bold text-green-900">
                    {statistics.averages.risk_reduction_pct.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6">
                  <div className="text-sm text-orange-600 mb-2">İştah İhlali</div>
                  <div className="text-3xl font-bold text-orange-900">{statistics.appetite_violations}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Risk Seviyesi Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Kritik', value: statistics.by_level.critical, color: COLORS.critical },
                          { name: 'Yüksek', value: statistics.by_level.high, color: COLORS.high },
                          { name: 'Orta', value: statistics.by_level.medium, color: COLORS.medium },
                          { name: 'Düşük', value: statistics.by_level.low, color: COLORS.low }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {[
                          { color: COLORS.critical },
                          { color: COLORS.high },
                          { color: COLORS.medium },
                          { color: COLORS.low }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Kontrol ve Bulgu Durumu</h3>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Kontrol Etkinliği</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {statistics.controls.total > 0
                            ? Math.round((statistics.controls.effective / statistics.controls.total) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${statistics.controls.total > 0
                              ? (statistics.controls.effective / statistics.controls.total) * 100
                              : 0}%`
                          }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {statistics.controls.effective} / {statistics.controls.total} etkin kontrol
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Açık Bulgular</span>
                        <span className="text-2xl font-bold text-red-600">{statistics.findings.open}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {statistics.findings.total} toplam bulgudan {statistics.findings.open} açık
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Ortalama Artık Risk</span>
                        <span className="text-2xl font-bold text-orange-600">
                          {statistics.averages.residual_score.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Doğal riskten {statistics.averages.risk_reduction.toFixed(2)} puan azalma
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportType === 'matrix' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Risk Matrisi</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setMatrixType('inherent');
                      loadMatrixData();
                    }}
                    className={`px-4 py-2 rounded ${
                      matrixType === 'inherent'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Doğal Risk
                  </button>
                  <button
                    onClick={() => {
                      setMatrixType('residual');
                      loadMatrixData();
                    }}
                    className={`px-4 py-2 rounded ${
                      matrixType === 'residual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Artık Risk
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-100">İhtimal \ Etki</th>
                      {[1, 2, 3, 4, 5].map(impact => (
                        <th key={impact} className="border p-2 bg-gray-100">{impact}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[5, 4, 3, 2, 1].map(likelihood => (
                      <tr key={likelihood}>
                        <td className="border p-2 bg-gray-100 font-semibold text-center">{likelihood}</td>
                        {[1, 2, 3, 4, 5].map(impact => {
                          const cell = matrixData.find(m => m.likelihood === likelihood && m.impact === impact);
                          const score = likelihood * impact;
                          const bgColor =
                            score >= 20 ? 'bg-red-500' :
                            score >= 15 ? 'bg-orange-500' :
                            score >= 10 ? 'bg-yellow-400' :
                            score >= 5 ? 'bg-green-400' :
                            'bg-gray-300';

                          return (
                            <td
                              key={impact}
                              className={`border p-4 text-center ${bgColor} text-white font-semibold`}
                            >
                              <div className="text-2xl">{cell?.risk_count || 0}</div>
                              <div className="text-xs">risk</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Kritik (20-25)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span>Yüksek (15-19)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                  <span>Orta (10-14)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-400 rounded"></div>
                  <span>Düşük (5-9)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-300 rounded"></div>
                  <span>Çok Düşük (1-4)</span>
                </div>
              </div>
            </div>
          )}

          {reportType === 'category' && categoryStats.length > 0 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">Kategori Bazlı Analiz</h3>

              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={categoryStats.map(cat => ({
                  category: CATEGORY_LABELS[cat.risk_category] || cat.risk_category,
                  'Doğal Risk': cat.avg_inherent_score,
                  'Artık Risk': cat.avg_residual_score
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Doğal Risk" fill="#f97316" />
                  <Bar dataKey="Artık Risk" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Toplam</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ort. Doğal</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ort. Artık</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Kritik</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Yüksek</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Orta</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categoryStats.map(cat => (
                      <tr key={cat.risk_category}>
                        <td className="px-4 py-3 font-medium">{CATEGORY_LABELS[cat.risk_category]}</td>
                        <td className="px-4 py-3 text-center">{cat.total_risks}</td>
                        <td className="px-4 py-3 text-center">{cat.avg_inherent_score.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">{cat.avg_residual_score.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">{cat.residual_critical}</td>
                        <td className="px-4 py-3 text-center">{cat.residual_high}</td>
                        <td className="px-4 py-3 text-center">{cat.residual_medium}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportType === 'owner' && ownerStats.length > 0 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">Risk Sahibi Performans Analizi</h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Sahibi</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departman</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Toplam Risk</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Yüksek</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ort. Skor</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Açık Bulgu</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İhlal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ownerStats.map(owner => (
                      <tr key={owner.risk_owner_id}>
                        <td className="px-4 py-3 font-medium">{owner.risk_owner_name}</td>
                        <td className="px-4 py-3">{owner.department_name || '-'}</td>
                        <td className="px-4 py-3 text-center">{owner.total_risks}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                            {owner.high_risks}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{owner.avg_residual_score.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {owner.open_findings > 0 ? (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                              {owner.open_findings}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {owner.appetite_violations > 0 ? (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                              {owner.appetite_violations}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportType === 'trend' && trendData.length > 0 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">Risk Trend Analizi (Son 12 Ay)</h3>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData.map(t => ({
                  month: new Date(t.assessment_month).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
                  'Doğal Risk': t.avg_inherent_score,
                  'Artık Risk': t.avg_residual_score,
                  'Kritik': t.critical_risks,
                  'Yüksek': t.high_risks
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Doğal Risk" stroke="#f97316" />
                  <Line type="monotone" dataKey="Artık Risk" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData.map(t => ({
                  month: new Date(t.assessment_month).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
                  'Kritik': t.critical_risks,
                  'Yüksek': t.high_risks,
                  'Orta': t.medium_risks,
                  'Düşük': t.low_risks
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Kritik" stackId="a" fill={COLORS.critical} />
                  <Bar dataKey="Yüksek" stackId="a" fill={COLORS.high} />
                  <Bar dataKey="Orta" stackId="a" fill={COLORS.medium} />
                  <Bar dataKey="Düşük" stackId="a" fill={COLORS.low} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {reportType === 'controls' && statistics && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">Kontrol Etkinlik Analizi</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-2">Toplam Kontrol</div>
                  <div className="text-3xl font-bold text-blue-600">{statistics.controls.total}</div>
                </div>
                <div className="border rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-2">Etkin Kontrol</div>
                  <div className="text-3xl font-bold text-green-600">{statistics.controls.effective}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {statistics.controls.total > 0
                      ? Math.round((statistics.controls.effective / statistics.controls.total) * 100)
                      : 0}% etkinlik oranı
                  </div>
                </div>
                <div className="border rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-2">Ortalama Risk Azalması</div>
                  <div className="text-3xl font-bold text-orange-600">
                    {statistics.averages.risk_reduction_pct.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4">Kontrol Etkinliğinin Risk Azalmasına Etkisi</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Mevcut {statistics.controls.total} kontrolden {statistics.controls.effective} tanesi etkin
                  çalışmaktadır. Bu kontroller sayesinde ortalama risk skoru {statistics.averages.inherent_score.toFixed(2)}
                  'den {statistics.averages.residual_score.toFixed(2)} 'e düşmüş,
                  toplam %{statistics.averages.risk_reduction_pct.toFixed(1)} azalma sağlanmıştır.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-800">
                    {statistics.controls.total - statistics.controls.effective} kontrolün etkinliği artırıldığında
                    daha fazla risk azalması sağlanabilir.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
