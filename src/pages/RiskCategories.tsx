import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layers } from 'lucide-react';

export default function RiskCategories() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadCategories();
    }
  }, [profile?.organization_id]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('risk_categories')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('order_index');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const parentCategories = categories.filter(c => !c.parent_id);
  const childCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId);

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
          <Layers className="w-8 h-8 text-indigo-600" />
          Risk Kategorileri
        </h1>
        <p className="text-slate-600 mt-2">Risk kategorilerini yönetin ve düzenleyin</p>
      </div>

      <div className="space-y-4">
        {parentCategories.map((parent) => (
          <div key={parent.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: parent.color || '#64748B' }}
                />
                <h3 className="text-lg font-semibold text-slate-900">{parent.name}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  parent.type === 'EXTERNAL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {parent.type === 'EXTERNAL' ? 'Dış Risk' : 'İç Risk'}
                </span>
              </div>
              {parent.description && (
                <p className="text-sm text-slate-600 mt-2">{parent.description}</p>
              )}
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {childCategories(parent.id).map((child) => (
                  <div
                    key={child.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: child.color || '#94A3B8' }}
                      />
                      <h4 className="font-medium text-slate-900">{child.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500">{child.code}</p>
                    {child.description && (
                      <p className="text-sm text-slate-600 mt-2">{child.description}</p>
                    )}
                  </div>
                ))}
              </div>

              {childCategories(parent.id).length === 0 && (
                <p className="text-sm text-slate-500 italic">Alt kategori bulunmuyor</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
