import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import {
  User,
  Building2,
  Target,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';
import type { Profile, Department } from '../types/database';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  calculateIndicatorProgress,
  calculateGoalProgress,
  getProgressColor,
  getProgressTextColor
} from '../utils/progressCalculations';

interface VPWithDepartments {
  id: string;
  full_name: string;
  email: string;
  departments: Department[];
}

interface IndicatorDetail {
  id: string;
  code: string;
  name: string;
  unit: string;
  target_value: number | null;
  baseline_value: number | null;
  calculation_method: string;
  measurement_frequency: string;
  goal_id: string;
  goal_code: string;
  goal_title: string;
  objective_code: string;
  objective_title: string;
  yearly_target: number | null;
  yearly_baseline: number;
  progress: number;
  current_value: number;
}

interface GoalDetail {
  id: string;
  code: string;
  title: string;
  objective_code: string;
  objective_title: string;
  progress: number;
  indicators: IndicatorDetail[];
}

interface DepartmentPerformance {
  department_id: string;
  department_name: string;
  total_indicators: number;
  total_goals: number;
  performance_percentage: number;
  goals: GoalDetail[];
}

interface VPPerformance {
  vp_id: string;
  vp_name: string;
  vp_email: string;
  total_departments: number;
  total_indicators: number;
  overall_performance: number;
  departments: DepartmentPerformance[];
}

