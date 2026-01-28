import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import { X, Save, Upload } from 'lucide-react';

interface ICActionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionPlanId: string;
  organizationId: string;
  onSuccess: () => void;
  editAction?: any;
}

interface Department {
  id: string;
  name: string;
}

interface GeneralCondition {
  id: string;
  code: string;
  description: string;
  standard_id: string;
}

export default function ICActionFormModal({
  isOpen,
  onClose,
  actionPlanId,
  organizationId,
  onSuccess,
  editAction
}: ICActionFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [conditions, setConditions] = useState<GeneralCondition[]>([]);

  const [formData, setFormData] = useState({
    condition_id: '',
    code: '',
    title: '',
    description: '',
    action_type: 'tek_seferlik',
    linked_module: '',
    target_quantity: '',
    period_year: new Date().getFullYear().toString(),
    responsible_department_ids: [] as string[],
    related_department_ids: [] as string[],
    collaborating_departments_ids: [] as string[],
    start_date: '',
    target_date: '',
    expected_outputs: '',
    outputs: '',
    current_status_detail: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadDepartments();
      loadConditions();
      if (editAction) {
        setFormData({
          condition_id: editAction.condition_id || '',
          code: editAction.code || '',
          title: editAction.title || '',
          description: editAction.description || '',
          action_type: editAction.action_type || 'tek_seferlik',
          linked_module: editAction.linked_module || '',
          target_quantity: editAction.target_quantity?.toString() || '',
          period_year: editAction.period_year?.toString() || new Date().getFullYear().toString(),
          responsible_department_ids: editAction.responsible_department_ids || [],
          related_department_ids: editAction.related_department_ids || [],
          collaborating_departments_ids: editAction.collaborating_departments_ids || [],
          start_date: editAction.start_date || '',
          target_date: editAction.target_date || '',
          expected_outputs: editAction.expected_outputs || '',
          outputs: editAction.outputs || '',
          current_status_detail: editAction.current_status_detail || ''
        });
      }
    }
  }, [isOpen, editAction]);

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name');
    setDepartments(data || []);
  };

  const loadConditions = async () => {
    const { data } = await supabase
      .from('ic_general_conditions')
      .select('id, code, description, standard_id')
      .eq('organization_id', organizationId)
      .order('code');
    setConditions(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData: any = {
        action_plan_id: actionPlanId,
        organization_id: organizationId,
        condition_id: formData.condition_id,
        code: formData.code,
        title: formData.title,
        description: formData.description,
        action_type: formData.action_type,
        linked_module: formData.linked_module || null,
        target_quantity: formData.target_quantity ? parseInt(formData.target_quantity) : null,
        period_year: formData.action_type === 'donemsel' ? parseInt(formData.period_year) : null,
        responsible_department_ids: formData.responsible_department_ids.length > 0 ? formData.responsible_department_ids : null,
        related_department_ids: formData.related_department_ids.length > 0 ? formData.related_department_ids : null,
        collaborating_departments_ids: formData.collaborating_departments_ids.length > 0 ? formData.collaborating_departments_ids : null,
        responsible_department_id: formData.responsible_department_ids[0] || null,
        start_date: formData.start_date || null,
        target_date: formData.target_date || null,
        expected_outputs: formData.expected_outputs,
        outputs: formData.outputs,
        current_status_detail: formData.current_status_detail,
        approval_status: 'taslak',
        status: 'NOT_STARTED',
        progress_percent: 0
      };

      if (editAction) {
        const { error } = await supabase
          .from('ic_actions')
          .update(submitData)
          .eq('id', editAction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ic_actions')
          .insert(submitData);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = [
    { value: 'tek_seferlik', label: 'Tek Seferlik' },
    { value: 'donemsel', label: 'Dönemsel' },
    { value: 'surekli', label: 'Sürekli' },
    { value: 'baglantili', label: 'Bağlantılı' }
  ];

  const linkedModules = [
    { value: 'surec_yonetimi', label: 'Süreç Yönetimi' },
    { value: 'is_akis_semalari', label: 'İş Akış Şemaları' },
    { value: 'hassas_gorevler', label: 'Hassas Görevler' },
    { value: 'risk_yonetimi', label: 'Risk Yönetimi' },
    { value: 'dokuman_yonetimi', label: 'Doküman Yönetimi' }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editAction ? 'Eylemi Düzenle' : 'Yeni Eylem Ekle'} size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Genel Şart <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.condition_id}
              onChange={(e) => setFormData({ ...formData, condition_id: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
              required
            >
              <option value="">Seçiniz</option>
              {conditions.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eylem Kodu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
              required
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eylem Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
              required
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eylem Açıklaması
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eylem Tipi <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.action_type}
              onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
              required
            >
              {actionTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {formData.action_type === 'baglantili' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bağlantılı Modül <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.linked_module}
                  onChange={(e) => setFormData({ ...formData, linked_module: e.target.value })}
                  className="w-full border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seçiniz</option>
                  {linkedModules.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hedef Miktar <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.target_quantity}
                  onChange={(e) => setFormData({ ...formData, target_quantity: e.target.value })}
                  className="w-full border-gray-300 rounded-lg"
                  min="1"
                  required
                />
              </div>
            </>
          )}

          {formData.action_type === 'donemsel' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dönem (Yıl) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.period_year}
                onChange={(e) => setFormData({ ...formData, period_year: e.target.value })}
                className="w-full border-gray-300 rounded-lg"
                min="2024"
                max="2030"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hedef Tamamlanma Tarihi
            </label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birimler
            </label>
            <select
              multiple
              value={formData.responsible_department_ids}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setFormData({ ...formData, responsible_department_ids: values });
              }}
              className="w-full border-gray-300 rounded-lg"
              size={4}
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd tuşuna basılı tutarak birden fazla seçim yapabilirsiniz</p>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İşbirliği Yapılacak Birimler
            </label>
            <select
              multiple
              value={formData.collaborating_departments_ids}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setFormData({ ...formData, collaborating_departments_ids: values });
              }}
              className="w-full border-gray-300 rounded-lg"
              size={4}
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beklenen Çıktılar/Sonuçlar
            </label>
            <textarea
              value={formData.expected_outputs}
              onChange={(e) => setFormData({ ...formData, expected_outputs: e.target.value })}
              rows={2}
              className="w-full border-gray-300 rounded-lg"
              placeholder="Bu eylemden beklenen sonuçları yazınız"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mevcut Durum
            </label>
            <textarea
              value={formData.current_status_detail}
              onChange={(e) => setFormData({ ...formData, current_status_detail: e.target.value })}
              rows={2}
              className="w-full border-gray-300 rounded-lg"
              placeholder="Eylemin şu anki durumunu açıklayınız"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="w-4 h-4 inline mr-2" />
            İptal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
