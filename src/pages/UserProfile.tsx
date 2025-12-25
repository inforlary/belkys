import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { User, Mail, Building, Shield, Key, Bell, Save, Eye, EyeOff, Award, CheckCircle, AlertCircle, Clock, Sparkles } from 'lucide-react';

interface ReminderPreference {
  id: string;
  reminder_type: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  frequency: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

interface OrganizationLicense {
  id: string;
  name: string;
  license_key: string | null;
  license_status: 'trial' | 'active' | 'expired' | 'suspended';
  license_trial_end_date: string | null;
  license_expiry_date: string | null;
  license_max_users: number;
  created_at: string;
}

export default function UserProfile() {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [organizationLicense, setOrganizationLicense] = useState<OrganizationLicense | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [activatingLicense, setActivatingLicense] = useState(false);

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
      if (profile.role === 'admin' || profile.is_super_admin) {
        loadOrganizationLicense();
      }
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

  const loadOrganizationLicense = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, license_key, license_status, license_trial_end_date, license_expiry_date, license_max_users, created_at')
      .eq('id', profile.organization_id)
      .single();

    if (error) {
      console.error('Error loading organization license:', error);
      return;
    }

    setOrganizationLicense(data);
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim() || !profile?.organization_id) {
      alert('Lütfen lisans anahtarını girin');
      return;
    }

    try {
      setActivatingLicense(true);

      const { data: existingLicense, error: checkError } = await supabase
        .from('organizations')
        .select('id')
        .eq('license_key', licenseKey)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingLicense && existingLicense.id !== profile.organization_id) {
        alert('Bu lisans anahtarı başka bir belediye tarafından kullanılıyor');
        return;
      }

      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          license_key: licenseKey,
          license_status: 'active',
          license_issued_date: new Date().toISOString()
        })
        .eq('id', profile.organization_id);

      if (updateError) throw updateError;

      alert('Lisans başarıyla aktifleştirildi!');
      setLicenseKey('');
      loadOrganizationLicense();
    } catch (error) {
      console.error('Error activating license:', error);
      alert('Lisans aktifleştirilirken hata oluştu');
    } finally {
      setActivatingLicense(false);
    }
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

      {(profile?.role === 'admin' || profile?.is_super_admin) && organizationLicense && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Belediye Lisansı
            </h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">Belediye</p>
                  <p className="text-lg font-semibold text-gray-900">{organizationLicense.name}</p>
                </div>
                <div>
                  {organizationLicense.license_status === 'trial' && (
                    <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Deneme Sürümü
                    </span>
                  )}
                  {organizationLicense.license_status === 'active' && (
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Aktif
                    </span>
                  )}
                  {organizationLicense.license_status === 'expired' && (
                    <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Süresi Doldu
                    </span>
                  )}
                </div>
              </div>

              {organizationLicense.license_status === 'trial' && organizationLicense.license_trial_end_date && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">15 Günlük Deneme Sürümü</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Deneme süreniz {new Date(organizationLicense.license_trial_end_date).toLocaleDateString('tr-TR')} tarihinde sona erecek.
                        Sistemin tüm özelliklerine erişmeye devam etmek için lütfen lisans anahtarınızı girin.
                      </p>
                      {(() => {
                        const now = new Date();
                        const trialEnd = new Date(organizationLicense.license_trial_end_date);
                        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <p className="text-sm font-semibold text-yellow-900 mt-2">
                            Kalan Süre: {daysLeft > 0 ? `${daysLeft} gün` : 'Süresi doldu'}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {organizationLicense.license_key ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-900">Lisans Anahtarı</p>
                      <code className="text-lg font-mono text-green-700 mt-1 block">
                        {organizationLicense.license_key}
                      </code>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  {organizationLicense.license_expiry_date && (
                    <p className="text-sm text-green-700 mt-2">
                      Geçerlilik: {new Date(organizationLicense.license_expiry_date).toLocaleDateString('tr-TR')} tarihine kadar
                    </p>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center mb-4">
                    <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-gray-900">Lisans Anahtarı Girin</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Super Admin tarafından size iletilen lisans anahtarını aşağıya girerek sistemi aktifleştirebilirsiniz.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lisans Anahtarı
                      </label>
                      <input
                        type="text"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                        placeholder="MUNI-XXXX-XXXX-XXXX"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={19}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: MUNI-XXXX-XXXX-XXXX
                      </p>
                    </div>

                    <Button
                      onClick={handleActivateLicense}
                      disabled={activatingLicense || !licenseKey.trim()}
                      className="w-full"
                    >
                      {activatingLicense ? 'Aktifleştiriliyor...' : 'Lisansı Aktifleştir'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 text-center pt-2 border-t">
                Lisans anahtarınız yoksa veya sorun yaşıyorsanız, lütfen sistem yöneticinizle iletişime geçin.
              </div>
            </div>
          </CardBody>
        </Card>
      )}

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
