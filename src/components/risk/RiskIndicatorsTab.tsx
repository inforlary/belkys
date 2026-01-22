import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Indicator {
  id: string;
  risk_id: string;
  code: string;
  name: string;
  description: string;
  measurement_unit: string;
  target_value: number;
  threshold_warning: number;
  threshold_critical: number;
  direction: string;
  frequency: string;
  responsible_department_id: string;
  is_active: boolean;
  department?: { name: string };
  last_value?: number;
  last_measurement_date?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Props {
  riskId: string;
  riskCode: string;
}

const directionLabels: Record<string, { label: string; icon: any; color: string }> = {
  INCREASING: { label: 'Artış İyi', icon: TrendingUp, color: 'text-green-600' },
  DECREASING: { label: 'Azalış İyi', icon: TrendingDown, color: 'text-blue-600' },
  STABLE: { label: 'Sabit', icon: Minus, color: 'text-gray-600' }
};

const frequencyLabels: Record<string, string> = {
  DAILY: 'Günlük',
  WEEKLY: 'Haftalık',
  MONTHLY: 'Aylık',
  QUARTERLY: 'Çeyreklik',
  YEARLY: 'Yıllık'
};

export default function RiskIndicatorsTab({ riskId, riskCode }: Props) {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    measurement_unit: '',
    target_value: 0,
    threshold_warning: 0,
    threshold_critical: 0,
    direction: 'DECREASING',
    frequency: 'MONTHLY',
    responsible_department_id: ''
  });

  useEffect(() => {
    if (profile?.organization_id && riskId) {
      loadIndicators();
      loadDepartments();
    }
  }, [profile?.organization_id, riskId]);

  async function loadIndicators() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('risk_indicators')
        .select(`
          *,
          department:departments!responsible_department_id(name)
        `)
        .eq('risk_id', riskId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Göstergeler yüklenirken hata:', error);
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

  function openModal(indicator?: Indicator) {
    if (indicator) {
      setEditingIndicator(indicator);
      setFormData({
        name: indicator.name,
        description: indicator.description || '',
        measurement_unit: indicator.measurement_unit || '',
        target_value: indicator.target_value || 0,
        threshold_warning: indicator.threshold_warning || 0,
        threshold_critical: indicator.threshold_critical || 0,
        direction: indicator.direction || 'DECREASING',
        frequency: indicator.frequency || 'MONTHLY',
        responsible_department_id: indicator.responsible_department_id || ''
      });
    } else {
      setEditingIndicator(null);
      setFormData({
        name: '',
        description: '',
        measurement_unit: '',
        target_value: 0,
        threshold_warning: 0,
        threshold_critical: 0,
        direction: 'DECREASING',
        frequency: 'MONTHLY',
        responsible_department_id: ''
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingIndicator(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.responsible_department_id) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      const indicatorData = {
        risk_id: riskId,
        name: formData.name,
        description: formData.description,
        measurement_unit: formData.measurement_unit,
        target_value: formData.target_value,
        threshold_warning: formData.threshold_warning,
        threshold_critical: formData.threshold_critical,
        direction: formData.direction,
        frequency: formData.frequency,
        responsible_department_id: formData.responsible_department_id,
        organization_id: profile?.organization_id,
        is_active: true
      };

      if (editingIndicator) {
        const { error } = await supabase
          .from('risk_indicators')
          .update(indicatorData)
          .eq('id', editingIndicator.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_indicators')
          .insert(indicatorData);

        if (error) throw error;
      }

      closeModal();
      loadIndicators();
    } catch (error) {
      console.error('Gösterge kaydedilirken hata:', error);
      alert('Gösterge kaydedilemedi');
    }
  }

  async function handleDelete(indicatorId: string) {
    if (!confirm('Bu göstergeyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_indicators')
        .update({ is_active: false })
        .eq('id', indicatorId);

      if (error) throw error;
      loadIndicators();
    } catch (error) {
      console.error('Gösterge silinirken hata:', error);
      alert('Gösterge silinemedi');
    }
  }

  function getIndicatorStatus(indicator: Indicator) {
    if (!indicator.last_value) return { status: 'Veri Yok', color: 'bg-gray-100 text-gray-800' };

    const value = indicator.last_value;
    const { direction, threshold_warning, threshold_critical, target_value } = indicator;

    if (direction === 'DECREASING') {
      if (value <= target_value) return { status: 'Hedefte', color: 'bg-green-100 text-green-800' };
      if (value <= threshold_warning) return { status: 'İyi', color: 'bg-blue-100 text-blue-800' };
      if (value <= threshold_critical) return { status: 'Dikkat', color: 'bg-yellow-100 text-yellow-800' };
      return { status: 'Kritik', color: 'bg-red-100 text-red-800' };
    } else if (direction === 'INCREASING') {
      if (value >= target_value) return { status: 'Hedefte', color: 'bg-green-100 text-green-800' };
      if (value >= threshold_warning) return { status: 'İyi', color: 'bg-blue-100 text-blue-800' };
      if (value >= threshold_critical) return { status: 'Dikkat', color: 'bg-yellow-100 text-yellow-800' };
      return { status: 'Kritik', color: 'bg-red-100 text-red-800' };
    }

    return { status: 'Normal', color: 'bg-gray-100 text-gray-800' };
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Risk Göstergeleri (KRI)</h3>
          <p className="text-sm text-gray-600">Risk: {riskCode}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Gösterge Ekle
        </button>
      </div>

      {indicators.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Henüz gösterge eklenmemiş</p>
          <button
            onClick={() => openModal()}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            İlk Göstergeyi Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {indicators.map((indicator) => {
            const DirectionIcon = directionLabels[indicator.direction]?.icon || Minus;
            const status = getIndicatorStatus(indicator);

            return (
              <div key={indicator.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{indicator.name}</h4>
                    {indicator.description && (
                      <p className="text-sm text-gray-600 mb-2">{indicator.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => openModal(indicator)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title="Düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(indicator.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Yön:</span>
                    <div className={`flex items-center gap-1 font-medium ${directionLabels[indicator.direction]?.color}`}>
                      <DirectionIcon className="w-4 h-4" />
                      {directionLabels[indicator.direction]?.label}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Sıklık:</span>
                    <div className="font-medium text-gray-900">{frequencyLabels[indicator.frequency]}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Hedef:</span>
                    <div className="font-medium text-gray-900">
                      {indicator.target_value} {indicator.measurement_unit}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Son Değer:</span>
                    <div className="font-medium text-gray-900">
                      {indicator.last_value ? `${indicator.last_value} ${indicator.measurement_unit}` : '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {indicator.department?.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingIndicator ? 'Gösterge Düzenle' : 'Yeni Gösterge Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gösterge Adı <span className="text-red-500">*</span>
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
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ölçüm Birimi</label>
              <input
                type="text"
                value={formData.measurement_unit}
                onChange={(e) => setFormData({ ...formData, measurement_unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Örn: adet, %, TL"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Değer</label>
              <input
                type="number"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uyarı Eşiği</label>
              <input
                type="number"
                value={formData.threshold_warning}
                onChange={(e) => setFormData({ ...formData, threshold_warning: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kritik Eşik</label>
              <input
                type="number"
                value={formData.threshold_critical}
                onChange={(e) => setFormData({ ...formData, threshold_critical: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yön</label>
              <select
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.entries(directionLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ölçüm Sıklığı</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.entries(frequencyLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
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
              {editingIndicator ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
