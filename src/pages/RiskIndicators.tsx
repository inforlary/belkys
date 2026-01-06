import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, TrendingUp, TrendingDown, Minus, BarChart3, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Risk {
  id: string;
  code: string;
  name: string;
}

interface Indicator {
  id: string;
  risk_id: string;
  code: string;
  name: string;
  description: string;
  indicator_type: string;
  unit_of_measure: string;
  measurement_frequency: string;
  green_threshold: string;
  yellow_threshold: string;
  red_threshold: string;
  direction: string;
  target_value: number;
  alert_enabled: boolean;
  data_source?: string;
  calculation_method?: string;
  is_active: boolean;
  risk?: Risk;
  latest_value?: {
    value: number;
    status: string;
    trend: string;
    measurement_date: string;
  };
}

interface IndicatorValue {
  id: string;
  indicator_id: string;
  measurement_date: string;
  period: string;
  value: number;
  status: string;
  trend: string;
  notes: string;
  analysis?: string;
  recorded_by?: {
    full_name: string;
  };
}

const indicatorTypeLabels = {
  KRI: 'TRG - Temel Risk Göstergesi',
  LEI: 'ÖRG - Öncü Risk Göstergesi'
};

const directionLabels = {
  LOWER_BETTER: 'Düşük değer daha iyi',
  HIGHER_BETTER: 'Yüksek değer daha iyi',
  TARGET: 'Hedefe yakın'
};

