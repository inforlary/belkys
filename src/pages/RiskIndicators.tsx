import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart3, Plus, TrendingUp, X, AlertTriangle, Edit, Trash2 } from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
}

interface Indicator {
  id: string;
  code: string;
  name: string;
  description: string;
  indicator_type: 'KRI' | 'LEI';
  unit_of_measure: string;
  measurement_frequency: string;
  green_threshold: string;
  yellow_threshold: string;
  red_threshold: string;
  direction: string;
  target_value: number;
  risk_id: string;
  is_active: boolean;
}

interface IndicatorValue {
  id: string;
  measurement_date: string;
  period: string;
  value: number;
  status: string;
  notes: string;
  recorded_by: {
    full_name: string;
  };
  created_at: string;
}

const indicatorTypeLabels = {
  KRI: 'TRG - Temel Risk Göstergesi',
  LEI: 'ÖRG - Öncü Risk Göstergesi'
};

const frequencyLabels: Record<string, string> = {
  MONTHLY: 'Aylık',
  QUARTERLY: 'Çeyreklik',
  SEMI_ANNUAL: '6 Aylık',
  ANNUAL: 'Yıllık'
};

const directionLabels: Record<string, string> = {
  LOWER_BETTER: 'Düşük daha iyi',
  HIGHER_BETTER: 'Yüksek daha iyi',
  TARGET: 'Hedefe yakın'
};

