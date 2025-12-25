import { useState, useEffect } from 'react';
import { Users, Mail, Trash2, Shield, UserCircle, Search, RefreshCw, Key, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  department?: {
    id: string;
    name: string;
  };
  tempPassword?: string;
}

interface OrganizationUsersModalProps {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
}

export default function OrganizationUsersModal({ organizationId, organizationName, onClose }: OrganizationUsersModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [organizationId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          role,
          created_at,
          department:departments(id, name)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`${userEmail} kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (deleteError) throw deleteError;

      await supabase.from('super_admin_activity_logs').insert({
        action: 'delete_user',
        entity_type: 'user',
        entity_id: userId,
        details: {
          organizationId,
          organizationName,
          userEmail,
        },
      });

      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert('Kullanıcı silinirken bir hata oluştu: ' + (error.message || ''));
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleEditPassword = (userId: string) => {
    setEditingUserId(userId);
    setNewPassword('');
    setShowPassword(false);
  };

  const handleSavePassword = async (userId: string, userEmail: string) => {
    if (!newPassword || newPassword.length < 6) {
      alert('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setSavingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId, newPassword }
      });

      if (error) throw error;

      await supabase.from('super_admin_activity_logs').insert({
        action: 'reset_password',
        entity_type: 'user',
        entity_id: userId,
        details: {
          organizationId,
          organizationName,
          userEmail,
        },
      });

      setUsers(users.map(u => u.id === userId ? { ...u, tempPassword: newPassword } : u));
      setEditingUserId(null);
      setNewPassword('');
      alert('Şifre başarıyla güncellendi');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert('Şifre güncellenirken bir hata oluştu: ' + (error.message || ''));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setNewPassword('');
    setShowPassword(false);
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string; color: string }> = {
      admin: { label: 'Yönetici', color: 'bg-purple-100 text-purple-700' },
      vice_president: { label: 'Başkan Yrd.', color: 'bg-blue-100 text-blue-700' },
      manager: { label: 'Müdür', color: 'bg-green-100 text-green-700' },
      user: { label: 'Kullanıcı', color: 'bg-gray-100 text-gray-700' },
    };
    const roleInfo = roles[role] || roles.user;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${roleInfo.color}`}>
        {roleInfo.label}
      </span>
    );
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal isOpen={true} onClose={onClose} title={`${organizationName} - Kullanıcılar`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <Users className="w-5 h-5" />
            <span className="font-medium">Toplam {users.length} kullanıcı</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Kullanıcılar yükleniyor...</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.map((user) => (
              <div key={user.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <UserCircle className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{user.full_name}</span>
                        {getRoleBadge(user.role)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Mail className="w-4 h-4" />
                        <span>{user.email}</span>
                      </div>
                      {user.department && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Müdürlük:</span> {user.department.name}
                        </div>
                      )}
                      {editingUserId === user.id ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Yeni Şifre:</span>
                          </div>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="En az 6 karakter"
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSavePassword(user.id, user.email)}
                              disabled={savingPassword || !newPassword}
                              className="flex-1"
                            >
                              {savingPassword ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={savingPassword}
                              className="flex-1"
                            >
                              İptal
                            </Button>
                          </div>
                        </div>
                      ) : user.tempPassword ? (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                          <div className="flex items-center gap-2 text-sm">
                            <Key className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-medium">Giriş Şifresi:</span>
                            <code className="px-2 py-1 bg-white rounded border border-green-300 text-green-900 font-mono">
                              {user.tempPassword}
                            </code>
                          </div>
                        </div>
                      ) : null}
                      <div className="text-xs text-gray-400 mt-1">
                        Oluşturulma: {new Date(user.created_at).toLocaleString('tr-TR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingUserId !== user.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPassword(user.id)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Key className="w-4 h-4" />
                        Şifre
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      disabled={deletingUserId === user.id}
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingUserId === user.id ? 'Siliniyor...' : 'Sil'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm ? 'Arama kriterlerine uygun kullanıcı bulunamadı' : 'Henüz kullanıcı eklenmemiş'}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </Modal>
  );
}
