import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ChevronDown,
  ChevronRight,
  Save,
  Plus,
  Edit2,
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';
import Modal from '../components/ui/Modal';

interface ActionPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Component {
  id: string;
  code: string;
  name: string;
  order_index: number;
}

interface Standard {
  id: string;
  component_id: string;
  code: string;
  name: string;
  description: string;
  order_index: number;
}

interface GeneralCondition {
  id: string;
  standard_id: string;
  code: string;
  description: string;
  order_index: number;
}

interface ConditionAssessment {
  id?: string;
  organization_id: string;
  condition_id: string;
  action_plan_id: string;
  compliance_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | null;
  compliance_score: number | null;
  current_situation: string;
}

interface Action {
  id: string;
  code: string;
  title: string;
  condition_id: string;
  responsible_department_id: string;
  collaborating_departments_ids: string[];
  expected_outputs: string;
  is_continuous: boolean;
  start_date: string | null;
  target_date: string | null;
  status: string;
  progress_percent: number;
  description: string;
  departments?: { name: string };
}

interface Department {
  id: string;
  name: string;
}

export default function ICStandards() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const [components, setComponents] = useState<Component[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [conditions, setConditions] = useState<GeneralCondition[]>([]);
  const [assessments, setAssessments] = useState<ConditionAssessment[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set());

  const [showActionModal, setShowActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [actionConditionId, setActionConditionId] = useState<string>('');
  const [actionForm, setActionForm] = useState({
    title: '',
    responsible_department_id: '',
    collaborating_departments_ids: [] as string[],
    expected_outputs: '',
    is_continuous: false,
    target_date: '',
    description: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedPlanId) {
      loadPlanData();
    }
  }, [selectedPlanId]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      const [plansRes, componentsRes, standardsRes, conditionsRes, deptsRes] = await Promise.all([
        supabase
          .from('ic_action_plans')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('ic_components')
          .select('*')
          .order('order_index'),
        supabase
          .from('ic_standards')
          .select('*')
          .order('order_index'),
        supabase
          .from('ic_general_conditions')
          .select('*')
          .order('order_index'),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name')
      ]);

      if (plansRes.data) setActionPlans(plansRes.data);
      if (componentsRes.data) setComponents(componentsRes.data);
      if (standardsRes.data) setStandards(standardsRes.data);
      if (conditionsRes.data) setConditions(conditionsRes.data);
      if (deptsRes.data) setDepartments(deptsRes.data);

      if (plansRes.data && plansRes.data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(plansRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanData = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const [assessmentsRes, actionsRes] = await Promise.all([
        supabase
          .from('ic_condition_assessments')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('action_plan_id', selectedPlanId),
        supabase
          .from('ic_actions')
          .select(`
            *,
            departments(name)
          `)
          .eq('organization_id', profile.organization_id)
          .eq('action_plan_id', selectedPlanId)
          .order('code')
      ]);

      if (assessmentsRes.data) setAssessments(assessmentsRes.data);
      if (actionsRes.data) setActions(actionsRes.data);
    } catch (error) {
      console.error('Error loading plan data:', error);
    }
  };

  const getAssessment = (conditionId: string): ConditionAssessment => {
    const existing = assessments.find(a => a.condition_id === conditionId);
    if (existing) return existing;

    return {
      organization_id: profile!.organization_id!,
      condition_id: conditionId,
      action_plan_id: selectedPlanId,
      compliance_status: null,
      compliance_score: null,
      current_situation: ''
    };
  };

  const saveAssessment = async (assessment: ConditionAssessment) => {
    if (!profile?.organization_id) return;

    setSaving(true);
    try {
      if (assessment.id) {
        const { error } = await supabase
          .from('ic_condition_assessments')
          .update({
            compliance_status: assessment.compliance_status,
            compliance_score: assessment.compliance_score,
            current_situation: assessment.current_situation
          })
          .eq('id', assessment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ic_condition_assessments')
          .insert({
            organization_id: profile.organization_id,
            condition_id: assessment.condition_id,
            action_plan_id: selectedPlanId,
            compliance_status: assessment.compliance_status,
            compliance_score: assessment.compliance_score,
            current_situation: assessment.current_situation,
            assessed_by: profile.id
          });

        if (error) throw error;
      }

      await loadPlanData();
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Değerlendirme kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const getConditionActions = (conditionId: string) => {
    return actions.filter(a => a.condition_id === conditionId);
  };

  const generateActionCode = (conditionId: string) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return '';

    const conditionActions = getConditionActions(conditionId);
    const nextNumber = conditionActions.length + 1;

    return `${condition.code}.${nextNumber}`;
  };

  const openActionModal = (conditionId: string, action?: Action) => {
    setActionConditionId(conditionId);

    if (action) {
      setEditingAction(action);
      setActionForm({
        title: action.title,
        responsible_department_id: action.responsible_department_id,
        collaborating_departments_ids: action.collaborating_departments_ids || [],
        expected_outputs: action.expected_outputs || '',
        is_continuous: action.is_continuous,
        target_date: action.target_date || '',
        description: action.description || ''
      });
    } else {
      setEditingAction(null);
      setActionForm({
        title: '',
        responsible_department_id: '',
        collaborating_departments_ids: [],
        expected_outputs: '',
        is_continuous: false,
        target_date: '',
        description: ''
      });
    }

    setShowActionModal(true);
  };

  const saveAction = async () => {
    if (!profile?.organization_id || !actionForm.title || !actionForm.responsible_department_id) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    if (!actionForm.is_continuous && !actionForm.target_date) {
      alert('Sürekli olmayan eylemler için tamamlanma tarihi zorunludur');
      return;
    }

    setSaving(true);
    try {
      const actionData = {
        organization_id: profile.organization_id,
        action_plan_id: selectedPlanId,
        condition_id: actionConditionId,
        code: editingAction ? editingAction.code : generateActionCode(actionConditionId),
        title: actionForm.title,
        responsible_department_id: actionForm.responsible_department_id,
        collaborating_departments_ids: actionForm.collaborating_departments_ids,
        expected_outputs: actionForm.expected_outputs,
        is_continuous: actionForm.is_continuous,
        start_date: new Date().toISOString().split('T')[0],
        target_date: actionForm.is_continuous ? null : actionForm.target_date,
        status: actionForm.is_continuous ? 'ONGOING' : 'NOT_STARTED',
        progress_percent: editingAction ? editingAction.progress_percent : 0,
        description: actionForm.description
      };

      if (editingAction) {
        const { error } = await supabase
          .from('ic_actions')
          .update(actionData)
          .eq('id', editingAction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ic_actions')
          .insert(actionData);

        if (error) throw error;
      }

      setShowActionModal(false);
      await loadPlanData();
    } catch (error) {
      console.error('Error saving action:', error);
      alert('Eylem kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: conditions.length,
    compliant: assessments.filter(a => a.compliance_status === 'COMPLIANT').length,
    partial: assessments.filter(a => a.compliance_status === 'PARTIAL').length,
    nonCompliant: assessments.filter(a => a.compliance_status === 'NON_COMPLIANT').length
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'COMPLIANT': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'PARTIAL': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'NON_COMPLIANT': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'COMPLIANT': return 'Sağlanıyor';
      case 'PARTIAL': return 'Kısmen';
      case 'NON_COMPLIANT': return 'Sağlanmıyor';
      default: return 'Değerlendirilmedi';
    }
  };

  const getActionStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NOT_STARTED: 'slate',
      ONGOING: 'blue',
      IN_PROGRESS: 'blue',
      COMPLETED: 'green',
      DELAYED: 'red',
      CANCELLED: 'gray'
    };
    return colors[status] || 'slate';
  };

  const getActionStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NOT_STARTED: 'Başlamadı',
      ONGOING: 'Devam Ediyor',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      DELAYED: 'Gecikmiş',
      CANCELLED: 'İptal'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Yükleniyor...</div>
      </div>
    );
  }

  if (!selectedPlanId) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Eylem Planı Seçilmedi</h3>
            <p className="text-sm text-yellow-800 mb-4">
              Standartları değerlendirmek için önce bir eylem planı seçmelisiniz.
            </p>
            {actionPlans.length === 0 && (
              <p className="text-sm text-yellow-800">
                Henüz eylem planı oluşturulmamış. Lütfen önce <strong>Eylem Planları</strong> sayfasından bir plan oluşturun.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">İç Kontrol Standartları</h1>
          <p className="text-sm text-slate-600 mt-1">Genel şartları değerlendirin ve eylem planı oluşturun</p>
        </div>

        <div className="w-96">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Eylem Planı
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Plan seçiniz</option>
            {actionPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({new Date(plan.start_date).getFullYear()})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Toplam Genel Şart</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Sağlanan</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.compliant}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Kısmen Sağlanan</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.partial}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Sağlanmayan</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.nonCompliant}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {components.map((component) => {
          const componentStandards = standards.filter(s => s.component_id === component.id);
          const isExpanded = expandedComponents.has(component.id);

          return (
            <div key={component.id} className="bg-white rounded-lg shadow">
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedComponents);
                  if (isExpanded) {
                    newExpanded.delete(component.id);
                  } else {
                    newExpanded.add(component.id);
                  }
                  setExpandedComponents(newExpanded);
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div className="text-left">
                    <div className="font-bold text-lg text-slate-900">{component.code} - {component.name}</div>
                    <div className="text-sm text-slate-600">{componentStandards.length} Standart</div>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-4 space-y-3">
                  {componentStandards.map((standard) => {
                    const standardConditions = conditions.filter(c => c.standard_id === standard.id);
                    const isStandardExpanded = expandedStandards.has(standard.id);

                    return (
                      <div key={standard.id} className="border border-slate-200 rounded-lg">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedStandards);
                            if (isStandardExpanded) {
                              newExpanded.delete(standard.id);
                            } else {
                              newExpanded.add(standard.id);
                            }
                            setExpandedStandards(newExpanded);
                          }}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isStandardExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">{standard.code} - {standard.name}</div>
                              <div className="text-sm text-slate-600 mt-0.5">{standard.description}</div>
                            </div>
                          </div>
                        </button>

                        {isStandardExpanded && (
                          <div className="px-4 pb-3 space-y-3">
                            {standardConditions.map((condition) => {
                              const assessment = getAssessment(condition.id);
                              const conditionActions = getConditionActions(condition.id);
                              const isConditionExpanded = expandedConditions.has(condition.id);
                              const isCompliant = assessment.compliance_status === 'COMPLIANT';

                              return (
                                <div key={condition.id} className="bg-slate-50 rounded-lg p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <div className="font-medium text-slate-900 mb-1">{condition.code}</div>
                                      <div className="text-sm text-slate-700">{condition.description}</div>
                                    </div>
                                    {getStatusIcon(assessment.compliance_status)}
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                      <label className="block text-xs font-medium text-slate-700 mb-1">
                                        Durum
                                      </label>
                                      <select
                                        value={assessment.compliance_status || ''}
                                        onChange={(e) => {
                                          const newAssessment = {
                                            ...assessment,
                                            compliance_status: e.target.value as any
                                          };
                                          const newAssessments = assessment.id
                                            ? assessments.map(a => a.id === assessment.id ? newAssessment : a)
                                            : [...assessments, newAssessment];
                                          setAssessments(newAssessments);
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      >
                                        <option value="">Seçiniz</option>
                                        <option value="COMPLIANT">Sağlanıyor ✅</option>
                                        <option value="PARTIAL">Kısmen ⚠️</option>
                                        <option value="NON_COMPLIANT">Sağlanmıyor ❌</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-slate-700 mb-1">
                                        Puan (1-5)
                                      </label>
                                      <select
                                        value={assessment.compliance_score || ''}
                                        onChange={(e) => {
                                          const newAssessment = {
                                            ...assessment,
                                            compliance_score: e.target.value ? parseInt(e.target.value) : null
                                          };
                                          const newAssessments = assessment.id
                                            ? assessments.map(a => a.id === assessment.id ? newAssessment : a)
                                            : [...assessments, newAssessment];
                                          setAssessments(newAssessments);
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      >
                                        <option value="">Seçiniz</option>
                                        <option value="1">1 - Çok Zayıf</option>
                                        <option value="2">2 - Zayıf</option>
                                        <option value="3">3 - Orta</option>
                                        <option value="4">4 - İyi</option>
                                        <option value="5">5 - Çok İyi</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="mb-3">
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Mevcut Durum Açıklaması
                                    </label>
                                    <textarea
                                      value={assessment.current_situation}
                                      onChange={(e) => {
                                        const newAssessment = {
                                          ...assessment,
                                          current_situation: e.target.value
                                        };
                                        const newAssessments = assessment.id
                                          ? assessments.map(a => a.id === assessment.id ? newAssessment : a)
                                          : [...assessments, newAssessment];
                                        setAssessments(newAssessments);
                                      }}
                                      rows={3}
                                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      placeholder="Mevcut durum hakkında açıklama yazınız..."
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <button
                                      onClick={() => saveAssessment(assessment)}
                                      disabled={saving}
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                                    >
                                      <Save className="w-4 h-4" />
                                      {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                    </button>

                                    {conditionActions.length > 0 && (
                                      <button
                                        onClick={() => {
                                          const newExpanded = new Set(expandedConditions);
                                          if (isConditionExpanded) {
                                            newExpanded.delete(condition.id);
                                          } else {
                                            newExpanded.add(condition.id);
                                          }
                                          setExpandedConditions(newExpanded);
                                        }}
                                        className="text-sm text-blue-600 hover:text-blue-700"
                                      >
                                        {isConditionExpanded ? 'Eylemleri Gizle' : `${conditionActions.length} Eylem Göster`}
                                      </button>
                                    )}
                                  </div>

                                  {!isCompliant && (isConditionExpanded || conditionActions.length === 0) && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-slate-900">Eylemler</h4>
                                        <button
                                          onClick={() => openActionModal(condition.id)}
                                          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                        >
                                          <Plus className="w-4 h-4" />
                                          Eylem Ekle
                                        </button>
                                      </div>

                                      {conditionActions.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-4">
                                          Henüz eylem eklenmemiş
                                        </p>
                                      ) : (
                                        <div className="space-y-2">
                                          {conditionActions.map((action) => {
                                            const statusColor = getActionStatusColor(action.status);

                                            return (
                                              <div
                                                key={action.id}
                                                className="bg-white rounded-lg p-3 border border-slate-200 hover:border-blue-300 cursor-pointer transition-colors"
                                                onClick={() => openActionModal(condition.id, action)}
                                              >
                                                <div className="flex items-start justify-between">
                                                  <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <span className="font-medium text-slate-900">{action.code}</span>
                                                      <span className={`px-2 py-0.5 bg-${statusColor}-100 text-${statusColor}-700 text-xs rounded-full`}>
                                                        {getActionStatusLabel(action.status)}
                                                      </span>
                                                    </div>
                                                    <p className="text-sm text-slate-700">{action.title}</p>
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                                                      <span>Sorumlu: {action.departments?.name || '-'}</span>
                                                      {!action.is_continuous && action.target_date && (
                                                        <span>Hedef: {new Date(action.target_date).toLocaleDateString('tr-TR')}</span>
                                                      )}
                                                      {action.is_continuous && (
                                                        <span className="text-blue-600">Sürekli Eylem</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 ml-4">
                                                    <div className="text-right">
                                                      <div className="text-lg font-bold text-slate-900">%{action.progress_percent}</div>
                                                      <div className="text-xs text-slate-600">İlerleme</div>
                                                    </div>
                                                    <Edit2 className="w-4 h-4 text-slate-400" />
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setEditingAction(null);
        }}
        title={editingAction ? 'Eylem Düzenle' : 'Yeni Eylem Ekle'}
      >
        <div className="space-y-4">
          {!editingAction && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-900">
                <strong>Eylem Kodu:</strong> {generateActionCode(actionConditionId)}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Eylem Açıklaması <span className="text-red-500">*</span>
            </label>
            <textarea
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Eylem açıklaması giriniz..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              value={actionForm.responsible_department_id}
              onChange={(e) => setActionForm({ ...actionForm, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              İş Birliği Yapılacak Birimler
            </label>
            <select
              multiple
              value={actionForm.collaborating_departments_ids}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setActionForm({ ...actionForm, collaborating_departments_ids: selected });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              size={4}
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Ctrl/Cmd tuşu ile çoklu seçim yapabilirsiniz</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Beklenen Çıktı/Sonuç
            </label>
            <textarea
              value={actionForm.expected_outputs}
              onChange={(e) => setActionForm({ ...actionForm, expected_outputs: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Beklenen çıktı veya sonuç..."
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={actionForm.is_continuous}
                onChange={(e) => setActionForm({ ...actionForm, is_continuous: e.target.checked, target_date: '' })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Sürekli Eylem</span>
            </label>
          </div>

          {!actionForm.is_continuous && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tamamlanma Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={actionForm.target_date}
                onChange={(e) => setActionForm({ ...actionForm, target_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!actionForm.is_continuous}
              />
            </div>
          )}

          {editingAction && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                İlerleme (%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={editingAction.progress_percent}
                onChange={(e) => setEditingAction({ ...editingAction, progress_percent: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="text-center text-lg font-bold text-blue-600 mt-2">
                %{editingAction.progress_percent}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama/Not
            </label>
            <textarea
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ek açıklama veya notlar..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowActionModal(false);
                setEditingAction(null);
              }}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              İptal
            </button>
            <button
              onClick={saveAction}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
