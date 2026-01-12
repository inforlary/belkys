import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  FileText,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit2,
  Archive,
  Trash2,
  Copy,
  Eye,
  ArrowRight,
  Shield,
  TrendingUp
} from 'lucide-react';
import Modal from '../components/ui/Modal';

interface ActionPlan {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  action_count?: number;
  completion_percentage?: number;
  completed_count?: number;
  in_progress_count?: number;
  delayed_count?: number;
  not_started_count?: number;
  ongoing_count?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export default function ICActionPlans() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);
  const [detailPlan, setDetailPlan] = useState<ActionPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'DRAFT',
    copy_from_plan_id: '',
    copy_assessments: true,
    copy_incomplete_actions: true,
    copy_all_actions: false
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadActionPlans();
    }
  }, [profile?.organization_id]);

  const loadActionPlans = async () => {
    try {
      const { data: plansData, error: plansError } = await supabase
        .from('ic_action_plans')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('start_date', { ascending: false });

      if (plansError) throw plansError;

      const plansWithStats = await Promise.all((plansData || []).map(async (plan) => {
        const { data: actionsData } = await supabase
          .from('ic_actions')
          .select('status')
          .eq('action_plan_id', plan.id);

        let createdByName = 'Bilinmiyor';
        if (plan.prepared_by_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', plan.prepared_by_id)
            .single();
          if (profileData) {
            createdByName = profileData.full_name;
          }
        }

        const actionCount = actionsData?.length || 0;
        const completedCount = actionsData?.filter(a => a.status === 'COMPLETED').length || 0;
        const inProgressCount = actionsData?.filter(a => a.status === 'IN_PROGRESS').length || 0;
        const delayedCount = actionsData?.filter(a => a.status === 'DELAYED').length || 0;
        const notStartedCount = actionsData?.filter(a => a.status === 'NOT_STARTED').length || 0;
        const ongoingCount = actionsData?.filter(a => a.status === 'ONGOING').length || 0;
        const completionPercentage = actionCount > 0 ? Math.round((completedCount / actionCount) * 100) : 0;

        return {
          ...plan,
          action_count: actionCount,
          completed_count: completedCount,
          in_progress_count: inProgressCount,
          delayed_count: delayedCount,
          not_started_count: notStartedCount,
          ongoing_count: ongoingCount,
          completion_percentage: completionPercentage,
          created_by: createdByName
        };
      }));

      setActionPlans(plansWithStats);
    } catch (error) {
      console.error('Eylem planları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: newPlan, error } = await supabase
        .from('ic_action_plans')
        .insert({
          organization_id: profile?.organization_id,
          name: formData.name,
          description: formData.description,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: formData.status,
          prepared_by_id: profile?.id
        })
        .select()
        .single();

      if (error) throw error;

      if (formData.copy_from_plan_id && newPlan) {
        if (formData.copy_assessments) {
          const { data: sourceAssessments } = await supabase
            .from('ic_condition_assessments')
            .select('*')
            .eq('action_plan_id', formData.copy_from_plan_id);

          if (sourceAssessments && sourceAssessments.length > 0) {
            const newAssessments = sourceAssessments.map(assessment => ({
              organization_id: assessment.organization_id,
              condition_id: assessment.condition_id,
              action_plan_id: newPlan.id,
              compliance_status: assessment.compliance_status,
              compliance_score: assessment.compliance_score,
              current_situation: assessment.current_situation,
              assessed_by: profile?.id
            }));

            await supabase.from('ic_condition_assessments').insert(newAssessments);
          }
        }

        const statusFilter = formData.copy_all_actions
          ? {}
          : { status: { neq: 'COMPLETED' } };

        const query = supabase
          .from('ic_actions')
          .select('*')
          .eq('action_plan_id', formData.copy_from_plan_id);

        if (!formData.copy_all_actions) {
          query.neq('status', 'COMPLETED');
        }

        const { data: sourceActions } = await query;

        if (sourceActions && sourceActions.length > 0) {
          const newActions = sourceActions.map(action => ({
            organization_id: action.organization_id,
            action_plan_id: newPlan.id,
            condition_id: action.condition_id,
            code: action.code,
            title: action.title,
            description: action.description,
            responsible_department_id: action.responsible_department_id,
            cooperation_department_ids: action.cooperation_department_ids,
            expected_output: action.expected_output,
            is_continuous: action.is_continuous,
            start_date: action.start_date,
            target_date: action.target_date,
            status: 'NOT_STARTED',
            progress_percent: 0
          }));

          await supabase.from('ic_actions').insert(newActions);
        }
      }

      setShowCreateModal(false);
      resetForm();
      loadActionPlans();
    } catch (error: any) {
      console.error('Eylem planı oluşturulurken hata:', error);
      alert(`Eylem planı oluşturulurken bir hata oluştu: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('ic_action_plans')
        .update({
          name: formData.name,
          description: formData.description,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: formData.status
        })
        .eq('id', editingPlan.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingPlan(null);
      resetForm();
      loadActionPlans();
    } catch (error) {
      console.error('Eylem planı güncellenirken hata:', error);
      alert('Eylem planı güncellenirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (plan: ActionPlan) => {
    if (!confirm(`"${plan.name}" planını arşivlemek istediğinize emin misiniz? Arşivlenen plan üzerinde değişiklik yapılamaz.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_action_plans')
        .update({ status: 'ARCHIVED' })
        .eq('id', plan.id);

      if (error) throw error;
      loadActionPlans();
    } catch (error) {
      console.error('Plan arşivlenirken hata:', error);
      alert('Plan arşivlenirken bir hata oluştu');
    }
  };

  const handleDelete = async (plan: ActionPlan) => {
    if (plan.status !== 'ARCHIVED') {
      alert('Sadece arşivlenmiş planlar silinebilir.');
      return;
    }

    if (!confirm(`"${plan.name}" planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz. Plana bağlı tüm değerlendirmeler ve eylemler de silinecektir.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_action_plans')
        .delete()
        .eq('id', plan.id);

      if (error) throw error;
      loadActionPlans();
    } catch (error) {
      console.error('Plan silinirken hata:', error);
      alert('Plan silinirken bir hata oluştu');
    }
  };

  const handleCopy = (plan: ActionPlan) => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    setFormData({
      name: `${currentYear}-${nextYear} İç Kontrol Eylem Planı`,
      description: plan.description || '',
      start_date: `${currentYear}-01-01`,
      end_date: `${nextYear}-12-31`,
      status: 'DRAFT',
      copy_from_plan_id: plan.id,
      copy_assessments: true,
      copy_incomplete_actions: true,
      copy_all_actions: false
    });
    setShowCreateModal(true);
  };

  const handleEdit = (plan: ActionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      start_date: plan.start_date,
      end_date: plan.end_date,
      status: plan.status,
      copy_from_plan_id: '',
      copy_assessments: true,
      copy_incomplete_actions: true,
      copy_all_actions: false
    });
    setShowEditModal(true);
  };

  const handleViewDetail = (plan: ActionPlan) => {
    setDetailPlan(plan);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'DRAFT',
      copy_from_plan_id: '',
      copy_assessments: true,
      copy_incomplete_actions: true,
      copy_all_actions: false
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: string }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📝' },
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-800', icon: '🟢' },
      COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '✅' },
      ARCHIVED: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '📁' }
    };
    return badges[status] || badges.DRAFT;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Taslak',
      ACTIVE: 'Aktif',
      COMPLETED: 'Tamamlandı',
      ARCHIVED: 'Arşivlendi'
    };
    return labels[status] || status;
  };

  const activePlans = actionPlans.filter(p => p.status === 'ACTIVE');
  const draftPlans = actionPlans.filter(p => p.status === 'DRAFT');
  const completedPlans = actionPlans.filter(p => p.status === 'COMPLETED');
  const archivedPlans = actionPlans.filter(p => p.status === 'ARCHIVED');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Eylem Planları</h1>
          <p className="mt-2 text-gray-600">İç kontrol eylem planları yönetimi</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Plan
        </button>
      </div>

      {activePlans.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge('ACTIVE').bg} ${getStatusBadge('ACTIVE').text}`}>
              {getStatusBadge('ACTIVE').icon} AKTİF PLANLAR
            </span>
          </div>

          <div className="space-y-4">
            {activePlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow-lg border-2 border-green-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {plan.name}
                      <span className={`ml-3 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusBadge(plan.status).bg} ${getStatusBadge(plan.status).text}`}>
                        {getStatusLabel(plan.status)}
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Dönem: {new Date(plan.start_date).toLocaleDateString('tr-TR')} - {new Date(plan.end_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                </div>

                {plan.description && (
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                )}

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <div className="text-gray-600 mb-1">Toplam Eylem</div>
                      <div className="text-xl font-bold text-gray-900">{plan.action_count || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Tamamlanan</div>
                      <div className="text-xl font-bold text-green-600">{plan.completed_count || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Devam Eden</div>
                      <div className="text-xl font-bold text-blue-600">{plan.in_progress_count || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Geciken</div>
                      <div className="text-xl font-bold text-red-600">{plan.delayed_count || 0}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-gray-600">Genel İlerleme</span>
                      <span className="font-semibold text-gray-900">%{plan.completion_percentage || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all"
                        style={{ width: `${plan.completion_percentage || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/internal-control/standards?plan_id=${plan.id}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Standartlara Git
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleViewDetail(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Görüntüle
                  </button>
                  <button
                    onClick={() => handleEdit(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleArchive(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Archive className="w-4 h-4" />
                    Arşivle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {draftPlans.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge('DRAFT').bg} ${getStatusBadge('DRAFT').text}`}>
              {getStatusBadge('DRAFT').icon} TASLAK PLANLAR
            </span>
          </div>

          <div className="space-y-4">
            {draftPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {plan.name}
                      <span className={`ml-3 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusBadge(plan.status).bg} ${getStatusBadge(plan.status).text}`}>
                        {getStatusLabel(plan.status)}
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Dönem: {new Date(plan.start_date).toLocaleDateString('tr-TR')} - {new Date(plan.end_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  Eylemler: {plan.action_count || 0} • Tamamlanan: {plan.completed_count || 0} ({plan.completion_percentage || 0}%)
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/internal-control/standards?plan_id=${plan.id}`)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Standartlara Git
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleViewDetail(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Görüntüle
                  </button>
                  <button
                    onClick={() => handleEdit(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleCopy(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Kopyala
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completedPlans.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge('COMPLETED').bg} ${getStatusBadge('COMPLETED').text}`}>
              {getStatusBadge('COMPLETED').icon} TAMAMLANAN PLANLAR
            </span>
          </div>

          <div className="space-y-4">
            {completedPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {plan.name}
                      <span className={`ml-3 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusBadge(plan.status).bg} ${getStatusBadge(plan.status).text}`}>
                        {getStatusLabel(plan.status)}
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Dönem: {new Date(plan.start_date).toLocaleDateString('tr-TR')} - {new Date(plan.end_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  Eylemler: {plan.action_count || 0} • Tamamlanan: {plan.completed_count || 0} ({plan.completion_percentage || 0}%)
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDetail(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Görüntüle
                  </button>
                  <button
                    onClick={() => handleCopy(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Kopyala
                  </button>
                  <button
                    onClick={() => handleArchive(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Archive className="w-4 h-4" />
                    Arşivle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {archivedPlans.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge('ARCHIVED').bg} ${getStatusBadge('ARCHIVED').text}`}>
              {getStatusBadge('ARCHIVED').icon} ARŞİVLENMİŞ PLANLAR
            </span>
          </div>

          <div className="space-y-4">
            {archivedPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {plan.name}
                      <span className={`ml-3 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusBadge(plan.status).bg} ${getStatusBadge(plan.status).text}`}>
                        {getStatusLabel(plan.status)}
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Dönem: {new Date(plan.start_date).toLocaleDateString('tr-TR')} - {new Date(plan.end_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  Eylemler: {plan.action_count || 0} • Tamamlanan: {plan.completed_count || 0} ({plan.completion_percentage || 0}%)
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDetail(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Görüntüle
                  </button>
                  <button
                    onClick={() => handleCopy(plan)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Kopyala
                  </button>
                  {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                    <button
                      onClick={() => handleDelete(plan)}
                      className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Sil
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {actionPlans.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Henüz eylem planı oluşturulmamış</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            İlk Planı Oluştur
          </button>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Yeni Eylem Planı Oluştur"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="2025-2026 İç Kontrol Eylem Planı"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {actionPlans.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Önceki Plandan Kopyala
              </label>
              <select
                value={formData.copy_from_plan_id}
                onChange={(e) => setFormData({ ...formData, copy_from_plan_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz (Opsiyonel)</option>
                <option value="" disabled>───────────────────────────</option>
                <option value="">Boş plan oluştur</option>
                {actionPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>

              {formData.copy_from_plan_id && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-gray-600 mb-2">Kopyalama seçilirse:</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.copy_assessments}
                      onChange={(e) => setFormData({ ...formData, copy_assessments: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Değerlendirmeleri kopyala (mevcut durum)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.copy_incomplete_actions}
                      onChange={(e) => setFormData({
                        ...formData,
                        copy_incomplete_actions: e.target.checked,
                        copy_all_actions: e.target.checked ? false : formData.copy_all_actions
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Tamamlanmamış eylemleri kopyala</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.copy_all_actions}
                      onChange={(e) => setFormData({
                        ...formData,
                        copy_all_actions: e.target.checked,
                        copy_incomplete_actions: e.target.checked ? false : formData.copy_incomplete_actions
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Tüm eylemleri kopyala</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingPlan(null);
          resetForm();
        }}
        title="Eylem Planını Düzenle"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durum
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="DRAFT">Taslak</option>
              <option value="ACTIVE">Aktif</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="ARCHIVED">Arşivlendi</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingPlan(null);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Güncelleniyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailPlan(null);
        }}
        title={detailPlan?.name || ''}
      >
        {detailPlan && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">PLAN BİLGİLERİ</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Dönem:</span>
                  <span className="font-medium">{new Date(detailPlan.start_date).toLocaleDateString('tr-TR')} - {new Date(detailPlan.end_date).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Durum:</span>
                  <span className={`font-medium ${getStatusBadge(detailPlan.status).text}`}>{getStatusLabel(detailPlan.status)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Oluşturan:</span>
                  <span className="font-medium">{detailPlan.created_by}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Oluşturma:</span>
                  <span className="font-medium">{new Date(detailPlan.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">ÖZET İSTATİSTİKLER</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Toplam Eylem:</span>
                  <span className="font-medium">{detailPlan.action_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tamamlanan:</span>
                  <span className="font-medium text-green-600">{detailPlan.completed_count || 0} ({detailPlan.completion_percentage || 0}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tamamlanamayan:</span>
                  <span className="font-medium text-red-600">
                    {(detailPlan.action_count || 0) - (detailPlan.completed_count || 0)} ({100 - (detailPlan.completion_percentage || 0)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => navigate(`/internal-control/standards?plan_id=${detailPlan.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Standartlara Git
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailPlan(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
