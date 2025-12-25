import { useState, useEffect } from 'react';
import { Key, Calendar, Users, AlertCircle, CheckCircle, Clock, Ban, Edit2, Search, RefreshCw, Sparkles, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Card } from '../ui/Card';

interface Organization {
  id: string;
  name: string;
  code: string;
  city: string;
  district: string;
  license_key: string | null;
  license_status: 'trial' | 'active' | 'expired' | 'suspended';
  license_expiry_date: string | null;
  license_issued_date: string | null;
  license_trial_end_date: string | null;
  license_max_users: number;
  license_notes: string | null;
  user_count?: number;
  created_at: string;
}

interface LicenseFormData {
  organizationId: string;
  organizationName: string;
  licenseKey: string;
  status: 'trial' | 'active' | 'expired' | 'suspended';
  expiryDate: string;
  maxUsers: number;
  notes: string;
}

export default function OrganizationLicenseManager() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          code,
          city,
          district,
          license_key,
          license_status,
          license_expiry_date,
          license_issued_date,
          license_trial_end_date,
          license_max_users,
          license_notes,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orgIds = data?.map(o => o.id) || [];
      const { data: userCounts } = await supabase
        .from('profiles')
        .select('organization_id')
        .in('organization_id', orgIds);

      const countMap = new Map<string, number>();
      userCounts?.forEach(u => {
        if (u.organization_id) {
          countMap.set(u.organization_id, (countMap.get(u.organization_id) || 0) + 1);
        }
      });

      const organizationsWithCounts = data?.map(o => ({
        ...o,
        user_count: countMap.get(o.id) || 0
      }));

      setOrganizations(organizationsWithCounts || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
      alert('Organizasyonlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const generateLicenseKey = async () => {
    try {
      setGeneratingKey(true);
      const { data, error } = await supabase.rpc('generate_organization_license_key');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating license key:', error);
      alert('Lisans anahtarı oluşturulurken hata oluştu');
      return null;
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleEditLicense = async (org: Organization) => {
    let licenseKey = org.license_key;

    if (!licenseKey) {
      licenseKey = await generateLicenseKey();
      if (!licenseKey) return;
    }

    setEditingLicense({
      organizationId: org.id,
      organizationName: org.name,
      licenseKey: licenseKey,
      status: org.license_status,
      expiryDate: org.license_expiry_date?.split('T')[0] || '',
      maxUsers: org.license_max_users || 50,
      notes: org.license_notes || ''
    });
    setShowLicenseModal(true);
  };

  const handleSaveLicense = async () => {
    if (!editingLicense) return;

    try {
      setSaving(true);

      const updateData: any = {
        license_key: editingLicense.licenseKey,
        license_status: editingLicense.status,
        license_max_users: editingLicense.maxUsers,
        license_notes: editingLicense.notes
      };

      if (editingLicense.status === 'active') {
        updateData.license_issued_date = new Date().toISOString();
        if (editingLicense.expiryDate) {
          updateData.license_expiry_date = editingLicense.expiryDate;
        }
      }

      const { error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', editingLicense.organizationId);

      if (error) throw error;

      await supabase.from('super_admin_activity_logs').insert({
        action: 'update_license',
        entity_type: 'organization',
        entity_id: editingLicense.organizationId,
        details: {
          organizationName: editingLicense.organizationName,
          licenseKey: editingLicense.licenseKey,
          status: editingLicense.status,
          maxUsers: editingLicense.maxUsers
        }
      });

      alert('Lisans bilgileri güncellendi');
      setShowLicenseModal(false);
      setEditingLicense(null);
      loadOrganizations();
    } catch (error) {
      console.error('Error saving license:', error);
      alert('Lisans kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateNewKey = async () => {
    if (!editingLicense) return;
    const newKey = await generateLicenseKey();
    if (newKey) {
      setEditingLicense({ ...editingLicense, licenseKey: newKey });
    }
  };

  const getStatusBadge = (org: Organization) => {
    const now = new Date();
    const trialEnd = org.license_trial_end_date ? new Date(org.license_trial_end_date) : null;
    const expiry = org.license_expiry_date ? new Date(org.license_expiry_date) : null;

    if (org.license_status === 'trial' && trialEnd) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
            <Ban className="w-3 h-3" />
            Deneme Süresi Doldu
          </span>
        );
      }
      return (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Deneme ({daysLeft} gün)
        </span>
      );
    }

    if (org.license_status === 'active') {
      if (expiry && expiry < now) {
        return (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Süresi Dolmuş
          </span>
        );
      }
      return (
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Aktif
        </span>
      );
    }

    if (org.license_status === 'expired') {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Süresi Doldu
        </span>
      );
    }

    if (org.license_status === 'suspended') {
      return (
        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Ban className="w-3 h-3" />
          Askıya Alındı
        </span>
      );
    }

    return null;
  };

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.district?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || org.license_status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lisanslar yükleniyor...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Key className="w-6 h-6 text-blue-600" />
                Belediye Lisansları
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Yeni belediyeler 15 gün deneme süresine sahiptir. Lisans anahtarı oluşturup belediyelere iletebilirsiniz.
              </p>
            </div>
            <Button onClick={loadOrganizations} variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Belediye adı, kod, şehir veya ilçe ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="trial">Deneme</option>
              <option value="active">Aktif</option>
              <option value="expired">Süresi Dolmuş</option>
              <option value="suspended">Askıya Alınmış</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Belediye
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Konum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lisans Anahtarı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kullanıcılar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bitiş Tarihi
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrganizations.map((org) => {
                const now = new Date();
                const trialEnd = org.license_trial_end_date ? new Date(org.license_trial_end_date) : null;
                const expiry = org.license_expiry_date ? new Date(org.license_expiry_date) : null;
                const isOverLimit = (org.user_count || 0) > org.license_max_users;

                return (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{org.name}</div>
                          <div className="text-xs text-gray-500">{org.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{org.city}</div>
                      <div className="text-xs text-gray-500">{org.district}</div>
                    </td>
                    <td className="px-6 py-4">
                      {org.license_key ? (
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {org.license_key}
                        </code>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Atanmamış</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(org)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className={`text-sm ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                          {org.user_count || 0} / {org.license_max_users}
                        </span>
                        {isOverLimit && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {org.license_status === 'trial' && trialEnd ? (
                        <div className="text-sm">
                          <div className="text-gray-900">
                            {trialEnd.toLocaleDateString('tr-TR')}
                          </div>
                          <div className="text-xs text-gray-500">Deneme Sonu</div>
                        </div>
                      ) : expiry ? (
                        <div className="text-sm">
                          <div className={expiry < now ? 'text-red-600' : 'text-gray-900'}>
                            {expiry.toLocaleDateString('tr-TR')}
                          </div>
                          <div className="text-xs text-gray-500">Lisans Sonu</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        onClick={() => handleEditLicense(org)}
                        variant="secondary"
                        className="text-xs"
                      >
                        <Edit2 className="w-3 h-3" />
                        {org.license_key ? 'Düzenle' : 'Lisans Oluştur'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredOrganizations.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Belediye bulunamadı</p>
            </div>
          )}
        </div>
      </Card>

      {showLicenseModal && editingLicense && (
        <Modal
          isOpen={showLicenseModal}
          onClose={() => {
            setShowLicenseModal(false);
            setEditingLicense(null);
          }}
          title="Lisans Yönetimi"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Belediye
              </label>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                {editingLicense.organizationName}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lisans Anahtarı
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingLicense.licenseKey}
                  onChange={(e) => setEditingLicense({ ...editingLicense, licenseKey: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  readOnly
                />
                <Button
                  onClick={handleGenerateNewKey}
                  variant="secondary"
                  disabled={generatingKey}
                >
                  <Sparkles className="w-4 h-4" />
                  Yeni Oluştur
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Bu anahtarı belediye yöneticisine iletiniz
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durum
              </label>
              <select
                value={editingLicense.status}
                onChange={(e) => setEditingLicense({ ...editingLicense, status: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="trial">Deneme</option>
                <option value="active">Aktif</option>
                <option value="expired">Süresi Dolmuş</option>
                <option value="suspended">Askıya Alınmış</option>
              </select>
            </div>

            {editingLicense.status === 'active' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={editingLicense.expiryDate}
                  onChange={(e) => setEditingLicense({ ...editingLicense, expiryDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maksimum Kullanıcı Sayısı
              </label>
              <input
                type="number"
                min="1"
                value={editingLicense.maxUsers}
                onChange={(e) => setEditingLicense({ ...editingLicense, maxUsers: parseInt(e.target.value) || 50 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notlar
              </label>
              <textarea
                value={editingLicense.notes}
                onChange={(e) => setEditingLicense({ ...editingLicense, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Lisans hakkında notlar..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                onClick={() => {
                  setShowLicenseModal(false);
                  setEditingLicense(null);
                }}
                variant="secondary"
              >
                İptal
              </Button>
              <Button
                onClick={handleSaveLicense}
                disabled={saving}
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
