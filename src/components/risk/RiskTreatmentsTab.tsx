import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, Activity, X, Shield, Link } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Treatment {
  id: string;
  risk_id: string;
  code: string;
  title: string;
  description: string;
  treatment_type: string;
  action_type: string;
  risk_control_id: string;
  responsible_department_id: string;
  responsible_person_id: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  estimated_budget: number;
  progress_percent: number;
  status: string;
  notes: string;
  department?: { name: string };
  responsible?: { full_name: string };
  control?: { id: string; name: string };
}

interface Control {
  id: string;
  name: string;
  control_type: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
}

interface Props {
  riskId: string;
  riskCode: string;
}

const actionTypeLabels: Record<string, { label: string; desc: string; requiresControl: boolean }> = {
  NEW_CONTROL: { label: 'Yeni Kontrol Ekle', desc: 'Yeni bir kontrol oluştur', requiresControl: false },
  IMPROVE_CONTROL: { label: 'Kontrolü İyileştir', desc: 'Mevcut kontrolü geliştir', requiresControl: true },
  AUTOMATE_CONTROL: { label: 'Kontrolü Otomatikleştir', desc: 'Manuel kontrolü otomatik hale getir', requiresControl: true },
  ENHANCE_CONTROL: { label: 'Kontrolü Güçlendir', desc: 'Kontrol etkinliğini artır', requiresControl: true },
  REMOVE_CONTROL: { label: 'Kontrolü Kaldır', desc: 'Kontrolü kaldır veya değiştir', requiresControl: true },
  OTHER: { label: 'Diğer', desc: 'Kontrolle ilgili olmayan faaliyet', requiresControl: false }
};

const treatmentTypeLabels: Record<string, string> = {
  AVOID: 'Riskten Kaçınma',
  REDUCE: 'Riski Azaltma',
  TRANSFER: 'Riski Transfer Etme',
  ACCEPT: 'Riski Kabul Etme'
};

const statusLabels: Record<string, { label: string; color: string }> = {
  PLANNED: { label: 'Planlandı', color: 'bg-gray-100 text-gray-800' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'İptal Edildi', color: 'bg-red-100 text-red-800' }
};

