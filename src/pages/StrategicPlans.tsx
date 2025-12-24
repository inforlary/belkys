import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit2, Trash2, Search, Copy } from 'lucide-react';

interface StrategicPlan {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  description: string;
  status: string;
  created_at: string;
}

export default function StrategicPlans() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<StrategicPlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    start_year: new Date().getFullYear(),
    end_year: new Date().getFullYear() + 5,
    description: '',
    status: 'draft',
  });
  const [submitting, setSubmitting] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloningPlan, setCloningPlan] = useState<StrategicPlan | null>(null);
  const [cloneFormData, setCloneFormData] = useState({
    name: '',
    start_year: new Date().getFullYear(),
    end_year: new Date().getFullYear() + 5,
    copy_analyses: true,
  });
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    loadPlans();
  }, [profile]);

  const loadPlans = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('strategic_plans')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Planlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !profile.id) return;

    setSubmitting(true);

    try {
      if (editingPlan) {
        const { error } = await supabase
          .from('strategic_plans')
          .update(formData)
          .eq('id', editingPlan.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('strategic_plans')
          .insert({
            ...formData,
            organization_id: profile.organization_id,
            created_by: profile.id,
          });

        if (error) throw error;
      }

      await loadPlans();
      handleCloseModal();
    } catch (error) {
      console.error('Plan kaydedilirken hata:', error);
      alert('Plan kaydedilirken bir hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu planı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve plana bağlı tüm veriler silinecektir.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('strategic_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadPlans();
    } catch (error) {
      console.error('Plan silinirken hata:', error);
      alert('Plan silinirken bir hata oluştu');
    }
  };

  const handleEdit = (plan: StrategicPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      start_year: plan.start_year,
      end_year: plan.end_year,
      description: plan.description,
      status: plan.status,
    });
    setIsModalOpen(true);
  };

  const handleClone = (plan: StrategicPlan) => {
    setCloningPlan(plan);
    setCloneFormData({
      name: `${plan.name} (Kopya)`,
      start_year: plan.end_year,
      end_year: plan.end_year + (plan.end_year - plan.start_year),
      copy_analyses: true,
    });
    setIsCloneModalOpen(true);
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !cloningPlan) return;

    setCloning(true);

    try {
      console.log('Cloning plan with params:', {
        p_source_plan_id: cloningPlan.id,
        p_new_name: cloneFormData.name,
        p_new_start_year: cloneFormData.start_year,
        p_new_end_year: cloneFormData.end_year,
        p_copy_analyses: cloneFormData.copy_analyses,
        p_user_id: profile.id,
      });

      const { data, error } = await supabase.rpc('clone_strategic_plan', {
        p_source_plan_id: cloningPlan.id,
        p_new_name: cloneFormData.name,
        p_new_start_year: cloneFormData.start_year,
        p_new_end_year: cloneFormData.end_year,
        p_copy_analyses: cloneFormData.copy_analyses,
        p_user_id: profile.id,
      });

      console.log('Clone result:', { data, error });

      if (error) {
        console.error('Clone error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

      alert('Stratejik plan başarıyla çoğaltıldı!');
      await loadPlans();
      handleCloseCloneModal();
    } catch (error: any) {
      console.error('Plan çoğaltılırken hata:', error);
      const errorMessage = error?.message || 'Plan çoğaltılırken bir hata oluştu';
      alert(`Plan çoğaltılırken bir hata oluştu:\n\n${errorMessage}`);
    } finally {
      setCloning(false);
    }
  };

  const handleCloseCloneModal = () => {
    setIsCloneModalOpen(false);
    setCloningPlan(null);
    setCloneFormData({
      name: '',
      start_year: new Date().getFullYear(),
      end_year: new Date().getFullYear() + 5,
      copy_analyses: true,
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlan(null);
    setFormData({
      name: '',
      start_year: new Date().getFullYear(),
      end_year: new Date().getFullYear() + 5,
      description: '',
      status: 'draft',
    });
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { label: string; color: string }> = {
      draft: { label: 'Taslak', color: 'bg-slate-100 text-slate-700' },
      active: { label: 'Aktif', color: 'bg-green-100 text-green-700' },
      completed: { label: 'Tamamlandı', color: 'bg-blue-100 text-blue-700' },
    };

    const statusInfo = statuses[status] || statuses.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Stratejik Planlar</h1>
          <p className="text-slate-600 mt-1">Belediyenizin stratejik planlarını yönetin</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Plan ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-0">
          {filteredPlans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Henüz stratejik plan bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Plan Adı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Dönem
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Açıklama
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{plan.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">
                          {plan.start_year} - {plan.end_year}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(plan.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 max-w-md truncate">
                          {plan.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleClone(plan)}
                          title="Planı Çoğalt"
                        >
                          <Copy className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(plan)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(plan.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPlan ? 'Planı Düzenle' : 'Yeni Stratejik Plan'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Plan Adı *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="örn: 2025-2029 Stratejik Planı"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Başlangıç Yılı *
              </label>
              <input
                type="number"
                value={formData.start_year}
                onChange={(e) => setFormData({ ...formData, start_year: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bitiş Yılı *
              </label>
              <input
                type="number"
                value={formData.end_year}
                onChange={(e) => setFormData({ ...formData, end_year: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Durum
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="draft">Taslak</option>
              <option value="active">Aktif</option>
              <option value="completed">Tamamlandı</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Plan hakkında detaylı açıklama..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              İptal
            </Button>
            <Button type="submit" loading={submitting}>
              {editingPlan ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCloneModalOpen}
        onClose={handleCloseCloneModal}
        title={`Planı Çoğalt: ${cloningPlan?.name}`}
      >
        <form onSubmit={handleCloneSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              Bu işlem planın tüm amaçlarını, hedeflerini, göstergelerini ve faaliyetlerini yeni bir plana kopyalayacaktır.
              Orijinal plan değiştirilmeyecektir.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Yeni Plan Adı *
            </label>
            <input
              type="text"
              value={cloneFormData.name}
              onChange={(e) => setCloneFormData({ ...cloneFormData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="örn: 2026-2030 Stratejik Planı"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Başlangıç Yılı *
              </label>
              <input
                type="number"
                value={cloneFormData.start_year}
                onChange={(e) => setCloneFormData({ ...cloneFormData, start_year: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bitiş Yılı *
              </label>
              <input
                type="number"
                value={cloneFormData.end_year}
                onChange={(e) => setCloneFormData({ ...cloneFormData, end_year: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="copy_analyses"
              checked={cloneFormData.copy_analyses}
              onChange={(e) => setCloneFormData({ ...cloneFormData, copy_analyses: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="copy_analyses" className="text-sm text-slate-700">
              PESTLE ve SWOT analizlerini de kopyala
            </label>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-900 mb-2">Kopyalanacaklar:</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>✓ Tüm Amaçlar</li>
              <li>✓ Tüm Hedefler</li>
              <li>✓ Tüm Göstergeler</li>
              <li>✓ Tüm Faaliyetler</li>
              {cloneFormData.copy_analyses && (
                <>
                  <li>✓ PESTLE Analizleri</li>
                  <li>✓ SWOT Analizleri</li>
                </>
              )}
            </ul>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseCloneModal}>
              İptal
            </Button>
            <Button type="submit" loading={cloning}>
              <Copy className="w-4 h-4 mr-2" />
              Çoğalt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
