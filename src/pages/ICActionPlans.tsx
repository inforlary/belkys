import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  ClipboardCheck,
  Plus,
  Eye,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit2,
  BarChart3,
  Trash2
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
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    import_from_plan: false,
    source_plan_id: ''
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
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;

      const plansWithStats = await Promise.all((plansData || []).map(async (plan) => {
        const { data: actionsData } = await supabase
          .from('ic_actions')
          .select('status')
          .eq('action_plan_id', plan.id);

        const actionCount = actionsData?.length || 0;
        const completedCount = actionsData?.filter(a => a.status === 'COMPLETED').length || 0;
        const inProgressCount = actionsData?.filter(a => a.status === 'IN_PROGRESS').length || 0;
        const delayedCount = actionsData?.filter(a => a.status === 'DELAYED').length || 0;
        const notStartedCount = actionsData?.filter(a => a.status === 'NOT_STARTED').length || 0;
        const completionPercentage = actionCount > 0 ? Math.round((completedCount / actionCount) * 100) : 0;

        return {
          ...plan,
          action_count: actionCount,
          completed_count: completedCount,
          in_progress_count: inProgressCount,
          delayed_count: delayedCount,
          not_started_count: notStartedCount,
          completion_percentage: completionPercentage
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
          status: 'DRAFT',
          prepared_by_id: profile?.id
        })
        .select()
        .single();

      if (error) throw error;

      if (formData.import_from_plan && formData.source_plan_id && newPlan) {
        const { data: sourceActions } = await supabase
          .from('ic_actions')
          .select('*')
          .eq('action_plan_id', formData.source_plan_id)
          .neq('status', 'COMPLETED');

        if (sourceActions && sourceActions.length > 0) {
          const newActions = sourceActions.map(action => ({
            action_plan_id: newPlan.id,
            code: action.code,
            standard_id: action.standard_id,
            title: action.title,
            description: action.description,
            responsible_department_id: action.responsible_department_id,
            start_date: action.start_date,
            target_date: action.target_date,
            priority: action.priority,
            status: 'NOT_STARTED',
            progress_percent: 0,
            expected_output: action.expected_output,
            required_resources: action.required_resources
          }));

          await supabase.from('ic_actions').insert(newActions);
        }
      }

      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        import_from_plan: false,
        source_plan_id: ''
      });
      loadActionPlans();
    } catch (error: any) {
      console.error('Eylem planı oluşturulurken hata:', error);
      console.error('Error details:', error?.message, error?.details, error?.hint);
      alert(`Eylem planı oluşturulurken bir hata oluştu: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (plan: ActionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      start_date: plan.start_date,
      end_date: plan.end_date,
      import_from_plan: false,
      source_plan_id: ''
    });
    setShowEditModal(true);
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
          end_date: formData.end_date
        })
        .eq('id', editingPlan.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingPlan(null);
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        import_from_plan: false,
        source_plan_id: ''
      });
      loadActionPlans();
    } catch (error) {
      console.error('Eylem planı güncellenirken hata:', error);
      alert('Eylem planı güncellenirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: ActionPlan) => {
    if (!confirm(`"${plan.name}" planını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve plandaki tüm eylemler de silinecektir.`)) {
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
      console.error('Eylem planı silinirken hata:', error);
      alert('Eylem planı silinirken bir hata oluştu');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-800',
      ACTIVE: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Taslak',
      ACTIVE: 'Aktif',
      COMPLETED: 'Tamamlandı',
      CANCELLED: 'İptal Edildi'
    };
    return labels[status] || status;
  };

  const getYearFromDate = (dateString: string) => {
    return new Date(dateString).getFullYear().toString();
  };

  const filteredPlans = actionPlans.filter(plan => {
    if (filterStatus !== 'all' && plan.status !== filterStatus) return false;
    if (filterYear !== 'all') {
      const startYear = getYearFromDate(plan.start_date);
      const endYear = getYearFromDate(plan.end_date);
      if (startYear !== filterYear && endYear !== filterYear) return false;
    }
    if (searchTerm && !plan.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const availableYears = Array.from(
    new Set(
      actionPlans.flatMap(plan => [
        getYearFromDate(plan.start_date),
        getYearFromDate(plan.end_date)
      ])
    )
  ).sort((a, b) => parseInt(b) - parseInt(a));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-green-600" />
            İç Kontrol Eylem Planları
          </h1>
          <p className="text-slate-600 mt-2">İç kontrol iyileştirme eylem planlarını yönetin</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Yeni Plan Oluştur
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Plan adı ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="DRAFT">Taslak</option>
            <option value="ACTIVE">Aktif</option>
            <option value="COMPLETED">Tamamlandı</option>
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Tüm Yıllar</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredPlans.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">Henüz eylem planı bulunmuyor</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              İlk Planı Oluştur
            </button>
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(plan.status)}`}>
                        {getStatusLabel(plan.status)}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-slate-600 mb-3">{plan.description}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Dönem: {new Date(plan.start_date).toLocaleDateString('tr-TR')} - {new Date(plan.end_date).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Son Güncelleme: {new Date(plan.updated_at || plan.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/internal-control/standards?plan_id=${plan.id}`);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Görüntüle
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(plan);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Düzenle
                    </button>
                    {(profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'super_admin') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(plan);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Sil
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-blue-800">Toplam Eylem</span>
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-900">{plan.action_count || 0}</div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-green-800">Tamamlanan</span>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-900">{plan.completed_count || 0}</div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-yellow-800">Devam Eden</span>
                      <Clock className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-900">{plan.in_progress_count || 0}</div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-red-800">Geciken</span>
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-900">{plan.delayed_count || 0}</div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-800">Başlamadı</span>
                      <BarChart3 className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{plan.not_started_count || 0}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">İlerleme</span>
                    <span className="text-sm font-bold text-slate-900">{plan.completion_percentage || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${plan.completion_percentage || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData({
            name: '',
            description: '',
            start_date: '',
            end_date: '',
            import_from_plan: false,
            source_plan_id: ''
          });
        }}
        title="Yeni Eylem Planı Oluştur"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Plan Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={1000}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Örn: 2024-2026 İç Kontrol Eylem Planı"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Plan hakkında kısa açıklama..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {actionPlans.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.import_from_plan}
                  onChange={(e) => setFormData({ ...formData, import_from_plan: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Önceki plandan tamamlanmamış eylemleri aktar
                </span>
              </label>

              {formData.import_from_plan && (
                <div className="mt-3 ml-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kaynak Plan
                  </label>
                  <select
                    value={formData.source_plan_id}
                    onChange={(e) => setFormData({ ...formData, source_plan_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Seçiniz</option>
                    {actionPlans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
          setFormData({
            name: '',
            description: '',
            start_date: '',
            end_date: '',
            import_from_plan: false,
            source_plan_id: ''
          });
        }}
        title="Eylem Planını Düzenle"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Plan Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={1000}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Örn: 2024-2026 İç Kontrol Eylem Planı"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Plan hakkında kısa açıklama..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingPlan(null);
              }}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Güncelleniyor...' : 'Güncelle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
