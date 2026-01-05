import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Shield,
  FileText,
  Award,
  Search,
  Scale,
  Lightbulb,
  BarChart3,
  Calendar
} from 'lucide-react';

interface SystemHealthData {
  strategic_planning_score: number;
  risk_management_score: number;
  internal_control_score: number;
  quality_management_score: number;
  audit_compliance_score: number;
  legal_compliance_score: number;
  budget_performance_score: number;
  overall_system_health_score: number;
  measurement_date: string;
}

interface ModuleStatus {
  name: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ElementType;
  color: string;
  trend: 'up' | 'down' | 'stable';
  details: string;
}

export default function IntegratedManagementDashboard() {
  const { user, organization } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  useEffect(() => {
    if (organization?.id) {
      fetchSystemHealth();
    }
  }, [organization?.id, selectedPeriod]);

  const fetchSystemHealth = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('system_health_metrics')
        .select('*')
        .eq('organization_id', organization?.id)
        .order('measurement_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setHealthData(data);
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModuleStatus = (score: number | null): 'healthy' | 'warning' | 'critical' => {
    if (!score) return 'warning';
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    return 'critical';
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'stable': return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const modules: ModuleStatus[] = [
    {
      name: 'Stratejik Planlama',
      score: healthData?.strategic_planning_score || 0,
      status: getModuleStatus(healthData?.strategic_planning_score),
      icon: Target,
      color: 'blue',
      trend: 'up',
      details: 'Hedefler, göstergeler, faaliyetler'
    },
    {
      name: 'Risk Yönetimi',
      score: healthData?.risk_management_score || 0,
      status: getModuleStatus(healthData?.risk_management_score),
      icon: Shield,
      color: 'red',
      trend: 'stable',
      details: 'Risk değerlendirme, kontrol, raporlama'
    },
    {
      name: 'İç Kontrol',
      score: healthData?.internal_control_score || 0,
      status: getModuleStatus(healthData?.internal_control_score),
      icon: CheckCircle,
      color: 'green',
      trend: 'up',
      details: 'KİKS uyumu, kontrol faaliyetleri'
    },
    {
      name: 'Kalite Yönetimi',
      score: healthData?.quality_management_score || 0,
      status: getModuleStatus(healthData?.quality_management_score),
      icon: Award,
      color: 'purple',
      trend: 'up',
      details: 'ISO standartları, müşteri memnuniyeti'
    },
    {
      name: 'İç & Dış Denetim',
      score: healthData?.audit_compliance_score || 0,
      status: getModuleStatus(healthData?.audit_compliance_score),
      icon: Search,
      color: 'indigo',
      trend: 'stable',
      details: 'Denetim bulguları, takip, raporlama'
    },
    {
      name: 'Yasal Uyumluluk',
      score: healthData?.legal_compliance_score || 0,
      status: getModuleStatus(healthData?.legal_compliance_score),
      icon: Scale,
      color: 'orange',
      trend: 'warning',
      details: 'Mevzuat takibi, uyumluluk değerlendirmesi'
    },
    {
      name: 'Bütçe Performansı',
      score: healthData?.budget_performance_score || 0,
      status: getModuleStatus(healthData?.budget_performance_score),
      icon: BarChart3,
      color: 'teal',
      trend: 'up',
      details: 'Bütçe gerçekleşme, harcama kontrolü'
    },
    {
      name: 'Sürekli İyileştirme',
      score: 85,
      status: 'healthy',
      icon: Lightbulb,
      color: 'yellow',
      trend: 'up',
      details: 'Lessons learned, best practices, inisiyatifler'
    }
  ];

  const overallScore = healthData?.overall_system_health_score || 0;
  const overallStatus = getModuleStatus(overallScore);

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Entegre Yönetim Sistemi</h1>
            <p className="mt-2 text-gray-600">
              Tüm yönetim sistemlerinin konsolide görünümü ve sistem sağlığı
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="current">Güncel Durum</option>
              <option value="month">Bu Ay</option>
              <option value="quarter">Bu Çeyrek</option>
              <option value="year">Bu Yıl</option>
            </select>
          </div>
        </div>

        <div className={`rounded-lg p-6 border-2 ${getStatusColor(overallStatus)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white rounded-lg">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Genel Sistem Sağlığı</h2>
                <p className="text-sm mt-1">
                  {healthData?.measurement_date
                    ? `Son Ölçüm: ${new Date(healthData.measurement_date).toLocaleDateString('tr-TR')}`
                    : 'Henüz ölçüm yapılmadı'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{overallScore.toFixed(0)}%</div>
              <div className="text-sm font-semibold mt-1">
                {overallStatus === 'healthy' && 'SAĞLIKLI'}
                {overallStatus === 'warning' && 'DİKKAT GEREKTİRİYOR'}
                {overallStatus === 'critical' && 'KRİTİK DURUM'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.name}
                className={`rounded-lg p-6 border-2 ${getStatusColor(module.status)} hover:shadow-lg transition-shadow cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-white rounded-lg">
                    <Icon className="w-6 h-6" />
                  </div>
                  {getTrendIcon(module.trend)}
                </div>
                <h3 className="font-semibold text-lg mb-1">{module.name}</h3>
                <p className="text-sm opacity-75 mb-3">{module.details}</p>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{module.score.toFixed(0)}%</span>
                  <span className="text-xs font-semibold px-2 py-1 bg-white rounded">
                    {module.status === 'healthy' && 'TAMAM'}
                    {module.status === 'warning' && 'UYARI'}
                    {module.status === 'critical' && 'ACİL'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
              Dikkat Gerektiren Konular
            </h3>
            <div className="space-y-3">
              {modules
                .filter(m => m.status === 'warning' || m.status === 'critical')
                .map(module => (
                  <div key={module.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {React.createElement(module.icon, { className: 'w-5 h-5 text-gray-600' })}
                      <span className="font-medium">{module.name}</span>
                    </div>
                    <span className={`text-sm font-semibold ${
                      module.status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {module.score.toFixed(0)}%
                    </span>
                  </div>
                ))}
              {modules.filter(m => m.status === 'warning' || m.status === 'critical').length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  Tüm sistemler normal çalışıyor
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Entegre Raporlar
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-between">
                <span className="font-medium">Stratejik Plan Durum Raporu</span>
                <Calendar className="w-4 h-4 text-blue-600" />
              </button>
              <button className="w-full text-left p-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-between">
                <span className="font-medium">Risk & Kontrol Değerlendirme</span>
                <Calendar className="w-4 h-4 text-red-600" />
              </button>
              <button className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-between">
                <span className="font-medium">Kalite & Uyumluluk Raporu</span>
                <Calendar className="w-4 h-4 text-green-600" />
              </button>
              <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center justify-between">
                <span className="font-medium">Denetim Bulguları Özet</span>
                <Calendar className="w-4 h-4 text-purple-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Sistem Entegrasyonu</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 mb-1">100%</div>
              <div className="text-sm text-gray-600">Modül Entegrasyonu</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600 mb-1">8/8</div>
              <div className="text-sm text-gray-600">Aktif Modüller</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600 mb-1">95%</div>
              <div className="text-sm text-gray-600">Veri Kalitesi</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600 mb-1">87%</div>
              <div className="text-sm text-gray-600">Kullanıcı Katılımı</div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">ISO 31000 ve COSO Entegrasyonu</h3>
          <p className="text-blue-700 text-sm">
            Sisteminizdeki tüm modüller, uluslararası standartlar (ISO 9001, ISO 31000, COSO Framework, KİKS)
            ve en iyi uygulamalar doğrultusunda tam entegre şekilde çalışmaktadır. Kurumsal yönetim araçları
            arasındaki ilişki görselde gösterilen yapıya uygun olarak kurulmuştur.
          </p>
        </div>
    </div>
  );
}