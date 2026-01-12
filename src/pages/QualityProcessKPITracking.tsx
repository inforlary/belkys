import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  TrendingUp, TrendingDown, AlertCircle, FileText,
  Plus, Download, X, BarChart3, History, AlertTriangle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface KPIData {
  id: string;
  kpi_id: string;
  process_code: string;
  process_name: string;
  kpi_name: string;
  unit: string;
  target_value: number | null;
  actual_value: number | null;
  direction: 'UP' | 'DOWN';
  status: 'GOOD' | 'BAD' | 'NO_DATA';
  variance: number | null;
  notes: string | null;
}

interface Process {
  id: string;
  code: string;
  name: string;
}

interface HistoryValue {
  period_year: number;
  period_month: number;
  value: number;
  notes: string | null;
  entered_by: string | null;
  entered_at: string;
}

export default function QualityProcessKPITracking() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedProcess, setSelectedProcess] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showValueModal, setShowValueModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDOFModal, setShowDOFModal] = useState(false);

  const [editingKPI, setEditingKPI] = useState<KPIData | null>(null);
  const [valueInput, setValueInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [historyData, setHistoryData] = useState<HistoryValue[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id, selectedYear, selectedMonth, selectedProcess]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadKPIData(), loadProcesses()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIData = async () => {
    const { data, error } = await supabase.rpc('get_kpi_tracking_data', {
      org_id: profile?.organization_id,
      year: selectedYear,
      month: selectedMonth,
      process_filter: selectedProcess === 'all' ? null : selectedProcess
    });

    if (error) {
      console.error('Error loading KPI data:', error);
      const fallbackData = await loadKPIDataFallback();
      setKpiData(fallbackData || []);
    } else {
      setKpiData(data || []);
    }
  };

  const loadKPIDataFallback = async () => {
    let query = supabase
      .from('qm_process_kpis')
      .select(`
        id,
        name,
        unit,
        target_value,
        direction,
        process:qm_processes!inner(id, code, name)
      `)
      .eq('is_active', true)
      .eq('qm_processes.organization_id', profile?.organization_id);

    if (selectedProcess !== 'all') {
      query = query.eq('process_id', selectedProcess);
    }

    const { data: kpis, error: kpisError } = await query;
    if (kpisError) throw kpisError;

    const kpiIds = kpis?.map(k => k.id) || [];
    const { data: values } = await supabase
      .from('qm_process_kpi_values')
      .select('kpi_id, value, notes')
      .in('kpi_id', kpiIds)
      .eq('period_year', selectedYear)
      .eq('period_month', selectedMonth);

    const valueMap = new Map(values?.map(v => [v.kpi_id, v]) || []);

    return kpis?.map(kpi => {
      const value = valueMap.get(kpi.id);
      const actualValue = value?.value || null;
      const targetValue = kpi.target_value;

      let status: 'GOOD' | 'BAD' | 'NO_DATA' = 'NO_DATA';
      let variance: number | null = null;

      if (actualValue !== null && targetValue !== null) {
        if (kpi.direction === 'UP') {
          status = actualValue >= targetValue ? 'GOOD' : 'BAD';
          variance = actualValue - targetValue;
        } else {
          status = actualValue <= targetValue ? 'GOOD' : 'BAD';
          variance = targetValue - actualValue;
        }
      }

      return {
        id: kpi.id,
        kpi_id: kpi.id,
        process_code: kpi.process.code,
        process_name: kpi.process.name,
        kpi_name: kpi.name,
        unit: kpi.unit || '',
        target_value: targetValue,
        actual_value: actualValue,
        direction: kpi.direction,
        status,
        variance,
        notes: value?.notes || null
      };
    }) || [];
  };

  const loadProcesses = async () => {
    const { data, error } = await supabase
      .from('qm_processes')
      .select('id, code, name')
      .eq('organization_id', profile?.organization_id)
      .eq('status', 'ACTIVE')
      .order('code');

    if (error) throw error;
    setProcesses(data || []);
  };

  const handleOpenValueModal = (kpi: KPIData) => {
    setEditingKPI(kpi);
    setValueInput(kpi.actual_value?.toString() || '');
    setNotesInput(kpi.notes || '');
    setShowValueModal(true);
  };

  const handleSaveValue = async () => {
    if (!editingKPI || !valueInput) {
      alert('Lütfen değer girin');
      return;
    }

    try {
      const { error } = await supabase
        .from('qm_process_kpi_values')
        .upsert({
          kpi_id: editingKPI.kpi_id,
          period_year: selectedYear,
          period_month: selectedMonth,
          period_quarter: Math.ceil(selectedMonth / 3),
          value: parseFloat(valueInput),
          notes: notesInput || null,
          entered_by: profile?.id,
          entered_at: new Date().toISOString()
        }, {
          onConflict: 'kpi_id,period_year,period_month'
        });

      if (error) throw error;
      alert('KPI değeri kaydedildi');
      setShowValueModal(false);
      loadKPIData();
    } catch (error: any) {
      console.error('Error saving value:', error);
      alert('Kaydetme sırasında hata oluştu: ' + error.message);
    }
  };

  const handleOpenBulkModal = () => {
    const initialValues: Record<string, string> = {};
    kpiData.forEach(kpi => {
      if (kpi.actual_value !== null) {
        initialValues[kpi.kpi_id] = kpi.actual_value.toString();
      }
    });
    setBulkValues(initialValues);
    setShowBulkModal(true);
  };

  const handleSaveBulk = async () => {
    const entries = Object.entries(bulkValues)
      .filter(([_, value]) => value.trim() !== '')
      .map(([kpiId, value]) => ({
        kpi_id: kpiId,
        period_year: selectedYear,
        period_month: selectedMonth,
        period_quarter: Math.ceil(selectedMonth / 3),
        value: parseFloat(value),
        entered_by: profile?.id,
        entered_at: new Date().toISOString()
      }));

    if (entries.length === 0) {
      alert('Lütfen en az bir değer girin');
      return;
    }

    try {
      const { error } = await supabase
        .from('qm_process_kpi_values')
        .upsert(entries, {
          onConflict: 'kpi_id,period_year,period_month'
        });

      if (error) throw error;
      alert(`${entries.length} KPI değeri kaydedildi`);
      setShowBulkModal(false);
      loadKPIData();
    } catch (error: any) {
      console.error('Error saving bulk values:', error);
      alert('Kaydetme sırasında hata oluştu: ' + error.message);
    }
  };

  const handleOpenHistory = async (kpi: KPIData) => {
    setEditingKPI(kpi);

    const { data, error } = await supabase
      .from('qm_process_kpi_values')
      .select(`
        period_year,
        period_month,
        value,
        notes,
        entered_at,
        entered_by:profiles(full_name)
      `)
      .eq('kpi_id', kpi.kpi_id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Error loading history:', error);
      setHistoryData([]);
    } else {
      setHistoryData(data?.map(d => ({
        ...d,
        entered_by: d.entered_by?.full_name || null
      })) || []);
    }

    setShowHistoryModal(true);
  };

  const handleCreateDOF = async (kpi: KPIData) => {
    setEditingKPI(kpi);
    setShowDOFModal(true);
  };

  const confirmCreateDOF = async () => {
    if (!editingKPI) return;

    try {
      const { data: process } = await supabase
        .from('qm_processes')
        .select('id')
        .eq('code', editingKPI.process_code)
        .single();

      const description = `KPI Hedef Altı Performans
Süreç: ${editingKPI.process_code} - ${editingKPI.process_name}
KPI: ${editingKPI.kpi_name}
Dönem: ${monthNames[selectedMonth - 1]} ${selectedYear}
Hedef: ${editingKPI.target_value} ${editingKPI.unit}
Gerçekleşen: ${editingKPI.actual_value} ${editingKPI.unit}
Sapma: ${editingKPI.variance} ${editingKPI.unit}`;

      const { error } = await supabase
        .from('qm_nonconformities')
        .insert({
          organization_id: profile?.organization_id,
          title: `KPI Hedef Altı: ${editingKPI.kpi_name}`,
          description,
          source: 'PROCESS_KPI',
          source_reference: `${editingKPI.process_code} - ${monthNames[selectedMonth - 1]} ${selectedYear}`,
          process_id: process?.id || null,
          department_id: profile?.department_id || null,
          detected_date: new Date().toISOString().split('T')[0],
          status: 'OPEN',
          severity: 'MEDIUM',
          created_by: profile?.id
        });

      if (error) throw error;
      alert('DÖF oluşturuldu');
      setShowDOFModal(false);
    } catch (error: any) {
      console.error('Error creating DOF:', error);
      alert('DÖF oluşturulurken hata oluştu: ' + error.message);
    }
  };

  const filteredData = kpiData.filter(kpi => {
    const matchesSearch = kpi.kpi_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kpi.process_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || kpi.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const summary = {
    total: filteredData.length,
    good: filteredData.filter(k => k.status === 'GOOD').length,
    bad: filteredData.filter(k => k.status === 'BAD').length,
    noData: filteredData.filter(k => k.status === 'NO_DATA').length
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'GOOD': return '🟢';
      case 'BAD': return '🔴';
      default: return '⚪';
    }
  };

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Süreç KPI Takip</h1>
          <p className="mt-2 text-gray-600">Süreç performans göstergelerinin izlenmesi</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Excel İndir
          </button>
          <button className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            PDF İndir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">TOPLAM KPI</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{summary.total}</p>
              <p className="text-sm text-gray-500 mt-1">Aktif gösterge</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">HEDEF ÜSTÜ</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{summary.good}</p>
              <p className="text-sm text-gray-500 mt-1">
                🟢 {summary.total > 0 ? Math.round((summary.good / summary.total) * 100) : 0}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">HEDEF ALTI</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{summary.bad}</p>
              <p className="text-sm text-gray-500 mt-1">
                🔴 {summary.total > 0 ? Math.round((summary.bad / summary.total) * 100) : 0}%
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">VERİ GİRİLMEMİŞ</p>
              <p className="text-3xl font-bold text-gray-600 mt-2">{summary.noData}</p>
              <p className="text-sm text-gray-500 mt-1">
                ⚪ {summary.total > 0 ? Math.round((summary.noData / summary.total) * 100) : 0}%
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Yıl</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {[currentYear, currentYear - 1, currentYear - 2].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ay</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {monthNames.map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Süreç</label>
            <select
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tümü</option>
              {processes.map(proc => (
                <option key={proc.id} value={proc.id}>{proc.code} - {proc.name}</option>
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
              <option value="GOOD">Hedef Üstü 🟢</option>
              <option value="BAD">Hedef Altı 🔴</option>
              <option value="NO_DATA">Veri Girilmemiş ⚪</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="KPI ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleOpenBulkModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Toplu Değer Girişi
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SÜREÇ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KPI ADI
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  BİRİM
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  HEDEF
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GERÇ.
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SAPMA
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DURUM
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İŞLEM
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    KPI bulunamadı
                  </td>
                </tr>
              ) : (
                filteredData.map((kpi) => (
                  <tr key={kpi.kpi_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{kpi.process_code}</div>
                      <div className="text-gray-500 text-xs">{kpi.process_name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {kpi.kpi_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-center">
                      {kpi.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center font-medium">
                      {kpi.target_value !== null ? kpi.target_value : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center font-medium">
                      {kpi.actual_value !== null ? kpi.actual_value : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {kpi.variance !== null ? (
                        <span className={kpi.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {kpi.variance > 0 ? '+' : ''}{kpi.variance.toFixed(2)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center text-lg">
                      {getStatusIcon(kpi.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenValueModal(kpi)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Değer Gir"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenHistory(kpi)}
                          className="text-gray-600 hover:text-gray-700"
                          title="Geçmiş Göster"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {kpi.status === 'BAD' && (
                          <button
                            onClick={() => handleCreateDOF(kpi)}
                            className="text-red-600 hover:text-red-700"
                            title="DÖF Oluştur"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showValueModal && editingKPI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">KPI Değer Girişi</h2>
              <button onClick={() => setShowValueModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm space-y-2">
                <div><span className="font-medium">Süreç:</span> {editingKPI.process_code} - {editingKPI.process_name}</div>
                <div><span className="font-medium">KPI:</span> {editingKPI.kpi_name}</div>
                <div><span className="font-medium">Dönem:</span> {monthNames[selectedMonth - 1]} {selectedYear}</div>
                <div><span className="font-medium">Hedef:</span> {editingKPI.target_value} {editingKPI.unit}</div>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gerçekleşen Değer <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Değer girin"
                />
              </div>

              {valueInput && editingKPI.target_value !== null && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium">
                    Durum: {' '}
                    {((editingKPI.direction === 'UP' && parseFloat(valueInput) >= editingKPI.target_value) ||
                      (editingKPI.direction === 'DOWN' && parseFloat(valueInput) <= editingKPI.target_value))
                      ? <span className="text-green-600">🟢 Hedef Üstü (+{Math.abs(parseFloat(valueInput) - editingKPI.target_value).toFixed(2)})</span>
                      : <span className="text-red-600">🔴 Hedef Altı ({(parseFloat(valueInput) - editingKPI.target_value).toFixed(2)})</span>
                    }
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama / Not
                </label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Opsiyonel açıklama"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowValueModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveValue}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Toplu KPI Değer Girişi - {monthNames[selectedMonth - 1]} {selectedYear}
              </h2>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {processes.map(process => {
                  const processKPIs = kpiData.filter(k => k.process_code === process.code);
                  if (processKPIs.length === 0) return null;

                  return (
                    <div key={process.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">
                        {process.code} - {process.name}
                      </h3>
                      <div className="space-y-2">
                        {processKPIs.map(kpi => (
                          <div key={kpi.kpi_id} className="grid grid-cols-12 gap-3 items-center text-sm">
                            <div className="col-span-5 text-gray-700">{kpi.kpi_name}</div>
                            <div className="col-span-2 text-center text-gray-600">{kpi.target_value}</div>
                            <div className="col-span-2 text-center text-gray-600">{kpi.unit}</div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                step="0.01"
                                value={bulkValues[kpi.kpi_id] || ''}
                                onChange={(e) => setBulkValues({ ...bulkValues, [kpi.kpi_id]: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="Değer"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 text-sm text-gray-600">
                Girilen: {Object.values(bulkValues).filter(v => v.trim() !== '').length} / {kpiData.length}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveBulk}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Tümünü Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && editingKPI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">KPI Geçmiş Değerler</h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Süreç:</span> {editingKPI.process_code} - {editingKPI.process_name}</div>
                <div><span className="font-medium">KPI:</span> {editingKPI.kpi_name}</div>
                <div><span className="font-medium">Hedef:</span> {editingKPI.target_value} {editingKPI.unit}</div>
              </div>

              {historyData.length > 0 && (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Trend Grafiği (Son 12 Ay)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={historyData.reverse()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey={(d) => `${monthNames[d.period_month - 1].substring(0, 3)}`}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis style={{ fontSize: '12px' }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          dot={{ fill: '#3B82F6' }}
                        />
                        {editingKPI.target_value !== null && (
                          <Line
                            type="monotone"
                            dataKey={() => editingKPI.target_value}
                            stroke="#EF4444"
                            strokeDasharray="5 5"
                            dot={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Değer Tablosu</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gerçekleşen</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sapma</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giren</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historyData.reverse().map((item, idx) => {
                            const variance = editingKPI.target_value !== null
                              ? (editingKPI.direction === 'UP'
                                  ? item.value - editingKPI.target_value
                                  : editingKPI.target_value - item.value)
                              : null;
                            const status = editingKPI.target_value !== null
                              ? ((editingKPI.direction === 'UP' && item.value >= editingKPI.target_value) ||
                                 (editingKPI.direction === 'DOWN' && item.value <= editingKPI.target_value)
                                  ? 'GOOD' : 'BAD')
                              : 'NO_DATA';

                            return (
                              <tr key={idx}>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {monthNames[item.period_month - 1]} {item.period_year}
                                </td>
                                <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">
                                  {item.value} {editingKPI.unit}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  {variance !== null ? (
                                    <span className={variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-center text-lg">
                                  {getStatusIcon(status)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.entered_by || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Ortalama:</span> {' '}
                      {(historyData.reduce((sum, d) => sum + d.value, 0) / historyData.length).toFixed(2)} {editingKPI.unit}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Hedef Tutturma:</span> {' '}
                      {historyData.filter(d => {
                        if (editingKPI.target_value === null) return false;
                        return editingKPI.direction === 'UP'
                          ? d.value >= editingKPI.target_value
                          : d.value <= editingKPI.target_value;
                      }).length} / {historyData.length} ay
                    </div>
                  </div>
                </>
              )}

              {historyData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Henüz geçmiş veri bulunmuyor
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end border-t">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {showDOFModal && editingKPI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">DÖF Oluştur</h2>
              <button onClick={() => setShowDOFModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  Bu KPI hedefin altında kaldı. DÖF açmak ister misiniz?
                </p>
              </div>

              <div className="text-sm space-y-2">
                <div><span className="font-medium">Süreç:</span> {editingKPI.process_code} - {editingKPI.process_name}</div>
                <div><span className="font-medium">KPI:</span> {editingKPI.kpi_name}</div>
                <div><span className="font-medium">Dönem:</span> {monthNames[selectedMonth - 1]} {selectedYear}</div>
                <div><span className="font-medium">Hedef:</span> {editingKPI.target_value} {editingKPI.unit}</div>
                <div><span className="font-medium">Gerçekleşen:</span> {editingKPI.actual_value} {editingKPI.unit}</div>
                <div><span className="font-medium">Sapma:</span> {editingKPI.variance} {editingKPI.unit}</div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">DÖF otomatik oluşturulacak:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Kaynak: Süreç Performans Sapması</li>
                  <li>Uygunsuzluk: KPI hedef altı - otomatik doldurulur</li>
                  <li>İlişkili Süreç: {editingKPI.process_code}</li>
                </ul>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowDOFModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={confirmCreateDOF}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                DÖF Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
