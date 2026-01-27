import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Filter, TrendingUp, FileText, X, FileSpreadsheet, FileDown } from 'lucide-react';
import { exportToExcel, exportToPDF, generateTableHTML } from '../../utils/exportHelpers';
import { calculateIndicatorProgress, calculateGoalProgress, getProgressColor, getProgressTextColor } from '../../utils/progressCalculations';
import {
  IndicatorStatus,
  getIndicatorStatus,
  getStatusConfig,
  getStatusLabel,
  createEmptyStats,
  incrementStatusInStats,
  type IndicatorStats as StatusStats
} from '../../utils/indicatorStatus';
import Modal from '../ui/Modal';

interface IndicatorData {
  id: string;
  code: string;
  name: string;
  unit: string;
  objective_id: string | null;
  objective_title: string;
  goal_id: string;
  goal_title: string;
  department_id: string | null;
  department_name: string;
  strategic_plan_id: string | null;
  plan_name: string;
  baseline_value: number;
  q1_value: number;
  q1_notes: string;
  q2_value: number;
  q2_notes: string;
  q3_value: number;
  q3_notes: string;
  q4_value: number;
  q4_notes: string;
  total_value: number;
  target_value: number;
  progress: number;
  calculation_method: string;
  goal_impact_percentage?: number | null;
  yearly_target?: number | null;
  hasQ1Entry?: boolean;
  hasQ2Entry?: boolean;
  hasQ3Entry?: boolean;
  hasQ4Entry?: boolean;
}

interface IndicatorPerformanceProps {
  selectedYear?: number;
}

interface IndicatorDetail {
  id: string;
  name: string;
  code: string;
  current_value: number;
  target_value: number;
  progress: number;
  status: IndicatorStatus;
}

