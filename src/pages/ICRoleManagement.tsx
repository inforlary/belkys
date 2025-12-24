import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Plus, Edit2, Trash2, X, Save, Calendar, Users, Building2, AlertTriangle } from 'lucide-react';
import { useLocation } from '../hooks/useLocation';

interface ICRole {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'ic_coordinator' | 'ic_responsible' | 'ic_auditor' | 'process_owner';
  department_id: string | null;
  process_ids: string[];
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  user_name?: string;
  user_email?: string;
  department_name?: string;
  granted_by_name?: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Process {
  id: string;
  code: string;
  name: string;
}

const ROLE_LABELS = {
  ic_coordinator: 'İç Kontrol Koordinatörü',
  ic_responsible: 'İç Kontrol Sorumlusu',
  ic_auditor: 'İç Kontrol Denetçisi',
  process_owner: 'Süreç Sahibi'
};

const ROLE_DESCRIPTIONS = {
  ic_coordinator: 'Tüm iç kontrol sistemini yönetir, organizasyon genelinde tam yetki',
  ic_responsible: 'Kendi müdürlüğünün iç kontrol işlemlerini yönetir',
  ic_auditor: 'Kontrolleri test eder, değerlendirme yapar, bulgu oluşturur',
  process_owner: 'Belirli süreçlerin iç kontrol faaliyetlerini yönetir'
};

export default function ICRoleManagement() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [icRoles, setIcRoles] = useState<ICRole[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<ICRole | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
    role: 'ic_responsible' as ICRole['role'],
    department_id: null as string | null,
    process_ids: [] as string[],
    expires_at: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) {
      console.log('No profile found');
      return;
    }

    console.log('Loading data for organization:', profile.organization_id);

