import { Shield, Users, Activity, Database, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          Yönetim Paneli
        </h1>
        <p className="text-slate-600 mt-2">Sistem yönetimi ve izleme</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Toplam Kullanıcı</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">--</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Aktif Oturumlar</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">--</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Veritabanı Boyutu</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">--</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Sistem Performansı</p>
              <p className="text-3xl font-bold text-green-600 mt-2">--</p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-slate-500">İstatistikler yakında yüklenecek</p>
      </div>
    </div>
  );
}
