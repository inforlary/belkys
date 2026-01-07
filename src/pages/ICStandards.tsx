import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  Eye,
  FileText,
  TrendingUp,
  X
} from 'lucide-react';

interface ICComponent {
  id: string;
  code: string;
  name: string;
  description: string;
  order_index: number;
  color: string;
  icon: string;
}

interface ICStandard {
  id: string;
  component_id: string;
  code: string;
  name: string;
  description: string;
  general_conditions: string;
  order_index: number;
  compliance_level?: number;
  action_count?: {
    active: number;
    completed: number;
  };
}

interface ComponentWithStandards extends ICComponent {
  standards: ICStandard[];
  compliance_avg: number;
}

interface Stats {
  overall_compliance: number;
  assessed_standards: number;
  total_standards: number;
  active_actions: number;
  completed_actions: number;
}

export default function ICStandards() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [components, setComponents] = useState<ComponentWithStandards[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [selectedStandard, setSelectedStandard] = useState<ICStandard | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadComponentsWithStandards();
  }, []);

  const loadComponentsWithStandards = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data: componentsData } = await supabase
        .from('ic_components')
        .select('*')
        .order('order_index');

      const { data: standardsData } = await supabase
        .from('ic_standards')
        .select('*')
        .order('order_index');

      const { data: assessmentDetails } = await supabase
        .from('ic_assessment_details')
        .select(`
          standard_id,
          compliance_level,
          assessment_id,
          ic_assessments!inner(organization_id)
        `)
        .eq('ic_assessments.organization_id', profile.organization_id);

      const { data: actionsData } = await supabase
        .from('ic_actions')
        .select(`
          standard_id,
          status,
          ic_action_plans!inner(organization_id)
        `)
        .eq('ic_action_plans.organization_id', profile.organization_id);

      const standardsMap = new Map<string, ICStandard>();
      standardsData?.forEach(std => {
        const assessments = assessmentDetails?.filter(a => a.standard_id === std.id) || [];
        const latestAssessment = assessments[assessments.length - 1];

        const actions = actionsData?.filter(a => a.standard_id === std.id) || [];
        const activeActions = actions.filter(a =>
          ['NOT_STARTED', 'IN_PROGRESS', 'DELAYED'].includes(a.status)
        ).length;
        const completedActions = actions.filter(a => a.status === 'COMPLETED').length;

        standardsMap.set(std.id, {
          ...std,
          compliance_level: latestAssessment?.compliance_level,
          action_count: {
            active: activeActions,
            completed: completedActions
          }
        });
      });

      const enrichedComponents: ComponentWithStandards[] = componentsData?.map(comp => {
        const compStandards = Array.from(standardsMap.values())
          .filter(std => std.component_id === comp.id);

        const complianceLevels = compStandards
          .filter(s => s.compliance_level)
          .map(s => s.compliance_level!);

        const compliance_avg = complianceLevels.length > 0
          ? (complianceLevels.reduce((a, b) => a + b, 0) / complianceLevels.length) * 20
          : 0;

        return {
          ...comp,
          standards: compStandards,
          compliance_avg
        };
      }) || [];

      setComponents(enrichedComponents);

      const allStandards = Array.from(standardsMap.values());
      const assessedCount = allStandards.filter(s => s.compliance_level).length;
      const totalCompliance = allStandards
        .filter(s => s.compliance_level)
        .reduce((sum, s) => sum + s.compliance_level!, 0);

      const totalActive = allStandards.reduce((sum, s) => sum + (s.action_count?.active || 0), 0);
      const totalCompleted = allStandards.reduce((sum, s) => sum + (s.action_count?.completed || 0), 0);

      setStats({
        overall_compliance: assessedCount > 0 ? (totalCompliance / assessedCount) * 20 : 0,
        assessed_standards: assessedCount,
        total_standards: allStandards.length,
        active_actions: totalActive,
        completed_actions: totalCompleted
      });

      if (enrichedComponents.length > 0) {
        setExpandedComponents(new Set([enrichedComponents[0].id]));
      }
    } catch (error) {
      console.error('Error loading data:', error);
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

  function getComplianceColor(level?: number): string {
    if (!level) return 'text-gray-400';
    if (level === 5) return 'text-green-600';
    if (level === 4) return 'text-green-500';
    if (level === 3) return 'text-yellow-500';
    if (level === 2) return 'text-orange-500';
    return 'text-red-500';
  }

  function getComplianceDots(level?: number) {
    if (!level) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i <= level ? 'bg-current' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    );
  }

  function getComplianceText(level?: number): string {
    if (!level) return 'Değerlendirilmedi';
    if (level === 5) return 'Tam Uyumlu';
    if (level === 4) return 'Büyük Ölçüde Uyumlu';
    if (level === 3) return 'Orta Düzeyde Uyumlu';
    if (level === 2) return 'Kısmen Uyumlu';
    return 'Uyumsuz';
  }

  function getProgressBar(percent: number) {
    return (
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-10 w-10" />
          <div>
            <h1 className="text-3xl font-bold">İç Kontrol Standartları</h1>
            <p className="text-blue-100 mt-1">
              Kamu İç Kontrol Standartları Tebliği kapsamında 5 bileşen ve 18 standart
            </p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-6 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">Genel Uyum</span>
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold mb-1">
                {stats.overall_compliance.toFixed(0)}%
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${stats.overall_compliance}%` }}
                />
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">Değerlendirme</span>
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold mb-1">
                {stats.assessed_standards}/{stats.total_standards}
              </div>
              <div className="text-sm text-blue-100">Standart</div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">Aktif Eylem</span>
                <Clock className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold mb-1">
                {stats.active_actions}
              </div>
              <div className="text-sm text-blue-100">Eylem</div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">Tamamlanan</span>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold mb-1">
                {stats.completed_actions}
              </div>
              <div className="text-sm text-blue-100">Eylem</div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {components.map((component) => {
          const isExpanded = expandedComponents.has(component.id);

          return (
            <div
              key={component.id}
              className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200"
            >
              <button
                onClick={() => toggleComponent(component.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${component.color}20`, color: component.color }}
                  >
                    <Shield className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {component.order_index}. {component.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{component.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Uyum: {component.compliance_avg.toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">
                      {component.standards.length} Standart
                    </div>
                  </div>
                  {getProgressBar(component.compliance_avg)}
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      isExpanded ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 space-y-3">
                  {component.standards.map((standard) => (
                    <div
                      key={standard.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {standard.code}
                            </span>
                            <h4 className="font-semibold text-gray-900">{standard.name}</h4>
                            <div className={`flex items-center gap-2 ${getComplianceColor(standard.compliance_level)}`}>
                              {getComplianceDots(standard.compliance_level)}
                              <span className="text-xs">
                                {standard.compliance_level ? `${standard.compliance_level}/5` : '-'}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{standard.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>
                              Eylem: {standard.action_count?.active || 0} aktif, {standard.action_count?.completed || 0} tamamlandı
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => openStandardModal(standard)}
                            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Detay
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && selectedStandard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedStandard.code} - {selectedStandard.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Bileşen: {components.find(c => c.id === selectedStandard.component_id)?.name}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
                  Açıklama
                </h3>
                <p className="text-gray-700 leading-relaxed">{selectedStandard.description}</p>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                  Genel Şartlar
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {selectedStandard.general_conditions.split('\n').map((condition, idx) => (
                    <p key={idx} className="text-sm text-gray-700 leading-relaxed">
                      {condition}
                    </p>
                  ))}
                </div>
              </div>

              {selectedStandard.compliance_level && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                    Mevcut Uyum Durumu
                  </h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className={`flex items-center gap-3 ${getComplianceColor(selectedStandard.compliance_level)}`}>
                      {getComplianceDots(selectedStandard.compliance_level)}
                      <span className="font-semibold">
                        {selectedStandard.compliance_level}/5 - {getComplianceText(selectedStandard.compliance_level)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedStandard.action_count && (selectedStandard.action_count.active > 0 || selectedStandard.action_count.completed > 0) && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                    İlişkili Eylemler
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-orange-800">Aktif Eylemler</span>
                        <Clock className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="text-2xl font-bold text-orange-900 mt-2">
                        {selectedStandard.action_count.active}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-800">Tamamlanan</span>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="text-2xl font-bold text-green-900 mt-2">
                        {selectedStandard.action_count.completed}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Kapat
              </button>
              <button
                onClick={() => {
                  closeModal();
                  navigate('internal-control/assessments');
                }}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              >
                Değerlendirme Yap
              </button>
              <button
                onClick={() => {
                  closeModal();
                  navigate('internal-control/action-plans');
                }}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
              >
                Eylem Planına Git
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
