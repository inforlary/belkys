import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Package, Save } from 'lucide-react';

export default function ModuleManagement() {
  const { profile } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadModules();
    }
  }, [profile?.organization_id]);

  const loadModules = async () => {
    try {
      const { data, error } = await supabase
        .from('module_settings')
        .select('*')
        .or(`organization_id.is.null,organization_id.eq.${profile?.organization_id}`)
        .order('display_order');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Modüller yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (moduleId: string, isEnabled: boolean) => {
    setModules(modules.map(m =>
      m.id === moduleId ? { ...m, is_enabled: isEnabled } : m
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const module of modules) {
        await supabase
          .from('module_settings')
          .upsert({
            organization_id: profile?.organization_id,
            module_name: module.module_name,
            is_enabled: module.is_enabled,
            display_order: module.display_order,
          });
      }
      alert('Modül ayarları başarıyla kaydedildi!');
    } catch (error) {
      console.error('Modül ayarları kaydedilirken hata:', error);
      alert('Modül ayarları kaydedilemedi!');
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
          <Package className="w-8 h-8 text-indigo-600" />
          Modül Yönetimi
        </h1>
        <p className="text-slate-600 mt-2">Aktif modülleri etkinleştirin veya devre dışı bırakın</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="divide-y divide-slate-200">
          {modules.map((module) => (
            <div key={module.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{module.module_name}</h3>
                <p className="text-sm text-slate-600 mt-1">Sıralama: {module.display_order}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={module.is_enabled}
                  onChange={(e) => handleToggle(module.id, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
