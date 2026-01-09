import { useLocation } from '../hooks/useLocation';
import {
  FileText,
  FolderTree,
  Sliders,
  ArrowRight
} from 'lucide-react';

export default function RiskSettings() {
  const { navigate } = useLocation();

  const settingsCards = [
    {
      id: 'strategy',
      title: 'Risk Strateji Belgesi',
      description: 'Risk politikası, iştah tanımları, roller ve sorumluluklar',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      path: '/risk-management/settings/strategy'
    },
    {
      id: 'categories',
      title: 'Risk Kategorileri',
      description: 'Risk sınıflandırması ve kategori yönetimi',
      icon: FolderTree,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      path: '/risk-management/settings/categories'
    },
    {
      id: 'criteria',
      title: 'Olasılık ve Etki Kriterleri',
      description: 'Risk değerlendirme kriterleri ve skor aralıkları',
      icon: Sliders,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      path: '/risk-management/settings/criteria'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Risk Yönetimi Ayarları</h1>
        <p className="mt-2 text-gray-600">
          Risk yönetim sisteminin temel konfigürasyonu ve parametreleri
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => navigate(card.path)}
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className={`${card.bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{card.description}</p>
              <div className="flex items-center text-blue-600 text-sm font-medium">
                Yönet
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Risk Yönetim Sistemi Hakkında</h3>
        <p className="text-sm text-gray-700 mb-4">
          Risk yönetim sistemi, kurumunuzdaki tüm risklerin sistematik olarak tanımlanması,
          değerlendirilmesi, önceliklendirilmesi ve yönetilmesini sağlar.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-900 mb-1">Strateji Belgesi</div>
            <div className="text-gray-600">
              Risk yönetim politikası, iştah seviyeleri ve organizasyonel roller tanımlanır.
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-900 mb-1">Kategoriler</div>
            <div className="text-gray-600">
              Risklerin sınıflandırılması için kullanılan kategori yapısı oluşturulur.
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-900 mb-1">Kriterler</div>
            <div className="text-gray-600">
              Risk olasılık ve etki seviyelerinin tanımları ve skor hesaplama kuralları belirlenir.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
