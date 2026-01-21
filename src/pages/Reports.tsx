import { useState } from 'react';
import { TrendingUp, BarChart3, Users, Briefcase, ClipboardCheck, Target, Award, Calendar } from 'lucide-react';
import PerformanceDashboard from '../components/reports/PerformanceDashboard';
import IndicatorPerformance from '../components/reports/IndicatorPerformance';
import DepartmentPerformance from '../components/reports/DepartmentPerformance';
import ActivityStatus from '../components/reports/ActivityStatus';
import DataEntryStatus from '../components/reports/DataEntryStatus';
import GoalAchievement from '../components/reports/GoalAchievement';
import ExecutiveSummary from '../components/reports/ExecutiveSummary';
import { PeriodicDataComparison } from '../components/reports/PeriodicDataComparison';

type ReportTab =
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
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const tabs = [
    {
      id: 'executive-summary' as ReportTab,
      name: 'Yönetici Özeti',
      icon: Award,
      description: 'Yüksek seviye performans özeti, stratejik planlar ve öneriler',
      component: ExecutiveSummary,
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
            <div className="mb-4 flex items-center justify-between">
              <p className="text-slate-600">{activeTabData.description}</p>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Yıl:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {ActiveComponent && <ActiveComponent selectedYear={selectedYear} />}
        </div>
      </div>
    </div>
  );
}
