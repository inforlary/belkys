import { useState, useEffect } from 'react';
import { Key, Calendar, Users, AlertCircle, CheckCircle, Clock, Ban, Plus, Edit2, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Card } from '../ui/Card';

interface Department {
  id: string;
  name: string;
  code: string;
  license_key: string | null;
  license_status: 'active' | 'expired' | 'suspended' | 'trial';
  license_expiry_date: string | null;
  license_issued_date: string | null;
  license_max_users: number;
  license_notes: string | null;
  organization: {
    id: string;
    name: string;
  };
  user_count?: number;
}

interface LicenseFormData {
  departmentId: string;
  status: 'active' | 'expired' | 'suspended' | 'trial';
  expiryDate: string;
  maxUsers: number;
  notes: string;
}

export default function DepartmentLicenseManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseFormData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select(`
          id,
          name,
          code,
          license_key,
          license_status,
          license_expiry_date,
          license_issued_date,
          license_max_users,
          license_notes,
          organization:organizations(id, name)
        `)
        .order('name');

      if (error) throw error;

      const deptIds = data?.map(d => d.id) || [];
      const { data: userCounts } = await supabase
        .from('profiles')
        .select('department_id')
        .in('department_id', deptIds);

      const countMap = new Map<string, number>();
      userCounts?.forEach(u => {
        if (u.department_id) {
          countMap.set(u.department_id, (countMap.get(u.department_id) || 0) + 1);
        }
      });

      const departmentsWithCounts = data?.map(d => ({
        ...d,
        user_count: countMap.get(d.id) || 0
      }));

      setDepartments(departmentsWithCounts || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      alert('Müdürlükler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLicense = (departmentId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    setEditingLicense({
      departmentId,
      status: 'trial',
      expiryDate: tomorrow.toISOString().split('T')[0],
      maxUsers: 10,
      notes: ''
    });
    setShowLicenseModal(true);
  };

  const handleEditLicense = (dept: Department) => {
    setEditingLicense({
      departmentId: dept.id,
      status: dept.license_status,
      expiryDate: dept.license_expiry_date ? new Date(dept.license_expiry_date).toISOString().split('T')[0] : '',
      maxUsers: dept.license_max_users,
      notes: dept.license_notes || ''
    });
    setShowLicenseModal(true);
  };

  const handleSaveLicense = async () => {
    if (!editingLicense) return;

    setSaving(true);
    try {
      const { data: keyData, error: keyError } = await supabase
        .rpc('generate_license_key');

      if (keyError) throw keyError;

      const updateData: any = {
        license_status: editingLicense.status,
        license_expiry_date: editingLicense.expiryDate || null,
        license_max_users: editingLicense.maxUsers,
        license_notes: editingLicense.notes || null,
      };

      const dept = departments.find(d => d.id === editingLicense.departmentId);
      if (!dept?.license_key) {
        updateData.license_key = keyData;
        updateData.license_issued_date = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('departments')
        .update(updateData)
        .eq('id', editingLicense.departmentId);

      if (updateError) throw updateError;

      await supabase.from('super_admin_activity_logs').insert({
        action: dept?.license_key ? 'update_license' : 'create_license',
        entity_type: 'department_license',
        entity_id: editingLicense.departmentId,
        details: {
          status: editingLicense.status,
          expiryDate: editingLicense.expiryDate,
          maxUsers: editingLicense.maxUsers,
        },
      });

      setShowLicenseModal(false);
      setEditingLicense(null);
      loadDepartments();
      alert('Lisans başarıyla kaydedildi');
    } catch (error: any) {
      console.error('Error saving license:', error);
      alert('Lisans kaydedilirken hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string, expiryDate: string | null) => {
    const now = new Date();
    const expiry = expiryDate ? new Date(expiryDate) : null;
    const isExpired = expiry && expiry < now;

    const configs: Record<string, { label: string; color: string; icon: any }> = {
      active: { label: 'Aktif', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      expired: { label: 'Süresi Dolmuş', color: 'bg-red-100 text-red-700', icon: AlertCircle },
      suspended: { label: 'Askıya Alınmış', color: 'bg-gray-100 text-gray-700', icon: Ban },
      trial: { label: 'Deneme', color: 'bg-blue-100 text-blue-700', icon: Clock }
    };

    const actualStatus = isExpired ? 'expired' : status;
    const config = configs[actualStatus] || configs.trial;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const filteredDepartments = departments.filter(dept => {
    const matchesSearch = dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dept.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dept.organization.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;

    const now = new Date();
    const expiry = dept.license_expiry_date ? new Date(dept.license_expiry_date) : null;
    const isExpired = expiry && expiry < now;

    if (filterStatus === 'expired') return matchesSearch && isExpired;
    return matchesSearch && dept.license_status === filterStatus && !isExpired;
  });

  const stats = {
    total: departments.length,
    active: departments.filter(d => {
      const now = new Date();
      const expiry = d.license_expiry_date ? new Date(d.license_expiry_date) : null;
      return d.license_status === 'active' && (!expiry || expiry >= now);
    }).length,
    trial: departments.filter(d => d.license_status === 'trial').length,
    expired: departments.filter(d => {
      const expiry = d.license_expiry_date ? new Date(d.license_expiry_date) : null;
      return expiry && expiry < new Date();
    }).length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam Müdürlük</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Key className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Aktif Lisans</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Deneme Lisansı</p>
              <p className="text-2xl font-bold text-blue-600">{stats.trial}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Süresi Dolmuş</p>
              <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Müdürlük ara..."
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
              <option value="active">Aktif</option>
              <option value="trial">Deneme</option>
              <option value="suspended">Askıya Alınmış</option>
              <option value="expired">Süresi Dolmuş</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDepartments}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Yükleniyor...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDepartments.map((dept) => {
              const now = new Date();
              const expiry = dept.license_expiry_date ? new Date(dept.license_expiry_date) : null;
              const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;

              return (
                <div key={dept.id} className={`border rounded-lg p-4 ${isExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                        {getStatusBadge(dept.license_status, dept.license_expiry_date)}
                        {dept.code && (
                          <span className="text-sm text-gray-500">({dept.code})</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Kurum:</span> {dept.organization.name}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        {dept.license_key ? (
                          <div>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                              <Key className="w-3 h-3" />
                              <span>Lisans Anahtarı</span>
                            </div>
                            <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                              {dept.license_key}
                            </code>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Lisans Anahtarı</div>
                            <span className="text-xs text-gray-400">Atanmamış</span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <Calendar className="w-3 h-3" />
                            <span>Son Kullanma</span>
                          </div>
                          <div className="text-sm font-medium">
                            {expiry ? (
                              <span className={daysUntilExpiry !== null && daysUntilExpiry <= 0 ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-gray-900'}>
                                {new Date(dept.license_expiry_date!).toLocaleDateString('tr-TR')}
                                {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
                                  <span className="text-xs ml-1">({daysUntilExpiry} gün)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">Belirsiz</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <Users className="w-3 h-3" />
                            <span>Kullanıcı Limiti</span>
                          </div>
                          <div className="text-sm font-medium">
                            <span className={dept.user_count && dept.user_count > dept.license_max_users ? 'text-red-600' : 'text-gray-900'}>
                              {dept.user_count || 0} / {dept.license_max_users}
                            </span>
                          </div>
                        </div>

                        {dept.license_issued_date && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Verilme Tarihi</div>
                            <div className="text-sm text-gray-700">
                              {new Date(dept.license_issued_date).toLocaleDateString('tr-TR')}
                            </div>
                          </div>
                        )}
                      </div>

                      {dept.license_notes && (
                        <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <span className="font-medium">Not:</span> {dept.license_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      {dept.license_key ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLicense(dept)}
                          className="flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Düzenle
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateLicense(dept.id)}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Lisans Ver
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredDepartments.length === 0 && (
              <div className="text-center py-12">
                <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm || filterStatus !== 'all' ? 'Arama kriterlerine uygun müdürlük bulunamadı' : 'Henüz müdürlük eklenmemiş'}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {showLicenseModal && editingLicense && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowLicenseModal(false);
            setEditingLicense(null);
          }}
          title="Lisans Yönetimi"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lisans Durumu
              </label>
              <select
                value={editingLicense.status}
                onChange={(e) => setEditingLicense({ ...editingLicense, status: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="trial">Deneme</option>
                <option value="active">Aktif</option>
                <option value="suspended">Askıya Alınmış</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Son Kullanma Tarihi
              </label>
              <input
                type="date"
                value={editingLicense.expiryDate}
                onChange={(e) => setEditingLicense({ ...editingLicense, expiryDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maksimum Kullanıcı Sayısı
              </label>
              <input
                type="number"
                min="1"
                value={editingLicense.maxUsers}
                onChange={(e) => setEditingLicense({ ...editingLicense, maxUsers: parseInt(e.target.value) || 10 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Lisans hakkında notlar..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveLicense}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowLicenseModal(false);
                  setEditingLicense(null);
                }}
                disabled={saving}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
