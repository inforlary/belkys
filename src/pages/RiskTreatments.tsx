import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, Eye, Trash2, X, Filter, TrendingUp, Calendar } from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
}

interface Treatment {
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
  estimated_budget: number;
  progress_percent: number;
  status: string;
  risk_id: string;
  risk: Risk;
  responsible_department: Department;
  responsible_person: User;
}

const treatmentTypeLabels: Record<string, string> = {
  NEW_CONTROL: 'Yeni Kontrol Oluştur',
  IMPROVE_CONTROL: 'Mevcut Kontrolü İyileştir',
  TRANSFER: 'Riski Transfer Et',
  ACCEPT: 'Riski Kabul Et',
  AVOID: 'Riskten Kaçın'
};

const statusLabels: Record<string, { label: string; color: string }> = {
  PLANNED: { label: 'Planlandı', color: 'bg-gray-100 text-gray-800' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
  DELAYED: { label: 'Gecikmiş', color: 'bg-red-100 text-red-800' },
  ON_HOLD: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-800' },
  CANCELLED: { label: 'İptal Edildi', color: 'bg-gray-200 text-gray-700' }
};

export default function RiskTreatments() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);

  const [filters, setFilters] = useState({
    risk_id: '',
    status: '',
    department_id: '',
    date_from: '',
    date_to: ''
  });

  const [formData, setFormData] = useState({
    risk_id: '',
    title: '',
    description: '',
    treatment_type: 'NEW_CONTROL',
    responsible_department_id: '',
    responsible_person_id: '',
    planned_start_date: '',
    planned_end_date: '',
    estimated_budget: '',
    required_resources: '',
    expected_impact: '',
    target_residual_score: ''
  });

  const [progressData, setProgressData] = useState({
    progress_percent: 0,
    status: 'IN_PROGRESS',
    notes: '',
    challenges: '',
    next_steps: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      const [treatmentsRes, risksRes, departmentsRes, usersRes] = await Promise.all([
        supabase
          .from('risk_treatments')
          .select(`
            *,
            risk:risks(id, code, name),
            responsible_department:departments!responsible_department_id(id, name),
            responsible_person:profiles!responsible_person_id(id, full_name)
          `)
          .eq('risk:risks.organization_id', profile?.organization_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('risks')
          .select('id, code, name')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name'),

        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile?.organization_id)
          .order('full_name')
      ]);

      if (treatmentsRes.error) throw treatmentsRes.error;
      if (risksRes.error) throw risksRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (usersRes.error) throw usersRes.error;

      setTreatments(treatmentsRes.data || []);
      setRisks(risksRes.data || []);
      setDepartments(departmentsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(treatment?: Treatment) {
    if (treatment) {
      setEditingTreatment(treatment);
      setFormData({
        risk_id: treatment.risk_id,
        title: treatment.title,
        description: treatment.description || '',
        treatment_type: treatment.treatment_type,
        responsible_department_id: treatment.responsible_department_id || '',
        responsible_person_id: treatment.responsible_person_id || '',
        planned_start_date: treatment.planned_start_date || '',
        planned_end_date: treatment.planned_end_date || '',
        estimated_budget: treatment.estimated_budget?.toString() || '',
        required_resources: '',
        expected_impact: '',
        target_residual_score: ''
      });
    } else {
      setEditingTreatment(null);
      setFormData({
        risk_id: '',
        title: '',
        description: '',
        treatment_type: 'NEW_CONTROL',
        responsible_department_id: '',
        responsible_person_id: '',
        planned_start_date: '',
        planned_end_date: '',
        estimated_budget: '',
        required_resources: '',
        expected_impact: '',
        target_residual_score: ''
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTreatment(null);
  }

  function openProgressModal(treatment: Treatment) {
    setEditingTreatment(treatment);
    setProgressData({
      progress_percent: treatment.progress_percent,
      status: treatment.status,
      notes: '',
      challenges: '',
      next_steps: ''
    });
    setShowProgressModal(true);
  }

  function closeProgressModal() {
    setShowProgressModal(false);
    setEditingTreatment(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.risk_id || !formData.title || !formData.planned_end_date) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      let code = '';
      if (!editingTreatment) {
        const selectedRisk = risks.find(r => r.id === formData.risk_id);
        const { data: existingTreatments } = await supabase
          .from('risk_treatments')
          .select('code')
          .eq('risk_id', formData.risk_id)
          .order('created_at', { ascending: false })
          .limit(1);

        let nextNumber = 1;
        if (existingTreatments && existingTreatments.length > 0) {
          const lastCode = existingTreatments[0].code;
          const match = lastCode?.match(/-(\d+)$/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        code = `${selectedRisk?.code}-F${nextNumber.toString().padStart(2, '0')}`;
      }

      const treatmentData = {
        risk_id: formData.risk_id,
        code: editingTreatment ? editingTreatment.code : code,
        title: formData.title,
        description: formData.description,
        treatment_type: formData.treatment_type,
        responsible_department_id: formData.responsible_department_id || null,
        responsible_person_id: formData.responsible_person_id || null,
        planned_start_date: formData.planned_start_date || null,
        planned_end_date: formData.planned_end_date,
        estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : null,
        status: editingTreatment ? editingTreatment.status : 'PLANNED',
        progress_percent: editingTreatment ? editingTreatment.progress_percent : 0
      };

      if (editingTreatment) {
        const { error } = await supabase
          .from('risk_treatments')
          .update(treatmentData)
          .eq('id', editingTreatment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_treatments')
          .insert(treatmentData);

        if (error) throw error;
      }

      closeModal();
      loadData();
    } catch (error) {
      console.error('Faaliyet kaydedilirken hata:', error);
      alert('Faaliyet kaydedilemedi');
    }
  }

  async function handleProgressUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!editingTreatment || !progressData.notes) {
      alert('Lütfen açıklama girin');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('risk_treatments')
        .update({
          progress_percent: progressData.progress_percent,
          status: progressData.status
        })
        .eq('id', editingTreatment.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('risk_treatment_updates')
        .insert({
          treatment_id: editingTreatment.id,
          updated_by_id: profile?.id,
          previous_progress: editingTreatment.progress_percent,
          new_progress: progressData.progress_percent,
          previous_status: editingTreatment.status,
          new_status: progressData.status,
          notes: progressData.notes,
          challenges: progressData.challenges,
          next_steps: progressData.next_steps
        });

      if (historyError) throw historyError;

      closeProgressModal();
      loadData();
    } catch (error) {
      console.error('İlerleme güncellenirken hata:', error);
      alert('İlerleme güncellenemedi');
    }
  }

  async function handleDelete(treatmentId: string) {
    if (!confirm('Bu faaliyeti silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_treatments')
        .delete()
        .eq('id', treatmentId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Faaliyet silinirken hata:', error);
      alert('Faaliyet silinemedi');
    }
  }

  function isOverdue(treatment: Treatment): boolean {
    if (treatment.status === 'COMPLETED') return false;
    const endDate = new Date(treatment.planned_end_date);
    return endDate < new Date();
  }

  const filteredTreatments = treatments.filter(t => {
    if (filters.risk_id && t.risk_id !== filters.risk_id) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.department_id && t.responsible_department_id !== filters.department_id) return false;
    if (filters.date_from && t.planned_end_date < filters.date_from) return false;
    if (filters.date_to && t.planned_end_date > filters.date_to) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Risk Faaliyetleri
          </h1>
          <p className="text-gray-600 mt-1">Risk azaltma faaliyetlerini planlayın ve takip edin</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Yeni Faaliyet Ekle
        </button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Filtreler</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk</label>
              <select
                value={filters.risk_id}
                onChange={(e) => setFilters({ ...filters, risk_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Tümü</option>
                {risks.map((risk) => (
                  <option key={risk.id} value={risk.id}>{risk.code} - {risk.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Tümü</option>
                {Object.entries(statusLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
              <select
                value={filters.department_id}
                onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Tümü</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kod</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Faaliyet</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">İlgili Risk</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tip</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sorumlu</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Hedef Tarih</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">İlerleme</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Durum</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredTreatments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      Faaliyet bulunamadı
                    </td>
                  </tr>
                ) : (
                  filteredTreatments.map((treatment) => (
                    <tr
                      key={treatment.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${isOverdue(treatment) ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{treatment.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{treatment.title}</div>
                        {treatment.description && (
                          <div className="text-sm text-gray-500 mt-1">{treatment.description.substring(0, 60)}...</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`risks/register/${treatment.risk_id}`)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {treatment.risk?.code}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {treatmentTypeLabels[treatment.treatment_type] || treatment.treatment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {treatment.responsible_department?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${treatment.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{treatment.progress_percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusLabels[treatment.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {statusLabels[treatment.status]?.label || treatment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openProgressModal(treatment)}
                            className="p-1 text-green-600 hover:text-green-800"
                            title="İlerleme Güncelle"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openModal(treatment)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(treatment.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingTreatment ? 'Faaliyet Düzenle' : 'Yeni Faaliyet Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlgili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.risk_id}
              onChange={(e) => setFormData({ ...formData, risk_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
              disabled={!!editingTreatment}
            >
              <option value="">Seçiniz</option>
              {risks.map((risk) => (
                <option key={risk.id} value={risk.id}>{risk.code} - {risk.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Faaliyet Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Faaliyet Tipi <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.treatment_type}
              onChange={(e) => setFormData({ ...formData, treatment_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {Object.entries(treatmentTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Birim</label>
              <select
                value={formData.responsible_department_id}
                onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Seçiniz</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
              <select
                value={formData.responsible_person_id}
                onChange={(e) => setFormData({ ...formData, responsible_person_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Seçiniz</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planlanan Başlangıç</label>
              <input
                type="date"
                value={formData.planned_start_date}
                onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Planlanan Bitiş <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Bütçe (TL)</label>
            <input
              type="number"
              value={formData.estimated_budget}
              onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              step="0.01"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingTreatment ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showProgressModal} onClose={closeProgressModal} title="İlerleme Güncelle">
        <form onSubmit={handleProgressUpdate} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Faaliyet: {editingTreatment?.code} - {editingTreatment?.title}
            </div>
            <div className="text-sm text-gray-600">
              Mevcut İlerleme: {editingTreatment?.progress_percent}%
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${editingTreatment?.progress_percent}%` }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yeni İlerleme (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={progressData.progress_percent}
              onChange={(e) => setProgressData({ ...progressData, progress_percent: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600">
              <span>0%</span>
              <span className="font-semibold text-blue-600">{progressData.progress_percent}%</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
            <select
              value={progressData.status}
              onChange={(e) => setProgressData({ ...progressData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              value={progressData.notes}
              onChange={(e) => setProgressData({ ...progressData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Bu güncelleme ile ilgili açıklama..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Karşılaşılan Sorunlar</label>
            <textarea
              value={progressData.challenges}
              onChange={(e) => setProgressData({ ...progressData, challenges: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sonraki Adımlar</label>
            <textarea
              value={progressData.next_steps}
              onChange={(e) => setProgressData({ ...progressData, next_steps: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={closeProgressModal}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Güncelle
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
