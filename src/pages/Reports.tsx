import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Award } from 'lucide-react';
import PerformanceDashboard from '../components/reports/PerformanceDashboard';
import IndicatorPerformance from '../components/reports/IndicatorPerformance';
import ExecutiveSummary from '../components/reports/ExecutiveSummary';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type ReportTab =
  | 'performance-dashboard'
  | 'indicator-performance'
  | 'executive-summary';

export default function Reports() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('executive-summary');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    loadAvailableYears();
  }, [profile?.organization_id]);

  const loadAvailableYears = async () => {
    if (!profile?.organization_id) return;

    try {
      // Get years with approved data entries
      const { data } = await supabase
        .from('indicator_data_entries')
        .select('period_year')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'approved')
        .order('period_year', { ascending: false });

      if (data && data.length > 0) {
        const uniqueYears = Array.from(new Set(data.map(d => d.period_year))).sort((a, b) => b - a);
        setAvailableYears(uniqueYears);

        // Set the latest year with data as default
        if (uniqueYears.length > 0 && !uniqueYears.includes(selectedYear)) {
          setSelectedYear(uniqueYears[0]);
        }
      } else {
        // No data entries, use current and previous years
        setAvailableYears(Array.from({ length: 5 }, (_, i) => currentYear - i));
      }
    } catch (error) {
      console.error('Yıl verisi yüklenirken hata:', error);
      setAvailableYears(Array.from({ length: 5 }, (_, i) => currentYear - i));
    }
  };

  const years = availableYears.length > 0 ? availableYears : Array.from({ length: 5 }, (_, i) => currentYear - i);

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
