import React, { useState } from 'react';
import { ArrowLeft, Building2, TrendingUp, Target, DollarSign, AlertTriangle, BarChart3, Download, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import InstitutionOverview from '../components/strategic-reports/InstitutionOverview';
import DepartmentAnalysis from '../components/strategic-reports/DepartmentAnalysis';
import IndicatorPerformanceMatrix from '../components/strategic-reports/IndicatorPerformanceMatrix';
import BudgetActivityIntegration from '../components/strategic-reports/BudgetActivityIntegration';
import RiskICMap from '../components/strategic-reports/RiskICMap';
import ComparativeAnalysis from '../components/strategic-reports/ComparativeAnalysis';

type TabType = 'overview' | 'department' | 'indicators' | 'budget' | 'risk' | 'comparative';

export default function StrategicPlanReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    {
      id: 'overview' as TabType,
      label: 'Genel Kurum Görünümü',
      icon: Building2,
      description: 'Kurum geneli özet KPI\'lar ve performans göstergeleri'
    },
    {
      id: 'department' as TabType,
      label: 'Müdürlük Bazlı Analiz',
      icon: TrendingUp,
      description: 'Müdürlük bazında detaylı performans analizi'
    },
    {
      id: 'indicators' as TabType,
      label: 'Gösterge Performans Matrisi',
      icon: Target,
      description: 'Tüm göstergeler ve başarı oranları'
    },
    {
      id: 'budget' as TabType,
      label: 'Bütçe-Faaliyet Entegrasyonu',
      icon: DollarSign,
      description: 'Bütçe kullanımı ve faaliyet ilişkileri'
    },
    {
      id: 'risk' as TabType,
      label: 'Risk & İç Kontrol Haritası',
      icon: AlertTriangle,
      description: 'Risk ve iç kontrol bağlantıları'
    },
    {
      id: 'comparative' as TabType,
      label: 'Karşılaştırmalı Analizler',
      icon: BarChart3,
      description: 'Müdürlükler arası ve dönemsel karşılaştırmalar'
    }
  ];

  const handleExportPDF = () => {
    if (activeTab === 'indicators') {
      alert('Gösterge Performans Matrisi için PDF indirme butonu, tablonun üstünde bulunmaktadır.');
    } else {
      alert('Bu rapor için PDF export işlevi yakında eklenecek...');
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'indicators') {
      alert('Gösterge Performans Matrisi için Excel indirme butonu, tablonun üstünde bulunmaktadır.');
    } else {
      alert('Bu rapor için Excel export işlevi yakında eklenecek...');
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stratejik Plan Raporları</h1>
            <p className="text-sm text-gray-600 mt-1">Kapsamlı performans analizi ve raporlama</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              {tabs.find(t => t.id === activeTab)?.description}
            </p>
          </div>

          <div className="mt-6">
            {activeTab === 'overview' && <InstitutionOverview />}
            {activeTab === 'department' && <DepartmentAnalysis />}
            {activeTab === 'indicators' && <IndicatorPerformanceMatrix />}
            {activeTab === 'budget' && <BudgetActivityIntegration />}
            {activeTab === 'risk' && <RiskICMap />}
            {activeTab === 'comparative' && <ComparativeAnalysis />}
          </div>
        </div>
      </div>
    </div>
  );
}