export default function RiskIndicators() {
  const { profile } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState<string>('');
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [indicatorValues, setIndicatorValues] = useState<IndicatorValue[]>([]);

  const [indicatorForm, setIndicatorForm] = useState({
    risk_id: '',
    name: '',
    description: '',
    indicator_type: 'KRI' as 'KRI' | 'LEI',
    unit_of_measure: '',
    measurement_frequency: 'MONTHLY',
    green_threshold: '',
    yellow_threshold: '',
    red_threshold: '',
    direction: 'LOWER_BETTER',
    target_value: ''
  });

  const [valueForm, setValueForm] = useState({
    measurement_date: new Date().toISOString().split('T')[0],
    period: '',
    value: '',
    notes: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadRisks();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedRiskId) {
      loadIndicators(selectedRiskId);
    } else {
      setIndicators([]);
    }
  }, [selectedRiskId]);

  const loadRisks = async () => {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select('id, code, name')
        .eq('organization_id', profile!.organization_id)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setRisks(data || []);

      if (data && data.length > 0) {
        setSelectedRiskId(data[0].id);
      }
    } catch (error) {
      console.error('Riskler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIndicators = async (riskId: string) => {
    try {
      const { data, error } = await supabase
        .from('risk_indicators')
        .select('*')
        .eq('risk_id', riskId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Göstergeler yüklenirken hata:', error);
    }
  };

  const loadIndicatorValues = async (indicatorId: string) => {
    try {
      const { data, error } = await supabase
        .from('risk_indicator_values')
        .select(`
          *,
          recorded_by:profiles(full_name)
        `)
        .eq('indicator_id', indicatorId)
        .order('measurement_date', { ascending: false });

      if (error) throw error;
      setIndicatorValues(data || []);
    } catch (error) {
      console.error('Değerler yüklenirken hata:', error);
    }
  };

  const generateCode = async (riskId: string, type: 'KRI' | 'LEI') => {
    const prefix = type === 'KRI' ? 'TRG' : 'ÖRG';

    const { data } = await supabase
      .from('risk_indicators')
      .select('code')
      .eq('risk_id', riskId)
      .eq('indicator_type', type)
      .order('code', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) {
      return `${prefix}-001`;
    }

    const lastCode = data[0].code;
    const parts = lastCode.split('-');
    const lastNumber = parseInt(parts[1] || '0');
    return `${prefix}-${String(lastNumber + 1).padStart(3, '0')}`;
  };

  const calculateStatus = (value: number, indicator: Indicator): string => {
    const numValue = parseFloat(value.toString());

    const parseThreshold = (threshold: string): { min?: number; max?: number } => {
      if (threshold.includes('-')) {
        const [min, max] = threshold.split('-').map(v => parseFloat(v.trim()));
        return { min, max };
      }
      if (threshold.startsWith('<')) {
        return { max: parseFloat(threshold.substring(1)) };
      }
      if (threshold.startsWith('>')) {
        return { min: parseFloat(threshold.substring(1)) };
      }
      return {};
    };

    const green = parseThreshold(indicator.green_threshold);
    const yellow = parseThreshold(indicator.yellow_threshold);
    const red = parseThreshold(indicator.red_threshold);

    if (green.min !== undefined && green.max !== undefined) {
      if (numValue >= green.min && numValue <= green.max) return 'GREEN';
    } else if (green.max !== undefined && numValue < green.max) {
      return 'GREEN';
    } else if (green.min !== undefined && numValue > green.min) {
      return 'GREEN';
    }

    if (yellow.min !== undefined && yellow.max !== undefined) {
      if (numValue >= yellow.min && numValue <= yellow.max) return 'YELLOW';
    } else if (yellow.max !== undefined && numValue < yellow.max) {
      return 'YELLOW';
    } else if (yellow.min !== undefined && numValue > yellow.min) {
      return 'YELLOW';
    }

    return 'RED';
  };

  const handleSubmitIndicator = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const code = editingIndicator?.code ||
        await generateCode(indicatorForm.risk_id, indicatorForm.indicator_type);

      const indicatorData = {
        ...indicatorForm,
        code,
        target_value: indicatorForm.target_value ? parseFloat(indicatorForm.target_value) : null,
        alert_enabled: true,
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
          .insert([indicatorData]);

        if (error) throw error;
      }

      setShowIndicatorModal(false);
      resetIndicatorForm();
      loadIndicators(selectedRiskId);
    } catch (error) {
      console.error('Gösterge kaydedilirken hata:', error);
      alert('Gösterge kaydedilemedi!');
    }
  };

  const handleSubmitValue = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedIndicator) return;

    try {
      const numValue = parseFloat(valueForm.value);
      const status = calculateStatus(numValue, selectedIndicator);

      const { error } = await supabase
        .from('risk_indicator_values')
        .insert([{
          indicator_id: selectedIndicator.id,
          measurement_date: valueForm.measurement_date,
          period: valueForm.period,
          value: numValue,
          status,
          notes: valueForm.notes,
          recorded_by_id: profile?.id
        }]);

      if (error) throw error;

      setShowValueModal(false);
      resetValueForm();
      loadIndicatorValues(selectedIndicator.id);
    } catch (error) {
      console.error('Değer kaydedilirken hata:', error);
      alert('Değer kaydedilemedi!');
    }
  };

  const handleDeleteIndicator = async (id: string) => {
    if (!confirm('Bu göstergeyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_indicators')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      loadIndicators(selectedRiskId);
    } catch (error) {
      console.error('Gösterge silinirken hata:', error);
      alert('Gösterge silinemedi!');
    }
  };

  const openEditModal = (indicator: Indicator) => {
    setEditingIndicator(indicator);
    setIndicatorForm({
      risk_id: indicator.risk_id,
      name: indicator.name,
      description: indicator.description || '',
      indicator_type: indicator.indicator_type,
      unit_of_measure: indicator.unit_of_measure || '',
      measurement_frequency: indicator.measurement_frequency || 'MONTHLY',
      green_threshold: indicator.green_threshold || '',
      yellow_threshold: indicator.yellow_threshold || '',
      red_threshold: indicator.red_threshold || '',
      direction: indicator.direction || 'LOWER_BETTER',
      target_value: indicator.target_value?.toString() || ''
    });
    setShowIndicatorModal(true);
  };

  const openValueModal = (indicator: Indicator) => {
    setSelectedIndicator(indicator);
    loadIndicatorValues(indicator.id);
    setShowValueModal(true);
  };

  const resetIndicatorForm = () => {
    setEditingIndicator(null);
    setIndicatorForm({
      risk_id: selectedRiskId,
      name: '',
      description: '',
      indicator_type: 'KRI',
      unit_of_measure: '',
      measurement_frequency: 'MONTHLY',
      green_threshold: '',
      yellow_threshold: '',
      red_threshold: '',
      direction: 'LOWER_BETTER',
      target_value: ''
    });
  };

  const resetValueForm = () => {
    setValueForm({
      measurement_date: new Date().toISOString().split('T')[0],
      period: '',
      value: '',
      notes: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (risks.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-orange-600" />
            Risk Göstergeleri
          </h1>
          <p className="text-slate-600 mt-2">TRG ve ÖRG göstergeleri ile riskleri izleyin</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Önce Risk Tanımlamalısınız
          </h2>
          <p className="text-slate-600 mb-4">
            Gösterge ekleyebilmek için öncelikle risk kayıtları oluşturmalısınız.
          </p>
          <button
            onClick={() => window.location.href = '/risks/register'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Risk Kayıt Defterine Git
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-orange-600" />
            Risk Göstergeleri
          </h1>
          <p className="text-slate-600 mt-2">TRG ve ÖRG göstergeleri ile riskleri izleyin</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Risk Seçimi
            </label>
            <select
              value={selectedRiskId}
              onChange={(e) => setSelectedRiskId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {risks.map((risk) => (
                <option key={risk.id} value={risk.id}>
                  {risk.code} - {risk.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              resetIndicatorForm();
              setShowIndicatorModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Yeni Gösterge Ekle
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gösterge Adı</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tür</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Birim</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sıklık</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Hedef</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {indicators.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Bu risk için henüz gösterge bulunmuyor
                  </td>
                </tr>
              ) : (
                indicators.map((indicator) => (
                  <tr key={indicator.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {indicator.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{indicator.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        indicator.indicator_type === 'KRI' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {indicator.indicator_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {indicator.unit_of_measure || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {frequencyLabels[indicator.measurement_frequency] || indicator.measurement_frequency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-slate-900">
                      {indicator.target_value || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openValueModal(indicator)}
                          className="text-green-600 hover:text-green-800"
                          title="Değer Ekle"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(indicator)}
                          className="text-slate-600 hover:text-slate-800"
                          title="Düzenle"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteIndicator(indicator.id)}
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

      {showIndicatorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingIndicator ? 'Gösterge Düzenle' : 'Yeni Gösterge Ekle'}
              </h2>
              <button
                onClick={() => {
                  setShowIndicatorModal(false);
                  resetIndicatorForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitIndicator} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Risk
                </label>
                <select
                  value={indicatorForm.risk_id}
                  onChange={(e) => setIndicatorForm({ ...indicatorForm, risk_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!editingIndicator}
                >
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.code} - {risk.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Gösterge Türü
                </label>
                <select
                  value={indicatorForm.indicator_type}
                  onChange={(e) => setIndicatorForm({ ...indicatorForm, indicator_type: e.target.value as 'KRI' | 'LEI' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="KRI">{indicatorTypeLabels.KRI}</option>
                  <option value="LEI">{indicatorTypeLabels.LEI}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Gösterge Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={indicatorForm.name}
                  onChange={(e) => setIndicatorForm({ ...indicatorForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  rows={2}
                  value={indicatorForm.description}
                  onChange={(e) => setIndicatorForm({ ...indicatorForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ölçü Birimi
                  </label>
                  <input
                    type="text"
                    placeholder="Adet, %, TL, Gün..."
                    value={indicatorForm.unit_of_measure}
                    onChange={(e) => setIndicatorForm({ ...indicatorForm, unit_of_measure: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ölçüm Sıklığı
                  </label>
                  <select
                    value={indicatorForm.measurement_frequency}
                    onChange={(e) => setIndicatorForm({ ...indicatorForm, measurement_frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(frequencyLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Yeşil Eşik
                  </label>
                  <input
                    type="text"
                    placeholder="<5 veya 0-10"
                    value={indicatorForm.green_threshold}
                    onChange={(e) => setIndicatorForm({ ...indicatorForm, green_threshold: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sarı Eşik
                  </label>
                  <input
                    type="text"
                    placeholder="5-10"
                    value={indicatorForm.yellow_threshold}
                    onChange={(e) => setIndicatorForm({ ...indicatorForm, yellow_threshold: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Kırmızı Eşik
                  </label>
                  <input
                    type="text"
                    placeholder=">10"
                    value={indicatorForm.red_threshold}
                    onChange={(e) => setIndicatorForm({ ...indicatorForm, red_threshold: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Yön
                  </label>
                  <select
                    value={indicatorForm.direction}
                    onChange={(e) => setIndicatorForm({ ...indicatorForm, direction: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(directionLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Hedef Değer
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={indicatorForm.target_value}
                    onChange={(e) => setIndicatorForm({ ...indicatorForm, target_value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowIndicatorModal(false);
                    resetIndicatorForm();
                  }}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
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
          </div>
        </div>
      )}

      {showValueModal && selectedIndicator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedIndicator.name}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Gösterge Değer Girişi</p>
              </div>
              <button
                onClick={() => {
                  setShowValueModal(false);
                  setSelectedIndicator(null);
                  resetValueForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleSubmitValue} className="bg-slate-50 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-slate-900">Yeni Değer Ekle</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tarih <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={valueForm.measurement_date}
                      onChange={(e) => setValueForm({ ...valueForm, measurement_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Dönem
                    </label>
                    <input
                      type="text"
                      placeholder="2024-Q1, Ocak 2024..."
                      value={valueForm.period}
                      onChange={(e) => setValueForm({ ...valueForm, period: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Değer ({selectedIndicator.unit_of_measure}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valueForm.value}
                    onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Not / Açıklama
                  </label>
                  <textarea
                    rows={2}
                    value={valueForm.notes}
                    onChange={(e) => setValueForm({ ...valueForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Değer Kaydet
                </button>
              </form>

              <div>
                <h3 className="font-medium text-slate-900 mb-4">Geçmiş Değerler</h3>
                {indicatorValues.length === 0 ? (
                  <div className="text-center text-slate-500 py-8 bg-slate-50 rounded-lg">
                    Henüz değer kaydı bulunmuyor
                  </div>
                ) : (
                  <div className="space-y-3">
                    {indicatorValues.map((record) => (
                      <div key={record.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-semibold text-slate-900">
                                {record.value} {selectedIndicator.unit_of_measure}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                record.status === 'GREEN' ? 'bg-green-100 text-green-800' :
                                record.status === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {record.status}
                              </span>
                              {record.period && (
                                <span className="text-sm text-slate-500">
                                  ({record.period})
                                </span>
                              )}
                            </div>
                            {record.notes && (
                              <p className="text-sm text-slate-600 mt-2">{record.notes}</p>
                            )}
                          </div>
                          <div className="text-right text-sm text-slate-500">
                            <div>{new Date(record.measurement_date).toLocaleDateString('tr-TR')}</div>
                            <div>{record.recorded_by?.full_name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
