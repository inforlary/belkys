import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Plus, ArrowLeft, TrendingUp, TrendingDown, Activity, Edit2, Trash2, Eye } from 'lucide-react';

interface RiskIndicator {
  id: string;
  risk_id: string;
  code: string;
  name: string;
  indicator_type: string;
  unit_of_measure: string;
  green_threshold: number;
  yellow_threshold: number;
  red_threshold: number;
  direction: string;
  is_active: boolean;
  risk: {
    code: string;
    name: string;
  };
  latest_value?: {
    value: number;
    status: string;
    measurement_date: string;
  };
}

export default function RiskIndicators() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [indicators, setIndicators] = useState<RiskIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState('');
  const [risks, setRisks] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    indicator_type: 'kri',
    unit_of_measure: '',
    green_threshold: 0,
    yellow_threshold: 0,
    red_threshold: 0,
    direction: 'lower_better'
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadIndicators(), loadRisks()]);
    } finally {
      setLoading(false);
    }
  };

  const loadIndicators = async () => {
    const { data: riskIds, error: riskError } = await supabase
      .from('risks')
      .select('id')
      .eq('organization_id', profile?.organization_id);

    if (riskError) throw riskError;

    const riskIdArray = riskIds?.map(r => r.id) || [];

    if (riskIdArray.length === 0) {
      setIndicators([]);
      return;
    }

    const { data, error } = await supabase
      .from('risk_indicators')
      .select(`
        *,
        risk:risks(code, name)
      `)
      .in('risk_id', riskIdArray)
      .eq('is_active', true)
      .order('code');

    if (error) throw error;

    const indicatorsWithLatestValue = await Promise.all(
      (data || []).map(async (indicator) => {
        const { data: latestValue } = await supabase
          .from('risk_indicator_values')
          .select('value, status, measurement_date')
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
  };

  const loadRisks = async () => {
    const { data, error } = await supabase
      .from('risks')
      .select('id, code, name')
      .eq('organization_id', profile?.organization_id)
      .eq('is_active', true)
      .order('code');

    if (error) throw error;
    setRisks(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRisk) {
      alert('Lütfen bir risk seçin');
      return;
    }

    try {
      const { error } = await supabase
        .from('risk_indicators')
        .insert({
          risk_id: selectedRisk,
          ...formData
        });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        code: '',
        name: '',
        indicator_type: 'kri',
        unit_of_measure: '',
        green_threshold: 0,
        yellow_threshold: 0,
        red_threshold: 0,
        direction: 'lower_better'
      });
      setSelectedRisk('');
      loadIndicators();
    } catch (error) {
      console.error('Gösterge eklenirken hata:', error);
      alert('Gösterge eklenemedi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu göstergeyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('risk_indicators')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      loadIndicators();
    } catch (error) {
      console.error('Gösterge silinirken hata:', error);
      alert('Gösterge silinemedi');
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return <span className="text-slate-400">-</span>;

    const colors = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800'
    };

    const labels = {
      green: 'İyi',
      yellow: 'Dikkat',
      red: 'Kötü'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('risks')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Risk Göstergeleri</h1>
            <p className="text-slate-600">KRI ve LEI göstergelerini yönetin</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Gösterge
        </button>
      </div>

      {indicators.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">Henüz gösterge tanımlanmamış</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            İlk Göstergeyi Ekle
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gösterge Adı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tip</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Son Değer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {indicators.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {indicator.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {indicator.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {indicator.risk.code} - {indicator.risk.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      indicator.indicator_type === 'kri'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {indicator.indicator_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {indicator.latest_value
                      ? `${indicator.latest_value.value} ${indicator.unit_of_measure}`
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getStatusBadge(indicator.latest_value?.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`risks/indicators/${indicator.id}`)}
                        className="p-1 hover:bg-slate-100 rounded"
                        title="Detay"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(indicator.id)}
                        className="p-1 hover:bg-red-50 text-red-600 rounded"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Yeni Gösterge Ekle</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Risk</label>
                <select
                  value={selectedRisk}
                  onChange={(e) => setSelectedRisk(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Seçiniz...</option>
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.code} - {risk.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gösterge Kodu</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gösterge Tipi</label>
                  <select
                    value={formData.indicator_type}
                    onChange={(e) => setFormData({ ...formData, indicator_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="kri">KRI (Anahtar Risk Göstergesi)</option>
                    <option value="lei">LEI (Öncü Olay Göstergesi)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gösterge Adı</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ölçü Birimi</label>
                  <input
                    type="text"
                    value={formData.unit_of_measure}
                    onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="Adet, %, TL vb."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Yön</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="lower_better">Düşük İyi</option>
                    <option value="higher_better">Yüksek İyi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-1">Yeşil Eşik</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.green_threshold}
                    onChange={(e) => setFormData({ ...formData, green_threshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-yellow-700 mb-1">Sarı Eşik</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.yellow_threshold}
                    onChange={(e) => setFormData({ ...formData, yellow_threshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-red-700 mb-1">Kırmızı Eşik</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.red_threshold}
                    onChange={(e) => setFormData({ ...formData, red_threshold: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
        </div>
      )}
    </div>
  );
}
