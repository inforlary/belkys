import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  BarChart3,
  FileText,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users
} from 'lucide-react';
import Button from '../components/ui/Button';

interface ReportStats {
  totalStandards: number;
  assessedStandards: number;
  averageCompliance: number;
  totalActions: number;
  completedActions: number;
  delayedActions: number;
  totalMeetings: number;
  totalDecisions: number;
  pendingDecisions: number;
}

export default function ICReports() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  useEffect(() => {
    loadReportData();
  }, [profile, selectedPeriod]);

  const loadReportData = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data: standards } = await supabase
        .from('ic_standards')
        .select('id');

      const { data: assessments } = await supabase
        .from('ic_standard_assessments')
        .select('compliance_level')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'approved');

      const { data: actions } = await supabase
        .from('ic_actions')
        .select('status')
        .in('action_plan_id',
          supabase
            .from('ic_action_plans')
            .select('id')
            .eq('organization_id', profile.organization_id)
        );

      const { data: meetings } = await supabase
        .from('ic_ikyk_meetings')
        .select('id')
        .eq('organization_id', profile.organization_id);

      const { data: decisions } = await supabase
        .from('ic_meeting_decisions')
        .select('status')
        .in('meeting_id',
          supabase
            .from('ic_ikyk_meetings')
            .select('id')
            .eq('organization_id', profile.organization_id)
        );

      const avgCompliance = assessments && assessments.length > 0
        ? Math.round(assessments.reduce((acc, a) => acc + a.compliance_level, 0) / assessments.length * 20)
        : 0;

      setStats({
        totalStandards: standards?.length || 0,
        assessedStandards: assessments?.length || 0,
        averageCompliance: avgCompliance,
        totalActions: actions?.length || 0,
        completedActions: actions?.filter(a => a.status === 'completed').length || 0,
        delayedActions: actions?.filter(a => a.status === 'delayed').length || 0,
        totalMeetings: meetings?.length || 0,
        totalDecisions: decisions?.length || 0,
        pendingDecisions: decisions?.filter(d => d.status === 'pending').length || 0,
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return <div>Veri yüklenemedi</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            İç Kontrol Raporları
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kapsamlı iç kontrol performans raporları
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Zamanlar</option>
            <option value="2024">2024</option>
            <option value="2024-Q1">2024 Q1</option>
            <option value="2024-Q2">2024 Q2</option>
            <option value="2024-Q3">2024 Q3</option>
            <option value="2024-Q4">2024 Q4</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Standart Değerlendirmesi</span>
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.assessedStandards}/{stats.totalStandards}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            %{stats.totalStandards > 0 ? Math.round((stats.assessedStandards / stats.totalStandards) * 100) : 0} Tamamlandı
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Ortalama Uyum Skoru</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">%{stats.averageCompliance}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${stats.averageCompliance}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Eylem Tamamlama</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.completedActions}/{stats.totalActions}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            %{stats.totalActions > 0 ? Math.round((stats.completedActions / stats.totalActions) * 100) : 0} Tamamlandı
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Geciken Eylemler</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.delayedActions}</p>
          <p className="text-xs text-gray-500 mt-1">Dikkat Gerekli</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            İKİYK İstatistikleri
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Toplam Toplantı</span>
              <span className="text-lg font-semibold text-gray-900">{stats.totalMeetings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Toplam Karar</span>
              <span className="text-lg font-semibold text-gray-900">{stats.totalDecisions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Bekleyen Karar</span>
              <span className="text-lg font-semibold text-yellow-600">{stats.pendingDecisions}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Mevcut Raporlar
          </h2>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">İlerleme Raporu</p>
                  <p className="text-xs text-gray-500">Eylem planı ilerleme raporu</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Uyum Raporu</p>
                  <p className="text-xs text-gray-500">Standart uyum değerlendirmesi</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Yıllık Değerlendirme</p>
                  <p className="text-xs text-gray-500">Kapsamlı yıllık değerlendirme</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Özel Rapor Oluştur</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rapor Türü
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>İlerleme Raporu</option>
              <option>Uyum Raporu</option>
              <option>İKİYK Raporu</option>
              <option>Eylem Raporu</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bitiş Tarihi
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Rapor Oluştur
          </Button>
        </div>
      </div>
    </div>
  );
}
