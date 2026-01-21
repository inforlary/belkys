import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Filter, TrendingUp, FileText } from 'lucide-react';
import { exportToExcel, exportToPDF, generateTableHTML } from '../../utils/exportHelpers';
import { calculateIndicatorProgress } from '../../utils/progressCalculations';

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
}

interface IndicatorPerformanceProps {
  selectedYear?: number;
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

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  useEffect(() => {
    applyFilters();
  }, [selectedDepartment, selectedPlan, indicators]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      console.log('No organization_id found in profile');
      return;
    }

    try {
      console.log('Loading indicators for organization:', profile.organization_id, 'year:', currentYear);

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

      console.log('Allowed goals for user:', allowedGoalIds.length);

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
        .eq('organization_id', profile.organization_id)
        .order('code');

      // Filter by allowed goals
      if (allowedGoalIds.length > 0) {
        indicatorsQuery = indicatorsQuery.in('goal_id', allowedGoalIds);
      } else if (profile.role !== 'admin' && profile.role !== 'manager') {
        // Non-admin/non-manager with no goals sees nothing
        indicatorsQuery = indicatorsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      const [depsData, plansData, indicatorsData] = await Promise.all([
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
      ]);

      console.log('Departments loaded:', depsData.data?.length || 0);
      console.log('Plans loaded:', plansData.data?.length || 0);
      console.log('Indicators loaded:', indicatorsData.data?.length || 0);

      if (depsData.error) console.error('Department error:', JSON.stringify(depsData.error, null, 2));
      if (plansData.error) console.error('Plans error:', JSON.stringify(plansData.error, null, 2));
      if (indicatorsData.error) {
        console.error('Indicators error:', JSON.stringify(indicatorsData.error, null, 2));
        console.error('Full indicators response:', indicatorsData);
      }

      setDepartments(depsData.data || []);
      setPlans(plansData.data || []);

      if (indicatorsData.data && indicatorsData.data.length > 0) {
        const indicatorIds = indicatorsData.data.map(i => i.id);
        console.log('Processing', indicatorIds.length, 'indicators');

        const [entriesData, targetsData] = await Promise.all([
          supabase
            .from('indicator_data_entries')
            .select('indicator_id, period_quarter, value, status, notes')
            .eq('period_year', currentYear)
            .in('status', ['approved', 'submitted'])
            .in('indicator_id', indicatorIds),
          supabase
            .from('indicator_targets')
            .select('indicator_id, target_value')
            .eq('year', currentYear)
            .in('indicator_id', indicatorIds),
        ]);

        console.log('Entries loaded:', entriesData.data?.length || 0);
        console.log('Targets loaded:', targetsData.data?.length || 0);

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
          };
        });

        console.log('Sample indicator data:', processedIndicators[0]);
        console.log('First 3 indicators dept IDs:', processedIndicators.slice(0, 3).map(i => ({ name: i.name, dept_id: i.department_id, plan_id: i.strategic_plan_id })));

