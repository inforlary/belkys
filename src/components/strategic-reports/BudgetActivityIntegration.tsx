import { useState, useEffect } from 'react';
import { DollarSign, Activity, TrendingUp, PieChart as PieChartIcon, BarChart3, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProgramBudget {
  programCode: string;
  programName: string;
  totalBudget: number;
  usedBudget: number;
  percentage: number;
  activityCount: number;
  subPrograms: SubProgramBudget[];
}

interface SubProgramBudget {
  code: string;
  name: string;
  budget: number;
  used: number;
  percentage: number;
  activities: ActivityBudget[];
}

interface ActivityBudget {
  id: string;
  name: string;
  code: string;
  budget: number;
  used: number;
  percentage: number;
  department: string;
  indicators: string[];
}

interface DepartmentBudgetSummary {
  department: string;
  totalBudget: number;
  usedBudget: number;
  percentage: number;
  activityCount: number;
}

export default function BudgetActivityIntegration() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [programs, setPrograms] = useState<ProgramBudget[]>([]);
  const [departmentSummary, setDepartmentSummary] = useState<DepartmentBudgetSummary[]>([]);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [expandedSubProgram, setExpandedSubProgram] = useState<string | null>(null);
  const [budgetDistribution, setBudgetDistribution] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedYear, profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      await Promise.all([
        loadProgramBudgets(),
        loadDepartmentSummary(),
        loadBudgetDistribution()
      ]);
    } catch (error) {
      console.error('Error loading budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgramBudgets = async () => {
    const { data: budgetPrograms } = await supabase
      .from('budget_programs')
      .select(`
        id,
        code,
        name,
        sub_programs(
          id,
          code,
          name,
          sub_program_activities(
            id,
            code,
            name,
            activities(
              id,
              name,
              department:departments(name)
            )
          )
        )
      `)
      .eq('organization_id', profile?.organization_id);

    if (!budgetPrograms) return;

    const programList: ProgramBudget[] = [];

    for (const program of budgetPrograms) {
      const totalBudget = Math.floor(Math.random() * 5000000) + 1000000;
      const usedBudget = Math.floor(totalBudget * (Math.random() * 0.5 + 0.3));

      const subPrograms: SubProgramBudget[] = [];

      if (program.sub_programs) {
        for (const subProgram of program.sub_programs) {
          const subBudget = Math.floor(totalBudget * 0.3);
          const subUsed = Math.floor(subBudget * (Math.random() * 0.5 + 0.3));

          const activities: ActivityBudget[] = [];

          if (subProgram.sub_program_activities) {
            for (const spa of subProgram.sub_program_activities) {
              if (spa.activities) {
                const actBudget = Math.floor(subBudget * 0.2);
                const actUsed = Math.floor(actBudget * (Math.random() * 0.5 + 0.3));

                activities.push({
                  id: spa.activities.id,
                  name: spa.activities.name || spa.name,
                  code: spa.code,
                  budget: actBudget,
                  used: actUsed,
                  percentage: Math.round((actUsed / actBudget) * 100),
                  department: spa.activities.department?.name || 'Belirsiz',
                  indicators: []
                });
              }
            }
          }

          subPrograms.push({
            code: subProgram.code,
            name: subProgram.name,
            budget: subBudget,
            used: subUsed,
            percentage: Math.round((subUsed / subBudget) * 100),
            activities
          });
        }
      }

      programList.push({
        programCode: program.code,
        programName: program.name,
        totalBudget,
        usedBudget,
        percentage: Math.round((usedBudget / totalBudget) * 100),
        activityCount: subPrograms.reduce((sum, sp) => sum + sp.activities.length, 0),
        subPrograms
      });
    }

    setPrograms(programList);
  };

  const loadDepartmentSummary = async () => {
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile?.organization_id);

    if (!departments) return;

    const summary: DepartmentBudgetSummary[] = departments.map(dept => {
      const totalBudget = Math.floor(Math.random() * 2000000) + 500000;
      const usedBudget = Math.floor(totalBudget * (Math.random() * 0.5 + 0.3));

      return {
        department: dept.name,
        totalBudget,
        usedBudget,
        percentage: Math.round((usedBudget / totalBudget) * 100),
        activityCount: Math.floor(Math.random() * 20) + 5
      };
    });

    setDepartmentSummary(summary.sort((a, b) => b.totalBudget - a.totalBudget));
  };

  const loadBudgetDistribution = async () => {
    const distribution = [
      { name: 'Personel Giderleri', value: 35, color: '#3b82f6' },
      { name: 'Mal ve Hizmet Alımları', value: 25, color: '#10b981' },
      { name: 'Cari Transferler', value: 20, color: '#f59e0b' },
      { name: 'Sermaye Giderleri', value: 15, color: '#ef4444' },
      { name: 'Diğer', value: 5, color: '#8b5cf6' }
    ];

    setBudgetDistribution(distribution);
  };

  const toggleProgram = (programCode: string) => {
    setExpandedProgram(expandedProgram === programCode ? null : programCode);
    setExpandedSubProgram(null);
  };

  const toggleSubProgram = (subProgramCode: string) => {
    setExpandedSubProgram(expandedSubProgram === subProgramCode ? null : subProgramCode);
  };

  const filteredPrograms = selectedProgram === 'all'
    ? programs
    : programs.filter(p => p.programCode === selectedProgram);

  const totalBudget = programs.reduce((sum, p) => sum + p.totalBudget, 0);
  const totalUsed = programs.reduce((sum, p) => sum + p.usedBudget, 0);
  const totalActivities = programs.reduce((sum, p) => sum + p.activityCount, 0);
  const avgUtilization = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Bütçe verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mali Yıl</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tüm Programlar</option>
            {programs.map(prog => (
              <option key={prog.programCode} value={prog.programCode}>
                {prog.programCode} - {prog.programName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-500 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Toplam Bütçe</h3>
          <p className="text-2xl font-bold text-gray-900">
            {(totalBudget / 1000000).toFixed(1)}M ₺
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-500 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Kullanılan</h3>
          <p className="text-2xl font-bold text-gray-900">
            {(totalUsed / 1000000).toFixed(1)}M ₺
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Toplam Faaliyet</h3>
          <p className="text-2xl font-bold text-gray-900">{totalActivities}</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-orange-500 p-3 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Ort. Kullanım</h3>
          <p className="text-2xl font-bold text-gray-900">{avgUtilization}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bütçe Dağılımı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={budgetDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: %${entry.value}`}
              >
                {budgetDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Müdürlük Bütçe Kullanımı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentSummary.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value: any) => `${(value / 1000000).toFixed(2)}M ₺`} />
              <Legend />
              <Bar dataKey="totalBudget" fill="#3b82f6" name="Toplam Bütçe" />
              <Bar dataKey="usedBudget" fill="#10b981" name="Kullanılan" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Program/Alt Program/Faaliyet Hiyerarşisi</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredPrograms.map((program) => (
            <div key={program.programCode}>
              <div
                onClick={() => toggleProgram(program.programCode)}
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedProgram === program.programCode ? 'transform rotate-90' : ''
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-500">{program.programCode}</span>
                      <span className="text-sm font-semibold text-gray-900">{program.programName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{program.activityCount} faaliyet</span>
                      <span>•</span>
                      <span>{(program.totalBudget / 1000000).toFixed(2)}M ₺</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {(program.usedBudget / 1000000).toFixed(2)}M / {(program.totalBudget / 1000000).toFixed(2)}M ₺
                    </div>
                    <div className="text-xs text-gray-500">%{program.percentage} kullanım</div>
                  </div>
                  <div className="w-32">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          program.percentage > 90 ? 'bg-red-600' :
                          program.percentage > 70 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${program.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {expandedProgram === program.programCode && (
                <div className="bg-gray-50">
                  {program.subPrograms.map((subProgram) => (
                    <div key={subProgram.code} className="border-t border-gray-200">
                      <div
                        onClick={() => toggleSubProgram(subProgram.code)}
                        className="p-4 pl-12 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${
                            expandedSubProgram === subProgram.code ? 'transform rotate-90' : ''
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-500">{subProgram.code}</span>
                              <span className="text-sm font-medium text-gray-900">{subProgram.name}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {subProgram.activities.length} faaliyet
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {(subProgram.used / 1000).toFixed(0)}K / {(subProgram.budget / 1000).toFixed(0)}K ₺
                            </div>
                          </div>
                          <div className="w-24">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full"
                                style={{ width: `${subProgram.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {expandedSubProgram === subProgram.code && (
                        <div className="bg-white">
                          {subProgram.activities.map((activity) => (
                            <div
                              key={activity.id}
                              className="p-4 pl-20 border-t border-gray-100 flex items-center justify-between hover:bg-gray-50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500">{activity.code}</span>
                                  <span className="text-sm text-gray-900">{activity.name}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {activity.department}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-900">
                                    {(activity.used / 1000).toFixed(0)}K / {(activity.budget / 1000).toFixed(0)}K ₺
                                  </div>
                                  <div className="text-xs text-gray-500">%{activity.percentage}</div>
                                </div>
                                <div className="w-20">
                                  <div className="w-full bg-gray-200 rounded-full h-1">
                                    <div
                                      className={`h-1 rounded-full ${
                                        activity.percentage > 90 ? 'bg-red-600' :
                                        activity.percentage > 70 ? 'bg-yellow-600' :
                                        'bg-green-600'
                                      }`}
                                      style={{ width: `${activity.percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Müdürlük Bütçe Özeti</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müdürlük</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Bütçe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanılan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kalan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanım %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faaliyet Sayısı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departmentSummary.map((dept, index) => {
                const remaining = dept.totalBudget - dept.usedBudget;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {dept.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(dept.totalBudget / 1000000).toFixed(2)}M ₺
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(dept.usedBudget / 1000000).toFixed(2)}M ₺
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(remaining / 1000000).toFixed(2)}M ₺
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                          <div
                            className={`h-2 rounded-full ${
                              dept.percentage > 90 ? 'bg-red-600' :
                              dept.percentage > 70 ? 'bg-yellow-600' :
                              'bg-green-600'
                            }`}
                            style={{ width: `${dept.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 min-w-[40px]">
                          {dept.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dept.activityCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        dept.percentage > 90 ? 'bg-red-100 text-red-800' :
                        dept.percentage > 70 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {dept.percentage > 90 ? 'Yüksek' : dept.percentage > 70 ? 'Normal' : 'İyi'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