const statusConfig = {
  GREEN: { label: 'Normal', color: 'bg-green-100 text-green-800', icon: '🟢' },
  YELLOW: { label: 'Dikkat', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
  RED: { label: 'Alarm', color: 'bg-red-100 text-red-800', icon: '🔴' }
};

const frequencyOptions = [
  { value: 'DAILY', label: 'Günlük' },
  { value: 'WEEKLY', label: 'Haftalık' },
  { value: 'MONTHLY', label: 'Aylık' },
  { value: 'QUARTERLY', label: 'Çeyreklik' },
  { value: 'SEMI_ANNUAL', label: '6 Aylık' },
  { value: 'ANNUAL', label: 'Yıllık' }
];

export default function RiskIndicators() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [indicatorValues, setIndicatorValues] = useState<IndicatorValue[]>([]);
  const [loading, setLoading] = useState(true);

  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);

  const [filters, setFilters] = useState({
    risk_id: '',
    indicator_type: '',
    status: ''
  });

  const [indicatorForm, setIndicatorForm] = useState({
    risk_id: '',
    name: '',
    description: '',
    indicator_type: 'KRI',
    unit_of_measure: '',
    measurement_frequency: 'MONTHLY',
    data_source: '',
    calculation_method: '',
    direction: 'LOWER_BETTER',
    target_value: '',
    green_threshold: '',
    yellow_threshold: '',
    red_threshold: '',
    alert_enabled: true
  });

  const [valueForm, setValueForm] = useState({
    measurement_date: new Date().toISOString().split('T')[0],
    period: '',
    value: '',
    notes: '',
    analysis: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedIndicator) {
      loadIndicatorValues(selectedIndicator.id);
    }
  }, [selectedIndicator]);

  useEffect(() => {
    const date = new Date(valueForm.measurement_date);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setValueForm(prev => ({ ...prev, period }));
  }, [valueForm.measurement_date]);

  async function loadData() {
    try {
      setLoading(true);

      const [indicatorsRes, risksRes] = await Promise.all([
        supabase
          .from('risk_indicators')
          .select(`
            *,
            risk:risks(id, code, name)
          `)
          .eq('risk:risks.organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('risks')
          .select('id, code, name')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('code')
      ]);

      if (indicatorsRes.error) throw indicatorsRes.error;
      if (risksRes.error) throw risksRes.error;

      const indicatorsWithValues = await Promise.all(
        (indicatorsRes.data || []).map(async (indicator) => {
          const { data: latestValue } = await supabase
            .from('risk_indicator_values')
            .select('value, status, trend, measurement_date')
            .eq('indicator_id', indicator.id)
            .order('measurement_date', { ascending: false })
            .limit(1)
            .single();

          return {
            ...indicator,
            latest_value: latestValue || undefined
          };
        })
      );

      setIndicators(indicatorsWithValues);
      setRisks(risksRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadIndicatorValues(indicatorId: string) {
    try {
      const { data, error } = await supabase
        .from('risk_indicator_values')
        .select(`
          *,
          recorded_by:profiles!recorded_by_id(full_name)
        `)
        .eq('indicator_id', indicatorId)
        .order('measurement_date', { ascending: false });

      if (error) throw error;
      setIndicatorValues(data || []);
    } catch (error) {
      console.error('Gösterge değerleri yüklenirken hata:', error);
    }
  }

  function openIndicatorModal(indicator?: Indicator) {
    if (indicator) {
      setEditingIndicator(indicator);
      setIndicatorForm({
        risk_id: indicator.risk_id,
        name: indicator.name,
        description: indicator.description || '',
        indicator_type: indicator.indicator_type,
        unit_of_measure: indicator.unit_of_measure || '',
        measurement_frequency: indicator.measurement_frequency || 'MONTHLY',
        data_source: indicator.data_source || '',
        calculation_method: indicator.calculation_method || '',
        direction: indicator.direction,
        target_value: indicator.target_value?.toString() || '',
        green_threshold: indicator.green_threshold || '',
        yellow_threshold: indicator.yellow_threshold || '',
        red_threshold: indicator.red_threshold || '',
        alert_enabled: indicator.alert_enabled
      });
    } else {
      setEditingIndicator(null);
      setIndicatorForm({
        risk_id: '',
        name: '',
        description: '',
        indicator_type: 'KRI',
        unit_of_measure: '',
        measurement_frequency: 'MONTHLY',
        data_source: '',
        calculation_method: '',
        direction: 'LOWER_BETTER',
        target_value: '',
        green_threshold: '',
        yellow_threshold: '',
        red_threshold: '',
        alert_enabled: true
      });
    }
    setShowIndicatorModal(true);
  }

  function openValueModal() {
    if (!selectedIndicator) return;
    setValueForm({
      measurement_date: new Date().toISOString().split('T')[0],
      period: '',
      value: '',
      notes: '',
      analysis: ''
    });
    setShowValueModal(true);
  }

  async function handleIndicatorSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!indicatorForm.risk_id || !indicatorForm.name) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    try {
      let code = '';
      if (!editingIndicator) {
        const prefix = indicatorForm.indicator_type === 'KRI' ? 'TRG' : 'ÖRG';
        const { data: existingIndicators } = await supabase
          .from('risk_indicators')
          .select('code')
          .ilike('code', `${prefix}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        let nextNumber = 1;
        if (existingIndicators && existingIndicators.length > 0) {
          const lastCode = existingIndicators[0].code;
          const match = lastCode.match(/\d+$/);
          if (match) {
            nextNumber = parseInt(match[0]) + 1;
          }
        }

        code = `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
      }

      const indicatorData = {
        risk_id: indicatorForm.risk_id,
        code: editingIndicator ? editingIndicator.code : code,
        name: indicatorForm.name,
        description: indicatorForm.description,
        indicator_type: indicatorForm.indicator_type,
        unit_of_measure: indicatorForm.unit_of_measure,
        measurement_frequency: indicatorForm.measurement_frequency,
        data_source: indicatorForm.data_source || null,
        calculation_method: indicatorForm.calculation_method || null,
        direction: indicatorForm.direction,
        target_value: indicatorForm.target_value ? parseFloat(indicatorForm.target_value) : null,
        green_threshold: indicatorForm.green_threshold,
        yellow_threshold: indicatorForm.yellow_threshold,
        red_threshold: indicatorForm.red_threshold,
        alert_enabled: indicatorForm.alert_enabled,
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

      setShowIndicatorModal(false);
      loadData();
    } catch (error) {
      console.error('Gösterge kaydedilirken hata:', error);
      alert('Gösterge kaydedilemedi');
    }
  }

  async function handleValueSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedIndicator || !valueForm.value) {
      alert('Lütfen değer girin');
      return;
    }

    try {
      const value = parseFloat(valueForm.value);
      const status = calculateStatus(value, selectedIndicator);

      const previousValue = indicatorValues[0]?.value;
      const trend = previousValue ? calculateTrend(value, previousValue, selectedIndicator.direction) : 'STABLE';

      const { error } = await supabase
        .from('risk_indicator_values')
        .insert({
          indicator_id: selectedIndicator.id,
          measurement_date: valueForm.measurement_date,
          period: valueForm.period,
          value,
          status,
          trend,
          notes: valueForm.notes,
          analysis: valueForm.analysis || null,
          recorded_by_id: profile?.id,
          alert_triggered: status === 'RED' && selectedIndicator.alert_enabled
        });

      if (error) throw error;

      if (status === 'RED' && selectedIndicator.alert_enabled) {
        await supabase.from('notifications').insert({
          user_id: profile?.id,
          organization_id: profile?.organization_id,
          title: `Risk Göstergesi Alarm: ${selectedIndicator.code}`,
          message: `${selectedIndicator.name} göstergesi alarm seviyesine ulaştı. Değer: ${value} ${selectedIndicator.unit_of_measure}`,
          type: 'risk_alert',
          priority: 'high'
        });
      }

      setShowValueModal(false);
      loadIndicatorValues(selectedIndicator.id);
      loadData();
    } catch (error) {
      console.error('Değer kaydedilirken hata:', error);
      alert('Değer kaydedilemedi');
    }
  }

  function calculateStatus(value: number, indicator: Indicator): string {
    const { direction, green_threshold, yellow_threshold, red_threshold } = indicator;

    if (direction === 'LOWER_BETTER') {
      const greenMax = parseFloat(green_threshold.replace(/[<>]/g, ''));
      const yellowRange = yellow_threshold.split('-').map(v => parseFloat(v.trim()));

      if (value < greenMax) return 'GREEN';
      if (value >= yellowRange[0] && value <= yellowRange[1]) return 'YELLOW';
      return 'RED';
    } else if (direction === 'HIGHER_BETTER') {
      const greenMin = parseFloat(green_threshold.replace(/[<>]/g, ''));
      const yellowRange = yellow_threshold.split('-').map(v => parseFloat(v.trim()));

      if (value > greenMin) return 'GREEN';
      if (value >= yellowRange[0] && value <= yellowRange[1]) return 'YELLOW';
      return 'RED';
    } else {
      const target = indicator.target_value || 0;
      const tolerance = target * 0.1;

      if (Math.abs(value - target) < tolerance) return 'GREEN';
      if (Math.abs(value - target) < tolerance * 2) return 'YELLOW';
      return 'RED';
    }
  }

  function calculateTrend(current: number, previous: number, direction: string): string {
    const change = ((current - previous) / previous) * 100;

    if (Math.abs(change) < 5) return 'STABLE';
    return change > 0 ? 'UP' : 'DOWN';
  }

  function getTrendIcon(trend: string) {
    if (trend === 'UP') return <TrendingUp className="w-4 h-4 text-red-600" />;
    if (trend === 'DOWN') return <TrendingDown className="w-4 h-4 text-green-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  }

  function getTrendLabel(trend: string) {
    if (trend === 'UP') return 'Artıyor';
    if (trend === 'DOWN') return 'Azalıyor';
    return 'Sabit';
  }

  const filteredIndicators = indicators.filter(ind => {
    if (filters.risk_id && ind.risk_id !== filters.risk_id) return false;
    if (filters.indicator_type && ind.indicator_type !== filters.indicator_type) return false;
    if (filters.status && ind.latest_value?.status !== filters.status) return false;
    return true;
  });

  const chartData = indicatorValues
    .slice(0, 12)
    .reverse()
    .map(v => ({
      period: v.period,
      value: v.value,
      date: new Date(v.measurement_date).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
    }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            Risk Göstergeleri
          </h1>
          <p className="text-gray-600 mt-1">Risk göstergelerini izleyin ve yönetin</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('risks/indicators/entry')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Toplu Değer Girişi
          </button>
          <button
            onClick={() => openIndicatorModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Yeni Gösterge Ekle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          <Card>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Filtreler</h3>
              </div>
              <div className="space-y-3">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gösterge Tipi</label>
                  <select
                    value={filters.indicator_type}
                    onChange={(e) => setFilters({ ...filters, indicator_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Tümü</option>
                    <option value="KRI">TRG</option>
                    <option value="LEI">ÖRG</option>
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
                    <option value="GREEN">Normal</option>
                    <option value="YELLOW">Dikkat</option>
                    <option value="RED">Alarm</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredIndicators.length === 0 ? (
              <Card>
                <div className="p-6 text-center text-gray-500">
                  Gösterge bulunamadı
                </div>
              </Card>
            ) : (
              filteredIndicators.map((indicator) => (
                <Card
                  key={indicator.id}
                  className={`cursor-pointer transition-all ${
                    selectedIndicator?.id === indicator.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedIndicator(indicator)}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-gray-900">{indicator.code}</div>
                      {indicator.latest_value && (
                        <span className={`text-xs px-2 py-1 rounded-full ${statusConfig[indicator.latest_value.status as keyof typeof statusConfig]?.color}`}>
                          {statusConfig[indicator.latest_value.status as keyof typeof statusConfig]?.icon} {statusConfig[indicator.latest_value.status as keyof typeof statusConfig]?.label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-2">{indicator.name}</div>
                    <div className="text-xs text-gray-600 mb-3">
                      Risk: {indicator.risk?.code} {indicator.risk?.name}
                    </div>
                    {indicator.latest_value && (
                      <div className="flex justify-between items-center text-sm border-t pt-2">
                        <div>
                          <span className="text-gray-600">Son Değer: </span>
                          <span className="font-semibold">{indicator.latest_value.value} {indicator.unit_of_measure}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          {getTrendIcon(indicator.latest_value.trend)}
                          <span className="text-xs">{getTrendLabel(indicator.latest_value.trend)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="col-span-8">
          {!selectedIndicator ? (
            <Card>
              <div className="p-12 text-center text-gray-500">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p>Detayları görüntülemek için bir gösterge seçin</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {selectedIndicator.code}: {selectedIndicator.name}
                    </h2>
                    <p className="text-sm text-gray-600">
                      İlgili Risk: {selectedIndicator.risk?.code} - {selectedIndicator.risk?.name}
                    </p>
                  </div>
                  <button
                    onClick={() => openIndicatorModal(selectedIndicator)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Tip:</span>
                    <span className="ml-2 font-medium">{indicatorTypeLabels[selectedIndicator.indicator_type as keyof typeof indicatorTypeLabels]}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Ölçü Birimi:</span>
                    <span className="ml-2 font-medium">{selectedIndicator.unit_of_measure}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Sıklık:</span>
                    <span className="ml-2 font-medium">
                      {frequencyOptions.find(f => f.value === selectedIndicator.measurement_frequency)?.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-3">Eşik Değerleri</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🟢</span>
                    <span className="text-gray-700">Yeşil (Normal):</span>
                    <span className="font-medium">{selectedIndicator.green_threshold}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🟡</span>
                    <span className="text-gray-700">Sarı (Dikkat):</span>
                    <span className="font-medium">{selectedIndicator.yellow_threshold}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔴</span>
                    <span className="text-gray-700">Kırmızı (Alarm):</span>
                    <span className="font-medium">{selectedIndicator.red_threshold}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Trend Grafiği (Son 12 Dönem)</h3>
                  <button
                    onClick={openValueModal}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Değer Ekle
                  </button>
                </div>

                {chartData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Henüz veri girilmemiş
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ fill: '#2563eb', r: 4 }}
                        name={`Değer (${selectedIndicator.unit_of_measure})`}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Değer Geçmişi</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Tarih</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Dönem</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">Değer</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Durum</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorValues.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            Henüz değer girilmemiş
                          </td>
                        </tr>
                      ) : (
                        indicatorValues.map((value) => (
                          <tr key={value.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">{new Date(value.measurement_date).toLocaleDateString('tr-TR')}</td>
                            <td className="px-4 py-3">{value.period}</td>
                            <td className="px-4 py-3 text-right font-medium">
                              {value.value} {selectedIndicator.unit_of_measure}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${statusConfig[value.status as keyof typeof statusConfig]?.color}`}>
                                {statusConfig[value.status as keyof typeof statusConfig]?.icon} {statusConfig[value.status as keyof typeof statusConfig]?.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{value.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        title={editingIndicator ? 'Gösterge Düzenle' : 'Yeni Gösterge Ekle'}
      >
        <form onSubmit={handleIndicatorSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İlgili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={indicatorForm.risk_id}
              onChange={(e) => setIndicatorForm({ ...indicatorForm, risk_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">Seçiniz</option>
              {risks.map((risk) => (
                <option key={risk.id} value={risk.id}>{risk.code} - {risk.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gösterge Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={indicatorForm.name}
              onChange={(e) => setIndicatorForm({ ...indicatorForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={indicatorForm.description}
              onChange={(e) => setIndicatorForm({ ...indicatorForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gösterge Tipi <span className="text-red-500">*</span>
              </label>
              <select
                value={indicatorForm.indicator_type}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, indicator_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.entries(indicatorTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ölçü Birimi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={indicatorForm.unit_of_measure}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, unit_of_measure: e.target.value })}
                placeholder="Adet, %, TL, Gün..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ölçüm Sıklığı <span className="text-red-500">*</span>
              </label>
              <select
                value={indicatorForm.measurement_frequency}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, measurement_frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veri Kaynağı</label>
              <input
                type="text"
                value={indicatorForm.data_source}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, data_source: e.target.value })}
                placeholder="IT Sistemleri, Muhasebe..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hesaplama Yöntemi</label>
            <textarea
              value={indicatorForm.calculation_method}
              onChange={(e) => setIndicatorForm({ ...indicatorForm, calculation_method: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Göstergenin nasıl hesaplandığını açıklayın"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yön <span className="text-red-500">*</span>
            </label>
            <select
              value={indicatorForm.direction}
              onChange={(e) => setIndicatorForm({ ...indicatorForm, direction: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {Object.entries(directionLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {indicatorForm.direction === 'TARGET' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hedef Değer <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={indicatorForm.target_value}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, target_value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required={indicatorForm.direction === 'TARGET'}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yeşil Eşik <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={indicatorForm.green_threshold}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, green_threshold: e.target.value })}
                placeholder="<3 veya 85-100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sarı Eşik <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={indicatorForm.yellow_threshold}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, yellow_threshold: e.target.value })}
                placeholder="3-5 veya 70-85"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kırmızı Eşik <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={indicatorForm.red_threshold}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, red_threshold: e.target.value })}
                placeholder=">5 veya <70"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={indicatorForm.alert_enabled}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, alert_enabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Alarm aktif (Kırmızı seviyede bildirim gönder)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowIndicatorModal(false)}
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

      <Modal
        isOpen={showValueModal}
        onClose={() => setShowValueModal(false)}
        title="Değer Girişi"
      >
        <form onSubmit={handleValueSubmit} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="font-medium text-gray-900">
              {selectedIndicator?.code} - {selectedIndicator?.name}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Birim: {selectedIndicator?.unit_of_measure}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ölçüm Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={valueForm.measurement_date}
                onChange={(e) => setValueForm({ ...valueForm, measurement_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dönem <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={valueForm.period}
                onChange={(e) => setValueForm({ ...valueForm, period: e.target.value })}
                placeholder="2025-01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Değer <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={valueForm.value}
              onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Not/Açıklama</label>
            <textarea
              value={valueForm.notes}
              onChange={(e) => setValueForm({ ...valueForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Bu ölçüm hakkında notlar"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Analiz Yorumu</label>
            <textarea
              value={valueForm.analysis}
              onChange={(e) => setValueForm({ ...valueForm, analysis: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Değerin analizi ve yorumu"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowValueModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
      </Modal>
    </div>
  );
}
