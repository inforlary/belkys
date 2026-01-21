import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, ChevronDown, ChevronRight, CreditCard as Edit2, Trash2, Plus, CheckCircle, Clock, XCircle, Send, X, FileSpreadsheet, FileText } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { calculateIndicatorProgress } from '../utils/progressCalculations';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Objective {
  id: string;
  code: string;
  title: string;
  goals: Goal[];
}

interface Goal {
  id: string;
  code: string;
  title: string;
  department_id?: string;
  department?: {
    name: string;
  };
  indicators: Indicator[];
}

interface Indicator {
  id: string;
  code: string;
  name: string;
  unit: string;
  target_value: number | null;
  yearly_target?: number | null;
  yearly_baseline?: number | null;
  calculation_method: string;
  baseline_value?: number | null;
  measurement_frequency?: string;
}

interface IndicatorTarget {
  indicator_id: string;
  target_value: number | null;
}

interface DataEntry {
  id: string;
  indicator_id: string;
  value: number;
  period_year: number;
  period_quarter: number | null;
  period_month: number | null;
  period_type: string;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
}

interface QuarterActivation {
  id: string;
  indicator_id: string;
  year: number;
  quarter: number;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function DataArchive() {
  const { profile } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [activations, setActivations] = useState<QuarterActivation[]>([]);
  const [indicatorTargets, setIndicatorTargets] = useState<IndicatorTarget[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedPeriodType, setSelectedPeriodType] = useState<string>('quarterly');
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState<number | null>(null);
  const [selectedPeriodQuarter, setSelectedPeriodQuarter] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<DataEntry | null>(null);
  const [formValue, setFormValue] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (profile) {
      loadDepartments();
      loadData();
    }
  }, [profile, selectedYear]);

  const loadDepartments = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('organization_id', profile.organization_id)
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Departmanlar yüklenirken hata:', error);
    }
  };

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      let goalIdsForUser: string[] = [];
      if (profile.role !== 'admin' && profile.department_id) {
        const goalsRes = await supabase
          .from('goals')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('department_id', profile.department_id);
        goalIdsForUser = goalsRes.data?.map(g => g.id) || [];
      }

      let objectivesQuery = supabase
        .from('objectives')
        .select(`
          id,
          code,
          title,
          goals (
            id,
            code,
            title,
            department_id,
            department:departments(name),
            indicators (
              id,
              code,
              name,
              unit,
              target_value,
              calculation_method,
              baseline_value,
              measurement_frequency
            )
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('code', { ascending: true });

      const [objectivesRes, entriesRes, activationsRes, targetsRes] = await Promise.all([
        objectivesQuery,
        supabase
          .from('indicator_data_entries')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', selectedYear),
        supabase
          .from('quarter_activations')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('year', selectedYear),
        supabase
          .from('indicator_targets')
          .select(`
            indicator_id,
            year,
            target_value,
            indicators!inner(organization_id)
          `)
          .in('year', [selectedYear, selectedYear - 1])
          .eq('indicators.organization_id', profile.organization_id)
      ]);

      if (objectivesRes.error) throw objectivesRes.error;
      if (entriesRes.error) throw entriesRes.error;

      const targetsByIndicator: Record<string, number> = {};
      const baselineByIndicator: Record<string, number> = {};

      targetsRes.data?.forEach(target => {
        if (target.year === selectedYear) {
          targetsByIndicator[target.indicator_id] = target.target_value;
        } else if (target.year === selectedYear - 1) {
          baselineByIndicator[target.indicator_id] = target.target_value;
        }
      });

      let filteredObjectives = objectivesRes.data || [];

      filteredObjectives = filteredObjectives.map(obj => ({
        ...obj,
        goals: obj.goals.map(goal => ({
          ...goal,
          indicators: goal.indicators.map(ind => {
            let baselineValue;
            if (baselineByIndicator[ind.id] !== undefined && baselineByIndicator[ind.id] !== null) {
              baselineValue = baselineByIndicator[ind.id];
            } else if (ind.baseline_value !== undefined && ind.baseline_value !== null) {
              baselineValue = ind.baseline_value;
            } else {
              baselineValue = 0;
            }

            return {
              ...ind,
              yearly_target: targetsByIndicator[ind.id] !== undefined ? targetsByIndicator[ind.id] : null,
              yearly_baseline: baselineValue
            };
          })
        }))
      }));

      if (profile.role !== 'admin' && goalIdsForUser.length > 0) {
        filteredObjectives = filteredObjectives.map(obj => ({
          ...obj,
          goals: obj.goals.filter(goal => goalIdsForUser.includes(goal.id))
        })).filter(obj => obj.goals.length > 0);
      }

      setObjectives(filteredObjectives);
      setEntries(entriesRes.data || []);
      setActivations(activationsRes.data || []);
      setIndicatorTargets(targetsRes.data || []);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };
const getIndicatorTarget = (indicatorId: string, indicator: any) => {
    if (indicator.yearly_target !== null && indicator.yearly_target !== undefined) {
      return indicator.yearly_target;
    }
    if (indicator.target_value !== null && indicator.target_value !== undefined) {
      return indicator.target_value;
    }
    return 0;
  };
 const calculateCurrentValue = (indicator: Indicator) => {
    const indicatorEntries = entries.filter(
      e => e.indicator_id === indicator.id && e.status === 'approved'
    );
    if (indicatorEntries.length === 0) return null;

    const sumOfEntries = indicatorEntries.reduce((sum, entry) => sum + entry.value, 0);
    const periodCount = indicatorEntries.length;
    const average = sumOfEntries / periodCount;
    const baselineValue = indicator.yearly_baseline !== undefined && indicator.yearly_baseline !== null ? indicator.yearly_baseline : (indicator.baseline_value !== undefined && indicator.baseline_value !== null ? indicator.baseline_value : 0);
    const calculationMethod = indicator.calculation_method || 'cumulative';

    let currentValue = 0;

    switch (calculationMethod) {
      case 'cumulative':
      case 'cumulative_increasing':
      case 'increasing':
        currentValue = baselineValue + sumOfEntries;
        break;
        
      case 'cumulative_decreasing':
      case 'decreasing':
        currentValue = baselineValue - sumOfEntries;
        break;
        
      case 'percentage':
      case 'percentage_increasing':
      case 'percentage_decreasing':
        currentValue = average;
        break;
        
      case 'maintenance':
      case 'maintenance_increasing':
      case 'maintenance_decreasing':
        currentValue = average;
        break;
        
      default:
        currentValue = baselineValue + sumOfEntries;
        break;
    }
    
    return currentValue;
};
  const getEnteredPeriods = (indicatorId: string, indicator: Indicator) => {
    const indicatorEntries = entries
      .filter(e => e.indicator_id === indicatorId && e.status === 'approved')
      .sort((a, b) => {
        const aPeriod = a.period_month || a.period_quarter || 0;
        const bPeriod = b.period_month || b.period_quarter || 0;
        return aPeriod - bPeriod;
      });

    const freq = indicator.measurement_frequency || 'quarterly';

    return indicatorEntries.map(e => {
      const periodValue = e.period_month || e.period_quarter || 0;
      if (freq === 'monthly') return `Ay${periodValue}`;
      if (freq === 'semi-annual' || freq === 'semi_annual') return `Y${periodValue}`;
      if (freq === 'annual') return 'Yıllık';
      return `Ç${periodValue}`;
    });
  };

  const calculateProgress = (indicator: Indicator, currentValue: number | null, targetValue: number | null) => {
    if (currentValue === null || targetValue === null) return 0;

    const dataEntriesForIndicator = entries
      .filter(e => e.indicator_id === indicator.id)
      .map(e => ({
        indicator_id: e.indicator_id,
        value: e.value,
        status: e.status
      }));

    return calculateIndicatorProgress(
      {
        ...indicator,
        yearly_target: targetValue,
        current_value: currentValue
      },
      dataEntriesForIndicator
    );
  };

  const getPeriodsForIndicator = (indicator: Indicator) => {
    const freq = indicator.measurement_frequency || 'quarterly';

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

  const isQuarterActive = (indicatorId: string, quarter: number) => {
    if (profile?.role === 'admin') return true;
    const activation = activations.find(
      a => a.indicator_id === indicatorId && a.quarter === quarter && a.is_active
    );
    return !!activation;
  };

  const getPeriodEntry = (indicatorId: string, periodType: string, periodMonth: number | null, periodQuarter: number | null) => {
    return entries.find(
      e => e.indicator_id === indicatorId &&
           e.period_type === periodType &&
           (periodMonth ? e.period_month === periodMonth : true) &&
           (periodQuarter ? e.period_quarter === periodQuarter : true)
    );
  };

  const getQuarterEntry = (indicatorId: string, quarter: number) => {
    return entries.find(
      e => e.indicator_id === indicatorId && e.period_quarter === quarter
    );
  };

  const canEditOrDelete = (entry: DataEntry) => {
    if (profile?.role === 'admin') return true;
    return entry.status === 'draft';
  };

  const openAddModal = async (indicator: Indicator, periodValue: number) => {
    const freq = indicator.measurement_frequency || 'quarterly';
    let periodType = 'quarterly';
    let periodMonth = null;
    let periodQuarter = null;

    switch (freq) {
      case 'monthly':
        periodType = 'monthly';
        periodMonth = periodValue;
        break;
      case 'quarterly':
        periodType = 'quarterly';
        periodQuarter = periodValue;
        break;
      case 'semi-annual':
      case 'semi_annual':
        periodType = 'semi-annual';
        periodQuarter = periodValue;
        break;
      case 'annual':
        periodType = 'annual';
        periodQuarter = 1;
        break;
    }

    const isActive = isQuarterActive(indicator.id, periodValue);
    if (!isActive && profile?.role !== 'admin') {
      alert('Bu period aktif değil!');
      return;
    }

    const checkQuery = await supabase
      .from('indicator_data_entries')
      .select('*')
      .eq('indicator_id', indicator.id)
      .eq('period_year', selectedYear)
      .eq('period_type', periodType);

    let query = checkQuery;
    if (periodMonth) {
      query = await supabase
        .from('indicator_data_entries')
        .select('*')
        .eq('indicator_id', indicator.id)
        .eq('period_year', selectedYear)
        .eq('period_type', periodType)
        .eq('period_month', periodMonth)
        .maybeSingle();
    } else if (periodQuarter) {
      query = await supabase
        .from('indicator_data_entries')
        .select('*')
        .eq('indicator_id', indicator.id)
        .eq('period_year', selectedYear)
        .eq('period_type', periodType)
        .eq('period_quarter', periodQuarter)
        .maybeSingle();
    }

    if (query.data) {
      alert('Bu period için zaten veri var! Düzenle butonunu kullanın.');
      return;
    }

    setSelectedIndicator(indicator);
    setSelectedQuarter(periodValue);
    setSelectedPeriodType(periodType);
    setSelectedPeriodMonth(periodMonth);
    setSelectedPeriodQuarter(periodQuarter);
    setFormValue('');
    setFormNotes('');
    setModalMode('add');
    setEditingEntry(null);
    setShowModal(true);
  };

  const openEditModal = (entry: DataEntry, indicator: Indicator) => {
    if (!canEditOrDelete(entry)) {
      alert('Bu veriyi düzenleme yetkiniz yok!');
      return;
    }

    setSelectedIndicator(indicator);
    setSelectedQuarter(entry.period_quarter || entry.period_month || 1);
    setSelectedPeriodType(entry.period_type);
    setSelectedPeriodMonth(entry.period_month);
    setSelectedPeriodQuarter(entry.period_quarter);
    setFormValue(typeof entry.value === 'number' ? entry.value.toString().replace('.', ',') : entry.value.toString());
    setFormNotes(entry.notes || '');
    setModalMode('edit');
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleSaveEntry = async () => {
    if (!selectedIndicator) return;

    const normalizedValue = formValue.trim().replace(/,/g, '.');
    const numValue = parseFloat(normalizedValue);
    if (isNaN(numValue)) {
      alert('Geçerli bir sayı girin');
      return;
    }

    try {
      const isAdmin = profile?.role === 'admin';

      if (modalMode === 'add') {
        const result = await supabase
          .from('indicator_data_entries')
          .insert({
            indicator_id: selectedIndicator.id,
            organization_id: profile?.organization_id,
            entered_by: profile?.id,
            value: numValue,
            notes: formNotes.trim() || null,
            entry_date: new Date().toISOString().split('T')[0],
            period_type: selectedPeriodType,
            period_year: selectedYear,
            period_month: selectedPeriodMonth,
            period_quarter: selectedPeriodQuarter,
            status: isAdmin ? 'approved' : 'draft',
            ...(isAdmin && { reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
          })
          .select()
          .single();

        if (result.error) throw result.error;

        setEntries(prev => [...prev, result.data]);
        alert('Veri başarıyla eklendi');
      } else if (modalMode === 'edit' && editingEntry) {
        const updateData: any = {
          value: numValue,
          notes: formNotes.trim() || null
        };
        if (isAdmin) {
          updateData.status = 'approved';
          updateData.reviewed_by = profile?.id;
          updateData.reviewed_at = new Date().toISOString();
        }

        const result = await supabase
          .from('indicator_data_entries')
          .update(updateData)
          .eq('id', editingEntry.id)
          .select()
          .single();

        if (result.error) throw result.error;

        setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...updateData } : e));
        alert('Veri güncellendi');
      }

      setShowModal(false);
    } catch (error: any) {
      console.error('Kaydetme hatası:', error);
      alert('İşlem başarısız: ' + (error.message || JSON.stringify(error)));
    }
  };


  const handleDeleteEntry = async (entry: DataEntry) => {
    if (!canEditOrDelete(entry)) {
      alert('Bu veriyi silme yetkiniz yok!');
      return;
    }

    if (!confirm('Bu veriyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('indicator_data_entries')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== entry.id));
      alert('Veri silindi');
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme başarısız: ' + error.message);
    }
  };

  const handleSubmitEntry = async (entry: DataEntry) => {
    if (!confirm('Bu veriyi onaya göndermek istediğinizden emin misiniz? Onaya gönderilen veriler düzenlenemez.')) return;

    try {
      const isDirector = profile?.role === 'director';
      const newStatus = isDirector ? 'pending_admin' : 'pending_director';

      const updateData: any = { status: newStatus };

      if (isDirector) {
        updateData.director_approved_by = profile?.id;
        updateData.director_approved_at = new Date().toISOString();
      }

      const result = await supabase
        .from('indicator_data_entries')
        .update(updateData)
        .eq('id', entry.id)
        .select()
        .single();

      if (result.error) throw result.error;

      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updateData } : e));

      if (isDirector) {
        alert('Veri yönetici onayına gönderildi');
      } else {
        alert('Veri müdür onayına gönderildi');
      }
    } catch (error: any) {
      console.error('Gönderme hatası:', error);
      alert('Gönderme başarısız: ' + error.message);
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      draft: 'Taslak',
      pending_director: 'Müdür Onayı Bekliyor',
      pending_admin: 'Yönetici Onayı Bekliyor',
      submitted: 'Onay Bekliyor',
      approved: 'Onaylandı',
      rejected: 'Reddedildi'
    };
    return labels[status] || status;
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    const sampleIndicator = filteredObjectives[0]?.goals[0]?.indicators[0];
    const periods = sampleIndicator ? getPeriodsForIndicator(sampleIndicator) : [];

    const headers = ['Gösterge Kodu', 'Gösterge Adı', 'Hedef Değer', 'Güncel Değer', 'İlerleme (%)'];
    periods.forEach(p => headers.push(p.label));
    wsData.push(headers);

    filteredObjectives.forEach(objective => {
      wsData.push([`AMAÇ: ${objective.code} - ${objective.title}`]);

      objective.goals.forEach(goal => {
        wsData.push([`  HEDEF: ${goal.code} - ${goal.title} (${goal.department?.name || '-'})`]);

        goal.indicators.forEach(indicator => {
          const indicatorPeriods = getPeriodsForIndicator(indicator);
          const targetValue = getIndicatorTarget(indicator.id, indicator);
          const currentValue = calculateCurrentValue(indicator);
          const progress = calculateProgress(indicator, currentValue, targetValue);

          const row: any[] = [
            indicator.code,
            indicator.name,
            targetValue !== null ? targetValue : '-',
            currentValue !== null ? currentValue.toFixed(2) : '-',
            targetValue !== null ? `%${progress}` : '-'
          ];

          const notes: any[] = ['', '', '', '', ''];

          indicatorPeriods.forEach(period => {
            const entry = getPeriodEntry(indicator.id, period.periodType, period.periodMonth, period.periodQuarter);
            row.push(entry ? entry.value : '-');
            notes.push(entry?.notes || '');
          });

          wsData.push(row);

          const hasNotes = notes.some(n => n && n !== '');
          if (hasNotes) {
            wsData.push(notes);
          }
        });

        wsData.push([]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [
      { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];
    periods.forEach(() => colWidths.push({ wch: 12 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Veri Arşivi');
    XLSX.writeFile(wb, `Veri_Arsivi_${selectedYear}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Veri Arşivi', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Yıl: ${selectedYear}`, 14, 22);
    if (selectedDepartmentId) {
      const dept = departments.find(d => d.id === selectedDepartmentId);
      if (dept) {
        doc.text(`Birim: ${dept.name}`, 14, 28);
      }
    }
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, selectedDepartmentId ? 34 : 28);

    const tableData: any[] = [];
    const headers = ['Gösterge Kodu', 'Gösterge Adı', 'Hedef', 'Güncel', 'İlerleme'];

    const sampleIndicator = filteredObjectives[0]?.goals[0]?.indicators[0];
    const periodLabels = sampleIndicator ? getPeriodsForIndicator(sampleIndicator).map(p => p.label) : [];
    headers.push(...periodLabels);

    filteredObjectives.forEach(objective => {
      tableData.push([
        { content: `AMAÇ: ${objective.code} - ${objective.title}`, colSpan: headers.length, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
      ]);

      objective.goals.forEach(goal => {
        tableData.push([
          { content: `  HEDEF: ${goal.code} - ${goal.title} (${goal.department?.name || '-'})`, colSpan: headers.length, styles: { fontStyle: 'bold', fillColor: [248, 248, 248] } }
        ]);

        goal.indicators.forEach(indicator => {
          const periods = getPeriodsForIndicator(indicator);
          const targetValue = getIndicatorTarget(indicator.id, indicator);
          const currentValue = calculateCurrentValue(indicator);
          const progress = calculateProgress(indicator, currentValue, targetValue);

          const row: any[] = [
            indicator.code,
            indicator.name.substring(0, 30) + (indicator.name.length > 30 ? '...' : ''),
            targetValue !== null ? targetValue.toString() : '-',
            currentValue !== null ? currentValue.toFixed(2) : '-',
            targetValue !== null ? `%${progress}` : '-'
          ];

          const notes: string[] = [];

          periods.forEach(period => {
            const entry = getPeriodEntry(indicator.id, period.periodType, period.periodMonth, period.periodQuarter);
            row.push(entry ? entry.value.toString() : '-');
            notes.push(entry?.notes || '');
          });

          tableData.push(row);

          const hasNotes = notes.some(n => n && n !== '');
          if (hasNotes) {
            const notesRow: any[] = ['', '', '', '', ''];
            notes.forEach(note => {
              notesRow.push({ content: note || '', styles: { fontSize: 5, textColor: [100, 100, 100], fontStyle: 'italic' } });
            });
            tableData.push(notesRow);
          }
        });
      });
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: selectedDepartmentId ? 40 : 34,
      styles: {
        fontSize: 6,
        cellPadding: 1,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 55 },
        2: { cellWidth: 15 },
        3: { cellWidth: 15 },
        4: { cellWidth: 15 }
      }
    });

    doc.save(`Veri_Arsivi_${selectedYear}.pdf`);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any; color: string; text: string }> = {
      draft: { icon: Clock, color: 'bg-slate-100 text-slate-700', text: 'Taslak' },
      pending_director: { icon: Clock, color: 'bg-yellow-100 text-yellow-700', text: 'Müdür Onayı Bekliyor' },
      pending_admin: { icon: Clock, color: 'bg-blue-100 text-blue-700', text: 'Yönetici Onayı Bekliyor' },
      submitted: { icon: Clock, color: 'bg-blue-100 text-blue-700', text: 'Onay Bekliyor' },
      approved: { icon: CheckCircle, color: 'bg-green-100 text-green-700', text: 'Onaylandı' },
      rejected: { icon: XCircle, color: 'bg-red-100 text-red-700', text: 'Reddedildi' }
    };
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  const filteredObjectives = objectives.map(obj => ({
    ...obj,
    goals: obj.goals.filter(goal => {
      if (selectedDepartmentId && goal.department_id !== selectedDepartmentId) {
        return false;
      }
      return true;
    }).map(goal => ({
      ...goal,
      indicators: goal.indicators.filter(ind => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          ind.code.toLowerCase().includes(search) ||
          ind.name.toLowerCase().includes(search)
        );
      })
    })).filter(goal => goal.indicators.length > 0)
  })).filter(obj => obj.goals.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Veri Arşivi</h1>
        <p className="text-gray-600 mt-1">
          Performans göstergelerinizin çeyrek dönem verilerini görüntüleyin
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
        {(profile?.role === 'admin' || profile?.role === 'vice_president') && (
          <select
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
          >
            <option value="">Tüm Birimler</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        {filteredObjectives.length > 0 && (
          <>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel İndir
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              PDF İndir
            </button>
          </>
        )}
      </div>

      <div className="space-y-4">
        {filteredObjectives.map((objective) => (
          <div key={objective.id} className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => setExpandedObjectives(prev => {
                const newSet = new Set(prev);
                if (newSet.has(objective.id)) newSet.delete(objective.id);
                else newSet.add(objective.id);
                return newSet;
              })}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              {expandedObjectives.has(objective.id) ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">
                  {objective.code} - {objective.title}
                </div>
                <div className="text-sm text-gray-600">
                  {objective.goals.length} Hedef, {objective.goals.reduce((sum, g) => sum + g.indicators.length, 0)} Gösterge
                </div>
              </div>
            </button>

            {expandedObjectives.has(objective.id) && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                {objective.goals.map((goal) => (
                  <div key={goal.id} className="mb-4 bg-white rounded-lg border border-gray-200">
                    <button
                      onClick={() => setExpandedGoals(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(goal.id)) newSet.delete(goal.id);
                        else newSet.add(goal.id);
                        return newSet;
                      })}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50"
                    >
                      {expandedGoals.has(goal.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">
                          {goal.code} - {goal.title}
                        </div>
                        {goal.department && (
                          <div className="text-sm text-gray-600">{goal.department.name}</div>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {goal.indicators.length} Gösterge
                      </div>
                    </button>

                    {expandedGoals.has(goal.id) && (
                      <div className="border-t border-gray-200 p-3 space-y-4">
                        {goal.indicators.map((indicator) => {
                          const targetValue = getIndicatorTarget(indicator.id, indicator);
                          const currentValue = calculateCurrentValue(indicator);
                          const enteredPeriods = getEnteredPeriods(indicator.id, indicator);
                          const progress = calculateProgress(indicator, currentValue, targetValue);
                          const baselineValue = indicator.baseline_value || 0;

                          return (
                            <div key={indicator.id} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    {indicator.code}
                                  </span>
                                  <h4 className="font-medium text-gray-900 mt-2">{indicator.name}</h4>
                                </div>
                                <div className="text-sm text-right ml-4 space-y-2">
                                  <div className={`font-medium ${targetValue !== null ? 'text-gray-900' : 'text-red-600'}`}>
                                    Hedef ({selectedYear}): {targetValue !== null ? targetValue.toLocaleString('tr-TR') : 'Tanımlanmamış'} {indicator.unit}
                                  </div>
                                  {targetValue === null && (
                                    <div className="text-xs text-red-500">
                                      Göstergeler sayfasından hedef belirleyin
                                    </div>
                                  )}

                                  <div className="text-gray-600 text-xs">
                                    Başlangıç: {baselineValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {indicator.unit}
                                  </div>

                                  {currentValue !== null && (
                                    <div className="space-y-1">
                                      <div className="text-gray-700">
                                        Güncel: <span className="font-semibold text-blue-600">
                                          {currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {indicator.unit}
                                        </span>
                                        {enteredPeriods.length > 0 && (
                                          <span className="text-xs text-gray-500 ml-1">
                                            ({enteredPeriods.join('+')})
                                          </span>
                                        )}
                                      </div>

                                      {targetValue !== null && (
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className={`font-medium ${
                                              progress >= 85 ? 'text-green-600' :
                                              progress >= 70 ? 'text-green-500' :
                                              progress >= 55 ? 'text-yellow-600' :
                                              progress >= 45 ? 'text-red-600' :
                                              'text-amber-700'
                                            }`}>
                                              İlerleme: %{progress}
                                            </span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                              className={`h-2 rounded-full transition-all ${
                                                progress >= 85 ? 'bg-green-500' :
                                                progress >= 70 ? 'bg-green-400' :
                                                progress >= 55 ? 'bg-yellow-500' :
                                                progress >= 45 ? 'bg-red-500' :
                                                'bg-amber-700'
                                              }`}
                                              style={{ width: `${Math.min(progress, 100)}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className={`grid ${getGridColsClass(indicator)} gap-2`}>
                                {getPeriodsForIndicator(indicator).map((period) => {
                                  const entry = getPeriodEntry(indicator.id, period.periodType, period.periodMonth, period.periodQuarter);
                                  const isActive = isQuarterActive(indicator.id, period.value);
                                  const canAdd = (isActive || profile?.role === 'admin') && !entry;

                                  return (
                                    <div
                                      key={`${period.periodType}-${period.value}`}
                                      className={`p-3 rounded border-2 ${
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
                                        <div className="text-xl font-bold text-gray-900">
                                          {typeof entry.value === 'number'
                                            ? entry.value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 10 })
                                            : entry.value}
                                        </div>
                                        <div className="text-xs text-gray-600 mb-2">{indicator.unit}</div>
                                        {entry.notes && (
                                          <div className="mb-2 p-2 bg-gray-50 rounded text-xs text-gray-700 border border-gray-200">
                                            <div className="font-semibold text-gray-800 mb-1">Açıklama:</div>
                                            <div className="whitespace-pre-wrap">{entry.notes}</div>
                                          </div>
                                        )}
                                        {getStatusBadge(entry.status)}
                                        {entry.status === 'draft' && (
                                          <div className="mt-2 space-y-1">
                                            <div className="flex gap-1">
                                              <button
                                                onClick={() => openEditModal(entry, indicator)}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                                Düzenle
                                              </button>
                                              <button
                                                onClick={() => handleDeleteEntry(entry)}
                                                className="flex items-center justify-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                            {profile?.role !== 'admin' && (
                                              <button
                                                onClick={() => handleSubmitEntry(entry)}
                                                className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                              >
                                                <Send className="w-3 h-3" />
                                                Onaya Gönder
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        {profile?.role === 'admin' && entry.status !== 'draft' && (
                                          <div className="mt-2 flex gap-1">
                                            <button
                                              onClick={() => openEditModal(entry, indicator)}
                                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                              Düzenle
                                            </button>
                                            <button
                                              onClick={() => handleDeleteEntry(entry)}
                                              className="flex items-center justify-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ) : canAdd ? (
                                      <button
                                        onClick={() => openAddModal(indicator, period.value)}
                                        className="w-full flex items-center justify-center gap-1 px-2 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Veri Ekle
                                      </button>
                                    ) : (
                                      <div className="text-center text-gray-400 text-xs py-2">
                                        {entry ? 'Veri Var' : 'Kapalı'}
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredObjectives.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">Gösterge bulunamadı</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={
        (() => {
          const freq = selectedIndicator?.measurement_frequency || 'quarterly';
          let periodLabel = `Ç${selectedQuarter}`;
          if (freq === 'monthly') periodLabel = `Ay ${selectedQuarter}`;
          else if (freq === 'semi-annual' || freq === 'semi_annual') periodLabel = `Yarıyıl ${selectedQuarter}`;
          else if (freq === 'annual') periodLabel = 'Yıllık';
          return modalMode === 'add' ? `Veri Ekle - ${periodLabel}` : `Veri Düzenle - ${periodLabel}`;
        })()
      }>
        {selectedIndicator && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {selectedIndicator.code}
                </span>
                <span className="text-sm text-gray-600">
                  Hedef ({selectedYear}): {(() => {
                    const target = getIndicatorTarget(selectedIndicator.id, selectedIndicator);
                    return target !== null ? target.toLocaleString('tr-TR') : '-';
                  })()} {selectedIndicator.unit}
                </span>
              </div>
              <h3 className="font-medium text-gray-900">{selectedIndicator.name}</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {(() => {
                  const freq = selectedIndicator.measurement_frequency || 'quarterly';
                  if (freq === 'monthly') return `Ay ${selectedQuarter}`;
                  if (freq === 'semi-annual' || freq === 'semi_annual') return `Yarıyıl ${selectedQuarter}`;
                  if (freq === 'annual') return 'Yıllık';
                  return `Ç${selectedQuarter}`;
                })()} için değer ({selectedIndicator.unit}) *
              </label>
              <input
                type="text"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Örn: 42,5"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Ondalık ayırıcı için virgül (,) kullanabilirsiniz</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama (Opsiyonel)
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bu veri ile ilgili açıklama veya notlar..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEntry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <span>{modalMode === 'add' ? 'Ekle' : 'Güncelle'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
