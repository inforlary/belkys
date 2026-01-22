import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FolderOpen, CheckCircle, Clock, Target, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ProjectStats {
  total: number;
  completed: number;
  inProgress: number;
  spLinked: number;
}

interface AttentionProject {
  id: string;
  project_name: string;
  project_no: string;
  last_update_date: string;
  days_since_update: number;
}

interface SourceDistribution {
  name: string;
  value: number;
  color: string;
}

interface Activity {
  id: string;
  type: string;
  project_name: string;
  project_no: string;
  message: string;
  created_at: string;
}

const COLORS = {
  ilyas: '#3b82f6',
  beyanname: '#22c55e',
  genel: '#9ca3af'
};

export default function ProjectManagementDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<ProjectStats>({ total: 0, completed: 0, inProgress: 0, spLinked: 0 });
  const [attentionProjects, setAttentionProjects] = useState<AttentionProject[]>([]);
  const [sourceDistribution, setSourceDistribution] = useState<SourceDistribution[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadDashboardData();
    }
  }, [profile?.organization_id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', profile?.organization_id);

      if (error) throw error;

      const total = projects?.length || 0;
      const completed = projects?.filter(p => p.status === 'completed').length || 0;
      const inProgress = projects?.filter(p => p.status === 'in_progress').length || 0;
      const spLinked = projects?.filter(p => p.strategic_plan_id).length || 0;

      setStats({ total, completed, inProgress, spLinked });

      const ilyasCount = projects?.filter(p => p.source === 'ilyas').length || 0;
      const beyannameCount = projects?.filter(p => p.source === 'beyanname').length || 0;
      const genelCount = projects?.filter(p => p.source === 'genel').length || 0;

      setSourceDistribution([
        { name: 'İLYAS', value: ilyasCount, color: COLORS.ilyas },
        { name: 'Beyanname', value: beyannameCount, color: COLORS.beyanname },
        { name: 'Genel', value: genelCount, color: COLORS.genel }
      ]);

      const now = new Date();
      const attention = projects
        ?.filter(p => p.status !== 'completed' && p.status !== 'cancelled')
        .map(p => {
          const lastUpdate = new Date(p.last_update_date);
          const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: p.id,
            project_name: p.project_name,
            project_no: p.project_no,
            last_update_date: p.last_update_date,
            days_since_update: daysSince
          };
        })
        .filter(p => p.days_since_update >= 10)
        .sort((a, b) => b.days_since_update - a.days_since_update)
        .slice(0, 5) || [];

      setAttentionProjects(attention);

      const { data: progressData } = await supabase
        .from('project_progress')
        .select(`
          id,
          description,
          created_at,
          project_id,
          projects (
            project_name,
            project_no
          )
        `)
        .eq('projects.organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
        .limit(10);

      const recentActivities: Activity[] = [];

      progressData?.forEach(p => {
        recentActivities.push({
          id: p.id,
          type: 'progress',
          project_name: (p.projects as any)?.project_name || '',
          project_no: (p.projects as any)?.project_no || '',
          message: `${(p.projects as any)?.project_no} projesinde ilerleme kaydı eklendi`,
          created_at: p.created_at
        });
      });

      const completedProjects = projects?.filter(p => p.status === 'completed').slice(0, 5) || [];
      completedProjects.forEach(p => {
        recentActivities.push({
          id: p.id,
          type: 'completed',
          project_name: p.project_name,
          project_no: p.project_no,
          message: `${p.project_no} projesi tamamlandı`,
          created_at: p.updated_at
        });
      });

      recentActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(recentActivities.slice(0, 10));

    } catch (error) {
      console.error('Dashboard verileri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInDays = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Bugün';
    if (diffInDays === 1) return 'Dün';
    if (diffInDays < 7) return `${diffInDays} gün önce`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} hafta önce`;
    return `${Math.floor(diffInDays / 30)} ay önce`;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proje Yönetimi</h1>
          <p className="mt-1 text-gray-600">Proje portföyünüzün genel görünümü</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Proje</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <FolderOpen className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tamamlanan</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.completed}</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Devam Eden</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.inProgress}</p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SP Bağlı</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{stats.spLinked}</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <Target className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Dikkat Gerektiren Projeler</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Güncelleme yapılması gereken projeler</p>
          </div>
          <div className="p-6">
            {attentionProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p>Tüm projeler güncel!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attentionProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        project.days_since_update >= 20 ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {project.project_no} - {project.project_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {project.days_since_update} gün önce güncellendi
                        </p>
                      </div>
                    </div>
                    <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 ml-3">
                      Güncelle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Kaynak Dağılımı</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Projelerin kaynaklara göre dağılımı</p>
          </div>
          <div className="p-6">
            {sourceDistribution.every(s => s.value === 0) ? (
              <div className="text-center py-8 text-gray-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Henüz proje bulunmuyor</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={sourceDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sourceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {sourceDistribution.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Son Aktiviteler</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">Projelerdeki son değişiklikler ve güncellemeler</p>
        </div>
        <div className="p-6">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Henüz aktivite bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{getTimeAgo(activity.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
