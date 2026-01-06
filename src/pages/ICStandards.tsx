import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BookOpen } from 'lucide-react';

export default function ICStandards() {
  const { profile } = useAuth();
  const [components, setComponents] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [componentsRes, standardsRes] = await Promise.all([
        supabase.from('ic_components').select('*').order('order_index'),
        supabase.from('ic_standards').select('*').order('order_index'),
      ]);

      if (componentsRes.error) throw componentsRes.error;
      if (standardsRes.error) throw standardsRes.error;

      setComponents(componentsRes.data || []);
      setStandards(standardsRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStandardsByComponent = (componentId: string) => {
    return standards.filter(s => s.component_id === componentId);
  };

  const componentColors: Record<string, string> = {
    KO: 'bg-blue-500',
    RD: 'bg-purple-500',
    KF: 'bg-green-500',
    BI: 'bg-yellow-500',
    IZ: 'bg-red-500',
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
          <BookOpen className="w-8 h-8 text-blue-600" />
          İç Kontrol Standartları
        </h1>
        <p className="text-slate-600 mt-2">
          Kamu İç Kontrol Standartları Tebliği - 5 Bileşen / 18 Standart
        </p>
      </div>

      <div className="space-y-6">
        {components.map((component) => {
          const componentStandards = getStandardsByComponent(component.id);
          return (
            <div key={component.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 ${componentColors[component.code] || 'bg-slate-500'} rounded`}></div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{component.name}</h3>
                    <p className="text-sm text-slate-600">{component.code} - {componentStandards.length} Standart</p>
                  </div>
                </div>
                {component.description && (
                  <p className="text-sm text-slate-600 mt-3 ml-5">{component.description}</p>
                )}
              </div>

              <div className="divide-y divide-slate-200">
                {componentStandards.map((standard) => (
                  <div key={standard.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                          {standard.code}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-slate-900 mb-2">{standard.name}</h4>
                        {standard.description && (
                          <p className="text-sm text-slate-600 mb-3">{standard.description}</p>
                        )}
                        {standard.general_conditions && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-blue-900 mb-1">Genel Şartlar:</p>
                            <p className="text-sm text-blue-800">{standard.general_conditions}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