        setIndicators(processedIndicators);
        console.log('Final processed indicators:', processedIndicators.length);
      } else {
        setIndicators([]);
        console.log('No indicators data to process');
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...indicators];

    console.log('Applying filters. Total indicators:', indicators.length);
    console.log('Selected department:', selectedDepartment);
    console.log('Selected plan:', selectedPlan);

    if (selectedDepartment) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(i => i.department_id === selectedDepartment);
      console.log('After department filter:', filtered.length, 'from', beforeFilter);
    }

    if (selectedPlan) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(i => i.strategic_plan_id === selectedPlan);
      console.log('After plan filter:', filtered.length, 'from', beforeFilter);
    }

    console.log('Final filtered indicators:', filtered.length);
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
    let exceedingTarget = 0;
    let onTrack = 0;
    let atRisk = 0;
    let behind = 0;

    filteredIndicators.forEach(ind => {
      const progress = calculateSelectedProgress(ind);
      if (progress >= 200) exceedingTarget++;
      else if (progress >= 70) onTrack++;
      else if (progress >= 50) atRisk++;
      else behind++;
    });

    return { exceedingTarget, onTrack, atRisk, behind, total: filteredIndicators.length };
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

    let sum = 0;
    let count = 0;
    if (selectedQuarters.includes(1)) { sum += ind.q1_value; count++; }
    if (selectedQuarters.includes(2)) { sum += ind.q2_value; count++; }
    if (selectedQuarters.includes(3)) { sum += ind.q3_value; count++; }
    if (selectedQuarters.includes(4)) { sum += ind.q4_value; count++; }

    if (count === 0) return 0;

    const baselineValue = ind.baseline_value || 0;
    const targetValue = ind.target_value;
    const calculationMethod = ind.calculation_method || 'cumulative';

    if (targetValue === 0 || targetValue === null) return 0;

    let currentValue = 0;
    let progress = 0;

    switch (calculationMethod) {
      case 'cumulative':
      case 'cumulative_increasing':
      case 'increasing': {
        currentValue = baselineValue + sum;
        const denominator = targetValue - baselineValue;
        if (denominator === 0) {
          progress = targetValue === 0 ? 0 : (currentValue / targetValue) * 100;
        } else {
          progress = ((currentValue - baselineValue) / denominator) * 100;
        }
        break;
      }

      case 'cumulative_decreasing':
      case 'decreasing': {
        currentValue = baselineValue - sum;
        const denominator = targetValue - baselineValue;
        if (denominator === 0) {
          progress = targetValue === 0 ? 0 : (currentValue / targetValue) * 100;
        } else {
          progress = ((currentValue - baselineValue) / denominator) * 100;
        }
        break;
      }

      case 'percentage':
      case 'percentage_increasing': {
        const average = sum / count;
        progress = (average / targetValue) * 100;
        break;
      }

      case 'percentage_decreasing': {
        const average = sum / count;
        if (average === 0) return 0;
        progress = (targetValue / average) * 100;
        break;
      }

      case 'maintenance':
      case 'maintenance_increasing': {
        const average = sum / count;
        progress = (average / targetValue) * 100;
        break;
      }

      case 'maintenance_decreasing': {
        const average = sum / count;
        if (average === 0) return 0;
        progress = (targetValue / average) * 100;
        break;
      }

      default: {
        currentValue = baselineValue + sum;
        const denominator = targetValue - baselineValue;
        if (denominator === 0) {
          progress = targetValue === 0 ? 0 : (currentValue / targetValue) * 100;
        } else {
          progress = ((currentValue - baselineValue) / denominator) * 100;
        }
        break;
      }
    }

    return Math.max(0, Math.round(progress));
  };

  const handleExport = () => {
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

            data['Toplam Veri'] = selectedTotal + (isAverage ? ' (Ortalama)' : ' (Toplam)');
            data['Başlangıç'] = ind.baseline_value;
            data['Hedef'] = ind.target_value;
            data['İlerleme Durumu'] = `${Math.round(calculateSelectedProgress(ind))}%`;

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

              exportData.push(notesData);
            }
          });

          exportData.push({});
        });
      });

      exportData.push({});
    });

    const quarterText = selectedQuarters.map(q => `C${q}`).join('_');
    exportToExcel(exportData, `Gosterge_Performansi_${quarterText}`);
  };

  const handlePDFExport = () => {
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

    let contentHTML = `
      <h2>Gösterge Performans Raporu - ${currentYear}</h2>
      <p><strong>Seçili Çeyrekler:</strong> ${selectedQuarters.map(q => `Ç${q}`).join(', ')}</p>
      <p><strong>Toplam Gösterge:</strong> ${filteredIndicators.length}</p>
    `;

    Object.entries(groupedByPlan).forEach(([planId, planData]) => {
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

        Object.entries(objData.goals).forEach(([goalId, goalData]: [string, any]) => {
          contentHTML += `
            <div style="margin-top: 12px; margin-left: 20px; page-break-inside: avoid;">
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
          headers.push('Toplam Veri', 'Başlangıç', 'Hedef', 'İlerleme Durumu');

          const rows: any[] = [];

          goalData.indicators.forEach((ind: IndicatorData) => {
            const selectedTotal = calculateSelectedTotal(ind);
            const isAverage = ['maintenance', 'maintenance_increasing', 'maintenance_decreasing', 'percentage', 'percentage_increasing', 'percentage_decreasing'].includes(ind.calculation_method || 'cumulative');

            const row: any[] = [
              ind.code,
              ind.name + (isAverage ? ' (Ortalama)' : ' (Toplam)'),
            ];

            if (selectedQuarters.includes(1)) row.push(ind.q1_value);
            if (selectedQuarters.includes(2)) row.push(ind.q2_value);
            if (selectedQuarters.includes(3)) row.push(ind.q3_value);
            if (selectedQuarters.includes(4)) row.push(ind.q4_value);

            row.push(
              selectedTotal,
              ind.baseline_value,
              ind.target_value,
              `${Math.round(calculateSelectedProgress(ind))}%`
            );

            rows.push(row);

            if (!hideNotes && (ind.q1_notes || ind.q2_notes || ind.q3_notes || ind.q4_notes)) {
              const notesRow: any[] = ['', '<i>Açıklamalar:</i>'];

              if (selectedQuarters.includes(1)) notesRow.push(`<i>${ind.q1_notes || '-'}</i>`);
              if (selectedQuarters.includes(2)) notesRow.push(`<i>${ind.q2_notes || '-'}</i>`);
              if (selectedQuarters.includes(3)) notesRow.push(`<i>${ind.q3_notes || '-'}</i>`);
              if (selectedQuarters.includes(4)) notesRow.push(`<i>${ind.q4_notes || '-'}</i>`);

              notesRow.push('', '', '', '');
              rows.push(notesRow);
            }
          });

          contentHTML += `<div style="margin-left: 30px; margin-bottom: 15px;">${generateTableHTML(headers, rows)}</div>`;
        });
      });
    });

    exportToPDF('Gösterge Performans Raporu', contentHTML);
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
            onClick={handlePDFExport}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF'e Aktar
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-600 mt-1">Toplam Gösterge</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{stats.exceedingTarget}</div>
          <div className="text-sm text-slate-600 mt-1">Hedef Sapması</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.onTrack}</div>
          <div className="text-sm text-slate-600 mt-1">Hedefte</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.atRisk}</div>
          <div className="text-sm text-slate-600 mt-1">Risk Altında</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.behind}</div>
          <div className="text-sm text-slate-600 mt-1">Geride</div>
        </div>
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

                    {Object.entries(objData.goals).map(([goalId, goalData]: [string, any]) => (
                      <div key={goalId} className="border-b border-slate-100 last:border-b-0">
                        <div className="bg-green-50 px-4 py-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-green-900">HEDEF: {goalData.title}</h5>
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
                                        {selectedTotal} {ind.unit}
                                      </td>
                                      <td className="px-4 py-3 text-center text-sm text-slate-700">
                                        {ind.baseline_value} {ind.unit}
                                      </td>
                                      <td className="px-4 py-3 text-center text-sm text-slate-700">
                                        {ind.target_value} {ind.unit}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <div
                                            className={`text-sm font-medium ${
                                              selectedProgress >= 70 ? 'text-green-600' : selectedProgress >= 50 ? 'text-yellow-600' : 'text-red-600'
                                            }`}
                                          >
                                            {Math.round(selectedProgress)}%
                                          </div>
                                          {selectedProgress >= 70 && <TrendingUp className="w-4 h-4 text-green-600" />}
                                        </div>
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
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
