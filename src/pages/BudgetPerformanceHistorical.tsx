import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';

export default function BudgetPerformanceHistorical() {
  const { profile } = useAuth();

  if (!profile?.organization_id) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Yetkisiz Erişim</h3>
            <p className="text-sm text-red-700 mt-1">
              Bu sayfayı görüntülemek için organizasyon bilgileriniz eksik.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Geçmiş Veri Yönetimi</h1>
        <p className="text-gray-600 mt-2">
          Geçmiş yıllara ait bütçe ve gerçekleşme verilerini yönetin.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Geliştirme Aşamasında</h2>
        <p className="text-blue-700">
          Bu sayfa şu anda geliştirilme aşamasındadır. Yakında kullanıma açılacaktır.
        </p>
        <p className="text-blue-600 mt-2 text-sm">
          Bu sayfada geçmiş yıllara ait ekonomik kod bazında bütçe ve gerçekleşme verilerini girebilecek,
          düzenleyebilecek ve sistemin doğru hesaplama yapabilmesi için gerekli tarihsel verileri saklayabileceksiniz.
        </p>
      </div>
    </div>
  );
}
