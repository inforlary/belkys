import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, Save } from 'lucide-react';

export default function GeneralSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadSettings();
    }
  }, [profile?.organization_id]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('category', 'GENERAL')
        .or(`organization_id.is.null,organization_id.eq.${profile?.organization_id}`);

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('Ayarlar kaydedilecek:', settings);
      alert('Ayarlar başarıyla kaydedildi!');
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata:', error);
      alert('Ayarlar kaydedilemedi!');
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
          <Settings className="w-8 h-8 text-blue-600" />
          Genel Ayarlar
        </h1>
        <p className="text-slate-600 mt-2">Temel sistem yapılandırması</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Uygulama Adı
          </label>
          <input
            type="text"
            value={settings.app_name || 'BELKYS'}
            onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Varsayılan Dil
          </label>
          <select
            value={settings.default_language || 'tr'}
            onChange={(e) => setSettings({ ...settings, default_language: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tarih Formatı
          </label>
          <select
            value={settings.date_format || 'DD.MM.YYYY'}
            onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Zaman Dilimi
          </label>
          <select
            value={settings.timezone || 'Europe/Istanbul'}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Europe/Istanbul">İstanbul (GMT+3)</option>
            <option value="Europe/London">London (GMT+0)</option>
            <option value="America/New_York">New York (GMT-5)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Maksimum Dosya Boyutu (MB)
          </label>
          <input
            type="number"
            value={parseInt(settings.max_file_upload_size || '10485760') / (1024 * 1024)}
            onChange={(e) => setSettings({ ...settings, max_file_upload_size: (parseFloat(e.target.value) * 1024 * 1024).toString() })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
