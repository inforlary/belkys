import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Globe, Mail, Phone, Users, CheckCircle, XCircle, Eye, Activity, Edit2, Trash2, UserPlus, FileText, Settings, DollarSign, TrendingUp, TrendingDown, Layers, Shield, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import CreateOrganizationModal from '../components/superadmin/CreateOrganizationModal';
import EditOrganizationModal from '../components/superadmin/EditOrganizationModal';
import OrganizationUsersModal from '../components/superadmin/OrganizationUsersModal';
import ActivityLogsModal from '../components/superadmin/ActivityLogsModal';
import StandardFinancingTypesManager from '../components/superadmin/StandardFinancingTypesManager';
import StandardExpenseCodesManager from '../components/superadmin/StandardExpenseCodesManager';
import StandardRevenueCodesManager from '../components/superadmin/StandardRevenueCodesManager';
import StandardProgramsManager from '../components/superadmin/StandardProgramsManager';
import OrganizationLicenseManager from '../components/superadmin/OrganizationLicenseManager';
import OrganizationModuleManager from '../components/superadmin/OrganizationModuleManager';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  contact_email: string;
  contact_phone?: string;
  logo_url?: string;
  is_active: boolean;
  max_users: number;
  created_at: string;
  module_strategic_planning: boolean;
  module_activity_reports: boolean;
  module_budget_performance: boolean;
  module_internal_control: boolean;
  module_risk_management: boolean;
  module_quality_management: boolean;
  module_settings: boolean;
  module_administration: boolean;
}

interface OrganizationStats {
  organizationId: string;
  userCount: number;
  planCount: number;
  objectiveCount: number;
  goalCount: number;
  indicatorCount: number;
}

type TabType = 'organizations' | 'standard-codes' | 'organization-licenses' | 'module-access';
type StandardCodeTab = 'expense' | 'revenue' | 'financing' | 'programs';

