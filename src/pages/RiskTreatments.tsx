import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Plus, ArrowLeft, Calendar, CheckCircle, Clock, XCircle, Edit2, Trash2 } from 'lucide-react';

interface RiskTreatment {
  id: string;
  risk_id: string;
  title: string;
  description: string;
  responsible_unit_id: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  progress_percent: number;
  status: string;
  risk: {
    code: string;
    name: string;
  };
  responsible_unit: {
    name: string;
  } | null;
}

export default function RiskTreatments() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [treatments, setTreatments] = useState<RiskTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [risks, setRisks] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    risk_id: '',
    title: '',
    description: '',
    responsible_unit_id: '',
    planned_start_date: '',
    planned_end_date: '',
    progress_percent: 0,
    status: 'planned'
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadTreatments(), loadRisks(), loadDepartments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadTreatments = async () => {
    const { data: risks } = await supabase
      .from('risks')
      .select('id')
      .eq('organization_id', profile?.organization_id);

    if (!risks || risks.length === 0) {
      setTreatments([]);
      return;
    }

    const { data, error } = await supabase
      .from('risk_treatments')
      .select(`
        *,
        risk:risks(code, name),
        responsible_unit:departments(name)
      `)
      .in('risk_id', risks.map(r => r.id))
      .eq('is_active', true)
      .order('planned_end_date', { ascending: true });

    if (error) throw error;
    setTreatments(data || []);
  };

  const loadRisks = async () => {
    const { data, error } = await supabase
      .from('risks')
      .select('id, code, name')
      .eq('organization_id', profile?.organization_id)
      .eq('is_active', true)
      .order('code');

    if (error) throw error;
    setRisks(data || []);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile?.organization_id)
      .order('name');

    if (error) throw error;
    setDepartments(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('risk_treatments')
        .insert(formData);

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        risk_id: '',
        title: '',
        description: '',
        responsible_unit_id: '',
        planned_start_date: '',
        planned_end_date: '',
        progress_percent: 0,
        status: 'planned'
      });
      loadTreatments();
    } catch (error) {
      console.error('Faaliyet eklenirken hata:', error);
      alert('Faaliyet eklenemedi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu faaliyeti silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_treatments')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      loadTreatments();
    } catch (error) {
      console.error('Faaliyet silinirken hata:', error);
      alert('Faaliyet silinemedi');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      planned: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Planlı', icon: Calendar },
      in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Devam Ediyor', icon: Clock },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Tamamlandı', icon: CheckCircle },
      delayed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Gecikmiş', icon: XCircle },
      cancelled: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'İptal', icon: XCircle }
    };

    const style = styles[status as keyof typeof styles] || styles.planned;
    const Icon = style.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="w-3 h-3" />
        {style.label}
      </span>
    );
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('risks')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Risk Faaliyetleri</h1>
            <p className="text-slate-600">Risk azaltma faaliyetlerini takip edin</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Faaliyet
        </button>
      </div>

      {treatments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">Henüz faaliyet tanımlanmamış</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            İlk Faaliyeti Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {treatments.map((treatment) => (
            <div key={treatment.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{treatment.title}</h3>
                      {getStatusBadge(treatment.status)}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{treatment.description}</p>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>Risk: {treatment.risk.code} - {treatment.risk.name}</span>
                      {treatment.responsible_unit && (
                        <span>Sorumlu: {treatment.responsible_unit.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(treatment.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">İlerleme</span>
                    <span className="font-medium text-slate-900">{treatment.progress_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getProgressColor(treatment.progress_percent)}`}
                      style={{ width: `${treatment.progress_percent}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500 mb-1">Planlanan Başlangıç</div>
                      <div className="font-medium text-slate-900">
                        {new Date(treatment.planned_start_date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Planlanan Bitiş</div>
                      <div className="font-medium text-slate-900">
                        {new Date(treatment.planned_end_date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                    {treatment.actual_start_date && (
                      <div>
                        <div className="text-slate-500 mb-1">Gerçek Başlangıç</div>
                        <div className="font-medium text-slate-900">
                          {new Date(treatment.actual_start_date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    )}
                    {treatment.actual_end_date && (
                      <div>
                        <div className="text-slate-500 mb-1">Gerçek Bitiş</div>
                        <div className="font-medium text-slate-900">
                          {new Date(treatment.actual_end_date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Yeni Faaliyet Ekle</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Risk</label>
                <select
                  value={formData.risk_id}
                  onChange={(e) => setFormData({ ...formData, risk_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Faaliyet Başlığı</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sorumlu Birim</label>
                <select
                  value={formData.responsible_unit_id}
                  onChange={(e) => setFormData({ ...formData, responsible_unit_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Seçiniz...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Planlanan Başlangıç</label>
                  <input
                    type="date"
                    value={formData.planned_start_date}
                    onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Planlanan Bitiş</label>
                  <input
                    type="date"
                    value={formData.planned_end_date}
                    onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
