import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Plus, Search, X, Save, AlertTriangle, Trash2, Edit2, Eye, MoreVertical } from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
  description: string;
  causes: string;
  category_id: string;
  owner_department_id: string;
  goal_id: string;
  risk_source: string;
  risk_relation: string;
  control_level: string;
  related_goal_id: string | null;
  related_activity_id: string | null;
  related_process_id: string | null;
  related_project_id: string | null;
  external_organization: string | null;
  external_contact: string | null;
  coordination_department_id: string | null;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  risk_response: string;
  response_rationale: string;
  status: string;
  review_date: string;
  category?: {
    name: string;
    color: string;
  };
  categories?: Array<{
    category_id: string;
    category: {
      id: string;
      name: string;
      code: string;
      color: string;
    };
  }>;
  department?: {
    name: string;
  };
  coordination_department?: {
    name: string;
  };
  related_goal?: {
    code: string;
    title: string;
  };
  related_activity?: {
    code: string;
    name: string;
  };
  related_process?: {
    code: string;
    name: string;
  };
}

interface RiskCriterion {
  id: string;
  criteria_type: 'LIKELIHOOD' | 'IMPACT';
  level: number;
  name: string;
  description: string;
  percentage_min: number | null;
  percentage_max: number | null;
}

interface RiskControl {
  id?: string;
  name: string;
  description: string;
  control_type: string;
  effectiveness: string;
}

interface DepartmentImpact {
  id?: string;
  department_id: string;
  department_name?: string;
  impact_level: number;
  impact_description: string;
  affected_processes: string;
  specific_controls: string;
}

const statusOptions = [
  { value: '', label: 'Tümü' },
  { value: 'DRAFT', label: 'Taslak' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'IDENTIFIED', label: 'Tespit Edildi' },
  { value: 'ASSESSING', label: 'Değerlendiriliyor' },
  { value: 'TREATING', label: 'Tedavi Ediliyor' },
  { value: 'MONITORING', label: 'İzlemede' },
  { value: 'CLOSED', label: 'Kapatıldı' }
];

const approvalStatusOptions = [
  { value: '', label: 'Tüm Durumlar' },
  { value: 'DRAFT', label: 'Taslak' },
  { value: 'IN_REVIEW', label: 'İncelemede' },
  { value: 'PENDING_APPROVAL', label: 'Onay Bekliyor' },
  { value: 'APPROVED', label: 'Onaylandı' },
  { value: 'REJECTED', label: 'Reddedildi' },
  { value: 'CLOSED', label: 'Kapandı' }
];

const riskLevelOptions = [
  { value: '', label: 'Tüm Seviyeler' },
  { value: '1-4', label: 'Düşük (1-4)' },
  { value: '5-9', label: 'Orta (5-9)' },
  { value: '10-14', label: 'Yüksek (10-14)' },
  { value: '15-19', label: 'Çok Yüksek (15-19)' },
  { value: '20-25', label: 'Kritik (20-25)' }
];

function getRiskScoreBadge(score: number) {
  if (score >= 20) return { color: 'bg-gray-800 text-white', emoji: '⬛', label: 'Kritik' };
  if (score >= 15) return { color: 'bg-red-500 text-white', emoji: '🔴', label: 'Çok Yüksek' };
  if (score >= 10) return { color: 'bg-orange-500 text-white', emoji: '🟠', label: 'Yüksek' };
  if (score >= 5) return { color: 'bg-yellow-500 text-black', emoji: '🟡', label: 'Orta' };
  return { color: 'bg-green-500 text-white', emoji: '🟢', label: 'Düşük' };
}

function getApprovalStatusBadge(status: string) {
  const statusMap: Record<string, { color: string; emoji: string; label: string }> = {
    DRAFT: { color: 'bg-gray-200 text-gray-800', emoji: '📝', label: 'Taslak' },
    IN_REVIEW: { color: 'bg-blue-100 text-blue-700', emoji: '👀', label: 'İncelemede' },
    PENDING_APPROVAL: { color: 'bg-yellow-100 text-yellow-700', emoji: '⏳', label: 'Onay Bekliyor' },
    APPROVED: { color: 'bg-green-100 text-green-700', emoji: '✅', label: 'Onaylandı' },
    REJECTED: { color: 'bg-red-100 text-red-700', emoji: '❌', label: 'Reddedildi' },
    CLOSED: { color: 'bg-purple-600 text-white', emoji: '🔒', label: 'Kapandı' }
  };
  return statusMap[status] || { color: 'bg-gray-200 text-gray-800', emoji: '❓', label: status };
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'bg-gray-200 text-gray-800', label: 'Taslak' },
    ACTIVE: { color: 'bg-blue-500 text-white', label: 'Aktif' },
    IDENTIFIED: { color: 'bg-yellow-500 text-white', label: 'Tespit Edildi' },
    ASSESSING: { color: 'bg-orange-500 text-white', label: 'Değerlendiriliyor' },
    TREATING: { color: 'bg-blue-600 text-white', label: 'Tedavi Ediliyor' },
    MONITORING: { color: 'bg-purple-500 text-white', label: 'İzlemede' },
    CLOSED: { color: 'bg-gray-500 text-white', label: 'Kapatıldı' }
  };
  const mapped = statusMap[status];
  return mapped || { color: 'bg-gray-200 text-gray-800', label: status };
}

function getRiskRelationBadge(relation: string) {
  const relationMap: Record<string, { color: string; emoji: string; label: string }> = {
    STRATEGIC: { color: 'bg-blue-100 text-blue-700', emoji: '🎯', label: 'Stratejik' },
    OPERATIONAL: { color: 'bg-gray-100 text-gray-700', emoji: '⚙️', label: 'Operasyonel' },
    PROJECT: { color: 'bg-orange-100 text-orange-700', emoji: '📋', label: 'Proje' },
    CORPORATE: { color: 'bg-purple-100 text-purple-700', emoji: '🏛️', label: 'Kurumsal' }
  };
  return relationMap[relation] || relationMap['OPERATIONAL'];
}

