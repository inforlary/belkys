import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Download,
  TrendingUp,
  Shield,
  CheckCircle2,
  AlertTriangle,
  BarChart3
} from 'lucide-react';

interface ReportData {
  totalActions: number;
  completedActions: number;
  inProgressActions: number;
  overdueActions: number;
  complianceScore: number;
  standardsCount: number;
  plansCount: number;
  assessmentsCount: number;
}

export default function ICReports() {
  const { user, profile } = useAuth();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [user, profile]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const today = new Date().toISOString().split('T')[0];

      const [actionsResult, plansResult, assessmentsResult, standardsResult] = await Promise.all([
        supabase
          .from('ic_actions')
          .select('id, status, end_date')
          .eq('organization_id', orgId),
        supabase
          .from('ic_action_plans')
          .select('id', { count: 'exact' })
          .eq('organization_id', orgId),
        supabase
          .from('ic_assessments')
          .select('id', { count: 'exact' })
          .eq('organization_id', orgId),
        supabase
          .from('ic_kiks_main_standards')
          .select('id', { count: 'exact' })
      ]);

      const actions = actionsResult.data || [];
      const totalActions = actions.length;
      const completedActions = actions.filter(a => a.status === 'TAMAMLANDI').length;
      const inProgressActions = actions.filter(a =>
        a.status === 'DEVAM_EDIYOR' || a.status === 'BASLADI'
      ).length;
      const overdueActions = actions.filter(a =>
        a.end_date && a.end_date < today && a.status !== 'TAMAMLANDI'
      ).length;

      const complianceScore = totalActions > 0
        ? Math.round((completedActions / totalActions) * 100)
        : 0;

      setReportData({
        totalActions,
        completedActions,
        inProgressActions,
        overdueActions,
        complianceScore,
        standardsCount: standardsResult.count || 0,
        plansCount: plansResult.count || 0,
        assessmentsCount: assessmentsResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = (reportType: string) => {
    alert(`${reportType} raporu oluşturuluyor...`);
  };

  const reportTypes = [
    {
      id: 'compliance',
      title: 'Uyum Raporu',
      description: 'Genel iç kontrol uyum durumu ve standart değerlendirmesi',
      icon: Shield,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'actions',
      title: 'Eylem Takip Raporu',
      description: 'Tüm eylemlerin durum, ilerleme ve sorumlu bilgileri',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 'overdue',
      title: 'Gecikmiş Eylemler Raporu',
      description: 'Süre aşımına uğramış eylemlerin listesi ve nedenleri',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      id: 'performance',
      title: 'Performans Raporu',
      description: 'Dönemsel iç kontrol performans analizi ve trendler',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'assessment',
      title: 'Öz Değerlendirme Raporu',
      description: 'Birim bazlı öz değerlendirme sonuçları ve skorlar',
      icon: BarChart3,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'executive',
      title: 'Üst Yönetim Özet Raporu',
      description: 'Üst yönetim için özet iç kontrol durumu raporu',
      icon: FileText,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
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
        <h1 className="text-3xl font-bold text-gray-900">İç Kontrol Raporları</h1>
        <p className="mt-2 text-gray-600">
          İç kontrol sistemi analiz ve değerlendirme raporları
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Özet İstatistikler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{reportData?.complianceScore}%</div>
            <div className="text-sm text-gray-600 mt-1">Uyum Skoru</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{reportData?.completedActions}</div>
            <div className="text-sm text-gray-600 mt-1">Tamamlanan</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{reportData?.inProgressActions}</div>
            <div className="text-sm text-gray-600 mt-1">Devam Eden</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{reportData?.overdueActions}</div>
            <div className="text-sm text-gray-600 mt-1">Gecikmiş</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => {
          const ReportIcon = report.icon;
          return (
            <div key={report.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
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
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => generateReport(report.title)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Excel İndir
                </button>
                <button
                  onClick={() => generateReport(report.title)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  PDF İndir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Özel Rapor Oluştur</h2>
        <p className="text-sm text-gray-600 mb-4">
          Belirli kriterlere göre özel rapor oluşturun
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rapor Türü
            </label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Eylem Raporu</option>
              <option>Değerlendirme Raporu</option>
              <option>Standart Raporu</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tarih Aralığı
            </label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Bu Ay</option>
              <option>Son 3 Ay</option>
              <option>Son 6 Ay</option>
              <option>Bu Yıl</option>
              <option>Özel Tarih Aralığı</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
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
