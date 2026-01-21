import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, CheckCircle, XCircle, Clock, Plus, CreditCard as Edit2, Trash2, Send } from 'lucide-react';
import { calculateIndicatorProgress } from '../utils/progressCalculations';

interface Indicator {
  id: string;
  code: string;
  name: string;
  unit: string;
  measurement_frequency: string;
  target_value: number | null;
  target_year: number | null;
  baseline_value: number | null;
  calculation_method?: string;
  calculation_notes?: string;
  goal?: {
    title: string;
    code: string;
    department_id: string;
  };
}

interface QuarterActivation {
  id: string;
  indicator_id: string;
  year: number;
  quarter: number;
  is_active: boolean;
}

interface DataEntry {
  id: string;
  indicator_id: string;
  value: number;
  entry_date: string;
  period_type: string;
  period_year: number;
  period_month: number | null;
  period_quarter: number | null;
  notes: string | null;
  status: string;
  indicator?: {
    code: string;
    name: string;
    unit: string;
  };
}

export default function DataEntry() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [activations, setActivations] = useState<QuarterActivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingEntry, setEditingEntry] = useState<{
    indicatorId: string;
    periodType: string;
    periodMonth: number | null;
    periodQuarter: number | null;
    value: string;
  } | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      let goalIds: string[] = [];

      if (profile.role === 'admin') {
        const allGoals = await supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile.organization_id);
        goalIds = allGoals.data?.map(g => g.id) || [];
      } else if (profile.department_id) {
        const goalsForDept = await supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('department_id', profile.department_id);
        goalIds = goalsForDept.data?.map(g => g.id) || [];
      }

      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          *,
          goals(
            title,
            code,
            department_id
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('code', { ascending: true });

      if (profile.role === 'admin') {
        // Admin tüm göstergeleri görür
      } else if (goalIds.length > 0) {
        indicatorsQuery = indicatorsQuery.in('goal_id', goalIds);
      } else {
        indicatorsQuery = indicatorsQuery.eq('goal_id', '00000000-0000-0000-0000-000000000000');
      }

      let entriesQuery = supabase
        .from('indicator_data_entries')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('entry_date', { ascending: false });

      const [indicatorsRes, entriesRes, activationsRes] = await Promise.all([
        indicatorsQuery,
        entriesQuery,
        supabase
          .from('quarter_activations')
          .select('*')
          .eq('organization_id', profile.organization_id)
      ]);

      if (indicatorsRes.error) throw indicatorsRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (activationsRes.error) throw activationsRes.error;

      const mappedIndicators = indicatorsRes.data?.map(ind => ({
        ...ind,
        goal: ind.goals ? {
          title: ind.goals.title,
          code: ind.goals.code,
          department_id: ind.goals.department_id
        } : undefined
      })) || [];

      console.log('Loaded indicators:', mappedIndicators.map(i => ({
        code: i.code,
        name: i.name,
        measurement_frequency: i.measurement_frequency
      })));

      setIndicators(mappedIndicators);

      console.log('Loaded entries from database:', entriesRes.data);
      if (entriesRes.data && entriesRes.data.length > 0) {
        console.log('Sample entry values:', entriesRes.data.slice(0, 3).map(e => ({
          id: e.id,
          value: e.value,
          valueType: typeof e.value
        })));
      }

      setEntries(entriesRes.data || []);
      setActivations(activationsRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodsForIndicator = (indicator: Indicator) => {
    const freq = indicator.measurement_frequency || 'quarterly';
    console.log(`Getting periods for ${indicator.code}: frequency="${freq}"`);

    switch (freq) {
      case 'monthly':
        return Array.from({ length: 12 }, (_, i) => ({
          value: i + 1,
          label: `Ay ${i + 1}`,
          periodType: 'monthly' as const,
          periodMonth: i + 1,
          periodQuarter: null
        }));
      case 'quarterly':
        return Array.from({ length: 4 }, (_, i) => ({
          value: i + 1,
          label: `Ç${i + 1}`,
          periodType: 'quarterly' as const,
          periodMonth: null,
          periodQuarter: i + 1
        }));
      case 'semi-annual':
      case 'semi_annual':
        return Array.from({ length: 2 }, (_, i) => ({
          value: i + 1,
          label: `Y${i + 1}`,
          periodType: 'semi-annual' as const,
          periodMonth: null,
          periodQuarter: i + 1
        }));
      case 'annual':
        return [{
          value: 1,
          label: 'Yıllık',
          periodType: 'annual' as const,
          periodMonth: null,
          periodQuarter: 1
        }];
      default:
        return Array.from({ length: 4 }, (_, i) => ({
          value: i + 1,
          label: `Ç${i + 1}`,
          periodType: 'quarterly' as const,
          periodMonth: null,
          periodQuarter: i + 1
        }));
    }
  };

  const getGridColsClass = (indicator: Indicator) => {
    const freq = indicator.measurement_frequency || 'quarterly';
    switch (freq) {
      case 'monthly': return 'grid-cols-6';
      case 'quarterly': return 'grid-cols-4';
      case 'semi-annual':
      case 'semi_annual': return 'grid-cols-2';
      case 'annual': return 'grid-cols-1';
      default: return 'grid-cols-4';
    }
  };

  const isPeriodActive = (indicatorId: string, year: number, periodValue: number) => {
    if (profile?.role === 'admin') return true;
    const activation = activations.find(
      a => a.indicator_id === indicatorId && a.year === year && a.quarter === periodValue
    );
    return activation?.is_active || false;
  };

  const getPeriodEntry = (indicatorId: string, year: number, periodType: string, periodMonth: number | null, periodQuarter: number | null) => {
    return entries.find(
      e => e.indicator_id === indicatorId &&
           e.period_year === year &&
           e.period_type === periodType &&
           (periodMonth ? e.period_month === periodMonth : true) &&
           (periodQuarter ? e.period_quarter === periodQuarter : true)
    );
  };

  const handleSaveEntry = async (
    indicatorId: string,
    periodType: string,
    periodMonth: number | null,
    periodQuarter: number | null,
    value: string
  ) => {
    console.log('=== KAYDETME BAŞLADI ===');
    console.log('1. Girilen değer:', value);
    console.log('2. Değer tipi:', typeof value);

    if (!value || value.trim() === '') {
      alert('Lütfen bir değer girin');
      return;
    }

    const trimmedValue = value.trim();
    console.log('3. Trim edilmiş değer:', trimmedValue);

    const normalizedValue = trimmedValue.replace(/,/g, '.');
    console.log('4. Virgül nokta yapıldı:', normalizedValue);

    const numValue = parseFloat(normalizedValue);
    console.log('5. ParseFloat sonucu:', numValue);
    console.log('6. ParseFloat tipi:', typeof numValue);

    if (isNaN(numValue)) {
      alert('Geçerli bir sayı girin');
      return;
    }

    console.log('7. Veritabanına kaydedilecek değer:', numValue);

    try {
      console.log('Saving entry:', { indicatorId, periodType, periodMonth, periodQuarter, value: numValue, year: selectedYear });

      let checkQuery = supabase
        .from('indicator_data_entries')
        .select('*')
        .eq('indicator_id', indicatorId)
        .eq('period_year', selectedYear)
        .eq('period_type', periodType);

      if (periodMonth !== null) {
        checkQuery = checkQuery.eq('period_month', periodMonth);
      }
      if (periodQuarter !== null) {
        checkQuery = checkQuery.eq('period_quarter', periodQuarter);
      }

      const checkResult = await checkQuery.maybeSingle();
      console.log('Existing entry check:', checkResult);

      const isAdmin = profile?.role === 'admin';
      const departmentId = profile?.department_id;

      const indicator = indicators.find(ind => ind.id === indicatorId);
      const indicatorDepartmentId = indicator?.goal?.department_id;

      if (!departmentId && !isAdmin) {
        alert('Departman bilginiz bulunamadı. Lütfen yöneticinizle iletişime geçin.');
        return;
      }

      const entryData: any = {
        indicator_id: indicatorId,
        organization_id: profile?.organization_id,
        department_id: isAdmin ? indicatorDepartmentId : departmentId,
        entered_by: profile?.id,
        value: numValue,
        entry_date: new Date().toISOString().split('T')[0],
        period_type: periodType,
        period_year: selectedYear,
        period_month: periodMonth,
        period_quarter: periodQuarter,
        status: isAdmin ? 'approved' : 'draft',
        ...(isAdmin && {
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          director_approved_by: profile?.id,
          director_approved_at: new Date().toISOString()
        })
      };

      let result;
      if (checkResult.data) {
        if (checkResult.data.status !== 'draft' && !isAdmin) {
          alert('Bu veri zaten onaylanmış, düzenlenemez');
          return;
        }
        console.log('Updating existing entry:', checkResult.data.id);

        const updateData: any = { value: numValue };
        if (isAdmin) {
          updateData.status = 'approved';
          updateData.reviewed_by = profile?.id;
          updateData.reviewed_at = new Date().toISOString();
        }

        result = await supabase
          .from('indicator_data_entries')
          .update(updateData)
          .eq('id', checkResult.data.id)
          .select()
          .single();

        if (result.error) throw result.error;
        setEntries(prev => prev.map(e => e.id === checkResult.data.id ? { ...e, ...updateData } : e));
      } else {
        console.log('Inserting new entry');
        result = await supabase
          .from('indicator_data_entries')
          .insert(entryData)
          .select()
          .single();

        if (result.error) throw result.error;
        setEntries(prev => [...prev, result.data]);
      }

      console.log('Save result:', result);
      console.log('Saved value (numeric):', numValue);
      console.log('Saved value (original input):', value);

      setEditingEntry(null);
      alert(`Veri başarıyla kaydedildi: ${numValue}`);
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      alert('Veri kaydedilemedi: ' + (error.message || JSON.stringify(error)));
    }
  };

  const handleSubmitEntry = async (entryId: string) => {
    if (!confirm('Bu veriyi onaya göndermek istediğinizden emin misiniz? Gönderilen veriler düzenlenemez.')) {
      return;
    }

    try {
      const isDirector = profile?.role === 'director';
      const newStatus = isDirector ? 'pending_admin' : 'pending_director';

      const updateData: any = { status: newStatus };

      if (isDirector) {
        updateData.director_approved_by = profile?.id;
        updateData.director_approved_at = new Date().toISOString();
      }

      console.log('=== SUBMIT ENTRY DEBUG ===');
      console.log('Entry ID:', entryId);
      console.log('User Role:', profile?.role);
      console.log('Is Director:', isDirector);
      console.log('New Status:', newStatus);
      console.log('Update Data:', JSON.stringify(updateData, null, 2));
      console.log('Status type:', typeof newStatus);
      console.log('Status value exact:', `"${newStatus}"`);

      const result = await supabase
        .from('indicator_data_entries')
        .update(updateData)
        .eq('id', entryId)
        .select()
        .maybeSingle();

      console.log('Result:', result);

      if (result.error) {
        console.error('Submit error details:', JSON.stringify(result.error, null, 2));
        console.error('Error message:', result.error.message);
        console.error('Error code:', result.error.code);
        console.error('Error details:', result.error.details);
        throw result.error;
      }

      if (!result.data) {
        console.error('UPDATE FAILED: No data returned. This usually means RLS blocked the update.');
        throw new Error('Veri güncellenemedi. Yetki sorunu olabilir. Lütfen yöneticinizle iletişime geçin.');
      }

      console.log('✅ Update successful, new status:', result.data.status);

      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...updateData } : e));

      if (isDirector) {
        alert('Veri yönetici onayına gönderildi');
      } else {
        alert('Veri müdür onayına gönderildi');
      }
    } catch (error: any) {
      console.error('Gönderim hatası:', error);
      alert('Gönderim başarısız: ' + (error.message || JSON.stringify(error)));
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry && entry.status !== 'draft' && profile?.role !== 'admin') {
      alert('Sadece taslak veriler silinebilir. Bu veri onaylanmış.');
      return;
    }

    if (!confirm('Bu veriyi silmek istediğinizden emin misiniz?')) return;

    try {
      console.log('Deleting entry:', entryId);
      const { error } = await supabase
        .from('indicator_data_entries')
        .delete()
        .eq('id', entryId);

      console.log('Delete result:', error);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== entryId));
      alert('Veri başarıyla silindi');
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme başarısız: ' + (error.message || JSON.stringify(error)));
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any; color: string; text: string }> = {
      draft: { icon: Clock, color: 'bg-slate-100 text-slate-700', text: 'Taslak' },
      pending_director: { icon: Clock, color: 'bg-yellow-100 text-yellow-700', text: 'Müdür Onayında' },
      pending_admin: { icon: Clock, color: 'bg-blue-100 text-blue-700', text: 'Yönetici Onayında' },
      approved: { icon: CheckCircle, color: 'bg-green-100 text-green-700', text: 'Onaylandı' },
      rejected: { icon: XCircle, color: 'bg-red-100 text-red-700', text: 'Reddedildi' }
    };
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  const calculateCurrentValue = (indicator: Indicator) => {
    const indicatorEntries = entries.filter(
      e => e.indicator_id === indicator.id &&
           e.period_year === selectedYear &&
           e.status === 'approved'
    );

    if (indicatorEntries.length === 0) return 0;

    const calcMethod = indicator.calculation_method || 'cumulative_increasing';
    const baselineValue = indicator.baseline_value || 0;
    const sumOfEntries = indicatorEntries.reduce((acc, e) => acc + (e.value || 0), 0);

    switch (calcMethod) {
      case 'cumulative':
      case 'cumulative_increasing':
      case 'increasing':
        return baselineValue + sumOfEntries;

      case 'cumulative_decreasing':
      case 'decreasing':
        return baselineValue - sumOfEntries;

      case 'percentage_increasing':
      case 'percentage_decreasing':
      case 'percentage':
        return sumOfEntries;

      case 'maintenance_increasing':
      case 'maintenance_decreasing':
      case 'maintenance':
        return sumOfEntries;

      default:
        return baselineValue + sumOfEntries;
    }
  };

  const calculateProgress = (indicator: Indicator) => {
    const dataEntriesForIndicator = entries
      .filter(e => e.indicator_id === indicator.id && e.period_year === selectedYear)
      .map(e => ({
        indicator_id: e.indicator_id,
        value: e.value,
        status: e.status
      }));

    return calculateIndicatorProgress(
      {
        ...indicator,
        yearly_target: indicator.target_value,
        current_value: calculateCurrentValue(indicator)
      },
      dataEntriesForIndicator
    );
  };

  const getLatestEntryLabel = (indicator: Indicator) => {
    const indicatorEntries = entries.filter(
      e => e.indicator_id === indicator.id &&
           e.period_year === selectedYear &&
           e.status === 'approved'
    );

    if (indicatorEntries.length === 0) return '';

    const sortedEntries = [...indicatorEntries].sort((a, b) => {
      if (a.period_month && b.period_month) return b.period_month - a.period_month;
      if (a.period_quarter && b.period_quarter) return b.period_quarter - a.period_quarter;
      return 0;
    });

    const lastEntry = sortedEntries[0];
    if (lastEntry.period_month) return `Ay${lastEntry.period_month}`;
    if (lastEntry.period_quarter) return `Ç${lastEntry.period_quarter}`;
    return '';
  };

  const filteredIndicators = indicators.filter(indicator =>
    indicator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    indicator.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Veri Girişi</h1>
        <p className="text-gray-600 mt-1">
          Performans göstergelerinize dönemsel veri girin (ölçüm sıklığına göre aylık, çeyreklik, 6 aylık veya yıllık)
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Gösterge ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {filteredIndicators.map((indicator) => {
          const currentValue = calculateCurrentValue(indicator);
          const progress = calculateProgress(indicator);
          const latestLabel = getLatestEntryLabel(indicator);

          return (
            <div key={indicator.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {indicator.code}
                    </span>
                    <h3 className="font-medium text-gray-900 mt-2">{indicator.name}</h3>
                    {indicator.goal && (
                      <p className="text-sm text-gray-600 mt-1">{indicator.goal.title}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">Hedef ({indicator.target_year || selectedYear}):</span> {indicator.target_value?.toLocaleString('tr-TR') || '-'} {indicator.unit}
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">Başlangıç:</span> {indicator.baseline_value?.toLocaleString('tr-TR') || '-'} {indicator.unit}
                    </div>
                   <div className="text-sm text-slate-700">
  <span className="font-medium">Güncel:</span> {currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {indicator.unit} {getCurrentValueLabel(indicator) && `(${getCurrentValueLabel(indicator)})`}
</div>
                    <div className={`text-sm font-semibold ${
                      progress >= 70 ? 'text-green-600' : progress >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      İlerleme: %{progress.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`grid ${getGridColsClass(indicator)} gap-3`}>
              {getPeriodsForIndicator(indicator).map((period) => {
                const entry = getPeriodEntry(indicator.id, selectedYear, period.periodType, period.periodMonth, period.periodQuarter);
                const isActive = isPeriodActive(indicator.id, selectedYear, period.value);
                const isEditing = editingEntry?.indicatorId === indicator.id &&
                  editingEntry?.periodType === period.periodType &&
                  editingEntry?.periodMonth === period.periodMonth &&
                  editingEntry?.periodQuarter === period.periodQuarter;

                return (
                  <div
                    key={`${period.periodType}-${period.value}`}
                    className={`p-3 rounded-lg border-2 ${
                      entry ? 'border-green-300 bg-green-50' :
                      isActive ? 'border-blue-300 bg-blue-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      {period.label}
                      {!isActive && profile?.role !== 'admin' && (
                        <span className="ml-1 text-red-500">(Kapalı)</span>
                      )}
                    </div>

                    {entry ? (
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {typeof entry.value === 'number'
                            ? entry.value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 10 })
                            : entry.value}
                        </div>
                        <div className="text-xs text-gray-600">{indicator.unit}</div>
                        <div className="mt-2">
                          {getStatusBadge(entry.status)}
                        </div>
                        {(entry.status === 'draft' || profile?.role === 'admin') && (
                          <div className="mt-3 flex gap-1">
                            <button
                              onClick={() => {
                                const valueStr = typeof entry.value === 'number'
                                  ? entry.value.toString().replace('.', ',')
                                  : entry.value.toString();
                                setEditingEntry({
                                  indicatorId: indicator.id,
                                  periodType: period.periodType,
                                  periodMonth: period.periodMonth,
                                  periodQuarter: period.periodQuarter,
                                  value: valueStr
                                });
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              <Edit2 className="w-3 h-3" />
                              Düzenle
                            </button>
                            {entry.status === 'draft' && profile?.role !== 'admin' && (
                              <button
                                onClick={() => handleSubmitEntry(entry.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                <Send className="w-3 h-3" />
                                Gönder
                              </button>
                            )}
                            {(entry.status === 'draft' || profile?.role === 'admin') && (
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="flex items-center justify-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : isEditing ? (
                      <div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingEntry.value}
                          onChange={(e) => setEditingEntry({ ...editingEntry, value: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                          placeholder="Değer (ör: 0,72 veya 0.72)"
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveEntry(
                              indicator.id,
                              period.periodType,
                              period.periodMonth,
                              period.periodQuarter,
                              editingEntry.value
                            )}
                            className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Kaydet
                          </button>
                          <button
                            onClick={() => setEditingEntry(null)}
                            className="flex-1 px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    ) : isActive || profile?.role === 'admin' ? (
                      <button
                        onClick={() => setEditingEntry({
                          indicatorId: indicator.id,
                          periodType: period.periodType,
                          periodMonth: period.periodMonth,
                          periodQuarter: period.periodQuarter,
                          value: ''
                        })}
                        className="w-full flex items-center justify-center gap-1 px-2 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        <Plus className="w-3 h-3" />
                        Veri Ekle
                      </button>
                    ) : (
                      <div className="text-center text-gray-400 text-sm py-2">
                        Kapalı
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          );
        })}
      </div>

      {filteredIndicators.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">Gösterge bulunamadı</p>
        </div>
      )}
    </div>
  );
}
