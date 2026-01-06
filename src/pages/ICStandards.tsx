import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BookOpen, ChevronDown, ChevronRight, X } from 'lucide-react';

interface ICComponent {
  id: string;
  code: string;
  name: string;
  description: string;
  order_index: number;
  color?: string;
}

interface ICStandard {
  id: string;
  component_id: string;
  code: string;
  name: string;
  description: string;
  general_conditions: string;
  order_index: number;
}

interface ComponentWithStandards extends ICComponent {
  standards: ICStandard[];
}

export default function ICStandards() {
  const { profile } = useAuth();
  const [components, setComponents] = useState<ComponentWithStandards[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [selectedStandard, setSelectedStandard] = useState<ICStandard | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadComponentsWithStandards();
  }, []);

  const loadComponentsWithStandards = async () => {
    try {
      const { data: componentsData, error: componentsError } = await supabase
        .from('ic_components')
        .select('*')
        .order('order_index');

      if (componentsError) throw componentsError;

      const { data: standardsData, error: standardsError } = await supabase
        .from('ic_standards')
        .select('*')
        .order('order_index');

      if (standardsError) throw standardsError;

      const componentsWithStandards: ComponentWithStandards[] = (componentsData || []).map(component => ({
        ...component,
        standards: (standardsData || []).filter(standard => standard.component_id === component.id)
      }));

      setComponents(componentsWithStandards);

      if (componentsWithStandards.length > 0) {
        setExpandedComponents(new Set([componentsWithStandards[0].id]));
      }
    } catch (error) {
      console.error('Bileşenler ve standartlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComponent = (componentId: string) => {
    const newExpanded = new Set(expandedComponents);
    if (newExpanded.has(componentId)) {
      newExpanded.delete(componentId);
    } else {
      newExpanded.add(componentId);
    }
    setExpandedComponents(newExpanded);
  };

  const openStandardModal = (standard: ICStandard) => {
    setSelectedStandard(standard);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedStandard(null);
  };

  const getComponentColor = (code: string): string => {
    const colors: Record<string, string> = {
      'KO': 'bg-blue-50 border-blue-200 text-blue-900',
      'RD': 'bg-purple-50 border-purple-200 text-purple-900',
      'KF': 'bg-green-50 border-green-200 text-green-900',
      'BI': 'bg-orange-50 border-orange-200 text-orange-900',
      'IZ': 'bg-red-50 border-red-200 text-red-900'
    };
    return colors[code] || 'bg-slate-50 border-slate-200 text-slate-900';
  };

  const getComponentBadgeColor = (code: string): string => {
    const colors: Record<string, string> = {
      'KO': 'bg-blue-100 text-blue-800',
      'RD': 'bg-purple-100 text-purple-800',
      'KF': 'bg-green-100 text-green-800',
      'BI': 'bg-orange-100 text-orange-800',
      'IZ': 'bg-red-100 text-red-800'
    };
    return colors[code] || 'bg-slate-100 text-slate-800';
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
          Kamu İç Kontrol Standartları (KIKS) - 5 Bileşen, 18 Standart
        </p>
      </div>

      <div className="space-y-4">
        {components.map((component) => {
          const isExpanded = expandedComponents.has(component.id);

          return (
            <div
              key={component.id}
              className={`border-2 rounded-lg overflow-hidden transition-all ${getComponentColor(component.code)}`}
            >
              <button
                onClick={() => toggleComponent(component.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-opacity-80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 flex-shrink-0" />
                  )}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getComponentBadgeColor(component.code)}`}>
                      {component.code}
                    </span>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold">{component.name}</h3>
                      <p className="text-sm opacity-80">{component.description}</p>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium px-3 py-1 bg-white bg-opacity-50 rounded-full">
                  {component.standards.length} Standart
                </span>
              </button>

              {isExpanded && (
                <div className="bg-white border-t-2">
                  <div className="divide-y divide-slate-200">
                    {component.standards.map((standard) => (
                      <button
                        key={standard.id}
                        onClick={() => openStandardModal(standard)}
                        className="w-full px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getComponentBadgeColor(component.code)} flex-shrink-0`}>
                            {standard.code}
                          </span>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 mb-1">
                              {standard.name}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {standard.description}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && selectedStandard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  getComponentBadgeColor(
                    components.find(c => c.id === selectedStandard.component_id)?.code || ''
                  )
                }`}>
                  {selectedStandard.code}
                </span>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedStandard.name}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase mb-2">
                  Açıklama
                </h3>
                <p className="text-slate-900 leading-relaxed">
                  {selectedStandard.description}
                </p>
              </div>

              {selectedStandard.general_conditions && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3">
                    Genel Şartlar
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-slate-900 leading-relaxed whitespace-pre-line">
                      {selectedStandard.general_conditions}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-500 text-center">
                  Bu standart Kamu İç Kontrol Standartları (KIKS) kapsamında yer almaktadır
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
