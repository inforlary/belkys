import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp,
  FileText,
  DollarSign,
  AlertTriangle,
  Shield,
  Award,
  Settings,
  Users,
  Save,
  Search,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  is_active: boolean;
  module_strategic_planning: boolean;
  module_activity_reports: boolean;
  module_budget_performance: boolean;
  module_risk_management: boolean;
  module_internal_control: boolean;
  module_quality_management: boolean;
  module_settings: boolean;
  module_administration: boolean;
}

interface Module {
  key: keyof Pick<Organization,
    'module_strategic_planning' |
    'module_activity_reports' |
    'module_budget_performance' |
    'module_risk_management' |
    'module_internal_control' |
    'module_quality_management' |
    'module_settings' |
    'module_administration'
  >;
  name: string;
  description: string;
  icon: JSX.Element;
  color: string;
}

const MODULES: Module[] = [
  {
    key: 'module_strategic_planning',
    name: 'Stratejik Plan',
    description: 'Stratejik planlama, amaç ve hedef yönetimi',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'blue'
  },
  {
    key: 'module_activity_reports',
    name: 'Faaliyet Raporu',
    description: 'Faaliyet raporları ve izleme',
    icon: <FileText className="w-5 h-5" />,
    color: 'green'
  },
  {
    key: 'module_budget_performance',
    name: 'Bütçe ve Performans',
    description: 'Bütçe yönetimi ve performans takibi',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'yellow'
  },
  {
    key: 'module_risk_management',
    name: 'Risk Yönetimi',
    description: 'Risk analizi ve yönetimi',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'red'
  },
  {
    key: 'module_internal_control',
    name: 'İç Kontrol',
    description: 'İç kontrol standartları ve değerlendirme',
    icon: <Shield className="w-5 h-5" />,
    color: 'purple'
  },
  {
    key: 'module_quality_management',
    name: 'Kalite Yönetimi',
    description: 'Kalite yönetim sistemi',
    icon: <Award className="w-5 h-5" />,
    color: 'indigo'
  },
  {
    key: 'module_settings',
    name: 'Ayarlar',
    description: 'Sistem ayarları ve yapılandırma',
    icon: <Settings className="w-5 h-5" />,
    color: 'slate'
  },
  {
    key: 'module_administration',
    name: 'Yönetim',
    description: 'Kullanıcı ve organizasyon yönetimi',
    icon: <Users className="w-5 h-5" />,
    color: 'cyan'
  }
];

export default function OrganizationModuleManager() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
      alert('Kuruluşlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = async (orgId: string, moduleKey: Module['key'], currentValue: boolean) => {
    setSaving(orgId);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ [moduleKey]: !currentValue })
        .eq('id', orgId);

      if (error) throw error;

      setOrganizations(orgs =>
        orgs.map(org =>
          org.id === orgId
            ? { ...org, [moduleKey]: !currentValue }
            : org
        )
      );
    } catch (error) {
      console.error('Error updating module:', error);
      alert('Modül güncellenirken hata oluştu');
    } finally {
      setSaving(null);
    }
  };

  const toggleAllModules = async (orgId: string, enable: boolean) => {
    setSaving(orgId);
    try {
      const updates = MODULES.reduce((acc, module) => ({
        ...acc,
        [module.key]: enable
      }), {});

      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId);

      if (error) throw error;

      setOrganizations(orgs =>
        orgs.map(org =>
          org.id === orgId
            ? { ...org, ...updates }
            : org
        )
      );
    } catch (error) {
      console.error('Error updating modules:', error);
      alert('Modüller güncellenirken hata oluştu');
    } finally {
      setSaving(null);
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getModuleStats = (org: Organization) => {
    const activeCount = MODULES.filter(m => org[m.key]).length;
    return { active: activeCount, total: MODULES.length };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Modül Erişim Yetkileri</h2>
          <p className="text-sm text-slate-600 mt-1">
            Kuruluşlar için modül erişimlerini yönetin
          </p>
        </div>
        <div className="text-sm text-slate-600">
          <span className="font-semibold">{filteredOrganizations.length}</span> Kuruluş
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Kuruluş ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">
                  Kuruluş
                </th>
                {MODULES.map((module) => (
                  <th key={module.key} className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`text-${module.color}-600`}>
                        {module.icon}
                      </div>
                      <span>{module.name}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrganizations.map((org) => {
                const stats = getModuleStats(org);
                const isSaving = saving === org.id;

                return (
                  <tr key={org.id} className={`hover:bg-slate-50 transition-colors ${!org.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 sticky left-0 bg-white">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-900">{org.name}</div>
                          {!org.is_active && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              Pasif
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500">{org.subdomain}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {stats.active}/{stats.total} Modül Aktif
                        </div>
                      </div>
                    </td>
                    {MODULES.map((module) => {
                      const isActive = org[module.key];

                      return (
                        <td key={module.key} className="px-4 py-4 text-center">
                          <button
                            onClick={() => toggleModule(org.id, module.key, isActive)}
                            disabled={isSaving}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
                            title={`${module.name}: ${isActive ? 'Aktif' : 'Pasif'}`}
                          >
                            {isActive ? (
                              <CheckCircle className={`w-6 h-6 text-green-600`} />
                            ) : (
                              <XCircle className="w-6 h-6 text-slate-300" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleAllModules(org.id, true)}
                          disabled={isSaving || stats.active === stats.total}
                          className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Tümünü Aç"
                        >
                          Tümü Aç
                        </button>
                        <button
                          onClick={() => toggleAllModules(org.id, false)}
                          disabled={isSaving || stats.active === 0}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Tümünü Kapat"
                        >
                          Tümü Kapat
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOrganizations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">Kuruluş bulunamadı</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Modül Açıklamaları</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODULES.map((module) => (
            <div key={module.key} className="flex items-start gap-2 text-sm">
              <div className={`text-${module.color}-600 mt-0.5`}>
                {module.icon}
              </div>
              <div>
                <div className="font-medium text-blue-900">{module.name}</div>
                <div className="text-blue-700">{module.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