    try {
      const [rolesRes, usersRes, deptsRes, procsRes] = await Promise.all([
        supabase
          .from('ic_user_roles')
          .select(`
            *,
            profiles:user_id (full_name, email),
            departments:department_id (name),
            granted_by_profile:granted_by (full_name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('profiles')
          .select('id, full_name, email, department_id')
          .eq('organization_id', profile.organization_id)
          .order('full_name'),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name'),

        supabase
          .from('ic_processes')
          .select('id, code, name')
          .eq('organization_id', profile.organization_id)
          .order('code')
      ]);

      console.log('Roles response:', rolesRes);
      console.log('Users response:', usersRes);
      console.log('Departments response:', deptsRes);
      console.log('Processes response:', procsRes);

      if (rolesRes.error) console.error('Roles error:', rolesRes.error);
      if (usersRes.error) console.error('Users error:', usersRes.error);
      if (deptsRes.error) console.error('Departments error:', deptsRes.error);
      if (procsRes.error) console.error('Processes error:', procsRes.error);

      if (rolesRes.data) {
        const formattedRoles = rolesRes.data.map((role: any) => ({
          ...role,
          user_name: role.profiles?.full_name,
          user_email: role.profiles?.email,
          department_name: role.departments?.name,
          granted_by_name: role.granted_by_profile?.full_name
        }));
        setIcRoles(formattedRoles);
      }

      if (usersRes.data) {
        console.log('Setting users:', usersRes.data.length);
        setUsers(usersRes.data);
      }
      if (deptsRes.data) {
        console.log('Setting departments:', deptsRes.data.length);
        setDepartments(deptsRes.data);
      }
      if (procsRes.data) {
        console.log('Setting processes:', procsRes.data.length);
        setProcesses(procsRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.user_id || !formData.role) {
      alert('Lütfen kullanıcı ve rol seçin');
      return;
    }

    if (formData.role === 'ic_responsible' && !formData.department_id) {
      alert('İç Kontrol Sorumlusu için müdürlük seçimi zorunludur');
      return;
    }

    if (formData.role === 'process_owner' && formData.process_ids.length === 0) {
      alert('Süreç Sahibi için en az bir süreç seçimi zorunludur');
      return;
    }

    try {
      const data = {
        user_id: formData.user_id,
        organization_id: profile?.organization_id,
        role: formData.role,
        department_id: formData.role === 'ic_responsible' ? formData.department_id : null,
        process_ids: formData.role === 'process_owner' ? formData.process_ids : [],
        expires_at: formData.expires_at || null,
        notes: formData.notes || null,
        granted_by: profile?.id,
        is_active: true
      };

      if (editingRole) {
        await supabase
          .from('ic_user_roles')
          .update(data)
          .eq('id', editingRole.id);
        alert('Rol başarıyla güncellendi');
      } else {
        await supabase
          .from('ic_user_roles')
          .insert([data]);
        alert('Rol başarıyla atandı');
      }

      setShowModal(false);
      setEditingRole(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving role:', error);
      alert('Rol kaydedilirken hata: ' + error.message);
    }
  };

  const handleToggleActive = async (role: ICRole) => {
    try {
      await supabase
        .from('ic_user_roles')
        .update({ is_active: !role.is_active })
        .eq('id', role.id);

      loadData();
    } catch (error) {
      console.error('Error toggling role:', error);
      alert('Rol durumu değiştirilirken hata oluştu');
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm('Bu rolü silmek istediğinizden emin misiniz?')) return;

    try {
      await supabase
        .from('ic_user_roles')
        .delete()
        .eq('id', roleId);

      alert('Rol silindi');
      loadData();
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Rol silinirken hata oluştu');
    }
  };

  const openEditModal = (role: ICRole) => {
    setEditingRole(role);
    setFormData({
      user_id: role.user_id,
      role: role.role,
      department_id: role.department_id,
      process_ids: role.process_ids || [],
      expires_at: role.expires_at ? role.expires_at.split('T')[0] : '',
      notes: role.notes || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      role: 'ic_responsible',
      department_id: null,
      process_ids: [],
      expires_at: '',
      notes: ''
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ic_coordinator': return 'bg-purple-100 text-purple-800';
      case 'ic_responsible': return 'bg-blue-100 text-blue-800';
      case 'ic_auditor': return 'bg-green-100 text-green-800';
      case 'process_owner': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">İç Kontrol Rol Yönetimi</h1>
            <p className="text-sm text-gray-600">Kullanıcılara iç kontrol rolleri atayın ve yönetin</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingRole(null);
            resetForm();
            setShowModal(true);
          }}
          disabled={users.length === 0}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
            users.length === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
          title={users.length === 0 ? 'Önce kullanıcı eklemelisiniz' : ''}
        >
          <Plus className="h-5 w-5" />
          <span>Yeni Rol Ata</span>
        </button>
      </div>

      {(users.length === 0 || departments.length === 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-yellow-900 mb-2">Başlamadan Önce</h3>
              <p className="text-sm text-yellow-800 mb-3">
                İç kontrol rolleri atamadan önce aşağıdaki verilerin tanımlı olması gerekir:
              </p>
              <div className="space-y-2">
                {users.length === 0 && (
                  <div className="flex items-center space-x-2 text-sm text-yellow-800">
                    <Users className="h-4 w-4" />
                    <span>Kullanıcı bulunmuyor.</span>
                    <button
                      onClick={() => navigate('users')}
                      className="text-yellow-900 underline font-medium"
                    >
                      Kullanıcı eklemek için tıklayın
                    </button>
                  </div>
                )}
                {departments.length === 0 && (
                  <div className="flex items-center space-x-2 text-sm text-yellow-800">
                    <Building2 className="h-4 w-4" />
                    <span>Müdürlük bulunmuyor.</span>
                    <button
                      onClick={() => navigate('departments')}
                      className="text-yellow-900 underline font-medium"
                    >
                      Müdürlük eklemek için tıklayın
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(ROLE_LABELS).map(([key, label]) => {
          const count = icRoles.filter(r => r.role === key && r.is_active).length;
          return (
            <div key={key} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                </div>
                <Shield className={`h-10 w-10 ${getRoleBadgeColor(key).split(' ')[1]}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kullanıcı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Müdürlük/Süreç
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Veriliş Tarihi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bitiş Tarihi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {icRoles.map((role) => (
                <tr key={role.id} className={!role.is_active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{role.user_name}</div>
                      <div className="text-sm text-gray-500">{role.user_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(role.role)}`}>
                      {ROLE_LABELS[role.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {role.department_name && (
                        <div className="flex items-center space-x-1">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{role.department_name}</span>
                        </div>
                      )}
                      {role.process_ids && role.process_ids.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {role.process_ids.length} süreç
                        </div>
                      )}
                      {!role.department_name && (!role.process_ids || role.process_ids.length === 0) && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(role.granted_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {role.expires_at ? (
                      <span className={new Date(role.expires_at) < new Date() ? 'text-red-600 font-medium' : ''}>
                        {new Date(role.expires_at).toLocaleDateString('tr-TR')}
                      </span>
                    ) : (
                      <span className="text-gray-400">Süresiz</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(role)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        role.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {role.is_active ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(role)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {icRoles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Henüz rol atanmamış. Yukarıdaki "Yeni Rol Ata" butonuna tıklayarak başlayın.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {editingRole ? 'Rolü Düzenle' : 'Yeni Rol Ata'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kullanıcı *
                </label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  disabled={!!editingRole}
                >
                  <option value="">Kullanıcı Seçin</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
                {users.length === 0 && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      Henüz kullanıcı bulunmuyor.
                      <button
                        type="button"
                        onClick={() => navigate('users')}
                        className="ml-1 text-yellow-900 underline font-medium"
                      >
                        Kullanıcı Yönetimi
                      </button> sayfasından kullanıcı ekleyin.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İç Kontrol Rolü *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as ICRole['role'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">{ROLE_DESCRIPTIONS[formData.role]}</p>
              </div>

              {formData.role === 'ic_responsible' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Müdürlük *
                  </label>
                  <select
                    value={formData.department_id || ''}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Müdürlük Seçin</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {departments.length === 0 ? (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        Henüz müdürlük bulunmuyor.
                        <button
                          type="button"
                          onClick={() => navigate('departments')}
                          className="ml-1 text-yellow-900 underline font-medium"
                        >
                          Müdürlük Yönetimi
                        </button> sayfasından müdürlük ekleyin.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      Bu kullanıcı seçilen müdürlüğün iç kontrol işlemlerini yönetecek
                    </p>
                  )}
                </div>
              )}

              {formData.role === 'process_owner' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Süreçler *
                  </label>
                  {processes.length === 0 ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        Henüz süreç tanımlanmamış.
                        <button
                          type="button"
                          onClick={() => navigate('process-management')}
                          className="ml-1 text-yellow-900 underline font-medium"
                        >
                          Süreç Yönetimi
                        </button> sayfasından süreç ekleyin.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                      {processes.map((p) => (
                        <label key={p.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.process_ids.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, process_ids: [...formData.process_ids, p.id] });
                              } else {
                                setFormData({ ...formData, process_ids: formData.process_ids.filter(id => id !== p.id) });
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700">{p.code} - {p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {processes.length > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      Bu kullanıcı seçilen süreçlerin iç kontrol faaliyetlerini yönetecek
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Yetki Bitiş Tarihi (Opsiyonel)</span>
                  </div>
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Boş bırakılırsa yetki süresiz olur
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notlar
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Rol ataması ile ilgili notlar..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingRole ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
