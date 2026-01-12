import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText,
  TrendingUp,
  Activity,
  BarChart3,
  Building2,
  Calendar,
  Download,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Users,
  TrendingDown,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  FilePieChart,
  Award
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart
} from 'recharts';
import * as XLSX from 'xlsx';
import Modal from '../components/ui/Modal';

import RiskStatusReport from '../components/risk-reports/RiskStatusReport';
import RiskMatrixReport from '../components/risk-reports/RiskMatrixReport';
import ActivityProgressReport from '../components/risk-reports/ActivityProgressReport';
import IndicatorStatusReport from '../components/risk-reports/IndicatorStatusReport';
import DepartmentRiskReport from '../components/risk-reports/DepartmentRiskReport';
import PeriodComparisonReport from '../components/risk-reports/PeriodComparisonReport';

type ReportType = 'status' | 'matrix' | 'activity' | 'indicator' | 'department' | 'period' | 'appetite' | 'executive' | 'goal_based' | null;
type ViewMode = 'dashboard' | 'reports';

interface DashboardMetrics {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  veryLowRisks: number;
  treatmentsInProgress: number;
  treatmentsCompleted: number;
  treatmentsDelayed: number;
  avgResidualRisk: number;
  avgInherentRisk: number;
  riskReductionRate: number;
  risksWithinAppetite: number;
  risksExceedingAppetite: number;
  indicatorsInAlarm: number;
  totalIndicators: number;
}

