import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Card } from './ui/Card';
import { Plus, Edit2, Trash2, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import type { TaskAssignment } from '../types/database';

interface TaskAssignmentProps {
  activityId: string;
  activityName: string;
}

export function TaskAssignmentComponent({ activityId, activityName }: TaskAssignmentProps) {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskAssignment | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'pending' as 'pending' | 'in_progress' | 'completed' | 'cancelled',
  });

  useEffect(() => {
    loadData();
  }, [activityId]);

  async function loadData() {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        supabase
          .from('task_assignments')
          .select('*, assigned_to_profile:profiles!task_assignments_assigned_to_fkey(full_name), assigned_by_profile:profiles!task_assignments_assigned_by_fkey(full_name)')
          .eq('activity_id', activityId)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('full_name'),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (error) {
      console.error('Görevler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('task_assignments')
          .update({
            title: formData.title,
            description: formData.description,
            assigned_to: formData.assigned_to,
            due_date: formData.due_date || null,
            priority: formData.priority,
            status: formData.status,
          })
          .eq('id', editingTask.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('task_assignments')
          .insert({
            activity_id: activityId,
            assigned_to: formData.assigned_to,
            assigned_by: user.id,
            title: formData.title,
            description: formData.description,
            due_date: formData.due_date || null,
            priority: formData.priority,
            status: formData.status,
          });

        if (error) throw error;
      }

      handleCloseModal();
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Görev kaydedilirken hata oluştu');
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm('Bu görevi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Görev silinirken hata oluştu');
    }
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Durum güncellenirken hata oluştu');
    }
  }

  function handleEdit(task: TaskAssignment) {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to,
      due_date: task.due_date || '',
      priority: task.priority,
      status: task.status,
    });
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      assigned_to: '',
      due_date: '',
      priority: 'medium',
      status: 'pending',
    });
  }

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const statusIcons = {
    pending: Clock,
    in_progress: AlertCircle,
    completed: CheckCircle,
    cancelled: XCircle,
  };

  const statusLabels = {
    pending: 'Bekliyor',
    in_progress: 'Devam Ediyor',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi',
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };

  const priorityLabels = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
    urgent: 'Acil',
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Görev Atamaları</h3>
        {isAdminOrManager && (
          <Button onClick={() => setShowModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Yeni Görev
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <Card className="p-6 text-center text-gray-500">
          Henüz görev atanmamış
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const StatusIcon = statusIcons[task.status];
            const isAssignedToMe = task.assigned_to === user?.id;

            return (
              <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{task.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusLabels[task.status]}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>
                        {priorityLabels[task.priority]}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        <strong>Atanan:</strong> {(task as any).assigned_to_profile?.full_name}
                      </span>
                      <span>
                        <strong>Atayan:</strong> {(task as any).assigned_by_profile?.full_name}
                      </span>
                      {task.due_date && (
                        <span>
                          <strong>Bitiş:</strong> {new Date(task.due_date).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                    </div>

                    {isAssignedToMe && task.status !== 'completed' && task.status !== 'cancelled' && (
                      <div className="flex gap-2 mt-3">
                        {task.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(task.id, 'in_progress')}
                          >
                            Başlat
                          </Button>
                        )}
                        {task.status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(task.id, 'completed')}
                          >
                            Tamamla
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {isAdminOrManager && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(task)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingTask ? 'Görevi Düzenle' : 'Yeni Görev'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Görev Başlığı *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Atanacak Kişi *
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seçiniz</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Öncelik *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="pending">Bekliyor</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal Edildi</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {editingTask ? 'Güncelle' : 'Kaydet'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              className="flex-1"
            >
              İptal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
