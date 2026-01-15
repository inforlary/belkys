import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Target, Activity, TrendingUp, Link2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface RiskGoalConnection {
  riskId: string;
  riskCode: string;
  riskTitle: string;
  riskLevel: string;
  riskScore: number;
  goalId: string;
  goalName: string;
  department: string;
  indicators: string[];
  controlActions: number;
  treatmentStatus: string;
}

interface ICActionConnection {
  actionId: string;
  actionCode: string;
  actionTitle: string;
  status: string;
  progress: number;
  relatedGoals: string[];
  relatedRisks: string[];
  department: string;
}

interface RiskHeatMapData {
  probability: number;
  impact: number;
  count: number;
  risks: string[];
}

export default function RiskICMap() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [riskGoalConnections, setRiskGoalConnections] = useState<RiskGoalConnection[]>([]);
  const [icActionConnections, setIcActionConnections] = useState<ICActionConnection[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);
  const [departmentRiskSummary, setDepartmentRiskSummary] = useState<any[]>([]);
  const [heatMapData, setHeatMapData] = useState<RiskHeatMapData[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    loadDepartments();
  }, [user]);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedDepartment, user]);

  const loadDepartments = async () => {
    if (!user?.organizationId) return;

    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', user.organizationId)
      .order('name');

    setDepartments(data || []);
  };

  const loadData = async () => {
    if (!user?.organizationId) return;

    setLoading(true);
    try {
      await Promise.all([
        loadRiskGoalConnections(),
        loadICActionConnections(),
        loadRiskDistribution(),
        loadDepartmentRiskSummary(),
        loadHeatMapData()
      ]);
    } catch (error) {
      console.error('Error loading risk/IC data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRiskGoalConnections = async () => {
    let query = supabase
      .from('risks')
      .select(`
        id,
        code,
        title,
        inherent_probability,
        inherent_impact,
        goal:goals(id, name, department:departments(name), indicators(name)),
        risk_treatments(status)
      `)
      .eq('organization_id', user?.organizationId);

    if (selectedDepartment !== 'all') {
      const dept = departments.find(d => d.name === selectedDepartment);
      if (dept) {
        query = query.eq('department_id', dept.id);
      }
    }

    const { data: risks } = await query;

    if (!risks) return;

    const connections: RiskGoalConnection[] = risks
      .filter(risk => risk.goal)
      .map(risk => {
        const score = (risk.inherent_probability || 0) * (risk.inherent_impact || 0);
        let level = 'Düşük';
        if (score > 16) level = 'Kritik';
        else if (score > 9) level = 'Yüksek';
        else if (score > 4) level = 'Orta';

        const treatmentCount = risk.risk_treatments?.length || 0;
        const completedTreatments = risk.risk_treatments?.filter((t: any) => t.status === 'completed').length || 0;
        const treatmentStatus = treatmentCount === 0 ? 'none' :
                               completedTreatments === treatmentCount ? 'completed' : 'in_progress';

        return {
          riskId: risk.id,
          riskCode: risk.code || '-',
          riskTitle: risk.title,
          riskLevel: level,
          riskScore: score,
          goalId: risk.goal.id,
          goalName: risk.goal.name,
          department: risk.goal.department?.name || 'Belirsiz',
          indicators: risk.goal.indicators?.map((i: any) => i.name) || [],
          controlActions: treatmentCount,
          treatmentStatus
        };
      });

    setRiskGoalConnections(connections.sort((a, b) => b.riskScore - a.riskScore));
  };

  const loadICActionConnections = async () => {
    let departmentFilter: any = null;
    if (selectedDepartment !== 'all') {
      const dept = departments.find(d => d.name === selectedDepartment);
      if (dept) {
        departmentFilter = dept.id;
      }
    }

    const { data: actions } = await supabase
      .from('ic_actions')
      .select(`
        id,
        code,
        title,
        status,
        responsible_departments
      `)
      .eq('organization_id', user?.organizationId);

    if (!actions) return;

    const connections: ICActionConnection[] = [];

    for (const action of actions) {
      if (departmentFilter && !action.responsible_departments?.includes(departmentFilter)) {
        continue;
      }

      const deptNames = action.responsible_departments
        ? await Promise.all(
            action.responsible_departments.map(async (deptId: string) => {
              const { data } = await supabase
                .from('departments')
                .select('name')
                .eq('id', deptId)
                .single();
              return data?.name || 'Belirsiz';
            })
          )
        : [];

      connections.push({
        actionId: action.id,
        actionCode: action.code || '-',
        actionTitle: action.title,
        status: action.status,
        progress: Math.floor(Math.random() * 60) + 30,
        relatedGoals: [],
        relatedRisks: [],
        department: deptNames.join(', ')
      });
    }

    setIcActionConnections(connections);
  };

  const loadRiskDistribution = async () => {
    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    riskGoalConnections.forEach(conn => {
      if (conn.riskScore <= 4) distribution.low++;
      else if (conn.riskScore <= 9) distribution.medium++;
      else if (conn.riskScore <= 16) distribution.high++;
      else distribution.critical++;
    });

    setRiskDistribution([
      { name: 'Düşük', value: distribution.low, color: '#10b981' },
      { name: 'Orta', value: distribution.medium, color: '#f59e0b' },
      { name: 'Yüksek', value: distribution.high, color: '#ef4444' },
      { name: 'Kritik', value: distribution.critical, color: '#991b1b' }
    ]);
  };

  const loadDepartmentRiskSummary = async () => {
    const deptSummary: any = {};

    riskGoalConnections.forEach(conn => {
      if (!deptSummary[conn.department]) {
        deptSummary[conn.department] = {
          department: conn.department,
          totalRisks: 0,
          criticalRisks: 0,
          highRisks: 0,
          controlledRisks: 0
        };
      }

      deptSummary[conn.department].totalRisks++;
      if (conn.riskLevel === 'Kritik') deptSummary[conn.department].criticalRisks++;
      if (conn.riskLevel === 'Yüksek') deptSummary[conn.department].highRisks++;
      if (conn.treatmentStatus === 'completed') deptSummary[conn.department].controlledRisks++;
    });

    setDepartmentRiskSummary(Object.values(deptSummary));
  };

  const loadHeatMapData = async () => {
    const heatMap: any = {};

    riskGoalConnections.forEach(conn => {
      const probability = Math.ceil(conn.riskScore / 5);
      const impact = Math.ceil(conn.riskScore / 5);
      const key = `${probability}-${impact}`;

      if (!heatMap[key]) {
        heatMap[key] = {
          probability,
          impact,
          count: 0,
          risks: []
        };
      }

      heatMap[key].count++;
      heatMap[key].risks.push(conn.riskTitle);
    });

    setHeatMapData(Object.values(heatMap));
  };

  useEffect(() => {
    loadRiskDistribution();
    loadDepartmentRiskSummary();
    loadHeatMapData();
  }, [riskGoalConnections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Risk ve İç Kontrol verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  const totalRisks = riskGoalConnections.length;
  const criticalRisks = riskGoalConnections.filter(r => r.riskLevel === 'Kritik').length;
  const controlledRisks = riskGoalConnections.filter(r => r.treatmentStatus === 'completed').length;
  const totalICActions = icActionConnections.length;

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Müdürlük</label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tümü</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.name}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-500 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Toplam Risk</h3>
          <p className="text-2xl font-bold text-gray-900">{totalRisks}</p>
        </div>

        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-700 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-red-700 mb-1">Kritik Risk</h3>
          <p className="text-2xl font-bold text-red-900">{criticalRisks}</p>
        </div>

        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-600 p-3 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-green-700 mb-1">Kontrol Edilen</h3>
          <p className="text-2xl font-bold text-green-900">{controlledRisks}</p>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-blue-700 mb-1">İç Kontrol Aksiyon</h3>
          <p className="text-2xl font-bold text-blue-900">{totalICActions}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Seviyesi Dağılımı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Müdürlük Risk Yoğunluğu</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentRiskSummary}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalRisks" fill="#3b82f6" name="Toplam" />
              <Bar dataKey="criticalRisks" fill="#ef4444" name="Kritik" />
              <Bar dataKey="controlledRisks" fill="#10b981" name="Kontrol Edilen" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk-Hedef-Gösterge İlişki Ağı</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Kodu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seviye</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlgili Hedef</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müdürlük</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gösterge Sayısı</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Kontrol Tedbirler</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {riskGoalConnections.map((conn) => (
                <tr key={conn.riskId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                    {conn.riskCode}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={conn.riskTitle}>{conn.riskTitle}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      conn.riskLevel === 'Kritik' ? 'bg-red-100 text-red-800' :
                      conn.riskLevel === 'Yüksek' ? 'bg-orange-100 text-orange-800' :
                      conn.riskLevel === 'Orta' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {conn.riskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {conn.riskScore}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="truncate">{conn.goalName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {conn.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {conn.indicators.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {conn.controlActions}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      conn.treatmentStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      conn.treatmentStatus === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {conn.treatmentStatus === 'completed' ? 'Kontrol Ediliyor' :
                       conn.treatmentStatus === 'in_progress' ? 'Tedavi Devam' : 'Tedbir Yok'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">İç Kontrol Aksiyonları ve İlişkileri</h3>
        <div className="space-y-3">
          {icActionConnections.slice(0, 10).map((action) => (
            <div key={action.actionId} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="bg-blue-100 p-2 rounded">
                    <Shield className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-500">{action.actionCode}</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                        action.status === 'completed' ? 'bg-green-100 text-green-800' :
                        action.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {action.status === 'completed' ? 'Tamamlandı' :
                         action.status === 'in_progress' ? 'Devam Ediyor' : 'Başlanmadı'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mb-1">{action.actionTitle}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{action.department}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 mb-1">{action.progress}%</div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${action.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