export default function RiskTreatmentsTab({ riskId, riskCode }: Props) {
  const { profile } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [showNewControlForm, setShowNewControlForm] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    treatment_type: 'REDUCE',
    action_type: '',
    risk_control_id: '',
    new_control_name: '',
    new_control_description: '',
    new_control_type: 'PREVENTIVE',
    responsible_department_id: '',
    responsible_person_id: '',
    planned_start_date: '',
    planned_end_date: '',
    estimated_budget: 0,
    notes: ''
  });

  useEffect(() => {
    if (profile?.organization_id && riskId) {
      loadTreatments();
      loadControls();
      loadDepartments();
      loadUsers();
    }
  }, [profile?.organization_id, riskId]);

  async function loadTreatments() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('risk_improvement_actions')
        .select(`
          *,
          department:departments!responsible_department_id(name),
          responsible:profiles!responsible_person(full_name),
          control:risk_controls!target_control_id(id, name)
        `)
        .eq('risk_id', riskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTreatments(data || []);
    } catch (error) {
      console.error('Faaliyetler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadControls() {
    try {
      const { data, error } = await supabase
        .from('risk_controls')
        .select('id, name, control_type')
        .eq('risk_id', riskId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setControls(data || []);
    } catch (error) {
      console.error('Kontroller yüklenirken hata:', error);
    }
  }

  async function loadDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Birimler yüklenirken hata:', error);
    }
  }

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', profile?.organization_id)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
    }
  }

  function openModal(treatment?: Treatment) {
    if (treatment) {
      setEditingTreatment(treatment);
      setFormData({
        title: treatment.title,
        description: treatment.description || '',
        treatment_type: treatment.treatment_type,
        action_type: treatment.action_type || '',
        risk_control_id: treatment.risk_control_id || '',
        new_control_name: '',
        new_control_description: '',
        new_control_type: 'PREVENTIVE',
        responsible_department_id: treatment.responsible_department_id || '',
        responsible_person_id: treatment.responsible_person_id || '',
        planned_start_date: treatment.planned_start_date || '',
        planned_end_date: treatment.planned_end_date || '',
        estimated_budget: treatment.estimated_budget || 0,
        notes: treatment.notes || ''
      });
      setShowNewControlForm(treatment.action_type === 'NEW_CONTROL');
    } else {
      setEditingTreatment(null);
      setFormData({
        title: '',
        description: '',
        treatment_type: 'REDUCE',
        action_type: '',
        risk_control_id: '',
        new_control_name: '',
        new_control_description: '',
        new_control_type: 'PREVENTIVE',
        responsible_department_id: '',
        responsible_person_id: '',
        planned_start_date: '',
        planned_end_date: '',
        estimated_budget: 0,
        notes: ''
      });
      setShowNewControlForm(false);
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTreatment(null);
    setShowNewControlForm(false);
  }

  function handleActionTypeChange(actionType: string) {
    setFormData({ ...formData, action_type: actionType, risk_control_id: '' });
    setShowNewControlForm(actionType === 'NEW_CONTROL');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title || !formData.responsible_department_id) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    const requiresControl = formData.action_type && actionTypeLabels[formData.action_type]?.requiresControl;
    if (requiresControl && !formData.risk_control_id) {
      alert('Bu faaliyet türü için bir kontrol seçmelisiniz');
      return;
    }

    if (formData.action_type === 'NEW_CONTROL' && !formData.new_control_name) {
      alert('Yeni kontrol için ad girmelisiniz');
      return;
    }

    try {
      let controlId = formData.risk_control_id || null;

      if (formData.action_type === 'NEW_CONTROL' && formData.new_control_name) {
        const { data: newControl, error: controlError } = await supabase
          .from('risk_controls')
          .insert({
            risk_id: riskId,
            name: formData.new_control_name,
            description: formData.new_control_description,
            control_type: formData.new_control_type,
            control_nature: 'MANUAL',
            responsible_department_id: formData.responsible_department_id,
            design_effectiveness: 3,
            operating_effectiveness: 3,
            is_active: true
          })
          .select()
          .single();

        if (controlError) throw controlError;
        controlId = newControl.id;
      }

      const treatmentData = {
        risk_id: riskId,
        organization_id: profile?.organization_id,
        title: formData.title,
        description: formData.description,
        action_type: formData.action_type || 'IMPROVE_CONTROL',
        target_control_id: controlId,
        responsible_department_id: formData.responsible_department_id,
        responsible_person: formData.responsible_person_id || null,
        planned_start_date: formData.planned_start_date || null,
        planned_end_date: formData.planned_end_date || null,
        estimated_cost: formData.estimated_budget || 0,
        progress_percent: 0,
        status: 'PLANNED',
        approval_status: 'DRAFT',
        notes: formData.notes
      };

      if (editingTreatment) {
        const { error } = await supabase
          .from('risk_improvement_actions')
          .update(treatmentData)
          .eq('id', editingTreatment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_improvement_actions')
          .insert(treatmentData);

        if (error) throw error;
      }

      closeModal();
      loadTreatments();
      loadControls();
    } catch (error) {
      console.error('Faaliyet kaydedilirken hata:', error);
      alert('Faaliyet kaydedilemedi');
    }
  }

  async function handleDelete(treatmentId: string) {
    if (!confirm('Bu faaliyeti silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_improvement_actions')
        .delete()
        .eq('id', treatmentId);

      if (error) throw error;
      loadTreatments();
    } catch (error) {
      console.error('Faaliyet silinirken hata:', error);
      alert('Faaliyet silinemedi');
    }
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Risk Faaliyetleri / Tedbirleri</h3>
          <p className="text-sm text-gray-600">Risk: {riskCode}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Faaliyet Ekle
        </button>
      </div>

      {treatments.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Henüz faaliyet eklenmemiş</p>
          <button
            onClick={() => openModal()}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            İlk Faaliyeti Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {treatments.map((treatment) => (
            <div key={treatment.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{treatment.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[treatment.status]?.color}`}>
                      {statusLabels[treatment.status]?.label}
                    </span>
                    {treatment.action_type && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {actionTypeLabels[treatment.action_type]?.label}
                      </span>
                    )}
                  </div>
                  {treatment.description && (
                    <p className="text-sm text-gray-600 mb-3">{treatment.description}</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Tedavisi Türü:</span>
                      <div className="font-medium text-gray-900">{treatmentTypeLabels[treatment.treatment_type]}</div>
                    </div>
                    {treatment.control && (
                      <div>
                        <span className="text-gray-500">Bağlı Kontrol:</span>
                        <div className="font-medium text-gray-900 flex items-center gap-1">
                          <Link className="w-3 h-3" />
                          {treatment.control.name}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Sorumlu Birim:</span>
                      <div className="font-medium text-gray-900">{treatment.department?.name || '-'}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">İlerleme:</span>
                      <div className="font-medium text-gray-900">{treatment.progress_percent}%</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openModal(treatment)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    title="Düzenle"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(treatment.id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingTreatment ? 'Faaliyet Düzenle' : 'Yeni Faaliyet Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tedavi Türü</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Faaliyet Türü</label>
              <select
                value={formData.action_type}
                onChange={(e) => handleActionTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Seçiniz (opsiyonel)</option>
                {Object.entries(actionTypeLabels).map(([key, { label, desc }]) => (
                  <option key={key} value={key}>{label} - {desc}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.action_type && actionTypeLabels[formData.action_type]?.requiresControl && !showNewControlForm && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İlgili Kontrol <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.risk_control_id}
                onChange={(e) => setFormData({ ...formData, risk_control_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">Kontrol Seçiniz</option>
                {controls.map((control) => (
                  <option key={control.id} value={control.id}>{control.name}</option>
                ))}
              </select>
              {controls.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">Bu risk için henüz kontrol tanımlanmamış</p>
              )}
            </div>
          )}

          {showNewControlForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-900 font-medium">
                <Shield className="w-5 h-5" />
                Yeni Kontrol Bilgileri
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kontrol Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.new_control_name}
                  onChange={(e) => setFormData({ ...formData, new_control_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Açıklaması</label>
                <textarea
                  value={formData.new_control_description}
                  onChange={(e) => setFormData({ ...formData, new_control_description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Tipi</label>
                <select
                  value={formData.new_control_type}
                  onChange={(e) => setFormData({ ...formData, new_control_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="PREVENTIVE">Önleyici</option>
                  <option value="DETECTIVE">Tespit Edici</option>
                  <option value="CORRECTIVE">Düzeltici</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sorumlu Birim <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.responsible_department_id}
                onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Planlanan Bitiş</label>
              <input
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Bütçe</label>
            <input
              type="number"
              value={formData.estimated_budget}
              onChange={(e) => setFormData({ ...formData, estimated_budget: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
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
    </div>
  );
}
