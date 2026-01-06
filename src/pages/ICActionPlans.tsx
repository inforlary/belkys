import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ClipboardCheck, Plus, Eye, X } from 'lucide-react';
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
  created_at: string;
}

export default function ICActionPlans() {
  const { profile } = useAuth();
  const navigate = useLocation();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
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
        const completionPercentage = actionCount > 0 ? Math.round((completedCount / actionCount) * 100) : 0;

        return {
          ...plan,
          action_count: actionCount,
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
      const { error } = await supabase
        .from('ic_action_plans')
        .insert({
          organization_id: profile?.organization_id,
          name: formData.name,
          description: formData.description,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: 'DRAFT',
          prepared_by_id: profile?.id
        });

      if (error) throw error;

      setShowCreateModal(false);
      setFormData({ name: '', description: '', start_date: '', end_date: '' });
      loadActionPlans();
    } catch (error) {
      console.error('Eylem planı oluşturulurken hata:', error);
      alert('Eylem planı oluşturulurken bir hata oluştu');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
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
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Eylem Planı Oluştur
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Plan Adı</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Dönem</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Durum</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Eylem Sayısı</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Tamamlanma</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {actionPlans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  Henüz eylem planı bulunmuyor
                </td>
              </tr>
            ) : (
              actionPlans.map((plan) => (
                <tr key={plan.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{plan.name}</div>
                    {plan.description && (
                      <div className="text-sm text-slate-500 mt-1">{plan.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(plan.start_date).toLocaleDateString('tr-TR')} - {new Date(plan.end_date).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(plan.status)}`}>
                      {getStatusLabel(plan.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {plan.action_count || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-600 h-full rounded-full"
                          style={{ width: `${plan.completion_percentage || 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-900 min-w-[3rem] text-right">
                        {plan.completion_percentage || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate(`/internal-control/action-plans/${plan.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="w-4 h-4" />
                      Detay
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
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

          <div className="flex justify-end gap-3 pt-4">
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
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