interface RiskTrend {
  month: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface CategoryRisk {
  category: string;
  count: number;
  avgScore: number;
}

export default function RiskReports() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedReport, setSelectedReport] = useState<ReportType>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('all');

  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [riskTrends, setRiskTrends] = useState<RiskTrend[]>([]);
  const [categoryRisks, setCategoryRisks] = useState<CategoryRisk[]>([]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportReport, setSelectedExportReport] = useState<ReportType>(null);

  useEffect(() => {
    if (profile?.organization_id && viewMode === 'dashboard') {
      loadDashboardData();
    }
  }, [profile?.organization_id, viewMode, filterDepartment, filterCategory, filterDateRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      await Promise.all([
        loadDepartments(),
        loadCategories(),
        loadMetrics(),
        loadRiskTrends(),
        loadCategoryRisks()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile?.organization_id)
      .order('name');

    if (error) throw error;
    setDepartments(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('risk_categories')
      .select('id, name')
      .eq('organization_id', profile?.organization_id)
      .order('name');

    if (error) throw error;
    setCategories(data || []);
  };

  const loadMetrics = async () => {
    let risksQuery = supabase
      .from('risks')
      .select('*, risk_treatments(*)')
      .eq('organization_id', profile?.organization_id);

    if (filterDepartment !== 'all') {
      risksQuery = risksQuery.eq('department_id', filterDepartment);
    }

    if (filterCategory !== 'all') {
      risksQuery = risksQuery.contains('categories', [filterCategory]);
    }

    const { data: risks, error: risksError } = await risksQuery;
    if (risksError) throw risksError;

    const now = new Date();
    const totalRisks = risks?.length || 0;

    let criticalRisks = 0;
    let highRisks = 0;
    let mediumRisks = 0;
    let lowRisks = 0;
    let veryLowRisks = 0;
    let treatmentsInProgress = 0;
    let treatmentsCompleted = 0;
    let treatmentsDelayed = 0;
    let totalInherent = 0;
    let totalResidual = 0;
    let risksWithinAppetite = 0;
    let risksExceedingAppetite = 0;

    risks?.forEach(risk => {
      const score = risk.residual_risk_score || risk.inherent_risk_score || 0;

      if (score >= 20) criticalRisks++;
      else if (score >= 15) highRisks++;
      else if (score >= 10) mediumRisks++;
      else if (score >= 5) lowRisks++;
      else veryLowRisks++;

      totalInherent += risk.inherent_risk_score || 0;
      totalResidual += risk.residual_risk_score || 0;

      if (risk.risk_appetite_max_score) {
        if (score <= parseInt(risk.risk_appetite_max_score)) {
          risksWithinAppetite++;
        } else {
          risksExceedingAppetite++;
        }
      }

      risk.risk_treatments?.forEach((treatment: any) => {
        if (treatment.status === 'COMPLETED') {
          treatmentsCompleted++;
        } else if (treatment.status === 'IN_PROGRESS') {
          treatmentsInProgress++;
          if (treatment.target_date && new Date(treatment.target_date) < now) {
            treatmentsDelayed++;
          }
        }
      });
    });

    const { data: indicators, error: indicatorsError } = await supabase
      .from('risk_indicators')
      .select('*, risk_indicator_data(*)')
      .eq('organization_id', profile?.organization_id);

    if (indicatorsError) throw indicatorsError;

    let indicatorsInAlarm = 0;
    indicators?.forEach((indicator: any) => {
      const latestData = indicator.risk_indicator_data?.[0];
      if (latestData?.is_alarm) {
        indicatorsInAlarm++;
      }
    });

    const avgInherent = totalRisks > 0 ? totalInherent / totalRisks : 0;
    const avgResidual = totalRisks > 0 ? totalResidual / totalRisks : 0;
    const riskReductionRate = avgInherent > 0 ? ((avgInherent - avgResidual) / avgInherent) * 100 : 0;

    setMetrics({
      totalRisks,
      criticalRisks,
      highRisks,
      mediumRisks,
      lowRisks,
      veryLowRisks,
      treatmentsInProgress,
      treatmentsCompleted,
      treatmentsDelayed,
      avgResidualRisk: avgResidual,
      avgInherentRisk: avgInherent,
      riskReductionRate,
      risksWithinAppetite,
      risksExceedingAppetite,
      indicatorsInAlarm,
      totalIndicators: indicators?.length || 0
    });
  };

  const loadRiskTrends = async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: risks } = await supabase
      .from('risks')
      .select('created_at, residual_risk_score, inherent_risk_score')
      .eq('organization_id', profile?.organization_id)
      .gte('created_at', sixMonthsAgo.toISOString());

    const monthlyData = new Map<string, { critical: number; high: number; medium: number; low: number }>();

    risks?.forEach(risk => {
      const date = new Date(risk.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { critical: 0, high: 0, medium: 0, low: 0 });
      }

      const data = monthlyData.get(monthKey)!;
      const score = risk.residual_risk_score || risk.inherent_risk_score || 0;

      if (score >= 20) data.critical++;
      else if (score >= 15) data.high++;
      else if (score >= 10) data.medium++;
      else data.low++;
    });

    const trends: RiskTrend[] = Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }),
        ...data
      }));

    setRiskTrends(trends);
  };

  const loadCategoryRisks = async () => {
    const { data: categories } = await supabase
      .from('risk_categories')
      .select('id, name')
      .eq('organization_id', profile?.organization_id);

    const { data: risks } = await supabase
      .from('risks')
      .select('categories, residual_risk_score, inherent_risk_score')
      .eq('organization_id', profile?.organization_id);

    const categoryMap = new Map<string, { count: number; totalScore: number }>();

    categories?.forEach(cat => {
      categoryMap.set(cat.id, { count: 0, totalScore: 0 });
    });

    risks?.forEach(risk => {
      const score = risk.residual_risk_score || risk.inherent_risk_score || 0;
      risk.categories?.forEach((catId: string) => {
        if (categoryMap.has(catId)) {
          const data = categoryMap.get(catId)!;
          data.count++;
          data.totalScore += score;
        }
      });
    });

    const categoryRisksData: CategoryRisk[] = categories?.map(cat => ({
      category: cat.name,
      count: categoryMap.get(cat.id)?.count || 0,
      avgScore: categoryMap.get(cat.id)?.count
        ? (categoryMap.get(cat.id)?.totalScore || 0) / (categoryMap.get(cat.id)?.count || 1)
        : 0
    })) || [];

    setCategoryRisks(categoryRisksData.filter(c => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 8));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleExportDashboard = () => {
    if (!metrics) return;

    const data = [
      { 'Metrik': 'Toplam Risk Sayısı', 'Değer': metrics.totalRisks },
      { 'Metrik': 'Kritik Riskler', 'Değer': metrics.criticalRisks },
      { 'Metrik': 'Yüksek Riskler', 'Değer': metrics.highRisks },
      { 'Metrik': 'Orta Riskler', 'Değer': metrics.mediumRisks },
      { 'Metrik': 'Düşük Riskler', 'Değer': metrics.lowRisks },
      { 'Metrik': 'Risk İştahı İçinde', 'Değer': metrics.risksWithinAppetite },
      { 'Metrik': 'Risk İştahı Dışında', 'Değer': metrics.risksExceedingAppetite },
      { 'Metrik': 'Devam Eden Tedbirler', 'Değer': metrics.treatmentsInProgress },
      { 'Metrik': 'Tamamlanan Tedbirler', 'Değer': metrics.treatmentsCompleted },
      { 'Metrik': 'Geciken Tedbirler', 'Değer': metrics.treatmentsDelayed },
      { 'Metrik': 'Risk Azaltma Oranı (%)', 'Değer': metrics.riskReductionRate.toFixed(1) },
      { 'Metrik': 'Alarm Durumundaki Göstergeler', 'Değer': metrics.indicatorsInAlarm }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Risk Dashboard');
    XLSX.writeFile(wb, `Risk_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const reportCards = [
    {
      id: 'status' as ReportType,
      icon: FileText,
      title: 'RİSK DURUM RAPORU',
      description: 'Tüm risklerin güncel durumu, seviye dağılımı, kategori bazlı analiz',
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      hoverColor: 'hover:bg-blue-100'
    },
    {
      id: 'matrix' as ReportType,
      icon: TrendingUp,
      title: 'RİSK MATRİS RAPORU',
      description: '5x5 risk matrisi görsel raporu, doğal ve artık risk karşılaştırması',
      color: 'bg-purple-50 text-purple-600 border-purple-200',
      hoverColor: 'hover:bg-purple-100'
    },
    {
      id: 'activity' as ReportType,
      icon: Activity,
      title: 'FAALİYET İLERLEME RAPORU',
      description: 'Risk tedbirlerinin ilerleme durumu, geciken tedbirler, tamamlananlar',
      color: 'bg-green-50 text-green-600 border-green-200',
      hoverColor: 'hover:bg-green-100'
    },
    {
      id: 'indicator' as ReportType,
      icon: BarChart3,
      title: 'GÖSTERGE DURUM RAPORU',
      description: 'KRI göstergelerinin dönemsel değerleri, trend analizi, alarm durumları',
      color: 'bg-orange-50 text-orange-600 border-orange-200',
      hoverColor: 'hover:bg-orange-100'
    },
    {
      id: 'department' as ReportType,
      icon: Building2,
      title: 'BİRİM BAZLI RİSK RAPORU',
      description: 'Birim bazında risk dağılımı, birim risk profili, tedbir durumu',
      color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      hoverColor: 'hover:bg-cyan-100'
    },
    {
      id: 'period' as ReportType,
      icon: Calendar,
      title: 'DÖNEMSEL KARŞILAŞTIRMA',
      description: 'Dönemler arası risk karşılaştırması, trend analizi, değişim raporu',
      color: 'bg-pink-50 text-pink-600 border-pink-200',
      hoverColor: 'hover:bg-pink-100'
    },
    {
      id: 'appetite' as ReportType,
      icon: Target,
      title: 'RİSK İŞTAHI RAPORU',
      description: 'Risk iştahı belirleme, hedef bazlı iştah analizi, iştah aşım durumu',
      color: 'bg-red-50 text-red-600 border-red-200',
      hoverColor: 'hover:bg-red-100'
    },
    {
      id: 'executive' as ReportType,
      icon: Award,
      title: 'ÜST YÖNETİM ÖZETİ',
      description: 'Üst yönetim için özet rapor, kritik riskler, önemli trendler',
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      hoverColor: 'hover:bg-indigo-100'
    },
    {
      id: 'goal_based' as ReportType,
      icon: Target,
      title: 'HEDEF BAZLI RİSK RAPORU',
      description: 'Stratejik hedeflere göre risk analizi, hedef-risk ilişkilendirmesi',
      color: 'bg-teal-50 text-teal-600 border-teal-200',
      hoverColor: 'hover:bg-teal-100'
    }
  ];

  const renderReport = () => {
    switch (selectedReport) {
      case 'status':
        return <RiskStatusReport onClose={() => setSelectedReport(null)} />;
      case 'matrix':
        return <RiskMatrixReport onClose={() => setSelectedReport(null)} />;
      case 'activity':
        return <ActivityProgressReport onClose={() => setSelectedReport(null)} />;
      case 'indicator':
        return <IndicatorStatusReport onClose={() => setSelectedReport(null)} />;
      case 'department':
        return <DepartmentRiskReport onClose={() => setSelectedReport(null)} />;
      case 'period':
        return <PeriodComparisonReport onClose={() => setSelectedReport(null)} />;
      case 'appetite':
        return <RiskAppetiteReport onClose={() => setSelectedReport(null)} />;
      case 'executive':
        return <ExecutiveSummaryReport onClose={() => setSelectedReport(null)} />;
      case 'goal_based':
        return <GoalBasedRiskReport onClose={() => setSelectedReport(null)} />;
      default:
        return null;
    }
  };

  if (selectedReport) {
    return renderReport();
  }

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  const riskDistributionData = metrics ? [
    { name: 'Kritik', value: metrics.criticalRisks, color: '#dc2626' },
    { name: 'Yüksek', value: metrics.highRisks, color: '#f97316' },
    { name: 'Orta', value: metrics.mediumRisks, color: '#eab308' },
    { name: 'Düşük', value: metrics.lowRisks, color: '#84cc16' },
    { name: 'Çok Düşük', value: metrics.veryLowRisks, color: '#22c55e' }
  ] : [];

  const treatmentStatusData = metrics ? [
    { name: 'Devam Eden', value: metrics.treatmentsInProgress, color: '#3b82f6' },
    { name: 'Tamamlanan', value: metrics.treatmentsCompleted, color: '#22c55e' },
    { name: 'Geciken', value: metrics.treatmentsDelayed, color: '#ef4444' }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Raporları ve Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Risk yönetimi metrikleri, analizler ve raporlar</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setViewMode('reports')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'reports'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Raporlar
          </button>
        </div>
      </div>

      {viewMode === 'dashboard' ? (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Tüm Birimler</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Tüm Kategoriler</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Tüm Zamanlar</option>
                  <option value="month">Son 1 Ay</option>
                  <option value="quarter">Son 3 Ay</option>
                  <option value="year">Son 1 Yıl</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Yenile
                </button>
                <button
                  onClick={handleExportDashboard}
                  className="btn-secondary flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel İndir
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Yükleniyor...</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">TOPLAM RİSKLER</span>
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-3xl font-bold text-blue-900 mb-1">{metrics?.totalRisks || 0}</div>
                  <div className="text-xs text-blue-600">
                    Kritik: {metrics?.criticalRisks || 0} | Yüksek: {metrics?.highRisks || 0}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-700">İŞTAH AŞAN</span>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-3xl font-bold text-red-900 mb-1">{metrics?.risksExceedingAppetite || 0}</div>
                  <div className="text-xs text-red-600">
                    Risk iştahını aşan riskler
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-700">TEDBİR BAŞARISI</span>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-3xl font-bold text-green-900 mb-1">
                    %{metrics?.riskReductionRate.toFixed(0) || 0}
                  </div>
                  <div className="text-xs text-green-600">
                    Risk azaltma oranı
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-orange-700">GECİKEN TEDBİRLER</span>
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="text-3xl font-bold text-orange-900 mb-1">{metrics?.treatmentsDelayed || 0}</div>
                  <div className="text-xs text-orange-600">
                    Hedef tarih geçmiş
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Seviye Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={riskDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${value} (%${(percent * 100).toFixed(0)})`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {riskDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Tedbir Durumu</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={treatmentStatusData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#3b82f6" name="Adet">
                        {treatmentStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Trendi (Son 6 Ay)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={riskTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="critical" stackId="1" stroke="#dc2626" fill="#dc2626" name="Kritik" />
                      <Area type="monotone" dataKey="high" stackId="1" stroke="#f97316" fill="#f97316" name="Yüksek" />
                      <Area type="monotone" dataKey="medium" stackId="1" stroke="#eab308" fill="#eab308" name="Orta" />
                      <Area type="monotone" dataKey="low" stackId="1" stroke="#22c55e" fill="#22c55e" name="Düşük" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Kategori Bazlı Risk Sayısı</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryRisks} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="category" type="category" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#3b82f6" name="Risk Sayısı" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-700">Risk İştahı Uyumu</h3>
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">İştah İçinde</span>
                      <span className="text-lg font-bold text-green-600">{metrics?.risksWithinAppetite || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${
                            metrics?.totalRisks
                              ? ((metrics.risksWithinAppetite / metrics.totalRisks) * 100).toFixed(0)
                              : 0
                          }%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-sm text-gray-600">İştah Dışında</span>
                      <span className="text-lg font-bold text-red-600">{metrics?.risksExceedingAppetite || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full"
                        style={{
                          width: `${
                            metrics?.totalRisks
                              ? ((metrics.risksExceedingAppetite / metrics.totalRisks) * 100).toFixed(0)
                              : 0
                          }%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-700">Risk Göstergeleri</h3>
                    <BarChart3 className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Toplam Gösterge</span>
                      <span className="text-lg font-bold text-gray-900">{metrics?.totalIndicators || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-sm text-gray-600">Alarm Durumunda</span>
                      <span className="text-lg font-bold text-red-600">{metrics?.indicatorsInAlarm || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-red-600 h-2 rounded-full"
                        style={{
                          width: `${
                            metrics?.totalIndicators
                              ? ((metrics.indicatorsInAlarm / metrics.totalIndicators) * 100).toFixed(0)
                              : 0
                          }%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-700">Ortalama Risk Skorları</h3>
                    <TrendingDown className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Doğal Risk</span>
                      <span className="text-lg font-bold text-red-600">
                        {metrics?.avgInherentRisk.toFixed(1) || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-sm text-gray-600">Artık Risk</span>
                      <span className="text-lg font-bold text-green-600">
                        {metrics?.avgResidualRisk.toFixed(1) || 0}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <span className="text-xs text-gray-500">Risk Azaltma</span>
                      <div className="flex items-center gap-2 mt-1">
                        <TrendingDown className="w-4 h-4 text-green-600" />
                        <span className="text-lg font-bold text-green-600">
                          %{metrics?.riskReductionRate.toFixed(0) || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className={`bg-white border-2 ${card.color} rounded-lg p-6 transition-all ${card.hoverColor} cursor-pointer`}
                onClick={() => setSelectedReport(card.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${card.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-sm text-gray-600 mb-4 min-h-[3rem]">{card.description}</p>

                <div className="text-xs text-gray-500 mb-4">
                  Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
                </div>

                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                  <Download className="w-4 h-4" />
                  Rapor Oluştur
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RiskAppetiteReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: goals, error } = await supabase
        .from('goals')
        .select(`
          *,
          risks(*)
        `)
        .eq('organization_id', profile?.organization_id);

      if (error) throw error;
      setData(goals);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const exportData: any[] = [];

    data?.forEach((goal: any) => {
      goal.risks?.forEach((risk: any) => {
        exportData.push({
          'Hedef': goal.name,
          'Risk İştahı': goal.risk_appetite_level || '-',
          'Max Skor': goal.risk_appetite_max_score || '-',
          'Risk Kodu': risk.code,
          'Risk': risk.title,
          'Artık Risk Skoru': risk.residual_risk_score || risk.inherent_risk_score,
          'Durum': (risk.residual_risk_score || risk.inherent_risk_score) <= parseInt(goal.risk_appetite_max_score || '999')
            ? 'İştah İçinde'
            : 'İştah Dışında'
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Risk İştahı');
    XLSX.writeFile(wb, `Risk_Iştahı_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk İştahı Raporu</h1>
          <p className="text-sm text-gray-600 mt-1">Hedef bazlı risk iştahı analizi ve uyum durumu</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Excel İndir
          </button>
          <button onClick={onClose} className="btn-secondary">
            Geri Dön
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {data?.map((goal: any) => (
          <div key={goal.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{goal.code} - {goal.name}</h3>
                <div className="flex gap-4 mt-2">
                  <span className="text-sm text-gray-600">
                    Risk İştahı: <span className="font-medium">{goal.risk_appetite_level || 'Belirlenmemiş'}</span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Max Skor: <span className="font-medium">{goal.risk_appetite_max_score || '-'}</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Toplam Risk</div>
                <div className="text-2xl font-bold text-gray-900">{goal.risks?.length || 0}</div>
              </div>
            </div>

            {goal.risks && goal.risks.length > 0 && (
              <div className="mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-gray-700">Risk</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-700">Artık Risk</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-700">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goal.risks.map((risk: any) => {
                      const score = risk.residual_risk_score || risk.inherent_risk_score;
                      const maxScore = parseInt(goal.risk_appetite_max_score || '999');
                      const withinAppetite = score <= maxScore;

                      return (
                        <tr key={risk.id} className="border-b border-gray-100">
                          <td className="py-3 text-sm text-gray-900">{risk.code} - {risk.title}</td>
                          <td className="py-3 text-sm text-center font-medium">{score}</td>
                          <td className="py-3 text-center">
                            {withinAppetite ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                İştah İçinde
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                İştah Dışında
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveSummaryReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const { data: risks } = await supabase
        .from('risks')
        .select('*, risk_treatments(*), department:departments(name)')
        .eq('organization_id', profile?.organization_id);

      const critical = risks?.filter(r => (r.residual_risk_score || r.inherent_risk_score) >= 20) || [];
      const high = risks?.filter(r => {
        const score = r.residual_risk_score || r.inherent_risk_score;
        return score >= 15 && score < 20;
      }) || [];

      const delayedTreatments: any[] = [];
      const now = new Date();
      risks?.forEach(risk => {
        risk.risk_treatments?.forEach((treatment: any) => {
          if (treatment.status !== 'COMPLETED' && treatment.target_date && new Date(treatment.target_date) < now) {
            delayedTreatments.push({ ...treatment, risk });
          }
        });
      });

      setSummary({
        totalRisks: risks?.length || 0,
        criticalRisks: critical,
        highRisks: high,
        delayedTreatments
      });
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Üst Yönetim Özet Raporu</h1>
          <p className="text-sm text-gray-600 mt-1">Kritik riskler ve önemli bulgular</p>
        </div>
        <button onClick={onClose} className="btn-secondary">
          Geri Dön
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border-2 border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Kritik Riskler</h3>
          <div className="text-4xl font-bold text-red-600">{summary?.criticalRisks.length || 0}</div>
          <p className="text-sm text-red-700 mt-2">Acil müdahale gerekli</p>
        </div>

        <div className="bg-white border-2 border-orange-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">Yüksek Riskler</h3>
          <div className="text-4xl font-bold text-orange-600">{summary?.highRisks.length || 0}</div>
          <p className="text-sm text-orange-700 mt-2">Yakın takip gerekli</p>
        </div>

        <div className="bg-white border-2 border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">Geciken Tedbirler</h3>
          <div className="text-4xl font-bold text-yellow-600">{summary?.delayedTreatments.length || 0}</div>
          <p className="text-sm text-yellow-700 mt-2">Hedef tarih geçmiş</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Kritik Riskler Detayı</h3>
        <div className="space-y-3">
          {summary?.criticalRisks.map((risk: any) => (
            <div key={risk.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{risk.code} - {risk.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{risk.department?.name}</p>
                </div>
                <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium">
                  Skor: {risk.residual_risk_score || risk.inherent_risk_score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Geciken Tedbirler</h3>
        <div className="space-y-3">
          {summary?.delayedTreatments.map((treatment: any) => (
            <div key={treatment.id} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{treatment.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">Risk: {treatment.risk.title}</p>
                </div>
                <span className="text-sm text-yellow-700">
                  Hedef: {new Date(treatment.target_date).toLocaleDateString('tr-TR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalBasedRiskReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: goals, error } = await supabase
        .from('goals')
        .select(`
          *,
          risks(*),
          department:departments(name)
        `)
        .eq('organization_id', profile?.organization_id);

      if (error) throw error;
      setData(goals || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const exportData: any[] = [];

    data.forEach(goal => {
      goal.risks?.forEach((risk: any) => {
        exportData.push({
          'Hedef Kodu': goal.code,
          'Hedef': goal.name,
          'Birim': goal.department?.name || '-',
          'Risk Kodu': risk.code,
          'Risk': risk.title,
          'Doğal Risk': risk.inherent_risk_score,
          'Artık Risk': risk.residual_risk_score || risk.inherent_risk_score,
          'Durum': risk.status
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hedef Bazlı Riskler');
    XLSX.writeFile(wb, `Hedef_Bazlı_Risk_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hedef Bazlı Risk Raporu</h1>
          <p className="text-sm text-gray-600 mt-1">Stratejik hedeflere göre risk analizi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Excel İndir
          </button>
          <button onClick={onClose} className="btn-secondary">
            Geri Dön
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {data.map(goal => (
          <div key={goal.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{goal.code} - {goal.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{goal.department?.name}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Risk Sayısı</div>
                <div className="text-2xl font-bold text-gray-900">{goal.risks?.length || 0}</div>
              </div>
            </div>

            {goal.risks && goal.risks.length > 0 && (
              <div className="mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-gray-700">Risk</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-700">Doğal</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-700">Artık</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-700">Seviye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goal.risks.map((risk: any) => {
                      const residual = risk.residual_risk_score || risk.inherent_risk_score;
                      const level =
                        residual >= 20 ? 'Kritik' :
                        residual >= 15 ? 'Yüksek' :
                        residual >= 10 ? 'Orta' : 'Düşük';
                      const levelColor =
                        residual >= 20 ? 'bg-red-100 text-red-800' :
                        residual >= 15 ? 'bg-orange-100 text-orange-800' :
                        residual >= 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

                      return (
                        <tr key={risk.id} className="border-b border-gray-100">
                          <td className="py-3 text-sm text-gray-900">{risk.code} - {risk.title}</td>
                          <td className="py-3 text-sm text-center font-medium">{risk.inherent_risk_score}</td>
                          <td className="py-3 text-sm text-center font-medium">{residual}</td>
                          <td className="py-3 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${levelColor}`}>
                              {level}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
