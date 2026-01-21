import { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, AlertCircle, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Indicator {
  id: string;
  code: string;
  name: string;
  department: string;
  goal: string;
  targetValue: number;
  unit: string;
  q1Actual: number | null;
  q2Actual: number | null;
  q3Actual: number | null;
  q4Actual: number | null;
  yearActual: number | null;
  achievement: number;
  deviation: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'danger' | 'pending';
  lastUpdated: string | null;
}

type SortField = 'code' | 'name' | 'department' | 'achievement' | 'deviation';
type SortDirection = 'asc' | 'desc';

export default function IndicatorPerformanceMatrix() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [filteredIndicators, setFilteredIndicators] = useState<Indicator[]>([]);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('achievement');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [showTrendModal, setShowTrendModal] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, [profile]);

  useEffect(() => {
    loadIndicators();
  }, [selectedYear, profile]);

  useEffect(() => {
    filterAndSortIndicators();
  }, [indicators, searchTerm, selectedDepartment, selectedStatus, sortField, sortDirection]);

  const loadDepartments = async () => {
    if (!profile?.organization_id) return;

    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', user.organizationId)
      .order('name');

    setDepartments(data || []);
  };

  const loadIndicators = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      const { data: goals } = await supabase
        .from('goals')
        .select(`
          id,
          name,
          fiscal_year,
          department:departments(id, name),
          indicators(
            id,
            code,
            name,
            target_value,
            unit
          )
        `)
        .eq('organization_id', user.organizationId)
        .eq('fiscal_year', selectedYear);

      if (!goals) return;

      const indicatorsList: Indicator[] = [];

      for (const goal of goals) {
        if (!goal.indicators) continue;

        for (const indicator of goal.indicators) {
          const entries: any = { q1: null, q2: null, q3: null, q4: null, year: null };
          let lastUpdated: string | null = null;

          for (let q = 1; q <= 4; q++) {
            const { data } = await supabase
              .from('indicator_data_entries')
              .select('value, updated_at')
              .eq('indicator_id', indicator.id)
              .eq('year', selectedYear)
              .eq('period_type', 'quarterly')
              .eq('quarter', q)
              .eq('status', 'approved')
              .maybeSingle();

            if (data) {
              entries[`q${q}`] = data.value;
              if (!lastUpdated || new Date(data.updated_at) > new Date(lastUpdated)) {
                lastUpdated = data.updated_at;
              }
            }
          }

          const { data: yearData } = await supabase
            .from('indicator_data_entries')
            .select('value, updated_at')
            .eq('indicator_id', indicator.id)
            .eq('year', selectedYear)
            .eq('period_type', 'yearly')
            .eq('status', 'approved')
            .maybeSingle();

          if (yearData) {
            entries.year = yearData.value;
            if (!lastUpdated || new Date(yearData.updated_at) > new Date(lastUpdated)) {
              lastUpdated = yearData.updated_at;
            }
          }

          const latestValue = entries.year || entries.q4 || entries.q3 || entries.q2 || entries.q1;
          const targetValue = (indicator.target_value !== null && indicator.target_value !== undefined) ? indicator.target_value : 1;
          const achievement = latestValue !== null && targetValue !== 0 ? (latestValue / targetValue) * 100 : 0;
          const deviation = latestValue !== null ? latestValue - targetValue : 0;

          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (entries.q4 && entries.q3) {
            if (entries.q4 > entries.q3) trend = 'up';
            else if (entries.q4 < entries.q3) trend = 'down';
          } else if (entries.q3 && entries.q2) {
            if (entries.q3 > entries.q2) trend = 'up';
            else if (entries.q3 < entries.q2) trend = 'down';
          }

          let status: 'good' | 'warning' | 'danger' | 'pending' = 'pending';
          if (latestValue !== null) {
            if (achievement >= 80) status = 'good';
            else if (achievement >= 60) status = 'warning';
            else status = 'danger';
          }

          indicatorsList.push({
            id: indicator.id,
            code: indicator.code || '-',
            name: indicator.name,
            department: goal.department?.name || 'Belirsiz',
            goal: goal.name,
            targetValue: targetValue,
            unit: indicator.unit || '',
            q1Actual: entries.q1,
            q2Actual: entries.q2,
            q3Actual: entries.q3,
            q4Actual: entries.q4,
            yearActual: entries.year,
            achievement: Math.round(achievement),
            deviation: Math.round(deviation),
            trend,
            status,
            lastUpdated
          });
        }
      }

      setIndicators(indicatorsList);
    } catch (error) {
      console.error('Error loading indicators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortIndicators = () => {
    let filtered = [...indicators];

    if (searchTerm) {
      filtered = filtered.filter(ind =>
        ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ind.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(ind => ind.department === selectedDepartment);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(ind => ind.status === selectedStatus);
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredIndicators(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const showTrend = (indicator: Indicator) => {
    setSelectedIndicator(indicator);
    setShowTrendModal(true);
  };

  const getTrendData = (indicator: Indicator) => {
    return [
      { period: 'Ç1', value: indicator.q1Actual || 0, target: indicator.targetValue },
      { period: 'Ç2', value: indicator.q2Actual || 0, target: indicator.targetValue },
      { period: 'Ç3', value: indicator.q3Actual || 0, target: indicator.targetValue },
      { period: 'Ç4', value: indicator.q4Actual || 0, target: indicator.targetValue }
    ];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'danger': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'good': return 'İyi';
      case 'warning': return 'Orta';
      case 'danger': return 'Düşük';
      case 'pending': return 'Bekliyor';
      default: return 'Belirsiz';
    }
  };

  const pendingCount = indicators.filter(i => i.status === 'pending').length;
  const goodCount = indicators.filter(i => i.status === 'good').length;
  const warningCount = indicators.filter(i => i.status === 'warning').length;
  const dangerCount = indicators.filter(i => i.status === 'danger').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Göstergeler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Toplam Gösterge</div>
          <div className="text-2xl font-bold text-gray-900">{indicators.length}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-700 mb-1">İyi Performans</div>
          <div className="text-2xl font-bold text-green-900">{goodCount}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-700 mb-1">Orta Performans</div>
          <div className="text-2xl font-bold text-yellow-900">{warningCount}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-700 mb-1">Düşük Performans</div>
          <div className="text-2xl font-bold text-red-900">{dangerCount}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mali Yıl</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Müdürlük</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tümü</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tümü</option>
              <option value="good">İyi</option>
              <option value="warning">Orta</option>
              <option value="danger">Düşük</option>
              <option value="pending">Bekliyor</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Arama</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Gösterge adı veya kodu ara..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('code')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Kod
                    {sortField === 'code' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Gösterge
                    {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('department')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Müdürlük
                    {sortField === 'department' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hedef</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç1</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç2</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç3</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ç4</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Yıl</th>
                <th
                  onClick={() => handleSort('achievement')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-center gap-1">
                    Başarı %
                    {sortField === 'achievement' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('deviation')}
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-center gap-1">
                    Sapma
                    {sortField === 'deviation' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIndicators.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                    {indicator.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={indicator.name}>{indicator.name}</div>
                    <div className="text-xs text-gray-500 truncate">{indicator.goal}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {indicator.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-medium">
                    {indicator.targetValue} {indicator.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                    {indicator.q1Actual !== null ? `${indicator.q1Actual} ${indicator.unit}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                    {indicator.q2Actual !== null ? `${indicator.q2Actual} ${indicator.unit}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                    {indicator.q3Actual !== null ? `${indicator.q3Actual} ${indicator.unit}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                    {indicator.q4Actual !== null ? `${indicator.q4Actual} ${indicator.unit}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-bold">
                    {indicator.yearActual !== null ? `${indicator.yearActual} ${indicator.unit}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className={`px-2 py-1 font-bold rounded ${
                      indicator.achievement >= 80 ? 'text-green-700' :
                      indicator.achievement >= 60 ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {indicator.achievement}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className={indicator.deviation >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {indicator.deviation > 0 ? '+' : ''}{indicator.deviation}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {indicator.trend === 'up' && <TrendingUp className="w-5 h-5 text-green-600 mx-auto" />}
                    {indicator.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-600 mx-auto" />}
                    {indicator.trend === 'stable' && <div className="w-5 h-0.5 bg-gray-400 mx-auto" />}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(indicator.status)}`}>
                      {getStatusText(indicator.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => showTrend(indicator)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Trend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showTrendModal && selectedIndicator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedIndicator.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedIndicator.code}</p>
                </div>
                <button
                  onClick={() => setShowTrendModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={getTrendData(selectedIndicator)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Gerçekleşen" />
                  <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Hedef" />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-700 mb-1">Hedef Değer</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {selectedIndicator.targetValue} {selectedIndicator.unit}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-700 mb-1">Son Gerçekleşen</div>
                  <div className="text-2xl font-bold text-green-900">
                    {selectedIndicator.yearActual || selectedIndicator.q4Actual || '-'} {selectedIndicator.unit}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-purple-700 mb-1">Başarı Oranı</div>
                  <div className="text-2xl font-bold text-purple-900">{selectedIndicator.achievement}%</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-sm text-orange-700 mb-1">Sapma</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {selectedIndicator.deviation > 0 ? '+' : ''}{selectedIndicator.deviation}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredIndicators.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Seçili filtrelere uygun gösterge bulunamadı.</p>
        </div>
      )}
    </div>
  );
}
