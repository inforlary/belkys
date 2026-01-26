import { useState, useEffect } from 'react';
import { FolderOpen, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ProjectManagementSummaryCard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalProjects, setTotalProjects] = useState(0);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [ongoingProjects, setOngoingProjects] = useState(0);
  const [delayedProjects, setDelayedProjects] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    if (profile?.organization_id) {
      loadProjectSummary();
    }
  }, [profile?.organization_id]);

  const loadProjectSummary = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const { data: projects, count } = await supabase
        .from('projects')
        .select('id, status, progress, end_date', { count: 'exact' })
        .eq('organization_id', profile.organization_id);

      setTotalProjects(count || 0);

      const completed = projects?.filter(p => p.status === 'Tamamlandı' || p.status === 'completed').length || 0;
      setCompletedProjects(completed);

      const ongoing = projects?.filter(p =>
        p.status === 'Devam Ediyor' ||
        p.status === 'ongoing' ||
        p.status === 'Başlamadı' ||
        p.status === 'not_started'
      ).length || 0;
      setOngoingProjects(ongoing);

      const today = new Date();
      const delayed = projects?.filter(p => {
        if (p.status === 'Tamamlandı' || p.status === 'completed') return false;
        if (!p.end_date) return false;
        return new Date(p.end_date) < today;
      }).length || 0;
      setDelayedProjects(delayed);

      if (projects && projects.length > 0) {
        const avgProgress = projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length;
        setOverallProgress(avgProgress);
      }

    } catch (error) {
      console.error('Error loading project summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBg = (rate: number) => {
    if (rate >= 80) return 'bg-green-50';
    if (rate >= 60) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <FolderOpen className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Proje Yönetimi Özeti</h3>
            <p className="text-sm text-slate-500">Proje portföyü ve ilerleme durumu</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`${getStatusBg(overallProgress)} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Ortalama İlerleme</p>
              <p className={`text-2xl font-bold ${getStatusColor(overallProgress)}`}>
                %{overallProgress.toFixed(1)}
              </p>
            </div>
            <CheckCircle className={`w-8 h-8 ${getStatusColor(overallProgress)}`} />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Devam Eden Projeler</p>
              <p className="text-2xl font-bold text-blue-600">{ongoingProjects}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className={`${delayedProjects > 0 ? 'bg-red-50' : 'bg-green-50'} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Geciken Projeler</p>
              <p className={`text-2xl font-bold ${delayedProjects > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {delayedProjects}
              </p>
            </div>
            <AlertCircle className={`w-8 h-8 ${delayedProjects > 0 ? 'text-red-600' : 'text-green-600'}`} />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Toplam Proje</span>
            <span className="text-sm font-semibold text-slate-900">{totalProjects}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Tamamlanan</span>
            <span className="text-sm font-semibold text-green-600">{completedProjects}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Devam Eden</span>
            <span className="text-sm font-semibold text-blue-600">{ongoingProjects}</span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Genel İlerleme</span>
              <span className="text-xs text-slate-500">%{overallProgress.toFixed(0)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
