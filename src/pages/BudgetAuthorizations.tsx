import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BudgetAuthorization, Department } from '../types/database';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

export default function BudgetAuthorizations() {
  const { profile } = useAuth();
  const [authorizations, setAuthorizations] = useState<BudgetAuthorization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    budget_type: 'revenue' as 'revenue' | 'expense',
    authorized_department_id: '',
    description: '',
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadAuthorizations();
      loadDepartments();
    }
  }, [profile]);

  const loadAuthorizations = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('budget_authorizations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAuthorizations(data || []);
    } catch (error) {
      console.error('Yetkilendirmeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Müdürlükler yüklenirken hata:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !profile?.id) return;

    try {
      const { error } = await supabase
        .from('budget_authorizations')
        .insert({
          organization_id: profile.organization_id,
          budget_type: formData.budget_type,
          authorized_department_id: formData.authorized_department_id,
          description: formData.description || null,
          authorized_by: profile.id,
        });

      if (error) throw error;
      alert('Yetkilendirme başarıyla eklendi');
      loadAuthorizations();
      closeModal();
    } catch (error: any) {
      console.error('Yetkilendirme eklenirken hata:', error);
      alert('Hata: ' + (error.message || 'Yetkilendirme eklenemedi'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu yetkilendirmeyi kaldırmak istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('budget_authorizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Yetkilendirme kaldırıldı');
      loadAuthorizations();
    } catch (error: any) {
      console.error('Yetkilendirme kaldırılırken hata:', error);
      alert('Hata: ' + (error.message || 'Yetkilendirme kaldırılamadı'));
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormData({
      budget_type: 'revenue',
      authorized_department_id: '',
      description: '',
    });
  };

  const getDepartmentName = (deptId: string) => {
    return departments.find(d => d.id === deptId)?.name || 'Bilinmeyen';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bütçe Yetkilendirmeleri</h1>
          <p className="text-slate-600 mt-1">
            Gelir ve gider bütçe verisi girebilecek müdürlükleri belirleyin
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Yetkilendirme
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-green-600" />
              Gelir Bütçe Yetkisi
            </h3>
            {authorizations.filter(a => a.budget_type === 'revenue' && a.is_active).length === 0 ? (
              <p className="text-sm text-slate-600">Yetkilendirilmiş müdürlük yok</p>
            ) : (
              <div className="space-y-2">
                {authorizations
                  .filter(a => a.budget_type === 'revenue' && a.is_active)
                  .map(auth => (
                    <div
                      key={auth.id}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {getDepartmentName(auth.authorized_department_id)}
                        </div>
                        {auth.description && (
                          <p className="text-sm text-slate-600 mt-1">{auth.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(auth.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              Gider Bütçe Yetkisi
            </h3>
            {authorizations.filter(a => a.budget_type === 'expense' && a.is_active).length === 0 ? (
              <p className="text-sm text-slate-600">Yetkilendirilmiş müdürlük yok</p>
            ) : (
              <div className="space-y-2">
                {authorizations
                  .filter(a => a.budget_type === 'expense' && a.is_active)
                  .map(auth => (
                    <div
                      key={auth.id}
                      className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {getDepartmentName(auth.authorized_department_id)}
                        </div>
                        {auth.description && (
                          <p className="text-sm text-slate-600 mt-1">{auth.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(auth.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title="Yeni Yetkilendirme">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bütçe Tipi *
            </label>
            <select
              value={formData.budget_type}
              onChange={(e) => setFormData({ ...formData, budget_type: e.target.value as 'revenue' | 'expense' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="revenue">Gelir Bütçesi</option>
              <option value="expense">Gider Bütçesi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Yetkilendirilecek Müdürlük *
            </label>
            <select
              value={formData.authorized_department_id}
              onChange={(e) => setFormData({ ...formData, authorized_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz...</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              İptal
            </Button>
            <Button type="submit">Ekle</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
