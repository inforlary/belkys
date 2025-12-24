import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Calendar, User, Building2, FileText } from 'lucide-react';
import { exportToExcel } from '../../utils/exportHelpers';
import { generateActivityStatusPDF } from '../../utils/reportPDFGenerators';

interface ActivityData {
  id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  responsible_person: string;
  department_name: string;
  goal_title: string;
  is_overdue: boolean;
}

export default function ActivityStatus() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      console.log('No organization_id found in profile');
      return;
    }

    try {
      console.log('Loading activities for organization:', profile.organization_id);

      let activitiesQuery = supabase
        .from('activities')
        .select(`
          id,
          title,
          status,
          start_date,
          end_date,
          responsible_user_id,
          department_id,
          goals (
            title,
            department_id
          ),
          profiles!activities_responsible_user_id_fkey (
            full_name
          ),
          departments (
            name
          )
        `)
        .eq('organization_id', profile.organization_id);

      // Non-admin and non-manager users see only their department's activities
      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        activitiesQuery = activitiesQuery.eq('department_id', profile.department_id);
        console.log('Filtering by department:', profile.department_id);
      }

      const { data: activitiesData, error: activitiesError } = await activitiesQuery
        .order('start_date', { ascending: false });

      if (activitiesError) {
        console.error('Faaliyetler yüklenirken hata:', activitiesError);
        throw activitiesError;
      }

      console.log('Activities loaded:', activitiesData?.length || 0);

      if (activitiesData) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const processedActivities = activitiesData.map(activity => {
          const endDate = new Date(activity.end_date);
          endDate.setHours(0, 0, 0, 0);
          const isOverdue = activity.status === 'ongoing' && endDate < today;

          return {
            id: activity.id,
            title: activity.title,
            status: activity.status,
            start_date: activity.start_date,
            end_date: activity.end_date,
            responsible_person: (activity.profiles as any)?.full_name || 'Atanmamış',
            department_name: (activity.departments as any)?.name || '-',
            goal_title: (activity.goals as any)?.title || '-',
            is_overdue: isOverdue,
          };
        });

        setActivities(processedActivities);

        setStats({
          total: processedActivities.length,
          ongoing: processedActivities.filter(a => a.status === 'ongoing').length,
          completed: processedActivities.filter(a => a.status === 'completed').length,
          cancelled: processedActivities.filter(a => a.status === 'cancelled').length,
          overdue: processedActivities.filter(a => a.is_overdue).length,
        });
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = activities.map(activity => ({
      'Faaliyet': activity.title,
      'Hedef': activity.goal_title,
      'Birim': activity.department_name,
      'Sorumlu': activity.responsible_person,
      'Başlangıç': new Date(activity.start_date).toLocaleDateString('tr-TR'),
      'Bitiş': new Date(activity.end_date).toLocaleDateString('tr-TR'),
      'Durum': getStatusLabel(activity.status),
      'Gecikmiş': activity.is_overdue ? 'Evet' : 'Hayır',
    }));

    exportToExcel(exportData, 'Faaliyet_Durumu');
  };

  const handlePDFExport = () => {
    generateActivityStatusPDF(activities, stats);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ongoing: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal Edildi',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'bg-red-100 text-red-800 border-red-200';
    if (status === 'completed') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'cancelled') return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Faaliyet Durum Raporu</h2>
          <p className="text-sm text-slate-600 mt-1">
            Tüm faaliyetlerin detaylı durum takibi
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
          <div className="text-sm text-slate-600 mt-1">Toplam</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.ongoing}</div>
          <div className="text-sm text-slate-600 mt-1">Devam Eden</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-slate-600 mt-1">Tamamlanan</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-slate-600 mt-1">Gecikmiş</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-gray-600">{stats.cancelled}</div>
          <div className="text-sm text-slate-600 mt-1">İptal Edildi</div>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Henüz faaliyet bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`bg-white border rounded-lg p-4 ${
                activity.is_overdue ? 'border-red-300' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900">{activity.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{activity.goal_title}</p>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                    activity.status,
                    activity.is_overdue
                  )}`}
                >
                  {activity.is_overdue ? 'GECİKMİŞ' : getStatusLabel(activity.status)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-4 h-4" />
                  <span>{activity.department_name}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4" />
                  <span>{activity.responsible_person}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(activity.start_date).toLocaleDateString('tr-TR')} -{' '}
                    {new Date(activity.end_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
