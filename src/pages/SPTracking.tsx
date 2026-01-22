import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Target, ChevronDown, ChevronRight, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ObjectiveSummary {
  id: string;
  code: string;
  name: string;
  total_projects: number;
  completed_projects: number;
  in_progress_projects: number;
  avg_progress: number;
  goals: GoalSummary[];
}

interface GoalSummary {
  id: string;
  code: string;
  name: string;
  objective_id: string;
  total_projects: number;
  completed_projects: number;
  avg_progress: number;
}

interface ProjectItem {
  id: string;
  project_no: string;
  project_name: string;
  physical_progress: number;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Tamamlandı',
  in_progress: 'Devam Ediyor',
  planned: 'Planlandı',
  delayed: 'Gecikmiş'
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function SPTracking() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [activeView, setActiveView] = useState<'objective' | 'goal' | 'summary'>('objective');
  const [objectives, setObjectives] = useState<ObjectiveSummary[]>([]);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [selectedGoal, setSelectedGoal] = useState('');
  const [goalProjects, setGoalProjects] = useState<ProjectItem[]>([]);
  const [allGoals, setAllGoals] = useState<GoalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id, activeView]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeView === 'objective' || activeView === 'summary') {
        await loadObjectiveSummary();
      }
      if (activeView === 'goal') {
        await loadAllGoals();
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadObjectiveSummary = async () => {
    try {
      const { data: objectivesData, error: objError } = await supabase
        .from('objectives')
        .select('id, code, name')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (objError) throw objError;

      const summaries: ObjectiveSummary[] = [];

      for (const obj of objectivesData || []) {
        const { data: goalsData } = await supabase
          .from('goals')
          .select('id, code, name')
          .eq('objective_id', obj.id)
          .order('code');

        const goalSummaries: GoalSummary[] = [];
        let totalProjects = 0;
        let completedProjects = 0;
        let totalProgress = 0;
        let projectCount = 0;

        for (const goal of goalsData || []) {
          const { data: projects } = await supabase
            .from('projects')
            .select('id, physical_progress, status')
            .eq('related_goal_id', goal.id)
            .eq('organization_id', profile?.organization_id);

          const goalTotal = projects?.length || 0;
          const goalCompleted = projects?.filter(p => p.status === 'completed').length || 0;
          const goalAvgProgress = goalTotal > 0
            ? projects.reduce((sum, p) => sum + (p.physical_progress || 0), 0) / goalTotal
            : 0;

          goalSummaries.push({
            id: goal.id,
            code: goal.code,
            name: goal.name,
            objective_id: obj.id,
            total_projects: goalTotal,
            completed_projects: goalCompleted,
            avg_progress: Math.round(goalAvgProgress)
          });

          totalProjects += goalTotal;
          completedProjects += goalCompleted;
          if (projects) {
            projects.forEach(p => {
              totalProgress += p.physical_progress || 0;
              projectCount++;
            });
          }
        }

        summaries.push({
          id: obj.id,
          code: obj.code,
          name: obj.name,
          total_projects: totalProjects,
          completed_projects: completedProjects,
          in_progress_projects: totalProjects - completedProjects,
          avg_progress: projectCount > 0 ? Math.round(totalProgress / projectCount) : 0,
          goals: goalSummaries
        });
      }

      setObjectives(summaries);

      if (activeView === 'summary') {
        const chartData = summaries.map((obj, index) => ({
          name: obj.code,
          value: obj.total_projects,
          color: COLORS[index % COLORS.length]
        }));
        setSummaryData(chartData);
      }
    } catch (error) {
      console.error('Amaç özeti yükleme hatası:', error);
    }
  };

  const loadAllGoals = async () => {
    try {
      const { data: goalsData } = await supabase
        .from('goals')
        .select(`
          id, code, name, objective_id,
          objective:objectives(code, name)
        `)
        .eq('objectives.organization_id', profile?.organization_id)
        .order('code');

      const goalSummaries: GoalSummary[] = [];

      for (const goal of goalsData || []) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, physical_progress, status')
          .eq('related_goal_id', goal.id)
          .eq('organization_id', profile?.organization_id);

        const total = projects?.length || 0;
        const completed = projects?.filter(p => p.status === 'completed').length || 0;
        const avgProgress = total > 0
          ? Math.round(projects.reduce((sum, p) => sum + (p.physical_progress || 0), 0) / total)
          : 0;

        goalSummaries.push({
          id: goal.id,
          code: goal.code,
          name: goal.name,
          objective_id: goal.objective_id,
          total_projects: total,
          completed_projects: completed,
          avg_progress: avgProgress
        });
      }

      setAllGoals(goalSummaries);
      if (goalSummaries.length > 0 && !selectedGoal) {
        setSelectedGoal(goalSummaries[0].id);
        loadGoalProjects(goalSummaries[0].id);
      }
    } catch (error) {
      console.error('Hedefler yükleme hatası:', error);
    }
  };

  const loadGoalProjects = async (goalId: string) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_no, project_name, physical_progress, status')
        .eq('related_goal_id', goalId)
        .eq('organization_id', profile?.organization_id)
        .order('status', { ascending: false })
        .order('physical_progress', { ascending: false });

      if (error) throw error;
      setGoalProjects(data || []);
    } catch (error) {
      console.error('Hedef projeleri yükleme hatası:', error);
    }
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

  const handleGoalChange = (goalId: string) => {
    setSelectedGoal(goalId);
    loadGoalProjects(goalId);
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    return <Clock className="w-5 h-5 text-orange-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const selectedGoalData = allGoals.find(g => g.id === selectedGoal);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Stratejik Plan Takibi</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveView('objective')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'objective'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Amaç Bazlı
            </button>
            <button
              onClick={() => setActiveView('goal')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'goal'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Hedef Bazlı
            </button>
            <button
              onClick={() => setActiveView('summary')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'summary'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Özet
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeView === 'objective' && (
            <div className="space-y-4">
              {objectives.map((obj) => (
                <div key={obj.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleObjective(obj.id)}
                    className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {expandedObjectives.has(obj.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">
                          {obj.code}: {obj.name}
                        </div>
                        <div className="text-sm text-gray-600 mt-1 flex items-center gap-4">
                          <span>Bağlı Proje: {obj.total_projects}</span>
                          <span>Tamamlanan: {obj.completed_projects}</span>
                          <span>Devam Eden: {obj.in_progress_projects}</span>
                          <span>Ortalama Gerçekleşme: %{obj.avg_progress}</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {expandedObjectives.has(obj.id) && (
                    <div className="p-6 space-y-3 bg-white">
                      <h4 className="font-medium text-gray-900 mb-4">Hedefler:</h4>
                      {obj.goals.map((goal) => (
                        <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-medium text-gray-900">
                              {goal.code}: {goal.name}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            Proje: {goal.total_projects} | Tamamlanan: {goal.completed_projects} | Gerçekleşme: %{goal.avg_progress}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-blue-600 h-3 rounded-full transition-all"
                              style={{ width: `${goal.avg_progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeView === 'goal' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hedef Seçin:
                </label>
                <select
                  value={selectedGoal}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  className="w-full max-w-2xl px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {allGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.code}: {goal.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedGoalData && (
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-6">
                    <Target className="w-6 h-6 text-blue-600 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedGoalData.code}: {selectedGoalData.name}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-blue-900">{selectedGoalData.total_projects}</div>
                      <div className="text-sm text-blue-700 mt-1">Toplam Proje</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-900">{selectedGoalData.completed_projects}</div>
                      <div className="text-sm text-green-700 mt-1">Tamamlandı</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-orange-900">
                        {selectedGoalData.total_projects - selectedGoalData.completed_projects}
                      </div>
                      <div className="text-sm text-orange-700 mt-1">Devam Ediyor</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-gray-900">%{selectedGoalData.avg_progress}</div>
                      <div className="text-sm text-gray-700 mt-1">Gerçekleşme</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Bağlı Projeler:</h4>
                    <div className="border-t border-gray-200">
                      {goalProjects.length === 0 ? (
                        <p className="text-center py-8 text-gray-500">Henüz proje bağlantısı yok</p>
                      ) : (
                        goalProjects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => navigate(`project-management/projects/${project.id}`)}
                            className="w-full px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(project.status)}
                              <span className="font-medium text-gray-900">
                                {project.project_no} - {project.project_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-semibold text-blue-600">
                                %{project.physical_progress || 0}
                              </span>
                              <span className="text-sm text-gray-600">
                                {STATUS_LABELS[project.status] || project.status}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'summary' && (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-700">Amaç</th>
                      <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Hedef Sayısı</th>
                      <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Proje Sayısı</th>
                      <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Tamamlanan</th>
                      <th className="border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700">Gerçekleşme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objectives.map((obj) => (
                      <tr key={obj.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">{obj.code}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 text-center">{obj.goals.length}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 text-center">{obj.total_projects}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 text-center">{obj.completed_projects}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm font-semibold text-blue-600 text-center">%{obj.avg_progress}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-semibold">
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">TOPLAM</td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                        {objectives.reduce((sum, obj) => sum + obj.goals.length, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                        {objectives.reduce((sum, obj) => sum + obj.total_projects, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                        {objectives.reduce((sum, obj) => sum + obj.completed_projects, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-blue-900 text-center">
                        %{objectives.length > 0
                          ? Math.round(objectives.reduce((sum, obj) => sum + obj.avg_progress, 0) / objectives.length)
                          : 0
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {summaryData.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Amaç Bazlı Proje Dağılımı</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={summaryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {summaryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
