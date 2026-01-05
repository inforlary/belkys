import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreVertical,
  Trash2,
  Edit,
  X
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';

interface ActionPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  description: string;
  created_at: string;
  actions_count?: number;
  completed_actions?: number;
  delayed_actions?: number;
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  active: 'blue',
  completed: 'green',
  cancelled: 'red',
};

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export default function ICActionPlans() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'draft'
  });

  useEffect(() => {
    loadActionPlans();
  }, [profile]);

  const loadActionPlans = async () => {
    if (!profile?.organization_id) return;

    try {
      let query = supabase
        .from('ic_action_plans')
        .select(`
          *,
          actions:ic_actions(
            id,
            status
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const plansWithStats = data?.map(plan => {
        const actionsCount = plan.actions?.length || 0;
        const completedActions = plan.actions?.filter((a: any) => a.status === 'completed').length || 0;
        const delayedActions = plan.actions?.filter((a: any) => a.status === 'delayed').length || 0;

        return {
          ...plan,
          actions_count: actionsCount,
          completed_actions: completedActions,
          delayed_actions: delayedActions,
        };
      }) || [];

      setActionPlans(plansWithStats);
    } catch (error) {
      console.error('Error loading action plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.start_date || !formData.end_date) {
      alert('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_action_plans')
        .insert({
          ...formData,
          organization_id: profile?.organization_id,
          created_by: profile?.id
        });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'draft'
      });
      await loadActionPlans();
      alert('Eylem planı başarıyla oluşturuldu');
    } catch (error) {
      console.error('Error creating plan:', error);
      alert('Eylem planı oluşturulurken hata oluştu');
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Bu eylem planını silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_action_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadActionPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Eylem planı silinirken hata oluştu');
    }
  };

  const filteredPlans = filterStatus === 'all'
    ? actionPlans
    : actionPlans.filter(p => p.status === filterStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            İç Kontrol Eylem Planları
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Eylem planlarınızı oluşturun ve takip edin
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Yeni Eylem Planı
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tümü ({actionPlans.length})
          </button>
          {Object.entries(statusLabels).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filterStatus === value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label} ({actionPlans.filter(p => p.status === value).length})
            </button>
          ))}
        </div>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Henüz eylem planı yok
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            İç kontrol eylem planı oluşturarak başlayın
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            İlk Planı Oluştur
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => {
            const progressPercent = plan.actions_count
              ? Math.round((plan.completed_actions! / plan.actions_count) * 100)
              : 0;

            return (
              <div
                key={plan.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
              >
                <div
                  className="h-2"
                  style={{
                    background: `linear-gradient(to right, #22C55E ${progressPercent}%, #E5E7EB ${progressPercent}%)`
                  }}
                />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {plan.name}
                      </h3>
                      <StatusBadge
                        status={plan.status}
                        label={statusLabels[plan.status]}
                        variant={statusColors[plan.status] as any}
                      />
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(showMenu === plan.id ? null : plan.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      {showMenu === plan.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => {
                              navigate(`/internal-control/action-plans/${plan.id}/edit`);
                              setShowMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Düzenle
                          </button>
                          <button
                            onClick={() => {
                              deletePlan(plan.id);
                              setShowMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Sil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {plan.description}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(plan.start_date).toLocaleDateString('tr-TR')} -{' '}
                        {new Date(plan.end_date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {plan.completed_actions}/{plan.actions_count} Eylem Tamamlandı
                      </span>
                    </div>
                    {plan.delayed_actions! > 0 && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{plan.delayed_actions} Eylem Gecikmeli</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>İlerleme</span>
                      <span className="font-semibold">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/internal-control/action-plans/${plan.id}`)}
                    className="w-full"
                  >
                    Detayları Gör
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Yeni Eylem Planı"
      >
        <form onSubmit={handleAddPlan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
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
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
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
              <option value="draft">Taslak</option>
              <option value="active">Aktif</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal Edildi</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              İptal
            </Button>
            <Button type="submit">
              Oluştur
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
