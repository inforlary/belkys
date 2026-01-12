import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Save,
  Search
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import StarRating from '../components/ui/StarRating';
import Modal from '../components/ui/Modal';
import * as XLSX from 'xlsx';

interface ActionPlan {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
}

interface Component {
  id: string;
  code: string;
  name: string;
  order_index: number;
  standards: Standard[];
}

interface Standard {
  id: string;
  code: string;
  name: string;
  order_index: number;
  component_id: string;
  conditions: GeneralCondition[];
}

interface GeneralCondition {
  id: string;
  code: string;
  description: string;
  order_index: number;
  standard_id: string;
  assessment?: ConditionAssessment;
  actions: ActionSummary[];
}

interface ConditionAssessment {
  id: string;
  condition_id: string;
  action_plan_id: string;
  compliance_status: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | null;
  compliance_score: number;
  current_situation: string;
  assessed_by: string;
  assessed_at: string;
}

interface ActionSummary {
  id: string;
  code: string;
  title: string;
  status: string;
}

interface Statistics {
  totalConditions: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notAssessed: number;
  avgCompliance: number;
  avgScore: number;
}

export default function ICAssessments() {
  const { profile } = useAuth();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [components, setComponents] = useState<Component[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalConditions: 0,
    compliant: 0,
    partial: 0,
    nonCompliant: 0,
    notAssessed: 0,
    avgCompliance: 0,
    avgScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<GeneralCondition | null>(null);
  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    responsible_departments: [] as string[],
    collaborating_departments: [] as string[],
    expected_output: '',
    is_continuous: false,
    target_date: ''
  });

  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadActionPlans();
      loadDepartments();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedPlanId) {
      loadAssessmentData();
    }
  }, [selectedPlanId]);

  const loadActionPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('ic_action_plans')
        .select('id, name, year, start_date, end_date')
        .eq('organization_id', profile?.organization_id)
        .order('year', { ascending: false });

      if (error) throw error;

      setActionPlans(data || []);
      if (data && data.length > 0) {
        setSelectedPlanId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading action plans:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadAssessmentData = async () => {
    try {
      setLoading(true);

      const [
        { data: componentsData, error: componentsError },
        { data: standardsData, error: standardsError },
        { data: conditionsData, error: conditionsError },
        { data: assessmentsData, error: assessmentsError },
        { data: actionsData, error: actionsError }
      ] = await Promise.all([
        supabase
          .from('ic_components')
          .select('id, code, name, order_index')
          .is('organization_id', null)
          .order('order_index'),

        supabase
          .from('ic_standards')
          .select('id, code, name, order_index, component_id')
          .order('order_index'),

        supabase
          .from('ic_general_conditions')
          .select('id, code, description, order_index, standard_id')
          .order('order_index'),

        supabase
          .from('ic_condition_assessments')
          .select('*')
          .eq('action_plan_id', selectedPlanId),

        supabase
          .from('ic_actions')
          .select('id, code, title, status, condition_id')
          .eq('action_plan_id', selectedPlanId)
      ]);

      if (componentsError) throw componentsError;
      if (standardsError) throw standardsError;
      if (conditionsError) throw conditionsError;

      const assessmentsMap = new Map();
      assessmentsData?.forEach(assessment => {
        assessmentsMap.set(assessment.condition_id, assessment);
      });

      const actionsMap = new Map<string, ActionSummary[]>();
      actionsData?.forEach(action => {
        if (!actionsMap.has(action.condition_id)) {
          actionsMap.set(action.condition_id, []);
        }
        actionsMap.get(action.condition_id)?.push({
          id: action.id,
          code: action.code,
          title: action.title,
          status: action.status
        });
      });

      const conditionsMap = new Map<string, GeneralCondition[]>();
      conditionsData?.forEach(condition => {
        if (!conditionsMap.has(condition.standard_id)) {
          conditionsMap.set(condition.standard_id, []);
        }
        conditionsMap.get(condition.standard_id)?.push({
          ...condition,
          assessment: assessmentsMap.get(condition.id),
          actions: actionsMap.get(condition.id) || []
        });
      });

      const standardsMap = new Map<string, Standard[]>();
      standardsData?.forEach(standard => {
        if (!standardsMap.has(standard.component_id)) {
          standardsMap.set(standard.component_id, []);
        }
        standardsMap.get(standard.component_id)?.push({
          ...standard,
          conditions: conditionsMap.get(standard.id) || []
        });
      });

      const componentsWithData: Component[] = componentsData?.map(component => ({
        ...component,
        standards: standardsMap.get(component.id) || []
      })) || [];

      setComponents(componentsWithData);
      calculateStatistics(componentsWithData);
    } catch (error: any) {
      console.error('Error loading assessment data:', error);
      alert('Veri yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (componentsData: Component[]) => {
    let totalConditions = 0;
    let compliant = 0;
    let partial = 0;
    let nonCompliant = 0;
    let notAssessed = 0;
    let totalScore = 0;
    let scoredCount = 0;

    componentsData.forEach(component => {
      component.standards.forEach(standard => {
        standard.conditions.forEach(condition => {
          totalConditions++;
          if (condition.assessment) {
            if (condition.assessment.compliance_status === 'COMPLIANT') compliant++;
            else if (condition.assessment.compliance_status === 'PARTIAL') partial++;
            else if (condition.assessment.compliance_status === 'NON_COMPLIANT') nonCompliant++;

            if (condition.assessment.compliance_score > 0) {
              totalScore += condition.assessment.compliance_score;
              scoredCount++;
            }
          } else {
            notAssessed++;
          }
        });
      });
    });

    const avgScore = scoredCount > 0 ? totalScore / scoredCount : 0;
    const avgCompliance = totalConditions > 0 ? ((compliant + (partial * 0.5)) / totalConditions) * 100 : 0;

    setStatistics({
      totalConditions,
      compliant,
      partial,
      nonCompliant,
      notAssessed,
      avgCompliance,
      avgScore
    });
  };

  const toggleComponent = (componentId: string) => {
    const newSet = new Set(expandedComponents);
    if (newSet.has(componentId)) {
      newSet.delete(componentId);
    } else {
      newSet.add(componentId);
    }
    setExpandedComponents(newSet);
  };

  const toggleStandard = (standardId: string) => {
    const newSet = new Set(expandedStandards);
    if (newSet.has(standardId)) {
      newSet.delete(standardId);
    } else {
      newSet.add(standardId);
    }
    setExpandedStandards(newSet);
  };

  const expandAll = () => {
    const allComponents = new Set(components.map(c => c.id));
    const allStandards = new Set(components.flatMap(c => c.standards.map(s => s.id)));
    setExpandedComponents(allComponents);
    setExpandedStandards(allStandards);
  };

  const collapseAll = () => {
    setExpandedComponents(new Set());
    setExpandedStandards(new Set());
  };

  const handleSaveAssessment = async (conditionId: string, data: {
    compliance_status: string;
    compliance_score: number;
    current_situation: string;
  }) => {
    if (!selectedPlanId || !profile?.id || !profile?.organization_id) return;

    try {
      setSaving(conditionId);

      const { error } = await supabase
        .from('ic_condition_assessments')
        .upsert({
          organization_id: profile.organization_id,
          condition_id: conditionId,
          action_plan_id: selectedPlanId,
          compliance_status: data.compliance_status,
          compliance_score: data.compliance_score,
          current_situation: data.current_situation,
          assessed_by: profile.id,
          assessed_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,condition_id,action_plan_id'
        });

      if (error) throw error;

      await loadAssessmentData();
      alert('Değerlendirme kaydedildi');
    } catch (error: any) {
      console.error('Error saving assessment:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const getStatusLabel = (status: string | null) => {
    if (!status) return 'Değerlendirilmedi';
    const labels: Record<string, string> = {
      COMPLIANT: 'Sağlanıyor',
      PARTIAL: 'Kısmen Sağlanıyor',
      NON_COMPLIANT: 'Sağlanmıyor'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string | null) => {
    if (!status) return <AlertCircle className="w-4 h-4 text-gray-400" />;
    if (status === 'COMPLIANT') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === 'PARTIAL') return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  const calculateComponentCompliance = (component: Component) => {
    let total = 0;
    let count = 0;
    component.standards.forEach(standard => {
      standard.conditions.forEach(condition => {
        if (condition.assessment?.compliance_score) {
          total += condition.assessment.compliance_score;
          count++;
        }
      });
    });
    return count > 0 ? (total / count) * 20 : 0;
  };

  const getRadarData = () => {
    return components.map(component => ({
      subject: component.code,
      value: calculateComponentCompliance(component),
      fullMark: 100
    }));
  };

  const handleAddAction = () => {
    if (!selectedCondition) return;
    setShowActionModal(true);
  };

  const handleSaveAction = async () => {
    if (!selectedCondition || !selectedPlanId || !profile?.organization_id) return;

    try {
      const { data: existingActions } = await supabase
        .from('ic_actions')
        .select('code')
        .eq('condition_id', selectedCondition.id)
        .eq('action_plan_id', selectedPlanId)
        .order('code', { ascending: false })
        .limit(1);

      const nextNumber = existingActions && existingActions.length > 0
        ? parseInt(existingActions[0].code.split('.').pop() || '0') + 1
        : 1;

      const actionCode = `${selectedCondition.code}.${nextNumber}`;

      const { error } = await supabase
        .from('ic_actions')
        .insert({
          organization_id: profile.organization_id,
          action_plan_id: selectedPlanId,
          condition_id: selectedCondition.id,
          code: actionCode,
          title: actionForm.title,
          description: actionForm.description,
          responsible_departments: actionForm.responsible_departments,
          collaborating_departments: actionForm.collaborating_departments,
          expected_output: actionForm.expected_output,
          is_continuous: actionForm.is_continuous,
          target_date: actionForm.target_date || null,
          status: 'PLANNED'
        });

      if (error) throw error;

      setShowActionModal(false);
      setActionForm({
        title: '',
        description: '',
        responsible_departments: [],
        collaborating_departments: [],
        expected_output: '',
        is_continuous: false,
        target_date: ''
      });
      await loadAssessmentData();
      alert('Eylem eklendi');
    } catch (error: any) {
      console.error('Error adding action:', error);
      alert('Hata: ' + error.message);
    }
  };

  const exportToExcel = () => {
    const data: any[] = [];
    components.forEach(component => {
      component.standards.forEach(standard => {
        standard.conditions.forEach(condition => {
          data.push({
            'Bileşen': component.code + ' - ' + component.name,
            'Standart': standard.code + ' - ' + standard.name,
            'Genel Şart': condition.code,
            'Açıklama': condition.description,
            'Durum': getStatusLabel(condition.assessment?.compliance_status || null),
            'Puan': condition.assessment?.compliance_score || '-',
            'Mevcut Durum': condition.assessment?.current_situation || '-',
            'Eylem Sayısı': condition.actions.length
          });
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Değerlendirmeler');
    XLSX.writeFile(wb, `İç_Kontrol_Değerlendirme_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredComponents = components.map(component => ({
    ...component,
    standards: component.standards.map(standard => ({
      ...standard,
      conditions: standard.conditions.filter(condition => {
        const matchesSearch = searchQuery === '' ||
          condition.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          condition.description.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = filterStatus === 'all' ||
          (filterStatus === 'not_assessed' && !condition.assessment) ||
          (condition.assessment?.compliance_status === filterStatus);

        return matchesSearch && matchesStatus;
      })
    })).filter(standard => standard.conditions.length > 0)
  })).filter(component => component.standards.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!selectedPlanId) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Henüz eylem planı bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Öz Değerlendirmeler</h1>
          <p className="text-sm text-gray-600 mt-1">Standart ve genel şart uyum değerlendirmeleri</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Excel İndir
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            PDF İndir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 font-medium">GENEL UYUM</span>
            <span className="text-2xl">🟢</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            %{statistics.avgCompliance.toFixed(0)}
          </div>
          <div className="text-sm text-gray-500">
            Ortalama Puan: {statistics.avgScore.toFixed(1)}/5
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-green-700 font-medium">SAĞLANIYOR</span>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-900 mb-1">
            {statistics.compliant}
          </div>
          <div className="text-sm text-green-600">
            %{statistics.totalConditions > 0 ? ((statistics.compliant / statistics.totalConditions) * 100).toFixed(0) : 0}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-yellow-700 font-medium">KISMEN</span>
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="text-3xl font-bold text-yellow-900 mb-1">
            {statistics.partial}
          </div>
          <div className="text-sm text-yellow-600">
            %{statistics.totalConditions > 0 ? ((statistics.partial / statistics.totalConditions) * 100).toFixed(0) : 0}
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-red-700 font-medium">SAĞLANMIYOR</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-900 mb-1">
            {statistics.nonCompliant}
          </div>
          <div className="text-sm text-red-600">
            %{statistics.totalConditions > 0 ? ((statistics.nonCompliant / statistics.totalConditions) * 100).toFixed(0) : 0}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-900">Eylem Planı:</span>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="input-field flex-1"
          >
            {actionPlans.map(plan => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.year})
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-blue-700 mt-2">
          ⓘ Değerlendirmeler seçili eylem planına bağlıdır.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Genel şart ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="COMPLIANT">Sadece Sağlanıyor</option>
                <option value="PARTIAL">Sadece Kısmen Sağlanıyor</option>
                <option value="NON_COMPLIANT">Sadece Sağlanmıyor</option>
                <option value="not_assessed">Değerlendirilmemiş</option>
              </select>
              <button onClick={expandAll} className="btn-secondary whitespace-nowrap">
                Tümünü Genişlet
              </button>
              <button onClick={collapseAll} className="btn-secondary whitespace-nowrap">
                Tümünü Daralt
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredComponents.map((component) => (
              <ComponentAccordion
                key={component.id}
                component={component}
                expanded={expandedComponents.has(component.id)}
                onToggle={() => toggleComponent(component.id)}
                expandedStandards={expandedStandards}
                onToggleStandard={toggleStandard}
                onSave={handleSaveAssessment}
                onAddAction={(condition) => {
                  setSelectedCondition(condition);
                  handleAddAction();
                }}
                saving={saving}
                getStatusLabel={getStatusLabel}
                getStatusIcon={getStatusIcon}
              />
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">BİLEŞEN UYUM GRAFİĞİ</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={getRadarData()}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Uyum %" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setSelectedCondition(null);
        }}
        title={`Eylem Ekle - ${selectedCondition?.code}`}
        maxWidth="3xl"
      >
        <div className="space-y-4">
          {selectedCondition && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Genel Şart:</strong> {selectedCondition.code} - {selectedCondition.description}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eylem Başlığı *
            </label>
            <input
              type="text"
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              rows={3}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sorumlu Birim *
            </label>
            <select
              value={actionForm.responsible_departments[0] || ''}
              onChange={(e) => setActionForm({ ...actionForm, responsible_departments: [e.target.value] })}
              className="input-field"
            >
              <option value="">Seçiniz...</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beklenen Çıktı
            </label>
            <textarea
              value={actionForm.expected_output}
              onChange={(e) => setActionForm({ ...actionForm, expected_output: e.target.value })}
              rows={2}
              className="input-field"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={actionForm.is_continuous}
                onChange={(e) => setActionForm({ ...actionForm, is_continuous: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Bu eylem sürekli olarak tekrarlanacak</span>
            </label>
          </div>

          {!actionForm.is_continuous && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hedef Tarih *
              </label>
              <input
                type="date"
                value={actionForm.target_date}
                onChange={(e) => setActionForm({ ...actionForm, target_date: e.target.value })}
                className="input-field"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowActionModal(false);
                setSelectedCondition(null);
              }}
              className="btn-secondary"
            >
              İptal
            </button>
            <button
              onClick={handleSaveAction}
              disabled={!actionForm.title || actionForm.responsible_departments.length === 0}
              className="btn-primary"
            >
              Ekle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface ComponentAccordionProps {
  component: Component;
  expanded: boolean;
  onToggle: () => void;
  expandedStandards: Set<string>;
  onToggleStandard: (standardId: string) => void;
  onSave: (conditionId: string, data: any) => void;
  onAddAction: (condition: GeneralCondition) => void;
  saving: string | null;
  getStatusLabel: (status: string | null) => string;
  getStatusIcon: (status: string | null) => JSX.Element;
}

function ComponentAccordion({
  component,
  expanded,
  onToggle,
  expandedStandards,
  onToggleStandard,
  onSave,
  onAddAction,
  saving,
  getStatusLabel,
  getStatusIcon
}: ComponentAccordionProps) {
  const calculateCompliance = () => {
    let total = 0;
    let count = 0;
    component.standards.forEach(standard => {
      standard.conditions.forEach(condition => {
        if (condition.assessment?.compliance_score) {
          total += condition.assessment.compliance_score;
          count++;
        }
      });
    });
    return count > 0 ? (total / count) * 20 : 0;
  };

  const compliance = calculateCompliance();

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-semibold text-gray-900">
            {component.code}. {component.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Uyum: %{compliance.toFixed(0)}</span>
          <span className="text-xl">
            {compliance >= 80 ? '🟢' : compliance >= 60 ? '🟡' : '🔴'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          {component.standards.map((standard) => (
            <StandardAccordion
              key={standard.id}
              standard={standard}
              expanded={expandedStandards.has(standard.id)}
              onToggle={() => onToggleStandard(standard.id)}
              onSave={onSave}
              onAddAction={onAddAction}
              saving={saving}
              getStatusLabel={getStatusLabel}
              getStatusIcon={getStatusIcon}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StandardAccordionProps {
  standard: Standard;
  expanded: boolean;
  onToggle: () => void;
  onSave: (conditionId: string, data: any) => void;
  onAddAction: (condition: GeneralCondition) => void;
  saving: string | null;
  getStatusLabel: (status: string | null) => string;
  getStatusIcon: (status: string | null) => JSX.Element;
}

function StandardAccordion({
  standard,
  expanded,
  onToggle,
  onSave,
  onAddAction,
  saving,
  getStatusLabel,
  getStatusIcon
}: StandardAccordionProps) {
  const calculateCompliance = () => {
    let total = 0;
    let count = 0;
    standard.conditions.forEach(condition => {
      if (condition.assessment?.compliance_score) {
        total += condition.assessment.compliance_score;
        count++;
      }
    });
    return count > 0 ? (total / count) * 20 : 0;
  };

  const compliance = calculateCompliance();

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span className="font-medium text-gray-900 text-sm">
            {standard.code} - {standard.name}
          </span>
        </div>
        <span className="text-sm text-gray-600">Uyum: %{compliance.toFixed(0)}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4 bg-white">
          <div className="text-sm font-medium text-gray-700 mb-2">GENEL ŞARTLAR</div>
          {standard.conditions.map((condition) => (
            <ConditionForm
              key={condition.id}
              condition={condition}
              onSave={onSave}
              onAddAction={onAddAction}
              saving={saving}
              getStatusLabel={getStatusLabel}
              getStatusIcon={getStatusIcon}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ConditionFormProps {
  condition: GeneralCondition;
  onSave: (conditionId: string, data: any) => void;
  onAddAction: (condition: GeneralCondition) => void;
  saving: string | null;
  getStatusLabel: (status: string | null) => string;
  getStatusIcon: (status: string | null) => JSX.Element;
}

function ConditionForm({
  condition,
  onSave,
  onAddAction,
  saving,
  getStatusLabel,
  getStatusIcon
}: ConditionFormProps) {
  const [formData, setFormData] = useState({
    compliance_status: condition.assessment?.compliance_status || '',
    compliance_score: condition.assessment?.compliance_score || 0,
    current_situation: condition.assessment?.current_situation || ''
  });

  const handleSave = () => {
    onSave(condition.id, formData);
  };

  const needsAction = formData.compliance_status === 'NON_COMPLIANT' || formData.compliance_status === 'PARTIAL';
  const completedActions = condition.actions.filter(a => a.status === 'COMPLETED').length;

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
      <div className="flex items-start gap-3">
        <span className="font-medium text-gray-900 text-sm">{condition.code}</span>
        <p className="text-sm text-gray-700 flex-1">{condition.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Durum
          </label>
          <select
            value={formData.compliance_status}
            onChange={(e) => setFormData({ ...formData, compliance_status: e.target.value })}
            className="input-field text-sm"
          >
            <option value="">Seçiniz...</option>
            <option value="COMPLIANT">✅ Sağlanıyor</option>
            <option value="PARTIAL">🟡 Kısmen Sağlanıyor</option>
            <option value="NON_COMPLIANT">🔴 Sağlanmıyor</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Puan
          </label>
          <StarRating
            value={formData.compliance_score}
            onChange={(value) => setFormData({ ...formData, compliance_score: value })}
            size="sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Mevcut Durum Açıklaması
        </label>
        <textarea
          value={formData.current_situation}
          onChange={(e) => setFormData({ ...formData, current_situation: e.target.value })}
          rows={2}
          className="input-field text-sm"
          placeholder="Mevcut durumu açıklayınız..."
        />
      </div>

      {condition.actions.length > 0 && (
        <div className="text-xs text-gray-600">
          Eylemler: {condition.actions.length} tanımlı ({completedActions} tamamlandı, {condition.actions.length - completedActions} devam ediyor)
        </div>
      )}

      {needsAction && condition.actions.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
          <AlertTriangle className="w-4 h-4" />
          <span>Sağlanmıyor - Eylem tanımlanmalı</span>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t">
        {needsAction && (
          <button
            onClick={() => onAddAction(condition)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Eylem Ekle
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving === condition.id}
          className="btn-primary text-sm ml-auto flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving === condition.id ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
