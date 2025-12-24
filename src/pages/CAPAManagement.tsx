import { useState, useEffect } from 'react';
import { FileWarning, Plus, Edit2, Trash2, AlertCircle, Save, X, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface CAPA {
  id: string;
  capa_code: string;
  title: string;
  description: string;
  capa_type: 'corrective' | 'preventive' | 'both';
  finding_id?: string;
  root_cause: string;
  proposed_action: string;
  responsible_user_id: string;
  responsible_user_name?: string;
  responsible_department_id?: string;
  due_date: string;
  actual_completion_date?: string;
  status: 'open' | 'in_progress' | 'pending_verification' | 'verified' | 'closed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  completion_percentage: number;
  verified_by?: string;
  verification_date?: string;
  verification_notes?: string;
  effectiveness_review_date?: string;
  is_effective?: boolean;
}

const TYPE_LABELS = {
  corrective: 'Düzeltici',
  preventive: 'Önleyici',
  both: 'Her İkisi'
};

const TYPE_COLORS = {
  corrective: 'bg-orange-100 text-orange-800',
  preventive: 'bg-green-100 text-green-800',
  both: 'bg-blue-100 text-blue-800'
};

const STATUS_LABELS = {
  open: 'Açık',
  in_progress: 'Devam Ediyor',
  pending_verification: 'Doğrulama Bekliyor',
  verified: 'Doğrulandı',
  closed: 'Kapatıldı',
  overdue: 'Gecikmiş'
};

const STATUS_COLORS = {
  open: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending_verification: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-teal-100 text-teal-800',
  closed: 'bg-gray-100 text-gray-800',
  overdue: 'bg-red-100 text-red-800'
};

const PRIORITY_LABELS = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik'
};

const PRIORITY_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

