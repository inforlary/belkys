import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, TrendingUp, DollarSign, User, Building2, Clock, AlertTriangle, Target, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';

interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  department_id: string;
  manager_id?: string;
  budget?: number;
  actual_cost?: number;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
  created_at: string;
  related_goal_id?: string;
  related_activity_id?: string;
  department?: {
    id: string;
    name: string;
  };
  manager?: {
    id: string;
    full_name: string;
    email: string;
  };
  goal?: {
    id: string;
    code: string;
    name: string;
    objective_id: string;
    objective?: {
      id: string;
      code: string;
      name: string;
    };
  };
  activity?: {
    id: string;
    code: string;
    name: string;
  };
}

const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  PLANNED: { label: 'Planlandı', color: 'text-gray-800', bgColor: 'bg-gray-100' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'text-blue-800', bgColor: 'bg-blue-100' },
  ON_HOLD: { label: 'Beklemede', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
  COMPLETED: { label: 'Tamamlandı', color: 'text-green-800', bgColor: 'bg-green-100' },
  CANCELLED: { label: 'İptal Edildi', color: 'text-red-800', bgColor: 'bg-red-100' }
};

export default function ProjectDetail() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const pathParts = window.location.pathname.split('/');
  const projectId = pathParts[pathParts.length - 1];

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.organization_id && projectId) {
      loadProject();
      loadRisks();
    }
  }, [profile?.organization_id, projectId]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          department:departments!department_id(id, name),
          manager:profiles!manager_id(id, full_name, email),
          goal:goals!related_goal_id(id, code, name, objective_id, objective:objectives!objective_id(id, code, name)),
          activity:activities!related_activity_id(id, code, name)
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Proje yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRisks() {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select('id, code, name, risk_level, status, residual_likelihood, residual_impact')
        .eq('related_project_id', projectId)
        .eq('is_active', true)
        .order('residual_likelihood', { ascending: false });

      if (error) throw error;
      setRisks(data || []);
    } catch (error) {
      console.error('Riskler yüklenirken hata:', error);
    }
  }

  function getRemainingDays(endDate: string): number {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function getTotalDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function getElapsedDays(startDate: string): number {
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  function getBudgetVariance(): number {
    if (!project?.budget || !project?.actual_cost) return 0;
    return ((project.actual_cost - project.budget) / project.budget) * 100;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  if (!project) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Proje bulunamadı</div></div>;
  }

  const statusInfo = statusLabels[project.status] || statusLabels['PLANNED'];
  const remainingDays = getRemainingDays(project.end_date);
  const totalDays = getTotalDays(project.start_date, project.end_date);
  const elapsedDays = getElapsedDays(project.start_date);
  const isOverdue = remainingDays < 0 && project.status !== 'COMPLETED' && project.status !== 'CANCELLED';
  const budgetVariance = getBudgetVariance();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.code}</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-lg text-gray-700 mt-1">{project.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-start gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-2">İlerleme</div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-2xl font-bold text-gray-900">{project.progress}%</span>
              </div>
              <div className="text-xs text-gray-500">
                {project.progress === 100 ? 'Tamamlandı' : `%${100 - project.progress} kaldı`}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">Süre</div>
              <div className="text-2xl font-bold text-gray-900">
                {isOverdue ? (
                  <span className="text-red-600">{Math.abs(remainingDays)} gün gecikti</span>
                ) : remainingDays === 0 ? (
                  <span className="text-yellow-600">Bugün bitiyor</span>
                ) : (
                  <span>{remainingDays} gün kaldı</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {elapsedDays} / {totalDays} gün geçti
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">Bütçe</div>
              <div className="text-2xl font-bold text-gray-900">
                {project.budget ? `${project.budget.toLocaleString('tr-TR')} TL` : '-'}
              </div>
              {project.actual_cost !== undefined && project.actual_cost > 0 && (
                <div className={`text-xs mt-1 ${budgetVariance > 10 ? 'text-red-600' : budgetVariance < -10 ? 'text-green-600' : 'text-gray-600'}`}>
                  Gerçekleşen: {project.actual_cost.toLocaleString('tr-TR')} TL
                  {budgetVariance !== 0 && (
                    <span className="ml-1">
                      ({budgetVariance > 0 ? '+' : ''}{budgetVariance.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {isOverdue && (
        <Card className="border-l-4 border-red-500 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <div className="font-semibold text-red-900">Proje Gecikmiş</div>
              <div className="text-sm text-red-700">
                Planlanan bitiş tarihinden {Math.abs(remainingDays)} gün geçmiştir
              </div>
            </div>
          </div>
        </Card>
      )}

      {(project.related_goal_id || project.related_activity_id) && (
        <Card className="border-l-4 border-green-500 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  Stratejik Plan Bağlantısı
                </h3>
                <div className="space-y-2">
                  {project.goal?.objective && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Amaç:</span>
                      <span className="ml-2 text-gray-900">
                        {project.goal.objective.code} - {project.goal.objective.name}
                      </span>
                    </div>
                  )}
                  {project.goal && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Hedef:</span>
                      <span className="ml-2 text-gray-900">
                        {project.goal.code} - {project.goal.name}
                      </span>
                    </div>
                  )}
                  {project.activity && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Faaliyet:</span>
                      <span className="ml-2 text-gray-900">
                        {project.activity.code} - {project.activity.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {project.goal && (
              <button
                onClick={() => navigate(`/goals`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                Stratejik Plana Git
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Proje Bilgileri</h2>

        <div className="space-y-4">
          {project.description && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Açıklama</div>
              <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                {project.description}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700">Sorumlu Birim</div>
                <div className="text-sm text-gray-900">{project.department?.name || '-'}</div>
              </div>
            </div>

            {project.manager && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Proje Yöneticisi</div>
                  <div className="text-sm text-gray-900">{project.manager.full_name}</div>
                  <div className="text-xs text-gray-500">{project.manager.email}</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700">Başlangıç Tarihi</div>
                <div className="text-sm text-gray-900">
                  {new Date(project.start_date).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700">Bitiş Tarihi</div>
                <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                  {new Date(project.end_date).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                  {isOverdue && <span className="ml-2">⚠️ Gecikmiş</span>}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700">Oluşturulma</div>
                <div className="text-sm text-gray-900">
                  {new Date(project.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {project.budget && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bütçe Analizi</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-700 mb-1">Planlanan Bütçe</div>
                <div className="text-2xl font-bold text-blue-900">
                  {project.budget.toLocaleString('tr-TR')} TL
                </div>
              </div>

              <div className={`p-4 rounded-lg ${project.actual_cost && project.actual_cost > 0 ? 'bg-purple-50' : 'bg-gray-50'}`}>
                <div className={`text-sm mb-1 ${project.actual_cost && project.actual_cost > 0 ? 'text-purple-700' : 'text-gray-600'}`}>
                  Gerçekleşen Maliyet
                </div>
                <div className={`text-2xl font-bold ${project.actual_cost && project.actual_cost > 0 ? 'text-purple-900' : 'text-gray-700'}`}>
                  {project.actual_cost && project.actual_cost > 0
                    ? `${project.actual_cost.toLocaleString('tr-TR')} TL`
                    : '0 TL'
                  }
                </div>
              </div>

              <div className={`p-4 rounded-lg ${
                budgetVariance > 10 ? 'bg-red-50' :
                budgetVariance < -10 ? 'bg-green-50' : 'bg-gray-50'
              }`}>
                <div className={`text-sm mb-1 ${
                  budgetVariance > 10 ? 'text-red-700' :
                  budgetVariance < -10 ? 'text-green-700' : 'text-gray-600'
                }`}>
                  Fark
                </div>
                <div className={`text-2xl font-bold ${
                  budgetVariance > 10 ? 'text-red-900' :
                  budgetVariance < -10 ? 'text-green-900' : 'text-gray-700'
                }`}>
                  {project.actual_cost && project.actual_cost > 0
                    ? `${(project.actual_cost - project.budget).toLocaleString('tr-TR')} TL`
                    : '-'
                  }
                  {budgetVariance !== 0 && project.actual_cost && project.actual_cost > 0 && (
                    <div className="text-sm mt-1">
                      ({budgetVariance > 0 ? '+' : ''}{budgetVariance.toFixed(1)}%)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {project.actual_cost && project.actual_cost > 0 && (
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Bütçe Kullanımı</span>
                  <span className="font-medium">
                    {((project.actual_cost / project.budget) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      (project.actual_cost / project.budget) > 1 ? 'bg-red-600' :
                      (project.actual_cost / project.budget) > 0.9 ? 'bg-yellow-600' : 'bg-green-600'
                    }`}
                    style={{ width: `${Math.min((project.actual_cost / project.budget) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Zaman Çizelgesi</h2>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Toplam Süre</span>
            <span className="font-medium text-gray-900">{totalDays} gün</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Geçen Süre</span>
            <span className="font-medium text-gray-900">{elapsedDays} gün</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Kalan Süre</span>
            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
              {isOverdue ? `${Math.abs(remainingDays)} gün gecikti` : `${remainingDays} gün`}
            </span>
          </div>

          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  isOverdue ? 'bg-red-600' :
                  remainingDays <= 7 ? 'bg-yellow-600' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min((elapsedDays / totalDays) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {risks.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Proje Riskleri</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-gray-600">Toplam: </span>
                <span className="font-semibold text-gray-900">{risks.length}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Yüksek Risk: </span>
                <span className="font-semibold text-red-600">
                  {risks.filter(r => (r.residual_likelihood * r.residual_impact) >= 15).length}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Kodu</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Skoru</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seviye</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {risks.map((risk) => {
                  const score = risk.residual_likelihood * risk.residual_impact;
                  const levelColor = score >= 20 ? 'bg-red-100 text-red-800' :
                                   score >= 15 ? 'bg-orange-100 text-orange-800' :
                                   score >= 9 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
                  const levelLabel = score >= 20 ? 'Kritik' : score >= 15 ? 'Yüksek' : score >= 9 ? 'Orta' : 'Düşük';

                  return (
                    <tr key={risk.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/risks/${risk.id}`)}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{risk.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{risk.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${levelColor}`}>
                          {score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{levelLabel}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {risk.status === 'ACTIVE' ? 'Aktif' : risk.status === 'CLOSED' ? 'Kapalı' : 'Diğer'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
