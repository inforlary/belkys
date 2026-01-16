import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { AlertTriangle, Save, X, Plus, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';

interface DepartmentImpact {
  department_id: string;
  department_name: string;
  impact_level: number;
  impact_description: string;
  specific_measures: string;
}

interface RiskRelation {
  related_risk_id: string;
  related_risk_name: string;
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
    name: '',
    description: '',
    category_ids: [] as string[],
    risk_source: 'INTERNAL',
    risk_relation: 'OPERATIONAL',
    control_level: 'CONTROLLABLE',
    owner_department_id: '',
    coordination_department_id: '',
    external_authority_name: '',
    external_contact_info: '',
    related_goal_id: '',
    related_activity_id: '',
    related_process_id: '',
    related_project_id: '',
    inherent_likelihood: 3,
    inherent_impact: 3,
    residual_likelihood: 2,
    residual_impact: 2,
    target_likelihood: 1,
    target_impact: 1,
    target_date: '',
    risk_response: 'REDUCE',
    review_period: 'QUARTERLY',
    last_review_date: new Date().toISOString().split('T')[0],
    next_review_date: '',
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
      loadCategories();
      loadDepartments();
      loadGoals();
      loadActivities();
      loadProcesses();
      loadProjects();
      loadAllRisks();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (formData.review_period && formData.last_review_date) {
      const lastDate = new Date(formData.last_review_date);
      let nextDate: Date;

      switch (formData.review_period) {
        case 'MONTHLY':
          nextDate = new Date(lastDate);
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          nextDate = new Date(lastDate);
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'SEMI_ANNUAL':
          nextDate = new Date(lastDate);
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case 'ANNUAL':
          nextDate = new Date(lastDate);
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
          return;
      }

      setFormData((prev) => ({
        ...prev,
        next_review_date: nextDate.toISOString().split('T')[0],
      }));
    }
  }, [formData.review_period, formData.last_review_date]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('risk_categories')
        .select('id, code, name, type')
        .or(`organization_id.is.null,organization_id.eq.${profile?.organization_id}`)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error);
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
      console.error('Birimler yüklenirken hata:', error);
    }
  };

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('id, title, code')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Hedefler yüklenirken hata:', error);
    }
  };

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('id, name, code')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Faaliyetler yüklenirken hata:', error);
    }
  };

  const loadProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from('qm_processes')
        .select('id, name, code')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setProcesses(data || []);
    } catch (error) {
      console.error('Süreçler yüklenirken hata:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, code, name, status')
        .eq('organization_id', profile?.organization_id)
        .in('status', ['PLANNED', 'IN_PROGRESS', 'ON_HOLD'])
        .order('code');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Projeler yüklenirken hata:', error);
    }
  };

  const loadAllRisks = async () => {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select('id, code, name')
        .eq('organization_id', profile?.organization_id)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setAllRisks(data || []);
    } catch (error) {
      console.error('Riskler yüklenirken hata:', error);
    }
  };

  const inherentScore = formData.inherent_likelihood * formData.inherent_impact;
  const residualScore = formData.residual_likelihood * formData.residual_impact;
  const targetScore = formData.target_likelihood * formData.target_impact;

  const getRiskLevel = (score: number) => {
    if (score >= 20) return 'CRITICAL';
    if (score >= 15) return 'HIGH';
    if (score >= 9) return 'MEDIUM';
    return 'LOW';
  };

  const getRiskLevelColor = (score: number) => {
    if (score >= 20) return 'text-red-600 font-bold';
    if (score >= 15) return 'text-orange-600 font-bold';
    if (score >= 9) return 'text-yellow-600 font-bold';
    return 'text-green-600 font-bold';
  };

  const getRiskLevelLabel = (score: number) => {
    if (score >= 20) return 'Kritik';
    if (score >= 15) return 'Yüksek';
    if (score >= 9) return 'Orta';
    return 'Düşük';
  };

  const addDepartmentImpact = () => {
    if (!tempImpact.department_id) {
      alert('Lütfen birim seçiniz!');
      return;
    }

    const department = departments.find(d => d.id === tempImpact.department_id);
    if (!department) return;

    if (editingImpactIndex !== null) {
      const updated = [...departmentImpacts];
      updated[editingImpactIndex] = {
        ...tempImpact,
        department_name: department.name,
      };
      setDepartmentImpacts(updated);
      setEditingImpactIndex(null);
    } else {
      if (departmentImpacts.find(di => di.department_id === tempImpact.department_id)) {
        alert('Bu birim zaten eklenmiş!');
        return;
      }
      setDepartmentImpacts([...departmentImpacts, {
        ...tempImpact,
        department_name: department.name,
      }]);
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
      alert('Lütfen ilişkili risk seçiniz!');
      return;
    }

    const risk = allRisks.find(r => r.id === tempRelation.related_risk_id);
    if (!risk) return;

    if (riskRelations.find(rr => rr.related_risk_id === tempRelation.related_risk_id)) {
      alert('Bu risk zaten eklenmiş!');
      return;
    }

    setRiskRelations([...riskRelations, {
      ...tempRelation,
      related_risk_name: `${risk.code} - ${risk.name}`,
    }]);

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

  const saveRisk = async (approvalStatus: string = 'DRAFT') => {
    if (!formData.name) {
      alert('Lütfen risk adını giriniz!');
      return null;
    }

    if (formData.category_ids.length === 0) {
      alert('En az bir risk kategorisi seçmelisiniz!');
      return null;
    }

    if (formData.risk_relation === 'PROJECT' && !formData.related_project_id) {
      alert('Proje ilişkisi için bağlı proje seçmelisiniz!');
      return null;
    }

    if (formData.risk_relation === 'STRATEGIC' && !formData.related_goal_id) {
      alert('Stratejik ilişki için bağlı hedef seçmelisiniz!');
      return null;
    }

    if (formData.risk_relation === 'OPERATIONAL' && !formData.related_process_id) {
      alert('Operasyonel ilişki için bağlı süreç seçmelisiniz!');
      return null;
    }

    if (formData.control_level === 'CONTROLLABLE' && !formData.owner_department_id) {
      alert('Risk sahibi birim seçmelisiniz!');
      return null;
    }

    if (formData.control_level === 'PARTIALLY_CONTROLLABLE' && (!formData.owner_department_id || !formData.coordination_department_id || !formData.external_authority_name)) {
      alert('Kısmen kontrol edilebilir risk için tüm zorunlu alanları doldurunuz!');
      return null;
    }

    if (formData.control_level === 'UNCONTROLLABLE' && (!formData.coordination_department_id || !formData.external_authority_name)) {
      alert('Kontrol dışı risk için koordinasyon birimi ve yetkili dış kurum bilgisi gereklidir!');
      return null;
    }

    setLoading(true);
    try {
      const { data: riskData, error: riskError } = await supabase
        .from('risks')
        .insert({
          organization_id: profile?.organization_id,
          name: formData.name,
          description: formData.description,
          risk_source: formData.risk_source,
          risk_relation: formData.risk_relation,
          control_level: formData.control_level,
          owner_department_id: formData.owner_department_id || null,
          coordination_department_id: formData.coordination_department_id || null,
          external_authority_name: formData.external_authority_name || null,
          external_contact_info: formData.external_contact_info || null,
          related_goal_id: formData.risk_relation === 'STRATEGIC' ? formData.related_goal_id || null : null,
          related_activity_id: formData.risk_relation === 'STRATEGIC' ? formData.related_activity_id || null : null,
          related_process_id: formData.risk_relation === 'OPERATIONAL' ? formData.related_process_id || null : null,
          related_project_id: formData.risk_relation === 'PROJECT' ? formData.related_project_id || null : null,
          inherent_likelihood: formData.inherent_likelihood,
          inherent_impact: formData.inherent_impact,
          residual_likelihood: formData.residual_likelihood,
          residual_impact: formData.residual_impact,
          target_likelihood: formData.target_likelihood,
          target_impact: formData.target_impact,
          target_date: formData.target_date || null,
          risk_level: getRiskLevel(residualScore),
          risk_response: formData.risk_response,
          status: 'ACTIVE',
          approval_status: approvalStatus,
          is_active: true,
          identified_date: new Date().toISOString().split('T')[0],
          identified_by_id: profile?.id,
          review_period: formData.review_period || null,
          last_review_date: formData.last_review_date || null,
          next_review_date: formData.next_review_date || null,
        })
        .select()
        .single();

      if (riskError) throw riskError;

      const categoryMappings = formData.category_ids.map(categoryId => ({
        risk_id: riskData.id,
        category_id: categoryId
      }));

      const { error: mappingError } = await supabase
        .from('risk_category_mappings')
        .insert(categoryMappings);

      if (mappingError) throw mappingError;

      if (departmentImpacts.length > 0) {
        const impactData = departmentImpacts.map(impact => ({
          risk_id: riskData.id,
          department_id: impact.department_id,
          impact_level: impact.impact_level,
          impact_description: impact.impact_description,
          specific_measures: impact.specific_measures,
        }));

        const { error: impactError } = await supabase
          .from('risk_department_impacts')
          .insert(impactData);

        if (impactError) throw impactError;
      }

      if (riskRelations.length > 0) {
        const relationData = riskRelations.map(relation => ({
          source_risk_id: riskData.id,
          related_risk_id: relation.related_risk_id,
          relation_type: relation.relation_type,
          description: relation.description,
        }));

        const { error: relationError } = await supabase
          .from('risk_relations')
          .insert(relationData);

        if (relationError) throw relationError;
      }

      return riskData;
    } catch (error) {
      console.error('Risk kaydedilirken hata:', error);
      alert('Risk kaydedilemedi!');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await saveRisk('DRAFT');
    if (result) {
      alert('Risk taslak olarak kaydedildi!');
      navigate('risks/register');
    }
  };

  const handleSubmitAndSendToApproval = async (e: React.MouseEvent) => {
    e.preventDefault();
    const result = await saveRisk('PENDING_APPROVAL');
    if (result) {
      alert('Risk başarıyla kaydedildi ve onaya gönderildi!');
      navigate('risks/register');
    }
  };

  const impactLevelLabels = ['Etkilenmez', 'Minimal', 'Düşük', 'Orta', 'Yüksek', 'Kritik'];
  const relationTypeLabels: Record<string, string> = {
    'TRIGGERS': 'Bu risk şunu tetikler',
    'TRIGGERED_BY': 'Bu risk şundan tetiklenir',
    'INCREASES': 'Bu risk şunu artırır',
    'DECREASES': 'Bu risk şunu azaltır',
    'RELATED': 'İlişkili'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            Yeni Risk Ekle
          </h1>
          <p className="text-slate-600 mt-2">Risk kaydı oluşturun</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">1. Temel Bilgiler</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Kodu
              </label>
              <div className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                Otomatik oluşturulacak
              </div>
              <p className="text-xs text-slate-500 mt-1">Risk kodu kayıt sırasında otomatik olarak atanacaktır</p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Açıklaması
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kategori <span className="text-red-500">*</span> (Birden fazla seçilebilir)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border border-slate-300 rounded-lg p-4">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.category_ids.includes(category.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            category_ids: [...prev.category_ids, category.id]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            category_ids: prev.category_ids.filter(id => id !== category.id)
                          }));
                        }
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">
                      {category.code} - {category.name}
                    </span>
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
                    value={formData.external_authority_name}
                    onChange={(e) => setFormData({ ...formData, external_authority_name: e.target.value })}
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
                    value={formData.external_contact_info}
                    onChange={(e) => setFormData({ ...formData, external_contact_info: e.target.value })}
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
                    value={formData.external_authority_name}
                    onChange={(e) => setFormData({ ...formData, external_authority_name: e.target.value })}
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
                    value={formData.external_contact_info}
                    onChange={(e) => setFormData({ ...formData, external_contact_info: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Telefon, email vb."
                  />
                </div>
              </div>
            )}
          </div>

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
                    <option value="">Seçiniz</option>
                    {activities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.code} - {activity.name}
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
                  {processes.map((process) => (
                    <option key={process.id} value={process.id}>
                      {process.code} - {process.name}
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
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.risk_relation === 'CORPORATE' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Bu risk tüm kurumu etkiler. Birim etki analizi bölümünden etkilenen birimleri belirleyebilirsiniz.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">5. Risk Değerlendirmesi</h3>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Doğal Risk</h4>
                <p className="text-sm text-slate-600 mb-4">Kontrol önlemleri olmadan riskin değerlendirmesi</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Olasılık (1-5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.inherent_likelihood}
                      onChange={(e) => setFormData({ ...formData, inherent_likelihood: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Çok Düşük</span>
                      <span className="font-semibold text-blue-600 text-lg">{formData.inherent_likelihood}</span>
                      <span>Çok Yüksek</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Etki (1-5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.inherent_impact}
                      onChange={(e) => setFormData({ ...formData, inherent_impact: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Çok Düşük</span>
                      <span className="font-semibold text-blue-600 text-lg">{formData.inherent_impact}</span>
                      <span>Çok Yüksek</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Doğal Risk Skoru:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-slate-900">{inherentScore}</span>
                      <span className={`text-sm ${getRiskLevelColor(inherentScore)}`}>
                        ({getRiskLevelLabel(inherentScore)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-900 mb-3">Artık Risk</h4>
                <p className="text-sm text-slate-600 mb-4">Kontrol önlemleri uygulandıktan sonra kalan risk</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Olasılık (1-5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.residual_likelihood}
                      onChange={(e) => setFormData({ ...formData, residual_likelihood: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Çok Düşük</span>
                      <span className="font-semibold text-blue-600 text-lg">{formData.residual_likelihood}</span>
                      <span>Çok Yüksek</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Etki (1-5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.residual_impact}
                      onChange={(e) => setFormData({ ...formData, residual_impact: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Çok Düşük</span>
                      <span className="font-semibold text-blue-600 text-lg">{formData.residual_impact}</span>
                      <span>Çok Yüksek</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Artık Risk Skoru:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-slate-900">{residualScore}</span>
                      <span className={`text-sm ${getRiskLevelColor(residualScore)}`}>
                        ({getRiskLevelLabel(residualScore)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-900 mb-3">Hedef Risk</h4>
                <p className="text-sm text-slate-600 mb-4">Ulaşmak istediğiniz risk seviyesi</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Olasılık (1-5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.target_likelihood}
                      onChange={(e) => setFormData({ ...formData, target_likelihood: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Çok Düşük</span>
                      <span className="font-semibold text-blue-600 text-lg">{formData.target_likelihood}</span>
                      <span>Çok Yüksek</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Etki (1-5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.target_impact}
                      onChange={(e) => setFormData({ ...formData, target_impact: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1">
                      <span>Çok Düşük</span>
                      <span className="font-semibold text-blue-600 text-lg">{formData.target_impact}</span>
                      <span>Çok Yüksek</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Hedef Risk Skoru:</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-slate-900">{targetScore}</span>
                        <span className={`text-sm ${getRiskLevelColor(targetScore)}`}>
                          ({getRiskLevelLabel(targetScore)})
                        </span>
                      </div>
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
                  Risk Yanıt Stratejisi
                </label>
                <select
                  value={formData.risk_response}
                  onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ACCEPT">Kabul Et</option>
                  <option value="REDUCE">Azalt</option>
                  <option value="TRANSFER">Devret</option>
                  <option value="AVOID">Kaçın</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">6. Gözden Geçirme Ayarları</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <option value="QUARTERLY">Çeyreklik (3 ay)</option>
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
                  type="date"
                  value={formData.next_review_date}
                  onChange={(e) => setFormData({ ...formData, next_review_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                  readOnly
                />
                <p className="text-xs text-slate-500 mt-1">Otomatik hesaplanır</p>
              </div>
            </div>
          </div>

          {formData.risk_relation === 'CORPORATE' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">7. Birim Etki Analizi</h3>
                <button
                  type="button"
                  onClick={() => setShowDepartmentImpactModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Birim Ekle
                </button>
              </div>

              {departmentImpacts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birim</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etki</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Açıklama</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {departmentImpacts.map((impact, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">{impact.department_name}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              impact.impact_level === 0 ? 'bg-gray-100 text-gray-800' :
                              impact.impact_level === 1 ? 'bg-blue-100 text-blue-800' :
                              impact.impact_level === 2 ? 'bg-green-100 text-green-800' :
                              impact.impact_level === 3 ? 'bg-yellow-100 text-yellow-800' :
                              impact.impact_level === 4 ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {impact.impact_level} - {impactLevelLabels[impact.impact_level]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{impact.impact_description || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => editDepartmentImpact(index)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDepartmentImpact(index)}
                                className="text-red-600 hover:text-red-800"
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
                <p className="text-sm text-slate-500 text-center py-8">Henüz birim eklenmedi</p>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">8. İlişkili Riskler (Opsiyonel)</h3>
              <button
                type="button"
                onClick={() => setShowRiskRelationModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                İlişki Ekle
              </button>
            </div>

            {riskRelations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlişki Türü</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {riskRelations.map((relation, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">{relation.related_risk_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{relationTypeLabels[relation.relation_type]}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            type="button"
                            onClick={() => deleteRiskRelation(index)}
                            className="text-red-600 hover:text-red-800"
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
              <p className="text-sm text-slate-500 text-center py-8">Henüz ilişki eklenmedi</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('risks/register')}
              className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={handleSubmitAndSendToApproval}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <AlertTriangle className="w-5 h-5" />
              {loading ? 'Kaydediliyor...' : 'Kaydet ve Onaya Gönder'}
            </button>
          </div>
        </div>
      </form>

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
        title={editingImpactIndex !== null ? 'Birim Etkisini Düzenle' : 'Birim Ekle'}
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
              disabled={editingImpactIndex !== null}
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
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Etki Seviyesi <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={level}
                    checked={tempImpact.impact_level === level}
                    onChange={() => setTempImpact({ ...tempImpact, impact_level: level })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">
                    {level} - {impactLevelLabels[level]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Etki Açıklaması
            </label>
            <textarea
              value={tempImpact.impact_description}
              onChange={(e) => setTempImpact({ ...tempImpact, impact_description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
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
              className="flex-1 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={addDepartmentImpact}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editingImpactIndex !== null ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      </Modal>

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
        title="İlişki Ekle"
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
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
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
              className="flex-1 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={addRiskRelation}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ekle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
