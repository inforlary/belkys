import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Shield, Save } from 'lucide-react';

export default function SecuritySettings() {
  const { profile } = useAuth();
  const [policy, setPolicy] = useState<any>({
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special_chars: false,
    max_age_days: 90,
    lockout_threshold: 5,
    lockout_duration_minutes: 30,
    session_timeout_minutes: 480,
    require_2fa: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadPasswordPolicy();
    }
  }, [profile?.organization_id]);

  const loadPasswordPolicy = async () => {
    try {
      const { data, error } = await supabase
        .from('password_policies')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .maybeSingle();

      if (error) throw error;
      if (data) setPolicy(data);
    } catch (error) {
      console.error('Şifre politikası yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('password_policies')
        .upsert({
          organization_id: profile?.organization_id,
          ...policy,
        });

      if (error) throw error;
      alert('Güvenlik ayarları başarıyla kaydedildi!');
    } catch (error) {
      console.error('Güvenlik ayarları kaydedilirken hata:', error);
      alert('Güvenlik ayarları kaydedilemedi!');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-600" />
          Güvenlik Ayarları
        </h1>
        <p className="text-slate-600 mt-2">Şifre politikası ve güvenlik yapılandırması</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Şifre Politikası</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Şifre Uzunluğu
              </label>
              <input
                type="number"
                value={policy.min_length}
                onChange={(e) => setPolicy({ ...policy, min_length: parseInt(e.target.value) })}
                min="6"
                max="20"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policy.require_uppercase}
                  onChange={(e) => setPolicy({ ...policy, require_uppercase: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">Büyük harf zorunlu</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policy.require_lowercase}
                  onChange={(e) => setPolicy({ ...policy, require_lowercase: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">Küçük harf zorunlu</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policy.require_numbers}
                  onChange={(e) => setPolicy({ ...policy, require_numbers: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">Rakam zorunlu</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policy.require_special_chars}
                  onChange={(e) => setPolicy({ ...policy, require_special_chars: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">Özel karakter zorunlu (!@#$%^&*)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policy.require_2fa}
                  onChange={(e) => setPolicy({ ...policy, require_2fa: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">İki faktörlü kimlik doğrulama zorunlu</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Şifre Geçerlilik Süresi (Gün)
              </label>
              <input
                type="number"
                value={policy.max_age_days}
                onChange={(e) => setPolicy({ ...policy, max_age_days: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">0 = sınırsız</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Başarısız Giriş Limiti
              </label>
              <input
                type="number"
                value={policy.lockout_threshold}
                onChange={(e) => setPolicy({ ...policy, lockout_threshold: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hesap Kilitleme Süresi (Dakika)
              </label>
              <input
                type="number"
                value={policy.lockout_duration_minutes}
                onChange={(e) => setPolicy({ ...policy, lockout_duration_minutes: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Oturum Zaman Aşımı (Dakika)
              </label>
              <input
                type="number"
                value={policy.session_timeout_minutes}
                onChange={(e) => setPolicy({ ...policy, session_timeout_minutes: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
