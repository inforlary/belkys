import { Settings as SettingsIcon, Mail, Shield, Package, Key, Database, Clock, Bell, Building2 } from 'lucide-react';
import { useLocation } from '../hooks/useLocation';

export default function Settings() {
  const { navigate } = useLocation();

  const settingsSections = [
    {
      icon: SettingsIcon,
      title: 'Genel Ayarlar',
      description: 'Temel sistem ayarlarını yapılandırın',
      path: 'settings/general',
      color: 'bg-blue-500',
    },
    {
      icon: Building2,
      title: 'Kurum Bilgileri',
      description: 'Kurum bilgilerini düzenleyin',
      path: 'settings/organization',
      color: 'bg-purple-500',
    },
    {
      icon: Shield,
      title: 'Güvenlik',
      description: 'Şifre politikası ve güvenlik ayarları',
      path: 'settings/security',
      color: 'bg-red-500',
    },
    {
      icon: Mail,
      title: 'E-posta Ayarları',
      description: 'SMTP sunucu yapılandırması',
      path: 'settings/email',
      color: 'bg-green-500',
    },
    {
      icon: Package,
      title: 'Modüller',
      description: 'Aktif modülleri yönetin',
      path: 'settings/modules',
      color: 'bg-indigo-500',
    },
    {
      icon: Key,
      title: 'API Anahtarları',
      description: 'API anahtarları oluşturun ve yönetin',
      path: 'settings/api-keys',
      color: 'bg-yellow-500',
    },
    {
      icon: Database,
      title: 'Yedekleme',
      description: 'Veritabanı yedekleme ayarları',
      path: 'settings/backups',
      color: 'bg-cyan-500',
    },
    {
      icon: Clock,
      title: 'Zamanlanmış Görevler',
      description: 'Otomatik görevleri planla',
      path: 'settings/scheduled-jobs',
      color: 'bg-orange-500',
    },
    {
      icon: Bell,
      title: 'Duyurular',
      description: 'Sistem duyurularını yönetin',
      path: 'settings/announcements',
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-slate-700" />
          Sistem Ayarları
        </h1>
        <p className="text-slate-600 mt-2">
          Sistem genelindeki yapılandırmaları ve ayarları yönetin
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.path}
              onClick={() => navigate(section.path)}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all text-left group"
            >
              <div className={`${section.color} rounded-lg p-3 inline-flex mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {section.title}
              </h3>
              <p className="text-sm text-slate-600">
                {section.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
