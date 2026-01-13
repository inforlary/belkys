import { useState, useEffect } from 'react';
import { UserCog, Plus, Users, Edit2, Trash2, ChevronDown, ChevronRight, Crown, Shield, Eye, User as UserIcon, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface Role {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  user_count?: number;
  permission_count?: number;
}

interface Permission {
  id: string;
  module: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  is_assigned?: boolean;
}

interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  user?: {
    full_name: string;
    email: string;
    department?: {
      name: string;
    };
  };
}

export default function RoleManagement() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [roleUsers, setRoleUsers] = useState<UserRole[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');

  const [newRoleData, setNewRoleData] = useState({
    code: '',
    name: '',
    description: '',
    template_role_id: '',
  });

  const [editRoleData, setEditRoleData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, [user]);

  useEffect(() => {
    if (selectedRole) {
      loadRolePermissions(selectedRole.id);
    }
  }, [selectedRole]);

  const loadRoles = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const { data: rolesData, error } = await supabase
        .from('roles')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('is_system', { ascending: false })
        .order('name');

      if (error) throw error;

      const rolesWithCounts = await Promise.all(
        (rolesData || []).map(async (role) => {
          const { count: userCount } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', role.id);

          const { count: permCount } = await supabase
            .from('role_permissions')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', role.id);

          return {
            ...role,
            user_count: userCount || 0,
            permission_count: permCount || 0,
          };
        })
      );

      setRoles(rolesWithCounts);
      if (rolesWithCounts.length > 0 && !selectedRole) {
        setSelectedRole(rolesWithCounts[0]);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module')
        .order('category')
        .order('name');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId);

      if (error) throw error;
      setRolePermissions(new Set(data?.map(rp => rp.permission_id) || []));
    } catch (error) {
      console.error('Error loading role permissions:', error);
    }
  };

  const loadRoleUsers = async (roleId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          user:profiles(
            full_name,
            email,
            department:departments(name)
          )
        `)
        .eq('role_id', roleId);

      if (error) throw error;
      setRoleUsers(data || []);
    } catch (error) {
      console.error('Error loading role users:', error);
    }
  };

  const loadAvailableUsers = async (roleId: string) => {
    if (!user?.organization_id) return;

    try {
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          department:departments(name)
        `)
        .eq('organization_id', user.organization_id);

      if (usersError) throw usersError;

      const { data: assignedUsers, error: assignedError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', roleId);

      if (assignedError) throw assignedError;

      const assignedUserIds = new Set(assignedUsers?.map(u => u.user_id) || []);
      const available = allUsers?.filter(u => !assignedUserIds.has(u.id)) || [];
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error loading available users:', error);
    }
  };

  const handleCreateRole = async () => {
    if (!user?.organization_id || !newRoleData.code || !newRoleData.name) return;

    try {
      setSaving(true);
      const { data: newRole, error: roleError } = await supabase
        .from('roles')
        .insert({
          organization_id: user.organization_id,
          code: newRoleData.code.toUpperCase(),
          name: newRoleData.name,
          description: newRoleData.description || null,
          is_system: false,
          is_active: true,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      if (newRoleData.template_role_id) {
        const { data: templatePermissions, error: permError } = await supabase
          .from('role_permissions')
          .select('permission_id')
          .eq('role_id', newRoleData.template_role_id);

        if (permError) throw permError;

        if (templatePermissions && templatePermissions.length > 0) {
          const { error: insertError } = await supabase
            .from('role_permissions')
            .insert(
              templatePermissions.map(tp => ({
                role_id: newRole.id,
                permission_id: tp.permission_id,
              }))
            );

          if (insertError) throw insertError;
        }
      }

      await loadRoles();
      setSelectedRole(newRole);
      setShowNewRoleModal(false);
      setNewRoleData({ code: '', name: '', description: '', template_role_id: '' });
    } catch (error: any) {
      console.error('Error creating role:', error);
      alert(error.message || 'Rol oluşturulurken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('roles')
        .update({
          name: editRoleData.name,
          description: editRoleData.description || null,
          is_active: editRoleData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRole.id);

      if (error) throw error;

      await loadRoles();
      setShowEditRoleModal(false);
      setSelectedRole({ ...selectedRole, name: editRoleData.name, description: editRoleData.description, is_active: editRoleData.is_active });
    } catch (error: any) {
      console.error('Error updating role:', error);
      alert(error.message || 'Rol güncellenirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', selectedRole.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setSelectedRole(null);
      await loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert(error.message || 'Rol silinirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (permissionId: string) => {
    if (!selectedRole) return;

    const isAssigned = rolePermissions.has(permissionId);
    const newRolePermissions = new Set(rolePermissions);

    try {
      if (isAssigned) {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', selectedRole.id)
          .eq('permission_id', permissionId);

        if (error) throw error;
        newRolePermissions.delete(permissionId);
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .insert({
            role_id: selectedRole.id,
            permission_id: permissionId,
          });

        if (error) throw error;
        newRolePermissions.add(permissionId);
      }

      setRolePermissions(newRolePermissions);
      await loadRoles();
    } catch (error: any) {
      console.error('Error toggling permission:', error);
      alert(error.message || 'Yetki değiştirilirken bir hata oluştu');
    }
  };

  const handleToggleModule = async (module: string, checked: boolean) => {
    if (!selectedRole) return;

    const modulePermissions = permissions.filter(p => p.module === module);
    const modulePermissionIds = modulePermissions.map(p => p.id);

    try {
      if (checked) {
        const toInsert = modulePermissionIds.filter(id => !rolePermissions.has(id));
        if (toInsert.length > 0) {
          const { error } = await supabase
            .from('role_permissions')
            .insert(toInsert.map(permissionId => ({
              role_id: selectedRole.id,
              permission_id: permissionId,
            })));

          if (error) throw error;
        }
      } else {
        const toDelete = modulePermissionIds.filter(id => rolePermissions.has(id));
        if (toDelete.length > 0) {
          const { error } = await supabase
            .from('role_permissions')
            .delete()
            .eq('role_id', selectedRole.id)
            .in('permission_id', toDelete);

          if (error) throw error;
        }
      }

      await loadRolePermissions(selectedRole.id);
      await loadRoles();
    } catch (error: any) {
      console.error('Error toggling module permissions:', error);
      alert(error.message || 'Modül yetkileri değiştirilirken bir hata oluştu');
    }
  };

  const handleAddUsers = async () => {
    if (!selectedRole || selectedUsers.size === 0) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_roles')
        .insert(
          Array.from(selectedUsers).map(userId => ({
            user_id: userId,
            role_id: selectedRole.id,
            assigned_by: user?.id,
          }))
        );

      if (error) throw error;

      setShowAddUserModal(false);
      setSelectedUsers(new Set());
      setUserSearch('');
      await loadRoleUsers(selectedRole.id);
      await loadRoles();
    } catch (error: any) {
      console.error('Error adding users:', error);
      alert(error.message || 'Kullanıcı eklenirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (userRoleId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userRoleId);

      if (error) throw error;

      if (selectedRole) {
        await loadRoleUsers(selectedRole.id);
        await loadRoles();
      }
    } catch (error: any) {
      console.error('Error removing user:', error);
      alert(error.message || 'Kullanıcı kaldırılırken bir hata oluştu');
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getModuleDisplayName = (module: string) => {
    const names: Record<string, string> = {
      'strategic-plan': 'Stratejik Plan',
      'risk-management': 'Risk Yönetimi',
      'internal-control': 'İç Kontrol',
      'quality-management': 'Kalite Yönetimi',
      'admin': 'Yönetim',
      'budget': 'Bütçe',
      'indicators': 'Göstergeler ve Veri Girişi',
    };
    return names[module] || module;
  };

  const getRoleIcon = (role: Role) => {
    if (role.code === 'SUPER_ADMIN' || role.code === 'ADMIN') return <Crown className="w-5 h-5" />;
    if (role.code === 'DIRECTOR') return <Shield className="w-5 h-5" />;
    if (role.code === 'VIEWER') return <Eye className="w-5 h-5" />;
    return <UserIcon className="w-5 h-5" />;
  };

  const getModulePermissionCount = (module: string) => {
    const modulePermissions = groupedPermissions[module] || [];
    const assigned = modulePermissions.filter(p => rolePermissions.has(p.id)).length;
    return `${assigned}/${modulePermissions.length}`;
  };

  const isModuleFullyAssigned = (module: string) => {
    const modulePermissions = groupedPermissions[module] || [];
    return modulePermissions.every(p => rolePermissions.has(p.id));
  };

  const filteredAvailableUsers = availableUsers.filter(u =>
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <UserCog className="w-8 h-8 text-blue-600" />
            Rol ve Yetki Yönetimi
          </h1>
          <p className="text-slate-600 mt-2">Sistem rollerini ve yetkilerini yönetin</p>
        </div>
        <Button onClick={() => setShowNewRoleModal(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Yeni Rol
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900 mb-4">Roller</h2>
            <div className="space-y-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedRole?.id === role.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={selectedRole?.id === role.id ? 'text-blue-600' : 'text-slate-600'}>
                      {getRoleIcon(role)}
                    </div>
                    <span className="font-medium text-slate-900">{role.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 ml-7">
                    <span>{role.is_system ? 'Sistem' : 'Özel'}</span>
                    <span>•</span>
                    <span className={role.is_active ? 'text-green-600' : 'text-red-600'}>
                      {role.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedRole ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-blue-600">{getRoleIcon(selectedRole)}</div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{selectedRole.name}</h2>
                      <p className="text-sm text-slate-500">Kod: {selectedRole.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditRoleData({
                          name: selectedRole.name,
                          description: selectedRole.description || '',
                          is_active: selectedRole.is_active,
                        });
                        setShowEditRoleModal(true);
                      }}
                      disabled={selectedRole.is_system}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        loadRoleUsers(selectedRole.id);
                        setShowUsersModal(true);
                      }}
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                    {!selectedRole.is_system && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteModal(true)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {selectedRole.description && (
                  <p className="text-slate-600 text-sm mb-3">{selectedRole.description}</p>
                )}

                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Sistem Rolü:</span>
                    <span className="ml-2 font-medium">{selectedRole.is_system ? 'Evet' : 'Hayır'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Kullanıcı Sayısı:</span>
                    <span className="ml-2 font-medium">{selectedRole.user_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Yetki Sayısı:</span>
                    <span className="ml-2 font-medium">{selectedRole.permission_count || 0}</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Yetkiler</h3>
                <div className="space-y-2">
                  {Object.keys(groupedPermissions).map((module) => {
                    const isExpanded = expandedModules.has(module);
                    const modulePerms = groupedPermissions[module];
                    const allAssigned = isModuleFullyAssigned(module);

                    return (
                      <div key={module} className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedModules);
                            if (isExpanded) {
                              newExpanded.delete(module);
                            } else {
                              newExpanded.add(module);
                            }
                            setExpandedModules(newExpanded);
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="font-medium text-slate-900">{getModuleDisplayName(module)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">{getModulePermissionCount(module)}</span>
                            <input
                              type="checkbox"
                              checked={allAssigned}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleModule(module, e.target.checked);
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-2">
                            {modulePerms.map((permission) => (
                              <label
                                key={permission.id}
                                className="flex items-start gap-3 p-2 hover:bg-white rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={rolePermissions.has(permission.id)}
                                  onChange={() => handleTogglePermission(permission.id)}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div>
                                  <div className="font-medium text-sm text-slate-900">{permission.name}</div>
                                  <div className="text-xs text-slate-500">
                                    {permission.code}
                                    {permission.description && ` - ${permission.description}`}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-slate-500">Bir rol seçin</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showNewRoleModal}
        onClose={() => {
          setShowNewRoleModal(false);
          setNewRoleData({ code: '', name: '', description: '', template_role_id: '' });
        }}
        title="Yeni Rol Oluştur"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rol Kodu *
            </label>
            <input
              type="text"
              value={newRoleData.code}
              onChange={(e) => setNewRoleData({ ...newRoleData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="RISK_MANAGER"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Benzersiz, boşluk içermeyen kod</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rol Adı *
            </label>
            <input
              type="text"
              value={newRoleData.name}
              onChange={(e) => setNewRoleData({ ...newRoleData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Risk Yöneticisi"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={newRoleData.description}
              onChange={(e) => setNewRoleData({ ...newRoleData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Risk yönetimi modülünde tam yetkili kullanıcı"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Şablon Rol (Yetkileri kopyala)
            </label>
            <select
              value={newRoleData.template_role_id}
              onChange={(e) => setNewRoleData({ ...newRoleData, template_role_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Boş başla</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                setShowNewRoleModal(false);
                setNewRoleData({ code: '', name: '', description: '', template_role_id: '' });
              }}
              variant="outline"
              className="flex-1"
            >
              İptal
            </Button>
            <Button onClick={handleCreateRole} loading={saving} className="flex-1">
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditRoleModal}
        onClose={() => setShowEditRoleModal(false)}
        title={`Rol Düzenle - ${selectedRole?.name}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rol Kodu
            </label>
            <input
              type="text"
              value={selectedRole?.code || ''}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">Değiştirilemez</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rol Adı *
            </label>
            <input
              type="text"
              value={editRoleData.name}
              onChange={(e) => setEditRoleData({ ...editRoleData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={editRoleData.description}
              onChange={(e) => setEditRoleData({ ...editRoleData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editRoleData.is_active}
                onChange={(e) => setEditRoleData({ ...editRoleData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Aktif</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={() => setShowEditRoleModal(false)} variant="outline" className="flex-1">
              İptal
            </Button>
            <Button onClick={handleUpdateRole} loading={saving} className="flex-1">
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showUsersModal}
        onClose={() => setShowUsersModal(false)}
        title={`Rol Kullanıcıları - ${selectedRole?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Bu role sahip kullanıcılar ({roleUsers.length})
            </p>
            <Button
              size="sm"
              onClick={() => {
                if (selectedRole) {
                  loadAvailableUsers(selectedRole.id);
                  setShowAddUserModal(true);
                }
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Kullanıcı Ekle
            </Button>
          </div>

          {roleUsers.length > 0 ? (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              {roleUsers.map((userRole) => (
                <div key={userRole.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="font-medium text-slate-900">{userRole.user?.full_name}</div>
                    <div className="text-sm text-slate-500">{userRole.user?.department?.name || 'Birim atanmamış'}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Bu kullanıcıyı rolden kaldırmak istediğinize emin misiniz?')) {
                        handleRemoveUser(userRole.id);
                      }
                    }}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Kaldır
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Bu role henüz kullanıcı atanmamış
            </div>
          )}

          <div className="pt-4">
            <Button onClick={() => setShowUsersModal(false)} variant="outline" className="w-full">
              Kapat
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddUserModal}
        onClose={() => {
          setShowAddUserModal(false);
          setSelectedUsers(new Set());
          setUserSearch('');
        }}
        title="Kullanıcı Ekle"
      >
        <div className="space-y-4">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Kullanıcı ara..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
            {filteredAvailableUsers.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {filteredAvailableUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(u.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedUsers);
                        if (e.target.checked) {
                          newSelected.add(u.id);
                        } else {
                          newSelected.delete(u.id);
                        }
                        setSelectedUsers(newSelected);
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-slate-900">{u.full_name}</div>
                      <div className="text-sm text-slate-500">{u.department?.name || 'Birim atanmamış'}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                {userSearch ? 'Kullanıcı bulunamadı' : 'Bu role eklenebilecek kullanıcı yok'}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Bu role sahip olmayan kullanıcılar listelenir
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                setShowAddUserModal(false);
                setSelectedUsers(new Set());
                setUserSearch('');
              }}
              variant="outline"
              className="flex-1"
            >
              İptal
            </Button>
            <Button
              onClick={handleAddUsers}
              loading={saving}
              disabled={selectedUsers.size === 0}
              className="flex-1"
            >
              Ekle ({selectedUsers.size})
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Rol Silme"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-600 mt-0.5">⚠️</div>
            <div>
              <p className="text-sm text-red-900 font-medium">
                "{selectedRole?.name}" rolünü silmek istediğinize emin misiniz?
              </p>
              {selectedRole && selectedRole.user_count > 0 && (
                <p className="text-sm text-red-700 mt-2">
                  Bu role atanmış {selectedRole.user_count} kullanıcı var. Silme işlemi sonrasında bu
                  kullanıcıların rol atamaları da kaldırılacaktır.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
              İptal
            </Button>
            <Button
              onClick={handleDeleteRole}
              loading={saving}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Sil
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
