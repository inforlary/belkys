import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { AlertTriangle, Save, X, Plus, Trash2, Info, Edit2 } from 'lucide-react';
import Modal from '../components/ui/Modal';

interface DepartmentImpact {
  department_id: string;
  department_name?: string;
  impact_level: number;
  impact_description: string;
  specific_measures: string;
}

interface RiskRelation {
  related_risk_id: string;
  related_risk_name?: string;
  relation_type: string;
  description: string;
}

export default function RiskRegisterNew() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [allRisks, setAllRisks] = useState<any[]>([]);

  const [showDepartmentImpactModal, setShowDepartmentImpactModal] = useState(false);
  const [showRiskRelationModal, setShowRiskRelationModal] = useState(false);
  const [editingImpactIndex, setEditingImpactIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category_ids: [] as string[],
    risk_source: '',
    risk_relation: '',
    control_level: '',
    owner_department_id: '',
    coordination_department_id: '',
    external_organization: '',
    external_contact: '',
    related_goal_id: '',
    related_activity_id: '',
    related_process_id: '',
    related_project_id: '',
    inherent_likelihood: 1,
    inherent_impact: 1,
    residual_likelihood: 1,
    residual_impact: 1,
    target_probability: 1,
    target_impact: 1,
    target_date: '',
    risk_response: 'MITIGATE',
    review_period: 'QUARTERLY',
    last_review_date: new Date().toISOString().split('T')[0],
  });

  const [departmentImpacts, setDepartmentImpacts] = useState<DepartmentImpact[]>([]);
  const [riskRelations, setRiskRelations] = useState<RiskRelation[]>([]);

  const [tempImpact, setTempImpact] = useState({
    department_id: '',
    impact_level: 3,
    impact_description: '',
    specific_measures: '',
  });

  const [tempRelation, setTempRelation] = useState({
    related_risk_id: '',
    relation_type: 'RELATED',
    description: '',
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
      generateCode();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    await Promise.all([
      loadCategories(),
      loadDepartments(),
      loadGoals(),
      loadActivities(),
      loadProcesses(),
      loadProjects(),
      loadAllRisks(),
    ]);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('risk_categories')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('code');
    if (data) setCategories(data);
  };

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('name');
    if (data) setDepartments(data);
  };

  const loadGoals = async () => {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('code');
    if (data) setGoals(data);
  };

  const loadActivities = async () => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('name');
    if (data) setActivities(data);
  };

  const loadProcesses = async () => {
    const { data } = await supabase
      .from('qm_processes')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('code');
    if (data) setProcesses(data);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('name');
    if (data) setProjects(data);
  };

  const filteredGoals = formData.owner_department_id
    ? goals.filter(g => g.department_id === formData.owner_department_id)
    : goals;

  const filteredActivities = formData.owner_department_id && formData.related_goal_id
    ? activities.filter(a =>
        a.department_id === formData.owner_department_id &&
        a.goal_id === formData.related_goal_id
      )
    : formData.owner_department_id
    ? activities.filter(a => a.department_id === formData.owner_department_id)
    : activities;

  const filteredProjects = formData.owner_department_id
    ? projects.filter(p => p.department_id === formData.owner_department_id)
    : projects;

  const loadAllRisks = async () => {
    const { data } = await supabase
      .from('risks')
      .select('id, code, name')
      .eq('organization_id', profile?.organization_id)
      .order('code');
    if (data) setAllRisks(data);
  };

  const generateCode = async () => {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select('code')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const lastCode = data[0].code;
        const match = lastCode.match(/RSK-(\d+)/);
        if (match) {
          const nextNumber = parseInt(match[1]) + 1;
          setFormData(prev => ({ ...prev, code: `RSK-${String(nextNumber).padStart(4, '0')}` }));
        }
      } else {
        setFormData(prev => ({ ...prev, code: 'RSK-0001' }));
      }
    } catch (error) {
      console.error('Error generating code:', error);
      setFormData(prev => ({ ...prev, code: 'RSK-0001' }));
    }
  };

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter(id => id !== categoryId)
        : [...prev.category_ids, categoryId]
    }));
  };

  const calculateNextReview = (lastReview: string, period: string) => {
    const date = new Date(lastReview);
    switch (period) {
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'QUARTERLY':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'SEMI_ANNUAL':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'ANNUAL':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString().split('T')[0];
  };

  const addDepartmentImpact = () => {
    if (!tempImpact.department_id) {
      alert('Lütfen bir birim seçin');
      return;
    }

    const dept = departments.find(d => d.id === tempImpact.department_id);
    const newImpact: DepartmentImpact = {
      ...tempImpact,
      department_name: dept?.name,
    };

    if (editingImpactIndex !== null) {
      const updated = [...departmentImpacts];
      updated[editingImpactIndex] = newImpact;
      setDepartmentImpacts(updated);
      setEditingImpactIndex(null);
    } else {
      setDepartmentImpacts([...departmentImpacts, newImpact]);
    }

    setTempImpact({
      department_id: '',
      impact_level: 3,
      impact_description: '',
      specific_measures: '',
    });
    setShowDepartmentImpactModal(false);
  };

  const editDepartmentImpact = (index: number) => {
    setTempImpact(departmentImpacts[index]);
    setEditingImpactIndex(index);
    setShowDepartmentImpactModal(true);
  };

  const removeDepartmentImpact = (index: number) => {
    setDepartmentImpacts(departmentImpacts.filter((_, i) => i !== index));
  };

  const addRiskRelation = () => {
    if (!tempRelation.related_risk_id) {
      alert('Lütfen bir risk seçin');
      return;
    }

    const risk = allRisks.find(r => r.id === tempRelation.related_risk_id);
    const newRelation: RiskRelation = {
      ...tempRelation,
      related_risk_name: risk ? `${risk.code} - ${risk.name}` : '',
    };

    setRiskRelations([...riskRelations, newRelation]);
    setTempRelation({
      related_risk_id: '',
      relation_type: 'RELATED',
      description: '',
    });
    setShowRiskRelationModal(false);
  };

  const removeRiskRelation = (index: number) => {
    setRiskRelations(riskRelations.filter((_, i) => i !== index));
  };

  const handleSubmit = async (submitForApproval: boolean = false) => {
    if (!formData.name || !formData.risk_source || !formData.risk_relation || !formData.control_level) {
      alert('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      const nextReviewDate = calculateNextReview(formData.last_review_date, formData.review_period);

      const riskData = {
        organization_id: profile?.organization_id,
        code: formData.code,
        name: formData.name,
        description: formData.description,
        risk_source: formData.risk_source,
        risk_relation: formData.risk_relation,
        control_level: formData.control_level,
        owner_department_id: formData.owner_department_id || null,
        coordination_department_id: formData.coordination_department_id || null,
        external_organization: formData.external_organization || null,
        external_contact: formData.external_contact || null,
        goal_id: formData.related_goal_id || null,
        related_activity_id: formData.related_activity_id || null,
        related_process_id: formData.related_process_id || null,
        related_project_id: formData.related_project_id || null,
        inherent_likelihood: formData.inherent_likelihood,
        inherent_impact: formData.inherent_impact,
        inherent_score: formData.inherent_likelihood * formData.inherent_impact,
        residual_likelihood: formData.residual_likelihood,
        residual_impact: formData.residual_impact,
        residual_score: formData.residual_likelihood * formData.residual_impact,
        target_probability: formData.target_probability,
        target_impact: formData.target_impact,
        target_score: formData.target_probability * formData.target_impact,
        target_date: formData.target_date || null,
        risk_response: formData.risk_response,
        review_period: formData.review_period,
        last_review_date: formData.last_review_date,
        next_review_date: nextReviewDate,
        status: submitForApproval ? 'PENDING_APPROVAL' : 'DRAFT',
        created_by: profile?.id,
      };

      const { data: risk, error: riskError } = await supabase
        .from('risks')
        .insert(riskData)
        .select()
        .single();

      if (riskError) throw riskError;

      if (formData.category_ids.length > 0) {
        const categoryMappings = formData.category_ids.map(catId => ({
          risk_id: risk.id,
          category_id: catId,
        }));

        const { error: categoryError } = await supabase
          .from('risk_category_mappings')
          .insert(categoryMappings);

        if (categoryError) throw categoryError;
      }

      if (departmentImpacts.length > 0) {
        const impacts = departmentImpacts.map(impact => ({
          risk_id: risk.id,
          department_id: impact.department_id,
          impact_level: impact.impact_level,
          impact_description: impact.impact_description,
          specific_measures: impact.specific_measures,
        }));

        const { error: impactsError } = await supabase
          .from('risk_department_impacts')
          .insert(impacts);

        if (impactsError) throw impactsError;
      }

      if (riskRelations.length > 0) {
        const relations = riskRelations.map(rel => ({
          risk_id: risk.id,
          related_risk_id: rel.related_risk_id,
          relation_type: rel.relation_type,
          description: rel.description,
        }));

        const { error: relationsError } = await supabase
          .from('risk_relations')
          .insert(relations);

        if (relationsError) throw relationsError;
      }

      alert(submitForApproval ? 'Risk onaya gönderildi' : 'Risk taslak olarak kaydedildi');
      navigate('/risk-management');
    } catch (error: any) {
      console.error('Error saving risk:', error);
      alert('Risk kaydedilirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const inherentScore = formData.inherent_likelihood * formData.inherent_impact;
  const residualScore = formData.residual_likelihood * formData.residual_impact;
  const targetScore = formData.target_probability * formData.target_impact;

  const getRiskLevel = (score: number) => {
    if (score >= 15) return { label: 'Kritik', color: 'text-red-700 bg-red-100' };
    if (score >= 10) return { label: 'Yüksek', color: 'text-orange-700 bg-orange-100' };
    if (score >= 6) return { label: 'Orta', color: 'text-yellow-700 bg-yellow-100' };
    if (score >= 3) return { label: 'Düşük', color: 'text-blue-700 bg-blue-100' };
    return { label: 'Çok Düşük', color: 'text-green-700 bg-green-100' };
  };

  const getImpactLevelLabel = (level: number) => {
    const labels = ['Etkilenmez', 'Minimal', 'Düşük', 'Orta', 'Yüksek', 'Kritik'];
    return labels[level] || '';
  };

  const getLevelColor = (level: number, isSelected: boolean) => {
    const colors = {
      1: {
        bg: isSelected ? 'bg-green-600' : 'bg-green-100',
        text: isSelected ? 'text-white' : 'text-green-700',
        border: 'border-green-300',
        hover: 'hover:bg-green-200'
      },
      2: {
        bg: isSelected ? 'bg-blue-600' : 'bg-blue-100',
        text: isSelected ? 'text-white' : 'text-blue-700',
        border: 'border-blue-300',
        hover: 'hover:bg-blue-200'
      },
      3: {
        bg: isSelected ? 'bg-yellow-600' : 'bg-yellow-100',
        text: isSelected ? 'text-white' : 'text-yellow-700',
        border: 'border-yellow-300',
        hover: 'hover:bg-yellow-200'
      },
      4: {
        bg: isSelected ? 'bg-orange-600' : 'bg-orange-100',
        text: isSelected ? 'text-white' : 'text-orange-700',
        border: 'border-orange-300',
        hover: 'hover:bg-orange-200'
      },
      5: {
        bg: isSelected ? 'bg-red-600' : 'bg-red-100',
        text: isSelected ? 'text-white' : 'text-red-700',
        border: 'border-red-300',
        hover: 'hover:bg-red-200'
      }
    };
    return colors[level as keyof typeof colors] || colors[3];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Yeni Risk Kaydı</h1>
            <p className="text-sm text-slate-600">Risk bilgilerini eksiksiz doldurun</p>
          </div>
        </div>
      </div>

      <form className="space-y-6">
        {/* BÖLÜM 1: TEMEL BİLGİLER */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">1. Temel Bilgiler</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Kodu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                disabled
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                placeholder="RSK-0001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kategoriler (Birden fazla seçilebilir)
              </label>
              <div className="border border-slate-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-2">Kategori bulunamadı</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50 border border-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={formData.category_ids.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900">{cat.code}</div>
                          <div className="text-xs text-slate-600">{cat.name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {formData.category_ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.category_ids.map(catId => {
                    const cat = categories.find(c => c.id === catId);
                    return cat ? (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {cat.code}
                        <button
                          type="button"
                          onClick={() => toggleCategory(catId)}
                          className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Risk adını girin..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Açıklaması
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Riskin detaylı açıklaması..."
              />
            </div>
          </div>
        </div>

        {/* BÖLÜM 2: RİSK SINIFLANDIRMASI */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">2. Risk Sınıflandırması</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Risk Kaynağı <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="INTERNAL"
                    checked={formData.risk_source === 'INTERNAL'}
                    onChange={(e) => setFormData({ ...formData, risk_source: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">İç Risk</div>
                    <div className="text-xs text-slate-600">Kurum içinden kaynaklanan</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="EXTERNAL"
                    checked={formData.risk_source === 'EXTERNAL'}
                    onChange={(e) => setFormData({ ...formData, risk_source: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Dış Risk</div>
                    <div className="text-xs text-slate-600">Kurum dışından kaynaklanan</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                İlişki Türü <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="STRATEGIC"
                    checked={formData.risk_relation === 'STRATEGIC'}
                    onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Stratejik</div>
                    <div className="text-xs text-slate-600">Hedefe veya faaliyete bağlı</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="OPERATIONAL"
                    checked={formData.risk_relation === 'OPERATIONAL'}
                    onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Operasyonel</div>
                    <div className="text-xs text-slate-600">Sürece bağlı</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="PROJECT"
                    checked={formData.risk_relation === 'PROJECT'}
                    onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Proje</div>
                    <div className="text-xs text-slate-600">Projeye bağlı</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="CORPORATE"
                    checked={formData.risk_relation === 'CORPORATE'}
                    onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Kurumsal</div>
                    <div className="text-xs text-slate-600">Tüm kurumu etkiler</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Kontrol Düzeyi <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="CONTROLLABLE"
                    checked={formData.control_level === 'CONTROLLABLE'}
                    onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Kontrol Edilebilir</div>
                    <div className="text-xs text-slate-600">Tamamen bizim kontrolümüzde</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="PARTIAL"
                    checked={formData.control_level === 'PARTIAL'}
                    onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Kısmen Kontrol Edilebilir</div>
                    <div className="text-xs text-slate-600">Etkiyi azaltabiliriz</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value="UNCONTROLLABLE"
                    checked={formData.control_level === 'UNCONTROLLABLE'}
                    onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">Kontrol Dışı</div>
                    <div className="text-xs text-slate-600">Sadece izleyebiliriz</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* BÖLÜM 3: SORUMLULUK (Dinamik) */}
        {formData.control_level && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">3. Sorumluluk</h3>

            {formData.control_level === 'CONTROLLABLE' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Risk Sahibi Birim <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-600 mb-2">Riski yönetmekten sorumlu birim</p>
                <select
                  value={formData.owner_department_id}
                  onChange={(e) => setFormData({ ...formData, owner_department_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seçiniz</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.control_level === 'PARTIAL' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Risk Sahibi Birim <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-600 mb-2">Etkiyi azaltmaktan sorumlu birim</p>
                  <select
                    value={formData.owner_department_id}
                    onChange={(e) => setFormData({ ...formData, owner_department_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seçiniz</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Koordinasyon Birimi <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-600 mb-2">Dış kurumla iletişimi sağlayacak birim</p>
                  <select
                    value={formData.coordination_department_id}
                    onChange={(e) => setFormData({ ...formData, coordination_department_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seçiniz</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Yetkili Dış Kurum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.external_organization}
                    onChange={(e) => setFormData({ ...formData, external_organization: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Dış kurum adı..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    İletişim Bilgisi
                  </label>
                  <input
                    type="text"
                    value={formData.external_contact}
                    onChange={(e) => setFormData({ ...formData, external_contact: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Telefon, e-posta vb."
                  />
                </div>
              </div>
            )}

            {formData.control_level === 'UNCONTROLLABLE' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Koordinasyon Birimi <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-600 mb-2">Riski izleyecek ve dış kurumla iletişim sağlayacak birim</p>
                  <select
                    value={formData.coordination_department_id}
                    onChange={(e) => setFormData({ ...formData, coordination_department_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seçiniz</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Yetkili Dış Kurum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.external_organization}
                    onChange={(e) => setFormData({ ...formData, external_organization: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Dış kurum adı..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    İletişim Bilgisi
                  </label>
                  <input
                    type="text"
                    value={formData.external_contact}
                    onChange={(e) => setFormData({ ...formData, external_contact: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Telefon, e-posta vb."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* BÖLÜM 4: İLİŞKİ BAĞLANTISI (Dinamik) */}
        {formData.risk_relation && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">4. İlişki Bağlantısı</h3>

            {formData.risk_relation === 'STRATEGIC' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bağlı Hedef <span className="text-red-500">*</span>
                  </label>
                  {!formData.owner_department_id ? (
                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      Önce Risk Sahibi Birim seçiniz
                    </p>
                  ) : filteredGoals.length === 0 ? (
                    <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      Seçili birime ait hedef bulunamadı
                    </p>
                  ) : (
                    <select
                      value={formData.related_goal_id}
                      onChange={(e) => setFormData({ ...formData, related_goal_id: e.target.value, related_activity_id: '' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seçiniz</option>
                      {filteredGoals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.code} - {goal.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bağlı Faaliyet
                  </label>
                  {!formData.related_goal_id ? (
                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      Önce Bağlı Hedef seçiniz
                    </p>
                  ) : filteredActivities.length === 0 ? (
                    <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      Seçili hedefe ait faaliyet bulunamadı
                    </p>
                  ) : (
                    <select
                      value={formData.related_activity_id}
                      onChange={(e) => setFormData({ ...formData, related_activity_id: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seçiniz</option>
                      {filteredActivities.map((act) => (
                        <option key={act.id} value={act.id}>
                          {act.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {formData.risk_relation === 'OPERATIONAL' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bağlı Süreç <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.related_process_id}
                  onChange={(e) => setFormData({ ...formData, related_process_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seçiniz</option>
                  {processes.map((proc) => (
                    <option key={proc.id} value={proc.id}>
                      {proc.code} - {proc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.risk_relation === 'PROJECT' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bağlı Proje <span className="text-red-500">*</span>
                </label>
                {!formData.owner_department_id ? (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Önce Risk Sahibi Birim seçiniz
                  </p>
                ) : filteredProjects.length === 0 ? (
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    Seçili birime ait proje bulunamadı
                  </p>
                ) : (
                  <select
                    value={formData.related_project_id}
                    onChange={(e) => setFormData({ ...formData, related_project_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seçiniz</option>
                    {filteredProjects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {formData.risk_relation === 'CORPORATE' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Kurumsal Risk</p>
                  <p>Bu risk tüm kurumu etkiler. Birim etki analizi bölümünden etkilenen birimleri belirleyebilirsiniz.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BÖLÜM 5: RİSK DEĞERLENDİRMESİ */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">5. Risk Değerlendirmesi</h3>

          <div className="grid grid-cols-3 gap-6">
            {/* Doğal Risk */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-slate-900 mb-3">Doğal Risk</h4>
              <p className="text-xs text-slate-600 mb-4">Kontrol önlemleri olmadan riskin durumu</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Olasılık</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const colors = getLevelColor(val, formData.inherent_likelihood === val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, inherent_likelihood: val })}
                          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors border ${colors.bg} ${colors.text} ${colors.border} ${!formData.inherent_likelihood || formData.inherent_likelihood !== val ? colors.hover : ''}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Etki</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const colors = getLevelColor(val, formData.inherent_impact === val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, inherent_impact: val })}
                          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors border ${colors.bg} ${colors.text} ${colors.border} ${!formData.inherent_impact || formData.inherent_impact !== val ? colors.hover : ''}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white rounded-lg border-2 border-blue-300">
                <div className="text-center">
                  <div className="text-xs text-slate-600 mb-1">SKOR</div>
                  <div className={`text-2xl font-bold ${getRiskLevel(inherentScore).color} px-3 py-1 rounded inline-block`}>
                    {inherentScore} - {getRiskLevel(inherentScore).label}
                  </div>
                </div>
              </div>
            </div>

            {/* Artık Risk */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-slate-900 mb-3">Artık Risk</h4>
              <p className="text-xs text-slate-600 mb-4">Mevcut kontroller sonrası riskin durumu</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Olasılık</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const colors = getLevelColor(val, formData.residual_likelihood === val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, residual_likelihood: val })}
                          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors border ${colors.bg} ${colors.text} ${colors.border} ${!formData.residual_likelihood || formData.residual_likelihood !== val ? colors.hover : ''}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Etki</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const colors = getLevelColor(val, formData.residual_impact === val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, residual_impact: val })}
                          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors border ${colors.bg} ${colors.text} ${colors.border} ${!formData.residual_impact || formData.residual_impact !== val ? colors.hover : ''}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white rounded-lg border-2 border-green-300">
                <div className="text-center">
                  <div className="text-xs text-slate-600 mb-1">SKOR</div>
                  <div className={`text-2xl font-bold ${getRiskLevel(residualScore).color} px-3 py-1 rounded inline-block`}>
                    {residualScore} - {getRiskLevel(residualScore).label}
                  </div>
                </div>
              </div>
            </div>

            {/* Hedef Risk */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-slate-900 mb-3">Hedef Risk</h4>
              <p className="text-xs text-slate-600 mb-4">İlave tedbirler sonrası hedeflenen risk</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Olasılık</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const colors = getLevelColor(val, formData.target_probability === val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, target_probability: val })}
                          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors border ${colors.bg} ${colors.text} ${colors.border} ${!formData.target_probability || formData.target_probability !== val ? colors.hover : ''}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Etki</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const colors = getLevelColor(val, formData.target_impact === val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, target_impact: val })}
                          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors border ${colors.bg} ${colors.text} ${colors.border} ${!formData.target_impact || formData.target_impact !== val ? colors.hover : ''}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white rounded-lg border-2 border-purple-300">
                <div className="text-center">
                  <div className="text-xs text-slate-600 mb-1">SKOR</div>
                  <div className={`text-2xl font-bold ${getRiskLevel(targetScore).color} px-3 py-1 rounded inline-block`}>
                    {targetScore} - {getRiskLevel(targetScore).label}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Hedef Tarih</label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Risk Yanıt Stratejisi
            </label>
            <select
              value={formData.risk_response}
              onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ACCEPT">Kabul Et</option>
              <option value="MITIGATE">Azalt</option>
              <option value="TRANSFER">Devret</option>
              <option value="AVOID">Kaçın</option>
            </select>
          </div>
        </div>

        {/* BÖLÜM 6: GÖZDEN GEÇİRME AYARLARI */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">6. Gözden Geçirme Ayarları</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Gözden Geçirme Periyodu
              </label>
              <select
                value={formData.review_period}
                onChange={(e) => setFormData({ ...formData, review_period: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="MONTHLY">Aylık</option>
                <option value="QUARTERLY">Çeyreklik</option>
                <option value="SEMI_ANNUAL">6 Aylık</option>
                <option value="ANNUAL">Yıllık</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Son Gözden Geçirme
              </label>
              <input
                type="date"
                value={formData.last_review_date}
                onChange={(e) => setFormData({ ...formData, last_review_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sonraki Gözden Geçirme
              </label>
              <input
                type="text"
                value={calculateNextReview(formData.last_review_date, formData.review_period)}
                disabled
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* BÖLÜM 7: BİRİM ETKİ ANALİZİ */}
        {formData.risk_relation === 'CORPORATE' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">7. Birim Etki Analizi</h3>
              <button
                type="button"
                onClick={() => setShowDepartmentImpactModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Birim Ekle
              </button>
            </div>

            {departmentImpacts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Birim</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Etki Seviyesi</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Açıklama</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentImpacts.map((impact, index) => (
                      <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">{impact.department_name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-3 py-1 text-xs font-medium rounded ${
                            impact.impact_level === 0 ? 'bg-gray-100 text-gray-700' :
                            impact.impact_level === 1 ? 'bg-blue-100 text-blue-700' :
                            impact.impact_level === 2 ? 'bg-green-100 text-green-700' :
                            impact.impact_level === 3 ? 'bg-yellow-100 text-yellow-700' :
                            impact.impact_level === 4 ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {impact.impact_level} - {getImpactLevelLabel(impact.impact_level)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{impact.impact_description}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editDepartmentImpact(index)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDepartmentImpact(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Info className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                <p>Henüz birim eklenmemiş</p>
              </div>
            )}
          </div>
        )}

        {/* BÖLÜM 8: İLİŞKİLİ RİSKLER */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">8. İlişkili Riskler</h3>
            <button
              type="button"
              onClick={() => setShowRiskRelationModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              İlişki Ekle
            </button>
          </div>

          {riskRelations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Risk</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">İlişki Türü</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {riskRelations.map((rel, index) => (
                    <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{rel.related_risk_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {rel.relation_type === 'TRIGGERS' && 'Bu risk şunu tetikler'}
                        {rel.relation_type === 'TRIGGERED_BY' && 'Bu risk şundan tetiklenir'}
                        {rel.relation_type === 'INCREASES' && 'Bu risk şunu artırır'}
                        {rel.relation_type === 'DECREASES' && 'Bu risk şunu azaltır'}
                        {rel.relation_type === 'RELATED' && 'İlişkili'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeRiskRelation(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Info className="w-12 h-12 mx-auto mb-2 text-slate-400" />
              <p>Henüz ilişkili risk eklenmemiş</p>
            </div>
          )}
        </div>

        {/* FORM ALTINDA BUTONLAR */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/risk-management')}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            İptal
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Kaydediliyor...' : 'Kaydet ve Onaya Gönder'}
          </button>
        </div>
      </form>

      {/* BİRİM ETKİ MODAL */}
      <Modal
        isOpen={showDepartmentImpactModal}
        onClose={() => {
          setShowDepartmentImpactModal(false);
          setEditingImpactIndex(null);
          setTempImpact({
            department_id: '',
            impact_level: 3,
            impact_description: '',
            specific_measures: '',
          });
        }}
        title={editingImpactIndex !== null ? 'Birim Etkisini Düzenle' : 'Birim Etkisi Ekle'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Birim <span className="text-red-500">*</span>
            </label>
            <select
              value={tempImpact.department_id}
              onChange={(e) => setTempImpact({ ...tempImpact, department_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Etki Seviyesi (0-5) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <label key={level} className="flex items-center gap-3 cursor-pointer p-3 rounded border border-slate-200 hover:bg-slate-50">
                  <input
                    type="radio"
                    value={level}
                    checked={tempImpact.impact_level === level}
                    onChange={(e) => setTempImpact({ ...tempImpact, impact_level: parseInt(e.target.value) })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-sm">{level} - {getImpactLevelLabel(level)}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Etki Açıklaması <span className="text-red-500">*</span>
            </label>
            <textarea
              value={tempImpact.impact_description}
              onChange={(e) => setTempImpact({ ...tempImpact, impact_description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Riskin birime etkisini açıklayın..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Birime Özel Önlemler
            </label>
            <textarea
              value={tempImpact.specific_measures}
              onChange={(e) => setTempImpact({ ...tempImpact, specific_measures: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Bu birim için alınacak özel önlemler..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowDepartmentImpactModal(false);
                setEditingImpactIndex(null);
                setTempImpact({
                  department_id: '',
                  impact_level: 3,
                  impact_description: '',
                  specific_measures: '',
                });
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={addDepartmentImpact}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editingImpactIndex !== null ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      </Modal>

      {/* RİSK İLİŞKİSİ MODAL */}
      <Modal
        isOpen={showRiskRelationModal}
        onClose={() => {
          setShowRiskRelationModal(false);
          setTempRelation({
            related_risk_id: '',
            relation_type: 'RELATED',
            description: '',
          });
        }}
        title="Risk İlişkisi Ekle"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              İlişkili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={tempRelation.related_risk_id}
              onChange={(e) => setTempRelation({ ...tempRelation, related_risk_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              {allRisks.map((risk) => (
                <option key={risk.id} value={risk.id}>
                  {risk.code} - {risk.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              İlişki Türü <span className="text-red-500">*</span>
            </label>
            <select
              value={tempRelation.relation_type}
              onChange={(e) => setTempRelation({ ...tempRelation, relation_type: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TRIGGERS">Bu risk şunu tetikler</option>
              <option value="TRIGGERED_BY">Bu risk şundan tetiklenir</option>
              <option value="INCREASES">Bu risk şunu artırır</option>
              <option value="DECREASES">Bu risk şunu azaltır</option>
              <option value="RELATED">İlişkili</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={tempRelation.description}
              onChange={(e) => setTempRelation({ ...tempRelation, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="İlişkinin detaylarını açıklayın..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowRiskRelationModal(false);
                setTempRelation({
                  related_risk_id: '',
                  relation_type: 'RELATED',
                  description: '',
                });
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={addRiskRelation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ekle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
