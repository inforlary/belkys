import { useState } from 'react';
import { FileText, TrendingUp, Activity, BarChart3, Building2, Calendar, Download } from 'lucide-react';
import RiskStatusReport from '../components/risk-reports/RiskStatusReport';
import RiskMatrixReport from '../components/risk-reports/RiskMatrixReport';
import ActivityProgressReport from '../components/risk-reports/ActivityProgressReport';
import IndicatorStatusReport from '../components/risk-reports/IndicatorStatusReport';
import DepartmentRiskReport from '../components/risk-reports/DepartmentRiskReport';
import PeriodComparisonReport from '../components/risk-reports/PeriodComparisonReport';

type ReportType = 'status' | 'matrix' | 'activity' | 'indicator' | 'department' | 'period' | null;

export default function RiskReports() {
  const [selectedReport, setSelectedReport] = useState<ReportType>(null);

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
      description: 'Risk faaliyetlerinin ilerleme durumu, geciken faaliyetler, tamamlananlar',
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
      description: 'Birim bazında risk dağılımı, birim risk profili, faaliyet durumu',
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
      default:
        return null;
    }
  };

  if (selectedReport) {
    return renderReport();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risk Raporları</h1>
          <p className="text-sm text-slate-600 mt-1">Risk yönetimi raporları ve analizler</p>
        </div>
      </div>

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

              <h3 className="text-lg font-bold text-slate-900 mb-2">{card.title}</h3>
              <p className="text-sm text-slate-600 mb-4 min-h-[3rem]">{card.description}</p>

              <div className="text-xs text-slate-500 mb-4">
                Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
              </div>

              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                <Download className="w-4 h-4" />
                Rapor Oluştur
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
