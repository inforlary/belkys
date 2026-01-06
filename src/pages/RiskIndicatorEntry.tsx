import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Save, ArrowLeft, Calendar } from 'lucide-react';

interface Indicator {
  id: string;
  code: string;
  name: string;
  unit_of_measure: string;
  green_threshold: string;
  yellow_threshold: string;
  red_threshold: string;
  direction: string;
  target_value: number;
  risk?: {
    code: string;
    name: string;
  };
}

interface EntryData {
  indicator_id: string;
  value: string;
  notes: string;
}

export default function RiskIndicatorEntry() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [entryData, setEntryData] = useState<Record<string, EntryData>>({});

  useEffect(() => {
    if (profile?.organization_id) {
      loadIndicators();
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setSelectedPeriod(period);
    }
  }, [profile?.organization_id]);

  async function loadIndicators() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('risk_indicators')
        .select(`
          *,
          risk:risks(code, name)
        `)
        .eq('risk:risks.organization_id', profile?.organization_id)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setIndicators(data || []);

      const initialData: Record<string, EntryData> = {};
      (data || []).forEach((indicator) => {
        initialData[indicator.id] = {
          indicator_id: indicator.id,
          value: '',
          notes: ''
        };
      });
      setEntryData(initialData);
    } catch (error) {
      console.error('Göstergeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  function updateEntryData(indicatorId: string, field: 'value' | 'notes', value: string) {
    setEntryData(prev => ({
      ...prev,
      [indicatorId]: {
        ...prev[indicatorId],
        [field]: value
      }
    }));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPeriod) {
      alert('Lütfen dönem seçin');
      return;
    }

    const entriesToSave = Object.values(entryData).filter(entry => entry.value && entry.value !== '');

    if (entriesToSave.length === 0) {
      alert('Lütfen en az bir gösterge için değer girin');
      return;
    }

    try {
      setSaving(true);

      const measurementDate = new Date(selectedPeriod + '-01');

      const valuesToInsert = await Promise.all(
        entriesToSave.map(async (entry) => {
          const indicator = indicators.find(i => i.id === entry.indicator_id);
          if (!indicator) return null;

          const value = parseFloat(entry.value);
          const status = calculateStatus(value, indicator);

          const { data: previousValue } = await supabase
            .from('risk_indicator_values')
            .select('value')
            .eq('indicator_id', entry.indicator_id)
            .order('measurement_date', { ascending: false })
            .limit(1)
            .single();

          let trend = 'STABLE';
          if (previousValue) {
            const change = ((value - previousValue.value) / previousValue.value) * 100;
            if (Math.abs(change) >= 5) {
              trend = change > 0 ? 'UP' : 'DOWN';
            }
          }

          return {
            indicator_id: entry.indicator_id,
            measurement_date: measurementDate.toISOString().split('T')[0],
            period: selectedPeriod,
            value,
            status,
            trend,
            notes: entry.notes || null,
            recorded_by_id: profile?.id,
            alert_triggered: false
          };
        })
      );

      const validValues = valuesToInsert.filter(v => v !== null);

      const { error } = await supabase
        .from('risk_indicator_values')
        .insert(validValues);

      if (error) throw error;

      alert(`${validValues.length} gösterge değeri başarıyla kaydedildi`);
      navigate('risks/indicators');
    } catch (error) {
      console.error('Değerler kaydedilirken hata:', error);
      alert('Değerler kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate('risks/indicators')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri Dön
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Toplu Değer Girişi</h1>
          <p className="text-gray-600 mt-1">Tüm göstergeler için toplu değer girişi yapın</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div className="flex-1 max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dönem Seçimi <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
          </div>

          <div className="p-6">
            {indicators.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Henüz gösterge tanımlanmamış
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Kod</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Gösterge Adı</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">Birim</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 w-32">Değer</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.map((indicator) => (
                      <tr key={indicator.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{indicator.code}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{indicator.name}</div>
                          <div className="text-xs text-gray-600">
                            Risk: {indicator.risk?.code} - {indicator.risk?.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{indicator.unit_of_measure}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={entryData[indicator.id]?.value || ''}
                            onChange={(e) => updateEntryData(indicator.id, 'value', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entryData[indicator.id]?.notes || ''}
                            onChange={(e) => updateEntryData(indicator.id, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Not (opsiyonel)"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {indicators.length} gösterge listeleniyor
              </div>
              <button
                type="submit"
                disabled={saving || indicators.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
              </button>
            </div>
          </div>
        </form>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Bilgi</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Sadece değer girilen göstergeler kaydedilecektir</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Durum otomatik olarak eşik değerlerine göre hesaplanacaktır</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Trend otomatik olarak önceki döneme göre hesaplanacaktır</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Alarm seviyesindeki göstergeler için bildirim gönderilecektir</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
