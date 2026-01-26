import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Download,
  BarChart3,
  Building2,
  Users,
  Shield,
  TrendingUp,
  Activity,
  ClipboardCheck,
  Star
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import ComplianceReport from '../components/ic-reports/ComplianceReport';
import ActionPlanReport from '../components/ic-reports/ActionPlanReport';
import ComponentAnalysisReport from '../components/ic-reports/ComponentAnalysisReport';
import DepartmentReport from '../components/ic-reports/DepartmentReport';

type ReportType = 'compliance' | 'action_plan' | 'component' | 'department';

interface ActionPlan {
  id: string;
  name: string;
  year: number;
}

const reportCards = [
  {
    id: 'compliance' as ReportType,
    title: 'UYUM DURUM RAPORU',
    icon: BarChart3,
    description: 'Bileşen ve standart bazlı uyum değerlendirmesi özeti, genel şart durumları',
    color: 'blue',
    category: 'ic'
  },
  {
    id: 'action_plan' as ReportType,
    title: 'EYLEM PLANI RAPORU',
    icon: Activity,
    description: 'Eylem planı ilerleme durumu, tamamlanan ve geciken eylemler, birim bazlı dağılım',
    color: 'green',
    category: 'ic'
  },
  {
    id: 'component' as ReportType,
    title: 'BİLEŞEN ANALİZ RAPORU',
    icon: TrendingUp,
    description: '5 bileşen bazında detaylı uyum analizi, radar grafiği, karşılaştırmalı değerlendirme',
    color: 'purple',
    category: 'ic'
  },
  {
    id: 'department' as ReportType,
    title: 'BİRİM BAZLI RAPOR',
    icon: Building2,
    description: 'Birim bazında eylem durumu, sorumluluklar ve ilerleme, geciken eylemler',
    color: 'orange',
    category: 'ic'
  }
];

const qualityReportCards = [
  {
    id: 'process',
    title: 'SÜREÇ PERFORMANS RAPORU',
    icon: TrendingUp,
    description: 'Süreç göstergeleri ve performans analizi',
    color: 'blue',
    category: 'quality'
  },
  {
    id: 'dof',
    title: 'DÖF DURUM RAPORU',
    icon: Shield,
    description: 'Düzeltici/önleyici faaliyet istatistikleri',
    color: 'red',
    category: 'quality'
  },
  {
    id: 'audit',
    title: 'TETKİK SONUÇ RAPORU',
    icon: ClipboardCheck,
    description: 'İç tetkik bulguları ve trend analizi',
    color: 'green',
    category: 'quality'
  },
  {
    id: 'satisfaction',
    title: 'MÜŞTERİ MEMNUNİYETİ RAPORU',
    icon: Star,
    description: 'Memnuniyet skorları ve geri bildirimler',
    color: 'yellow',
    category: 'quality'
  },
  {
    id: 'ygg',
    title: 'YÖNETİMİN GÖZDEN GEÇİRMESİ (YGG)',
    icon: FileText,
    description: 'Üst yönetim toplantı raporu ve kararlar',
    color: 'purple',
    category: 'quality'
  },
  {
    id: 'comprehensive',
    title: 'KAPSAMLI KALİTE RAPORU',
    icon: BarChart3,
    description: 'Tüm kalite göstergelerini içeren detaylı rapor',
    color: 'indigo',
    category: 'quality'
  }
];

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700'
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    button: 'bg-green-600 hover:bg-green-700'
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'text-purple-600',
    button: 'bg-purple-600 hover:bg-purple-700'
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: 'text-orange-600',
    button: 'bg-orange-600 hover:bg-orange-700'
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    icon: 'text-cyan-600',
    button: 'bg-cyan-600 hover:bg-cyan-700'
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    icon: 'text-teal-600',
    button: 'bg-teal-600 hover:bg-teal-700'
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700'
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    button: 'bg-yellow-600 hover:bg-yellow-700'
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: 'text-indigo-600',
    button: 'bg-indigo-600 hover:bg-indigo-700'
  }
};

interface QualityStats {
  totalProcesses: number;
  openDOF: number;
  completedAudits: number;
  averageSatisfaction: number;
}

