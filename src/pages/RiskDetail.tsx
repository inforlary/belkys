import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { ArrowLeft, Info, BarChart3, Shield, Activity, TrendingUp, History, CreditCard as Edit2, Trash2, Plus, X, Save, AlertTriangle, MoreVertical, ChevronDown, Users, Network, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Risk {
  id: string;
  code: string;
  name: string;
  description: string;
  causes: string;
  consequences: string;
  category_id: string;
  owner_department_id: string;
  objective_id: string;
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
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  review_period: string | null;
  last_review_date: string | null;
  next_review_date: string | null;
  identified_date: string;
  identified_by_id: string;
  categories?: Array<{ category_id: string; category: { id: string; code: string; name: string; color: string } }>;
  department?: { name: string };
  approved_by_profile?: { full_name: string };
  coordination_department?: { name: string };
  objective?: { code: string; title: string };
  goal?: { code: string; title: string };
  identified_by?: { full_name: string };
  related_goal?: { code: string; title: string };
  related_activity?: { code: string; name: string };
  related_process?: { code: string; name: string };
}

interface RiskAssessment {
  id: string;
  assessed_at: string;
  assessed_by: string;
  assessed_by_name?: string;
  inherent_probability: number;
  inherent_impact: number;
  inherent_score: number;
  residual_probability: number;
  residual_impact: number;
  residual_score: number;
  notes: string | null;
}

interface RiskRelation {
  id: string;
  relation_type: string;
  description: string | null;
  direction: 'OUTGOING' | 'INCOMING';
  related_risk_id: string;
  related_risk_code: string;
  related_risk_name: string;
  related_risk_level: string;
  related_risk_score: number;
}

interface RiskControl {
  id: string;
  name: string;
  description: string;
  control_type: string;
  control_nature: string;
  design_effectiveness: number;
  operating_effectiveness: number;
  responsible_department_id: string;
  responsible_department?: { name: string };
}

interface RiskTreatment {
  id: string;
  code: string;
  title: string;
  description: string;
  treatment_type: string;
  responsible_department_id: string;
  responsible_person_id: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  progress_percent: number;
  status: string;
  responsible_department?: { name: string };
  responsible_person?: { full_name: string };
}

interface RiskIndicator {
  id: string;
  code: string;
  name: string;
  description: string;
  indicator_type: string;
  unit_of_measure: string;
  measurement_frequency: string;
  green_threshold: string;
  yellow_threshold: string;
  red_threshold: string;
  direction: string;
  target_value: number;
}

interface DepartmentImpact {
  id: string;
  department_id: string;
  impact_level: number;
  impact_description: string;
  affected_processes: string;
  specific_controls: string;
  department: { name: string };
}

function getRiskScoreBadge(score: number) {
  if (score >= 20) return { color: 'bg-gray-800 text-white', emoji: '⬛', label: 'Kritik' };
  if (score >= 15) return { color: 'bg-red-500 text-white', emoji: '🔴', label: 'Çok Yüksek' };
  if (score >= 10) return { color: 'bg-orange-500 text-white', emoji: '🟠', label: 'Yüksek' };
  if (score >= 5) return { color: 'bg-yellow-500 text-black', emoji: '🟡', label: 'Orta' };
  return { color: 'bg-green-500 text-white', emoji: '🟢', label: 'Düşük' };
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
  return statusMap[status] || { color: 'bg-gray-200 text-gray-800', label: status };
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

function getTreatmentStatusBadge(status: string) {
  const statusMap: Record<string, { color: string; emoji: string; label: string }> = {
    PLANNED: { color: 'bg-gray-200 text-gray-800', emoji: '⚪', label: 'Başlamadı' },
    IN_PROGRESS: { color: 'bg-yellow-500 text-white', emoji: '🟡', label: 'Devam Ediyor' },
    COMPLETED: { color: 'bg-green-500 text-white', emoji: '🟢', label: 'Tamamlandı' },
    DELAYED: { color: 'bg-red-500 text-white', emoji: '🔴', label: 'Gecikmiş' },
    CANCELLED: { color: 'bg-gray-500 text-white', emoji: '⚫', label: 'İptal' }
  };
  return statusMap[status] || statusMap['PLANNED'];
}

function getReviewPeriodLabel(period: string | null) {
  const periodMap: Record<string, string> = {
    MONTHLY: 'Aylık',
    QUARTERLY: 'Çeyreklik (3 ay)',
    SEMI_ANNUAL: '6 Aylık',
    ANNUAL: 'Yıllık'
  };
  return period ? periodMap[period] || period : '-';
}

function getReviewStatus(nextReviewDate: string | null) {
  if (!nextReviewDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reviewDate = new Date(nextReviewDate);
  reviewDate.setHours(0, 0, 0, 0);

  const diffTime = reviewDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'overdue',
      message: `${Math.abs(diffDays)} gün gecikmiş`,
      color: 'bg-red-100 border-red-300 text-red-800',
      icon: '🔴'
    };
  } else if (diffDays <= 7) {
    return {
      status: 'warning',
      message: `${diffDays} gün kaldı`,
      color: 'bg-yellow-100 border-yellow-300 text-yellow-800',
      icon: '⚠️'
    };
  }

  return {
    status: 'ok',
    message: `${diffDays} gün kaldı`,
    color: 'bg-green-100 border-green-300 text-green-800',
    icon: '✅'
  };
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

export default function RiskDetail() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const riskId = currentPath.split('/').pop() || '';
  console.log('[RiskDetail] Component mounted');
  console.log('[RiskDetail] currentPath:', currentPath);
  console.log('[RiskDetail] riskId:', riskId);
  console.log('[RiskDetail] profile?.organization_id:', profile?.organization_id);

  const [activeTab, setActiveTab] = useState('general');
  const [risk, setRisk] = useState<Risk | null>(null);
  const [controls, setControls] = useState<RiskControl[]>([]);
  const [departmentImpacts, setDepartmentImpacts] = useState<DepartmentImpact[]>([]);
  const [treatments, setTreatments] = useState<RiskTreatment[]>([]);
  const [indicators, setIndicators] = useState<RiskIndicator[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [riskCategories, setRiskCategories] = useState<string[]>([]);

  const [showControlModal, setShowControlModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<RiskIndicator | null>(null);
  const [deletingIndicator, setDeletingIndicator] = useState<RiskIndicator | null>(null);
  const [editingControl, setEditingControl] = useState<RiskControl | null>(null);
  const [deletingControl, setDeletingControl] = useState<RiskControl | null>(null);
  const [controlDropdown, setControlDropdown] = useState<string | null>(null);
  const [treatmentDropdown, setTreatmentDropdown] = useState<string | null>(null);
  const [indicatorDropdown, setIndicatorDropdown] = useState<string | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  const [riskRelations, setRiskRelations] = useState<RiskRelation[]>([]);
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [relationFormData, setRelationFormData] = useState({
    target_risk_id: '',
    relation_type: 'TRIGGERS',
    description: ''
  });
  const [availableRisks, setAvailableRisks] = useState<any[]>([]);

  useEffect(() => {
    console.log('[RiskDetail] useEffect triggered');
    console.log('[RiskDetail] riskId:', riskId, 'Type:', typeof riskId);
    console.log('[RiskDetail] profile?.organization_id:', profile?.organization_id);
    if (riskId && profile?.organization_id) {
      console.log('[RiskDetail] Calling loadData...');
      loadData();
    } else {
      console.log('[RiskDetail] NOT calling loadData - missing riskId or organization_id');
    }
  }, [riskId, profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);
      console.log('[RiskDetail] loadData started');
      console.log('[RiskDetail] Loading risk with ID:', riskId);
      console.log('[RiskDetail] Organization ID:', profile?.organization_id);

      const [riskRes, controlsRes, treatmentsRes, indicatorsRes, departmentImpactsRes, assessmentsRes, deptsRes, profilesRes, categoriesRes, riskCategoriesRes, goalsRes, relationsRes, availableRisksRes] = await Promise.all([
        supabase
          .from('risks')
          .select(`
            *,
            categories:risk_category_mappings(category_id, category:risk_categories(id, code, name, color)),
            department:departments!owner_department_id(name),
            coordination_department:departments!coordination_department_id(name),
            objective:objectives(code, title),
            goal:goals!goal_id(code, title),
            identified_by:profiles!identified_by_id(full_name),
            approved_by_profile:profiles!approved_by(full_name),
            related_goal:goals!related_goal_id(code, title),
            related_activity:activities!related_activity_id(code, name),
            related_process:qm_processes!related_process_id(code, name)
          `)
          .eq('id', riskId)
          .single(),
        supabase
          .from('risk_controls')
          .select(`
            *,
            responsible_department:departments(name)
          `)
          .eq('risk_id', riskId),
        supabase
          .from('risk_treatments')
          .select(`
            *,
            responsible_department:departments(name),
            responsible_person:profiles(full_name)
          `)
          .eq('risk_id', riskId),
        supabase
          .from('risk_indicators')
          .select('*')
          .eq('risk_id', riskId),
        supabase
          .from('rm_risk_department_impacts')
          .select(`
            *,
            department:departments(name)
          `)
          .eq('risk_id', riskId)
          .order('impact_level', { ascending: false }),
        supabase
          .from('rm_risk_assessments')
          .select(`
            *,
            assessed_by_profile:profiles!assessed_by(full_name)
          `)
          .eq('risk_id', riskId)
          .order('assessed_at', { ascending: false }),
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile?.organization_id)
          .order('full_name'),
        supabase
          .from('risk_categories')
          .select('id, code, name, type, color')
          .or(`organization_id.is.null,organization_id.eq.${profile?.organization_id}`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('risk_category_mappings')
          .select('category_id')
          .eq('risk_id', riskId),
        supabase
          .from('goals')
          .select('id, code, title, department_id')
          .eq('organization_id', profile?.organization_id)
          .order('code'),
        supabase.rpc('get_related_risks', { p_risk_id: riskId }),
        supabase
          .from('risks')
          .select('id, code, name, risk_level, residual_score')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .neq('id', riskId)
          .order('code')
      ]);

      console.log('[RiskDetail] Risk query result:', riskRes);
      console.log('[RiskDetail] Risk data:', riskRes.data);
      console.log('[RiskDetail] Risk error:', riskRes.error);

      if (riskRes.error) {
        console.error('[RiskDetail] Risk query error:', riskRes.error);
        throw riskRes.error;
      }

      if (!riskRes.data) {
        console.error('[RiskDetail] Risk not found for ID:', riskId);
        alert('Risk bulunamadı!');
        navigate('risk-management/risks');
        return;
      }

      console.log('[RiskDetail] Risk loaded successfully:', riskRes.data.name);

      setRisk(riskRes.data);
      setControls(controlsRes.data || []);

      const assessmentsData = (assessmentsRes.data || []).map((a: any) => ({
        ...a,
        assessed_by_name: a.assessed_by_profile?.full_name
      }));
      setAssessments(assessmentsData);
      setTreatments(treatmentsRes.data || []);
      setIndicators(indicatorsRes.data || []);
      setDepartmentImpacts(departmentImpactsRes.data || []);
      setDepartments(deptsRes.data || []);
      setProfiles(profilesRes.data || []);
      setCategories(categoriesRes.data || []);
      setRiskCategories((riskCategoriesRes.data || []).map((m: any) => m.category_id));
      setGoals(goalsRes.data || []);
      setRiskRelations(relationsRes.data || []);
      setAvailableRisks(availableRisksRes.data || []);
    } catch (error) {
      console.error('[RiskDetail] Error loading risk:', error);
      alert('Risk yüklenirken bir hata oluştu: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase.from('risks').delete().eq('id', riskId);
      if (error) throw error;
      navigate('risk-management/risks');
    } catch (error) {
      console.error('Error deleting risk:', error);
      alert('Risk silinirken hata oluştu.');
    }
  }

  async function handleSaveEdit() {
    if (!editFormData) return;

    if (!editFormData.name || editFormData.category_ids.length === 0 || !editFormData.owner_department_id) {
      alert('Lütfen zorunlu alanları doldurun! (Risk Adı, Kategori, Sorumlu Birim)');
      return;
    }

    try {
      const residualScore = editFormData.residual_likelihood * editFormData.residual_impact;

      const getRiskLevel = (score: number) => {
        if (score >= 20) return 'CRITICAL';
        if (score >= 15) return 'HIGH';
        if (score >= 9) return 'MEDIUM';
        return 'LOW';
      };

      const updateData: any = {
        name: editFormData.name,
        description: editFormData.description,
        causes: editFormData.causes,
        consequences: editFormData.consequences,
        owner_department_id: editFormData.owner_department_id,
        goal_id: editFormData.goal_id && editFormData.goal_id.trim() !== '' ? editFormData.goal_id : null,
        risk_source: editFormData.risk_source,
        risk_relation: editFormData.risk_relation,
        control_level: editFormData.control_level,
        inherent_likelihood: editFormData.inherent_likelihood,
        inherent_impact: editFormData.inherent_impact,
        residual_likelihood: editFormData.residual_likelihood,
        residual_impact: editFormData.residual_impact,
        target_probability: editFormData.target_probability || null,
        target_impact: editFormData.target_impact || null,
        target_date: editFormData.target_date || null,
        risk_level: getRiskLevel(residualScore),
        risk_response: editFormData.risk_response,
        response_rationale: editFormData.response_rationale,
        status: editFormData.status
      };

      const { error: updateError } = await supabase
        .from('risks')
        .update(updateData)
        .eq('id', riskId);

      if (updateError) throw updateError;

      await supabase
        .from('risk_category_mappings')
        .delete()
        .eq('risk_id', riskId);

      if (editFormData.category_ids && editFormData.category_ids.length > 0) {
        const categoryMappings = editFormData.category_ids.map((categoryId: string) => ({
          risk_id: riskId,
          category_id: categoryId
        }));

        const { error: mappingError } = await supabase
          .from('risk_category_mappings')
          .insert(categoryMappings);

        if (mappingError) throw mappingError;
      }

      alert('Risk başarıyla güncellendi!');
      setShowEditModal(false);
      setEditFormData(null);
      loadData();
    } catch (error: any) {
      console.error('Risk güncellenirken hata:', error);
      console.error('Hata detayı:', JSON.stringify(error, null, 2));
      alert('Risk güncellenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  }

  async function handleApprovalStatusChange(newStatus: string) {
    if (!risk) return;

    if (newStatus === 'REJECTED' && !rejectionReason.trim()) {
      alert('Red nedeni zorunludur!');
      return;
    }

    try {
      const updateData: any = {
        approval_status: newStatus
      };

      if (newStatus === 'APPROVED') {
        updateData.approved_by = profile?.id;
        updateData.approved_at = new Date().toISOString();
      }

      if (newStatus === 'REJECTED') {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('risks')
        .update(updateData)
        .eq('id', riskId);

      if (error) throw error;

      alert('Risk durumu başarıyla güncellendi!');
      setShowApprovalModal(false);
      setRejectionReason('');
      setApprovalAction('');
      loadData();
    } catch (error: any) {
      console.error('Durum güncellenirken hata:', error);
      alert('Durum güncellenirken hata oluştu!');
    }
  }

  function getAvailableActions() {
    if (!risk) return [];

    const actions = [];
    const status = risk.approval_status;

    if (status === 'DRAFT') {
      actions.push({ action: 'IN_REVIEW', label: 'İncelemeye Gönder', color: 'bg-blue-600 hover:bg-blue-700' });
    }

    if (status === 'IN_REVIEW') {
      actions.push({ action: 'PENDING_APPROVAL', label: 'Onaya Gönder', color: 'bg-orange-600 hover:bg-orange-700' });
      actions.push({ action: 'DRAFT', label: 'Taslağa Döndür', color: 'bg-gray-600 hover:bg-gray-700' });
    }

    if (status === 'PENDING_APPROVAL') {
      actions.push({ action: 'APPROVED', label: 'Onayla', color: 'bg-green-600 hover:bg-green-700' });
      actions.push({ action: 'REJECTED', label: 'Reddet', color: 'bg-red-600 hover:bg-red-700' });
    }

    if (status === 'REJECTED') {
      actions.push({ action: 'DRAFT', label: 'Taslağa Döndür', color: 'bg-gray-600 hover:bg-gray-700' });
    }

    if (status === 'APPROVED') {
      actions.push({ action: 'CLOSED', label: 'Kapat', color: 'bg-gray-800 hover:bg-gray-900' });
    }

    return actions;
  }

  const tabs = [
    { id: 'general', label: 'Genel Bilgiler', icon: Info },
    { id: 'assessment', label: 'Değerlendirme', icon: BarChart3 },
    { id: 'history', label: 'Değerlendirme Tarihçesi', icon: History },
    { id: 'controls', label: 'Kontroller', icon: Shield },
    { id: 'treatments', label: 'Faaliyetler', icon: Activity },
    ...(risk?.risk_relation === 'CORPORATE' ? [{ id: 'impacts', label: 'Birim Etkileri', icon: Users }] : []),
    { id: 'indicators', label: 'Göstergeler', icon: TrendingUp },
    { id: 'relations', label: 'Risk İlişkileri', icon: Network }
  ];

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'director';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-16 h-16 text-gray-400" />
        <div className="text-gray-500 text-lg">Risk bulunamadı</div>
        <button
          onClick={() => navigate('risk-management/risks')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Risk Listesine Dön
        </button>
      </div>
    );
  }

  const inherentBadge = getRiskScoreBadge(risk.inherent_score);
  const residualBadge = getRiskScoreBadge(risk.residual_score);
  const statusBadge = getStatusBadge(risk.status);
  const approvalBadge = getApprovalStatusBadge(risk.approval_status);

  const activeControls = controls.filter(c => c.operating_effectiveness >= 3).length;
  const activeTreatments = treatments.filter(t => t.status === 'IN_PROGRESS' || t.status === 'DELAYED').length;
  const availableActions = getAvailableActions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('risk-management/risks')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-sm text-gray-500 mb-1">
              Risk Yönetimi {'>'} Riskler {'>'} {risk.code}
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {risk.code} - {risk.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${approvalBadge.color} flex items-center gap-1`}>
                <span>{approvalBadge.emoji}</span>
                <span>{approvalBadge.label}</span>
              </span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditFormData({
                  name: risk.name,
                  description: risk.description || '',
                  causes: risk.causes || '',
                  consequences: risk.consequences || '',
                  owner_department_id: risk.owner_department_id,
                  goal_id: risk.goal_id || '',
                  risk_source: risk.risk_source || 'INTERNAL',
                  risk_relation: risk.risk_relation || 'OPERATIONAL',
                  control_level: risk.control_level || 'CONTROLLABLE',
                  inherent_likelihood: risk.inherent_likelihood,
                  inherent_impact: risk.inherent_impact,
                  residual_likelihood: risk.residual_likelihood,
                  residual_impact: risk.residual_impact,
                  target_probability: (risk as any).target_probability || null,
                  target_impact: (risk as any).target_impact || null,
                  target_date: (risk as any).target_date || '',
                  risk_response: risk.risk_response,
                  response_rationale: risk.response_rationale || '',
                  status: risk.status,
                  category_ids: [...riskCategories]
                });
                setShowEditModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Edit2 className="w-4 h-4" />
              Düzenle
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              Sil
            </button>
          </div>
        )}
      </div>

      {availableActions.length > 0 && isAdmin && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-semibold text-gray-900">Onay Durumu Değiştir</div>
                <div className="text-sm text-gray-600">Risk için mevcut durum değişiklik aksiyonları</div>
              </div>
            </div>
            <div className="flex gap-2">
              {availableActions.map(action => (
                <button
                  key={action.action}
                  onClick={() => {
                    setApprovalAction(action.action);
                    if (action.action === 'REJECTED') {
                      setShowApprovalModal(true);
                    } else {
                      if (confirm(`Risk durumunu "${action.label}" olarak değiştirmek istediğinizden emin misiniz?`)) {
                        handleApprovalStatusChange(action.action);
                      }
                    }
                  }}
                  className={`px-4 py-2 text-white rounded-lg transition ${action.color}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {risk.approval_status === 'REJECTED' && risk.rejection_reason && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-red-900 mb-1">Risk Reddedildi</div>
              <div className="text-sm text-red-700 mb-2">Red Nedeni:</div>
              <div className="text-sm text-gray-700 bg-white p-3 rounded border border-red-200 whitespace-pre-wrap">
                {risk.rejection_reason}
              </div>
            </div>
          </div>
        </Card>
      )}

      {risk.approval_status === 'APPROVED' && risk.approved_by_profile && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <div className="font-semibold text-green-900 mb-1">Risk Onaylandı</div>
              <div className="text-sm text-gray-700">
                <span className="font-medium">{risk.approved_by_profile.full_name}</span> tarafından{' '}
                {risk.approved_at && new Date(risk.approved_at).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })} tarihinde onaylandı.
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">DOĞAL RİSK</div>
          <div className={`text-4xl font-bold ${inherentBadge.color} inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto`}>
            <span>{inherentBadge.emoji}</span>
            <span className="ml-1 text-2xl">{risk.inherent_score}</span>
          </div>
          <div className="text-sm text-gray-700 mt-2 font-medium">{inherentBadge.label}</div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">ARTIK RİSK</div>
          <div className={`text-4xl font-bold ${residualBadge.color} inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto`}>
            <span>{residualBadge.emoji}</span>
            <span className="ml-1 text-2xl">{risk.residual_score}</span>
          </div>
          <div className="text-sm text-gray-700 mt-2 font-medium">{residualBadge.label}</div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">KONTROL SAYISI</div>
          <div className="text-4xl font-bold text-blue-600 my-4">{activeControls}</div>
          <div className="text-sm text-gray-700">mevcut</div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">AÇIK FAALİYET</div>
          <div className="text-4xl font-bold text-orange-600 my-4">{activeTreatments}</div>
          <div className="text-sm text-gray-700">devam ediyor</div>
        </Card>
      </div>

      <Card>
        <div className="border-b border-gray-200">
          <div className="flex gap-2 px-6 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Risk Kodu</div>
                    <div className="text-base font-medium text-gray-900">{risk.code}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Risk Adı</div>
                    <div className="text-base font-medium text-gray-900">{risk.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Kategori</div>
                    <div className="text-base font-medium text-gray-900">
                      {risk.categories && risk.categories.length > 0
                        ? risk.categories.map((c: any) => c.category?.name).filter(Boolean).join(', ')
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Sorumlu Birim</div>
                    <div className="text-base font-medium text-gray-900">{risk.department?.name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Risk Kaynağı</div>
                    <div className="text-base font-medium text-gray-900 flex items-center gap-2">
                      <span>{risk.risk_source === 'EXTERNAL' ? '🌍' : '🏠'}</span>
                      <span>{risk.risk_source === 'EXTERNAL' ? 'Dış Risk' : 'İç Risk'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">İlişki Türü</div>
                    <div className="text-base font-medium">
                      {(() => {
                        const relationBadge = getRiskRelationBadge(risk.risk_relation);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${relationBadge.color}`}>
                            <span>{relationBadge.emoji}</span>
                            <span>{relationBadge.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Kontrol Düzeyi</div>
                    <div className="text-base font-medium">
                      {(() => {
                        const controlBadge = getControlLevelBadge(risk.control_level);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${controlBadge.color}`}>
                            <span>{controlBadge.emoji}</span>
                            <span>{controlBadge.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Tanımlama Tarihi</div>
                    <div className="text-base font-medium text-gray-900">
                      {risk.identified_date ? new Date(risk.identified_date).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Tanımlayan</div>
                    <div className="text-base font-medium text-gray-900">{risk.identified_by?.full_name || '-'}</div>
                  </div>
                </div>
              </div>

              {(risk.review_period || risk.next_review_date) && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Gözden Geçirme Bilgileri</h3>
                    {risk.next_review_date && getReviewStatus(risk.next_review_date) && (
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium ${getReviewStatus(risk.next_review_date)?.color}`}>
                        <span>{getReviewStatus(risk.next_review_date)?.icon}</span>
                        <span>{getReviewStatus(risk.next_review_date)?.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {risk.review_period && (
                      <div>
                        <div className="text-sm text-gray-600">Periyot</div>
                        <div className="text-base font-medium text-gray-900">{getReviewPeriodLabel(risk.review_period)}</div>
                      </div>
                    )}
                    {risk.last_review_date && (
                      <div>
                        <div className="text-sm text-gray-600">Son Gözden Geçirme</div>
                        <div className="text-base font-medium text-gray-900">
                          {new Date(risk.last_review_date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    )}
                    {risk.next_review_date && (
                      <div>
                        <div className="text-sm text-gray-600">Sonraki Gözden Geçirme</div>
                        <div className="text-base font-medium text-gray-900">
                          {new Date(risk.next_review_date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {risk.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Risk Açıklaması</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{risk.description}</p>
                </div>
              )}

              {risk.causes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Risk Nedeni</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{risk.causes}</p>
                </div>
              )}

              {(risk.related_goal || risk.related_activity || risk.related_process) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">İlişkili Kayıtlar</h4>
                  <div className="space-y-2">
                    {risk.related_goal && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-600">Bağlı Hedef:</span>
                        <button
                          onClick={() => navigate(`/goals`)}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {risk.related_goal.code} - {risk.related_goal.title}
                        </button>
                      </div>
                    )}
                    {risk.related_activity && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-600">Bağlı Faaliyet:</span>
                        <button
                          onClick={() => navigate(`/activities`)}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {risk.related_activity.code} - {risk.related_activity.name}
                        </button>
                      </div>
                    )}
                    {risk.related_process && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-600">Bağlı Süreç:</span>
                        <button
                          onClick={() => navigate(`/quality/processes`)}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {risk.related_process.code} - {risk.related_process.name}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {risk.consequences && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Olası Sonuçlar</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{risk.consequences}</p>
                </div>
              )}

              {risk.objective && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">İlişkili Stratejik Hedef (Objective)</h4>
                  <div className="text-gray-700">
                    {risk.objective.code} - {risk.objective.title}
                  </div>
                </div>
              )}

              {risk.goal && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">İlişkili Hedef</h4>
                  <div className="text-gray-700">
                    {risk.goal.code} - {risk.goal.title}
                  </div>
                </div>
              )}

              {(risk.control_level === 'PARTIALLY_CONTROLLABLE' || risk.control_level === 'UNCONTROLLABLE') &&
               (risk.external_organization || risk.external_contact || risk.coordination_department) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-amber-900 mb-3">Dış Kurum Bilgileri</h4>
                  <div className="space-y-2">
                    {risk.external_organization && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">Yetkili Dış Kurum:</span>
                        <p className="text-sm text-gray-900 mt-1">{risk.external_organization}</p>
                      </div>
                    )}
                    {risk.external_contact && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">İletişim Bilgisi:</span>
                        <p className="text-sm text-gray-900 mt-1">{risk.external_contact}</p>
                      </div>
                    )}
                    {risk.coordination_department && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">Koordinasyon Birimimiz:</span>
                        <p className="text-sm text-gray-900 mt-1">{risk.coordination_department.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assessment' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Risk Değerlendirmesi</h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Doğal Risk</h4>
                  <p className="text-xs text-gray-600 mb-3">(Kontrol öncesi)</p>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Olasılık:</span>
                      <span className="ml-2 font-medium">{risk.inherent_likelihood} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.inherent_likelihood]}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Etki:</span>
                      <span className="ml-2 font-medium">{risk.inherent_impact} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.inherent_impact]}</span>
                    </div>
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-sm text-gray-600">Skor:</span>
                      <span className={`ml-2 text-xl font-bold inline-flex items-center gap-1 ${inherentBadge.color} px-3 py-1 rounded`}>
                        <span>{inherentBadge.emoji}</span>
                        <span>{risk.inherent_score}</span>
                        <span className="text-sm">({inherentBadge.label})</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs text-gray-600 mb-2 text-center">ETKİ →</div>
                    <div className="grid grid-cols-6 gap-1">
                      <div className="text-xs text-gray-600 flex items-center justify-center">↓ O</div>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="text-xs text-center text-gray-600">{i}</div>
                      ))}
                      {[5, 4, 3, 2, 1].map(likelihood => (
                        <>
                          <div key={`l${likelihood}`} className="text-xs flex items-center justify-center text-gray-600">{likelihood}</div>
                          {[1, 2, 3, 4, 5].map(impact => {
                            const isSelected = likelihood === risk.inherent_likelihood && impact === risk.inherent_impact;
                            const score = likelihood * impact;
                            const badge = getRiskScoreBadge(score);
                            return (
                              <div
                                key={`${likelihood}-${impact}`}
                                className={`aspect-square rounded ${isSelected ? 'ring-2 ring-blue-600' : ''} ${badge.color} flex items-center justify-center text-xs font-bold`}
                              >
                                {isSelected && '●'}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Artık Risk</h4>
                  <p className="text-xs text-gray-600 mb-3">(Kontrol sonrası)</p>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Olasılık:</span>
                      <span className="ml-2 font-medium">{risk.residual_likelihood} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.residual_likelihood]}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Etki:</span>
                      <span className="ml-2 font-medium">{risk.residual_impact} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.residual_impact]}</span>
                    </div>
                    <div className="pt-3 border-t border-green-200">
                      <span className="text-sm text-gray-600">Skor:</span>
                      <span className={`ml-2 text-xl font-bold inline-flex items-center gap-1 ${residualBadge.color} px-3 py-1 rounded`}>
                        <span>{residualBadge.emoji}</span>
                        <span>{risk.residual_score}</span>
                        <span className="text-sm">({residualBadge.label})</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs text-gray-600 mb-2 text-center">ETKİ →</div>
                    <div className="grid grid-cols-6 gap-1">
                      <div className="text-xs text-gray-600 flex items-center justify-center">↓ O</div>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="text-xs text-center text-gray-600">{i}</div>
                      ))}
                      {[5, 4, 3, 2, 1].map(likelihood => (
                        <>
                          <div key={`l${likelihood}`} className="text-xs flex items-center justify-center text-gray-600">{likelihood}</div>
                          {[1, 2, 3, 4, 5].map(impact => {
                            const isSelected = likelihood === risk.residual_likelihood && impact === risk.residual_impact;
                            const score = likelihood * impact;
                            const badge = getRiskScoreBadge(score);
                            return (
                              <div
                                key={`${likelihood}-${impact}`}
                                className={`aspect-square rounded ${isSelected ? 'ring-2 ring-green-600' : ''} ${badge.color} flex items-center justify-center text-xs font-bold`}
                              >
                                {isSelected && '●'}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                  </div>
                </div>

                {(risk as any).target_probability && (risk as any).target_impact ? (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Hedef Risk</h4>
                    <p className="text-xs text-gray-600 mb-3">(Ulaşmak istediğimiz seviye)</p>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-600">Olasılık:</span>
                        <span className="ml-2 font-medium">{(risk as any).target_probability} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][(risk as any).target_probability]}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Etki:</span>
                        <span className="ml-2 font-medium">{(risk as any).target_impact} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][(risk as any).target_impact]}</span>
                      </div>
                      <div className="pt-3 border-t border-purple-200">
                        <span className="text-sm text-gray-600">Skor:</span>
                        <span className={`ml-2 text-xl font-bold inline-flex items-center gap-1 ${getRiskScoreBadge((risk as any).target_score || ((risk as any).target_probability * (risk as any).target_impact)).color} px-3 py-1 rounded`}>
                          <span>{getRiskScoreBadge((risk as any).target_score || ((risk as any).target_probability * (risk as any).target_impact)).emoji}</span>
                          <span>{(risk as any).target_score || ((risk as any).target_probability * (risk as any).target_impact)}</span>
                          <span className="text-sm">({getRiskScoreBadge((risk as any).target_score || ((risk as any).target_probability * (risk as any).target_impact)).label})</span>
                        </span>
                      </div>
                      {(risk as any).target_date && (
                        <div className="pt-3 border-t border-purple-200">
                          <span className="text-sm text-gray-600">Hedef Tarih:</span>
                          <span className="ml-2 font-medium">{new Date((risk as any).target_date).toLocaleDateString('tr-TR')}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6">
                      <div className="text-xs text-gray-600 mb-2 text-center">ETKİ →</div>
                      <div className="grid grid-cols-6 gap-1">
                        <div className="text-xs text-gray-600 flex items-center justify-center">↓ O</div>
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="text-xs text-center text-gray-600">{i}</div>
                        ))}
                        {[5, 4, 3, 2, 1].map(likelihood => (
                          <>
                            <div key={`l${likelihood}`} className="text-xs flex items-center justify-center text-gray-600">{likelihood}</div>
                            {[1, 2, 3, 4, 5].map(impact => {
                              const isSelected = likelihood === (risk as any).target_probability && impact === (risk as any).target_impact;
                              const score = likelihood * impact;
                              const badge = getRiskScoreBadge(score);
                              return (
                                <div
                                  key={`${likelihood}-${impact}`}
                                  className={`aspect-square rounded ${isSelected ? 'ring-2 ring-purple-600' : ''} ${badge.color} flex items-center justify-center text-xs font-bold`}
                                >
                                  {isSelected && '●'}
                                </div>
                              );
                            })}
                          </>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Hedef risk belirlenmemiş</p>
                      <p className="text-xs text-gray-500 mt-1">Risk düzenleyerek hedef belirleyebilirsiniz</p>
                    </div>
                  </div>
                )}
              </div>

              {(risk as any).target_score && (
                <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Risk Azaltma İlerlemesi</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Doğal → Artık Risk</span>
                        <span className="text-sm font-bold text-green-600">
                          {Math.round(((risk.inherent_score - risk.residual_score) / risk.inherent_score) * 100)}% azalma
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, ((risk.inherent_score - risk.residual_score) / risk.inherent_score) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>Skor: {risk.inherent_score}</span>
                        <span>Skor: {risk.residual_score}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Artık → Hedef Risk</span>
                        {risk.residual_score <= (risk as any).target_score ? (
                          <span className="text-sm font-bold text-green-600 flex items-center gap-1">
                            ✓ Hedefe ulaşıldı
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-orange-600">
                            {Math.round(((risk.residual_score - (risk as any).target_score) / risk.residual_score) * 100)}% azalma gerekli
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${
                            risk.residual_score <= (risk as any).target_score ? 'bg-green-500' : 'bg-orange-500'
                          }`}
                          style={{
                            width: risk.residual_score <= (risk as any).target_score
                              ? '100%'
                              : `${Math.min(100, ((risk.residual_score - (risk as any).target_score) / risk.residual_score) * 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>Skor: {risk.residual_score}</span>
                        <span>Hedef: {(risk as any).target_score}</span>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Toplam İlerleme</span>
                        <span className="text-lg font-bold text-blue-600">
                          {Math.round(((risk.inherent_score - risk.residual_score) / (risk.inherent_score - (risk as any).target_score)) * 100)}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Hedefimize ulaşmak için yolun {Math.round(((risk.inherent_score - risk.residual_score) / (risk.inherent_score - (risk as any).target_score)) * 100)}%'ini tamamladık
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Risk Yanıtı</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Strateji:</span>
                    <span className="ml-2 font-medium">
                      {risk.risk_response === 'ACCEPT' && '✓ KABUL ET'}
                      {risk.risk_response === 'MITIGATE' && '🔽 AZALT'}
                      {risk.risk_response === 'TRANSFER' && '↗️ TRANSFER ET'}
                      {risk.risk_response === 'AVOID' && '🚫 KAÇIN'}
                    </span>
                  </div>
                  {risk.response_rationale && (
                    <div>
                      <span className="text-sm text-gray-600">Açıklama:</span>
                      <p className="text-gray-700 mt-1 whitespace-pre-wrap">{risk.response_rationale}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Mevcut Kontroller</h3>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingControl(null);
                      setShowControlModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Ekle
                  </button>
                )}
              </div>

              {controls.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Henüz kontrol eklenmemiş</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {controls.map(control => (
                    <div key={control.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{control.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{control.description}</p>

                          <div className="flex items-center gap-4 mt-3 text-sm">
                            <span className="text-gray-600">
                              Tür: <span className="font-medium">
                                {control.control_type === 'PREVENTIVE' && 'Önleyici'}
                                {control.control_type === 'DETECTIVE' && 'Tespit Edici'}
                                {control.control_type === 'CORRECTIVE' && 'Düzeltici'}
                              </span>
                            </span>
                            {control.responsible_department && (
                              <span className="text-gray-600">
                                Sorumlu: <span className="font-medium">{control.responsible_department.name}</span>
                              </span>
                            )}
                          </div>

                          {(control.design_effectiveness || control.operating_effectiveness) && (
                            <div className="mt-4 space-y-3">
                              <div className="text-xs font-semibold text-gray-700 mb-2">Etkinlik Değerlendirmesi</div>

                              {control.design_effectiveness && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-600">Tasarım Etkinliği</span>
                                    <span className={`text-xs font-semibold ${
                                      control.design_effectiveness >= 4 ? 'text-green-600' :
                                      control.design_effectiveness >= 3 ? 'text-yellow-600' :
                                      'text-red-600'
                                    }`}>
                                      {control.design_effectiveness}/5
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        control.design_effectiveness >= 4 ? 'bg-green-500' :
                                        control.design_effectiveness >= 3 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${(control.design_effectiveness / 5) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {control.operating_effectiveness && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-600">Çalışma Etkinliği</span>
                                    <span className={`text-xs font-semibold ${
                                      control.operating_effectiveness >= 4 ? 'text-green-600' :
                                      control.operating_effectiveness >= 3 ? 'text-yellow-600' :
                                      'text-red-600'
                                    }`}>
                                      {control.operating_effectiveness}/5
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        control.operating_effectiveness >= 4 ? 'bg-green-500' :
                                        control.operating_effectiveness >= 3 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${(control.operating_effectiveness / 5) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {control.effectiveness_notes && (
                                <div className="text-xs text-gray-600 mt-2 italic">
                                  Not: {control.effectiveness_notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="relative">
                            <button
                              onClick={() => setControlDropdown(controlDropdown === control.id ? null : control.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                            {controlDropdown === control.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setControlDropdown(null);
                                  }}
                                />
                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                                  <button
                                    onClick={() => {
                                      setEditingControl(control);
                                      setShowControlModal(true);
                                      setControlDropdown(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Düzenle
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeletingControl(control);
                                      setControlDropdown(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Sil
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'treatments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Risk Faaliyetleri</h3>
                {isAdmin && (
                  <button
                    onClick={() => setShowTreatmentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Ekle
                  </button>
                )}
              </div>

              {treatments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Henüz faaliyet eklenmemiş</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {treatments.map(treatment => {
                    const statusBadge = getTreatmentStatusBadge(treatment.status);
                    const isDelayed = treatment.status === 'DELAYED';
                    return (
                      <div key={treatment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{treatment.code} {treatment.title}</h4>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.color}`}>
                                {statusBadge.emoji} {statusBadge.label}
                              </span>
                            </div>
                            {treatment.description && (
                              <p className="text-sm text-gray-600 mt-1">{treatment.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="text-gray-600">
                                Sorumlu: <span className="font-medium">{treatment.responsible_department?.name || '-'}</span>
                              </span>
                              <span className="text-gray-600">
                                Hedef: <span className="font-medium">
                                  {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
                                </span>
                              </span>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600">İlerleme</span>
                                <span className="font-medium">{treatment.progress_percent}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${isDelayed ? 'bg-red-500' : treatment.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`}
                                  style={{ width: `${treatment.progress_percent}%` }}
                                />
                              </div>
                            </div>
                            {isDelayed && (
                              <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                Gecikme var
                              </div>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="relative">
                              <button
                                onClick={() => setTreatmentDropdown(treatmentDropdown === treatment.id ? null : treatment.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              {treatmentDropdown === treatment.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTreatmentDropdown(null);
                                    }}
                                  />
                                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                                    <button
                                      onClick={() => {
                                        navigate(`risk-management/treatments/${treatment.id}`);
                                        setTreatmentDropdown(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                      Detay
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'impacts' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Birim Etki Analizi</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Bu kurumsal riskin farklı birimlere olan etkilerini görüntüleyin.
                </p>
              </div>

              {departmentImpacts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Henüz birim etki analizi yapılmamış</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                    {[0, 1, 2, 3, 4, 5].map(level => {
                      const count = departmentImpacts.filter(i => i.impact_level === level).length;
                      const labels = ['Etkilenmez', 'Minimal', 'Düşük', 'Orta', 'Yüksek', 'Kritik'];
                      const colors = ['bg-gray-100 text-gray-700', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700', 'bg-red-200 text-red-900'];

                      return (
                        <Card key={level} className={`p-4 text-center ${colors[level]}`}>
                          <div className="text-2xl font-bold mb-1">{count}</div>
                          <div className="text-xs font-medium">{labels[level]}</div>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="space-y-4">
                    {departmentImpacts.map(impact => {
                      const impactLabel = ['Etkilenmez', 'Minimal', 'Düşük', 'Orta', 'Yüksek', 'Kritik'][impact.impact_level];
                      const impactColor = ['bg-gray-200', 'bg-green-200', 'bg-yellow-200', 'bg-orange-300', 'bg-red-400', 'bg-red-600'][impact.impact_level];
                      const impactTextColor = ['text-gray-700', 'text-green-700', 'text-yellow-700', 'text-orange-700', 'text-red-700', 'text-red-900'][impact.impact_level];

                      return (
                        <Card key={impact.id} className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">{impact.department.name}</h4>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 max-w-[200px] bg-gray-200 rounded-full h-3">
                                  <div
                                    className={`${impactColor} h-3 rounded-full transition-all`}
                                    style={{ width: `${(impact.impact_level / 5) * 100}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-semibold ${impactTextColor}`}>
                                  {impactLabel} ({impact.impact_level}/5)
                                </span>
                              </div>
                            </div>
                          </div>

                          {impact.impact_description && (
                            <div className="mb-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-1">Etki Açıklaması</h5>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap">{impact.impact_description}</p>
                            </div>
                          )}

                          {impact.affected_processes && (
                            <div className="mb-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-1">Etkilenen Süreçler</h5>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap">{impact.affected_processes}</p>
                            </div>
                          )}

                          {impact.specific_controls && (
                            <div>
                              <h5 className="text-sm font-semibold text-gray-700 mb-1">Birime Özel Önlemler</h5>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap">{impact.specific_controls}</p>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'indicators' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Risk Göstergeleri (KRI)</h3>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingIndicator(null);
                      setShowIndicatorModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Ekle
                  </button>
                )}
              </div>

              {indicators.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Henüz gösterge eklenmemiş</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {indicators.map(indicator => (
                    <div key={indicator.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{indicator.code} {indicator.name}</h4>
                          {indicator.description && (
                            <p className="text-sm text-gray-600 mt-1">{indicator.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-600">
                              Birim: <span className="font-medium">{indicator.unit_of_measure}</span>
                            </span>
                            <span className="text-gray-600">
                              Sıklık: <span className="font-medium">{indicator.measurement_frequency}</span>
                            </span>
                            <span className="text-gray-600">
                              Yön: <span className="font-medium">
                                {indicator.direction === 'LOWER_BETTER' ? '↓ Düşük iyi' : indicator.direction === 'HIGHER_BETTER' ? '↑ Yüksek iyi' : '🎯 Hedef'}
                              </span>
                            </span>
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-gray-600">Eşikler:</span>
                            <span className="ml-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white rounded text-xs">
                                🟢 {indicator.green_threshold}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500 text-white rounded text-xs ml-1">
                                🟡 {indicator.yellow_threshold}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white rounded text-xs ml-1">
                                🔴 {indicator.red_threshold}
                              </span>
                            </span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="relative">
                            <button
                              onClick={() => setIndicatorDropdown(indicatorDropdown === indicator.id ? null : indicator.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                            {indicatorDropdown === indicator.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIndicatorDropdown(null);
                                  }}
                                />
                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                                  <button
                                    onClick={() => {
                                      setEditingIndicator(indicator);
                                      setShowIndicatorModal(true);
                                      setIndicatorDropdown(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Düzenle
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeletingIndicator(indicator);
                                      setIndicatorDropdown(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Sil
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Değerlendirme Tarihçesi</h3>

                {assessments.length > 0 ? (
                  <>
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">Son Değerlendirme</div>
                          <div className="text-lg font-semibold text-gray-900">
                            {new Date(assessments[0].assessed_at).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Değerlendiren</div>
                          <div className="text-lg font-semibold text-gray-900">
                            {assessments[0].assessed_by_name || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Artık Risk Skoru</div>
                          <div className="text-2xl font-bold text-blue-600">
                            {assessments[0].residual_score}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Risk Skoru Değişim Grafiği</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={[...assessments].reverse().map(a => ({
                            date: new Date(a.assessed_at).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
                            'Doğal Risk': a.inherent_score,
                            'Artık Risk': a.residual_score
                          }))}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 25]} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="Doğal Risk" stroke="#ef4444" strokeWidth={2} />
                          <Line type="monotone" dataKey="Artık Risk" stroke="#3b82f6" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tarih
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Değerlendiren
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Doğal Risk
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Artık Risk
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Not
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {assessments.map((assessment) => (
                            <tr key={assessment.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(assessment.assessed_at).toLocaleDateString('tr-TR', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {assessment.assessed_by_name || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="text-sm text-gray-900">
                                  {assessment.inherent_probability} × {assessment.inherent_impact} =
                                  <span className="ml-2 font-semibold text-red-600">
                                    {assessment.inherent_score}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="text-sm text-gray-900">
                                  {assessment.residual_probability} × {assessment.residual_impact} =
                                  <span className="ml-2 font-semibold text-blue-600">
                                    {assessment.residual_score}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {assessment.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Henüz değerlendirme tarihçesi bulunmuyor</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Risk İlişkileri</h3>
                  <p className="text-sm text-gray-600 mt-1">Bu risk ile diğer riskler arasındaki ilişkiler</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setRelationFormData({
                        target_risk_id: '',
                        relation_type: 'TRIGGERS',
                        description: ''
                      });
                      setShowRelationModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    İlişki Ekle
                  </button>
                )}
              </div>

              {riskRelations.length > 0 ? (
                <>
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 gap-6 p-6">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-green-600" />
                          Bu Riskten Etkilenen
                        </h4>
                        <div className="space-y-3">
                          {riskRelations
                            .filter(r => r.direction === 'OUTGOING')
                            .map(relation => (
                              <div key={relation.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900">{relation.related_risk_code}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${getRiskScoreBadge(relation.related_risk_score).color}`}>
                                        {relation.related_risk_level}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{relation.related_risk_name}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="text-xs font-medium text-blue-600">
                                        {relation.relation_type === 'TRIGGERS' && '→ Tetikler'}
                                        {relation.relation_type === 'INCREASES' && '↗ Artırır'}
                                        {relation.relation_type === 'DECREASES' && '↘ Azaltır'}
                                        {relation.relation_type === 'RELATED' && '↔ İlişkili'}
                                      </span>
                                      {relation.description && (
                                        <span className="text-xs text-gray-500">• {relation.description}</span>
                                      )}
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <button
                                      onClick={async () => {
                                        if (confirm('Bu ilişkiyi silmek istediğinize emin misiniz?')) {
                                          try {
                                            const { error } = await supabase
                                              .from('rm_risk_relations')
                                              .delete()
                                              .eq('id', relation.id);
                                            if (error) throw error;
                                            await loadData();
                                          } catch (error) {
                                            console.error('Error deleting relation:', error);
                                            alert('İlişki silinemedi!');
                                          }
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          {riskRelations.filter(r => r.direction === 'OUTGOING').length === 0 && (
                            <p className="text-sm text-gray-500 italic">Başka risk tetiklemiyor</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-orange-600 transform rotate-180" />
                          Bu Riski Etkileyen
                        </h4>
                        <div className="space-y-3">
                          {riskRelations
                            .filter(r => r.direction === 'INCOMING')
                            .map(relation => (
                              <div key={relation.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900">{relation.related_risk_code}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${getRiskScoreBadge(relation.related_risk_score).color}`}>
                                        {relation.related_risk_level}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{relation.related_risk_name}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="text-xs font-medium text-orange-600">
                                        {relation.relation_type === 'TRIGGERS' && '← Tarafından tetiklenir'}
                                        {relation.relation_type === 'TRIGGERED_BY' && '← Tetiklenir'}
                                        {relation.relation_type === 'INCREASES' && '↗ Tarafından artırılır'}
                                        {relation.relation_type === 'DECREASES' && '↘ Tarafından azaltılır'}
                                        {relation.relation_type === 'RELATED' && '↔ İlişkili'}
                                      </span>
                                      {relation.description && (
                                        <span className="text-xs text-gray-500">• {relation.description}</span>
                                      )}
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <button
                                      onClick={async () => {
                                        if (confirm('Bu ilişkiyi silmek istediğinize emin misiniz?')) {
                                          try {
                                            const { error } = await supabase
                                              .from('rm_risk_relations')
                                              .delete()
                                              .eq('id', relation.id);
                                            if (error) throw error;
                                            await loadData();
                                          } catch (error) {
                                            console.error('Error deleting relation:', error);
                                            alert('İlişki silinemedi!');
                                          }
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          {riskRelations.filter(r => r.direction === 'INCOMING').length === 0 && (
                            <p className="text-sm text-gray-500 italic">Başka risk tarafından etkilenmiyor</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(riskRelations.filter(r => r.direction === 'OUTGOING' && r.relation_type === 'TRIGGERS').length > 0) && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-orange-900">
                            Dikkat: Bu risk gerçekleşirse {riskRelations.filter(r => r.direction === 'OUTGOING' && r.relation_type === 'TRIGGERS').length} risk daha tetiklenebilir!
                          </p>
                          <p className="text-xs text-orange-700 mt-1">
                            Bu riskin gerçekleşme olasılığını azaltmak, diğer risklerin de önüne geçecektir.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Network className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500">Henüz risk ilişkisi tanımlanmamış</p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowRelationModal(true)}
                      className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      İlk ilişkiyi oluştur
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {showRelationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Risk İlişkisi Ekle</h3>
              <button
                onClick={() => {
                  setShowRelationModal(false);
                  setRelationFormData({
                    target_risk_id: '',
                    relation_type: 'TRIGGERS',
                    description: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İlişkili Risk <span className="text-red-500">*</span>
                </label>
                <select
                  value={relationFormData.target_risk_id}
                  onChange={(e) => setRelationFormData({ ...relationFormData, target_risk_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Risk Seçin --</option>
                  {availableRisks.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name} ({r.risk_level})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İlişki Türü <span className="text-red-500">*</span>
                </label>
                <select
                  value={relationFormData.relation_type}
                  onChange={(e) => setRelationFormData({ ...relationFormData, relation_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TRIGGERS">Bu risk şunu tetikler</option>
                  <option value="TRIGGERED_BY">Bu risk şundan tetiklenir</option>
                  <option value="INCREASES">Bu risk şunu artırır</option>
                  <option value="DECREASES">Bu risk şunu azaltır</option>
                  <option value="RELATED">İlişkili</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {relationFormData.relation_type === 'TRIGGERS' && 'Bu risk gerçekleşirse seçilen risk de gerçekleşebilir'}
                  {relationFormData.relation_type === 'TRIGGERED_BY' && 'Seçilen risk gerçekleşirse bu risk de gerçekleşebilir'}
                  {relationFormData.relation_type === 'INCREASES' && 'Bu risk, seçilen riskin olasılığını veya etkisini artırır'}
                  {relationFormData.relation_type === 'DECREASES' && 'Bu risk, seçilen riskin olasılığını veya etkisini azaltır'}
                  {relationFormData.relation_type === 'RELATED' && 'İki risk birbiriyle ilişkili'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama (Opsiyonel)
                </label>
                <textarea
                  value={relationFormData.description}
                  onChange={(e) => setRelationFormData({ ...relationFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="İlişkinin detaylarını açıklayın..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowRelationModal(false);
                  setRelationFormData({
                    target_risk_id: '',
                    relation_type: 'TRIGGERS',
                    description: ''
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={async () => {
                  if (!relationFormData.target_risk_id) {
                    alert('Lütfen bir risk seçin!');
                    return;
                  }

                  try {
                    const { error } = await supabase
                      .from('rm_risk_relations')
                      .insert({
                        organization_id: profile?.organization_id,
                        source_risk_id: riskId,
                        target_risk_id: relationFormData.target_risk_id,
                        relation_type: relationFormData.relation_type,
                        description: relationFormData.description || null,
                        created_by: profile?.id
                      });

                    if (error) throw error;

                    alert('İlişki başarıyla eklendi!');
                    setShowRelationModal(false);
                    setRelationFormData({
                      target_risk_id: '',
                      relation_type: 'TRIGGERS',
                      description: ''
                    });
                    await loadData();
                  } catch (error: any) {
                    console.error('Error creating relation:', error);
                    if (error.message?.includes('circular')) {
                      alert('Bu ilişki dairesel bir bağımlılık oluşturacağı için eklenemez!');
                    } else {
                      alert('İlişki eklenirken bir hata oluştu!');
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                İlişki Ekle
              </button>
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
                  Bu riski silmek istediğinize emin misiniz?
                </p>
                <p className="text-sm text-red-600">
                  Bu işlem geri alınamaz. İlişkili kontroller, faaliyetler ve göstergeler de silinecektir.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <ControlModal
        isOpen={showControlModal}
        onClose={() => {
          setShowControlModal(false);
          setEditingControl(null);
        }}
        riskId={riskId}
        departments={departments}
        onSuccess={loadData}
        editingControl={editingControl}
      />

      {deletingControl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kontrolü Sil</h3>
            <p className="text-gray-600 mb-6">
              "{deletingControl.name}" kontrolünü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingControl(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('risk_controls')
                      .delete()
                      .eq('id', deletingControl.id);

                    if (error) throw error;

                    alert('Kontrol başarıyla silindi!');
                    setDeletingControl(null);
                    loadData();
                  } catch (error) {
                    console.error('Error deleting control:', error);
                    alert('Kontrol silinirken hata oluştu.');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <TreatmentModal
        isOpen={showTreatmentModal}
        onClose={() => setShowTreatmentModal(false)}
        riskId={riskId}
        departments={departments}
        profiles={profiles}
        onSuccess={loadData}
      />

      <IndicatorModal
        isOpen={showIndicatorModal}
        onClose={() => {
          setShowIndicatorModal(false);
          setEditingIndicator(null);
        }}
        riskId={riskId}
        indicator={editingIndicator}
        onSuccess={loadData}
      />

      {deletingIndicator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Gösterge Sil</h3>
                <p className="text-sm text-gray-600 mb-4">
                  "{deletingIndicator.name}" göstergesini silmek istediğinize emin misiniz?
                </p>
                <p className="text-sm text-red-600">
                  Bu işlem geri alınamaz.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingIndicator(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('risk_indicators')
                      .delete()
                      .eq('id', deletingIndicator.id);

                    if (error) throw error;

                    alert('Gösterge başarıyla silindi!');
                    setDeletingIndicator(null);
                    loadData();
                  } catch (error) {
                    console.error('Error deleting indicator:', error);
                    alert('Gösterge silinirken hata oluştu.');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                  Risk Düzenle
                </h2>
                <p className="text-sm text-gray-600 mt-1">Tüm alanları dikkatlice doldurun</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Temel Bilgiler</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Risk Kategorileri <span className="text-red-500">*</span> (Birden fazla seçilebilir)
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {categories.map(cat => (
                      <label key={cat.id} className="flex items-center space-x-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editFormData.category_ids.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditFormData({ ...editFormData, category_ids: [...editFormData.category_ids, cat.id] });
                            } else {
                              setEditFormData({ ...editFormData, category_ids: editFormData.category_ids.filter((id: string) => id !== cat.id) });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Risk adını giriniz"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Açıklaması
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
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
                    value={editFormData.causes}
                    onChange={(e) => setEditFormData({ ...editFormData, causes: e.target.value })}
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
                          name="edit_risk_source"
                          value="INTERNAL"
                          checked={editFormData.risk_source === 'INTERNAL'}
                          onChange={(e) => setEditFormData({ ...editFormData, risk_source: e.target.value })}
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
                          name="edit_risk_source"
                          value="EXTERNAL"
                          checked={editFormData.risk_source === 'EXTERNAL'}
                          onChange={(e) => setEditFormData({ ...editFormData, risk_source: e.target.value })}
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
                          name="edit_risk_relation"
                          value="STRATEGIC"
                          checked={editFormData.risk_relation === 'STRATEGIC'}
                          onChange={(e) => setEditFormData({ ...editFormData, risk_relation: e.target.value })}
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
                          name="edit_risk_relation"
                          value="OPERATIONAL"
                          checked={editFormData.risk_relation === 'OPERATIONAL'}
                          onChange={(e) => setEditFormData({ ...editFormData, risk_relation: e.target.value })}
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
                          name="edit_risk_relation"
                          value="PROJECT"
                          checked={editFormData.risk_relation === 'PROJECT'}
                          onChange={(e) => setEditFormData({ ...editFormData, risk_relation: e.target.value })}
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
                          name="edit_risk_relation"
                          value="CORPORATE"
                          checked={editFormData.risk_relation === 'CORPORATE'}
                          onChange={(e) => setEditFormData({ ...editFormData, risk_relation: e.target.value })}
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
                          name="edit_control_level"
                          value="CONTROLLABLE"
                          checked={editFormData.control_level === 'CONTROLLABLE'}
                          onChange={(e) => setEditFormData({ ...editFormData, control_level: e.target.value })}
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
                          name="edit_control_level"
                          value="PARTIAL"
                          checked={editFormData.control_level === 'PARTIAL'}
                          onChange={(e) => setEditFormData({ ...editFormData, control_level: e.target.value })}
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
                          name="edit_control_level"
                          value="UNCONTROLLABLE"
                          checked={editFormData.control_level === 'UNCONTROLLABLE'}
                          onChange={(e) => setEditFormData({ ...editFormData, control_level: e.target.value })}
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

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Olası Sonuçlar
                  </label>
                  <textarea
                    value={editFormData.consequences}
                    onChange={(e) => setEditFormData({ ...editFormData, consequences: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Riskin olası sonuçları..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sorumlu Birim <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editFormData.owner_department_id}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
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
                      value={editFormData.goal_id}
                      onChange={(e) => setEditFormData({ ...editFormData, goal_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seçiniz (Opsiyonel)</option>
                      {editFormData.owner_department_id
                        ? goals
                            .filter(goal => goal.department_id === editFormData.owner_department_id)
                            .map(goal => (
                              <option key={goal.id} value={goal.id}>{goal.code} - {goal.title}</option>
                            ))
                        : goals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.code} - {goal.title}</option>
                          ))
                      }
                    </select>
                    {editFormData.owner_department_id && goals.filter(g => g.department_id === editFormData.owner_department_id).length === 0 && (
                      <p className="mt-1 text-sm text-amber-600">Bu birime ait hedef bulunamadı</p>
                    )}
                  </div>
                </div>
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
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="edit_inherent_likelihood"
                            value={level}
                            checked={editFormData.inherent_likelihood === level}
                            onChange={(e) => setEditFormData({ ...editFormData, inherent_likelihood: parseInt(e.target.value) })}
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
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Etki <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="edit_inherent_impact"
                            value={level}
                            checked={editFormData.inherent_impact === level}
                            onChange={(e) => setEditFormData({ ...editFormData, inherent_impact: parseInt(e.target.value) })}
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
                    <span className="text-sm font-medium text-gray-700">DOĞAL RİSK SKORU:</span>
                    <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(editFormData.inherent_likelihood * editFormData.inherent_impact).color} px-4 py-2 rounded-lg`}>
                      <span>{getRiskScoreBadge(editFormData.inherent_likelihood * editFormData.inherent_impact).emoji}</span>
                      <span>{editFormData.inherent_likelihood * editFormData.inherent_impact}</span>
                      <span className="text-sm">({getRiskScoreBadge(editFormData.inherent_likelihood * editFormData.inherent_impact).label})</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Artık Risk Değerlendirmesi</h3>
                <p className="text-sm text-gray-600 mb-4">Mevcut kontroller uygulandıktan sonra kalan risk</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Olasılık <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                          <input
                            type="radio"
                            name="edit_residual_likelihood"
                            value={level}
                            checked={editFormData.residual_likelihood === level}
                            onChange={(e) => setEditFormData({ ...editFormData, residual_likelihood: parseInt(e.target.value) })}
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
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Etki <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                          <input
                            type="radio"
                            name="edit_residual_impact"
                            value={level}
                            checked={editFormData.residual_impact === level}
                            onChange={(e) => setEditFormData({ ...editFormData, residual_impact: parseInt(e.target.value) })}
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
                    <span className="text-sm font-medium text-gray-700">ARTIK RİSK SKORU:</span>
                    <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(editFormData.residual_likelihood * editFormData.residual_impact).color} px-4 py-2 rounded-lg`}>
                      <span>{getRiskScoreBadge(editFormData.residual_likelihood * editFormData.residual_impact).emoji}</span>
                      <span>{editFormData.residual_likelihood * editFormData.residual_impact}</span>
                      <span className="text-sm">({getRiskScoreBadge(editFormData.residual_likelihood * editFormData.residual_impact).label})</span>
                    </span>
                  </div>
                  {(editFormData.residual_likelihood * editFormData.residual_impact) > (editFormData.inherent_likelihood * editFormData.inherent_impact) && (
                    <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Uyarı: Artık risk skoru, doğal risk skorundan büyük olamaz!
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3.5. Hedef Risk Değerlendirmesi</h3>
                <p className="text-sm text-gray-600 mb-4">Ulaşmak istediğimiz risk seviyesi</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Hedef Olasılık
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="edit_target_probability"
                            value={level}
                            checked={editFormData.target_probability === level}
                            onChange={(e) => setEditFormData({ ...editFormData, target_probability: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                          </div>
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, target_probability: null })}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Hedef belirlenmedi
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Hedef Etki
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="edit_target_impact"
                            value={level}
                            checked={editFormData.target_impact === level}
                            onChange={(e) => setEditFormData({ ...editFormData, target_impact: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                          </div>
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, target_impact: null })}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Hedef belirlenmedi
                      </button>
                    </div>
                  </div>
                </div>

                {editFormData.target_probability && editFormData.target_impact && (
                  <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-300">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">HEDEF RİSK SKORU:</span>
                      <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(editFormData.target_probability * editFormData.target_impact).color} px-4 py-2 rounded-lg`}>
                        <span>{getRiskScoreBadge(editFormData.target_probability * editFormData.target_impact).emoji}</span>
                        <span>{editFormData.target_probability * editFormData.target_impact}</span>
                        <span className="text-sm">({getRiskScoreBadge(editFormData.target_probability * editFormData.target_impact).label})</span>
                      </span>
                    </div>
                    {(editFormData.target_probability * editFormData.target_impact) > (editFormData.residual_likelihood * editFormData.residual_impact) && (
                      <div className="mt-2 text-sm text-orange-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Uyarı: Hedef risk skoru, artık risk skorundan büyük olamaz!
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hedef Tarih
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Bu seviyeye ne zaman ulaşmayı hedefliyoruz?</p>
                  <input
                    type="date"
                    value={editFormData.target_date}
                    onChange={(e) => setEditFormData({ ...editFormData, target_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">4. Risk Yanıtı</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Risk Yanıt Stratejisi <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="edit_risk_response"
                        value="ACCEPT"
                        checked={editFormData.risk_response === 'ACCEPT'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
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
                        name="edit_risk_response"
                        value="MITIGATE"
                        checked={editFormData.risk_response === 'MITIGATE'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
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
                        name="edit_risk_response"
                        value="TRANSFER"
                        checked={editFormData.risk_response === 'TRANSFER'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
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
                        name="edit_risk_response"
                        value="AVOID"
                        checked={editFormData.risk_response === 'AVOID'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
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
                    value={editFormData.response_rationale}
                    onChange={(e) => setEditFormData({ ...editFormData, response_rationale: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Alınacak önlemler ve gerekçe..."
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="IDENTIFIED">Tespit Edildi</option>
                    <option value="ASSESSING">Değerlendiriliyor</option>
                    <option value="TREATING">Tedavi Ediliyor</option>
                    <option value="MONITORING">İzleniyor</option>
                    <option value="CLOSED">Kapatıldı</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg flex items-center justify-between">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlModal({ isOpen, onClose, riskId, departments, onSuccess, editingControl }: any) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    control_type: 'PREVENTIVE',
    control_nature: 'MANUAL',
    design_effectiveness: null as number | null,
    operating_effectiveness: null as number | null,
    effectiveness_notes: '',
    responsible_department_id: '',
    frequency: 'Çeyreklik',
    evidence: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingControl) {
      setFormData({
        name: editingControl.name || '',
        description: editingControl.description || '',
        control_type: editingControl.control_type || 'PREVENTIVE',
        control_nature: editingControl.control_nature || 'MANUAL',
        design_effectiveness: editingControl.design_effectiveness || null,
        operating_effectiveness: editingControl.operating_effectiveness || null,
        effectiveness_notes: editingControl.effectiveness_notes || '',
        responsible_department_id: editingControl.responsible_department_id || '',
        frequency: 'Çeyreklik',
        evidence: ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        control_type: 'PREVENTIVE',
        control_nature: 'MANUAL',
        design_effectiveness: null,
        operating_effectiveness: null,
        effectiveness_notes: '',
        responsible_department_id: '',
        frequency: 'Çeyreklik',
        evidence: ''
      });
    }
  }, [editingControl, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        last_effectiveness_review: (formData.design_effectiveness || formData.operating_effectiveness) ? new Date().toISOString().split('T')[0] : null,
        reviewed_by: (formData.design_effectiveness || formData.operating_effectiveness) ? profile?.id : null
      };

      if (editingControl) {
        const { error } = await supabase
          .from('risk_controls')
          .update(dataToSave)
          .eq('id', editingControl.id);

        if (error) throw error;
        alert('Kontrol başarıyla güncellendi!');
      } else {
        const { error } = await supabase.from('risk_controls').insert({
          risk_id: riskId,
          ...dataToSave
        });

        if (error) throw error;
        alert('Kontrol başarıyla eklendi!');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving control:', error);
      alert('Kontrol kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingControl ? 'Kontrol Düzenle' : 'Yeni Kontrol Ekle'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kontrol Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Türü</label>
              <select
                value={formData.control_type}
                onChange={e => setFormData({ ...formData, control_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="PREVENTIVE">Önleyici</option>
                <option value="DETECTIVE">Tespit Edici</option>
                <option value="CORRECTIVE">Düzeltici</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Yapısı</label>
              <select
                value={formData.control_nature}
                onChange={e => setFormData({ ...formData, control_nature: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="MANUAL">Manuel</option>
                <option value="AUTOMATED">Otomatik</option>
                <option value="SEMI_AUTOMATED">Yarı Otomatik</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-base font-semibold text-gray-900 mb-3">Etkinlik Değerlendirmesi</h4>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tasarım Etkinliği
                </label>
                <p className="text-xs text-gray-500 mb-2">Kontrol doğru tasarlanmış mı?</p>
                <div className="space-y-2">
                  {[
                    { value: 1, label: 'Çok Zayıf', desc: 'Kontrol tasarımı yetersiz' },
                    { value: 2, label: 'Zayıf', desc: 'Önemli eksiklikler var' },
                    { value: 3, label: 'Orta', desc: 'Kısmen yeterli' },
                    { value: 4, label: 'İyi', desc: 'Büyük ölçüde yeterli' },
                    { value: 5, label: 'Çok İyi', desc: 'Tam yeterli' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="design_effectiveness"
                        value={option.value}
                        checked={formData.design_effectiveness === option.value}
                        onChange={e => setFormData({ ...formData, design_effectiveness: parseInt(e.target.value) })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{option.value} - {option.label}:</span>
                        <span className="text-gray-600 ml-1">{option.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Çalışma Etkinliği
                </label>
                <p className="text-xs text-gray-500 mb-2">Kontrol pratikte çalışıyor mu?</p>
                <div className="space-y-2">
                  {[
                    { value: 1, label: 'Çok Zayıf', desc: 'Uygulanmıyor' },
                    { value: 2, label: 'Zayıf', desc: 'Nadiren uygulanıyor' },
                    { value: 3, label: 'Orta', desc: 'Bazen uygulanıyor' },
                    { value: 4, label: 'İyi', desc: 'Genellikle uygulanıyor' },
                    { value: 5, label: 'Çok İyi', desc: 'Her zaman uygulanıyor' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="operating_effectiveness"
                        value={option.value}
                        checked={formData.operating_effectiveness === option.value}
                        onChange={e => setFormData({ ...formData, operating_effectiveness: parseInt(e.target.value) })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{option.value} - {option.label}:</span>
                        <span className="text-gray-600 ml-1">{option.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Etkinlik Değerlendirme Notu
              </label>
              <textarea
                value={formData.effectiveness_notes}
                onChange={e => setFormData({ ...formData, effectiveness_notes: e.target.value })}
                rows={3}
                placeholder="Etkinlik değerlendirmesi ile ilgili notlarınızı yazabilirsiniz..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.responsible_department_id}
              onChange={e => setFormData({ ...formData, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seçiniz</option>
              {departments.map((dept: any) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TreatmentModal({ isOpen, onClose, riskId, departments, profiles, onSuccess }: any) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    treatment_type: 'NEW_CONTROL',
    responsible_department_id: '',
    responsible_person_id: '',
    planned_start_date: '',
    planned_end_date: '',
    status: 'PLANNED'
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: lastTreatment } = await supabase
        .from('risk_treatments')
        .select('code')
        .eq('risk_id', riskId)
        .order('code', { ascending: false })
        .limit(1)
        .single();

      let nextCode = 'F001';
      if (lastTreatment?.code) {
        const lastNum = parseInt(lastTreatment.code.substring(1));
        nextCode = `F${String(lastNum + 1).padStart(3, '0')}`;
      }

      const { error } = await supabase.from('risk_treatments').insert({
        risk_id: riskId,
        code: nextCode,
        progress_percent: 0,
        ...formData
      });

      if (error) throw error;

      alert('Faaliyet başarıyla eklendi!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding treatment:', error);
      alert('Faaliyet eklenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Yeni Faaliyet Ekle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Faaliyet Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Faaliyet Türü</label>
            <select
              value={formData.treatment_type}
              onChange={e => setFormData({ ...formData, treatment_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="NEW_CONTROL">Yeni Kontrol</option>
              <option value="IMPROVE_CONTROL">Kontrol İyileştirme</option>
              <option value="TRANSFER">Transfer</option>
              <option value="AVOID">Kaçınma</option>
              <option value="ACCEPT">Kabul</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sorumlu Birim <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.responsible_department_id}
                onChange={e => setFormData({ ...formData, responsible_department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {departments.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
              <select
                value={formData.responsible_person_id}
                onChange={e => setFormData({ ...formData, responsible_person_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {profiles.map((profile: any) => (
                  <option key={profile.id} value={profile.id}>{profile.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.planned_start_date}
                onChange={e => setFormData({ ...formData, planned_start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.planned_end_date}
                onChange={e => setFormData({ ...formData, planned_end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IndicatorModal({ isOpen, onClose, riskId, indicator, onSuccess }: any) {
  const isEditMode = !!indicator;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    indicator_type: 'LEI',
    unit_of_measure: '',
    measurement_frequency: 'MONTHLY',
    green_threshold: '',
    yellow_threshold: '',
    red_threshold: '',
    direction: 'LOWER_BETTER',
    target_value: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (indicator) {
      setFormData({
        name: indicator.name || '',
        description: indicator.description || '',
        indicator_type: indicator.indicator_type || 'LEI',
        unit_of_measure: indicator.unit_of_measure || '',
        measurement_frequency: indicator.measurement_frequency || 'MONTHLY',
        green_threshold: indicator.green_threshold || '',
        yellow_threshold: indicator.yellow_threshold || '',
        red_threshold: indicator.red_threshold || '',
        direction: indicator.direction || 'LOWER_BETTER',
        target_value: indicator.target_value || 0
      });
    } else {
      setFormData({
        name: '',
        description: '',
        indicator_type: 'LEI',
        unit_of_measure: '',
        measurement_frequency: 'MONTHLY',
        green_threshold: '',
        yellow_threshold: '',
        red_threshold: '',
        direction: 'LOWER_BETTER',
        target_value: 0
      });
    }
  }, [indicator]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditMode) {
        const { error } = await supabase
          .from('risk_indicators')
          .update(formData)
          .eq('id', indicator.id);

        if (error) throw error;

        alert('Gösterge başarıyla güncellendi!');
      } else {
        const prefix = formData.indicator_type;

        const { data: lastIndicator } = await supabase
          .from('risk_indicators')
          .select('code')
          .eq('risk_id', riskId)
          .like('code', `${prefix}%`)
          .order('code', { ascending: false })
          .limit(1)
          .single();

        let nextCode = `${prefix}001`;
        if (lastIndicator?.code) {
          const lastNum = parseInt(lastIndicator.code.substring(3));
          nextCode = `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
        }

        const { error } = await supabase.from('risk_indicators').insert({
          risk_id: riskId,
          code: nextCode,
          ...formData
        });

        if (error) throw error;

        alert('Gösterge başarıyla eklendi!');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving indicator:', error);
      alert(`Gösterge ${isEditMode ? 'güncellenirken' : 'eklenirken'} hata oluştu.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Risk Göstergesi Düzenle' : 'Yeni Risk Göstergesi Ekle'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gösterge Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gösterge Türü</label>
              <select
                value={formData.indicator_type}
                onChange={e => setFormData({ ...formData, indicator_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="LEI">Öncü Gösterge (LEI)</option>
                <option value="KRI">Anahtar Risk Göstergesi (KRI)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ölçüm Birimi</label>
              <input
                type="text"
                value={formData.unit_of_measure}
                onChange={e => setFormData({ ...formData, unit_of_measure: e.target.value })}
                placeholder="Adet, %, TL, vb."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ölçüm Sıklığı</label>
              <select
                value={formData.measurement_frequency}
                onChange={e => setFormData({ ...formData, measurement_frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="DAILY">Günlük</option>
                <option value="WEEKLY">Haftalık</option>
                <option value="MONTHLY">Aylık</option>
                <option value="QUARTERLY">Çeyreklik</option>
                <option value="ANNUAL">Yıllık</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yön</label>
              <select
                value={formData.direction}
                onChange={e => setFormData({ ...formData, direction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOWER_BETTER">Düşük İyi</option>
                <option value="HIGHER_BETTER">Yüksek İyi</option>
                <option value="TARGET">Hedefe Ulaşma</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yeşil Eşik <span className="text-green-600">🟢</span>
              </label>
              <input
                type="text"
                value={formData.green_threshold}
                onChange={e => setFormData({ ...formData, green_threshold: e.target.value })}
                placeholder="örn: <5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sarı Eşik <span className="text-yellow-500">🟡</span>
              </label>
              <input
                type="text"
                value={formData.yellow_threshold}
                onChange={e => setFormData({ ...formData, yellow_threshold: e.target.value })}
                placeholder="örn: 5-10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kırmızı Eşik <span className="text-red-600">🔴</span>
              </label>
              <input
                type="text"
                value={formData.red_threshold}
                onChange={e => setFormData({ ...formData, red_threshold: e.target.value })}
                placeholder="örn: >10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-600">Risk Reddet</h3>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setRejectionReason('');
                  setApprovalAction('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Red Nedeni <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Risk neden reddedildi? Detaylı açıklama giriniz..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={5}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Red nedeni risk sahibi tarafından görülecektir.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setRejectionReason('');
                  setApprovalAction('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={() => handleApprovalStatusChange(approvalAction)}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
