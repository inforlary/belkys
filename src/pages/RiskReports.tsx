import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Download, BarChart3, TrendingUp, Shield, Activity } from 'lucide-react';

interface ReportStats {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  totalActivities: number;
  completedActivities: number;
  redIndicators: number;
}

export default function RiskReports() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadStats();
    }
  }, [profile?.organization_id]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const { data: risks } = await supabase
        .from('risk_register')
        .select('residual_likelihood, residual_impact')
        .eq('organization_id', orgId)
        .eq('status', 'active');

      let criticalRisks = 0, highRisks = 0, mediumRisks = 0, lowRisks = 0;
      risks?.forEach(risk => {
        const score = (risk.residual_likelihood || 0) * (risk.residual_impact || 0);
        if (score >= 20) criticalRisks++;
        else if (score >= 12) highRisks++;
        else if (score >= 5) mediumRisks++;
        else lowRisks++;
      });

      const { count: totalActivities } = await supabase
        .from('risk_treatments')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const { count: completedActivities } = await supabase
        .from('risk_treatments')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'completed');

      const { data: indicators } = await supabase
        .from('risk_indicators')
        .select('current_value, red_threshold')
        .eq('organization_id', orgId);

      const redIndicators = indicators?.filter(ind =>
        ind.current_value >= ind.red_threshold
      ).length || 0;

      setStats({
        totalRisks: risks?.length || 0,
        criticalRisks,
        highRisks,
        mediumRisks,
        lowRisks,
        totalActivities: totalActivities || 0,
        completedActivities: completedActivities || 0,
        redIndicators
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = (reportType: string) => {
    alert(`${reportType} raporu oluşturuluyor...`);
  };

  const reportTypes = [
    {
      id: 'status',
      title: 'Risk Durum Raporu',
      description: 'Anlık risk durumu ve dağılım raporu',
      icon: Shield,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'matrix',
      title: 'Risk Matrisi Raporu',
      description: '5x5 risk matrisi görsel rapor',
      icon: BarChart3,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 'treatments',
      title: 'Faaliyet İlerleme Raporu',
      description: 'Risk faaliyetleri durum ve ilerleme',
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'indicators',
      title: 'Gösterge Durum Raporu',
      description: 'KRI değerleri ve eşik durumları',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'comparison',
      title: 'Dönemsel Karşılaştırma',
      description: 'Risk ve faaliyet trend analizi',
      icon: BarChart3,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      id: 'executive',
      title: 'Üst Yönetim Özet Raporu',
      description: 'Yönetici özet ve ana göstergeler',
      icon: FileText,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Risk Raporları</h1>
        <p className="mt-2 text-gray-600">Risk yönetimi analiz ve değerlendirme raporları</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Özet İstatistikler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats?.criticalRisks}</div>
            <div className="text-sm text-gray-600 mt-1">Kritik Risk</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats?.highRisks}</div>
            <div className="text-sm text-gray-600 mt-1">Yüksek Risk</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats?.mediumRisks}</div>
            <div className="text-sm text-gray-600 mt-1">Orta Risk</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats?.lowRisks}</div>
            <div className="text-sm text-gray-600 mt-1">Düşük Risk</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => {
          const ReportIcon = report.icon;
          return (
            <div key={report.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`${report.bgColor} p-3 rounded-lg`}>
                    <ReportIcon className={`w-6 h-6 ${report.color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => generateReport(report.title)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={() => generateReport(report.title)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Özel Rapor Oluştur</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rapor Türü</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Risk Durum Raporu</option>
              <option>Faaliyet Raporu</option>
              <option>Gösterge Raporu</option>
              <option>Trend Analizi</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tarih Aralığı</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Bu Ay</option>
              <option>Son 3 Ay</option>
              <option>Son 6 Ay</option>
              <option>Bu Yıl</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Excel (.xlsx)</option>
              <option>PDF</option>
              <option>Word (.docx)</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => generateReport('Özel Rapor')}
          className="mt-4 flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Rapor Oluştur
        </button>
      </div>
    </div>
  );
}