function getControlLevelBadge(level: string) {
  const levelMap: Record<string, { color: string; emoji: string; label: string }> = {
    CONTROLLABLE: { color: 'bg-green-100 text-green-700', emoji: '✅', label: 'Kontrol Edilebilir' },
    PARTIAL: { color: 'bg-yellow-100 text-yellow-700', emoji: '⚠️', label: 'Kısmen Kontrol' },
    UNCONTROLLABLE: { color: 'bg-red-100 text-red-700', emoji: '❌', label: 'Kontrol Dışı' }
  };
  return levelMap[level] || levelMap['CONTROLLABLE'];
}

export default function RiskRegister() {
  const { navigate, currentPath, searchParams } = useLocation();
  const { profile } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<RiskCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    category: '',
    department: '',
    goal: '',
    level: '',
    status: '',
    approvalStatus: '',
    riskSource: '',
    riskRelation: '',
    controlLevel: '',
    search: ''
  });

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'residual_score', direction: 'desc' });

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    causes: '',
    category_ids: [] as string[],
    owner_department_id: '',
    owner_id: '',
    goal_id: '',
    risk_source: 'INTERNAL',
    risk_relation: 'OPERATIONAL',
    control_level: 'CONTROLLABLE',
    related_goal_id: '',
    related_activity_id: '',
    related_process_id: '',
    related_project_id: '',
    external_organization: '',
    external_contact: '',
    coordination_department_id: '',
    inherent_likelihood: 3,
    inherent_impact: 3,
    residual_likelihood: 2,
    residual_impact: 2,
    risk_response: 'MITIGATE',
    response_rationale: '',
    review_date: '',
    status: 'ACTIVE'
  });

  const [controls, setControls] = useState<RiskControl[]>([]);
  const [departmentImpacts, setDepartmentImpacts] = useState<DepartmentImpact[]>([]);
  const [saving, setSaving] = useState(false);
  const [showControlForm, setShowControlForm] = useState(false);
  const [showDepartmentImpactForm, setShowDepartmentImpactForm] = useState(false);
  const [newControl, setNewControl] = useState<RiskControl>({
    name: '',
    description: '',
    control_type: 'PREVENTIVE',
    effectiveness: 'EFFECTIVE'
  });
  const [newDepartmentImpact, setNewDepartmentImpact] = useState<DepartmentImpact>({
    department_id: '',
    impact_level: 3,
    impact_description: '',
    affected_processes: '',
    specific_controls: ''
  });
  const [editingDepartmentImpact, setEditingDepartmentImpact] = useState<DepartmentImpact | null>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown-menu-container')) {
          setMenuOpen(null);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    const level = searchParams.get('level');
    const department = searchParams.get('department');

    if (level) {
      setFilters(prev => ({ ...prev, level: level === 'critical' ? '20-25' : '' }));
    }
    if (department) {
      setFilters(prev => ({ ...prev, department }));
    }
  }, [currentPath]);

  async function loadData() {
    try {
      setLoading(true);

      const [risksRes, categoriesRes, departmentsRes, objectivesRes, goalsRes, activitiesRes, processesRes, profilesRes, criteriaRes] = await Promise.all([
        supabase
          .from('risks')
          .select(`
            *,
            category:risk_categories(name, color),
            categories:risk_category_mappings(category_id, category:risk_categories(id, name, code, color)),
            department:departments!owner_department_id(name),
            coordination_department:departments!coordination_department_id(name),
            related_goal:goals!related_goal_id(code, title),
            related_activity:activities!related_activity_id(code, name),
            related_process:qm_processes!related_process_id(code, name)
          `)
          .eq('organization_id', profile?.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('risk_categories')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('order_index', { ascending: true }),
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('name', { ascending: true }),
        supabase
          .from('objectives')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('goals')
          .select('id, code, title, department_id, risk_appetite_level, risk_appetite_description, risk_appetite_max_score')
          .eq('organization_id', profile?.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('activities')
          .select('id, code, name, goal_id')
          .eq('organization_id', profile?.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('qm_processes')
          .select('id, code, name')
          .eq('organization_id', profile?.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, department_id')
          .eq('organization_id', profile?.organization_id)
          .order('full_name', { ascending: true }),
        supabase
          .from('risk_criteria')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('criteria_type')
          .order('level')
      ]);

      if (risksRes.error) throw risksRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (objectivesRes.error) throw objectivesRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (processesRes.error) throw processesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setRisks(risksRes.data || []);
      setCategories(categoriesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setObjectives(objectivesRes.data || []);
      setGoals(goalsRes.data || []);
      setActivities(activitiesRes.data || []);
      setProcesses(processesRes.data || []);
      setProfiles(profilesRes.data || []);
      setCriteria(criteriaRes.data || []);

      if (criteriaRes.data?.length === 0) {
        await supabase.rpc('initialize_default_risk_criteria', {
          org_id: profile?.organization_id
        });
        const { data: newCriteria } = await supabase
          .from('risk_criteria')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('criteria_type')
          .order('level');
        setCriteria(newCriteria || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openNewRiskModal() {
    setFormData({
      code: '',
      name: '',
      description: '',
      causes: '',
      category_ids: [] as string[],
      owner_department_id: '',
      owner_id: '',
      goal_id: '',
      risk_source: 'INTERNAL',
      risk_relation: 'OPERATIONAL',
      control_level: 'CONTROLLABLE',
      related_goal_id: '',
      related_activity_id: '',
      related_process_id: '',
      related_project_id: '',
      external_organization: '',
      external_contact: '',
      coordination_department_id: '',
      inherent_likelihood: 3,
      inherent_impact: 3,
      residual_likelihood: 2,
      residual_impact: 2,
      risk_response: 'MITIGATE',
      response_rationale: '',
      review_date: '',
      status: 'ACTIVE'
    });
    setControls([]);
    setDepartmentImpacts([]);
    setShowControlForm(false);
    setShowDepartmentImpactForm(false);
    setNewControl({ name: '', description: '', control_type: 'PREVENTIVE', effectiveness: 'EFFECTIVE' });
    setNewDepartmentImpact({ department_id: '', impact_level: 3, impact_description: '', affected_processes: '', specific_controls: '' });
    setEditingDepartmentImpact(null);
    setShowModal(true);
  }

  async function handleDelete(id: string, code: string, name: string) {
    setDeleteConfirm(id);
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase.from('risks').delete().eq('id', deleteConfirm);

      if (error) throw error;

      setRisks(risks.filter(r => r.id !== deleteConfirm));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting risk:', error);
      alert('Risk silinirken hata oluştu.');
    }
  }

  async function handleSave(saveStatus: string) {
    if (!formData.name || formData.category_ids.length === 0 || !formData.owner_department_id) {
      alert('Lütfen zorunlu alanları doldurun!');
      return;
    }

    if (formData.risk_relation === 'STRATEGIC' && !formData.related_goal_id) {
      alert('Stratejik risk için bağlı hedef seçimi zorunludur');
      return;
    }

    if (formData.risk_relation === 'OPERATIONAL' && !formData.related_process_id) {
      alert('Operasyonel risk için bağlı süreç seçimi zorunludur');
      return;
    }

    if ((formData.control_level === 'PARTIALLY_CONTROLLABLE' || formData.control_level === 'UNCONTROLLABLE') && !formData.external_organization) {
      alert('Kontrol dışı/kısmen kontrol edilebilir riskler için yetkili dış kurum bilgisi zorunludur');
      return;
    }

    if ((formData.control_level === 'PARTIALLY_CONTROLLABLE' || formData.control_level === 'UNCONTROLLABLE') && !formData.coordination_department_id) {
      alert('Kontrol dışı/kısmen kontrol edilebilir riskler için koordinasyon birimi seçimi zorunludur');
      return;
    }

    const inherentScore = formData.inherent_likelihood * formData.inherent_impact;
    const residualScore = formData.residual_likelihood * formData.residual_impact;

    if (residualScore > inherentScore) {
      alert('Artık risk skoru, doğal risk skorundan büyük olamaz!');
      return;
    }

    setSaving(true);
    try {
      const { data: riskData, error: riskError } = await supabase
        .from('risks')
        .insert({
          organization_id: profile?.organization_id,
          name: formData.name,
          description: formData.description,
          causes: formData.causes,
          category_id: formData.category_ids[0],
          owner_department_id: formData.owner_department_id,
          goal_id: formData.goal_id || null,
          risk_source: formData.risk_source,
          risk_relation: formData.risk_relation,
          control_level: formData.control_level,
          related_goal_id: formData.related_goal_id || null,
          related_activity_id: formData.related_activity_id || null,
          related_process_id: formData.related_process_id || null,
          related_project_id: formData.related_project_id || null,
          external_organization: formData.external_organization || null,
          external_contact: formData.external_contact || null,
          coordination_department_id: formData.coordination_department_id || null,
          inherent_likelihood: formData.inherent_likelihood,
          inherent_impact: formData.inherent_impact,
          residual_likelihood: formData.residual_likelihood,
          residual_impact: formData.residual_impact,
          risk_response: formData.risk_response,
          response_rationale: formData.response_rationale,
          status: saveStatus,
          identified_by_id: profile?.id,
          identified_date: new Date().toISOString().split('T')[0]
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

      if (controls.length > 0) {
        const controlsToInsert = controls.map(ctrl => ({
          risk_id: riskData.id,
          name: ctrl.name,
          description: ctrl.description,
          control_type: ctrl.control_type,
          operating_effectiveness: ctrl.effectiveness === 'EFFECTIVE' ? 5 : ctrl.effectiveness === 'PARTIAL' ? 3 : 1
        }));

        const { error: controlsError } = await supabase
          .from('risk_controls')
          .insert(controlsToInsert);

        if (controlsError) throw controlsError;
      }

      if (departmentImpacts.length > 0) {
        const impactsToInsert = departmentImpacts.map(impact => ({
          organization_id: profile?.organization_id,
          risk_id: riskData.id,
          department_id: impact.department_id,
          impact_level: impact.impact_level,
          impact_description: impact.impact_description || null,
          affected_processes: impact.affected_processes || null,
          specific_controls: impact.specific_controls || null
        }));

        const { error: impactsError } = await supabase
          .from('rm_risk_department_impacts')
          .insert(impactsToInsert);

        if (impactsError) throw impactsError;
      }

      alert(saveStatus === 'DRAFT' ? 'Risk taslak olarak kaydedildi!' : 'Risk başarıyla kaydedildi!');
      setShowModal(false);
      setShowControlForm(false);
      setShowDepartmentImpactForm(false);
      setNewControl({ name: '', description: '', control_type: 'PREVENTIVE', effectiveness: 'EFFECTIVE' });
      setNewDepartmentImpact({ department_id: '', impact_level: 3, impact_description: '', affected_processes: '', specific_controls: '' });
      setEditingDepartmentImpact(null);
      loadData();
    } catch (error) {
      console.error('Error saving risk:', error);
      alert('Risk kaydedilemedi!');
    } finally {
      setSaving(false);
    }
  }

  function handleSort(key: string) {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }

  const filteredRisks = risks.filter(risk => {
    if (filters.category) {
      const hasCategory = risk.categories?.some(c => c.category_id === filters.category);
      if (!hasCategory) return false;
    }
    if (filters.department && risk.owner_department_id !== filters.department) return false;
    if (filters.goal && risk.goal_id !== filters.goal) return false;
    if (filters.status && risk.status !== filters.status) return false;
    if (filters.approvalStatus && risk.approval_status !== filters.approvalStatus) return false;
    if (filters.riskSource && risk.risk_source !== filters.riskSource) return false;
    if (filters.riskRelation && risk.risk_relation !== filters.riskRelation) return false;
    if (filters.controlLevel && risk.control_level !== filters.controlLevel) return false;
    if (filters.level) {
      const [min, max] = filters.level.split('-').map(Number);
      if (risk.residual_score < min || risk.residual_score > max) return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        risk.code.toLowerCase().includes(searchLower) ||
        risk.name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const sortedRisks = [...filteredRisks].sort((a, b) => {
    if (!sortConfig) return 0;

    let aValue = a[sortConfig.key as keyof Risk];
    let bValue = b[sortConfig.key as keyof Risk];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue, 'tr')
        : bValue.localeCompare(aValue, 'tr');
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const likelihoodCriteria = criteria.filter(c => c.criteria_type === 'LIKELIHOOD');
  const impactCriteria = criteria.filter(c => c.criteria_type === 'IMPACT');

  const inherentScore = formData.inherent_likelihood * formData.inherent_impact;
  const residualScore = formData.residual_likelihood * formData.residual_impact;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'director';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Riskler</h1>
          <p className="text-gray-600 mt-1">Kurumsal risk envanteri</p>
        </div>
        {isAdmin && (
          <button
            onClick={openNewRiskModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Yeni Risk
          </button>
        )}
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birim
              </label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hedef
              </label>
              <select
                value={filters.goal}
                onChange={(e) => setFilters({ ...filters, goal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.code} - {goal.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seviye
              </label>
              <select
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {riskLevelOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kaynak
              </label>
              <select
                value={filters.riskSource}
                onChange={(e) => setFilters({ ...filters, riskSource: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                <option value="INTERNAL">İç Risk</option>
                <option value="EXTERNAL">Dış Risk</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İlişki
              </label>
              <select
                value={filters.riskRelation}
                onChange={(e) => setFilters({ ...filters, riskRelation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                <option value="STRATEGIC">Stratejik</option>
                <option value="OPERATIONAL">Operasyonel</option>
                <option value="PROJECT">Proje</option>
                <option value="CORPORATE">Kurumsal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontrol
              </label>
              <select
                value={filters.controlLevel}
                onChange={(e) => setFilters({ ...filters, controlLevel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                <option value="CONTROLLABLE">Kontrol Edilebilir</option>
                <option value="PARTIAL">Kısmen Kontrol</option>
                <option value="UNCONTROLLABLE">Kontrol Dışı</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Onay Durumu
              </label>
              <select
                value={filters.approvalStatus}
                onChange={(e) => setFilters({ ...filters, approvalStatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {approvalStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arama
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Kod veya ad ara..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                {filters.search && (
                  <button
                    onClick={() => setFilters({ ...filters, search: '' })}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setFilters({ category: '', department: '', goal: '', level: '', status: '', approvalStatus: '', riskSource: '', riskRelation: '', controlLevel: '', search: '' })}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Filtreleri Temizle
          </button>
        </div>
      </Card>

      <Card className="overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full relative">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('code')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Kod {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Risk Adı {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Birim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kaynak
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İlişki
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kontrol
                </th>
                <th
                  onClick={() => handleSort('inherent_score')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Doğal Skor {sortConfig.key === 'inherent_score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('residual_score')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Artık Skor {sortConfig.key === 'residual_score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Onay Durumu
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 relative">
              {sortedRisks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="w-12 h-12 text-gray-300" />
                      <p>Henüz risk kaydı bulunmuyor.</p>
                      {isAdmin && (
                        <button
                          onClick={openNewRiskModal}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          İlk riski eklemek için tıklayın
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRisks.map((risk) => {
                  const inherentBadge = getRiskScoreBadge(risk.inherent_score);
                  const residualBadge = getRiskScoreBadge(risk.residual_score);
                  const statusBadge = getStatusBadge(risk.status);
                  const approvalBadge = getApprovalStatusBadge(risk.approval_status || 'DRAFT');

                  const relatedGoal = risk.goal_id ? goals.find(g => g.id === risk.goal_id) : null;
                  const exceedsAppetite = relatedGoal?.risk_appetite_max_score && risk.residual_score > relatedGoal.risk_appetite_max_score;

                  return (
                    <tr
                      key={risk.id}
                      onClick={() => navigate(`risk-management/risks/${risk.id}`)}
                      className={`hover:bg-gray-50 cursor-pointer relative ${exceedsAppetite ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {risk.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs">
                          <div className="truncate" title={risk.name}>
                            {risk.name}
                          </div>
                          {exceedsAppetite && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-red-600 font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Risk iştahını aşıyor! (Limit: {relatedGoal?.risk_appetite_max_score})
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {risk.categories && risk.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {risk.categories.map((catMapping) => (
                              <span
                                key={catMapping.category_id}
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${catMapping.category.color || '#6B7280'}20`,
                                  color: catMapping.category.color || '#6B7280'
                                }}
                              >
                                {catMapping.category.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {risk.department?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-1">
                          <span>{risk.risk_source === 'EXTERNAL' ? '🌍' : '🏠'}</span>
                          <span className="text-gray-700">
                            {risk.risk_source === 'EXTERNAL' ? 'Dış Risk' : 'İç Risk'}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const relationBadge = getRiskRelationBadge(risk.risk_relation);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${relationBadge.color}`}>
                              <span>{relationBadge.emoji}</span>
                              <span>{relationBadge.label}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const controlBadge = getControlLevelBadge(risk.control_level);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${controlBadge.color}`}>
                              <span>{controlBadge.emoji}</span>
                              <span>{controlBadge.label}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${inherentBadge.color}`}
                        >
                          <span>{inherentBadge.emoji}</span>
                          <span>{risk.inherent_score}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${residualBadge.color}`}
                        >
                          <span>{residualBadge.emoji}</span>
                          <span>{risk.residual_score}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${approvalBadge.color}`}
                        >
                          <span>{approvalBadge.emoji}</span>
                          <span>{approvalBadge.label}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative inline-block text-left dropdown-menu-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(menuOpen === risk.id ? null : risk.id);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {menuOpen === risk.id && (
                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`risk-management/risks/${risk.id}`);
                                    setMenuOpen(null);
                                  }}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Eye className="w-4 h-4" />
                                  Görüntüle
                                </button>
                                {isAdmin && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`risk-management/risks/${risk.id}?edit=true`);
                                        setMenuOpen(null);
                                      }}
                                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                      Düzenle
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(risk.id, risk.code, risk.name);
                                        setMenuOpen(null);
                                      }}
                                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Sil
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {sortedRisks.length > 0 && (
        <div className="text-sm text-gray-600">
          Toplam {sortedRisks.length} risk gösteriliyor
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                  Yeni Risk Ekle
                </h2>
                <p className="text-sm text-gray-600 mt-1">Tüm alanları dikkatlice doldurun</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setShowControlForm(false);
                  setNewControl({ name: '', description: '', control_type: 'PREVENTIVE', effectiveness: 'EFFECTIVE' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Temel Bilgiler</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Risk Kodu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="R-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Kategorileri <span className="text-red-500">*</span> (Birden fazla seçilebilir)
                    </label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {categories.map(cat => (
                        <label key={cat.id} className="flex items-center space-x-2 py-1.5 hover:bg-gray-50 cursor-pointer">
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
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Risk adını giriniz"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Açıklaması
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Riskin detaylı açıklaması..."
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Nedeni
                  </label>
                  <textarea
                    value={formData.causes}
                    onChange={(e) => setFormData({ ...formData, causes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Riskin ortaya çıkma nedeni..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Risk Kaynağı <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="risk_source"
                          value="INTERNAL"
                          checked={formData.risk_source === 'INTERNAL'}
                          onChange={(e) => setFormData({ ...formData, risk_source: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🏠</span>
                          <div>
                            <div className="font-medium text-sm">İç Risk</div>
                            <div className="text-xs text-gray-600">Kurum içinden</div>
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="risk_source"
                          value="EXTERNAL"
                          checked={formData.risk_source === 'EXTERNAL'}
                          onChange={(e) => setFormData({ ...formData, risk_source: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🌍</span>
                          <div>
                            <div className="font-medium text-sm">Dış Risk</div>
                            <div className="text-xs text-gray-600">Kurum dışından</div>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      İlişki Türü <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="risk_relation"
                          value="STRATEGIC"
                          checked={formData.risk_relation === 'STRATEGIC'}
                          onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🎯</span>
                          <div>
                            <div className="font-medium text-sm">Stratejik</div>
                            <div className="text-xs text-gray-600">Hedefe bağlı</div>
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="risk_relation"
                          value="OPERATIONAL"
                          checked={formData.risk_relation === 'OPERATIONAL'}
                          onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">⚙️</span>
                          <div>
                            <div className="font-medium text-sm">Operasyonel</div>
                            <div className="text-xs text-gray-600">Sürece bağlı</div>
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="risk_relation"
                          value="PROJECT"
                          checked={formData.risk_relation === 'PROJECT'}
                          onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">📋</span>
                          <div>
                            <div className="font-medium text-sm">Proje</div>
                            <div className="text-xs text-gray-600">Projeye bağlı</div>
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="risk_relation"
                          value="CORPORATE"
                          checked={formData.risk_relation === 'CORPORATE'}
                          onChange={(e) => setFormData({ ...formData, risk_relation: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🏛️</span>
                          <div>
                            <div className="font-medium text-sm">Kurumsal</div>
                            <div className="text-xs text-gray-600">Bağımsız</div>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Kontrol Düzeyi <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="control_level"
                          value="CONTROLLABLE"
                          checked={formData.control_level === 'CONTROLLABLE'}
                          onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">✅</span>
                          <div>
                            <div className="font-medium text-sm">Kontrol Edilebilir</div>
                            <div className="text-xs text-gray-600">Tamamen kontrol</div>
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="control_level"
                          value="PARTIAL"
                          checked={formData.control_level === 'PARTIAL'}
                          onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">⚠️</span>
                          <div>
                            <div className="font-medium text-sm">Kısmen Kontrol</div>
                            <div className="text-xs text-gray-600">Etki azaltılabilir</div>
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                        <input
                          type="radio"
                          name="control_level"
                          value="UNCONTROLLABLE"
                          checked={formData.control_level === 'UNCONTROLLABLE'}
                          onChange={(e) => setFormData({ ...formData, control_level: e.target.value })}
                          className="mt-1"
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-lg">❌</span>
                          <div>
                            <div className="font-medium text-sm">Kontrol Dışı</div>
                            <div className="text-xs text-gray-600">Sadece izleme</div>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sorumlu Birim <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.owner_department_id}
                      onChange={(e) => setFormData({
                        ...formData,
                        owner_department_id: e.target.value,
                        goal_id: ''
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seçiniz...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      İlişkili Hedef (Opsiyonel)
                    </label>
                    <select
                      value={formData.goal_id}
                      onChange={(e) => setFormData({ ...formData, goal_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!formData.owner_department_id}
                    >
                      <option value="">
                        {formData.owner_department_id ? 'Seçiniz...' : 'Önce sorumlu birim seçiniz'}
                      </option>
                      {goals
                        .filter(goal => goal.department_id === formData.owner_department_id)
                        .map(goal => (
                          <option key={goal.id} value={goal.id}>{goal.code} - {goal.title}</option>
                        ))}
                    </select>
                    {formData.owner_department_id && goals.filter(g => g.department_id === formData.owner_department_id).length === 0 && (
                      <p className="mt-1 text-sm text-amber-600">Bu birime ait hedef bulunamadı</p>
                    )}
                  </div>
                </div>

                {formData.risk_relation === 'STRATEGIC' && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3">Stratejik İlişki Bağlantıları</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bağlı Hedef <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.related_goal_id}
                          onChange={(e) => setFormData({ ...formData, related_goal_id: e.target.value, related_activity_id: '' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Hedef seçiniz...</option>
                          {goals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.code} - {goal.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bağlı Faaliyet (Opsiyonel)
                        </label>
                        <select
                          value={formData.related_activity_id}
                          onChange={(e) => setFormData({ ...formData, related_activity_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={!formData.related_goal_id}
                        >
                          <option value="">
                            {formData.related_goal_id ? 'Faaliyet seçiniz (opsiyonel)...' : 'Önce hedef seçiniz'}
                          </option>
                          {activities
                            .filter(activity => activity.goal_id === formData.related_goal_id)
                            .map(activity => (
                              <option key={activity.id} value={activity.id}>{activity.code} - {activity.name}</option>
                            ))}
                        </select>
                        {formData.related_goal_id && activities.filter(a => a.goal_id === formData.related_goal_id).length === 0 && (
                          <p className="mt-1 text-sm text-gray-500">Bu hedefe ait faaliyet bulunamadı</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {formData.risk_relation === 'OPERATIONAL' && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Operasyonel İlişki Bağlantısı</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bağlı Süreç <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.related_process_id}
                        onChange={(e) => setFormData({ ...formData, related_process_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Süreç seçiniz...</option>
                        {processes.map(process => (
                          <option key={process.id} value={process.id}>{process.code} - {process.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {formData.risk_relation === 'PROJECT' && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-orange-900 mb-2">Proje İlişkisi</h4>
                    <div className="flex items-start gap-2 text-sm text-orange-700">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>Proje modülü yakında eklenecektir. Şu an için proje bağlantısı yapılamıyor.</p>
                    </div>
                  </div>
                )}

                {formData.risk_relation === 'CORPORATE' && (
                  <>
                    <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-purple-900 mb-2">Kurumsal Risk</h4>
                      <div className="flex items-start gap-2 text-sm text-purple-700">
                        <div className="text-lg">🏛️</div>
                        <p>Bu risk tüm kurumu etkiler ve belirli bir hedef, faaliyet veya sürece bağlı değildir.</p>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-blue-900">Birim Etki Analizi</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDepartmentImpact(null);
                            setNewDepartmentImpact({ department_id: '', impact_level: 3, impact_description: '', affected_processes: '', specific_controls: '' });
                            setShowDepartmentImpactForm(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Birim Ekle
                        </button>
                      </div>
                      <p className="text-xs text-blue-700 mb-3">
                        Bu riskin farklı birimlere olan etkilerini belirleyebilirsiniz.
                      </p>

                      {departmentImpacts.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Henüz birim etkisi eklenmedi.</p>
                      ) : (
                        <div className="space-y-2">
                          {departmentImpacts.map((impact, index) => {
                            const dept = departments.find(d => d.id === impact.department_id);
                            const impactLabel = ['Etkilenmez', 'Minimal', 'Düşük', 'Orta', 'Yüksek', 'Kritik'][impact.impact_level];
                            const impactColor = ['bg-gray-200', 'bg-green-200', 'bg-yellow-200', 'bg-orange-300', 'bg-red-400', 'bg-red-600'][impact.impact_level];

                            return (
                              <div key={index} className="bg-white p-3 rounded border border-blue-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-gray-900">{dept?.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                                        <div
                                          className={`${impactColor} h-2 rounded-full transition-all`}
                                          style={{ width: `${(impact.impact_level / 5) * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-gray-700">{impactLabel} ({impact.impact_level}/5)</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDepartmentImpact(impact);
                                        setNewDepartmentImpact(impact);
                                        setShowDepartmentImpactForm(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDepartmentImpacts(departmentImpacts.filter((_, i) => i !== index));
                                      }}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                {impact.impact_description && (
                                  <p className="text-xs text-gray-600 mt-1">{impact.impact_description}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {(formData.control_level === 'PARTIALLY_CONTROLLABLE' || formData.control_level === 'UNCONTROLLABLE') && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-900 mb-3">Dış Kurum Bilgileri</h4>
                    <p className="text-xs text-amber-700 mb-4">
                      Bu risk {formData.control_level === 'UNCONTROLLABLE' ? 'kontrol dışı' : 'kısmen kontrol edilebilir'} olduğu için dış kurum bilgileri gereklidir.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Yetkili Dış Kurum <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.external_organization}
                          onChange={(e) => setFormData({ ...formData, external_organization: e.target.value })}
                          placeholder="Örn: Kocaeli Büyükşehir Belediyesi"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          İletişim Bilgisi
                        </label>
                        <input
                          type="text"
                          value={formData.external_contact}
                          onChange={(e) => setFormData({ ...formData, external_contact: e.target.value })}
                          placeholder="Örn: Çevre Dairesi - 0262 XXX XX XX"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Koordinasyon Birimimiz <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.coordination_department_id}
                          onChange={(e) => setFormData({ ...formData, coordination_department_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                          <option value="">Koordinasyon birimini seçiniz...</option>
                          {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Dış kurumla iletişimi sağlayacak birim</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Doğal Risk Değerlendirmesi</h3>
                <p className="text-sm text-gray-600 mb-4">Herhangi bir kontrol olmadan riskin değerlendirilmesi</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Olasılık <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {likelihoodCriteria.map(criterion => (
                        <label key={criterion.level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="inherent_likelihood"
                            value={criterion.level}
                            checked={formData.inherent_likelihood === criterion.level}
                            onChange={(e) => setFormData({ ...formData, inherent_likelihood: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{criterion.level} - {criterion.name}</div>
                            <div className="text-xs text-gray-600">{criterion.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Etki <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {impactCriteria.map(criterion => (
                        <label key={criterion.level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="inherent_impact"
                            value={criterion.level}
                            checked={formData.inherent_impact === criterion.level}
                            onChange={(e) => setFormData({ ...formData, inherent_impact: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{criterion.level} - {criterion.name}</div>
                            <div className="text-xs text-gray-600">{criterion.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-300">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">DOĞAL RİSK SKORU:</span>
                    <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(inherentScore).color} px-4 py-2 rounded-lg`}>
                      <span>{getRiskScoreBadge(inherentScore).emoji}</span>
                      <span>{inherentScore}</span>
                      <span className="text-sm">({getRiskScoreBadge(inherentScore).label})</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Mevcut Kontroller</h3>
                <p className="text-sm text-gray-600 mb-4">Bu riski azaltmak için mevcut kontroller (opsiyonel)</p>

                <div className="space-y-3">
                  {controls.map((control, index) => (
                    <div key={index} className="flex gap-2 items-start bg-white p-3 rounded border border-gray-200">
                      <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="font-medium">{control.name}</div>
                          <div className="text-xs text-gray-500">{control.description}</div>
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Tür:</span> {control.control_type === 'PREVENTIVE' ? 'Önleyici' : control.control_type === 'DETECTIVE' ? 'Tespit Edici' : 'Düzeltici'}
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Etkinlik:</span> {control.effectiveness === 'EFFECTIVE' ? 'Etkin' : control.effectiveness === 'PARTIAL' ? 'Kısmen Etkin' : 'Etkin Değil'}
                        </div>
                      </div>
                      <button
                        onClick={() => setControls(controls.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {controls.length === 0 && !showControlForm && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      Henüz kontrol eklenmedi
                    </div>
                  )}

                  {showControlForm && (
                    <div className="bg-white p-4 rounded-lg border-2 border-blue-400 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">Yeni Kontrol</h4>
                        <button
                          onClick={() => {
                            setShowControlForm(false);
                            setNewControl({ name: '', description: '', control_type: 'PREVENTIVE', effectiveness: 'EFFECTIVE' });
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kontrol Adı <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newControl.name}
                          onChange={(e) => setNewControl({ ...newControl, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Kontrol adını girin"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Açıklama
                        </label>
                        <textarea
                          value={newControl.description}
                          onChange={(e) => setNewControl({ ...newControl, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Kontrolün açıklaması"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Kontrol Türü <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={newControl.control_type}
                            onChange={(e) => setNewControl({ ...newControl, control_type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="PREVENTIVE">Önleyici</option>
                            <option value="DETECTIVE">Tespit Edici</option>
                            <option value="CORRECTIVE">Düzeltici</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Etkinlik <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={newControl.effectiveness}
                            onChange={(e) => setNewControl({ ...newControl, effectiveness: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="EFFECTIVE">Etkin</option>
                            <option value="PARTIAL">Kısmen Etkin</option>
                            <option value="INEFFECTIVE">Etkin Değil</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            if (!newControl.name.trim()) {
                              alert('Lütfen kontrol adını girin');
                              return;
                            }
                            setControls([...controls, newControl]);
                            setShowControlForm(false);
                            setNewControl({ name: '', description: '', control_type: 'PREVENTIVE', effectiveness: 'EFFECTIVE' });
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                          <Save className="w-4 h-4 inline mr-2" />
                          Kaydet
                        </button>
                        <button
                          onClick={() => {
                            setShowControlForm(false);
                            setNewControl({ name: '', description: '', control_type: 'PREVENTIVE', effectiveness: 'EFFECTIVE' });
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  )}

                  {!showControlForm && (
                    <button
                      onClick={() => setShowControlForm(true)}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition"
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Kontrol Ekle
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Artık Risk Değerlendirmesi</h3>
                <p className="text-sm text-gray-600 mb-4">Mevcut kontroller uygulandıktan sonra kalan risk</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Olasılık <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {likelihoodCriteria.map(criterion => (
                        <label key={criterion.level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                          <input
                            type="radio"
                            name="residual_likelihood"
                            value={criterion.level}
                            checked={formData.residual_likelihood === criterion.level}
                            onChange={(e) => setFormData({ ...formData, residual_likelihood: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{criterion.level} - {criterion.name}</div>
                            <div className="text-xs text-gray-600">{criterion.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Etki <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {impactCriteria.map(criterion => (
                        <label key={criterion.level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                          <input
                            type="radio"
                            name="residual_impact"
                            value={criterion.level}
                            checked={formData.residual_impact === criterion.level}
                            onChange={(e) => setFormData({ ...formData, residual_impact: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{criterion.level} - {criterion.name}</div>
                            <div className="text-xs text-gray-600">{criterion.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-300">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">ARTIK RİSK SKORU:</span>
                    <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(residualScore).color} px-4 py-2 rounded-lg`}>
                      <span>{getRiskScoreBadge(residualScore).emoji}</span>
                      <span>{residualScore}</span>
                      <span className="text-sm">({getRiskScoreBadge(residualScore).label})</span>
                    </span>
                  </div>
                  {residualScore > inherentScore && (
                    <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Uyarı: Artık risk skoru, doğal risk skorundan büyük olamaz!
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">5. Risk Yanıtı</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Risk Yanıt Stratejisi <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="risk_response"
                        value="ACCEPT"
                        checked={formData.risk_response === 'ACCEPT'}
                        onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">KABUL ET</div>
                        <div className="text-sm text-gray-600">Risk mevcut haliyle kabul edilir</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="risk_response"
                        value="MITIGATE"
                        checked={formData.risk_response === 'MITIGATE'}
                        onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">AZALT</div>
                        <div className="text-sm text-gray-600">Risk azaltıcı önlemler alınacak</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="risk_response"
                        value="TRANSFER"
                        checked={formData.risk_response === 'TRANSFER'}
                        onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">TRANSFER ET</div>
                        <div className="text-sm text-gray-600">Risk üçüncü tarafa aktarılacak (sigorta vb.)</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="risk_response"
                        value="AVOID"
                        checked={formData.risk_response === 'AVOID'}
                        onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">KAÇIN</div>
                        <div className="text-sm text-gray-600">Riske neden olan faaliyetten vazgeçilecek</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yanıt Açıklaması
                  </label>
                  <textarea
                    value={formData.response_rationale}
                    onChange={(e) => setFormData({ ...formData, response_rationale: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Alınacak önlemler ve gerekçe..."
                  />
                </div>
              </div>
            </div>

            {showDepartmentImpactForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {editingDepartmentImpact ? 'Birim Etkisini Düzenle' : 'Birim Etkisi Ekle'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowDepartmentImpactForm(false);
                        setNewDepartmentImpact({ department_id: '', impact_level: 3, impact_description: '', affected_processes: '', specific_controls: '' });
                        setEditingDepartmentImpact(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Birim <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newDepartmentImpact.department_id}
                        onChange={(e) => setNewDepartmentImpact({ ...newDepartmentImpact, department_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={!!editingDepartmentImpact}
                      >
                        <option value="">Birim seçiniz...</option>
                        {departments
                          .filter(dept => !departmentImpacts.some(impact => impact.department_id === dept.id && impact !== editingDepartmentImpact))
                          .map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Etki Seviyesi <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {[
                          { level: 0, label: 'Etkilenmez', color: 'bg-gray-100 hover:bg-gray-200', textColor: 'text-gray-800' },
                          { level: 1, label: 'Minimal', color: 'bg-green-100 hover:bg-green-200', textColor: 'text-green-800' },
                          { level: 2, label: 'Düşük', color: 'bg-yellow-100 hover:bg-yellow-200', textColor: 'text-yellow-800' },
                          { level: 3, label: 'Orta', color: 'bg-orange-100 hover:bg-orange-200', textColor: 'text-orange-800' },
                          { level: 4, label: 'Yüksek', color: 'bg-red-100 hover:bg-red-200', textColor: 'text-red-800' },
                          { level: 5, label: 'Kritik', color: 'bg-red-200 hover:bg-red-300', textColor: 'text-red-900' }
                        ].map(option => (
                          <label key={option.level} className={`flex items-center gap-3 cursor-pointer p-3 rounded border-2 transition ${newDepartmentImpact.impact_level === option.level ? 'border-blue-500 ' + option.color : 'border-gray-200 ' + option.color}`}>
                            <input
                              type="radio"
                              name="impact_level"
                              value={option.level}
                              checked={newDepartmentImpact.impact_level === option.level}
                              onChange={(e) => setNewDepartmentImpact({ ...newDepartmentImpact, impact_level: parseInt(e.target.value) })}
                              className="w-4 h-4"
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <span className={`font-medium ${option.textColor}`}>{option.label}</span>
                              <span className="text-sm text-gray-500">({option.level}/5)</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Etki Açıklaması
                      </label>
                      <textarea
                        value={newDepartmentImpact.impact_description}
                        onChange={(e) => setNewDepartmentImpact({ ...newDepartmentImpact, impact_description: e.target.value })}
                        placeholder="Bu riskin birime etkisini açıklayın..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Etkilenen Süreçler
                      </label>
                      <textarea
                        value={newDepartmentImpact.affected_processes}
                        onChange={(e) => setNewDepartmentImpact({ ...newDepartmentImpact, affected_processes: e.target.value })}
                        placeholder="Etkilenen süreçleri listeleyin..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Birime Özel Önlemler
                      </label>
                      <textarea
                        value={newDepartmentImpact.specific_controls}
                        onChange={(e) => setNewDepartmentImpact({ ...newDepartmentImpact, specific_controls: e.target.value })}
                        placeholder="Birime özel kontrol ve önlemleri belirtin..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowDepartmentImpactForm(false);
                        setNewDepartmentImpact({ department_id: '', impact_level: 3, impact_description: '', affected_processes: '', specific_controls: '' });
                        setEditingDepartmentImpact(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => {
                        if (!newDepartmentImpact.department_id) {
                          alert('Lütfen birim seçin');
                          return;
                        }

                        if (editingDepartmentImpact) {
                          const index = departmentImpacts.findIndex(i => i === editingDepartmentImpact);
                          const updated = [...departmentImpacts];
                          updated[index] = newDepartmentImpact;
                          setDepartmentImpacts(updated);
                        } else {
                          setDepartmentImpacts([...departmentImpacts, newDepartmentImpact]);
                        }

                        setShowDepartmentImpactForm(false);
                        setNewDepartmentImpact({ department_id: '', impact_level: 3, impact_description: '', affected_processes: '', specific_controls: '' });
                        setEditingDepartmentImpact(null);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingDepartmentImpact ? 'Güncelle' : 'Ekle'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg flex items-center justify-between">
              <button
                onClick={() => {
                  setShowModal(false);
                  setShowControlForm(false);
                  setNewControl({ name: '', description: '', control_type: 'PREVENTIVE', effectiveness: 'EFFECTIVE' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave('DRAFT')}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Taslak Kaydet
                </button>
                <button
                  onClick={() => handleSave('ACTIVE')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Kaydediliyor...' : 'Kaydet ve Kapat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Risk Sil</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {risks.find(r => r.id === deleteConfirm)?.code} - {risks.find(r => r.id === deleteConfirm)?.name} kaydını silmek istediğinize emin misiniz?
                </p>
                <p className="text-sm text-red-600">
                  Bu işlem geri alınamaz. İlişkili kontroller ve faaliyetler de silinecektir.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
