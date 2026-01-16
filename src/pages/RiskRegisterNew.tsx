import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { AlertTriangle, Save, X, Plus, Trash2, Info } from 'lucide-react';
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
    causes: '',
    consequences: '',
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
      .order('name');
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
      .order('name');
    if (data) setProcesses(data);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .eq('status', 'active')
      .order('name');
    if (data) setProjects(data);
  };

  const loadAllRisks = async () => {
    const { data } = await supabase
      .from('risks')
      .select('id, code, name')
      .eq('organization_id', profile?.organization_id)
      .order('code');
    if (data) setAllRisks(data);
  };

  const calculateNextReviewDate = (lastDate: string, period: string): string => {
    const date = new Date(lastDate);
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

  const getRiskScoreBadge = (score: number) => {
    if (score >= 15) return { label: 'Kritik', color: 'text-red-700 bg-red-100', emoji: '🔴' };
    if (score >= 10) return { label: 'Yüksek', color: 'text-orange-700 bg-orange-100', emoji: '🟠' };
    if (score >= 6) return { label: 'Orta', color: 'text-yellow-700 bg-yellow-100', emoji: '🟡' };
    if (score >= 3) return { label: 'Düşük', color: 'text-blue-700 bg-blue-100', emoji: '🔵' };
    return { label: 'Çok Düşük', color: 'text-green-700 bg-green-100', emoji: '🟢' };
  };

  const addDepartmentImpact = () => {
    if (!tempImpact.department_id) {
      alert('Lütfen bir birim seçin');
      return;
    }

    const dept = departments.find(d => d.id === tempImpact.department_id);
    const newImpact: DepartmentImpact = {
      ...tempImpact,
      department_name: dept?.name || '',
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

  const deleteDepartmentImpact = (index: number) => {
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

  const deleteRiskRelation = (index: number) => {
    setRiskRelations(riskRelations.filter((_, i) => i !== index));
  };

  const handleSubmit = async (sendForApproval: boolean = false) => {
    if (!formData.name) {
      alert('Risk adı zorunludur');
      return;
    }

    if (!formData.risk_source) {
      alert('Risk kaynağı seçiniz');
      return;
    }

    if (!formData.risk_relation) {
      alert('İlişki türü seçiniz');
      return;
    }

    if (!formData.control_level) {
      alert('Kontrol düzeyi seçiniz');
      return;
    }

    if (formData.control_level === 'CONTROLLABLE' && !formData.owner_department_id) {
      alert('Risk sahibi birim zorunludur');
      return;
    }

    if (formData.control_level === 'PARTIAL') {
      if (!formData.owner_department_id || !formData.coordination_department_id || !formData.external_organization) {
        alert('Kısmen kontrol edilebilir riskler için tüm alanlar zorunludur');
        return;
      }
    }

    if (formData.control_level === 'UNCONTROLLABLE') {
      if (!formData.coordination_department_id || !formData.external_organization) {
        alert('Kontrol dışı riskler için koordinasyon birimi ve dış kurum zorunludur');
        return;
      }
    }

    if (formData.risk_relation === 'STRATEGIC' && !formData.related_goal_id) {
      alert('Stratejik riskler için hedef seçimi zorunludur');
      return;
    }

    if (formData.risk_relation === 'OPERATIONAL' && !formData.related_process_id) {
      alert('Operasyonel riskler için süreç seçimi zorunludur');
      return;
    }

    if (formData.risk_relation === 'PROJECT' && !formData.related_project_id) {
      alert('Proje riskleri için proje seçimi zorunludur');
      return;
    }

    if (formData.category_ids.length === 0) {
      alert('En az bir kategori seçiniz');
      return;
    }

    setLoading(true);

    try {
      const nextReviewDate = calculateNextReviewDate(formData.last_review_date, formData.review_period);

      const riskData: any = {
        organization_id: profile?.organization_id,
        name: formData.name,
        description: formData.description || null,
        causes: formData.causes || null,
        consequences: formData.consequences || null,
        risk_source: formData.risk_source,
        risk_relation: formData.risk_relation,
        control_level: formData.control_level,
        owner_department_id: formData.owner_department_id || null,
        coordination_department_id: formData.coordination_department_id || null,
        external_organization: formData.external_organization || null,
        external_contact: formData.external_contact || null,
        related_goal_id: formData.related_goal_id || null,
        related_activity_id: formData.related_activity_id || null,
        related_process_id: formData.related_process_id || null,
        related_project_id: formData.related_project_id || null,
        inherent_likelihood: formData.inherent_likelihood,
        inherent_impact: formData.inherent_impact,
        residual_likelihood: formData.residual_likelihood,
        residual_impact: formData.residual_impact,
        target_probability: formData.target_probability,
        target_impact: formData.target_impact,
        target_date: formData.target_date || null,
        risk_response: formData.risk_response,
        review_period: formData.review_period,
        last_review_date: formData.last_review_date,
        next_review_date: nextReviewDate,
        approval_status: sendForApproval ? 'PENDING_APPROVAL' : 'DRAFT',
        identified_by_id: profile?.id,
        identified_date: new Date().toISOString().split('T')[0],
      };

      const { data: newRisk, error: riskError } = await supabase
        .from('risks')
        .insert([riskData])
        .select()
        .single();

      if (riskError) throw riskError;

      if (formData.category_ids.length > 0) {
        const categoryMappings = formData.category_ids.map(catId => ({
          risk_id: newRisk.id,
          category_id: catId,
        }));
        await supabase.from('risk_category_mappings').insert(categoryMappings);
      }

      if (departmentImpacts.length > 0 && formData.risk_relation === 'CORPORATE') {
        const impactData = departmentImpacts.map(impact => ({
          organization_id: profile?.organization_id,
          risk_id: newRisk.id,
          department_id: impact.department_id,
          impact_level: impact.impact_level,
          impact_description: impact.impact_description,
          affected_processes: null,
          specific_controls: impact.specific_measures,
        }));
        await supabase.from('rm_risk_department_impacts').insert(impactData);
      }

      if (riskRelations.length > 0) {
        const relationData = riskRelations.map(rel => ({
          organization_id: profile?.organization_id,
          source_risk_id: newRisk.id,
          target_risk_id: rel.related_risk_id,
          relation_type: rel.relation_type,
          description: rel.description || null,
          created_by: profile?.id,
        }));
        await supabase.from('rm_risk_relations').insert(relationData);
      }

      alert(sendForApproval ? 'Risk başarıyla kaydedildi ve onaya gönderildi!' : 'Risk taslak olarak kaydedildi!');
      navigate('/risk-management');
    } catch (error: any) {
      console.error('Error creating risk:', error);
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const inherentScore = formData.inherent_likelihood * formData.inherent_impact;
  const residualScore = formData.residual_likelihood * formData.residual_impact;
  const targetScore = formData.target_probability * formData.target_impact;

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                Yeni Risk Ekle
              </h1>
              <p className="text-sm text-slate-600 mt-1">Tüm alanları dikkatlice doldurun</p>
            </div>
            <button
              onClick={() => navigate('/risk-management')}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">1. Temel Bilgiler</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Risk Kodu
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Otomatik oluşturulacak veya manuel girebilirsiniz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Risk Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Risk adını giriniz"
                    required
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Risk Açıklaması
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Riskin detaylı açıklaması..."
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kategori <span className="text-red-500">*</span> (Birden fazla seçilebilir)
                </label>
                <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {categories.map(cat => (
                    <label key={cat.id} className="flex items-center space-x-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.category_ids.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, category_ids: [...formData.category_ids, cat.id] });
                          } else {
                            setFormData({ ...formData, category_ids: formData.category_ids.filter(id => id !== cat.id) });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{cat.code} - {cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">2. Risk Sınıflandırması</h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Risk Kaynağı <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="INTERNAL"
                        checked={formData.risk_source === 'INTERNAL'}
                        onChange={(e) => setFormData({ ...formData, risk_source: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🏠</span>
                        <div>
                          <div className="font-medium text-sm">İç Risk</div>
                          <div className="text-xs text-slate-600">Kurum içinden</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="EXTERNAL"
                        checked={formData.risk_source === 'EXTERNAL'}
                        onChange={(e) => setFormData({ ...formData, risk_source: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🌍</span>
                        <div>
                          <div className="font-medium text-sm">Dış Risk</div>
                          <div className="text-xs text-slate-600">Kurum dışından</div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    İlişki Türü <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="STRATEGIC"
                        checked={formData.risk_relation === 'STRATEGIC'}
                        onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🎯</span>
                        <div>
                          <div className="font-medium text-sm">Stratejik</div>
                          <div className="text-xs text-slate-600">Hedefe bağlı</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="OPERATIONAL"
                        checked={formData.risk_relation === 'OPERATIONAL'}
                        onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">⚙️</span>
                        <div>
                          <div className="font-medium text-sm">Operasyonel</div>
                          <div className="text-xs text-slate-600">Sürece bağlı</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="PROJECT"
                        checked={formData.risk_relation === 'PROJECT'}
                        onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">📋</span>
                        <div>
                          <div className="font-medium text-sm">Proje</div>
                          <div className="text-xs text-slate-600">Projeye bağlı</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="CORPORATE"
                        checked={formData.risk_relation === 'CORPORATE'}
                        onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🏛️</span>
                        <div>
                          <div className="font-medium text-sm">Kurumsal</div>
                          <div className="text-xs text-slate-600">Bağımsız</div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Kontrol Düzeyi <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="CONTROLLABLE"
                        checked={formData.control_level === 'CONTROLLABLE'}
                        onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">✅</span>
                        <div>
                          <div className="font-medium text-sm">Kontrol Edilebilir</div>
                          <div className="text-xs text-slate-600">Tamamen kontrol</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="PARTIAL"
                        checked={formData.control_level === 'PARTIAL'}
                        onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <div>
                          <div className="font-medium text-sm">Kısmen Kontrol</div>
                          <div className="text-xs text-slate-600">Etki azaltılabilir</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                      <input
                        type="radio"
                        value="UNCONTROLLABLE"
                        checked={formData.control_level === 'UNCONTROLLABLE'}
                        onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-2">
                        <span className="text-lg">❌</span>
                        <div>
                          <div className="font-medium text-sm">Kontrol Dışı</div>
                          <div className="text-xs text-slate-600">Sadece izleme</div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {formData.control_level && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">3. Sorumluluk</h3>

                {formData.control_level === 'CONTROLLABLE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Risk Sahibi Birim <span className="text-red-500">*</span>
                    </label>
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
                    <p className="text-xs text-slate-500 mt-1">Riski yönetmekten sorumlu birim</p>
                  </div>
                )}

                {formData.control_level === 'PARTIAL' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Risk Sahibi Birim <span className="text-red-500">*</span>
                      </label>
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
                      <p className="text-xs text-slate-500 mt-1">Etkiyi azaltmaktan sorumlu birim</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Koordinasyon Birimi <span className="text-red-500">*</span>
                      </label>
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
                      <p className="text-xs text-slate-500 mt-1">Dış kurumla iletişimi sağlayacak birim</p>
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
                        placeholder="Telefon, email vb."
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
                      <p className="text-xs text-slate-500 mt-1">Riski izleyecek ve dış kurumla iletişim sağlayacak birim</p>
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
                        placeholder="Telefon, email vb."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.risk_relation && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">4. İlişki Bağlantısı</h3>

                {formData.risk_relation === 'STRATEGIC' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Bağlı Hedef <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.related_goal_id}
                        onChange={(e) => setFormData({ ...formData, related_goal_id: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Seçiniz</option>
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.code} - {goal.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Bağlı Faaliyet (Opsiyonel)
                      </label>
                      <select
                        value={formData.related_activity_id}
                        onChange={(e) => setFormData({ ...formData, related_activity_id: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Seçiniz (Opsiyonel)</option>
                        {activities
                          .filter(act => !formData.related_goal_id || act.goal_id === formData.related_goal_id)
                          .map((act) => (
                            <option key={act.id} value={act.id}>
                              {act.name}
                            </option>
                          ))}
                      </select>
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
                    <select
                      value={formData.related_project_id}
                      onChange={(e) => setFormData({ ...formData, related_project_id: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seçiniz</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.code} - {proj.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.risk_relation === 'CORPORATE' && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Kurumsal Risk</p>
                      <p>Bu risk tüm kurumu etkiler. Birim etki analizi bölümünden etkilenen birimleri belirleyebilirsiniz.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">5. Risk Değerlendirmesi</h3>

              <div className="space-y-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="text-md font-semibold text-slate-900 mb-2">Doğal Risk (Inherent Risk)</h4>
                  <p className="text-sm text-slate-600 mb-4">Herhangi bir kontrol olmadan riskin değerlendirilmesi</p>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Olasılık <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(level => (
                          <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                            <input
                              type="radio"
                              name="inherent_likelihood"
                              value={level}
                              checked={formData.inherent_likelihood === level}
                              onChange={(e) => setFormData({ ...formData, inherent_likelihood: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Etki <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(level => (
                          <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                            <input
                              type="radio"
                              name="inherent_impact"
                              value={level}
                              checked={formData.inherent_impact === level}
                              onChange={(e) => setFormData({ ...formData, inherent_impact: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-300">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">DOĞAL RİSK SKORU:</span>
                      <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(inherentScore).color} px-4 py-2 rounded-lg`}>
                        <span>{getRiskScoreBadge(inherentScore).emoji}</span>
                        <span>{inherentScore}</span>
                        <span className="text-sm">({getRiskScoreBadge(inherentScore).label})</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-6">
                  <h4 className="text-md font-semibold text-slate-900 mb-2">Artık Risk (Residual Risk)</h4>
                  <p className="text-sm text-slate-600 mb-4">Mevcut kontroller uygulandıktan sonra kalan risk</p>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Olasılık <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(level => (
                          <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                            <input
                              type="radio"
                              name="residual_likelihood"
                              value={level}
                              checked={formData.residual_likelihood === level}
                              onChange={(e) => setFormData({ ...formData, residual_likelihood: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Etki <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(level => (
                          <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                            <input
                              type="radio"
                              name="residual_impact"
                              value={level}
                              checked={formData.residual_impact === level}
                              onChange={(e) => setFormData({ ...formData, residual_impact: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-300">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">ARTIK RİSK SKORU:</span>
                      <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(residualScore).color} px-4 py-2 rounded-lg`}>
                        <span>{getRiskScoreBadge(residualScore).emoji}</span>
                        <span>{residualScore}</span>
                        <span className="text-sm">({getRiskScoreBadge(residualScore).label})</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-6">
                  <h4 className="text-md font-semibold text-slate-900 mb-2">Hedef Risk (Target Risk)</h4>
                  <p className="text-sm text-slate-600 mb-4">Ulaşmak istediğimiz risk seviyesi</p>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Olasılık <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(level => (
                          <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-purple-100">
                            <input
                              type="radio"
                              name="target_probability"
                              value={level}
                              checked={formData.target_probability === level}
                              onChange={(e) => setFormData({ ...formData, target_probability: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Etki <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(level => (
                          <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-purple-100">
                            <input
                              type="radio"
                              name="target_impact"
                              value={level}
                              checked={formData.target_impact === level}
                              onChange={(e) => setFormData({ ...formData, target_impact: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg border-2 border-purple-300">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">HEDEF RİSK SKORU:</span>
                        <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(targetScore).color} px-4 py-2 rounded-lg`}>
                          <span>{getRiskScoreBadge(targetScore).emoji}</span>
                          <span>{targetScore}</span>
                          <span className="text-sm">({getRiskScoreBadge(targetScore).label})</span>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Hedef Tarih
                      </label>
                      <input
                        type="date"
                        value={formData.target_date}
                        onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Risk Yanıt Stratejisi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.risk_response}
                    onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="ACCEPT">Kabul Et - Riski olduğu gibi kabul et</option>
                    <option value="MITIGATE">Azalt - Risk etkisini veya olasılığını azalt</option>
                    <option value="TRANSFER">Devret - Riski üçüncü tarafa aktar (sigorta vb.)</option>
                    <option value="AVOID">Kaçın - Riske neden olan faaliyetten kaçın</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">6. Gözden Geçirme Ayarları</h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gözden Geçirme Periyodu <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.review_period}
                    onChange={(e) => setFormData({ ...formData, review_period: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="MONTHLY">Aylık</option>
                    <option value="QUARTERLY">Çeyreklik (3 Ay)</option>
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
                    value={calculateNextReviewDate(formData.last_review_date, formData.review_period)}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
              </div>
            </div>

            {formData.risk_relation === 'CORPORATE' && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">7. Birim Etki Analizi</h3>
                  <button
                    onClick={() => {
                      setTempImpact({ department_id: '', impact_level: 3, impact_description: '', specific_measures: '' });
                      setEditingImpactIndex(null);
                      setShowDepartmentImpactModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Birim Ekle
                  </button>
                </div>

                {departmentImpacts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Birim</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Etki</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Açıklama</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {departmentImpacts.map((impact, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm text-slate-900">{impact.department_name}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                                impact.impact_level === 0 ? 'bg-gray-100 text-gray-800' :
                                impact.impact_level === 1 ? 'bg-blue-100 text-blue-800' :
                                impact.impact_level === 2 ? 'bg-green-100 text-green-800' :
                                impact.impact_level === 3 ? 'bg-yellow-100 text-yellow-800' :
                                impact.impact_level === 4 ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {impact.impact_level} - {['Etkilenmez', 'Minimal', 'Düşük', 'Orta', 'Yüksek', 'Kritik'][impact.impact_level]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{impact.impact_description}</td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => editDepartmentImpact(index)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => deleteDepartmentImpact(index)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                Sil
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    Henüz birim etkisi eklenmemiş. "Birim Ekle" butonuna tıklayarak başlayın.
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">8. İlişkili Riskler (Opsiyonel)</h3>
                <button
                  onClick={() => {
                    setTempRelation({ related_risk_id: '', relation_type: 'RELATED', description: '' });
                    setShowRiskRelationModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  İlişki Ekle
                </button>
              </div>

              {riskRelations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Risk</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">İlişki Türü</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {riskRelations.map((rel, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900">{rel.related_risk_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {rel.relation_type === 'TRIGGERS' && '→ Bu risk şunu tetikler'}
                            {rel.relation_type === 'TRIGGERED_BY' && '← Bu risk şundan tetiklenir'}
                            {rel.relation_type === 'INCREASES' && '↑ Bu risk şunu artırır'}
                            {rel.relation_type === 'DECREASES' && '↓ Bu risk şunu azaltır'}
                            {rel.relation_type === 'RELATED' && '↔ İlişkili'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteRiskRelation(index)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Henüz ilişkili risk eklenmemiş.
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={() => navigate('/risk-management')}
              className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              disabled={loading}
            >
              İptal
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Taslak Olarak Kaydet
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Kaydet ve Onaya Gönder
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDepartmentImpactModal}
        onClose={() => {
          setShowDepartmentImpactModal(false);
          setEditingImpactIndex(null);
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              Etki Seviyesi (0-5) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map(level => (
                <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-slate-50 border border-slate-200">
                  <input
                    type="radio"
                    name="impact_level"
                    value={level}
                    checked={tempImpact.impact_level === level}
                    onChange={(e) => setTempImpact({ ...tempImpact, impact_level: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">{level} - {['Etkilenmez', 'Minimal', 'Düşük', 'Orta', 'Yüksek', 'Kritik'][level]}</div>
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Bu riskin birime olan etkisini açıklayın..."
              required
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Bu birim için alınacak özel önlemleri belirtin (opsiyonel)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setShowDepartmentImpactModal(false);
                setEditingImpactIndex(null);
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              onClick={addDepartmentImpact}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingImpactIndex !== null ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRiskRelationModal}
        onClose={() => setShowRiskRelationModal(false)}
        title="İlişkili Risk Ekle"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              İlişkili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={tempRelation.related_risk_id}
              onChange={(e) => setTempRelation({ ...tempRelation, related_risk_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="İlişkinin açıklaması (opsiyonel)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowRiskRelationModal(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              onClick={addRiskRelation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ekle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
