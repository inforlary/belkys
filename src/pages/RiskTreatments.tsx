import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckSquare, Plus, Edit, Eye, Trash2, X } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';

interface Risk {
  id: string;
  code: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Treatment {
  id: string;
  code: string;
  title: string;
  description: string;
  treatment_type: string;
  responsible_department_id: string;
  planned_start_date: string;
  planned_end_date: string;
  estimated_budget: number;
  progress_percent: number;
  status: string;
  risk_id: string;
  risk: Risk;
  responsible_department: Department;
}

const treatmentTypeLabels: Record<string, string> = {
  NEW_CONTROL: 'Yeni Kontrol',
  IMPROVE_CONTROL: 'Mevcut Kontrolü İyileştir',
  TRANSFER: 'Transfer',
  ACCEPT: 'Kabul',
  AVOID: 'Kaçın'
};

const statusLabels: Record<string, string> = {
  PLANNED: 'Planlandı',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  DELAYED: 'Gecikti'
};

export default function RiskTreatments() {
  const { profile } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [formData, setFormData] = useState({
    risk_id: '',
    title: '',
    description: '',
    treatment_type: 'NEW_CONTROL',
    responsible_department_id: '',
    planned_start_date: '',
    planned_end_date: '',
    estimated_budget: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    try {
      const [treatmentsRes, risksRes, deptsRes] = await Promise.all([
        supabase
          .from('risk_treatments')
          .select(`
            *,
            risk:risks(id, code, name),
            responsible_department:departments(id, name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('risks')
          .select('id, code, name')
          .eq('organization_id', profile!.organization_id)
          .order('code'),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile!.organization_id)
          .order('name')
      ]);

      if (treatmentsRes.error) throw treatmentsRes.error;
      if (risksRes.error) throw risksRes.error;
      if (deptsRes.error) throw deptsRes.error;

      setTreatments(treatmentsRes.data || []);
      setRisks(risksRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async (riskId: string) => {
    const risk = risks.find(r => r.id === riskId);
    if (!risk) return 'RF-001-01';

    const { data } = await supabase
      .from('risk_treatments')
      .select('code')
      .eq('risk_id', riskId)
      .order('code', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) {
      return `${risk.code}-01`;
    }

    const lastCode = data[0].code;
    const parts = lastCode.split('-');
    const lastNumber = parseInt(parts[parts.length - 1] || '0');
    return `${risk.code}-${String(lastNumber + 1).padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const code = editingTreatment?.code || await generateCode(formData.risk_id);

      const treatmentData = {
        ...formData,
        code,
        estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : null,
        progress_percent: 0,
        status: 'PLANNED'
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
          .insert([treatmentData]);

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Faaliyet kaydedilirken hata:', error);
      alert('Faaliyet kaydedilemedi!');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu faaliyeti silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_treatments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Faaliyet silinirken hata:', error);
      alert('Faaliyet silinemedi!');
    }
  };

  const openEditModal = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setFormData({
      risk_id: treatment.risk_id,
      title: treatment.title,
      description: treatment.description || '',
      treatment_type: treatment.treatment_type,
      responsible_department_id: treatment.responsible_department_id || '',
      planned_start_date: treatment.planned_start_date || '',
      planned_end_date: treatment.planned_end_date || '',
      estimated_budget: treatment.estimated_budget?.toString() || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingTreatment(null);
    setFormData({
      risk_id: '',
      title: '',
      description: '',
      treatment_type: 'NEW_CONTROL',
      responsible_department_id: '',
      planned_start_date: '',
      planned_end_date: '',
      estimated_budget: ''
    });
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
            <CheckSquare className="w-8 h-8 text-green-600" />
            Risk Faaliyetleri
          </h1>
          <p className="text-slate-600 mt-2">Risk azaltma ve tedavi faaliyetlerini yönetin</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Faaliyet Ekle
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Faaliyet Kodu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Faaliyet Başlığı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">İlgili Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sorumlu Birim</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Hedef Tarih</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">İlerleme %</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {treatments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Henüz faaliyet bulunmuyor
                  </td>
                </tr>
              ) : (
                treatments.map((treatment) => (
                  <tr key={treatment.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {treatment.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{treatment.title}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {treatment.risk?.code} - {treatment.risk?.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {treatment.responsible_department?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${treatment.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 min-w-[35px]">{treatment.progress_percent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={treatment.status} labels={statusLabels} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => window.location.href = `/risks/treatments/${treatment.id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="Detay"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(treatment)}
                          className="text-slate-600 hover:text-slate-800"
                          title="Düzenle"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(treatment.id)}
                          className="text-red-600 hover:text-red-800"
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingTreatment ? 'Faaliyet Düzenle' : 'Yeni Faaliyet Ekle'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Risk <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.risk_id}
                  onChange={(e) => setFormData({ ...formData, risk_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz...</option>
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.code} - {risk.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Faaliyet Başlığı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Faaliyet Türü
                </label>
                <select
                  value={formData.treatment_type}
                  onChange={(e) => setFormData({ ...formData, treatment_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(treatmentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sorumlu Birim
                </label>
                <select
                  value={formData.responsible_department_id}
                  onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Planlanan Başlangıç
                  </label>
                  <input
                    type="date"
                    value={formData.planned_start_date}
                    onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Planlanan Bitiş <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.planned_end_date}
                    onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tahmini Bütçe (₺)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.estimated_budget}
                  onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
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
          </div>
        </div>
      )}
    </div>
  );
}
