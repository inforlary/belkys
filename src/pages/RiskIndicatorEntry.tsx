import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface RiskIndicator {
  id: string;
  code: string;
  name: string;
  unit_of_measure: string;
  green_threshold: number;
  yellow_threshold: number;
  red_threshold: number;
  direction: string;
  risk: {
    code: string;
    name: string;
  };
  latest_value?: {
    value: number;
    measurement_date: string;
    status: string;
  };
}

export default function RiskIndicatorEntry() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [indicators, setIndicators] = useState<RiskIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    measurement_date: new Date().toISOString().split('T')[0],
    value: '',
    trend: 'stable',
    notes: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadIndicators();
    }
  }, [profile]);

  const loadIndicators = async () => {
    try {
      const { data: risks } = await supabase
        .from('risks')
        .select('id')
        .eq('organization_id', profile?.organization_id);

      if (!risks || risks.length === 0) {
        setIndicators([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('risk_indicators')
        .select(`
          *,
          risk:risks(code, name)
        `)
        .in('risk_id', risks.map(r => r.id))
        .eq('is_active', true)
        .order('code');

      if (error) throw error;

      const indicatorsWithLatestValue = await Promise.all(
        (data || []).map(async (indicator) => {
          const { data: latestValue } = await supabase
            .from('risk_indicator_values')
            .select('value, measurement_date, status')
            .eq('indicator_id', indicator.id)
            .order('measurement_date', { ascending: false })
            .limit(1)
            .single();

          return {
            ...indicator,
            latest_value: latestValue || null
          };
        })
      );

      setIndicators(indicatorsWithLatestValue);
    } catch (error) {
      console.error('Göstergeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIndicator || !formData.value) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      const { error } = await supabase
        .from('risk_indicator_values')
        .insert({
          indicator_id: selectedIndicator,
          measurement_date: formData.measurement_date,
          value: parseFloat(formData.value),
          trend: formData.trend,
          notes: formData.notes,
          entered_by: profile?.id
        });

      if (error) throw error;

      alert('Gösterge değeri başarıyla kaydedildi');
      setFormData({
        measurement_date: new Date().toISOString().split('T')[0],
        value: '',
        trend: 'stable',
        notes: ''
      });
      setSelectedIndicator(null);
      loadIndicators();
    } catch (error: any) {
      console.error('Gösterge değeri kaydedilirken hata:', error);
      if (error.code === '23505') {
        alert('Bu tarih için zaten bir değer girilmiş');
      } else {
        alert('Gösterge değeri kaydedilemedi');
      }
    }
  };

  const getIndicatorStatus = (indicator: RiskIndicator) => {
    if (!indicator.latest_value) return null;
    return indicator.latest_value.status;
  };

  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'bg-slate-100 text-slate-600';
    const colors = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-slate-100 text-slate-600';
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
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('risks')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gösterge Değeri Girişi</h1>
          <p className="text-slate-600">Risk göstergesi ölçüm değerlerini girin</p>
        </div>
      </div>

      {indicators.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">Henüz gösterge tanımlanmamış</p>
          <button
            onClick={() => navigate('risks/indicators')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Gösterge Tanımla
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">Göstergeler</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {indicators.map((indicator) => {
                  const status = getIndicatorStatus(indicator);
                  return (
                    <button
                      key={indicator.id}
                      onClick={() => setSelectedIndicator(indicator.id)}
                      className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                        selectedIndicator === indicator.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-slate-900">{indicator.code}</div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {status === 'green' ? 'İyi' : status === 'yellow' ? 'Dikkat' : status === 'red' ? 'Kötü' : '-'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mb-1">{indicator.name}</div>
                      <div className="text-xs text-slate-500">
                        {indicator.risk.code} - {indicator.risk.name}
                      </div>
                      {indicator.latest_value && (
                        <div className="text-xs text-slate-500 mt-2">
                          Son: {indicator.latest_value.value} {indicator.unit_of_measure}
                          <span className="text-slate-400 ml-2">
                            ({new Date(indicator.latest_value.measurement_date).toLocaleDateString('tr-TR')})
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedIndicator ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Değer Girişi</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {indicators.find(i => i.id === selectedIndicator)?.name}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Ölçüm Tarihi
                      </label>
                      <input
                        type="date"
                        value={formData.measurement_date}
                        onChange={(e) => setFormData({ ...formData, measurement_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Değer ({indicators.find(i => i.id === selectedIndicator)?.unit_of_measure})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Trend
                    </label>
                    <select
                      value={formData.trend}
                      onChange={(e) => setFormData({ ...formData, trend: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="up">Yükseliş</option>
                      <option value="stable">Stabil</option>
                      <option value="down">Düşüş</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notlar
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Değerlendirme notları..."
                    />
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Eşik Değerleri</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-green-700 font-medium">Yeşil</div>
                        <div className="text-slate-600">
                          {indicators.find(i => i.id === selectedIndicator)?.direction === 'lower_better' ? '≤' : '≥'}{' '}
                          {indicators.find(i => i.id === selectedIndicator)?.green_threshold}
                        </div>
                      </div>
                      <div>
                        <div className="text-yellow-700 font-medium">Sarı</div>
                        <div className="text-slate-600">
                          {indicators.find(i => i.id === selectedIndicator)?.direction === 'lower_better' ? '≤' : '≥'}{' '}
                          {indicators.find(i => i.id === selectedIndicator)?.yellow_threshold}
                        </div>
                      </div>
                      <div>
                        <div className="text-red-700 font-medium">Kırmızı</div>
                        <div className="text-slate-600">
                          {indicators.find(i => i.id === selectedIndicator)?.direction === 'lower_better' ? '>' : '<'}{' '}
                          {indicators.find(i => i.id === selectedIndicator)?.red_threshold}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedIndicator(null)}
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
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-slate-500">Soldaki listeden bir gösterge seçin</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
