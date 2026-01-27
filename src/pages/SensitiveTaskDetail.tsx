import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  ArrowLeft,
  User,
  UserPlus,
  Clock,
  RotateCcw,
  PauseCircle,
  History,
  AlertCircle,
  Edit2,
  ExternalLink
} from 'lucide-react';
import {
  SensitiveTask,
  TaskRotationHistory,
  ROTATION_PERIOD_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  ACTION_TYPE_LABELS
} from '../types/sensitive-tasks';
import Modal from '../components/ui/Modal';

export default function SensitiveTaskDetail() {
  const { currentPath, navigate } = useLocation();
  const { profile } = useAuth();
  const id = currentPath.split('/').pop();
  const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const [task, setTask] = useState<SensitiveTask | null>(null);
  const [history, setHistory] = useState<TaskRotationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);

  useEffect(() => {
    if (id && profile?.organization_id) {
      loadData();
    }
  }, [id, profile?.organization_id]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'edit') {
      setShowAssignModal(true);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [taskResult, historyResult] = await Promise.all([
        supabase
          .from('sensitive_tasks')
          .select(`
            *,
            department:departments(id, name),
            assigned_primary:profiles!assigned_primary_id(id, full_name, email, role),
            assigned_backup:profiles!assigned_backup_id(id, full_name, email, role),
            workflow:workflow_processes(id, name, code)
          `)
          .eq('id', id!)
          .single(),
        supabase
          .from('task_rotation_history')
          .select(`
            *,
            previous_primary:profiles!previous_primary_id(id, full_name),
            new_primary:profiles!new_primary_id(id, full_name),
            previous_backup:profiles!previous_backup_id(id, full_name),
            new_backup:profiles!new_backup_id(id, full_name),
            performer:profiles!performed_by(id, full_name)
          `)
          .eq('sensitive_task_id', id!)
          .order('action_date', { ascending: false })
      ]);

      if (taskResult.error) throw taskResult.error;

      setTask(taskResult.data as unknown as SensitiveTask);
      setHistory(historyResult.data as unknown as TaskRotationHistory[] || []);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilRotation = () => {
    if (!task?.next_rotation_date) return null;
    const days = Math.floor(
      (new Date(task.next_rotation_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('tr-TR');
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

  if (!task) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Görev Bulunamadı</h2>
        <p className="text-slate-600 mb-6">Aradığınız hassas görev mevcut değil.</p>
        <button
          onClick={() => navigate('/sensitive-tasks')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Dashboard'a Dön
        </button>
      </div>
    );
  }

  const daysUntilRotation = getDaysUntilRotation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/sensitive-tasks/list')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Listeye Dön</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{task.task_name}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              {task.workflow && (
                <button
                  onClick={() => navigate(`/workflows/${task.workflow_id}`)}
                  className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{task.workflow.name}</span>
                </button>
              )}
              {task.department && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">Birim:</span> {task.department.name}
                </span>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Personel Ataması</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase">Asil Personel</h3>
                {task.assigned_primary_id && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Değiştir
                  </button>
                )}
              </div>
              {task.assigned_primary ? (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{task.assigned_primary.full_name}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{task.assigned_primary.role}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Atanma: {formatDate(task.last_rotation_date || task.created_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-4">Asil personel atanmamış</p>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Personel Ata
                  </button>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase">Yedek Personel</h3>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {task.assigned_backup_id ? 'Değiştir' : 'Ata'}
                </button>
              </div>
              {task.assigned_backup ? (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{task.assigned_backup.full_name}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{task.assigned_backup.role}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Atanma: {formatDate(task.last_rotation_date || task.created_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-2">Yedek personel atanmamış</p>
                  <p className="text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg inline-block">
                    Denetim raporlarında görünecektir
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Rotasyon Bilgileri</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">Rotasyon Periyodu</p>
              <p className="text-lg font-semibold text-slate-900">{ROTATION_PERIOD_LABELS[task.rotation_period]}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">Son Rotasyon Tarihi</p>
              <p className="text-lg font-semibold text-slate-900">{formatDate(task.last_rotation_date)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">Sonraki Rotasyon Tarihi</p>
              <p className="text-lg font-semibold text-slate-900">{formatDate(task.next_rotation_date)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">Kalan Süre</p>
              {daysUntilRotation !== null ? (
                <p className={`text-lg font-semibold ${
                  daysUntilRotation < 0 ? 'text-red-600' :
                  daysUntilRotation <= 15 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {daysUntilRotation < 0 ? `${Math.abs(daysUntilRotation)} gün geçti` : `${daysUntilRotation} gün`}
                </p>
              ) : (
                <p className="text-lg font-semibold text-slate-400">-</p>
              )}
            </div>
          </div>

          {task.assigned_primary_id && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowRotationModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                Rotasyon Yap
              </button>
              <button
                onClick={() => setShowPostponeModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium"
              >
                <PauseCircle className="w-4 h-4" />
                Rotasyon Ertele
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Rotasyon Geçmişi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Tarih</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">İşlem</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Asil Personel</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Yedek Personel</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Açıklama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Henüz rotasyon geçmişi bulunmamaktadır
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">{formatDate(item.action_date)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {ACTION_TYPE_LABELS[item.action_type]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.action_type === 'rotation' && item.previous_primary?.full_name ? (
                        <div>
                          <span className="text-slate-500">{item.previous_primary.full_name}</span>
                          <span className="mx-2 text-slate-400">→</span>
                          <span className="text-slate-900 font-medium">{item.new_primary?.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-900">{item.new_primary?.full_name || '-'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.action_type === 'rotation' && item.previous_backup?.full_name ? (
                        <div>
                          <span className="text-slate-500">{item.previous_backup.full_name}</span>
                          <span className="mx-2 text-slate-400">→</span>
                          <span className="text-slate-900 font-medium">{item.new_backup?.full_name || '-'}</span>
                        </div>
                      ) : (
                        <span className="text-slate-900">{item.new_backup?.full_name || '-'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAssignModal && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title="Personel Ataması"
        >
          <p className="text-slate-600">Personel atama modal içeriği buraya gelecek</p>
        </Modal>
      )}

      {showRotationModal && (
        <Modal
          isOpen={showRotationModal}
          onClose={() => setShowRotationModal(false)}
          title="Rotasyon Yap"
        >
          <p className="text-slate-600">Rotasyon modal içeriği buraya gelecek</p>
        </Modal>
      )}

      {showPostponeModal && (
        <Modal
          isOpen={showPostponeModal}
          onClose={() => setShowPostponeModal(false)}
          title="Rotasyon Ertele"
        >
          <p className="text-slate-600">Erteleme modal içeriği buraya gelecek</p>
        </Modal>
      )}
    </div>
  );
}