export default function ICReports() {
  const { profile } = useAuth();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qualityStats, setQualityStats] = useState<QualityStats | null>(null);
  const [showQualityReportModal, setShowQualityReportModal] = useState(false);
  const [selectedQualityReportType, setSelectedQualityReportType] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      loadActionPlans();
      loadQualityStats();
    }
  }, [profile?.organization_id]);

  const loadActionPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ic_action_plans')
        .select('id, name, year')
        .eq('organization_id', profile?.organization_id)
        .order('year', { ascending: false });

      if (error) throw error;

      setActionPlans(data || []);
      if (data && data.length > 0) {
        setSelectedPlanId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading action plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQualityStats = async () => {
    try {
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const [processes, dofs, audits, feedback] = await Promise.all([
        supabase
          .from('qm_processes')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'ACTIVE'),
        supabase
          .from('qm_nonconformities')
          .select('status')
          .eq('organization_id', orgId),
        supabase
          .from('qm_audits')
          .select('status')
          .eq('organization_id', orgId),
        supabase
          .from('qm_customer_feedback')
          .select('satisfaction_score')
          .eq('organization_id', orgId)
      ]);

      const openDOF = dofs.data?.filter(d => d.status === 'OPEN').length || 0;
      const completedAudits = audits.data?.filter(a => a.status === 'COMPLETED').length || 0;

      const scores = feedback.data?.filter(f => f.satisfaction_score).map(f => f.satisfaction_score) || [];
      const averageSatisfaction = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      setQualityStats({
        totalProcesses: processes.count || 0,
        openDOF,
        completedAudits,
        averageSatisfaction: Math.round(averageSatisfaction * 10) / 10
      });
    } catch (error) {
      console.error('Error loading quality stats:', error);
    }
  };

  const handleReportCardClick = (reportType: ReportType) => {
    setSelectedReportType(reportType);
    setShowReportModal(true);
  };

  const handleQualityReportClick = (reportId: string) => {
    setSelectedQualityReportType(reportId);
    setShowQualityReportModal(true);
  };

  const handleCloseModal = () => {
    setShowReportModal(false);
    setSelectedReportType(null);
  };

  const handleCloseQualityModal = () => {
    setShowQualityReportModal(false);
    setSelectedQualityReportType(null);
  };

  const renderQualityReportContent = () => {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Bu rapor yakında hazır olacak.</p>
      </div>
    );
  };

  const renderReportContent = () => {
    if (!selectedReportType || !selectedPlanId) return null;

    switch (selectedReportType) {
      case 'compliance':
        return <ComplianceReport planId={selectedPlanId} onClose={handleCloseModal} />;
      case 'action_plan':
        return <ActionPlanReport planId={selectedPlanId} onClose={handleCloseModal} />;
      case 'component':
        return <ComponentAnalysisReport planId={selectedPlanId} onClose={handleCloseModal} />;
      case 'department':
        return <DepartmentReport planId={selectedPlanId} onClose={handleCloseModal} />;
      default:
        return null;
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">İç Kontrol Raporları</h1>
        <p className="text-sm text-gray-600 mt-1">İç kontrol sistemi raporları ve analizler</p>
      </div>

      {actionPlans.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900">Eylem Planı:</span>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="input-field flex-1"
            >
              {actionPlans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.year})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">İç Kontrol Raporları</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportCards.map((report) => {
            const Icon = report.icon;
            const colors = colorClasses[report.color as keyof typeof colorClasses];

            return (
              <div
                key={report.id}
                className={`${colors.bg} border ${colors.border} rounded-lg p-6 space-y-4`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-8 h-8 ${colors.icon} flex-shrink-0`} />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{report.title}</h3>
                  </div>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed">
                  {report.description}
                </p>

                <div className="text-xs text-gray-500">
                  Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
                </div>

                <button
                  onClick={() => handleReportCardClick(report.id)}
                  disabled={!selectedPlanId && report.id !== 'meeting' && report.id !== 'assurance'}
                  className={`w-full btn-primary ${colors.button} text-white text-sm py-2`}
                >
                  Rapor Oluştur
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t-4 border-blue-100 pt-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Süreç Yönetimi Raporları</h2>
          <p className="text-sm text-gray-600">Kalite yönetim sistemi raporları</p>
        </div>

        {qualityStats && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Özet İstatistikler</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{qualityStats.totalProcesses}</div>
                <div className="text-sm text-gray-600 mt-1">Aktif Süreç</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{qualityStats.openDOF}</div>
                <div className="text-sm text-gray-600 mt-1">Açık DÖF</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{qualityStats.completedAudits}</div>
                <div className="text-sm text-gray-600 mt-1">Tamamlanan Tetkik</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{qualityStats.averageSatisfaction}</div>
                <div className="text-sm text-gray-600 mt-1">Memnuniyet Skoru</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {qualityReportCards.map((report) => {
            const Icon = report.icon;
            const colors = colorClasses[report.color as keyof typeof colorClasses];

            return (
              <div
                key={report.id}
                className={`${colors.bg} border ${colors.border} rounded-lg p-6 space-y-4`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-8 h-8 ${colors.icon} flex-shrink-0`} />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{report.title}</h3>
                  </div>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed">
                  {report.description}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleQualityReportClick(report.id)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
                  >
                    <Download className="w-3 h-3" />
                    Excel
                  </button>
                  <button
                    onClick={() => handleQualityReportClick(report.id)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs"
                  >
                    <FileText className="w-3 h-3" />
                    PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        isOpen={showReportModal}
        onClose={handleCloseModal}
        title={reportCards.find(r => r.id === selectedReportType)?.title || ''}
        maxWidth="6xl"
      >
        {renderReportContent()}
      </Modal>

      <Modal
        isOpen={showQualityReportModal}
        onClose={handleCloseQualityModal}
        title={qualityReportCards.find(r => r.id === selectedQualityReportType)?.title || ''}
        maxWidth="6xl"
      >
        {renderQualityReportContent()}
      </Modal>
    </div>
  );
}
