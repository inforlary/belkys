import { useState } from 'react';
import { FileBarChart, FileText, Target, TrendingUp } from 'lucide-react';
import IlyasReportModal from '../components/project-reports/IlyasReportModal';
import BeyanReportModal from '../components/project-reports/BeyanReportModal';
import SPRealizationReportModal from '../components/project-reports/SPRealizationReportModal';
import PeriodComparisonReportModal from '../components/project-reports/PeriodComparisonReportModal';

type ReportType = 'ilyas' | 'beyan' | 'sp' | 'period' | null;

export default function ProjectReports() {
  const [activeModal, setActiveModal] = useState<ReportType>(null);

  const reportCards = [
    {
      id: 'ilyas',
      icon: FileBarChart,
      title: 'İLYAS Raporu',
      description: 'İçişleri Bakanlığı formatında dönemsel yatırım izleme raporu',
      lastCreated: '15.01.2026',
      color: 'blue'
    },
    {
      id: 'beyan',
      icon: FileText,
      title: 'Beyanname Raporu',
      description: 'Seçim beyannamesi proje durum raporu',
      lastCreated: '10.01.2026',
      color: 'green'
    },
    {
      id: 'sp',
      icon: Target,
      title: 'SP Gerçekleşme Raporu',
      description: 'Stratejik plan hedeflerine göre proje gerçekleşmeleri',
      lastCreated: '12.01.2026',
      color: 'purple'
    },
    {
      id: 'period',
      icon: TrendingUp,
      title: 'Dönemsel Karşılaştırma',
      description: 'Dönemler arası performans analizi ve karşılaştırma',
      lastCreated: '08.01.2026',
      color: 'orange'
    }
  ];

  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">📈 Raporlar</h1>
        <p className="text-blue-100 mt-2">Proje ve performans raporlarını oluşturun</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
            >
              <div className={`bg-gradient-to-r ${colorClasses[card.color as keyof typeof colorClasses]} p-4`}>
                <div className="flex items-center gap-3 text-white">
                  <Icon className="w-8 h-8" />
                  <h3 className="text-xl font-bold">{card.title}</h3>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-600 mb-4 min-h-[48px]">{card.description}</p>

                <div className="text-sm text-gray-500 mb-4">
                  Son oluşturma: {card.lastCreated}
                </div>

                <button
                  onClick={() => setActiveModal(card.id as ReportType)}
                  className={`w-full bg-gradient-to-r ${colorClasses[card.color as keyof typeof colorClasses]} text-white px-4 py-2 rounded-lg font-medium transition-all`}
                >
                  Rapor Oluştur
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeModal === 'ilyas' && (
        <IlyasReportModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'beyan' && (
        <BeyanReportModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'sp' && (
        <SPRealizationReportModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'period' && (
        <PeriodComparisonReportModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
