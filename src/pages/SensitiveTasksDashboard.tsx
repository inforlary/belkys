import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  CheckCircle2,
  List,
  UserPlus,
  FileText,
  ChevronRight
} from 'lucide-react';
import { SensitiveTask, DashboardStats, TaskAlert } from '../types/sensitive-tasks';

export default function SensitiveTasksDashboard() {
  const { navigate } = useLocation();
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    total_tasks: 0,
    awaiting_assignment: 0,
    rotation_due: 0,
    rotation_overdue: 0
  });
  const [alerts, setAlerts] = useState<TaskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: tasks, error } = await supabase
        .from('sensitive_tasks')
        .select(`
          *,
          department:departments(id, name),
          assigned_primary:profiles!assigned_primary_id(id, full_name, email, role),
          assigned_backup:profiles!assigned_backup_id(id, full_name, email, role),
          workflow:workflow_processes(id, name, code)
        `)
        .eq('organization_id', profile!.organization_id);

      if (error) throw error;

      const taskList = (tasks || []) as unknown as SensitiveTask[];

      setStats({
        total_tasks: taskList.length,
        awaiting_assignment: taskList.filter(t => t.status === 'awaiting_assignment').length,
        rotation_due: taskList.filter(t => t.status === 'rotation_due').length,
        rotation_overdue: taskList.filter(t => t.status === 'rotation_overdue').length
      });

      const alertList: TaskAlert[] = [];

      taskList.forEach(task => {
        if (task.status === 'rotation_overdue') {
          const daysOverdue = task.next_rotation_date
            ? Math.floor((new Date().getTime() - new Date(task.next_rotation_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          alertList.push({
            type: 'overdue',
            severity: 'high',
            message: `${task.task_name} için rotasyon süresi ${daysOverdue} gün önce doldu!`,
            task
          });
        } else if (task.status === 'rotation_due') {
          const daysLeft = task.next_rotation_date
            ? Math.floor((new Date(task.next_rotation_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          alertList.push({
            type: 'due_soon',
            severity: 'medium',
            message: `${task.task_name} rotasyonuna ${daysLeft} gün kaldı`,
            task
          });
        }

        if (!task.assigned_backup_id && task.assigned_primary_id) {
          alertList.push({
            type: 'no_backup',
            severity: 'medium',
            message: `${task.task_name} görevine yedek personel atanmadı`,
            task
          });
        }

        if (task.status === 'awaiting_assignment') {
          alertList.push({
            type: 'no_assignment',
            severity: 'high',
            message: `${task.task_name} görevine personel atanmadı`,
            task
          });
        }
      });

      alertList.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      setAlerts(alertList);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      alert('Veri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'border-l-red-500 bg-red-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getSeverityIcon = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'medium': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'low': return <AlertTriangle className="w-5 h-5 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Hassas Görevler Yönetimi</h1>
        <p className="mt-2 text-slate-600">
          Yolsuzluk riski taşıyan görevlerin personel ataması ve rotasyon takibi
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Toplam Hassas Görev</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total_tasks}</p>
            </div>
            <div className="bg-blue-100 rounded-xl p-3">
              <AlertTriangle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Atama Bekleyen</p>
              <p className="mt-2 text-3xl font-bold text-red-600">{stats.awaiting_assignment}</p>
            </div>
            <div className="bg-red-100 rounded-xl p-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Rotasyonu Yaklaşan</p>
              <p className="mt-2 text-3xl font-bold text-yellow-600">{stats.rotation_due}</p>
            </div>
            <div className="bg-yellow-100 rounded-xl p-3">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Rotasyonu Geçmiş</p>
              <p className="mt-2 text-3xl font-bold text-rose-600">{stats.rotation_overdue}</p>
            </div>
            <div className="bg-rose-100 rounded-xl p-3">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">Dikkat Gerektiren Durumlar</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`px-6 py-4 flex items-center justify-between border-l-4 ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  <div>
                    <p className="font-medium text-slate-900">{alert.message}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Süreç: {alert.task.process_name}
                      {alert.task.department?.name && ` • Birim: ${alert.task.department.name}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/sensitive-tasks/${alert.task.id}`)}
                  className="ml-4 flex items-center gap-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 transition-colors"
                >
                  Göreve Git
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Hızlı Erişim</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/sensitive-tasks/list')}
            className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group"
          >
            <div className="bg-blue-100 rounded-lg p-2 group-hover:bg-blue-200 transition-colors">
              <List className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-900">Hassas Görev Listesi</p>
              <p className="text-sm text-slate-600">Tüm görevleri görüntüle</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/sensitive-tasks/list?action=assign')}
            className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group"
          >
            <div className="bg-green-100 rounded-lg p-2 group-hover:bg-green-200 transition-colors">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-900">Yeni Atama Yap</p>
              <p className="text-sm text-slate-600">Personel ataması yap</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/sensitive-tasks/reports')}
            className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group"
          >
            <div className="bg-purple-100 rounded-lg p-2 group-hover:bg-purple-200 transition-colors">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-900">Raporlar</p>
              <p className="text-sm text-slate-600">Denetim raporları oluştur</p>
            </div>
          </button>
        </div>
      </div>

      {alerts.length === 0 && stats.total_tasks > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-900 mb-2">Her Şey Yolunda!</h3>
          <p className="text-green-700">
            Şu anda dikkat gerektiren bir durum bulunmamaktadır.
          </p>
        </div>
      )}

      {stats.total_tasks === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8">
          <div className="text-center mb-6">
            <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Henüz Hassas Görev Yok</h3>
            <p className="text-slate-600">
              İş akış şemalarında hassas olarak işaretlenen adımlar otomatik olarak buraya aktarılacaktır.
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-xl p-6 mb-6">
            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Hassas Görev Oluşturma Adımları
            </h4>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span><strong>İş Akışı Yönetimi</strong> modülüne gidin ve yeni bir iş akış şeması oluşturun</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Adımlar eklerken, yolsuzluk riski taşıyan adımları <strong>"Hassas Görev"</strong> olarak işaretleyin</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>İş akışını <strong>"Onaya Gönder"</strong> butonuna tıklayarak onaya gönderin</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>Admin veya Müdür olarak iş akışını <strong>onaylayın</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
                <span>Onaylandıktan sonra hassas adımlar otomatik olarak bu modüle aktarılacaktır</span>
              </li>
            </ol>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/workflows')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              İş Akış Şemalarına Git
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
