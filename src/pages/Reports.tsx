import { useState } from 'react';
import { FileText, TrendingUp, BarChart3, Users, Briefcase, ClipboardCheck, Target, Award, Calendar } from 'lucide-react';
import StrategicPlanSummary from '../components/reports/StrategicPlanSummary';
import PerformanceDashboard from '../components/reports/PerformanceDashboard';
import IndicatorPerformance from '../components/reports/IndicatorPerformance';
import DepartmentPerformance from '../components/reports/DepartmentPerformance';
import ActivityStatus from '../components/reports/ActivityStatus';
import DataEntryStatus from '../components/reports/DataEntryStatus';
import GoalAchievement from '../components/reports/GoalAchievement';
import ExecutiveSummary from '../components/reports/ExecutiveSummary';
import { PeriodicDataComparison } from '../components/reports/PeriodicDataComparison';

type ReportTab =
  | 'strategic-plan'
  | 'performance-dashboard'
  | 'indicator-performance'
  | 'department-performance'
  | 'activity-status'
  | 'data-entry-status'
  | 'goal-achievement'
  | 'executive-summary'
  | 'periodic-comparison';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('executive-summary');

  const tabs = [
    {
      id: 'executive-summary' as ReportTab,
      name: 'Yönetici Özeti',
      icon: Award,
      description: 'Yüksek seviye performans özeti ve öneriler',
      component: ExecutiveSummary,
    },
    {
      id: 'strategic-plan' as ReportTab,
      name: 'Stratejik Plan Özeti',
      icon: FileText,
      description: 'Tüm stratejik planların genel durumu',
      component: StrategicPlanSummary,
    },
    {
      id: 'performance-dashboard' as ReportTab,
      name: 'Performans Gösterge Paneli',
      icon: TrendingUp,
      description: 'Birimler bazında performans karşılaştırması',
      component: PerformanceDashboard,
    },
    {
      id: 'indicator-performance' as ReportTab,
      name: 'Gösterge Performansı',
      icon: BarChart3,
      description: 'Çeyrek dönem bazında detaylı gösterge analizi',
      component: IndicatorPerformance,
    },
    {
      id: 'department-performance' as ReportTab,
      name: 'Birim Performansı',
      icon: Users,
      description: 'Birimler arası karşılaştırmalı performans analizi',
      component: DepartmentPerformance,
    },
    {
      id: 'goal-achievement' as ReportTab,
      name: 'Hedef Başarısı',
      icon: Target,
      description: 'Hedeflere ulaşma durumu ve başarı tahminleri',
      component: GoalAchievement,
    },
    {
      id: 'activity-status' as ReportTab,
      name: 'Faaliyet Durumu',
      icon: Briefcase,
      description: 'Faaliyet izleme ve durum raporları',
      component: ActivityStatus,
    },
    {
      id: 'data-entry-status' as ReportTab,
      name: 'Veri Giriş Durumu',
      icon: ClipboardCheck,
      description: 'Veri girişi tamamlanma durumu',
      component: DataEntryStatus,
    },
    {
      id: 'periodic-comparison' as ReportTab,
      name: 'Dönemsel Karşılaştırma',
      icon: Calendar,
      description: 'Dönemler arası karşılaştırmalı analiz',
      component: PeriodicDataComparison,
    },
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">Raporlar</h1>
        <p className="text-blue-100 mt-2">Performans analizleri ve detaylı raporlar</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200 overflow-x-auto">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap border-b-2 ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTabData && (
            <div className="mb-4">
              <p className="text-slate-600">{activeTabData.description}</p>
            </div>
          )}
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  );
}
