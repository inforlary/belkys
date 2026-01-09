import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Download, BarChart3, TrendingUp, Shield, ClipboardCheck, Star } from 'lucide-react';

interface ReportStats {
  totalProcesses: number;
  openDOF: number;
  completedAudits: number;
  averageSatisfaction: number;
}

export default function QualityReports() {
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

      const [processes, dofs, audits, feedback] = await Promise.all([
        supabase
          .from('quality_processes')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'active'),
        supabase
          .from('quality_dof')
          .select('status')
          .eq('organization_id', orgId),
        supabase
          .from('quality_audits')
          .select('status')
          .eq('organization_id', orgId),
        supabase
          .from('quality_customer_feedback')
          .select('satisfaction_score')
          .eq('organization_id', orgId)
      ]);

      const openDOF = dofs.data?.filter(d => d.status === 'open').length || 0;
      const completedAudits = audits.data?.filter(a => a.status === 'completed').length || 0;

      const scores = feedback.data?.filter(f => f.satisfaction_score).map(f => f.satisfaction_score) || [];
      const averageSatisfaction = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      setStats({
        totalProcesses: processes.count || 0,
        openDOF,
        completedAudits,
        averageSatisfaction: Math.round(averageSatisfaction * 10) / 10
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
      id: 'process',
      title: 'Süreç Performans Raporu',
      description: 'Süreç göstergeleri ve performans analizi',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'dof',
      title: 'DÖF Durum Raporu',
      description: 'Düzeltici/önleyici faaliyet istatistikleri',
      icon: Shield,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      id: 'audit',
      title: 'Tetkik Sonuç Raporu',
      description: 'İç tetkik bulguları ve trend analizi',
      icon: ClipboardCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 'satisfaction',
      title: 'Müşteri Memnuniyeti Raporu',
      description: 'Memnuniyet skorları ve geri bildirimler',
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      id: 'ygg',
      title: 'Yönetimin Gözden Geçirmesi (YGG)',
      description: 'Üst yönetim toplantı raporu ve kararlar',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'comprehensive',
      title: 'Kapsamlı Kalite Raporu',
      description: 'Tüm kalite göstergelerini içeren detaylı rapor',
      icon: BarChart3,
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
        <h1 className="text-3xl font-bold text-gray-900">Kalite Raporları</h1>
        <p className="mt-2 text-gray-600">Kalite yönetim sistem raporları ve analizler</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Özet İstatistikler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats?.totalProcesses}</div>
            <div className="text-sm text-gray-600 mt-1">Aktif Süreç</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats?.openDOF}</div>
            <div className="text-sm text-gray-600 mt-1">Açık DÖF</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats?.completedAudits}</div>
            <div className="text-sm text-gray-600 mt-1">Tamamlanan Tetkik</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats?.averageSatisfaction}</div>
            <div className="text-sm text-gray-600 mt-1">Memnuniyet Skoru</div>
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
              <option>Süreç Performans</option>
              <option>DÖF Durum</option>
              <option>Tetkik Sonuç</option>
              <option>Memnuniyet</option>
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
