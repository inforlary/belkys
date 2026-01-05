import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronDown, ChevronUp, BookOpen, Shield } from 'lucide-react';

interface ICComponent {
  id: string;
  code: string;
  name: string;
  description: string;
  order_index: number;
  color: string;
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

export default function ICStandards() {
  const [components, setComponents] = useState<ICComponent[]>([]);
  const [standards, setStandards] = useState<ICStandard[]>([]);
  const [expandedComponents, setExpandedComponents] = useState<string[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<ICStandard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: componentsData } = await supabase
        .from('ic_components')
        .select('*')
        .order('order_index');

      const { data: standardsData } = await supabase
        .from('ic_standards')
        .select('*')
        .order('component_id, order_index');

      if (componentsData) setComponents(componentsData);
      if (standardsData) setStandards(standardsData);

      if (componentsData && componentsData.length > 0) {
        setExpandedComponents([componentsData[0].id]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComponent = (componentId: string) => {
    setExpandedComponents(prev =>
      prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
  };

  const getStandardsByComponent = (componentId: string) => {
    return standards.filter(s => s.component_id === componentId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            Kamu İç Kontrol Standartları
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            26/12/2007 tarihli Resmi Gazete - 5 Bileşen, 18 Standart
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {components.map((component) => {
            const componentStandards = getStandardsByComponent(component.id);
            const isExpanded = expandedComponents.includes(component.id);

            return (
              <div key={component.id} className="bg-white rounded-lg shadow overflow-hidden">
                <button
                  onClick={() => toggleComponent(component.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  style={{ borderLeft: `4px solid ${component.color}` }}
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: component.color }}
                    >
                      {component.code}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {component.name}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {component.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                      {componentStandards.length} Standart
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="px-6 py-4">
                      <p className="text-sm text-gray-700 mb-4">{component.description}</p>
                      <div className="space-y-2">
                        {componentStandards.map((standard) => (
                          <button
                            key={standard.id}
                            onClick={() => setSelectedStandard(standard)}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                              selectedStandard?.id === standard.id
                                ? 'bg-white shadow-sm ring-2 ring-offset-1'
                                : 'bg-white hover:shadow-sm'
                            }`}
                            style={{
                              ringColor: selectedStandard?.id === standard.id ? component.color : undefined
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="text-xs font-semibold px-2 py-1 rounded text-white"
                                style={{ backgroundColor: component.color }}
                              >
                                {standard.code}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {standard.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {standard.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow sticky top-6">
            {selectedStandard ? (
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <BookOpen className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        {selectedStandard.code}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {selectedStandard.name}
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Açıklama</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selectedStandard.description}
                    </p>
                  </div>

                  {selectedStandard.general_conditions && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Genel Şartlar</h4>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {selectedStandard.general_conditions}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Detayları görmek için bir standart seçin
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
