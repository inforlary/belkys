import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, CreditCard as Edit, History, Grid3x3, List, TrendingUp, TrendingDown, Minus, X, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Risk {
  id: string;
  code: string;
  name: string;
  owner_department_id?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Indicator {
  id: string;
  organization_id: string;
  risk_id: string;
  code: string;
  name: string;
  description?: string;
  unit_of_measure: string;
  measurement_frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  direction: 'DOWN' | 'UP';
  threshold_green: number;
  threshold_yellow: number;
  threshold_red: number;
  responsible_department_id?: string;
  is_active: boolean;
  risk?: Risk;
  responsible_department?: Department;
  latest_value?: {
    value: number;
    status: 'GREEN' | 'YELLOW' | 'RED';
    trend: 'UP' | 'DOWN' | 'STABLE';
    measurement_date: string;
    period: string;
  };
}

interface IndicatorValue {
  id: string;
  indicator_id: string;
  measurement_date: string;
  period: string;
  value: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  trend?: 'UP' | 'DOWN' | 'STABLE';
  notes?: string;
  recorded_by_id: string;
  recorded_by?: {
    full_name: string;
  };
  created_at: string;
}

const statusConfig = {
  GREEN: { label: 'Normal', color: 'bg-green-100 text-green-800 border-green-500', cardBg: 'bg-green-50', icon: '🟢' },
  YELLOW: { label: 'Uyarı', color: 'bg-yellow-100 text-yellow-800 border-yellow-500', cardBg: 'bg-yellow-50', icon: '🟡' },
  RED: { label: 'Alarm', color: 'bg-red-100 text-red-800 border-red-500', cardBg: 'bg-red-50', icon: '🔴' },
  NONE: { label: 'Değer Girilmemiş', color: 'bg-gray-100 text-gray-800 border-gray-300', cardBg: 'bg-gray-50', icon: '⚪' }
};

const trendIcons = {
  UP: { icon: '↗️', label: 'Artış' },
  DOWN: { icon: '↘️', label: 'Azalış' },
  STABLE: { icon: '→', label: 'Stabil' }
};

const unitOptions = ['Adet', 'Yüzde (%)', 'Dakika', 'Saat', 'Gün', 'TL', 'Kişi', 'Diğer'];

export default function RiskIndicators() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [indicatorValues, setIndicatorValues] = useState<IndicatorValue[]>([]);

  const [filters, setFilters] = useState({
    risk_id: '',
    department_id: '',
    status: '',
    frequency: '',
    search: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    risk_id: '',
    unit_of_measure: 'Adet',
    measurement_frequency: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
    direction: 'DOWN' as 'DOWN' | 'UP',
    threshold_green: '',
    threshold_yellow: '',
    threshold_red: '',
    responsible_department_id: '',
    is_active: true
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      const [indicatorsRes, risksRes, departmentsRes] = await Promise.all([
        supabase
          .from('risk_indicators')
          .select(`
            *,
            risk:risks!inner(id, code, name, organization_id)
          `)
          .eq('risk.organization_id', profile?.organization_id)
          .order('code'),

        supabase
          .from('risks')
          .select('id, code, name, owner_department_id')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name')
      ]);

      if (indicatorsRes.error) throw indicatorsRes.error;
      if (risksRes.error) throw risksRes.error;
      if (departmentsRes.error) throw departmentsRes.error;

      const indicatorsWithValues = await Promise.all(
        (indicatorsRes.data || []).map(async (indicator) => {
          const { data: latestValue } = await supabase
            .from('risk_indicator_values')
            .select('value, status, trend, measurement_date, period')
            .eq('indicator_id', indicator.id)
            .order('measurement_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...indicator,
            latest_value: latestValue || undefined
          };
        })
      );

      setIndicators(indicatorsWithValues);
      setRisks(risksRes.data || []);
      setDepartments(departmentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function generateNextCode() {
    const { data } = await supabase
      .from('risk_indicators')
      .select('code')
      .eq('organization_id', profile?.organization_id)
      .like('code', 'KRI-%')
      .order('code', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastCode = data[0].code;
      const lastNumber = parseInt(lastCode.split('-')[1]);
      return `KRI-${String(lastNumber + 1).padStart(3, '0')}`;
    }
    return 'KRI-001';
  }

  function openIndicatorModal(indicator?: Indicator) {
    if (indicator) {
      setEditingIndicator(indicator);
      setFormData({
        name: indicator.name,
        description: indicator.description || '',
        risk_id: indicator.risk_id,
        unit_of_measure: indicator.unit_of_measure,
        measurement_frequency: indicator.measurement_frequency,
        direction: indicator.direction,
        threshold_green: indicator.threshold_green.toString(),
        threshold_yellow: indicator.threshold_yellow.toString(),
        threshold_red: indicator.threshold_red.toString(),
        responsible_department_id: indicator.responsible_department_id || '',
        is_active: indicator.is_active
      });
    } else {
      setEditingIndicator(null);
      setFormData({
        name: '',
        description: '',
        risk_id: '',
        unit_of_measure: 'Adet',
        measurement_frequency: 'MONTHLY',
        direction: 'DOWN',
        threshold_green: '',
        threshold_yellow: '',
        threshold_red: '',
        responsible_department_id: '',
        is_active: true
      });
    }
    setShowIndicatorModal(true);
  }

  function closeIndicatorModal() {
    setShowIndicatorModal(false);
    setEditingIndicator(null);
  }

  function handleRiskChange(riskId: string) {
    const selectedRisk = risks.find(r => r.id === riskId);
    setFormData({
      ...formData,
      risk_id: riskId,
      responsible_department_id: selectedRisk?.owner_department_id || ''
    });
  }

  function updateThresholdRed(greenValue: string, yellowValue: string) {
    setFormData(prev => ({
      ...prev,
      threshold_green: greenValue,
      threshold_yellow: yellowValue,
      threshold_red: yellowValue
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.risk_id) {
      alert('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    const greenValue = parseFloat(formData.threshold_green);
    const yellowValue = parseFloat(formData.threshold_yellow);
    const redValue = parseFloat(formData.threshold_red);

    if (isNaN(greenValue) || isNaN(yellowValue) || isNaN(redValue)) {
      alert('Lütfen geçerli eşik değerleri girin');
      return;
    }

    try {
      const indicatorData = {
        organization_id: profile?.organization_id,
        risk_id: formData.risk_id,
        name: formData.name.trim(),
        description: formData.description || null,
        unit_of_measure: formData.unit_of_measure,
        measurement_frequency: formData.measurement_frequency,
        direction: formData.direction,
        threshold_green: greenValue,
        threshold_yellow: yellowValue,
        threshold_red: redValue,
        responsible_department_id: formData.responsible_department_id || null,
        is_active: formData.is_active
      };

      if (editingIndicator) {
        const { error } = await supabase
          .from('risk_indicators')
          .update(indicatorData)
          .eq('id', editingIndicator.id);

        if (error) throw error;
        alert('Gösterge güncellendi');
      } else {
        const code = await generateNextCode();
        const { error } = await supabase
          .from('risk_indicators')
          .insert({ ...indicatorData, code });

        if (error) throw error;
        alert('Gösterge eklendi');
      }

      closeIndicatorModal();
      loadData();
    } catch (error) {
      console.error('Error saving indicator:', error);
      alert('Gösterge kaydedilirken hata oluştu');
    }
  }

  async function openHistoryModal(indicator: Indicator) {
    setSelectedIndicator(indicator);
    setShowHistoryModal(true);

    try {
      const { data, error } = await supabase
        .from('risk_indicator_values')
        .select(`
          *,
          recorded_by:profiles!recorded_by_id(full_name)
        `)
        .eq('indicator_id', indicator.id)
        .order('measurement_date', { ascending: false })
        .limit(12);

      if (error) throw error;
      setIndicatorValues(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
      alert('Geçmiş yüklenirken hata oluştu');
    }
  }

  function closeHistoryModal() {
    setShowHistoryModal(false);
    setSelectedIndicator(null);
    setIndicatorValues([]);
  }

  const filteredIndicators = indicators.filter(ind => {
    if (filters.risk_id && ind.risk_id !== filters.risk_id) return false;
    if (filters.department_id && ind.responsible_department_id !== filters.department_id) return false;
    if (filters.frequency && ind.measurement_frequency !== filters.frequency) return false;
    if (filters.status) {
      if (filters.status === 'NONE' && ind.latest_value) return false;
      if (filters.status !== 'NONE' && (!ind.latest_value || ind.latest_value.status !== filters.status)) return false;
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return ind.code?.toLowerCase().includes(search) ||
             ind.name?.toLowerCase().includes(search);
    }
    return true;
  });

  const stats = {
    total: filteredIndicators.filter(i => i.is_active).length,
    green: filteredIndicators.filter(i => i.latest_value?.status === 'GREEN').length,
    yellow: filteredIndicators.filter(i => i.latest_value?.status === 'YELLOW').length,
    red: filteredIndicators.filter(i => i.latest_value?.status === 'RED').length
  };

  function clearFilters() {
    setFilters({
      risk_id: '',
      department_id: '',
      status: '',
      frequency: '',
      search: ''
    });
  }

  function getThresholdDisplay(indicator: Indicator) {
    if (indicator.direction === 'DOWN') {
      return `🟢 <${indicator.threshold_green} 🟡 ${indicator.threshold_green}-${indicator.threshold_yellow} 🔴 >${indicator.threshold_yellow}`;
    } else {
      return `🟢 >${indicator.threshold_green} 🟡 ${indicator.threshold_yellow}-${indicator.threshold_green} 🔴 <${indicator.threshold_yellow}`;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Göstergeleri (KRI)</h1>
          <p className="text-gray-600 mt-1">Anahtar risk göstergeleri tanımlama ve izleme</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/risk-management/indicators/entry')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Değer Girişi
          </button>
          <button
            onClick={() => openIndicatorModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Yeni Gösterge
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">TOPLAM GÖSTERGE</div>
            <div className="text-xs text-gray-500 mt-2">Aktif</div>
          </div>
        </Card>

        <Card className="p-6 bg-green-50 border-green-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-700">{stats.green}</div>
            <div className="text-sm text-gray-600 mt-1">YEŞİL</div>
            <div className="text-xs text-gray-500 mt-2">🟢 Normal</div>
          </div>
        </Card>

        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-700">{stats.yellow}</div>
            <div className="text-sm text-gray-600 mt-1">SARI</div>
            <div className="text-xs text-gray-500 mt-2">🟡 Uyarı</div>
          </div>
        </Card>

        <Card className="p-6 bg-red-50 border-red-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-700">{stats.red}</div>
            <div className="text-sm text-gray-600 mt-1">KIRMIZI</div>
            <div className="text-xs text-gray-500 mt-2">🔴 Alarm</div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.risk_id}
            onChange={(e) => setFilters({ ...filters, risk_id: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Risk</option>
            {risks.map(risk => (
              <option key={risk.id} value={risk.id}>
                {risk.code} - {risk.name}
              </option>
            ))}
          </select>

          <select
            value={filters.department_id}
            onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Birim</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Durum</option>
            <option value="GREEN">Yeşil</option>
            <option value="YELLOW">Sarı</option>
            <option value="RED">Kırmızı</option>
            <option value="NONE">Değer Girilmemiş</option>
          </select>

          <select
            value={filters.frequency}
            onChange={(e) => setFilters({ ...filters, frequency: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Ölçüm Sıklığı</option>
            <option value="MONTHLY">Aylık</option>
            <option value="QUARTERLY">Çeyreklik</option>
            <option value="ANNUAL">Yıllık</option>
          </select>

          <input
            type="text"
            placeholder="🔍 Ara..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Temizle
          </button>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              viewMode === 'grid'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid3x3 className="w-4 h-4" />
            Grid Görünüm
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              viewMode === 'table'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4" />
            Tablo Görünüm
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIndicators.map(indicator => {
            const status = indicator.latest_value?.status || 'NONE';
            const statusInfo = statusConfig[status];
            const trend = indicator.latest_value?.trend;
            const trendInfo = trend ? trendIcons[trend] : null;

            return (
              <Card
                key={indicator.id}
                className={`p-6 border-2 ${statusInfo.cardBg} ${statusInfo.color.split(' ')[2]}`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        {statusInfo.icon} {indicator.code}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">{indicator.name}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 text-center border border-gray-200">
                    {indicator.latest_value ? (
                      <>
                        <div className="text-4xl font-bold text-gray-900">
                          {indicator.latest_value.value}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {indicator.unit_of_measure}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 py-4">Değer Yok</div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Eşikler:</span>
                      <div className="text-xs text-gray-600 mt-1">
                        {getThresholdDisplay(indicator)}
                      </div>
                    </div>

                    {trendInfo && (
                      <div>
                        <span className="font-medium text-gray-700">Trend:</span>
                        <span className="ml-2">{trendInfo.icon} {trendInfo.label}</span>
                      </div>
                    )}

                    <div>
                      <span className="font-medium text-gray-700">Risk:</span>
                      <span className="ml-2">{indicator.risk?.code}</span>
                    </div>

                    {indicator.latest_value && (
                      <div>
                        <span className="font-medium text-gray-700">Dönem:</span>
                        <span className="ml-2">{indicator.latest_value.period}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => openIndicatorModal(indicator)}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Düzenle
                    </button>
                    <button
                      onClick={() => openHistoryModal(indicator)}
                      className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center justify-center gap-1"
                    >
                      <History className="w-3 h-3" />
                      Geçmiş
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gösterge Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlişkili Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Son Değer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eşikler</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIndicators.map(indicator => {
                  const status = indicator.latest_value?.status || 'NONE';
                  const statusInfo = statusConfig[status];
                  const trend = indicator.latest_value?.trend;
                  const trendInfo = trend ? trendIcons[trend] : null;

                  return (
                    <tr key={indicator.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {indicator.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {indicator.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {indicator.risk?.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {indicator.latest_value
                          ? `${indicator.latest_value.value} ${indicator.unit_of_measure}`
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {getThresholdDisplay(indicator)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-2xl`}>
                          {statusInfo.icon}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xl">
                        {trendInfo?.icon || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openIndicatorModal(indicator)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openHistoryModal(indicator)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showIndicatorModal}
        onClose={closeIndicatorModal}
        title={editingIndicator ? 'Gösterge Düzenle' : 'Yeni Gösterge Ekle'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editingIndicator && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gösterge Kodu
              </label>
              <input
                type="text"
                value={editingIndicator.code}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gösterge Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              İlişkili Risk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.risk_id}
              onChange={(e) => handleRiskChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seçiniz...</option>
              {risks.map(risk => (
                <option key={risk.id} value={risk.id}>
                  {risk.code} - {risk.name}
                </option>
              ))}
            </select>
            {formData.risk_id && formData.responsible_department_id && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Sorumlu birim otomatik olarak yüklendi
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ölçüm Birimi <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.unit_of_measure}
              onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {unitOptions.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ölçüm Sıklığı <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="MONTHLY"
                  checked={formData.measurement_frequency === 'MONTHLY'}
                  onChange={(e) => setFormData({ ...formData, measurement_frequency: e.target.value as any })}
                  className="mr-2"
                />
                Aylık
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="QUARTERLY"
                  checked={formData.measurement_frequency === 'QUARTERLY'}
                  onChange={(e) => setFormData({ ...formData, measurement_frequency: e.target.value as any })}
                  className="mr-2"
                />
                Çeyreklik
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="ANNUAL"
                  checked={formData.measurement_frequency === 'ANNUAL'}
                  onChange={(e) => setFormData({ ...formData, measurement_frequency: e.target.value as any })}
                  className="mr-2"
                />
                Yıllık
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Yön <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="UP"
                  checked={formData.direction === 'UP'}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                  className="mr-2"
                />
                Yukarı iyi (değer arttıkça iyi)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="DOWN"
                  checked={formData.direction === 'DOWN'}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                  className="mr-2"
                />
                Aşağı iyi (değer azaldıkça iyi)
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">EŞİK DEĞERLERİ</h3>

            {formData.direction === 'DOWN' ? (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-gray-700 mb-1">
                    🟢 Yeşil (İyi): değer &lt; <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.threshold_green}
                    onChange={(e) => updateThresholdRed(e.target.value, formData.threshold_yellow)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">
                    🟡 Sarı (Uyarı): değer &gt;= {formData.threshold_green} ve &lt; <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.threshold_yellow}
                    onChange={(e) => updateThresholdRed(formData.threshold_green, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">
                    🔴 Kırmızı (Alarm): değer &gt;= {formData.threshold_yellow}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.threshold_red}
                    onChange={(e) => setFormData({ ...formData, threshold_red: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-100"
                    disabled
                    placeholder="Otomatik (threshold_yellow)"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-gray-700 mb-1">
                    🟢 Yeşil (İyi): değer &gt; <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.threshold_green}
                    onChange={(e) => updateThresholdRed(e.target.value, formData.threshold_yellow)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">
                    🟡 Sarı (Uyarı): değer &lt;= {formData.threshold_green} ve &gt; <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.threshold_yellow}
                    onChange={(e) => updateThresholdRed(formData.threshold_green, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">
                    🔴 Kırmızı (Alarm): değer &lt;= {formData.threshold_yellow}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.threshold_red}
                    onChange={(e) => setFormData({ ...formData, threshold_red: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-100"
                    disabled
                    placeholder="Otomatik (threshold_yellow)"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sorumlu Birim
            </label>
            <select
              value={formData.responsible_department_id}
              onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seçiniz...</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Aktif</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={closeIndicatorModal}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
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

      <Modal
        isOpen={showHistoryModal}
        onClose={closeHistoryModal}
        title={selectedIndicator ? `${selectedIndicator.code} - ${selectedIndicator.name} - Geçmiş Değerler` : ''}
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {indicatorValues.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={[...indicatorValues].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedIndicator && (
                    <>
                      <ReferenceLine
                        y={selectedIndicator.threshold_yellow}
                        stroke="#fbbf24"
                        strokeDasharray="3 3"
                        label="Sarı Eşik"
                      />
                      <ReferenceLine
                        y={selectedIndicator.threshold_red}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label="Kırmızı Eşik"
                      />
                    </>
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Değer"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Değer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giren</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {indicatorValues.map(value => {
                  const statusInfo = statusConfig[value.status];
                  return (
                    <tr key={value.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{value.period}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {value.value} {selectedIndicator?.unit_of_measure}
                      </td>
                      <td className="px-4 py-3 text-2xl">{statusInfo.icon}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {value.recorded_by?.full_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(value.created_at).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {indicatorValues.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Henüz veri girilmemiş
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
