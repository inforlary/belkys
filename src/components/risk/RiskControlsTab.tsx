import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, Shield, X, CheckSquare, Link as LinkIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import ControlExecutionsModal from './ControlExecutionsModal';

interface Control {
  id: string;
  risk_id: string;
  name: string;
  description: string;
  control_type: string;
  control_nature: string;
  responsible_department_id: string;
  design_effectiveness: number;
  operating_effectiveness: number;
  evidence: string;
  frequency: string;
  is_active: boolean;
  last_test_date?: string;
  next_test_date?: string;
  department?: {
    name: string;
  };
  related_treatments?: Treatment[];
}

interface Treatment {
  id: string;
  title: string;
  action_type: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
}

interface Props {
  riskId: string;
  riskCode: string;
}

const controlTypeLabels: Record<string, { label: string; desc: string }> = {
  PREVENTIVE: { label: 'Önleyici', desc: 'Risk gerçekleşmeden engeller' },
  DETECTIVE: { label: 'Tespit Edici', desc: 'Gerçekleşen riski tespit eder' },
  CORRECTIVE: { label: 'Düzeltici', desc: 'Risk sonuçlarını düzeltir' }
};

const controlNatureLabels: Record<string, { label: string; desc: string }> = {
  MANUAL: { label: 'Manuel', desc: 'İnsan tarafından yapılır' },
  AUTOMATED: { label: 'Otomatik', desc: 'Sistem tarafından yapılır' },
  SEMI_AUTOMATED: { label: 'Yarı Otomatik', desc: 'İkisinin kombinasyonu' }
};

const effectivenessLevels = [
  { value: 1, label: 'Etkisiz' },
  { value: 2, label: 'Kısmen Etkili' },
  { value: 3, label: 'Orta Düzeyde Etkili' },
  { value: 4, label: 'Büyük Ölçüde Etkili' },
  { value: 5, label: 'Tam Etkili' }
];

const actionTypeLabels: Record<string, string> = {
  NEW_CONTROL: 'Yeni Kontrol',
  IMPROVE_CONTROL: 'İyileştirme',
  AUTOMATE_CONTROL: 'Otomatikleştirme',
  ENHANCE_CONTROL: 'Güçlendirme',
  REMOVE_CONTROL: 'Kaldırma',
  OTHER: 'Diğer'
};

const statusLabels: Record<string, { label: string; color: string }> = {
  PLANNED: { label: 'Planlandı', color: 'bg-gray-100 text-gray-800' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'İptal', color: 'bg-red-100 text-red-800' }
};

