import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Network, FileDown, Search, Info, Target } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Goal {
  id: string;
  code: string;
  title: string;
  department_id: string;
  objective?: {
    code: string;
    title: string;
  };
  department?: {
    name: string;
  };
}

interface CollaborationPlan {
  id: string;
  goal_id: string;
  responsible_department_id: string;
  partners?: Array<{ department_id: string }>;
  all_departments: boolean;
}

interface Department {
  id: string;
  name: string;
}

type RelationType = 'S' | 'I' | null;

interface RelationshipCell {
  type: RelationType;
  tooltip?: string;
}

export default function GoalRelationshipMatrix() {
  const { profile } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<CollaborationPlan[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [matrix, setMatrix] = useState<Map<string, Map<string, RelationshipCell>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [goalsRes, plansRes, depsRes] = await Promise.all([
        supabase
          .from('goals')
          .select('*, objective:objectives(code, title), department:departments(name)')
          .eq('organization_id', profile.organization_id)
          .order('code'),

        supabase
          .from('collaboration_plans')
          .select(`
            id,
            goal_id,
            responsible_department_id,
            all_departments,
            partners:collaboration_plan_partners(department_id)
          `)
          .eq('organization_id', profile.organization_id)
          .eq('status', 'active'),

        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('name')
      ]);

      if (goalsRes.error) throw goalsRes.error;
      if (plansRes.error) throw plansRes.error;
      if (depsRes.error) throw depsRes.error;

      const goalsData = goalsRes.data || [];
      const plansData = plansRes.data || [];
      const depsData = depsRes.data || [];

      const sortedDepartments = sortDepartmentsByGoalCode(goalsData, depsData);

      setGoals(goalsData);
      setPlans(plansData);
      setDepartments(sortedDepartments);

      calculateMatrix(goalsData, plansData, sortedDepartments);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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

  const sortDepartmentsByGoalCode = (goalsData: Goal[], departmentsData: Department[]): Department[] => {
    const sortedGoals = [...goalsData].sort((a, b) => naturalSort(a.code, b.code));

    const deptToFirstGoalCode = new Map<string, string>();

    sortedGoals.forEach(goal => {
      if (goal.department_id && !deptToFirstGoalCode.has(goal.department_id)) {
        deptToFirstGoalCode.set(goal.department_id, goal.code);
      }
    });

    return [...departmentsData].sort((a, b) => {
      const aCode = deptToFirstGoalCode.get(a.id);
      const bCode = deptToFirstGoalCode.get(b.id);

      if (aCode && bCode) {
        return naturalSort(aCode, bCode);
      }

      if (aCode) return -1;
      if (bCode) return 1;

      return a.name.localeCompare(b.name);
    });
  };

  const calculateMatrix = (
    goalsData: Goal[],
    plansData: CollaborationPlan[],
    departmentsData: Department[]
  ) => {
    const newMatrix = new Map<string, Map<string, RelationshipCell>>();

    goalsData.forEach(goal => {
      const rowMap = new Map<string, RelationshipCell>();

      departmentsData.forEach(dept => {
        if (goal.department_id === dept.id) {
          rowMap.set(dept.id, {
            type: 'S',
            tooltip: `Sorumlu Birim: ${dept.name}`
          });
          return;
        }

        const plan = plansData.find(p => p.goal_id === goal.id);

        if (!plan) {
          rowMap.set(dept.id, { type: null });
          return;
        }

        const involvedDepts = new Set<string>();
        involvedDepts.add(plan.responsible_department_id);

        if (plan.all_departments) {
          departmentsData.forEach(d => involvedDepts.add(d.id));
        } else {
          plan.partners?.forEach(p => involvedDepts.add(p.department_id));
        }

        if (involvedDepts.has(dept.id)) {
          rowMap.set(dept.id, {
            type: 'I',
            tooltip: `İşbirliği Birimi: ${dept.name}`
          });
        } else {
          rowMap.set(dept.id, { type: null });
        }
      });

      newMatrix.set(goal.id, rowMap);
    });

    setMatrix(newMatrix);
  };

  const filteredGoals = goals
    .filter(g =>
      !searchTerm ||
      g.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.objective?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.objective?.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => naturalSort(a.code, b.code));

  const exportToExcel = () => {
    const data: any[] = [];

    const header = ['Hedef', ...departments.map(d => d.name)];
    data.push(header);

    const sortedGoals = [...filteredGoals].sort((a, b) => naturalSort(a.code, b.code));

    sortedGoals.forEach(goal => {
      const row = [`${goal.code} - ${goal.title}`];
      departments.forEach(dept => {
        const cell = matrix.get(goal.id)?.get(dept.id);
        row.push(cell?.type || '');
      });
      data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'İlişki Matrisi');
    XLSX.writeFile(wb, 'hedefler_birim_iliski_matrisi.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Hedefler ve Birimler Arası İlişki Matrisi', 14, 15);

    const headers = ['Hedef', ...departments.map(d => d.name)];
    const sortedGoals = [...filteredGoals].sort((a, b) => naturalSort(a.code, b.code));

    const body = sortedGoals.map(goal => {
      const row = [`${goal.code}`];
      departments.forEach(dept => {
        const cell = matrix.get(goal.id)?.get(dept.id);
        row.push(cell?.type || '');
      });
      return row;
    });

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 25,
      styles: { fontSize: 6, cellPadding: 1, font: 'helvetica' },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' }
      }
    });

    doc.save('hedefler_birim_iliski_matrisi.pdf');
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
              <Network className="w-7 h-7 text-blue-600" />
              Hedefler ve Birimler İlişki Matrisi
            </h1>
            <p className="text-gray-600 mt-1">
              Hedeflerin sorumlu ve işbirliği yaptığı birimleri görselleştirir
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              <Info className="w-4 h-4" />
              {showLegend ? 'Açıklamayı Gizle' : 'Açıklamayı Göster'}
            </button>
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

        {showLegend && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Matris Açıklaması
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white w-8 h-8 rounded flex items-center justify-center font-bold">S</span>
                <span className="text-blue-900">
                  <strong>Sorumlu:</strong> Hedefin sorumlu birimi
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-green-600 text-white w-8 h-8 rounded flex items-center justify-center font-bold">I</span>
                <span className="text-blue-900">
                  <strong>İlgili:</strong> Hedefin işbirliği birimi
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-gray-200 text-gray-600 w-8 h-8 rounded flex items-center justify-center font-bold">-</span>
                <span className="text-blue-900">
                  <strong>İlişki Yok:</strong> Hedef ile birim arasında ilişki yok
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Hedef veya amaç ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredGoals.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm ? 'Arama kriterlerine uygun hedef bulunamadı' : 'Henüz hedef oluşturulmamış'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-blue-600 text-white p-3 border border-gray-300 min-w-[200px] text-left font-semibold">
                  Hedefler
                </th>
                {departments.map((dept) => (
                  <th
                    key={dept.id}
                    className="bg-blue-600 text-white p-2 border border-gray-300 text-center align-bottom"
                    title={dept.name}
                    style={{ minWidth: '40px', height: '180px' }}
                  >
                    <div
                      className="whitespace-nowrap text-xs font-semibold"
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        margin: '0 auto',
                        display: 'inline-block'
                      }}
                    >
                      {dept.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGoals.map((goal, rowIdx) => (
                <tr key={goal.id} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="sticky left-0 z-10 bg-gray-100 p-3 border border-gray-300 font-medium text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-semibold">{goal.code}</span>
                      <span className="text-gray-700 line-clamp-2">{goal.title}</span>
                    </div>
                    {goal.objective && (
                      <div className="text-xs text-gray-500 mt-1">
                        {goal.objective.code} - {goal.objective.title}
                      </div>
                    )}
                  </td>
                  {departments.map((dept) => {
                    const cell = matrix.get(goal.id)?.get(dept.id);
                    const cellClass =
                      cell?.type === 'S'
                        ? 'bg-blue-600 text-white font-bold'
                        : cell?.type === 'I'
                        ? 'bg-green-600 text-white font-bold'
                        : 'bg-white';

                    return (
                      <td
                        key={dept.id}
                        className={`p-2 border border-gray-300 text-center ${cellClass}`}
                        title={cell?.tooltip || ''}
                      >
                        {cell?.type || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">Matris Nasıl Yorumlanır?</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Satırlar:</strong> Her satır bir hedefi temsil eder.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Sütunlar:</strong> Her sütun bir müdürlüğü/birimi temsil eder.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Hücreler:</strong> Satır ve sütun kesişimindeki hücre, hedefin o birimle olan ilişkisini gösterir.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>S (Sorumlu):</strong> Hedefin sorumlu birimi. Bu birim hedeften doğrudan sorumludur.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>I (İlgili):</strong> Hedefin işbirliği planında yer alan birim. Bu birim hedef için işbirliği yapar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>
              <strong>Boş Hücre:</strong> Hedef ile birim arasında ilişki yoktur.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
