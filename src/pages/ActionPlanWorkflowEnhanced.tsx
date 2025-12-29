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
  BarChart3,
  X,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import Modal from '../components/ui/Modal';

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
  const [selectedKiksActionId, setSelectedKiksActionId] = useState<string | null>(null);
  const [detailedData, setDetailedData] = useState<DetailedData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [totalStats, setTotalStats] = useState({ controls: 0, tests: 0, findings: 0, capas: 0 });

  const [showControlModal, setShowControlModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [showCapaModal, setShowCapaModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [controlForm, setControlForm] = useState({ control_code: '', control_title: '', control_description: '' });
  const [testForm, setTestForm] = useState({ test_code: '', test_date: '', test_result: '', tester_name: '' });
  const [findingForm, setFindingForm] = useState({ finding_code: '', finding_title: '', finding_description: '', severity: 'Orta' });
  const [capaForm, setCapaForm] = useState({ capa_code: '', title: '', description: '', action_type: 'Düzeltici', due_date: '' });

  useEffect(() => {
    if (profile && selectedPlanId) {
      fetchHierarchicalData();
      fetchTotalStats();
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
    setSelectedKiksActionId(kiksActionId);
    fetchDetailedData(kiksActionId, actionPlanId);
  };

  const fetchTotalStats = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const [controlsRes, testsRes, findingsRes, capasRes] = await Promise.all([
        supabase
          .from('ic_controls')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId),
        supabase
          .from('ic_control_tests')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId),
        supabase
          .from('ic_findings')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId),
        supabase
          .from('ic_capas')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId)
      ]);

      setTotalStats({
        controls: controlsRes.count || 0,
        tests: testsRes.count || 0,
        findings: findingsRes.count || 0,
        capas: capasRes.count || 0
      });
    } catch (error) {
      console.error('Toplam istatistikler yüklenirken hata:', error);
    }
  };

  const generateControlCode = async () => {
    if (!profile?.organization_id || !selectedPlanId) return 'CTRL-001';

    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase
        .from('ic_controls')
        .select('control_code')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .like('control_code', `CTRL-${year}-%`)
        .order('control_code', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].control_code;
        const match = lastCode.match(/CTRL-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `CTRL-${year}-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Kontrol kodu oluşturulurken hata:', error);
      return `CTRL-${new Date().getFullYear()}-001`;
    }
  };

  const handleAddControl = async () => {
    if (!profile?.organization_id || !selectedPlanId || !selectedKiksActionId) return;

    try {
      setSaving(true);

      const autoCode = await generateControlCode();

      const { error } = await supabase.from('ic_controls').insert({
        organization_id: profile.organization_id,
        ic_plan_id: selectedPlanId,
        kiks_action_id: selectedKiksActionId,
        control_code: autoCode,
        control_title: controlForm.control_title,
        control_description: controlForm.control_description,
        control_type: 'Manuel',
        frequency: 'Aylık',
        responsible_person: profile.full_name || ''
      });

      if (error) throw error;

      setShowControlModal(false);
      setControlForm({ control_code: '', control_title: '', control_description: '' });
      if (selectedKiksActionId && selectedActionPlan) {
        fetchDetailedData(selectedKiksActionId, selectedActionPlan);
      }
      fetchTotalStats();
    } catch (error) {
      console.error('Kontrol eklenirken hata:', error);
      alert('Kontrol eklenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const generateTestCode = async () => {
    if (!profile?.organization_id || !selectedPlanId) return 'TEST-001';

    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase
        .from('ic_control_tests')
        .select('test_code')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .like('test_code', `TEST-${year}-%`)
        .order('test_code', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].test_code;
        const match = lastCode.match(/TEST-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `TEST-${year}-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Test kodu oluşturulurken hata:', error);
      return `TEST-${new Date().getFullYear()}-001`;
    }
  };

  const handleAddTest = async () => {
    if (!profile?.organization_id || !selectedPlanId || !selectedKiksActionId) return;

    try {
      setSaving(true);

      const autoCode = await generateTestCode();

      const { error } = await supabase.from('ic_control_tests').insert({
        organization_id: profile.organization_id,
        ic_plan_id: selectedPlanId,
        kiks_action_id: selectedKiksActionId,
        test_code: autoCode,
        test_date: testForm.test_date,
        test_result: testForm.test_result,
        tester_name: testForm.tester_name
      });

      if (error) throw error;

      setShowTestModal(false);
      setTestForm({ test_code: '', test_date: '', test_result: '', tester_name: '' });
      if (selectedKiksActionId && selectedActionPlan) {
        fetchDetailedData(selectedKiksActionId, selectedActionPlan);
      }
      fetchTotalStats();
    } catch (error) {
      console.error('Test eklenirken hata:', error);
      alert('Test eklenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const generateFindingCode = async () => {
    if (!profile?.organization_id || !selectedPlanId) return 'FIND-001';

    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase
        .from('ic_findings')
        .select('finding_code')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .like('finding_code', `FIND-${year}-%`)
        .order('finding_code', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].finding_code;
        const match = lastCode.match(/FIND-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `FIND-${year}-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Bulgu kodu oluşturulurken hata:', error);
      return `FIND-${new Date().getFullYear()}-001`;
    }
  };

  const handleAddFinding = async () => {
    if (!profile?.organization_id || !selectedPlanId || !selectedKiksActionId) return;

    try {
      setSaving(true);

      const autoCode = await generateFindingCode();

      const { error } = await supabase.from('ic_findings').insert({
        organization_id: profile.organization_id,
        ic_plan_id: selectedPlanId,
        kiks_action_id: selectedKiksActionId,
        finding_code: autoCode,
        finding_title: findingForm.finding_title,
        finding_description: findingForm.finding_description,
        severity: findingForm.severity,
        status: 'Açık',
        identified_by: profile.full_name || ''
      });

      if (error) throw error;

      setShowFindingModal(false);
      setFindingForm({ finding_code: '', finding_title: '', finding_description: '', severity: 'Orta' });
      if (selectedKiksActionId && selectedActionPlan) {
        fetchDetailedData(selectedKiksActionId, selectedActionPlan);
      }
      fetchTotalStats();
    } catch (error) {
      console.error('Bulgu eklenirken hata:', error);
      alert('Bulgu eklenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const generateCapaCode = async () => {
    if (!profile?.organization_id || !selectedPlanId) return 'CAPA-001';

    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase
        .from('ic_capas')
        .select('capa_code')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .like('capa_code', `CAPA-${year}-%`)
        .order('capa_code', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].capa_code;
        const match = lastCode.match(/CAPA-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `CAPA-${year}-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('CAPA kodu oluşturulurken hata:', error);
      return `CAPA-${new Date().getFullYear()}-001`;
    }
  };

  const handleAddCapa = async () => {
    if (!profile?.organization_id || !selectedPlanId || !selectedKiksActionId) return;

    try {
      setSaving(true);

      const autoCode = await generateCapaCode();

      const { error } = await supabase.from('ic_capas').insert({
        organization_id: profile.organization_id,
        ic_plan_id: selectedPlanId,
        kiks_action_id: selectedKiksActionId,
        capa_code: autoCode,
        capa_title: capaForm.title,
        capa_description: capaForm.description,
        action_type: capaForm.action_type,
        due_date: capaForm.due_date,
        status: 'open',
        responsible_user_id: profile.id
      });

      if (error) throw error;

      setShowCapaModal(false);
      setCapaForm({ capa_code: '', title: '', description: '', action_type: 'Düzeltici', due_date: '' });
      if (selectedKiksActionId && selectedActionPlan) {
        fetchDetailedData(selectedKiksActionId, selectedActionPlan);
      }
      fetchTotalStats();
    } catch (error) {
      console.error('CAPA eklenirken hata:', error);
      alert('CAPA eklenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
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

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-green-600" />
              <span className="text-sm font-medium text-green-900">Toplam Kontroller</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-green-700">{totalStats.controls}</div>
          <div className="text-xs text-green-600 mt-1">Tüm eylemler</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TestTube className="w-6 h-6 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Toplam Testler</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-700">{totalStats.tests}</div>
          <div className="text-xs text-blue-600 mt-1">Tüm eylemler</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Toplam Bulgular</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-orange-700">{totalStats.findings}</div>
          <div className="text-xs text-orange-600 mt-1">Tüm eylemler</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileWarning className="w-6 h-6 text-red-600" />
              <span className="text-sm font-medium text-red-900">Toplam CAPA</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-red-700">{totalStats.capas}</div>
          <div className="text-xs text-red-600 mt-1">Tüm eylemler</div>
        </div>
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
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                      Kontrol Faaliyetleri
                    </h3>
                    <button
                      onClick={() => setShowControlModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Ekle
                    </button>
                  </div>
                  {detailedData.controls.length > 0 ? (
                    <div className="space-y-2">
                      {detailedData.controls.map((control: any) => (
                        <div key={control.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="font-medium text-sm text-gray-900">{control.control_title}</div>
                          <div className="text-xs text-gray-600 mt-1">Kod: {control.control_code}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm border border-dashed rounded-lg">
                      Henüz kontrol eklenmemiş
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <TestTube className="w-5 h-5 text-blue-600" />
                      Kontrol Testleri
                    </h3>
                    <button
                      onClick={() => setShowTestModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Ekle
                    </button>
                  </div>
                  {detailedData.tests.length > 0 ? (
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
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm border border-dashed rounded-lg">
                      Henüz test eklenmemiş
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Bulgular
                    </h3>
                    <button
                      onClick={() => setShowFindingModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Ekle
                    </button>
                  </div>
                  {detailedData.findings.length > 0 ? (
                    <div className="space-y-2">
                      {detailedData.findings.map((finding: any) => (
                        <div key={finding.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="font-medium text-sm text-gray-900">{finding.finding_title}</div>
                          <div className="text-xs text-gray-600 mt-1">Kod: {finding.finding_code}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm border border-dashed rounded-lg">
                      Henüz bulgu eklenmemiş
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <FileWarning className="w-5 h-5 text-red-600" />
                      CAPA (Düzeltici ve Önleyici Faaliyetler)
                    </h3>
                    <button
                      onClick={() => setShowCapaModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Ekle
                    </button>
                  </div>
                  {detailedData.capas.length > 0 ? (
                    <div className="space-y-2">
                      {detailedData.capas.map((capa: any) => (
                        <div key={capa.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="font-medium text-sm text-gray-900">{capa.title}</div>
                          <div className="text-xs text-gray-600 mt-1">Kod: {capa.capa_code}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm border border-dashed rounded-lg">
                      Henüz CAPA eklenmemiş
                    </div>
                  )}
                </div>
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

      <Modal isOpen={showControlModal} onClose={() => setShowControlModal(false)} title="Yeni Kontrol Ekle">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Kontrol kodu otomatik olarak oluşturulacaktır (CTRL-2025-XXX formatında)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Başlığı</label>
            <input
              type="text"
              value={controlForm.control_title}
              onChange={(e) => setControlForm({ ...controlForm, control_title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Kontrol başlığı"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={controlForm.control_description}
              onChange={(e) => setControlForm({ ...controlForm, control_description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Kontrol açıklaması"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={() => setShowControlModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              onClick={handleAddControl}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showTestModal} onClose={() => setShowTestModal(false)} title="Yeni Test Ekle">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Test kodu otomatik olarak oluşturulacaktır (TEST-2025-XXX formatında)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Tarihi</label>
            <input
              type="date"
              value={testForm.test_date}
              onChange={(e) => setTestForm({ ...testForm, test_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Sonucu</label>
            <input
              type="text"
              value={testForm.test_result}
              onChange={(e) => setTestForm({ ...testForm, test_result: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Test sonucu"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Eden Kişi</label>
            <input
              type="text"
              value={testForm.tester_name}
              onChange={(e) => setTestForm({ ...testForm, tester_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ad Soyad"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={() => setShowTestModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              onClick={handleAddTest}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showFindingModal} onClose={() => setShowFindingModal(false)} title="Yeni Bulgu Ekle">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Bulgu kodu otomatik olarak oluşturulacaktır (FIND-2025-XXX formatında)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bulgu Başlığı</label>
            <input
              type="text"
              value={findingForm.finding_title}
              onChange={(e) => setFindingForm({ ...findingForm, finding_title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Bulgu başlığı"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={findingForm.finding_description}
              onChange={(e) => setFindingForm({ ...findingForm, finding_description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={3}
              placeholder="Bulgu açıklaması"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Önem Derecesi</label>
            <select
              value={findingForm.severity}
              onChange={(e) => setFindingForm({ ...findingForm, severity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Düşük">Düşük</option>
              <option value="Orta">Orta</option>
              <option value="Yüksek">Yüksek</option>
              <option value="Kritik">Kritik</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={() => setShowFindingModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              onClick={handleAddFinding}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCapaModal} onClose={() => setShowCapaModal(false)} title="Yeni CAPA Ekle">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              CAPA kodu otomatik olarak oluşturulacaktır (CAPA-2025-XXX formatında)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
            <input
              type="text"
              value={capaForm.title}
              onChange={(e) => setCapaForm({ ...capaForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="CAPA başlığı"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={capaForm.description}
              onChange={(e) => setCapaForm({ ...capaForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={3}
              placeholder="CAPA açıklaması"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aksiyon Türü</label>
            <select
              value={capaForm.action_type}
              onChange={(e) => setCapaForm({ ...capaForm, action_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="Düzeltici">Düzeltici</option>
              <option value="Önleyici">Önleyici</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tamamlanma Tarihi</label>
            <input
              type="date"
              value={capaForm.due_date}
              onChange={(e) => setCapaForm({ ...capaForm, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={() => setShowCapaModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              onClick={handleAddCapa}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