export default function RiskControlsTab({ riskId, riskCode }: Props) {
  const { profile } = useAuth();
  const [controls, setControls] = useState<Control[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingControl, setEditingControl] = useState<Control | null>(null);
  const [showExecutionsModal, setShowExecutionsModal] = useState(false);
  const [selectedControlForExecutions, setSelectedControlForExecutions] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    control_type: 'PREVENTIVE',
    control_nature: 'MANUAL',
    responsible_department_id: '',
    design_effectiveness: 3,
    operating_effectiveness: 3,
    evidence: '',
    frequency: '',
    last_test_date: '',
    next_test_date: ''
  });

  useEffect(() => {
    if (profile?.organization_id && riskId) {
      loadControls();
      loadDepartments();
    }
  }, [profile?.organization_id, riskId]);

  async function loadControls() {
    try {
      setLoading(true);
      const { data: controlsData, error: controlsError } = await supabase
        .from('risk_controls')
        .select(`
          *,
          department:departments!responsible_department_id(name)
        `)
        .eq('risk_id', riskId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (controlsError) throw controlsError;

      if (controlsData && controlsData.length > 0) {
        const { data: treatmentsData, error: treatmentsError } = await supabase
          .from('risk_treatments')
          .select('id, title, action_type, status, risk_control_id')
          .eq('risk_id', riskId)
          .not('risk_control_id', 'is', null);

        if (!treatmentsError && treatmentsData) {
          const controlsWithTreatments = controlsData.map(control => ({
            ...control,
            related_treatments: treatmentsData.filter(t => t.risk_control_id === control.id)
          }));
          setControls(controlsWithTreatments);
        } else {
          setControls(controlsData);
        }
      } else {
        setControls([]);
      }
    } catch (error) {
      console.error('Kontroller yüklenirken hata:', error);
    } finally {
      setLoading(false);
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

  function openModal(control?: Control) {
    if (control) {
      setEditingControl(control);
      setFormData({
        name: control.name,
        description: control.description || '',
        control_type: control.control_type,
        control_nature: control.control_nature,
        responsible_department_id: control.responsible_department_id || '',
        design_effectiveness: control.design_effectiveness,
        operating_effectiveness: control.operating_effectiveness,
        evidence: control.evidence || '',
        frequency: control.frequency || '',
        last_test_date: control.last_test_date || '',
        next_test_date: control.next_test_date || ''
      });
    } else {
      setEditingControl(null);
      setFormData({
        name: '',
        description: '',
        control_type: 'PREVENTIVE',
        control_nature: 'MANUAL',
        responsible_department_id: '',
        design_effectiveness: 3,
        operating_effectiveness: 3,
        evidence: '',
        frequency: '',
        last_test_date: '',
        next_test_date: ''
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingControl(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.responsible_department_id) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      const controlData = {
        risk_id: riskId,
        name: formData.name,
        description: formData.description,
        control_type: formData.control_type,
        control_nature: formData.control_nature,
        responsible_department_id: formData.responsible_department_id,
        design_effectiveness: formData.design_effectiveness,
        evidence: formData.evidence,
        frequency: formData.frequency,
        last_test_date: formData.last_test_date || null,
        next_test_date: formData.next_test_date || null,
        is_active: true
      };

      if (editingControl) {
        const { error } = await supabase
          .from('risk_controls')
          .update(controlData)
          .eq('id', editingControl.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_controls')
          .insert(controlData);

        if (error) throw error;
      }

      closeModal();
      loadControls();
    } catch (error) {
      console.error('Kontrol kaydedilirken hata:', error);
      alert('Kontrol kaydedilemedi');
    }
  }

  async function handleDelete(controlId: string) {
    if (!confirm('Bu kontrolü silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_controls')
        .update({ is_active: false })
        .eq('id', controlId);

      if (error) throw error;
      loadControls();
    } catch (error) {
      console.error('Kontrol silinirken hata:', error);
      alert('Kontrol silinemedi');
    }
  }

  function getEffectivenessStars(value: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < value ? 'text-yellow-500' : 'text-gray-300'}>★</span>
    ));
  }

  function openExecutionsModal(control: Control) {
    setSelectedControlForExecutions({ id: control.id, name: control.name });
    setShowExecutionsModal(true);
  }

  function closeExecutionsModal() {
    setShowExecutionsModal(false);
    setSelectedControlForExecutions(null);
    loadControls();
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Risk Kontrolleri</h3>
          <p className="text-sm text-gray-600">Risk: {riskCode}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Kontrol Ekle
        </button>
      </div>

      {controls.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Henüz kontrol eklenmemiş</p>
          <button
            onClick={() => openModal()}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            İlk Kontrolü Ekle
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kontrol Adı</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tip</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Yapı</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tasarım Etkinliği</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Uygulama Etkinliği</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sorumlu Birim</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Son Test</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((control) => (
                <>
                  <tr key={control.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{control.name}</div>
                      {control.description && (
                        <div className="text-sm text-gray-500 mt-1">{control.description}</div>
                      )}
                      {control.related_treatments && control.related_treatments.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                          <LinkIcon className="w-3 h-3" />
                          {control.related_treatments.length} faaliyet bağlı
                        </div>
                      )}
                    </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      control.control_type === 'PREVENTIVE' ? 'bg-green-100 text-green-800' :
                      control.control_type === 'DETECTIVE' ? 'bg-blue-100 text-blue-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {controlTypeLabels[control.control_type]?.label || control.control_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      control.control_nature === 'AUTOMATED' ? 'bg-purple-100 text-purple-800' :
                      control.control_nature === 'MANUAL' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {controlNatureLabels[control.control_nature]?.label || control.control_nature}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {getEffectivenessStars(control.design_effectiveness)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {getEffectivenessStars(control.operating_effectiveness)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {control.department?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {control.last_test_date ? new Date(control.last_test_date).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openExecutionsModal(control)}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Uygulama Kayıtları"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal(control)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Düzenle"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(control.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {control.related_treatments && control.related_treatments.length > 0 && (
                  <tr className="bg-blue-50">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-blue-900 mb-2">İlgili Faaliyetler:</div>
                        {control.related_treatments.map((treatment) => (
                          <div key={treatment.id} className="flex items-center gap-3 text-sm bg-white rounded px-3 py-2">
                            <LinkIcon className="w-3 h-3 text-blue-600" />
                            <span className="font-medium text-gray-900">{treatment.title}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[treatment.status]?.color}`}>
                              {statusLabels[treatment.status]?.label}
                            </span>
                            {treatment.action_type && (
                              <span className="text-xs text-gray-600">
                                ({actionTypeLabels[treatment.action_type]})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingControl ? 'Kontrol Düzenle' : 'Yeni Kontrol Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kontrol Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontrol Tipi <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.control_type}
                onChange={(e) => setFormData({ ...formData, control_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.entries(controlTypeLabels).map(([key, { label, desc }]) => (
                  <option key={key} value={key}>{label} - {desc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kontrol Yapısı <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.control_nature}
                onChange={(e) => setFormData({ ...formData, control_nature: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.entries(controlNatureLabels).map(([key, { label, desc }]) => (
                  <option key={key} value={key}>{label} - {desc}</option>
                ))}
              </select>
            </div>
          </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Uygulama Sıklığı</label>
            <input
              type="text"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              placeholder="Örn: Günlük, Her işlemde"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tasarım Etkinliği <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {effectivenessLevels.map((level) => (
                <label key={level.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="design_effectiveness"
                    value={level.value}
                    checked={formData.design_effectiveness === level.value}
                    onChange={(e) => setFormData({ ...formData, design_effectiveness: parseInt(e.target.value) })}
                    className="text-blue-600"
                  />
                  <span className="flex items-center gap-2">
                    <span className="text-yellow-500">
                      {Array.from({ length: level.value }, (_, i) => '★').join('')}
                    </span>
                    <span className="text-sm text-gray-700">{level.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Uygulama Etkinliği
            </label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  {getEffectivenessStars(formData.operating_effectiveness)}
                </div>
                <span className="text-sm font-medium text-blue-900">
                  {effectivenessLevels.find(l => l.value === formData.operating_effectiveness)?.label || 'Hesaplanacak'}
                </span>
              </div>
              <p className="text-xs text-blue-700">
                ℹ️ Bu alan otomatik olarak hesaplanır. Kontrol uygulama kayıtlarınıza göre ortalama etkinlik değeri sistemce belirlenir.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kanıtlar/Belgeler</label>
            <textarea
              value={formData.evidence}
              onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Kontrol kanıtlarını açıklayın"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Son Test Tarihi</label>
              <input
                type="date"
                value={formData.last_test_date}
                onChange={(e) => setFormData({ ...formData, last_test_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sonraki Test Tarihi</label>
              <input
                type="date"
                value={formData.next_test_date}
                onChange={(e) => setFormData({ ...formData, next_test_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
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
              {editingControl ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      {selectedControlForExecutions && (
        <ControlExecutionsModal
          controlId={selectedControlForExecutions.id}
          controlName={selectedControlForExecutions.name}
          isOpen={showExecutionsModal}
          onClose={closeExecutionsModal}
          onUpdate={loadControls}
        />
      )}
    </div>
  );
}
