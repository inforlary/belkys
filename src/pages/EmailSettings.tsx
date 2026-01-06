import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Save, Send } from 'lucide-react';

export default function EmailSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<any>({
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    reply_to: '',
    is_active: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadEmailSettings();
    }
  }, [profile?.organization_id]);

  const loadEmailSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .maybeSingle();

      if (error) throw error;
      if (data) setSettings(data);
    } catch (error) {
      console.error('E-posta ayarları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_settings')
        .upsert({
          organization_id: profile?.organization_id,
          ...settings,
        });

      if (error) throw error;
      alert('E-posta ayarları başarıyla kaydedildi!');
    } catch (error) {
      console.error('E-posta ayarları kaydedilirken hata:', error);
      alert('E-posta ayarları kaydedilemedi!');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      alert('Test e-postası gönderildi! (Özellik yakında aktif olacak)');
    } catch (error) {
      console.error('Test e-postası gönderilirken hata:', error);
      alert('Test e-postası gönderilemedi!');
    } finally {
      setTesting(false);
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
          <Mail className="w-8 h-8 text-green-600" />
          E-posta Ayarları
        </h1>
        <p className="text-slate-600 mt-2">SMTP sunucu yapılandırması</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SMTP Sunucu
            </label>
            <input
              type="text"
              value={settings.smtp_host}
              onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Port
            </label>
            <input
              type="number"
              value={settings.smtp_port}
              onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.smtp_secure}
              onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.checked })}
              className="rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-slate-700">SSL/TLS Kullan</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              value={settings.smtp_user}
              onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Şifre
            </label>
            <input
              type="password"
              value={settings.smtp_password}
              onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Gönderici E-posta
            </label>
            <input
              type="email"
              value={settings.from_email}
              onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
              placeholder="noreply@example.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Gönderici Adı
            </label>
            <input
              type="text"
              value={settings.from_name}
              onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
              placeholder="BELKYS Sistem"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Yanıtlama Adresi
          </label>
          <input
            type="email"
            value={settings.reply_to}
            onChange={(e) => setSettings({ ...settings, reply_to: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.is_active}
              onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
              className="rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-slate-700">E-posta gönderimini etkinleştir</span>
          </label>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>

          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            {testing ? 'Gönderiliyor...' : 'Test E-postası Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
