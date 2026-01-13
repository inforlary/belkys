import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { ArrowLeft, Save } from 'lucide-react';

interface Indicator {
  id: string;
  code: string;
  name: string;
  unit_of_measure: string;
  measurement_frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  direction: 'LOWER_BETTER' | 'HIGHER_BETTER' | 'TARGET';
  green_threshold: number;
  yellow_threshold: number;
  red_threshold: number;
  is_active: boolean;
}

interface IndicatorEntry {
  indicator_id: string;
  value: string;
  status: 'GREEN' | 'YELLOW' | 'RED' | null;
  notes: string;
}

const statusConfig = {
  GREEN: { icon: '🟢', label: 'Normal' },
  YELLOW: { icon: '🟡', label: 'Uyarı' },
  RED: { icon: '🔴', label: 'Alarm' }
};

const months = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' }
];

const quarters = [
  { value: 1, label: 'Q1 (Ocak-Mart)' },
  { value: 2, label: 'Q2 (Nisan-Haziran)' },
  { value: 3, label: 'Q3 (Temmuz-Eylül)' },
  { value: 4, label: 'Q4 (Ekim-Aralık)' }
];

export default function RiskIndicatorEntry() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [entries, setEntries] = useState<Record<string, IndicatorEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [isQuarterly, setIsQuarterly] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id, selectedYear, selectedMonth, selectedQuarter, isQuarterly]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: indicatorsData, error: indicatorsError } = await supabase
        .from('risk_indicators')
        .select(`
          id,
          code,
          name,
          unit_of_measure,
          measurement_frequency,
          direction,
          green_threshold,
          yellow_threshold,
          red_threshold,
          is_active,
          risk:risks!inner(organization_id)
        `)
        .eq('risk.organization_id', profile?.organization_id)
        .eq('is_active', true)
        .order('code');

      if (indicatorsError) throw indicatorsError;

      const period = isQuarterly
        ? `Q${selectedQuarter} ${selectedYear}`
        : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

      const measurementDate = isQuarterly
        ? `${selectedYear}-${(selectedQuarter * 3).toString().padStart(2, '0')}-01`
        : `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;

      const initialEntries: Record<string, IndicatorEntry> = {};

      for (const indicator of indicatorsData || []) {
        const { data: existingValue } = await supabase
          .from('risk_indicator_values')
          .select('value, status, notes')
          .eq('indicator_id', indicator.id)
          .eq('period', period)
          .maybeSingle();

        initialEntries[indicator.id] = {
          indicator_id: indicator.id,
          value: existingValue?.value?.toString() || '',
          status: existingValue?.status || null,
          notes: existingValue?.notes || ''
        };
      }

      setIndicators(indicatorsData || []);
      setEntries(initialEntries);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  function calculateStatus(value: number, indicator: Indicator): 'GREEN' | 'YELLOW' | 'RED' {
    if (indicator.direction === 'LOWER_BETTER') {
      if (value < indicator.green_threshold) return 'GREEN';
      if (value < indicator.yellow_threshold) return 'YELLOW';
      return 'RED';
    } else if (indicator.direction === 'HIGHER_BETTER') {
      if (value > indicator.green_threshold) return 'GREEN';
      if (value > indicator.yellow_threshold) return 'YELLOW';
      return 'RED';
    } else {
      const deviation = Math.abs(value - indicator.green_threshold);
      if (deviation <= indicator.yellow_threshold) return 'GREEN';
      if (deviation <= indicator.red_threshold) return 'YELLOW';
      return 'RED';
    }
  }

  function handleValueChange(indicatorId: string, value: string, indicator: Indicator) {
    const numValue = parseFloat(value);
    const status = value && !isNaN(numValue) ? calculateStatus(numValue, indicator) : null;

    setEntries(prev => ({
      ...prev,
      [indicatorId]: {
        ...prev[indicatorId],
        value,
        status
      }
    }));
  }

  function handleNotesChange(indicatorId: string, notes: string) {
    setEntries(prev => ({
      ...prev,
      [indicatorId]: {
        ...prev[indicatorId],
        notes
      }
    }));
  }

  async function calculateTrend(indicatorId: string, currentValue: number) {
    const period = isQuarterly
      ? `Q${selectedQuarter} ${selectedYear}`
      : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

    const { data: previousValues } = await supabase
      .from('risk_indicator_values')
      .select('value')
      .eq('indicator_id', indicatorId)
      .neq('period', period)
      .order('measurement_date', { ascending: false })
      .limit(3);

    if (!previousValues || previousValues.length === 0) {
      return 'STABLE';
    }

    const avgPrevious = previousValues.reduce((sum, v) => sum + v.value, 0) / previousValues.length;
    const changePercent = ((currentValue - avgPrevious) / avgPrevious) * 100;

    if (changePercent > 10) return 'UP';
    if (changePercent < -10) return 'DOWN';
    return 'STABLE';
  }

  async function handleSaveAll() {
    try {
      setSaving(true);

      const period = isQuarterly
        ? `Q${selectedQuarter} ${selectedYear}`
        : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

      const measurementDate = isQuarterly
        ? `${selectedYear}-${(selectedQuarter * 3).toString().padStart(2, '0')}-01`
        : `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;

      const valuesToSave = Object.entries(entries).filter(
        ([_, entry]) => entry.value && entry.value.trim() !== ''
      );

      if (valuesToSave.length === 0) {
        alert('Lütfen en az bir değer girin');
        return;
      }

      for (const [indicatorId, entry] of valuesToSave) {
        const value = parseFloat(entry.value);
        if (isNaN(value)) continue;

        const trend = await calculateTrend(indicatorId, value);

        const { data: existing } = await supabase
          .from('risk_indicator_values')
          .select('id')
          .eq('indicator_id', indicatorId)
          .eq('period', period)
          .maybeSingle();

        const valueData = {
          indicator_id: indicatorId,
          measurement_date: measurementDate,
          period,
          value,
          status: entry.status,
          trend,
          notes: entry.notes || null,
          recorded_by_id: profile?.id
        };

        if (existing) {
          const { error } = await supabase
            .from('risk_indicator_values')
            .update(valueData)
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('risk_indicator_values')
            .insert(valueData);

          if (error) throw error;
        }
      }

      alert(`${valuesToSave.length} gösterge değeri kaydedildi`);
      navigate('/risk-management/indicators');
    } catch (error) {
      console.error('Error saving values:', error);
      alert('Değerler kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  function getThresholdDisplay(indicator: Indicator) {
    if (indicator.direction === 'LOWER_BETTER') {
      return `🟢<${indicator.green_threshold} 🟡${indicator.green_threshold}-${indicator.yellow_threshold} 🔴>${indicator.yellow_threshold}`;
    } else if (indicator.direction === 'HIGHER_BETTER') {
      return `🟢>${indicator.green_threshold} 🟡${indicator.yellow_threshold}-${indicator.green_threshold} 🔴<${indicator.yellow_threshold}`;
    } else {
      return `🎯=${indicator.green_threshold} 🟡±${indicator.yellow_threshold} 🔴±${indicator.red_threshold}`;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const currentPeriod = isQuarterly
    ? `Q${selectedQuarter} ${selectedYear}`
    : `${months.find(m => m.value === selectedMonth)?.label.toUpperCase()} ${selectedYear}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/risk-management/indicators')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Gösterge Değer Girişi</h1>
          <p className="text-gray-600 mt-1">Dönemsel gösterge değerlerini girin</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Dönem Seçimi</h2>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yıl</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {!isQuarterly ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ay</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {months.map(month => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Çeyrek</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {quarters.map(quarter => (
                    <option key={quarter.value} value={quarter.value}>{quarter.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end">
              <button
                onClick={() => setIsQuarterly(!isQuarterly)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {isQuarterly ? 'Aylık Giriş' : 'Çeyreklik Giriş'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-6 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            GÖSTERGE DEĞERLERİ - {currentPeriod}
          </h2>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gösterge Adı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birim</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eşikler</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" style={{ minWidth: '200px' }}>Değer</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {indicators.map(indicator => {
                const entry = entries[indicator.id];
                const status = entry?.status;
                const statusInfo = status ? statusConfig[status] : null;

                return (
                  <tr key={indicator.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {indicator.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {indicator.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {indicator.unit_of_measure}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {getThresholdDisplay(indicator)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={entry?.value || ''}
                          onChange={(e) => handleValueChange(indicator.id, e.target.value, indicator)}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Değer"
                        />
                        {statusInfo && (
                          <div className="flex items-center gap-1">
                            <span className="text-xl">{statusInfo.icon}</span>
                            <span className="text-sm text-gray-700">Durum: {statusInfo.label}</span>
                          </div>
                        )}
                        {!statusInfo && entry?.value && (
                          <span className="text-sm text-gray-400">Durum: -</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Not alanı (opsiyonel)
            </label>
            <textarea
              value={Object.values(entries)[0]?.notes || ''}
              onChange={(e) => {
                const notes = e.target.value;
                setEntries(prev => {
                  const updated = { ...prev };
                  Object.keys(updated).forEach(id => {
                    updated[id] = { ...updated[id], notes };
                  });
                  return updated;
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Tüm göstergeler için ortak not..."
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => navigate('/risk-management/indicators')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
            </button>
          </div>
        </div>
      </Card>

      {indicators.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <p className="text-lg">Henüz aktif gösterge bulunmuyor</p>
            <p className="text-sm mt-2">Önce Risk Göstergeleri sayfasından gösterge ekleyin</p>
          </div>
        </Card>
      )}
    </div>
  );
}
