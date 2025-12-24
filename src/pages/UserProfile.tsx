import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { User, Mail, Building, Shield, Key, Bell, Save, Eye, EyeOff } from 'lucide-react';

interface ReminderPreference {
  id: string;
  reminder_type: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  frequency: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export default function UserProfile() {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    title: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreference[]>([]);

  useEffect(() => {
    if (profile) {
      loadProfileData();
      loadReminderPreferences();
    }
  }, [profile]);

  const loadProfileData = () => {
    if (!profile) return;
    setProfileData({
      full_name: profile.full_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      title: profile.title || ''
    });
  };

  const loadReminderPreferences = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('reminder_preferences')
      .select('*')
      .eq('user_id', profile.id);

    if (error) {
      console.error('Error loading preferences:', error);
      return;
    }

    setReminderPreferences(data || []);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          title: profileData.title
        })
        .eq('id', profile.id);

      if (error) throw error;

      alert('Profil bilgileriniz güncellendi!');
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Profil güncellenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Yeni şifreler eşleşmiyor!');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('Yeni şifre en az 6 karakter olmalıdır!');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      alert('Şifreniz başarıyla değiştirildi! Lütfen tekrar giriş yapın.');
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      await signOut();
    } catch (error: any) {
      console.error('Error changing password:', error);
      alert(error.message || 'Şifre değiştirilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePreference = async (preference: ReminderPreference, updates: Partial<ReminderPreference>) => {
    try {
      const { error } = await supabase
        .from('reminder_preferences')
        .update(updates)
        .eq('id', preference.id);

      if (error) throw error;

      setReminderPreferences(prev =>
        prev.map(p => p.id === preference.id ? { ...p, ...updates } : p)
      );
    } catch (error) {
      console.error('Error updating preference:', error);
      alert('Tercih güncellenirken bir hata oluştu.');
    }
  };

  const getReminderTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deadline: 'Deadline Hatırlatmaları',
      data_entry: 'Veri Girişi Hatırlatmaları',
      approval: 'Onay Hatırlatmaları',
      custom: 'Özel Hatırlatmalar'
    };
    return labels[type] || type;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Yönetici',
      vice_president: 'Başkan Yardımcısı',
      manager: 'Müdür',
      user: 'Kullanıcı'
    };
    return labels[role] || role;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-8 h-8 text-blue-600" />
          Profil Yönetimi
        </h1>
        <p className="text-gray-600 mt-1">Profil bilgilerinizi ve tercihlerinizi yönetin</p>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Profil Bilgileri</h3>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ad Soyad <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-posta
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">E-posta adresi değiştirilemez</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+90 555 123 4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ünvan
                </label>
                <input
                  type="text"
                  value={profileData.title}
                  onChange={(e) => setProfileData({ ...profileData, title: e.target.value })}
                  placeholder="örn: Performans Uzmanı"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={getRoleLabel(profile?.role || '')}
                    disabled
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Müdürlük
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={profile?.departments?.name || 'Atanmamış'}
                    disabled
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading} icon={Save}>
                {loading ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordModal(true)}
                icon={Key}
              >
                Şifre Değiştir
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Hatırlatma Tercihleri
          </h3>
        </CardHeader>
        <CardBody>
          {reminderPreferences.length === 0 ? (
            <p className="text-center text-gray-600 py-8">Tercih bulunamadı.</p>
          ) : (
            <div className="space-y-4">
              {reminderPreferences.map((pref) => (
                <div
                  key={pref.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <h4 className="font-medium text-gray-900 mb-3">
                    {getReminderTypeLabel(pref.reminder_type)}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`email-${pref.id}`}
                        checked={pref.email_enabled}
                        onChange={(e) => handleUpdatePreference(pref, { email_enabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`email-${pref.id}`} className="text-sm text-gray-700">
                        E-posta bildirimi
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`inapp-${pref.id}`}
                        checked={pref.in_app_enabled}
                        onChange={(e) => handleUpdatePreference(pref, { in_app_enabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`inapp-${pref.id}`} className="text-sm text-gray-700">
                        Uygulama içi bildirim
                      </label>
                    </div>

                    <div>
                      <select
                        value={pref.frequency}
                        onChange={(e) => handleUpdatePreference(pref, { frequency: e.target.value })}
                        className="w-full px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="immediate">Anında</option>
                        <option value="daily">Günlük</option>
                        <option value="weekly">Haftalık</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {showPasswordModal && (
        <Modal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
          }}
          title="Şifre Değiştir"
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yeni Şifre <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yeni Şifre (Tekrar) <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              Şifrenizi değiştirdikten sonra tekrar giriş yapmanız gerekecektir.
            </p>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordModal(false)}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