export default function SuperAdmin() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [activeStandardCodeTab, setActiveStandardCodeTab] = useState<StandardCodeTab>('expense');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<Map<string, OrganizationStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showActivityLogsModal, setShowActivityLogsModal] = useState(false);
  const [selectedOrgForLogs, setSelectedOrgForLogs] = useState<{id: string, name: string} | null>(null);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.is_super_admin) {
      loadOrganizations();
    }
  }, [profile]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrganizations(data || []);

      const statsMap = new Map<string, OrganizationStats>();
      for (const org of data || []) {
        const orgStats = await loadOrgStats(org.id);
        statsMap.set(org.id, orgStats);
      }
      setStats(statsMap);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgStats = async (orgId: string): Promise<OrganizationStats> => {
    try {
      const [usersRes, plansRes, objectivesRes, goalsRes, indicatorsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('strategic_plans').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('objectives').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('goals').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('indicators').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      ]);

      return {
        organizationId: orgId,
        userCount: usersRes.count || 0,
        planCount: plansRes.count || 0,
        objectiveCount: objectivesRes.count || 0,
        goalCount: goalsRes.count || 0,
        indicatorCount: indicatorsRes.count || 0,
      };
    } catch (error) {
      console.error('Error loading org stats:', error);
      return {
        organizationId: orgId,
        userCount: 0,
        planCount: 0,
        objectiveCount: 0,
        goalCount: 0,
        indicatorCount: 0,
      };
    }
  };

  const toggleOrganizationStatus = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ is_active: !org.is_active })
        .eq('id', org.id);

      if (error) throw error;

      if (org.is_active) {
        await supabase.rpc('terminate_organization_sessions', { org_id: org.id });
      }

      await supabase.from('super_admin_activity_logs').insert({
        super_admin_id: user?.id,
        action: org.is_active ? 'deactivate_organization' : 'activate_organization',
        entity_type: 'organization',
        entity_id: org.id,
        details: { organizationName: org.name },
      });

      loadOrganizations();
    } catch (error) {
      console.error('Error toggling organization status:', error);
      alert('Durum değiştirme başarısız');
    }
  };

  const handleDeleteOrganization = async (org: Organization) => {
    const confirmText = `Silme İşlemi Onayı\n\nBelediye: ${org.name}\nKullanıcı Sayısı: ${stats.get(org.id)?.userCount || 0}\n\nBu belediyeyi ve ona ait TÜM VERİLERİ (kullanıcılar, planlar, hedefler, göstergeler, vb.) kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem GERİ ALINAMAZ!\n\nOnaylamak için "${org.subdomain}" yazın:`;

    const userInput = prompt(confirmText);

    if (userInput !== org.subdomain) {
      if (userInput !== null) {
        alert('Onay metni eşleşmedi. İşlem iptal edildi.');
      }
      return;
    }

    setDeletingOrgId(org.id);
    try {
      const orgStats = stats.get(org.id);

      const { data: userIds } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', org.id);

      if (userIds && userIds.length > 0) {
        for (const userProfile of userIds) {
          try {
            const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userProfile.id);
            if (authDeleteError) {
              console.error('Auth user deletion error (non-critical):', authDeleteError);
            }
          } catch (authError) {
            console.error('Auth user deletion error (non-critical):', authError);
          }
        }
      }

      const { error: deleteOrgError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', org.id);

      if (deleteOrgError) throw deleteOrgError;

      await supabase.from('super_admin_activity_logs').insert({
        super_admin_id: user?.id,
        action: 'delete_organization',
        entity_type: 'organization',
        entity_id: org.id,
        details: {
          organizationName: org.name,
          subdomain: org.subdomain,
          userCount: orgStats?.userCount || 0,
          planCount: orgStats?.planCount || 0,
        },
      });

      loadOrganizations();
      alert('Belediye ve tüm verileri başarıyla silindi.');
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      alert('Belediye silinirken bir hata oluştu: ' + (error.message || ''));
    } finally {
      setDeletingOrgId(null);
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.subdomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.contact_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!profile?.is_super_admin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-600">Bu sayfaya erişim için Super Admin yetkisi gereklidir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            Super Admin Paneli
          </h1>
          <p className="text-gray-600 mt-1">Tüm belediyeleri yönetin ve standart kodları düzenleyin</p>
        </div>
        {activeTab === 'organizations' && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowActivityLogsModal(true)}
              className="flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Tüm Aktiviteler
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Yeni Belediye Ekle
            </Button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'organizations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Belediyeler
            </div>
          </button>
          <button
            onClick={() => setActiveTab('standard-codes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'standard-codes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Standart Kodlar
            </div>
          </button>
          <button
            onClick={() => setActiveTab('organization-licenses')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'organization-licenses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Belediye Lisansları
            </div>
          </button>
          <button
            onClick={() => setActiveTab('module-access')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'module-access'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Modül Erişim Yetkileri
            </div>
          </button>
        </nav>
      </div>

      {activeTab === 'organizations' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-lg shadow-md">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-700 font-medium">Toplam Belediye</p>
                  <p className="text-3xl font-bold text-blue-900">{organizations.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-600 rounded-lg shadow-md">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-700 font-medium">Aktif Belediye</p>
                  <p className="text-3xl font-bold text-green-900">
                    {organizations.filter(o => o.is_active).length}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600 rounded-lg shadow-md">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-purple-700 font-medium">Toplam Kullanıcı</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {Array.from(stats.values()).reduce((sum, s) => sum + s.userCount, 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-600 rounded-lg shadow-md">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-orange-700 font-medium">Toplam Gösterge</p>
                  <p className="text-3xl font-bold text-orange-900">
                    {Array.from(stats.values()).reduce((sum, s) => sum + s.indicatorCount, 0)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Belediye ara (isim, subdomain, email)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Belediyeler yükleniyor...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrganizations.map((org) => {
              const orgStats = stats.get(org.id);
              return (
                <div
                  key={org.id}
                  className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                        <Building2 className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{org.name}</h3>
                          {org.is_active ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full shadow-sm">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full shadow-sm">
                              Pasif
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Globe className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{org.subdomain}.yourdomain.com</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <span>{org.contact_email}</span>
                          </div>
                          {org.contact_phone && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="w-4 h-4 text-blue-500" />
                              <span>{org.contact_phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-gray-600">
                            <Users className="w-4 h-4 text-blue-500" />
                            <span>
                              <span className="font-bold text-gray-900">{orgStats?.userCount || 0}</span> / {org.max_users} kullanıcı
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg">
                            <span className="font-bold text-blue-700">{orgStats?.planCount || 0}</span>
                            <span className="text-gray-600">Plan</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 rounded-lg">
                            <span className="font-bold text-purple-700">{orgStats?.objectiveCount || 0}</span>
                            <span className="text-gray-600">Amaç</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-lg">
                            <span className="font-bold text-green-700">{orgStats?.goalCount || 0}</span>
                            <span className="text-gray-600">Hedef</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-lg">
                            <span className="font-bold text-orange-700">{orgStats?.indicatorCount || 0}</span>
                            <span className="text-gray-600">Gösterge</span>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-400">
                          Oluşturulma: {new Date(org.created_at).toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrg(org);
                            setShowUsersModal(true);
                          }}
                          className="flex items-center gap-2"
                          title="Kullanıcıları Yönet"
                        >
                          <UserPlus className="w-4 h-4" />
                          Kullanıcılar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrgForLogs({ id: org.id, name: org.name });
                            setShowActivityLogsModal(true);
                          }}
                          className="flex items-center gap-2"
                          title="Aktivite Logları"
                        >
                          <Activity className="w-4 h-4" />
                          Loglar
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrg(org);
                            setShowEditModal(true);
                          }}
                          className="flex items-center gap-2"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                          Düzenle
                        </Button>
                        <Button
                          variant={org.is_active ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => toggleOrganizationStatus(org)}
                          title={org.is_active ? 'Devre Dışı Bırak' : 'Aktif Et'}
                        >
                          {org.is_active ? 'Devre Dışı Bırak' : 'Aktif Et'}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteOrganization(org)}
                        disabled={deletingOrgId === org.id}
                        className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingOrgId === org.id ? 'Siliniyor...' : 'Sil'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredOrganizations.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                  <Building2 className="w-16 h-16 text-gray-400" />
                </div>
                <p className="text-lg text-gray-600 font-medium">
                  {searchTerm ? 'Arama kriterlerine uygun belediye bulunamadı' : 'Henüz belediye eklenmemiş'}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-5 h-5" />
                    İlk Belediyeyi Ekle
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
          </Card>
        </>
      )}

      {activeTab === 'standard-codes' && (
        <Card className="p-6">
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveStandardCodeTab('expense')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeStandardCodeTab === 'expense'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Gider Ekonomik Kodları
                </div>
              </button>
              <button
                onClick={() => setActiveStandardCodeTab('revenue')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeStandardCodeTab === 'revenue'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Gelir Ekonomik Kodları
                </div>
              </button>
              <button
                onClick={() => setActiveStandardCodeTab('financing')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeStandardCodeTab === 'financing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Finansman Tipleri
                </div>
              </button>
              <button
                onClick={() => setActiveStandardCodeTab('programs')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeStandardCodeTab === 'programs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Program/Alt Program
                </div>
              </button>
            </nav>
          </div>

          <div className="py-8">
            {activeStandardCodeTab === 'expense' && (
              <StandardExpenseCodesManager />
            )}

            {activeStandardCodeTab === 'revenue' && (
              <StandardRevenueCodesManager />
            )}

            {activeStandardCodeTab === 'financing' && (
              <StandardFinancingTypesManager />
            )}

            {activeStandardCodeTab === 'programs' && (
              <StandardProgramsManager />
            )}
          </div>
        </Card>
      )}

      {activeTab === 'organization-licenses' && (
        <OrganizationLicenseManager />
      )}

      {activeTab === 'module-access' && (
        <OrganizationModuleManager />
      )}

      {showCreateModal && (
        <CreateOrganizationModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadOrganizations();
          }}
        />
      )}

      {showEditModal && selectedOrg && (
        <EditOrganizationModal
          organization={selectedOrg}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrg(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedOrg(null);
            loadOrganizations();
          }}
        />
      )}

      {showUsersModal && selectedOrg && (
        <OrganizationUsersModal
          organizationId={selectedOrg.id}
          organizationName={selectedOrg.name}
          onClose={() => {
            setShowUsersModal(false);
            setSelectedOrg(null);
            loadOrganizations();
          }}
        />
      )}

      {showActivityLogsModal && (
        <ActivityLogsModal
          organizationId={selectedOrgForLogs?.id}
          organizationName={selectedOrgForLogs?.name}
          onClose={() => {
            setShowActivityLogsModal(false);
            setSelectedOrgForLogs(null);
          }}
        />
      )}
    </div>
  );
}
