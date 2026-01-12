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
  Activity
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import ComplianceReport from '../components/ic-reports/ComplianceReport';
import ActionPlanReport from '../components/ic-reports/ActionPlanReport';
import ComponentAnalysisReport from '../components/ic-reports/ComponentAnalysisReport';
import DepartmentReport from '../components/ic-reports/DepartmentReport';
import MeetingReport from '../components/ic-reports/MeetingReport';
import AssuranceReport from '../components/ic-reports/AssuranceReport';

type ReportType = 'compliance' | 'action_plan' | 'component' | 'department' | 'meeting' | 'assurance';

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
    color: 'blue'
  },
  {
    id: 'action_plan' as ReportType,
    title: 'EYLEM PLANI RAPORU',
    icon: Activity,
    description: 'Eylem planı ilerleme durumu, tamamlanan ve geciken eylemler, birim bazlı dağılım',
    color: 'green'
  },
  {
    id: 'component' as ReportType,
    title: 'BİLEŞEN ANALİZ RAPORU',
    icon: TrendingUp,
    description: '5 bileşen bazında detaylı uyum analizi, radar grafiği, karşılaştırmalı değerlendirme',
    color: 'purple'
  },
  {
    id: 'department' as ReportType,
    title: 'BİRİM BAZLI RAPOR',
    icon: Building2,
    description: 'Birim bazında eylem durumu, sorumluluklar ve ilerleme, geciken eylemler',
    color: 'orange'
  },
  {
    id: 'meeting' as ReportType,
    title: 'İKİYK TOPLANTI RAPORU',
    icon: Users,
    description: 'İKİYK toplantı özetleri, alınan kararlar ve takip durumları',
    color: 'cyan'
  },
  {
    id: 'assurance' as ReportType,
    title: 'GÜVENCE BEYANI RAPORU',
    icon: Shield,
    description: 'Birim ve üst yönetici güvence beyanları durumu, yıllık konsolidasyon',
    color: 'teal'
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
  }
};

export default function ICReports() {
  const { profile } = useAuth();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadActionPlans();
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

  const handleReportCardClick = (reportType: ReportType) => {
    setSelectedReportType(reportType);
    setShowReportModal(true);
  };

  const handleCloseModal = () => {
    setShowReportModal(false);
    setSelectedReportType(null);
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
      case 'meeting':
        return <MeetingReport onClose={handleCloseModal} />;
      case 'assurance':
        return <AssuranceReport onClose={handleCloseModal} />;
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

      <Modal
        isOpen={showReportModal}
        onClose={handleCloseModal}
        title={reportCards.find(r => r.id === selectedReportType)?.title || ''}
        maxWidth="6xl"
      >
        {renderReportContent()}
      </Modal>
    </div>
  );
}
