import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import { Plus, Edit2, Trash2, Calendar, CheckCircle, Clock } from 'lucide-react';

interface ICPlan {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  description: string | null;
  status: 'active' | 'completed';
  created_at: string;
  created_by: string;
}

export default function InternalControlPlans() {
  const { user, profile } = useAuth();
  const { selectedPlanId, refreshPlan } = useICPlan();
  const [plans, setPlans] = useState<ICPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ICPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_year: new Date().getFullYear(),
    end_year: new Date().getFullYear() + 2,
    description: '',
    status: 'active' as 'active' | 'completed',
  });

  useEffect(() => {
    if (profile?.organization_id) {
      fetchPlans();
    }
  }, [profile?.organization_id]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('ic_plans')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching IC plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPlan) {
        const { error } = await supabase
          .from('ic_plans')
          .update({
            name: formData.name,
            start_year: formData.start_year,
            end_year: formData.end_year,
            description: formData.description || null,
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPlan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('ic_plans').insert({
          organization_id: profile?.organization_id,
          name: formData.name,
          start_year: formData.start_year,
          end_year: formData.end_year,
          description: formData.description || null,
          status: formData.status,
          created_by: user?.id,
        });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingPlan(null);
      setFormData({
        name: '',
        start_year: new Date().getFullYear(),
        end_year: new Date().getFullYear() + 2,
        description: '',
        status: 'active',
      });
      fetchPlans();
      refreshPlan();
    } catch (error) {
      console.error('Error saving IC plan:', error);
      alert('Kaydetme sırasında hata oluştu');
    }
  };

  const handleEdit = (plan: ICPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      start_year: plan.start_year,
      end_year: plan.end_year,
      description: plan.description || '',
      status: plan.status,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu iç kontrol planını silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase.from('ic_plans').delete().eq('id', id);

      if (error) throw error;

      fetchPlans();
      refreshPlan();
    } catch (error) {
      console.error('Error deleting IC plan:', error);
      alert('Silme sırasında hata oluştu');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { label: 'Aktif', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      completed: { label: 'Tamamlandı', className: 'bg-blue-100 text-blue-800', icon: Clock },
    };
    const badge = badges[status as keyof typeof badges];
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

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
          <h1 className="text-2xl font-bold text-gray-900">İç Kontrol Planları</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dönemsel iç kontrol planlarını yönetin. Aktif plan otomatik olarak tüm sayfalarda kullanılır.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingPlan(null);
            setFormData({
              name: '',
              start_year: new Date().getFullYear(),
              end_year: new Date().getFullYear() + 2,
              description: '',
              status: 'active',
            });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz plan yok</h3>
          <p className="text-gray-500 mb-4">
            İlk iç kontrol planınızı oluşturarak başlayın
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Plan Oluştur
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isActive = plan.status === 'active';
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all ${
                  isActive ? 'ring-2 ring-green-500 ring-offset-2' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {plan.start_year} - {plan.end_year}
                        </span>
                      </div>
                    </div>
                    <div>{getStatusBadge(plan.status)}</div>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">{plan.description}</p>
                  )}

                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleEdit(plan)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Edit2 className="w-4 h-4" />
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingPlan ? 'Planı Düzenle' : 'Yeni Plan Oluştur'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Adı*
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="örn: 2024-2026 İç Kontrol KİKS Standartları Eylem Planı"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Başlangıç Yılı*
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.start_year}
                    onChange={(e) =>
                      setFormData({ ...formData, start_year: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bitiş Yılı*
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.end_year}
                    onChange={(e) =>
                      setFormData({ ...formData, end_year: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durum*</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'active' | 'completed',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Aktif</option>
                  <option value="completed">Tamamlandı</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Plan hakkında detaylı açıklama..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingPlan(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingPlan ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
