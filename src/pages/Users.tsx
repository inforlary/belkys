import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { UserPlus, Edit2, Trash2, Shield, Building2 } from 'lucide-react';
import type { Profile, Department } from '../types/database';

interface UserFormData {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'director' | 'user' | 'vice_president';
  department_id: string;
  vice_president_department_ids: string[];
}

export function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [vpDepartments, setVpDepartments] = useState<Record<string, string[]>>({});
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    department_id: '',
    vice_president_department_ids: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersResponse, deptsResponse, vpDeptsResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, departments!profiles_department_id_fkey(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('*')
          .order('name'),
        supabase
          .from('vice_president_departments')
          .select('vice_president_id, department_id, departments(name)'),
      ]);

      if (usersResponse.data) setUsers(usersResponse.data);
      if (deptsResponse.data) setDepartments(deptsResponse.data);

      if (vpDeptsResponse.data) {
        const vpDeptMap: Record<string, string[]> = {};
        vpDeptsResponse.data.forEach((item: any) => {
          if (!vpDeptMap[item.vice_president_id]) {
            vpDeptMap[item.vice_president_id] = [];
          }
          vpDeptMap[item.vice_president_id].push(item.department_id);
        });
        setVpDepartments(vpDeptMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            department_id: formData.role !== 'vice_president' ? (formData.department_id || null) : null,
          })
          .eq('id', editingUser.id);

        if (error) throw error;

        if (formData.role === 'vice_president') {
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user?.id)
            .single();

          await supabase
            .from('vice_president_departments')
            .delete()
            .eq('vice_president_id', editingUser.id);

          if (formData.vice_president_department_ids.length > 0) {
            const vpDeptInserts = formData.vice_president_department_ids.map(deptId => ({
              vice_president_id: editingUser.id,
              department_id: deptId,
              organization_id: currentProfile?.organization_id,
            }));

            const { error: vpError } = await supabase
              .from('vice_president_departments')
              .insert(vpDeptInserts);

            if (vpError) throw vpError;
          }
        }
      } else {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user?.id)
          .single();

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: formData.full_name,
              role: formData.role,
              organization_id: currentProfile?.organization_id,
              department_id: formData.role !== 'vice_president' ? (formData.department_id || null) : null,
            }
          }
        });

        if (authError) {
          if (authError.message === 'User already registered') {
            throw new Error(`Bu email adresi (${formData.email}) ile zaten kayıtlı bir kullanıcı var. Lütfen farklı bir email adresi kullanın.`);
          }
          throw authError;
        }
        if (!authData.user) throw new Error('Kullanıcı oluşturulamadı');

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            organization_id: currentProfile?.organization_id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            department_id: formData.role !== 'vice_president' ? (formData.department_id || null) : null,
          }, {
            onConflict: 'id'
          });

        if (profileError) throw profileError;

        if (formData.role === 'vice_president' && formData.vice_president_department_ids.length > 0) {
          const vpDeptInserts = formData.vice_president_department_ids.map(deptId => ({
            vice_president_id: authData.user.id,
            department_id: deptId,
            organization_id: currentProfile?.organization_id,
          }));

          const { error: vpError } = await supabase
            .from('vice_president_departments')
            .insert(vpDeptInserts);

          if (vpError) throw vpError;
        }
      }

      await loadData();
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      alert(error.message || 'İşlem başarısız');
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Oturum bulunamadı');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Silme işlemi başarısız');
      }

      alert('Kullanıcı başarıyla silindi');
      loadData();
    } catch (error: any) {
      alert(error.message || 'Silme işlemi başarısız');
    }
  }

  async function openEditModal(user: Profile) {
    setEditingUser(user);

    let vpDeptIds: string[] = [];
    if (user.role === 'vice_president') {
      const { data } = await supabase
        .from('vice_president_departments')
        .select('department_id')
        .eq('vice_president_id', user.id);
      vpDeptIds = data?.map(d => d.department_id) || [];
    }

    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name,
      role: user.role,
      department_id: user.department_id || '',
      vice_president_department_ids: vpDeptIds,
    });
    setShowModal(true);
  }

  function openCreateModal() {
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  }

  function resetForm() {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'user',
      department_id: '',
      vice_president_department_ids: [],
    });
  }

  function toggleVPDepartment(deptId: string) {
    setFormData(prev => ({
      ...prev,
      vice_president_department_ids: prev.vice_president_department_ids.includes(deptId)
        ? prev.vice_president_department_ids.filter(id => id !== deptId)
        : [...prev.vice_president_department_ids, deptId]
    }));
  }

  function getVPDepartmentNames(userId: string): string {
    const deptIds = vpDepartments[userId] || [];
    if (deptIds.length === 0) return '-';

    const deptNames = deptIds
      .map(id => departments.find(d => d.id === id)?.name)
      .filter(Boolean);

    return deptNames.join(', ');
  }

  const roleLabels: Record<string, string> = {
    admin: 'Yönetici',
    director: 'Müdür',
    user: 'Kullanıcı',
    vice_president: 'Başkan Yardımcısı',
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-800',
    director: 'bg-blue-100 text-blue-800',
    user: 'bg-gray-100 text-gray-800',
    vice_president: 'bg-orange-100 text-orange-800',
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
          <p className="mt-2 text-gray-600">Sistem kullanıcılarını yönetin</p>
        </div>
        <Button onClick={openCreateModal}>
          <UserPlus className="w-5 h-5 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ad Soyad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  E-posta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Müdürlük(ler)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.role === 'vice_president' ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {getVPDepartmentNames(user.id)}
                      </div>
                    ) : (
                      (user as any).departments?.name || '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Soyad
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-posta
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={!!editingUser}
            />
          </div>

          {!editingUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Şifre
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!editingUser}
                minLength={6}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="user">Kullanıcı</option>
              <option value="director">Müdür</option>
              <option value="vice_president">Başkan Yardımcısı</option>
              <option value="admin">Yönetici</option>
            </select>
          </div>

          {formData.role === 'vice_president' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Müdürlükler (Çoklu Seçim)
              </label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                {departments.map((dept) => (
                  <label key={dept.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.vice_president_department_ids.includes(dept.id)}
                      onChange={() => toggleVPDepartment(dept.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{dept.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.vice_president_department_ids.length} müdürlük seçildi
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Müdürlük
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              İptal
            </Button>
            <Button type="submit">
              {editingUser ? 'Güncelle' : 'Oluştur'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