export default function CAPAManagement() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    capa_type: 'corrective' as const,
    finding_id: '',
    root_cause: '',
    proposed_action: '',
    responsible_user_id: '',
    responsible_department_id: '',
    due_date: '',
    actual_completion_date: '',
    status: 'open' as const,
    priority: 'medium' as const,
    completion_percentage: 0,
    is_effective: false
  });

  useEffect(() => {
    if (selectedPlanId) {
      loadData();
    }
  }, [profile?.organization_id, selectedPlanId]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      await Promise.all([
        loadCapas(),
        loadUsers(),
        loadDepartments(),
        loadFindings()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadCapas = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_capas')
        .select(`
          *,
          profiles!ic_capas_responsible_user_id_fkey(full_name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const capasWithStatus = (data || []).map(capa => {
        let status = capa.status;
        if (capa.due_date && new Date(capa.due_date) < new Date() &&
            !['pending_verification', 'verified', 'closed'].includes(capa.status)) {
          status = 'overdue';
        }

        return {
          ...capa,
          status,
          responsible_user_name: capa.profiles?.full_name
        };
      });

      setCapas(capasWithStatus);
    } catch (error) {
      console.error('DÖF kayıtları yüklenirken hata:', error);
    }
  };

  const loadUsers = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', profile.organization_id)
        .order('full_name', { ascending: true});

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
    }
  };

  const loadDepartments = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Departmanlar yüklenirken hata:', error);
    }
  };

  const loadFindings = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('ic_findings')
        .select('id, finding_code, finding_description')
        .eq('organization_id', profile.organization_id)
        .in('status', ['open', 'in_progress'])
        .order('finding_code', { ascending: true });

      if (error) throw error;
      setFindings(data || []);
    } catch (error) {
      console.error('Bulgular yüklenirken hata:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('ic_capas')
          .update({
            title: formData.title,
            description: formData.description,
            capa_type: formData.capa_type,
            finding_id: formData.finding_id || null,
            root_cause: formData.root_cause,
            proposed_action: formData.proposed_action,
            responsible_user_id: formData.responsible_user_id,
            responsible_department_id: formData.responsible_department_id || null,
            due_date: formData.due_date,
            actual_completion_date: formData.actual_completion_date || null,
            status: formData.status,
            priority: formData.priority,
            completion_percentage: formData.completion_percentage,
            is_effective: formData.is_effective,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { count } = await supabase
          .from('ic_capas')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id);

        const capaCode = `CAPA-${String((count || 0) + 1).padStart(4, '0')}`;

        const { error } = await supabase
          .from('ic_capas')
          .insert({
            organization_id: profile.organization_id,
            capa_code: capaCode,
            title: formData.title,
            description: formData.description,
            capa_type: formData.capa_type,
            finding_id: formData.finding_id || null,
            root_cause: formData.root_cause,
            proposed_action: formData.proposed_action,
            responsible_user_id: formData.responsible_user_id,
            responsible_department_id: formData.responsible_department_id || null,
            due_date: formData.due_date,
            status: formData.status,
            priority: formData.priority,
            completion_percentage: formData.completion_percentage
          });

        if (error) throw error;
      }

      resetForm();
      loadCapas();
    } catch (error: any) {
      console.error('DÖF kaydedilirken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const handleEdit = (capa: CAPA) => {
    setFormData({
      title: capa.title,
      description: capa.description || '',
      capa_type: capa.capa_type,
      finding_id: capa.finding_id || '',
      root_cause: capa.root_cause || '',
      proposed_action: capa.proposed_action || '',
      responsible_user_id: capa.responsible_user_id || '',
      responsible_department_id: capa.responsible_department_id || '',
      due_date: capa.due_date || '',
      actual_completion_date: capa.actual_completion_date || '',
      status: capa.status === 'overdue' ? 'in_progress' : capa.status,
      priority: capa.priority,
      completion_percentage: capa.completion_percentage || 0,
      is_effective: capa.is_effective || false
    });
    setEditingId(capa.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu DÖF kaydını silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_capas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadCapas();
    } catch (error) {
      console.error('DÖF silinirken hata:', error);
      alert('DÖF silinemedi.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      capa_type: 'corrective',
      finding_id: '',
      root_cause: '',
      proposed_action: '',
      responsible_user_id: '',
      responsible_department_id: '',
      due_date: '',
      actual_completion_date: '',
      status: 'open',
      priority: 'medium',
      completion_percentage: 0,
      is_effective: false
    });
    setEditingId(null);
    setShowForm(false);
  };

  const filteredCapas = capas.filter(c => {
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || c.priority === filterPriority;
    return matchesStatus && matchesPriority;
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                DÖF Yönetimi modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <FileWarning className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DÖF Yönetimi</h1>
            <p className="text-sm text-gray-600">Düzeltici ve Önleyici Faaliyet Takibi</p>
            {selectedPlan && (
              <p className="text-xs text-gray-500">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni DÖF
          </button>
        )}
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Toplam DÖF</div>
          <div className="text-2xl font-bold text-gray-900">{capas.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Açık</div>
          <div className="text-2xl font-bold text-gray-600">
            {capas.filter(c => c.status === 'open').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Devam Eden</div>
          <div className="text-2xl font-bold text-blue-600">
            {capas.filter(c => c.status === 'in_progress').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Gecikmiş</div>
          <div className="text-2xl font-bold text-red-600">
            {capas.filter(c => c.status === 'overdue').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Kapatılan</div>
          <div className="text-2xl font-bold text-green-600">
            {capas.filter(c => c.status === 'closed').length}
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Durum Filtresi</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Durumlar</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Öncelik Filtresi</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Öncelikler</option>
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'DÖF Düzenle' : 'Yeni DÖF Ekle'}
                </h2>
                <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Not:</strong> DÖF kodu kayıt sırasında otomatik olarak oluşturulacaktır (Örn: CAPA-2024-001)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DÖF Tipi *</label>
                  <select
                    required
                    value={formData.capa_type}
                    onChange={(e) => setFormData({ ...formData, capa_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DÖF Başlığı *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DÖF Açıklaması</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İlgili Bulgu (İsteğe Bağlı)</label>
                  <select
                    value={formData.finding_id}
                    onChange={(e) => setFormData({ ...formData, finding_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seçiniz</option>
                    {findings.map(finding => (
                      <option key={finding.id} value={finding.id}>
                        {finding.finding_code} - {finding.finding_description}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Bu DÖF hangi bulguya ilişkindir?</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kök Neden Analizi</label>
                  <textarea
                    value={formData.root_cause}
                    onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Önerilen Aksiyon *</label>
                  <textarea
                    required
                    value={formData.proposed_action}
                    onChange={(e) => setFormData({ ...formData, proposed_action: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
                    <select
                      value={formData.responsible_user_id}
                      onChange={(e) => setFormData({ ...formData, responsible_user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Departman</label>
                    <select
                      value={formData.responsible_department_id}
                      onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Termin Tarihi *</label>
                    <input
                      type="date"
                      required
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tamamlanma Tarihi</label>
                    <input
                      type="date"
                      value={formData.actual_completion_date}
                      onChange={(e) => setFormData({ ...formData, actual_completion_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tamamlanma %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.completion_percentage}
                      onChange={(e) => setFormData({ ...formData, completion_percentage: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(STATUS_LABELS).filter(([key]) => key !== 'overdue').map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_effective}
                      onChange={(e) => setFormData({ ...formData, is_effective: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Etkinlik Doğrulandı</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DÖF Listesi */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      ) : filteredCapas.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Henüz DÖF kaydı eklenmemiş.</p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              İlk DÖF'ü Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCapas.map((capa) => (
            <div key={capa.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900">{capa.capa_code}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[capa.capa_type]}`}>
                      {TYPE_LABELS[capa.capa_type]}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[capa.priority]}`}>
                      {PRIORITY_LABELS[capa.priority]}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[capa.status]}`}>
                      {STATUS_LABELS[capa.status]}
                    </span>
                    {capa.is_effective && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Etkin
                      </span>
                    )}
                    {capa.completion_percentage > 0 && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                        %{capa.completion_percentage}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{capa.title}</h3>
                  {capa.description && (
                    <p className="text-sm text-gray-600 mb-2">{capa.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {capa.root_cause && (
                      <div>
                        <span className="font-medium text-gray-700">Kök Neden:</span>
                        <p className="text-gray-600">{capa.root_cause}</p>
                      </div>
                    )}
                    {capa.proposed_action && (
                      <div>
                        <span className="font-medium text-gray-700">Önerilen Aksiyon:</span>
                        <p className="text-gray-600">{capa.proposed_action}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 mt-3 text-sm text-gray-600">
                    {capa.responsible_user_name && (
                      <span>Sorumlu: {capa.responsible_user_name}</span>
                    )}
                    {capa.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Termin: {new Date(capa.due_date).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                    {capa.actual_completion_date && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Tamamlanma: {new Date(capa.actual_completion_date).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(capa)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(capa.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