export default function VPPerformanceAnalysis2() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [vpPerformances, setVPPerformances] = useState<VPPerformance[]>([]);
  const [expandedVPs, setExpandedVPs] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [selectedYear, profile?.organization_id]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [plansRes, vpsRes, assignmentsRes, goalsRes, indicatorsRes, entriesRes, targetsRes] = await Promise.all([
        supabase
          .from('strategic_plans')
          .select('id, start_year, end_year')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('organization_id', profile.organization_id)
          .eq('role', 'vice_president')
          .order('full_name'),
        supabase
          .from('vice_president_departments')
          .select(`
            vice_president_id,
            department_id,
            departments!inner(
              id,
              name,
              code
            )
          `),
        supabase
          .from('goals')
          .select(`
            id,
            code,
            title,
            department_id,
            objective_id,
            objectives!inner(
              id,
              code,
              title,
              strategic_plan_id
            )
          `)
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicators')
          .select('id, code, name, unit, goal_id, target_value, baseline_value, calculation_method, measurement_frequency, goal_impact_percentage'),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status, period_year')
          .eq('period_year', selectedYear)
          .eq('status', 'approved'),
        supabase
          .from('indicator_targets')
          .select('indicator_id, year, target_value')
          .eq('year', selectedYear)
      ]);

      if (plansRes.error) throw plansRes.error;
      if (vpsRes.error) throw vpsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (indicatorsRes.error) throw indicatorsRes.error;

      const plans = plansRes.data || [];
      const vps = vpsRes.data || [];
      const assignments = assignmentsRes.data || [];
      const allGoals = goalsRes.data || [];
      const allIndicators = indicatorsRes.data || [];
      const allEntries = entriesRes.data || [];
      const allTargets = targetsRes.data || [];

      const relevantPlans = plans.filter(plan =>
        selectedYear >= plan.start_year && selectedYear <= plan.end_year
      );

      if (relevantPlans.length === 0) {
        setVPPerformances([]);
        return;
      }

      const relevantPlanIds = new Set(relevantPlans.map(p => p.id));

      const filteredGoals = allGoals.filter(g =>
        g.objectives && relevantPlanIds.has((g.objectives as any).strategic_plan_id)
      );

      const goalIds = new Set(filteredGoals.map(g => g.id));
      const filteredIndicators = allIndicators.filter(i => goalIds.has(i.goal_id));

      const targetsByIndicator: Record<string, number> = {};
      allTargets.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      const indicatorsWithYearlyTargets = filteredIndicators.map(ind => ({
        ...ind,
        yearly_target: targetsByIndicator[ind.id] || ind.target_value
      }));

      const indicatorsByGoal: Record<string, any[]> = {};
      indicatorsWithYearlyTargets.forEach(ind => {
        if (!indicatorsByGoal[ind.goal_id]) {
          indicatorsByGoal[ind.goal_id] = [];
        }
        indicatorsByGoal[ind.goal_id].push(ind);
      });

      const goalsByDepartment: Record<string, any[]> = {};
      filteredGoals.forEach(goal => {
        if (goal.department_id) {
          if (!goalsByDepartment[goal.department_id]) {
            goalsByDepartment[goal.department_id] = [];
          }
          goalsByDepartment[goal.department_id].push(goal);
        }
      });

      const assignmentsByVP: Record<string, any[]> = {};
      assignments.forEach(assignment => {
        if (!assignmentsByVP[assignment.vice_president_id]) {
          assignmentsByVP[assignment.vice_president_id] = [];
        }
        assignmentsByVP[assignment.vice_president_id].push(assignment);
      });

      const vpPerformanceData: VPPerformance[] = [];

      for (const vp of vps) {
        const vpAssignments = assignmentsByVP[vp.id] || [];
        const departments = vpAssignments
          .map(a => a.departments)
          .filter(Boolean);

        const departmentPerformances: DepartmentPerformance[] = [];
        let totalIndicatorsForVP = 0;
        let totalPerformanceSum = 0;
        let departmentsWithIndicators = 0;

        for (const dept of departments) {
          const deptGoals = goalsByDepartment[dept.id] || [];

          if (deptGoals.length === 0) {
            departmentPerformances.push({
              department_id: dept.id,
              department_name: dept.name,
              total_indicators: 0,
              total_goals: 0,
              performance_percentage: 0,
              goals: []
            });
            continue;
          }

          const enrichedGoals: GoalDetail[] = [];
          let totalGoalProgress = 0;
          let totalIndicatorsForDept = 0;

          for (const goal of deptGoals) {
            const goalIndicators = indicatorsByGoal[goal.id] || [];
            totalIndicatorsForDept += goalIndicators.length;

            const goalProgress = goalIndicators.length > 0
              ? calculateGoalProgress(goal.id, goalIndicators, allEntries)
              : 0;

            totalGoalProgress += goalProgress;

            const enrichedIndicators: IndicatorDetail[] = goalIndicators.map(ind => {
              const progress = calculateIndicatorProgress(ind, allEntries);
              const indicatorEntries = allEntries.filter(e => e.indicator_id === ind.id);
              const sumOfEntries = indicatorEntries.reduce((sum, entry) => sum + entry.value, 0);
              const baselineValue = ind.baseline_value ?? 0;
              const currentValue = baselineValue + sumOfEntries;

              return {
                id: ind.id,
                code: ind.code,
                name: ind.name,
                unit: ind.unit,
                target_value: ind.target_value,
                baseline_value: ind.baseline_value,
                calculation_method: ind.calculation_method,
                measurement_frequency: ind.measurement_frequency,
                goal_id: ind.goal_id,
                goal_code: goal.code,
                goal_title: goal.title,
                objective_code: (goal.objectives as any)?.code || '',
                objective_title: (goal.objectives as any)?.title || '',
                yearly_target: ind.yearly_target,
                yearly_baseline: baselineValue,
                progress,
                current_value: currentValue
              };
            }).sort((a, b) =>
              a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' })
            );

            enrichedGoals.push({
              id: goal.id,
              code: goal.code,
              title: goal.title,
              objective_code: (goal.objectives as any)?.code || '',
              objective_title: (goal.objectives as any)?.title || '',
              progress: goalProgress,
              indicators: enrichedIndicators
            });
          }

          const performancePercentage = deptGoals.length > 0
            ? Math.round(totalGoalProgress / deptGoals.length)
            : 0;

          departmentPerformances.push({
            department_id: dept.id,
            department_name: dept.name,
            total_indicators: totalIndicatorsForDept,
            total_goals: deptGoals.length,
            performance_percentage: performancePercentage,
            goals: enrichedGoals.sort((a, b) =>
              a.code.localeCompare(b.code, 'tr', { numeric: true, sensitivity: 'base' })
            )
          });

          if (totalIndicatorsForDept > 0) {
            totalIndicatorsForVP += totalIndicatorsForDept;
            totalPerformanceSum += performancePercentage;
            departmentsWithIndicators++;
          }
        }

        const overallPerformance = departmentsWithIndicators > 0
          ? Math.round(totalPerformanceSum / departmentsWithIndicators)
          : 0;

        vpPerformanceData.push({
          vp_id: vp.id,
          vp_name: vp.full_name,
          vp_email: vp.email,
          total_departments: departments.length,
          total_indicators: totalIndicatorsForVP,
          overall_performance: overallPerformance,
          departments: departmentPerformances.sort((a, b) =>
            a.department_name.localeCompare(b.department_name, 'tr')
          )
        });
      }

      setVPPerformances(vpPerformanceData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleVP = (vpId: string) => {
    const newExpanded = new Set(expandedVPs);
    if (newExpanded.has(vpId)) {
      newExpanded.delete(vpId);
    } else {
      newExpanded.add(vpId);
    }
    setExpandedVPs(newExpanded);
  };

  const toggleDepartment = (deptId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepartments(newExpanded);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    vpPerformances.forEach(vp => {
      const sheetData: any[] = [];

      sheetData.push([`${vp.vp_name} - ${vp.total_departments} Müdürlük - ${vp.total_indicators} Gösterge - %${vp.overall_performance} Performans`]);
      sheetData.push([]);
      sheetData.push([`Başkan Yardımcısı: ${vp.vp_name}`]);
      sheetData.push([`Genel Performans: %${vp.overall_performance}`]);
      sheetData.push([`Toplam Müdürlük: ${vp.total_departments}`]);
      sheetData.push([`Toplam Gösterge: ${vp.total_indicators}`]);
      sheetData.push([]);

      vp.departments.forEach(dept => {
        sheetData.push([`Müdürlük: ${dept.department_name}`, `Performans: %${dept.performance_percentage}`, `Toplam Hedef: ${dept.total_goals}`]);
        sheetData.push([]);

        dept.goals.forEach(goal => {
          sheetData.push([`Hedef: ${goal.code} - ${goal.title}`, `Hedef İlerleme: %${goal.progress}`]);
          sheetData.push(['Amaç Kodu', 'Hedef Kodu', 'Gösterge Kodu', 'Gösterge Adı', 'Başlangıç', 'Hedef', 'Gerçekleşme', 'İlerleme %']);

          goal.indicators.forEach(ind => {
            sheetData.push([
              ind.objective_code,
              ind.goal_code,
              ind.code,
              ind.name,
              ind.yearly_baseline || 0,
              ind.yearly_target || '-',
              ind.current_value,
              ind.progress
            ]);
          });

          sheetData.push([]);
        });

        sheetData.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const sanitizedName = vp.vp_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sanitizedName);
    });

    XLSX.writeFile(workbook, `VP_Performans_Analizi_${selectedYear}.xlsx`);
  };

  const getProgressColorRGB = (progress: number): [number, number, number] => {
    if (progress >= 90) return [34, 197, 94];
    if (progress >= 75) return [59, 130, 246];
    if (progress >= 60) return [234, 179, 8];
    if (progress >= 40) return [249, 115, 22];
    return [239, 68, 68];
  };

  const getProgressTextColorRGB = (progress: number): [number, number, number] => {
    if (progress >= 90) return [22, 163, 74];
    if (progress >= 75) return [37, 99, 235];
    if (progress >= 60) return [161, 98, 7];
    if (progress >= 40) return [234, 88, 12];
    return [220, 38, 38];
  };

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: 'a4',
      compress: false,
      putOnlyUsedFonts: true
    });
    let yPos = 20;

    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text('BAŞKAN YARDIMCILARI PERFORMANS ANALİZİ', 148, yPos, { align: 'center' });

    yPos += 10;
    doc.setFont('times', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(71, 85, 105);
    doc.text(`Rapor Yılı: ${selectedYear}`, 148, yPos, { align: 'center' });
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 148, yPos + 7, { align: 'center' });

    vpPerformances.forEach((vp, vpIndex) => {
      if (vpIndex > 0) {
        doc.addPage();
      }
      yPos = 40;

      const vpColor = getProgressColorRGB(vp.overall_performance);
      doc.setFillColor(vpColor[0], vpColor[1], vpColor[2]);
      doc.rect(10, yPos, 277, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('times', 'bold');
      doc.setFontSize(16);
      doc.text(vp.vp_name, 15, yPos + 9);
      doc.setTextColor(30, 41, 59);

      yPos += 17;
      doc.setFontSize(12);
      doc.setFont('times', 'bold');
      doc.text(`${vp.vp_name} - ${vp.total_departments} Müdürlük - ${vp.total_indicators} Gösterge`, 15, yPos);

      const vpTextColor = getProgressTextColorRGB(vp.overall_performance);
      doc.setTextColor(vpTextColor[0], vpTextColor[1], vpTextColor[2]);
      doc.text(`%${vp.overall_performance} Performans`, 185, yPos);
      doc.setTextColor(30, 41, 59);
      doc.setFont('times', 'normal');

      yPos += 9;
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Genel Performans:`, 15, yPos);
      doc.setTextColor(vpTextColor[0], vpTextColor[1], vpTextColor[2]);
      doc.setFont('times', 'bold');
      doc.text(`%${vp.overall_performance}`, 55, yPos);
      doc.setFont('times', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Toplam Müdürlük: ${vp.total_departments}`, 85, yPos);
      doc.text(`Toplam Gösterge: ${vp.total_indicators}`, 155, yPos);

      yPos += 10;

      vp.departments.forEach(dept => {
        if (yPos > 180) {
          doc.addPage();
          yPos = 20;
        }

        const deptColor = getProgressColorRGB(dept.performance_percentage);
        const deptBgColor: [number, number, number] = [
          Math.min(255, deptColor[0] + 200),
          Math.min(255, deptColor[1] + 200),
          Math.min(255, deptColor[2] + 200)
        ];
        doc.setFillColor(deptBgColor[0], deptBgColor[1], deptBgColor[2]);
        doc.rect(10, yPos, 277, 9, 'F');
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(`${dept.department_name} - Performans:`, 15, yPos + 6);
        const deptTextColor = getProgressTextColorRGB(dept.performance_percentage);
        doc.setTextColor(deptTextColor[0], deptTextColor[1], deptTextColor[2]);
        doc.text(`%${dept.performance_percentage}`, 100, yPos + 6);
        doc.setFont('times', 'normal');
        doc.setTextColor(30, 41, 59);

        yPos += 13;

        dept.goals.forEach(goal => {
          if (yPos > 165) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(11);
          doc.setFont('times', 'bold');
          doc.setTextColor(71, 85, 105);
          const goalText = `Hedef: ${goal.code} - ${goal.title}`;
          const splitGoalText = doc.splitTextToSize(goalText, 195);
          doc.text(splitGoalText, 15, yPos);

          const goalTextColor = getProgressTextColorRGB(goal.progress);
          doc.setTextColor(goalTextColor[0], goalTextColor[1], goalTextColor[2]);
          doc.text(`İlerleme: %${goal.progress}`, 220, yPos);
          doc.setFont('times', 'normal');
          doc.setTextColor(30, 41, 59);

          const textHeight = splitGoalText.length * 5;
          yPos += textHeight + 2;

          if (goal.indicators.length > 0) {
            const tableData = goal.indicators.map(ind => [
              ind.code,
              ind.name,
              `${ind.yearly_baseline?.toLocaleString('tr-TR') || '0'}`,
              ind.yearly_target ? `${ind.yearly_target.toLocaleString('tr-TR')}` : '-',
              `${ind.current_value.toLocaleString('tr-TR')}`,
              `%${ind.progress}`
            ]);

            autoTable(doc, {
              startY: yPos,
              head: [['Kod', 'Gösterge', 'Başlangıç', 'Hedef', 'Gerçekleşme', 'İlerleme']],
              body: tableData,
              theme: 'grid',
              styles: {
                fontSize: 9,
                cellPadding: 2.5,
                overflow: 'linebreak',
                cellWidth: 'wrap',
                font: 'times',
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                textColor: [30, 41, 59]
              },
              headStyles: {
                fillColor: [59, 130, 246],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10,
                halign: 'center'
              },
              alternateRowStyles: {
                fillColor: [249, 250, 251]
              },
              columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 110, overflow: 'linebreak' },
                2: { cellWidth: 28, halign: 'right' },
                3: { cellWidth: 28, halign: 'right' },
                4: { cellWidth: 32, halign: 'right' },
                5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
              },
              margin: { left: 15, right: 15 },
              didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) {
                  const progressText = data.cell.raw as string;
                  const progress = parseInt(progressText.replace('%', ''));
                  const color = getProgressTextColorRGB(progress);
                  data.cell.styles.textColor = color;

                  const bgColor = getProgressColorRGB(progress);
                  const lightBgColor: [number, number, number] = [
                    Math.min(255, bgColor[0] + 200),
                    Math.min(255, bgColor[1] + 200),
                    Math.min(255, bgColor[2] + 200)
                  ];
                  data.cell.styles.fillColor = lightBgColor;
                }
              }
            });

            yPos = (doc as any).lastAutoTable.finalY + 8;
          } else {
            yPos += 5;
          }
        });

        yPos += 5;
      });
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Sayfa ${i} / ${pageCount}`,
        148,
        200,
        { align: 'center' }
      );
    }

    doc.save(`VP_Performans_Analizi_${selectedYear}.pdf`);
  };

  const getPerformanceGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'Mükemmel', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (percentage >= 75) return { grade: 'Çok İyi', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (percentage >= 60) return { grade: 'İyi', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (percentage >= 40) return { grade: 'Geliştirilmeli', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { grade: 'Yetersiz', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  if (!profile) return null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Başkan Yardımcıları Performans Analizi</h1>
          <p className="text-gray-600 mt-2">Müdürlük ve gösterge bazlı detaylı performans raporu</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={exportToPDF}
            disabled={vpPerformances.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            PDF İndir
          </button>
          <button
            onClick={exportToExcel}
            disabled={vpPerformances.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Excel İndir
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Veriler yükleniyor...</p>
          </div>
        </div>
      ) : vpPerformances.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Başkan Yardımcısı bulunamadı</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {vpPerformances.map(vp => {
            const isVPExpanded = expandedVPs.has(vp.vp_id);
            const performanceGrade = getPerformanceGrade(vp.overall_performance);

            return (
              <Card key={vp.vp_id}>
                <CardBody>
                  <div
                    onClick={() => toggleVP(vp.vp_id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{vp.vp_name}</h2>
                          <p className="text-sm text-gray-600">{vp.vp_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Müdürlük</p>
                          <p className="text-2xl font-bold text-gray-900">{vp.total_departments}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Gösterge</p>
                          <p className="text-2xl font-bold text-gray-900">{vp.total_indicators}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Genel Performans</p>
                          <p className={`text-3xl font-bold ${performanceGrade.color}`}>
                            %{vp.overall_performance}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full ${performanceGrade.bgColor} ${performanceGrade.color}`}>
                            {performanceGrade.grade}
                          </span>
                        </div>
                        {isVPExpanded ? (
                          <ChevronUp className="w-6 h-6 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${getProgressColor(vp.overall_performance)}`}
                          style={{ width: `${Math.min(100, vp.overall_performance)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {isVPExpanded && (
                    <div className="mt-6 space-y-3">
                      {vp.departments.map(dept => {
                        const isDeptExpanded = expandedDepartments.has(dept.department_id);
                        const deptGrade = getPerformanceGrade(dept.performance_percentage);

                        return (
                          <div key={dept.department_id} className="border rounded-lg p-4 bg-gray-50">
                            <div
                              onClick={() => toggleDepartment(dept.department_id)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Building2 className="w-5 h-5 text-gray-600" />
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{dept.department_name}</h3>
                                    <p className="text-sm text-gray-600">
                                      {dept.total_goals} hedef • {dept.total_indicators} gösterge
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className={`text-2xl font-bold ${deptGrade.color}`}>
                                      %{dept.performance_percentage}
                                    </p>
                                    <span className={`text-xs px-2 py-1 rounded-full ${deptGrade.bgColor} ${deptGrade.color}`}>
                                      {deptGrade.grade}
                                    </span>
                                  </div>
                                  {isDeptExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                              </div>

                              <div className="mt-3">
                                <div className="w-full bg-gray-300 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${getProgressColor(dept.performance_percentage)}`}
                                    style={{ width: `${Math.min(100, dept.performance_percentage)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>

                            {isDeptExpanded && (
                              <div className="mt-4 space-y-3">
                                {dept.goals.map(goal => {
                                  const goalGrade = getPerformanceGrade(goal.progress);

                                  return (
                                    <div key={goal.id} className="bg-white rounded-lg p-4 border-2 border-blue-200">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <Target className="w-5 h-5 text-blue-600" />
                                          <div>
                                            <h4 className="font-semibold text-gray-900">
                                              {goal.code} - {goal.title}
                                            </h4>
                                            <p className="text-xs text-gray-600">
                                              Amaç: {goal.objective_code} - {goal.objective_title}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className={`text-xl font-bold ${goalGrade.color}`}>
                                            %{goal.progress}
                                          </p>
                                          <span className={`text-xs px-2 py-1 rounded-full ${goalGrade.bgColor} ${goalGrade.color}`}>
                                            {goalGrade.grade}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mb-2">
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full ${getProgressColor(goal.progress)}`}
                                            style={{ width: `${Math.min(100, goal.progress)}%` }}
                                          ></div>
                                        </div>
                                      </div>

                                      {goal.indicators.length > 0 && (
                                        <div className="overflow-x-auto mt-3">
                                          <table className="min-w-full">
                                            <thead>
                                              <tr className="bg-gray-100">
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Gösterge Kodu</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Gösterge Adı</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Başlangıç</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Hedef Değer</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Gerçekleşme</th>
                                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">İlerleme</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {goal.indicators.map(ind => (
                                                <tr key={ind.id} className="border-t hover:bg-gray-50">
                                                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{ind.code}</td>
                                                  <td className="px-3 py-2 text-sm text-gray-900">{ind.name}</td>
                                                  <td className="px-3 py-2 text-sm text-right text-gray-600">
                                                    {ind.yearly_baseline?.toLocaleString('tr-TR') || '0'} {ind.unit}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-right text-gray-700">
                                                    {ind.yearly_target?.toLocaleString('tr-TR') || '-'} {ind.unit}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-right text-gray-700">
                                                    {ind.current_value.toLocaleString('tr-TR')} {ind.unit}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                        <div
                                                          className={`h-2 rounded-full ${getProgressColor(ind.progress)}`}
                                                          style={{ width: `${Math.min(100, ind.progress)}%` }}
                                                        ></div>
                                                      </div>
                                                      <span className={`text-sm font-medium ${getProgressTextColor(ind.progress)}`}>
                                                        %{ind.progress}
                                                      </span>
                                                    </div>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}

                                      {goal.indicators.length === 0 && (
                                        <div className="text-center py-4 text-sm text-gray-500">
                                          Bu hedef için gösterge tanımlanmamış
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {dept.goals.length === 0 && (
                                  <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                    <div className="text-center py-4 text-sm text-gray-500">
                                      Bu müdürlük için hedef tanımlanmamış
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
