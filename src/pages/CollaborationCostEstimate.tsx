import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Coins, FileDown, Search, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Objective {
  id: string;
  code: string;
  title: string;
}

interface Goal {
  id: string;
  code: string;
  title: string;
  objective_id: string;
  department_id: string;
  objective?: Objective;
  department?: {
    id: string;
    name: string;
  };
}

interface CostEstimate {
  id: string;
  year: number;
  amount: number;
}

interface CollaborationPlan {
  id: string;
  goal_id: string;
  cost_estimates?: CostEstimate[];
}

interface GoalCostData {
  goal: Goal;
  costs: Map<number, number>;
  total: number;
}

interface ObjectiveCostData {
  objective: Objective;
  goals: GoalCostData[];
  total: number;
}

interface StrategicPlan {
  id: string;
  start_year: number;
  end_year: number;
}

interface Department {
  id: string;
  name: string;
}

export default function CollaborationCostEstimate() {
  const { profile } = useAuth();
  const [data, setData] = useState<ObjectiveCostData[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [strategicPlan, setStrategicPlan] = useState<StrategicPlan | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [plansRes, goalsRes, planRes, depsRes] = await Promise.all([
        supabase
          .from('collaboration_plans')
          .select(`
            id,
            goal_id,
            cost_estimates:collaboration_plan_cost_estimates(id, year, amount)
          `)
          .eq('organization_id', profile.organization_id)
          .eq('status', 'active'),

        supabase
          .from('goals')
          .select('*, objective:objectives(id, code, title), department:departments(id, name)')
          .eq('organization_id', profile.organization_id)
          .order('code'),

        supabase
          .from('strategic_plans')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .maybeSingle(),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name')
      ]);

      if (plansRes.error) throw plansRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (depsRes.error) throw depsRes.error;

      const plans: CollaborationPlan[] = plansRes.data || [];
      const goals: Goal[] = goalsRes.data || [];
      const plan = planRes.data;
      const depts: Department[] = depsRes.data || [];

      setStrategicPlan(plan);
      setDepartments(depts);

      const yearList = getYearList(plan);
      setYears(yearList);

      const processedData = processData(goals, plans, yearList);
      setData(processedData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getYearList = (plan: StrategicPlan | null): number[] => {
    if (plan) {
      const years = [];
      for (let year = plan.start_year; year <= plan.end_year; year++) {
        years.push(year);
      }
      return years;
    }

    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear + i);
  };

  const naturalSort = (a: string, b: string): number => {
    const regex = /(\d+)|(\D+)/g;
    const aParts = a.match(regex) || [];
    const bParts = b.match(regex) || [];

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || '';
      const bPart = bParts[i] || '';

      const aNum = parseInt(aPart);
      const bNum = parseInt(bPart);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        if (aNum !== bNum) return aNum - bNum;
      } else {
        if (aPart !== bPart) return aPart.localeCompare(bPart);
      }
    }

    return 0;
  };

  const processData = (
    goals: Goal[],
    plans: CollaborationPlan[],
    yearList: number[]
  ): ObjectiveCostData[] => {
    const objectiveMap = new Map<string, ObjectiveCostData>();

    goals.forEach((goal) => {
      if (!goal.objective) return;

      const plan = plans.find((p) => p.goal_id === goal.id);
      const costsByYear = new Map<number, number>();
      let goalTotal = 0;

      yearList.forEach((year) => {
        const estimate = plan?.cost_estimates?.find((e) => e.year === year);
        const amount = estimate?.amount || 0;
        costsByYear.set(year, amount);
        goalTotal += amount;
      });

      const goalCostData: GoalCostData = {
        goal,
        costs: costsByYear,
        total: goalTotal,
      };

      if (!objectiveMap.has(goal.objective.id)) {
        objectiveMap.set(goal.objective.id, {
          objective: goal.objective,
          goals: [],
          total: 0,
        });
      }

      const objData = objectiveMap.get(goal.objective.id)!;
      objData.goals.push(goalCostData);
      objData.total += goalTotal;
    });

    const result = Array.from(objectiveMap.values()).sort((a, b) =>
      a.objective.code.localeCompare(b.objective.code)
    );

    result.forEach((objData) => {
      objData.goals.sort((a, b) => naturalSort(a.goal.code, b.goal.code));
    });

    return result;
  };

  const toggleObjective = (objectiveId: string) => {
    const newExpanded = new Set(expandedObjectives);
    if (newExpanded.has(objectiveId)) {
      newExpanded.delete(objectiveId);
    } else {
      newExpanded.add(objectiveId);
    }
    setExpandedObjectives(newExpanded);
  };

  const filteredData = data
    .map((objData) => {
      let filteredGoals = objData.goals;

      if (selectedDepartment !== 'all') {
        filteredGoals = filteredGoals.filter(
          (g) => g.goal.department_id === selectedDepartment
        );
      }

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredGoals = filteredGoals.filter(
          (g) =>
            g.goal.code.toLowerCase().includes(search) ||
            g.goal.title.toLowerCase().includes(search)
        );
      }

      if (filteredGoals.length === 0) return null;

      const filteredTotal = filteredGoals.reduce((sum, g) => sum + g.total, 0);

      return {
        ...objData,
        goals: filteredGoals,
        total: filteredTotal,
      };
    })
    .filter((objData) => objData !== null) as ObjectiveCostData[];

  const grandTotal = filteredData.reduce((sum, obj) => sum + obj.total, 0);
  const yearTotals = years.map((year) =>
    filteredData.reduce(
      (sum, obj) =>
        sum +
        obj.goals.reduce((gSum, g) => gSum + (g.costs.get(year) || 0), 0),
      0
    )
  );

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const exportToExcel = () => {
    const worksheetData: any[] = [];

    const header = [
      'Stratejik Amaç/Stratejik Hedef',
      'Sorumlu Birim',
      ...years.map((y) => `${y} Yılı (TL)`),
      'Toplam Tutar (TL)',
    ];
    worksheetData.push(header);

    filteredData.forEach((objData) => {
      const objRow = [
        objData.objective.code + ' - ' + objData.objective.title,
        '',
        ...years.map((year) => {
          const yearTotal = objData.goals.reduce(
            (sum, g) => sum + (g.costs.get(year) || 0),
            0
          );
          return yearTotal;
        }),
        objData.total,
      ];
      worksheetData.push(objRow);

      objData.goals.forEach((goalData) => {
        const deptName = goalData.goal.department ? goalData.goal.department.name : '-';
        const goalRow = [
          `  ${goalData.goal.code} - ${goalData.goal.title}`,
          deptName,
          ...years.map((year) => goalData.costs.get(year) || 0),
          goalData.total,
        ];
        worksheetData.push(goalRow);
      });
    });

    const totalRow = ['Genel Toplam', '', ...yearTotals, grandTotal];
    worksheetData.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maliyetlendirme');
    XLSX.writeFile(wb, 'isbirligi_maliyetlendirme.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('İşbirliği Planları Maliyetlendirme', 14, 15);

    const headers = [
      'Stratejik Amaç/Hedef',
      'Birim',
      ...years.map((y) => y.toString()),
      'Toplam',
    ];

    const body: any[] = [];
    filteredData.forEach((objData) => {
      body.push([
        objData.objective.code,
        '',
        ...years.map((year) => {
          const yearTotal = objData.goals.reduce(
            (sum, g) => sum + (g.costs.get(year) || 0),
            0
          );
          return formatCurrency(yearTotal);
        }),
        formatCurrency(objData.total),
      ]);

      objData.goals.forEach((goalData) => {
        const deptName = goalData.goal.department ? goalData.goal.department.name : '-';
        body.push([
          `  ${goalData.goal.code}`,
          deptName,
          ...years.map((year) => formatCurrency(goalData.costs.get(year) || 0)),
          formatCurrency(goalData.total),
        ]);
      });
    });

    body.push([
      'Toplam',
      '',
      ...yearTotals.map((t) => formatCurrency(t)),
      formatCurrency(grandTotal),
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 25,
      styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 25 },
      },
    });

    doc.save('isbirligi_maliyetlendirme.pdf');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Coins className="w-7 h-7 text-green-600" />
              İşbirliği Planları Maliyetlendirme
            </h1>
            <p className="text-gray-600 mt-1">
              Stratejik amaç ve hedef bazında maliyet tahminleri
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <FileDown className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Amaç veya hedef ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tüm Birimler</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Genel Toplam Maliyet:</span>
            </div>
            <span className="text-2xl font-bold text-blue-900">
              {formatCurrency(grandTotal)} TL
            </span>
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Coins className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm
              ? 'Arama kriterlerine uygun veri bulunamadı'
              : 'Henüz maliyet tahmini oluşturulmamış'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="p-3 border border-gray-300 text-left font-semibold min-w-[300px]">
                  Stratejik Amaç/Stratejik Hedef
                </th>
                <th className="p-3 border border-gray-300 text-left font-semibold min-w-[200px]">
                  Sorumlu Birim
                </th>
                {years.map((year) => (
                  <th
                    key={year}
                    className="p-3 border border-gray-300 text-center font-semibold min-w-[120px]"
                  >
                    {year} Yılı (TL)
                  </th>
                ))}
                <th className="p-3 border border-gray-300 text-center font-semibold min-w-[140px]">
                  Toplam Tutar (TL)
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((objData) => {
                const isExpanded = expandedObjectives.has(objData.objective.id);

                return (
                  <React.Fragment key={objData.objective.id}>
                    <tr className="bg-blue-50 hover:bg-blue-100">
                      <td className="p-3 border border-gray-300">
                        <button
                          onClick={() => toggleObjective(objData.objective.id)}
                          className="flex items-center gap-2 font-semibold text-blue-900 w-full text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 flex-shrink-0" />
                          )}
                          <span>
                            {objData.objective.code} - {objData.objective.title}
                          </span>
                        </button>
                      </td>
                      <td className="p-3 border border-gray-300"></td>
                      {years.map((year) => {
                        const yearTotal = objData.goals.reduce(
                          (sum, g) => sum + (g.costs.get(year) || 0),
                          0
                        );
                        return (
                          <td
                            key={year}
                            className="p-3 border border-gray-300 text-right font-semibold text-blue-900"
                          >
                            {formatCurrency(yearTotal)}
                          </td>
                        );
                      })}
                      <td className="p-3 border border-gray-300 text-right font-bold text-blue-900">
                        {formatCurrency(objData.total)}
                      </td>
                    </tr>

                    {isExpanded &&
                      objData.goals.map((goalData, idx) => (
                        <tr
                          key={goalData.goal.id}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="p-3 border border-gray-300 pl-12">
                            <div className="flex items-start gap-2">
                              <span className="text-green-600 font-semibold">
                                {goalData.goal.code}
                              </span>
                              <span className="text-gray-700">
                                {goalData.goal.title}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 border border-gray-300 text-sm text-gray-700">
                            {goalData.goal.department ? goalData.goal.department.name : '-'}
                          </td>
                          {years.map((year) => (
                            <td
                              key={year}
                              className="p-3 border border-gray-300 text-right text-gray-700"
                            >
                              {formatCurrency(goalData.costs.get(year) || 0)}
                            </td>
                          ))}
                          <td className="p-3 border border-gray-300 text-right font-semibold text-gray-900">
                            {formatCurrency(goalData.total)}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}

              <tr className="bg-green-100 font-bold">
                <td className="p-3 border border-gray-300 text-gray-900">
                  Genel Toplam
                </td>
                <td className="p-3 border border-gray-300"></td>
                {yearTotals.map((total, idx) => (
                  <td
                    key={idx}
                    className="p-3 border border-gray-300 text-right text-gray-900"
                  >
                    {formatCurrency(total)}
                  </td>
                ))}
                <td className="p-3 border border-gray-300 text-right text-green-900 text-lg">
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Maliyet Tablosu Hakkında
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Stratejik Amaç Satırları:</strong> Her amaç için tüm hedeflerin
              maliyetlerinin toplamını gösterir.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Hedef Satırları:</strong> Amaç altındaki her hedefin yıllık maliyet
              tahminlerini gösterir.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Yıl Sütunları:</strong> Stratejik plan dönemindeki her yıl için maliyet
              tahminleridir.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Toplam Sütunu:</strong> Her satır için tüm yılların toplamını gösterir.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Genel Toplam:</strong> Tüm hedeflerin tüm yıllardaki toplam maliyetidir.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
