import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  TestTube,
  AlertTriangle,
  FileWarning,
  Target,
  Trash2,
  Edit2,
  BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface KiksCategory {
  id: string;
  code: string;
  name: string;
  main_standards: KiksMainStandard[];
}

interface KiksMainStandard {
  id: string;
  code: string;
  title: string;
  sub_standards: KiksSubStandard[];
}

interface KiksSubStandard {
  id: string;
  code: string;
  title: string;
  actions: KiksAction[];
}

interface KiksAction {
  id: string;
  code: string;
  description: string;
  action_plans: ActionPlanWithStats[];
}

interface ActionPlanWithStats {
  id: string;
  plan_code: string;
  planned_actions: string;
  completion_date: string;
  status: string;
  controls_count: number;
  tests_count: number;
  findings_count: number;
  capas_count: number;
}

interface DetailedData {
  controls: any[];
  tests: any[];
  findings: any[];
  capas: any[];
}

export default function ActionPlanWorkflowEnhanced() {
  const { profile } = useAuth();
  const { selectedPlanId, hasPlan } = useICPlan();
  const [categories, setCategories] = useState<KiksCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [expandedSubStandards, setExpandedSubStandards] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [selectedActionPlan, setSelectedActionPlan] = useState<string | null>(null);
  const [detailedData, setDetailedData] = useState<DetailedData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (profile && selectedPlanId) {
      fetchHierarchicalData();
    }
  }, [profile, selectedPlanId]);

  const fetchHierarchicalData = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      setLoading(true);

      const { data: categoriesData, error: catError } = await supabase
        .from('ic_kiks_categories')
        .select('id, code, name')
        .order('code');

      if (catError) throw catError;

      const enrichedCategories = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { data: mainStandards, error: mainError } = await supabase
            .from('ic_kiks_main_standards')
            .select('id, code, title')
            .eq('category_id', category.id)
            .order('code');

          if (mainError) throw mainError;

          const enrichedMainStandards = await Promise.all(
            (mainStandards || []).map(async (mainStandard) => {
              const { data: subStandards, error: subError } = await supabase
                .from('ic_kiks_sub_standards')
                .select('id, code, title')
                .eq('main_standard_id', mainStandard.id)
                .order('code');

              if (subError) throw subError;

              const enrichedSubStandards = await Promise.all(
                (subStandards || []).map(async (subStandard) => {
                  const { data: actions, error: actError } = await supabase
                    .from('ic_kiks_actions')
                    .select('id, code, description')
                    .eq('sub_standard_id', subStandard.id)
                    .eq('ic_plan_id', selectedPlanId)
                    .order('code');

                  if (actError) throw actError;

                  const enrichedActions = await Promise.all(
                    (actions || []).map(async (action) => {
                      const { data: actionPlans, error: planError } = await supabase
                        .from('ic_action_plans')
                        .select('id, plan_code, planned_actions, completion_date, status')
                        .eq('kiks_action_id', action.id)
                        .eq('organization_id', profile.organization_id)
                        .eq('ic_plan_id', selectedPlanId);

                      if (planError) throw planError;

                      const plansWithStats = await Promise.all(
                        (actionPlans || []).map(async (plan) => {
                          const [controlsRes, testsRes, findingsRes, capasRes] = await Promise.all([
                            supabase
                              .from('ic_controls')
                              .select('*', { count: 'exact', head: true })
                              .eq('kiks_action_id', action.id)
                              .eq('ic_plan_id', selectedPlanId),
                            supabase
                              .from('ic_control_tests')
                              .select('*', { count: 'exact', head: true })
                              .eq('kiks_action_id', action.id)
                              .eq('ic_plan_id', selectedPlanId),
                            supabase
                              .from('ic_findings')
                              .select('*', { count: 'exact', head: true })
                              .eq('kiks_action_id', action.id)
                              .eq('ic_plan_id', selectedPlanId),
                            supabase
                              .from('ic_capas')
                              .select('*', { count: 'exact', head: true })
                              .eq('kiks_action_id', action.id)
                              .eq('ic_plan_id', selectedPlanId)
                          ]);

                          return {
                            ...plan,
                            controls_count: controlsRes.count || 0,
                            tests_count: testsRes.count || 0,
                            findings_count: findingsRes.count || 0,
                            capas_count: capasRes.count || 0
                          };
                        })
                      );

                      return {
                        ...action,
                        action_plans: plansWithStats
                      };
                    })
                  );

                  return {
                    ...subStandard,
                    actions: enrichedActions.filter(a => a.action_plans.length > 0)
                  };
                })
              );

              return {
                ...mainStandard,
                sub_standards: enrichedSubStandards.filter(s => s.actions.length > 0)
              };
            })
          );

          return {
            ...category,
            main_standards: enrichedMainStandards.filter(m => m.sub_standards.length > 0)
          };
        })
      );

      setCategories(enrichedCategories.filter(c => c.main_standards.length > 0));
    } catch (error) {
      console.error('Hiyerarşik veri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedData = async (kiksActionId: string, actionPlanId: string) => {
    if (!selectedPlanId) return;

    try {
      setLoadingDetails(true);

      const [controlsRes, testsRes, findingsRes, capasRes] = await Promise.all([
        supabase
          .from('ic_controls')
          .select(`
            *,
            ic_risks(risk_code, risk_title),
            ic_processes(name)
          `)
          .eq('kiks_action_id', kiksActionId)
          .eq('ic_plan_id', selectedPlanId),
        supabase
          .from('ic_control_tests')
          .select('*')
          .eq('kiks_action_id', kiksActionId)
          .eq('ic_plan_id', selectedPlanId),
        supabase
          .from('ic_findings')
          .select('*')
          .eq('kiks_action_id', kiksActionId)
          .eq('ic_plan_id', selectedPlanId),
        supabase
          .from('ic_capas')
          .select('*')
          .eq('kiks_action_id', kiksActionId)
          .eq('ic_plan_id', selectedPlanId)
      ]);

      if (controlsRes.error) throw controlsRes.error;
      if (testsRes.error) throw testsRes.error;
      if (findingsRes.error) throw findingsRes.error;
      if (capasRes.error) throw capasRes.error;

      setDetailedData({
        controls: controlsRes.data || [],
        tests: testsRes.data || [],
        findings: findingsRes.data || [],
        capas: capasRes.data || []
      });
    } catch (error) {
      console.error('Detay veriler yüklenirken hata:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleStandard = (standardId: string) => {
    const newExpanded = new Set(expandedStandards);
    if (newExpanded.has(standardId)) {
      newExpanded.delete(standardId);
    } else {
      newExpanded.add(standardId);
    }
    setExpandedStandards(newExpanded);
  };

  const toggleSubStandard = (subStandardId: string) => {
    const newExpanded = new Set(expandedSubStandards);
    if (newExpanded.has(subStandardId)) {
      newExpanded.delete(subStandardId);
    } else {
      newExpanded.add(subStandardId);
    }
    setExpandedSubStandards(newExpanded);
  };

  const toggleAction = (actionId: string) => {
    const newExpanded = new Set(expandedActions);
    if (newExpanded.has(actionId)) {
      newExpanded.delete(actionId);
    } else {
      newExpanded.add(actionId);
    }
    setExpandedActions(newExpanded);
  };

  const handleActionPlanClick = (kiksActionId: string, actionPlanId: string) => {
    setSelectedActionPlan(actionPlanId);
    fetchDetailedData(kiksActionId, actionPlanId);
  };

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                Eylem Planı İş Akışı modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-7 h-7 text-blue-600" />
          Eylem Planı İş Akışı - KİKS Bazlı Görünüm
        </h1>
        <p className="text-gray-600 mt-1">
          KİKS standartları ve eylemler bazında organize edilmiş iş akışı
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {categories.map((category) => (
            <div key={category.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="font-bold text-gray-900">{category.code}</span>
                  <span className="text-sm font-medium text-gray-700">{category.name}</span>
                </div>
              </button>

              {expandedCategories.has(category.id) && (
                <div className="px-4 pb-3 space-y-2">
                  {category.main_standards.map((mainStandard) => (
                    <div key={mainStandard.id} className="border-l-2 border-blue-200 pl-3">
                      <button
                        onClick={() => toggleStandard(mainStandard.id)}
                        className="w-full flex items-center gap-2 py-2 hover:bg-blue-50 px-2 rounded transition-colors"
                      >
                        {expandedStandards.has(mainStandard.id) ? (
                          <ChevronDown className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="text-sm font-semibold text-blue-900">{mainStandard.code}</span>
                        <span className="text-sm text-gray-700">{mainStandard.title}</span>
                      </button>

                      {expandedStandards.has(mainStandard.id) && (
                        <div className="ml-4 space-y-2 mt-2">
                          {mainStandard.sub_standards.map((subStandard) => (
                            <div key={subStandard.id} className="border-l-2 border-green-200 pl-3">
                              <button
                                onClick={() => toggleSubStandard(subStandard.id)}
                                className="w-full flex items-center gap-2 py-2 hover:bg-green-50 px-2 rounded transition-colors"
                              >
                                {expandedSubStandards.has(subStandard.id) ? (
                                  <ChevronDown className="w-4 h-4 text-green-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-green-600" />
                                )}
                                <span className="text-xs font-semibold text-green-900">{subStandard.code}</span>
                                <span className="text-xs text-gray-600 flex-1 text-left">{subStandard.title}</span>
                              </button>

                              {expandedSubStandards.has(subStandard.id) && (
                                <div className="ml-4 space-y-1 mt-1">
                                  {subStandard.actions.map((action) => (
                                    <div key={action.id} className="border-l-2 border-orange-200 pl-3">
                                      <button
                                        onClick={() => toggleAction(action.id)}
                                        className="w-full flex items-center gap-2 py-1.5 hover:bg-orange-50 px-2 rounded transition-colors"
                                      >
                                        {expandedActions.has(action.id) ? (
                                          <ChevronDown className="w-3 h-3 text-orange-600" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3 text-orange-600" />
                                        )}
                                        <span className="text-xs font-semibold text-orange-900">{action.code}</span>
                                        <span className="text-xs text-gray-600 flex-1 text-left line-clamp-1">
                                          {action.description}
                                        </span>
                                      </button>

                                      {expandedActions.has(action.id) && (
                                        <div className="ml-4 space-y-1 mt-1">
                                          {action.action_plans.map((plan) => (
                                            <button
                                              key={plan.id}
                                              onClick={() => handleActionPlanClick(action.id, plan.id)}
                                              className={`w-full text-left p-2 rounded-lg border transition-all ${
                                                selectedActionPlan === plan.id
                                                  ? 'bg-blue-50 border-blue-300 shadow-md'
                                                  : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                              }`}
                                            >
                                              <div className="text-xs font-medium text-gray-900 mb-1">
                                                {plan.plan_code}
                                              </div>
                                              <div className="text-xs text-gray-600 line-clamp-2 mb-2">
                                                {plan.planned_actions}
                                              </div>
                                              <div className="flex gap-3 text-xs">
                                                <div className="flex items-center gap-1 text-green-600">
                                                  <ShieldCheck className="w-3 h-3" />
                                                  {plan.controls_count}
                                                </div>
                                                <div className="flex items-center gap-1 text-blue-600">
                                                  <TestTube className="w-3 h-3" />
                                                  {plan.tests_count}
                                                </div>
                                                <div className="flex items-center gap-1 text-orange-600">
                                                  <AlertTriangle className="w-3 h-3" />
                                                  {plan.findings_count}
                                                </div>
                                                <div className="flex items-center gap-1 text-red-600">
                                                  <FileWarning className="w-3 h-3" />
                                                  {plan.capas_count}
                                                </div>
                                              </div>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="col-span-7">
          {selectedActionPlan && detailedData ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Eylem Planı Detayları</h2>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Kontroller</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{detailedData.controls.length}</div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TestTube className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Testler</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{detailedData.tests.length}</div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900">Bulgular</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{detailedData.findings.length}</div>
                </div>

                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileWarning className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-900">CAPA</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{detailedData.capas.length}</div>
                </div>
              </div>

              <div className="space-y-4">
                {detailedData.controls.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                      Kontrol Faaliyetleri
                    </h3>
                    <div className="space-y-2">
                      {detailedData.controls.map((control: any) => (
                        <div key={control.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="font-medium text-sm text-gray-900">{control.control_title}</div>
                          <div className="text-xs text-gray-600 mt-1">Kod: {control.control_code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailedData.tests.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <TestTube className="w-5 h-5 text-blue-600" />
                      Kontrol Testleri
                    </h3>
                    <div className="space-y-2">
                      {detailedData.tests.map((test: any) => (
                        <div key={test.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="font-medium text-sm text-gray-900">Test: {test.test_code}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            Tarih: {new Date(test.test_date).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailedData.findings.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Bulgular
                    </h3>
                    <div className="space-y-2">
                      {detailedData.findings.map((finding: any) => (
                        <div key={finding.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="font-medium text-sm text-gray-900">{finding.finding_title}</div>
                          <div className="text-xs text-gray-600 mt-1">Kod: {finding.finding_code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailedData.capas.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <FileWarning className="w-5 h-5 text-red-600" />
                      CAPA (Düzeltici ve Önleyici Faaliyetler)
                    </h3>
                    <div className="space-y-2">
                      {detailedData.capas.map((capa: any) => (
                        <div key={capa.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="font-medium text-sm text-gray-900">{capa.title}</div>
                          <div className="text-xs text-gray-600 mt-1">Kod: {capa.capa_code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Eylem Planı Seçin</h3>
              <p className="text-gray-600">
                Sol taraftan bir eylem planı seçerek detaylarını görüntüleyebilirsiniz
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