export default function IndicatorPerformance({ selectedYear }: IndicatorPerformanceProps) {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<IndicatorData[]>([]);
  const [filteredIndicators, setFilteredIndicators] = useState<IndicatorData[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedQuarters, setSelectedQuarters] = useState<number[]>([1, 2, 3, 4]);
  const [hideNotes, setHideNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentYear = selectedYear || new Date().getFullYear();
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IndicatorStatus | null>(null);
  const [indicatorDetails, setIndicatorDetails] = useState<IndicatorDetail[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [dataEntries, setDataEntries] = useState<any[]>([]);
  const [strategicPlans, setStrategicPlans] = useState<any[]>([]);
  const [organization, setOrganization] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  useEffect(() => {
    applyFilters();
  }, [selectedDepartment, selectedPlan, indicators]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      return;
    }

    try {

      // First get goals to filter indicators by department
      let goalsQuery = supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id);

      // Non-admin and non-manager users see only their department's data
      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const { data: allowedGoals } = await goalsQuery;
      const allowedGoalIds = allowedGoals?.map(g => g.id) || [];

      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          id,
          code,
          name,
          unit,
          goal_id,
          baseline_value,
          target_value,
          calculation_method,
          goal_impact_percentage,
          goal:goals!goal_id (
            id,
            title,
            department_id,
            objective_id,
            department:departments!department_id (name),
            objective:objectives!objective_id (
              id,
              title,
              strategic_plan_id,
              plan:strategic_plans!strategic_plan_id (name)
            )
          )
        `)
        .eq('organization_id', profile.organization_id);


      // Filter by allowed goals
      if (allowedGoalIds.length > 0) {
        indicatorsQuery = indicatorsQuery.in('goal_id', allowedGoalIds);
      } else if (profile.role !== 'admin' && profile.role !== 'manager') {
        // Non-admin/non-manager with no goals sees nothing
        indicatorsQuery = indicatorsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      const [depsData, plansData, indicatorsData, orgData, detailedPlansData] = await Promise.all([
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name'),
        supabase
          .from('strategic_plans')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name'),
        indicatorsQuery,
        supabase
          .from('organizations')
          .select('id, name, mission, vision')
          .eq('id', profile.organization_id)
          .single(),
        supabase
          .from('strategic_plans')
          .select('id, name, start_year, end_year, vision, mission, created_at')
          .eq('organization_id', profile.organization_id)
          .order('start_year', { ascending: false }),
      ]);

      setDepartments(depsData.data || []);
      setPlans(plansData.data || []);
      setOrganization(orgData.data);
      setStrategicPlans(detailedPlansData.data || []);

      if (indicatorsData.data && indicatorsData.data.length > 0) {
        const indicatorIds = indicatorsData.data.map(i => i.id);

        const [entriesData, targetsData] = await Promise.all([
          supabase
            .from('indicator_data_entries')
            .select('indicator_id, period_quarter, value, status, notes')
            .eq('period_year', currentYear)
            .eq('status', 'approved')
            .in('indicator_id', indicatorIds),
          supabase
            .from('indicator_targets')
            .select('indicator_id, target_value')
            .eq('year', currentYear)
            .in('indicator_id', indicatorIds),
        ]);

        const entriesByIndicator: Record<string, { [key: number]: { value: number, notes: string } }> = {};
        entriesData.data?.forEach(entry => {
          if (!entriesByIndicator[entry.indicator_id]) {
            entriesByIndicator[entry.indicator_id] = {};
          }
          if (!entriesByIndicator[entry.indicator_id][entry.period_quarter]) {
            entriesByIndicator[entry.indicator_id][entry.period_quarter] = { value: 0, notes: '' };
          }
          entriesByIndicator[entry.indicator_id][entry.period_quarter].value += entry.value;
          if (entry.notes) {
            const existingNotes = entriesByIndicator[entry.indicator_id][entry.period_quarter].notes;
            entriesByIndicator[entry.indicator_id][entry.period_quarter].notes = existingNotes
              ? existingNotes + '; ' + entry.notes
              : entry.notes;
          }
        });

        const targetsByIndicator: Record<string, number> = {};
        targetsData.data?.forEach(target => {
          targetsByIndicator[target.indicator_id] = target.target_value;
        });

        const processedIndicators = indicatorsData.data.map(ind => {
          const goal = ind.goal as any;
          const q1Data = entriesByIndicator[ind.id]?.[1] || { value: 0, notes: '' };
          const q2Data = entriesByIndicator[ind.id]?.[2] || { value: 0, notes: '' };
          const q3Data = entriesByIndicator[ind.id]?.[3] || { value: 0, notes: '' };
          const q4Data = entriesByIndicator[ind.id]?.[4] || { value: 0, notes: '' };

          const q1 = q1Data.value;
          const q2 = q2Data.value;
          const q3 = q3Data.value;
          const q4 = q4Data.value;

          const hasQ1Entry = entriesByIndicator[ind.id]?.[1] !== undefined;
          const hasQ2Entry = entriesByIndicator[ind.id]?.[2] !== undefined;
          const hasQ3Entry = entriesByIndicator[ind.id]?.[3] !== undefined;
          const hasQ4Entry = entriesByIndicator[ind.id]?.[4] !== undefined;
          const total = q1 + q2 + q3 + q4;
          const target = targetsByIndicator[ind.id] || ind.target_value || 0;

          const progress = calculateIndicatorProgress({
            id: ind.id,
            goal_id: ind.goal_id,
            baseline_value: ind.baseline_value,
            target_value: ind.target_value,
            yearly_target: target,
            calculation_method: ind.calculation_method
          }, entriesData.data || []);

          return {
            id: ind.id,
            code: ind.code,
            name: ind.name,
            unit: ind.unit,
            objective_id: goal?.objective_id || null,
            objective_title: goal?.objective?.title || '-',
            goal_id: ind.goal_id,
            goal_title: goal?.title || '-',
            department_id: goal?.department_id || null,
            department_name: goal?.department?.name || '-',
            strategic_plan_id: goal?.objective?.strategic_plan_id || null,
            plan_name: goal?.objective?.plan?.name || '-',
            baseline_value: ind.baseline_value || 0,
            q1_value: q1,
            q1_notes: q1Data.notes,
            q2_value: q2,
            q2_notes: q2Data.notes,
            q3_value: q3,
            q3_notes: q3Data.notes,
            q4_value: q4,
            q4_notes: q4Data.notes,
            total_value: total,
            target_value: target,
            progress: progress,
            calculation_method: ind.calculation_method || 'cumulative',
            goal_impact_percentage: ind.goal_impact_percentage,
            yearly_target: target,
            hasQ1Entry: hasQ1Entry,
            hasQ2Entry: hasQ2Entry,
            hasQ3Entry: hasQ3Entry,
            hasQ4Entry: hasQ4Entry,
          };
        });

        processedIndicators.sort((a, b) =>
          a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' })
        );

        setIndicators(processedIndicators);
        setDataEntries(entriesData.data || []);
      } else {
        setIndicators([]);
        setDataEntries([]);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...indicators];

    if (selectedDepartment) {
      filtered = filtered.filter(i => i.department_id === selectedDepartment);
    }

    if (selectedPlan) {
      filtered = filtered.filter(i => i.strategic_plan_id === selectedPlan);
    }

    setFilteredIndicators(filtered);
  };

  const toggleQuarter = (quarter: number) => {
    setSelectedQuarters(prev =>
      prev.includes(quarter)
        ? prev.filter(q => q !== quarter)
        : [...prev, quarter].sort()
    );
  };

  const toggleAllQuarters = () => {
    if (selectedQuarters.length === 4) {
      setSelectedQuarters([]);
    } else {
      setSelectedQuarters([1, 2, 3, 4]);
    }
  };

  const getIndicatorStats = () => {
    const stats = createEmptyStats();

    filteredIndicators.forEach(ind => {
      const progress = calculateSelectedProgress(ind);
      const status = getIndicatorStatus(progress);
      incrementStatusInStats(stats, status);
    });

    return stats;
  };

  const loadIndicatorDetails = async (status: IndicatorStatus) => {
    setSelectedStatus(status);
    setShowIndicatorModal(true);
    setLoadingIndicators(true);

    try {
      const details: IndicatorDetail[] = [];

      filteredIndicators.forEach(indicator => {
        const progress = calculateSelectedProgress(indicator);
        const indicatorStatus = getIndicatorStatus(progress);

        if (indicatorStatus === status) {
          const currentValue = calculateCurrentValue(indicator);

          details.push({
            id: indicator.id,
            name: indicator.name,
            code: indicator.code || '',
            current_value: currentValue,
            target_value: indicator.target_value,
            progress: progress,
            status: indicatorStatus,
          });
        }
      });

      details.sort((a, b) => a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' }));
      setIndicatorDetails(details);
    } catch (error) {
      console.error('Gösterge detayları yükleme hatası:', error);
    } finally {
      setLoadingIndicators(false);
    }
  };

  const getStatusColorClass = (status: IndicatorStatus) => {
    const config = getStatusConfig(status);
    return `${config.color} ${config.bgColor}`;
  };

  const handleExportIndicatorDetailsExcel = () => {
    if (indicatorDetails.length === 0) return;

    const exportData = indicatorDetails.map(ind => ({
      'Gösterge Kodu': ind.code,
      'Gösterge Adı': ind.name,
      'Müdürlük': ind.department_name || '-',
      'Gerçekleşen': ind.current_value.toFixed(2),
      'Hedef': ind.target_value.toFixed(2),
      'İlerleme (%)': Math.round(ind.progress),
      'Durum': getStatusLabel(ind.status),
      'Hedef Tanımlı': ind.has_target ? 'Evet' : 'Hayır',
      'Veri Girişi': ind.has_data ? 'Var' : 'Yok',
    }));

    const statusLabel = selectedStatus ? getStatusLabel(selectedStatus) : 'Tum';
    exportToExcel(
      exportData,
      `${statusLabel}_Gostergeler_${currentYear}_${new Date().toISOString().split('T')[0]}`
    );
  };

  const handleExportIndicatorDetailsPDF = () => {
    if (indicatorDetails.length === 0) return;

    const headers = ['Kod', 'Gösterge', 'Müdürlük', 'Gerçekleşen', 'Hedef', 'İlerleme', 'Durum'];
    const rows = indicatorDetails.map(ind => [
      ind.code,
      ind.name,
      ind.department_name || '-',
      ind.current_value.toFixed(2),
      ind.target_value > 0 ? ind.target_value.toFixed(2) : 'Belirtilmemiş',
      `${Math.round(ind.progress)}%`,
      getStatusLabel(ind.status),
    ]);

    const statusLabel = selectedStatus ? getStatusLabel(selectedStatus) : 'Tüm';
    const content = `
      <h2>${statusLabel} Göstergeler - ${currentYear}</h2>
      <div class="mb-4">
        <p><strong>Toplam Gösterge:</strong> ${indicatorDetails.length}</p>
        <p><strong>Hedefi Olmayan:</strong> ${indicatorDetails.filter(i => !i.has_target).length}</p>
        <p><strong>Veri Girişi Olmayan:</strong> ${indicatorDetails.filter(i => !i.has_data).length}</p>
      </div>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF(
      `${statusLabel} Göstergeler`,
      content,
      `${statusLabel}_Gostergeler_${currentYear}_${new Date().toISOString().split('T')[0]}`
    );
  };

  const calculateCurrentValue = (ind: IndicatorData) => {
    const periodValues: number[] = [];
    if (ind.hasQ1Entry) periodValues.push(ind.q1_value);
    if (ind.hasQ2Entry) periodValues.push(ind.q2_value);
    if (ind.hasQ3Entry) periodValues.push(ind.q3_value);
    if (ind.hasQ4Entry) periodValues.push(ind.q4_value);

    if (periodValues.length === 0) return ind.baseline_value || 0;

    const sum = periodValues.reduce((acc, val) => acc + val, 0);
    const calculationMethod = ind.calculation_method || 'cumulative';

    if (calculationMethod.includes('cumulative') || calculationMethod === 'increasing') {
      return ind.baseline_value + sum;
    } else if (calculationMethod === 'decreasing') {
      return ind.baseline_value - sum;
    } else if (calculationMethod.includes('maintenance') || calculationMethod.includes('percentage')) {
      return Number((sum / periodValues.length).toFixed(2));
    }

    return sum;
  };

  const calculateSelectedTotal = (ind: IndicatorData) => {
    let sum = 0;
    let count = 0;

    if (selectedQuarters.includes(1)) { sum += ind.q1_value; count++; }
    if (selectedQuarters.includes(2)) { sum += ind.q2_value; count++; }
    if (selectedQuarters.includes(3)) { sum += ind.q3_value; count++; }
    if (selectedQuarters.includes(4)) { sum += ind.q4_value; count++; }

    if (count === 0) return 0;

    const calculationMethod = ind.calculation_method || 'cumulative';

    if (calculationMethod === 'maintenance' ||
        calculationMethod === 'maintenance_increasing' ||
        calculationMethod === 'maintenance_decreasing' ||
        calculationMethod === 'percentage' ||
        calculationMethod === 'percentage_increasing' ||
        calculationMethod === 'percentage_decreasing') {
      return Number((sum / count).toFixed(2));
    }

    return sum;
  };

  const calculateSelectedProgress = (ind: IndicatorData) => {
    if (selectedQuarters.length === 0) return 0;

    const filteredEntries = dataEntries.filter(e =>
      e.indicator_id === ind.id &&
      e.status === 'approved' &&
      selectedQuarters.includes(e.period_quarter)
    );

    const indicatorWithTarget = {
      id: ind.id,
      goal_id: ind.goal_id,
      yearly_target: ind.yearly_target || ind.target_value,
      baseline_value: ind.baseline_value || 0,
      calculation_method: ind.calculation_method
    };

    return calculateIndicatorProgress(indicatorWithTarget, filteredEntries);
  };


  const handleExportExcel = () => {
    const exportData: any[] = [];

    const groupedByPlan = filteredIndicators.reduce((acc, ind) => {
      const planKey = ind.strategic_plan_id || 'no-plan';
      if (!acc[planKey]) {
        acc[planKey] = {
          name: ind.plan_name,
          objectives: {}
        };
      }

      const objKey = ind.objective_id || 'no-objective';
      if (!acc[planKey].objectives[objKey]) {
        acc[planKey].objectives[objKey] = {
          title: ind.objective_title,
          goals: {}
        };
      }

      const goalKey = ind.goal_id;
      if (!acc[planKey].objectives[objKey].goals[goalKey]) {
        acc[planKey].objectives[objKey].goals[goalKey] = {
          title: ind.goal_title,
          department: ind.department_name,
          indicators: []
        };
      }

      acc[planKey].objectives[objKey].goals[goalKey].indicators.push(ind);
      return acc;
    }, {} as Record<string, any>);

    Object.entries(groupedByPlan).forEach(([planId, planData]) => {
      exportData.push({
        'Kod': '',
        'Gösterge': planData.name,
        'Ç1': '',
        'Ç2': '',
        'Ç3': '',
        'Ç4': '',
        'Toplam Veri': '',
        'Başlangıç': '',
        'Hedef': '',
        'İlerleme Durumu': ''
      });

      Object.entries(planData.objectives).forEach(([objId, objData]) => {
        exportData.push({
          'Kod': '',
          'Gösterge': `AMAÇ: ${objData.title}`,
          'Ç1': '',
          'Ç2': '',
          'Ç3': '',
          'Ç4': '',
          'Toplam Veri': '',
          'Başlangıç': '',
          'Hedef': '',
          'İlerleme Durumu': ''
        });

        Object.entries(objData.goals).forEach(([goalId, goalData]: [string, any]) => {
          exportData.push({
            'Kod': '',
            'Gösterge': `  HEDEF: ${goalData.title} [${goalData.department}]`,
            'Ç1': '',
            'Ç2': '',
            'Ç3': '',
            'Ç4': '',
            'Toplam Veri': '',
            'Başlangıç': '',
            'Hedef': '',
            'İlerleme Durumu': ''
          });

          goalData.indicators.forEach((ind: IndicatorData) => {
            const selectedTotal = calculateSelectedTotal(ind);
            const isAverage = ['maintenance', 'maintenance_increasing', 'maintenance_decreasing', 'percentage', 'percentage_increasing', 'percentage_decreasing'].includes(ind.calculation_method || 'cumulative');

            const data: any = {
              'Kod': ind.code,
              'Gösterge': ind.name,
            };

            if (selectedQuarters.includes(1)) {
              data['Ç1'] = ind.q1_value;
            } else {
              data['Ç1'] = '';
            }

            if (selectedQuarters.includes(2)) {
              data['Ç2'] = ind.q2_value;
            } else {
              data['Ç2'] = '';
            }

            if (selectedQuarters.includes(3)) {
              data['Ç3'] = ind.q3_value;
            } else {
              data['Ç3'] = '';
            }

            if (selectedQuarters.includes(4)) {
              data['Ç4'] = ind.q4_value;
            } else {
              data['Ç4'] = '';
            }

            const currentValue = calculateCurrentValue(ind);
            data['Toplam Veri'] = `${currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${ind.unit}`;
            data['Başlangıç'] = ind.baseline_value;
            data['Hedef'] = ind.target_value;
            const progressValue = calculateSelectedProgress(ind);
            const statusLabel = getStatusLabel(getIndicatorStatus(progressValue));
            data['İlerleme Durumu'] = `${Math.round(progressValue)}%`;
            data['Başarı Düzeyi'] = statusLabel;

            exportData.push(data);

            if (!hideNotes && (ind.q1_notes || ind.q2_notes || ind.q3_notes || ind.q4_notes)) {
              const notesData: any = {
                'Kod': '',
                'Gösterge': 'Açıklamalar:',
              };

              if (selectedQuarters.includes(1)) {
                notesData['Ç1'] = ind.q1_notes || '-';
              } else {
                notesData['Ç1'] = '';
              }

              if (selectedQuarters.includes(2)) {
                notesData['Ç2'] = ind.q2_notes || '-';
              } else {
                notesData['Ç2'] = '';
              }

              if (selectedQuarters.includes(3)) {
                notesData['Ç3'] = ind.q3_notes || '-';
              } else {
                notesData['Ç3'] = '';
              }

              if (selectedQuarters.includes(4)) {
                notesData['Ç4'] = ind.q4_notes || '-';
              } else {
                notesData['Ç4'] = '';
              }

              notesData['Toplam Veri'] = '';
              notesData['Başlangıç'] = '';
              notesData['Hedef'] = '';
              notesData['İlerleme Durumu'] = '';
              notesData['Başarı Düzeyi'] = '';

              exportData.push(notesData);
            }
          });

          exportData.push({});
        });
      });

      exportData.push({});
    });

    const quarterText = selectedQuarters.map(q => `C${q}`).join('_');
    exportToExcel(exportData, `Gosterge_Performansi_${quarterText}_${currentYear}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const stats = getIndicatorStats();

    const totalProgress = filteredIndicators.length > 0
      ? Math.round(
          filteredIndicators.reduce((sum, ind) => sum + calculateSelectedProgress(ind), 0) /
          filteredIndicators.length
        )
      : 0;

    const groupedByPlan = filteredIndicators.reduce((acc, ind) => {
      const planKey = ind.strategic_plan_id || 'no-plan';
      if (!acc[planKey]) {
        acc[planKey] = {
          name: ind.plan_name,
          objectives: {}
        };
      }

      const objKey = ind.objective_id || 'no-objective';
      if (!acc[planKey].objectives[objKey]) {
        acc[planKey].objectives[objKey] = {
          title: ind.objective_title,
          goals: {}
        };
      }

      const goalKey = ind.goal_id;
      if (!acc[planKey].objectives[objKey].goals[goalKey]) {
        acc[planKey].objectives[objKey].goals[goalKey] = {
          title: ind.goal_title,
          department: ind.department_name,
          indicators: []
        };
      }

      acc[planKey].objectives[objKey].goals[goalKey].indicators.push(ind);
      return acc;
    }, {} as Record<string, any>);

    // Stratejik plan istatistiklerini hesapla
    const totalObjectives = new Set();
    const totalGoals = new Set();
    const totalIndicators = filteredIndicators.length;

    filteredIndicators.forEach(ind => {
      if (ind.objective_id) totalObjectives.add(ind.objective_id);
      if (ind.goal_id) totalGoals.add(ind.goal_id);
    });

    const organizationName = organization?.name || 'Kurum';

    let contentHTML = `
      <div style="page-break-inside: avoid;">
        <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
          <h1 style="margin: 0 0 10px 0; font-size: 28px;">Kurum Genel Durumu - ${currentYear}</h1>
          <h2 style="margin: 0 0 15px 0; font-size: 20px; font-weight: normal; opacity: 0.9;">${organizationName}</h2>
          <div style="margin-top: 20px; padding: 15px; background-color: rgba(255, 255, 255, 0.2); border-radius: 8px; display: inline-block;">
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 5px;">${totalProgress}%</div>
            <div style="font-size: 16px; opacity: 0.95;">Genel İlerleme Oranı</div>
          </div>
        </div>

        <div style="margin-bottom: 20px; padding: 20px; background-color: #ede9fe; border-left: 5px solid #8b5cf6; border-radius: 5px;">
          <h3 style="margin: 0 0 15px 0; color: #5b21b6; font-size: 18px;">Stratejik Plan İstatistikleri</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #6d28d9; margin-bottom: 5px;">${totalObjectives.size}</div>
              <div style="font-size: 13px; color: #6b7280;">Toplam Amaç</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #7c3aed; margin-bottom: 5px;">${totalGoals.size}</div>
              <div style="font-size: 13px; color: #6b7280;">Toplam Hedef</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #8b5cf6; margin-bottom: 5px;">${totalIndicators}</div>
              <div style="font-size: 13px; color: #6b7280;">Toplam Gösterge</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px; padding: 20px; background-color: #f0fdf4; border-left: 5px solid #10b981; border-radius: 5px;">
          <h3 style="margin: 0 0 15px 0; color: #065f46; font-size: 18px;">Performans Özeti</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #a855f7; margin-bottom: 5px;">${stats.exceedingTarget}</div>
              <div style="font-size: 13px; color: #6b7280;">Hedef Üstü</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #10b981; margin-bottom: 5px;">${stats.excellent}</div>
              <div style="font-size: 13px; color: #6b7280;">Çok İyi</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #22c55e; margin-bottom: 5px;">${stats.good}</div>
              <div style="font-size: 13px; color: #6b7280;">İyi</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #eab308; margin-bottom: 5px;">${stats.moderate}</div>
              <div style="font-size: 13px; color: #6b7280;">Orta</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #ef4444; margin-bottom: 5px;">${stats.weak}</div>
              <div style="font-size: 13px; color: #6b7280;">Zayıf</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 32px; font-weight: bold; color: #f59e0b; margin-bottom: 5px;">${stats.veryWeak}</div>
              <div style="font-size: 13px; color: #6b7280;">Çok Zayıf</div>
            </div>
          </div>
        </div>
      </div>

      <div style="page-break-before: always;"></div>
      <h2 style="margin-top: 0; color: #1e293b; font-size: 22px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">Detaylı Gösterge Analizi</h2>
    `;

    Object.entries(groupedByPlan).forEach(([planId, planData]) => {
      const planIndicators = filteredIndicators.filter(i => (i.strategic_plan_id || 'no-plan') === planId);
      const planStats = createEmptyStats();
      planIndicators.forEach(ind => {
        const progress = calculateSelectedProgress(ind);
        const status = getIndicatorStatus(progress);
        incrementStatusInStats(planStats, status);
      });

      const planSuccessRate = planStats.total > 0
        ? Math.round((planStats.exceedingTarget + planStats.excellent + planStats.good) / planStats.total * 100)
        : 0;

      contentHTML += `
        <div style="margin-top: 25px; page-break-inside: avoid;">
          <h2 style="color: #7c3aed; font-size: 18px; font-weight: bold; margin: 0 0 15px 0; padding: 10px; background-color: #f5f3ff; border-left: 5px solid #7c3aed;">
            ${planData.name}
          </h2>
        </div>
      `;

      Object.entries(planData.objectives).forEach(([objId, objData]) => {
        contentHTML += `
          <div style="margin-top: 15px; margin-left: 10px; page-break-inside: avoid;">
            <h3 style="color: #1e40af; font-size: 16px; font-weight: bold; margin: 0 0 10px 0; padding: 8px; background-color: #eff6ff; border-left: 4px solid #1e40af;">
              AMAÇ: ${objData.title}
            </h3>
          </div>
        `;

        Object.entries(objData.goals).forEach(([goalId, goalData]: [string, any], goalIndex: number) => {
          const isFirstGoal = goalIndex === 0;
          const pageBreakBefore = isFirstGoal ? '' : 'page-break-before: always;';

          contentHTML += `
            <div style="margin-top: 12px; margin-left: 20px; ${pageBreakBefore}">
              <h4 style="color: #059669; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; padding: 6px; background-color: #f0fdf4; border-left: 3px solid #059669; display: flex; justify-content: space-between; align-items: center;">
                <span>HEDEF: ${goalData.title}</span>
                <span style="font-size: 11px; background-color: #dcfce7; padding: 2px 8px; border-radius: 4px;">[${goalData.department}]</span>
              </h4>
            </div>
          `;

          const headers = ['Kod', 'Gösterge'];
          if (selectedQuarters.includes(1)) headers.push('Ç1');
          if (selectedQuarters.includes(2)) headers.push('Ç2');
          if (selectedQuarters.includes(3)) headers.push('Ç3');
          if (selectedQuarters.includes(4)) headers.push('Ç4');
          headers.push('Toplam Veri', 'Başlangıç', 'Hedef', 'İlerleme Durumu', 'Başarı Düzeyi');

          const rows: any[] = [];

          goalData.indicators.forEach((ind: IndicatorData) => {
            const currentValue = calculateCurrentValue(ind);
            const isAverage = ['maintenance', 'maintenance_increasing', 'maintenance_decreasing', 'percentage', 'percentage_increasing', 'percentage_decreasing'].includes(ind.calculation_method || 'cumulative');
            const progressValue = calculateSelectedProgress(ind);
            const statusLabel = getStatusLabel(getIndicatorStatus(progressValue));
            const statusConfig = getStatusConfig(getIndicatorStatus(progressValue));

            const row: any[] = [
              ind.code,
              `${ind.name}<br/><span style="font-size: 10px; color: #6b7280;">${isAverage ? '(Ortalama)' : '(Toplam)'}</span>`,
            ];

            if (selectedQuarters.includes(1)) row.push(ind.q1_value);
            if (selectedQuarters.includes(2)) row.push(ind.q2_value);
            if (selectedQuarters.includes(3)) row.push(ind.q3_value);
            if (selectedQuarters.includes(4)) row.push(ind.q4_value);

            const colorMap: Record<string, string> = {
              'text-purple-600': '#9333ea',
              'text-green-700': '#15803d',
              'text-green-600': '#16a34a',
              'text-yellow-600': '#ca8a04',
              'text-red-600': '#dc2626',
              'text-amber-800': '#92400e',
              'bg-purple-600': '#9333ea',
              'bg-green-700': '#15803d',
              'bg-green-600': '#16a34a',
              'bg-yellow-500': '#eab308',
              'bg-red-600': '#dc2626',
              'bg-amber-600': '#d97706',
              'bg-purple-100': '#f3e8ff',
              'bg-green-100': '#dcfce7',
              'bg-yellow-100': '#fef9c3',
              'bg-red-100': '#fee2e2',
              'bg-amber-100': '#fef3c7'
            };

            const textColor = colorMap[statusConfig.color] || '#374151';
            const barColor = colorMap[statusConfig.progressBarColor] || '#3b82f6';
            const bgColor = colorMap[statusConfig.bgColor] || '#f3f4f6';

            row.push(
              `<strong>${currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</strong> ${ind.unit}`,
              `${ind.baseline_value} ${ind.unit}`,
              `${ind.target_value} ${ind.unit}`,
              `<div style="text-align: center;">
                <div style="font-weight: bold; color: ${textColor}; margin-bottom: 3px;">${Math.round(progressValue)}%</div>
                <div style="background-color: #e5e7eb; border-radius: 10px; height: 6px; overflow: hidden;">
                  <div style="height: 100%; background-color: ${barColor}; width: ${Math.min(100, progressValue)}%;"></div>
                </div>
              </div>`,
              `<span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background-color: ${bgColor}; color: ${textColor};">${statusLabel}</span>`
            );

            rows.push(row);

            if (!hideNotes && (ind.q1_notes || ind.q2_notes || ind.q3_notes || ind.q4_notes)) {
              const notesRow: any[] = ['', '<i>Açıklamalar:</i>'];

              if (selectedQuarters.includes(1)) notesRow.push(`<i>${ind.q1_notes || '-'}</i>`);
              if (selectedQuarters.includes(2)) notesRow.push(`<i>${ind.q2_notes || '-'}</i>`);
              if (selectedQuarters.includes(3)) notesRow.push(`<i>${ind.q3_notes || '-'}</i>`);
              if (selectedQuarters.includes(4)) notesRow.push(`<i>${ind.q4_notes || '-'}</i>`);

              notesRow.push('', '', '', '', '');
              rows.push(notesRow);
            }
          });

          contentHTML += `<div style="margin-left: 30px; margin-bottom: 15px;">${generateTableHTML(headers, rows)}</div>`;
        });
      });
    });

    exportToPDF(`Gösterge Performans Raporu - ${currentYear}`, contentHTML, `Gosterge_Performansi_${currentYear}_${new Date().toISOString().split('T')[0]}`);
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  const stats = getIndicatorStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gösterge Performans Raporu</h2>
          <p className="text-sm text-slate-600 mt-1">
            Çeyrek dönem bazında detaylı gösterge analizi
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-600 mt-1">Toplam Gösterge</div>
        </div>
        <button
          onClick={() => stats.exceedingTarget > 0 && loadIndicatorDetails('exceeding_target')}
          disabled={stats.exceedingTarget === 0}
          className={`bg-purple-50 border border-purple-200 rounded-lg p-4 text-center transition-all ${
            stats.exceedingTarget > 0 ? 'hover:bg-purple-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-purple-600">{stats.exceedingTarget}</div>
          <div className="text-sm text-slate-600 mt-1">Hedef Üstü</div>
        </button>
        <button
          onClick={() => stats.excellent > 0 && loadIndicatorDetails('excellent')}
          disabled={stats.excellent === 0}
          className={`bg-green-100 border border-green-300 rounded-lg p-4 text-center transition-all ${
            stats.excellent > 0 ? 'hover:bg-green-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-green-700">{stats.excellent}</div>
          <div className="text-sm text-slate-600 mt-1">Çok İyi</div>
        </button>
        <button
          onClick={() => stats.good > 0 && loadIndicatorDetails('good')}
          disabled={stats.good === 0}
          className={`bg-green-50 border border-green-200 rounded-lg p-4 text-center transition-all ${
            stats.good > 0 ? 'hover:bg-green-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-green-600">{stats.good}</div>
          <div className="text-sm text-slate-600 mt-1">İyi</div>
        </button>
        <button
          onClick={() => stats.moderate > 0 && loadIndicatorDetails('moderate')}
          disabled={stats.moderate === 0}
          className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center transition-all ${
            stats.moderate > 0 ? 'hover:bg-yellow-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-yellow-600">{stats.moderate}</div>
          <div className="text-sm text-slate-600 mt-1">Orta</div>
        </button>
        <button
          onClick={() => stats.weak > 0 && loadIndicatorDetails('weak')}
          disabled={stats.weak === 0}
          className={`bg-red-50 border border-red-200 rounded-lg p-4 text-center transition-all ${
            stats.weak > 0 ? 'hover:bg-red-100 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-red-600">{stats.weak}</div>
          <div className="text-sm text-slate-600 mt-1">Zayıf</div>
        </button>
        <button
          onClick={() => stats.veryWeak > 0 && loadIndicatorDetails('very_weak')}
          disabled={stats.veryWeak === 0}
          className={`bg-amber-100 border border-amber-300 rounded-lg p-4 text-center transition-all ${
            stats.veryWeak > 0 ? 'hover:bg-amber-200 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="text-3xl font-bold text-amber-800">{stats.veryWeak}</div>
          <div className="text-sm text-slate-600 mt-1">Çok Zayıf</div>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">Filtreler</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Birim
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Birimler</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Stratejik Plan
            </label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Planlar</option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700">
              Rapor Dönemi Seçimi
            </label>
            <button
              onClick={() => setHideNotes(!hideNotes)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                hideNotes
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {hideNotes ? 'Açıklamaları Göster' : 'Açıklamaları Kaldır'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleAllQuarters}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedQuarters.length === 4
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {selectedQuarters.length === 4 ? 'Tümünü Kaldır' : 'Tümünü Seç'}
            </button>
            {[1, 2, 3, 4].map(quarter => (
              <label
                key={quarter}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedQuarters.includes(quarter)}
                  onChange={() => toggleQuarter(quarter)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Ç{quarter}</span>
              </label>
            ))}
            {selectedQuarters.length > 0 && (
              <span className="ml-2 text-xs text-slate-500">
                ({selectedQuarters.length} çeyrek seçili)
              </span>
            )}
          </div>
        </div>
      </div>

      {filteredIndicators.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Gösterge bulunmuyor</p>
        </div>
      ) : selectedQuarters.length === 0 ? (
        <div className="text-center py-12 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-700 font-medium">Lütfen en az bir çeyrek seçin</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const groupedByPlan = filteredIndicators.reduce((acc, ind) => {
              const planKey = ind.strategic_plan_id || 'no-plan';
              if (!acc[planKey]) {
                acc[planKey] = {
                  name: ind.plan_name,
                  objectives: {}
                };
              }

              const objKey = ind.objective_id || 'no-objective';
              if (!acc[planKey].objectives[objKey]) {
                acc[planKey].objectives[objKey] = {
                  title: ind.objective_title,
                  goals: {}
                };
              }

              const goalKey = ind.goal_id;
              if (!acc[planKey].objectives[objKey].goals[goalKey]) {
                acc[planKey].objectives[objKey].goals[goalKey] = {
                  title: ind.goal_title,
                  department: ind.department_name,
                  indicators: []
                };
              }

              acc[planKey].objectives[objKey].goals[goalKey].indicators.push(ind);
              return acc;
            }, {} as Record<string, any>);

            return Object.entries(groupedByPlan).map(([planId, planData]) => (
              <div key={planId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-purple-50 border-b border-purple-200 px-4 py-3">
                  <h3 className="text-lg font-bold text-purple-900">{planData.name}</h3>
                </div>

                {Object.entries(planData.objectives).map(([objId, objData]) => (
                  <div key={objId} className="border-b border-slate-200">
                    <div className="bg-blue-50 px-4 py-2.5">
                      <h4 className="text-sm font-semibold text-blue-900">AMAÇ: {objData.title}</h4>
                    </div>

                    {Object.entries(objData.goals).map(([goalId, goalData]: [string, any]) => {
                      const goalProgress = calculateGoalProgress(goalId, indicators, dataEntries);

                      return (
                      <div key={goalId} className="border-b border-slate-100 last:border-b-0">
                        <div className="bg-green-50 px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <h5 className="text-sm font-medium text-green-900">HEDEF: {goalData.title}</h5>
                              <div className="flex items-center gap-2">
                                <div className={`text-sm font-semibold ${getProgressTextColor(goalProgress)}`}>
                                  {Math.round(goalProgress)}%
                                </div>
                                <div className="w-24 bg-green-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${getProgressColor(goalProgress)}`}
                                    style={{ width: `${Math.min(100, goalProgress)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                              {goalData.department}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Kod</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Gösterge</th>
                                {selectedQuarters.includes(1) && (
                                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Ç1</th>
                                )}
                                {selectedQuarters.includes(2) && (
                                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Ç2</th>
                                )}
                                {selectedQuarters.includes(3) && (
                                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Ç3</th>
                                )}
                                {selectedQuarters.includes(4) && (
                                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Ç4</th>
                                )}
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase bg-blue-50">Toplam Veri</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Başlangıç</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Hedef</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">İlerleme Durumu</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Başarı Düzeyi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {goalData.indicators.map((ind: IndicatorData) => {
                                const selectedProgress = calculateSelectedProgress(ind);
                                const selectedTotal = calculateSelectedTotal(ind);
                                const hasNotes = selectedQuarters.some(q => {
                                  const noteKey = `q${q}_notes` as keyof typeof ind;
                                  return ind[noteKey];
                                });
                                const isAverage = ['maintenance', 'maintenance_increasing', 'maintenance_decreasing', 'percentage', 'percentage_increasing', 'percentage_decreasing'].includes(ind.calculation_method || 'cumulative');

                                return (
                                  <React.Fragment key={ind.id}>
                                    <tr className="hover:bg-slate-50">
                                      <td className="px-4 py-3 text-sm text-slate-900">{ind.code}</td>
                                      <td className="px-4 py-3">
                                        <div className="text-sm font-medium text-slate-900">{ind.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                          {isAverage ? '(Ortalama)' : '(Toplam)'}
                                        </div>
                                      </td>
                                      {selectedQuarters.includes(1) && (
                                        <td className="px-4 py-3 text-center text-sm text-slate-700">{ind.q1_value}</td>
                                      )}
                                      {selectedQuarters.includes(2) && (
                                        <td className="px-4 py-3 text-center text-sm text-slate-700">{ind.q2_value}</td>
                                      )}
                                      {selectedQuarters.includes(3) && (
                                        <td className="px-4 py-3 text-center text-sm text-slate-700">{ind.q3_value}</td>
                                      )}
                                      {selectedQuarters.includes(4) && (
                                        <td className="px-4 py-3 text-center text-sm text-slate-700">{ind.q4_value}</td>
                                      )}
                                      <td className="px-4 py-3 text-center text-sm font-medium text-slate-900 bg-blue-50">
                                        {calculateCurrentValue(ind).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {ind.unit}
                                      </td>
                                      <td className="px-4 py-3 text-center text-sm text-slate-700">
                                        {ind.baseline_value} {ind.unit}
                                      </td>
                                      <td className="px-4 py-3 text-center text-sm text-slate-700">
                                        {ind.target_value} {ind.unit}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                          <div
                                            className={`text-sm font-medium ${getStatusConfig(getIndicatorStatus(selectedProgress)).color}`}
                                          >
                                            {Math.round(selectedProgress)}%
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                              className={`h-2 rounded-full ${getStatusConfig(getIndicatorStatus(selectedProgress)).progressBarColor}`}
                                              style={{ width: `${Math.min(100, selectedProgress)}%` }}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${getStatusConfig(getIndicatorStatus(selectedProgress)).bgColor} ${getStatusConfig(getIndicatorStatus(selectedProgress)).color}`}>
                                          {getStatusLabel(getIndicatorStatus(selectedProgress))}
                                        </span>
                                      </td>
                                    </tr>
                                    {!hideNotes && hasNotes && (
                                      <tr className="bg-slate-50">
                                        <td className="px-4 py-2"></td>
                                        <td className="px-4 py-2 text-xs font-medium text-slate-500">Açıklamalar:</td>
                                        {selectedQuarters.includes(1) && (
                                          <td className="px-4 py-2 text-xs text-slate-600 italic">{ind.q1_notes || '-'}</td>
                                        )}
                                        {selectedQuarters.includes(2) && (
                                          <td className="px-4 py-2 text-xs text-slate-600 italic">{ind.q2_notes || '-'}</td>
                                        )}
                                        {selectedQuarters.includes(3) && (
                                          <td className="px-4 py-2 text-xs text-slate-600 italic">{ind.q3_notes || '-'}</td>
                                        )}
                                        {selectedQuarters.includes(4) && (
                                          <td className="px-4 py-2 text-xs text-slate-600 italic">{ind.q4_notes || '-'}</td>
                                        )}
                                        <td className="px-4 py-2"></td>
                                        <td className="px-4 py-2"></td>
                                        <td className="px-4 py-2"></td>
                                        <td className="px-4 py-2"></td>
                                        <td className="px-4 py-2"></td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}

      <Modal
        isOpen={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        title={`${selectedStatus ? getStatusLabel(selectedStatus) : ''} Göstergeler`}
        size="large"
      >
        <div className="space-y-4">
          {loadingIndicators ? (
            <div className="text-center py-8 text-slate-500">Göstergeler yükleniyor...</div>
          ) : indicatorDetails.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Bu kategoride gösterge bulunmuyor</div>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-600">
                      Toplam <span className="font-bold text-slate-900">{indicatorDetails.length}</span> gösterge
                    </div>
                    {selectedStatus && (
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColorClass(selectedStatus)}`}>
                        {getStatusLabel(selectedStatus)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportIndicatorDetailsExcel}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={handleExportIndicatorDetailsPDF}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>
              </div>

              {indicatorDetails.map((indicator) => (
                <div
                  key={indicator.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {indicator.code}
                        </span>
                        {selectedStatus && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColorClass(selectedStatus)}`}>
                            {getStatusLabel(selectedStatus)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-slate-900 mb-3">{indicator.name}</h4>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Gerçekleşen</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {indicator.current_value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Hedef</div>
                          <div className="text-lg font-semibold text-slate-700">
                            {indicator.target_value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">İlerleme</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {Math.round(indicator.progress)}%
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${getStatusConfig(indicator.status).progressBarColor}`}
                            style={{ width: `${Math.min(indicator.progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => setShowIndicatorModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
