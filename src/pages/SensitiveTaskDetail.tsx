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
  ExternalLink,
  Save
} from 'lucide-react';
import {
  SensitiveTask,
  TaskRotationHistory,
  RotationPeriod,
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
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [assignForm, setAssignForm] = useState({
    primary_id: '',
    backup_id: '',
    rotation_period: '' as RotationPeriod | '',
    notes: ''
  });

  const [rotationForm, setRotationForm] = useState({
    new_primary_id: '',
    new_backup_id: '',
    notes: ''
  });

  const [postponeForm, setPostponeForm] = useState({
    days: 30,
    reason: ''
  });

  useEffect(() => {
    if (id && profile?.organization_id) {
      loadData();
    }
  }, [id, profile?.organization_id]);

  useEffect(() => {
    if (task) {
      loadUsers();
    }
  }, [task]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'edit' && task) {
      setShowAssignModal(true);
      setAssignForm({
        primary_id: task.assigned_primary_id || '',
        backup_id: task.assigned_backup_id || '',
        rotation_period: task.rotation_period || '',
        notes: ''
      });
    }
  }, [searchParams, task]);

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

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_users_for_sensitive_task', {
        p_organization_id: profile!.organization_id,
        p_department_id: task?.department_id || null
      });

      if (error) throw error;

      console.log('Loaded users:', data?.length || 0, 'users for task department:', task?.department_id);
      setUsers(data || []);
    } catch (error) {
      console.error('Kullanıcı yükleme hatası:', error);
    }
  };

  const calculateNextRotationDate = (period: RotationPeriod, fromDate?: Date): string => {
    const date = fromDate || new Date();
    const next = new Date(date);

    switch (period) {
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'semi-annual':
        next.setMonth(next.getMonth() + 6);
        break;
      case 'annual':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'biennial':
        next.setFullYear(next.getFullYear() + 2);
        break;
    }

    return next.toISOString();
  };

  const handleAssignPersonnel = async () => {
    if (!assignForm.primary_id || !assignForm.rotation_period) {
      alert('Lütfen en az asil personel ve rotasyon periyodu seçiniz');
      return;
    }

    try {
      setSaving(true);

      const isInitialAssignment = !task?.assigned_primary_id;
      const now = new Date().toISOString();
      const nextRotationDate = calculateNextRotationDate(assignForm.rotation_period as RotationPeriod);

      const updateData: any = {
        assigned_primary_id: assignForm.primary_id,
        assigned_backup_id: assignForm.backup_id || null,
        rotation_period: assignForm.rotation_period,
        next_rotation_date: nextRotationDate,
        status: 'normal',
        updated_at: now
      };

      if (isInitialAssignment) {
        updateData.last_rotation_date = now;
      }

      const { error: updateError } = await supabase
        .from('sensitive_tasks')
        .update(updateData)
        .eq('id', id!);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('task_rotation_history')
        .insert({
          sensitive_task_id: id!,
          organization_id: profile!.organization_id,
          action_type: isInitialAssignment ? 'initial_assignment' : 'assignment',
          action_date: now,
          previous_primary_id: task?.assigned_primary_id || null,
          new_primary_id: assignForm.primary_id,
          previous_backup_id: task?.assigned_backup_id || null,
          new_backup_id: assignForm.backup_id || null,
          performed_by: profile!.id,
          notes: assignForm.notes
        });

      if (historyError) throw historyError;

      alert(isInitialAssignment ? 'Personel ataması başarıyla yapıldı!' : 'Personel değişikliği kaydedildi!');
      setShowAssignModal(false);
      loadData();
      setAssignForm({ primary_id: '', backup_id: '', rotation_period: '', notes: '' });
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      alert('Kayıt sırasında hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRotation = async () => {
    if (!rotationForm.new_primary_id) {
      alert('Lütfen yeni asil personel seçiniz');
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();
      const nextRotationDate = calculateNextRotationDate(task!.rotation_period);

      const { error: updateError } = await supabase
        .from('sensitive_tasks')
        .update({
          assigned_primary_id: rotationForm.new_primary_id,
          assigned_backup_id: rotationForm.new_backup_id || null,
          last_rotation_date: now,
          next_rotation_date: nextRotationDate,
          status: 'normal',
          updated_at: now
        })
        .eq('id', id!);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('task_rotation_history')
        .insert({
          sensitive_task_id: id!,
          organization_id: profile!.organization_id,
          action_type: 'rotation',
          action_date: now,
          previous_primary_id: task?.assigned_primary_id || null,
          new_primary_id: rotationForm.new_primary_id,
          previous_backup_id: task?.assigned_backup_id || null,
          new_backup_id: rotationForm.new_backup_id || null,
          performed_by: profile!.id,
          notes: rotationForm.notes
        });

      if (historyError) throw historyError;

      alert('Rotasyon başarıyla gerçekleştirildi!');
      setShowRotationModal(false);
      loadData();
      setRotationForm({ new_primary_id: '', new_backup_id: '', notes: '' });
    } catch (error: any) {
      console.error('Rotasyon hatası:', error);
      alert('Rotasyon sırasında hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePostpone = async () => {
    if (!postponeForm.reason.trim()) {
      alert('Lütfen erteleme gerekçesi giriniz');
      return;
    }

    try {
      setSaving(true);

      const currentDate = new Date(task!.next_rotation_date || new Date());
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + postponeForm.days);

      const { error: updateError } = await supabase
        .from('sensitive_tasks')
        .update({
          next_rotation_date: newDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id!);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('task_rotation_history')
        .insert({
          sensitive_task_id: id!,
          organization_id: profile!.organization_id,
          action_type: 'postponement',
          action_date: new Date().toISOString(),
          previous_primary_id: task?.assigned_primary_id || null,
          new_primary_id: task?.assigned_primary_id || null,
          previous_backup_id: task?.assigned_backup_id || null,
          new_backup_id: task?.assigned_backup_id || null,
          performed_by: profile!.id,
          notes: `${postponeForm.days} gün ertelendi. Gerekçe: ${postponeForm.reason}`
        });

      if (historyError) throw historyError;

      alert('Rotasyon başarıyla ertelendi!');
      setShowPostponeModal(false);
      loadData();
      setPostponeForm({ days: 30, reason: '' });
    } catch (error: any) {
      console.error('Erteleme hatası:', error);
      alert('Erteleme sırasında hata oluştu: ' + error.message);
    } finally {
      setSaving(false);
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
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Asil Personel <span className="text-red-500">*</span>
              </label>
              <select
                value={assignForm.primary_id}
                onChange={(e) => setAssignForm({ ...assignForm, primary_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              >
                <option value="">Seçiniz...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} - {user.role} {user.department_name ? `(${user.department_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Yedek Personel
              </label>
              <select
                value={assignForm.backup_id}
                onChange={(e) => setAssignForm({ ...assignForm, backup_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              >
                <option value="">Seçiniz...</option>
                {users
                  .filter(u => u.id !== assignForm.primary_id)
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} - {user.role} {user.department_name ? `(${user.department_name})` : ''}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Yedek personel seçilmezse denetim raporlarında uyarı verilecektir
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Rotasyon Periyodu <span className="text-red-500">*</span>
              </label>
              <select
                value={assignForm.rotation_period}
                onChange={(e) => setAssignForm({ ...assignForm, rotation_period: e.target.value as RotationPeriod })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              >
                <option value="">Seçiniz...</option>
                <option value="quarterly">3 Aylık</option>
                <option value="semi-annual">6 Aylık</option>
                <option value="annual">Yıllık</option>
                <option value="biennial">2 Yıllık</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Açıklama / Notlar
              </label>
              <textarea
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Atama ile ilgili notlarınızı buraya yazabilirsiniz..."
                disabled={saving}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={saving}
              >
                İptal
              </button>
              <button
                onClick={handleAssignPersonnel}
                disabled={saving || !assignForm.primary_id || !assignForm.rotation_period}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showRotationModal && (
        <Modal
          isOpen={showRotationModal}
          onClose={() => setShowRotationModal(false)}
          title="Rotasyon Yap"
        >
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Mevcut Atama</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><span className="font-medium">Asil:</span> {task?.assigned_primary?.full_name || '-'}</p>
                <p><span className="font-medium">Yedek:</span> {task?.assigned_backup?.full_name || '-'}</p>
                <p><span className="font-medium">Rotasyon Periyodu:</span> {task ? ROTATION_PERIOD_LABELS[task.rotation_period] : '-'}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Yeni Asil Personel <span className="text-red-500">*</span>
              </label>
              <select
                value={rotationForm.new_primary_id}
                onChange={(e) => setRotationForm({ ...rotationForm, new_primary_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              >
                <option value="">Seçiniz...</option>
                {users
                  .filter(u => u.id !== task?.assigned_primary_id)
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} - {user.role} {user.department_name ? `(${user.department_name})` : ''}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Mevcut asil personelden farklı bir kişi seçiniz
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Yeni Yedek Personel
              </label>
              <select
                value={rotationForm.new_backup_id}
                onChange={(e) => setRotationForm({ ...rotationForm, new_backup_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              >
                <option value="">Seçiniz...</option>
                {users
                  .filter(u => u.id !== rotationForm.new_primary_id && u.id !== task?.assigned_backup_id)
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} - {user.role} {user.department_name ? `(${user.department_name})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Rotasyon Açıklaması
              </label>
              <textarea
                value={rotationForm.notes}
                onChange={(e) => setRotationForm({ ...rotationForm, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Rotasyon gerekçesi veya notlarınızı buraya yazabilirsiniz..."
                disabled={saving}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Dikkat:</strong> Rotasyon işlemi sonrası yeni rotasyon tarihi otomatik olarak {task ? ROTATION_PERIOD_LABELS[task.rotation_period].toLowerCase() : ''} ileri alınacaktır.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => setShowRotationModal(false)}
                className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={saving}
              >
                İptal
              </button>
              <button
                onClick={handleRotation}
                disabled={saving || !rotationForm.new_primary_id}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                {saving ? 'İşleniyor...' : 'Rotasyonu Gerçekleştir'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPostponeModal && (
        <Modal
          isOpen={showPostponeModal}
          onClose={() => setShowPostponeModal(false)}
          title="Rotasyon Ertele"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-2">Mevcut Rotasyon Tarihi</h4>
              <p className="text-2xl font-bold text-slate-700">{formatDate(task?.next_rotation_date)}</p>
              {getDaysUntilRotation() !== null && (
                <p className="text-sm text-slate-600 mt-1">
                  ({getDaysUntilRotation()! < 0 ? `${Math.abs(getDaysUntilRotation()!)} gün geçti` : `${getDaysUntilRotation()} gün kaldı`})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Erteleme Süresi (Gün)
              </label>
              <div className="flex gap-2">
                {[15, 30, 60, 90].map(days => (
                  <button
                    key={days}
                    onClick={() => setPostponeForm({ ...postponeForm, days })}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      postponeForm.days === days
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                    }`}
                    disabled={saving}
                  >
                    {days} gün
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <input
                  type="number"
                  value={postponeForm.days}
                  onChange={(e) => setPostponeForm({ ...postponeForm, days: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="365"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="veya özel gün sayısı giriniz"
                  disabled={saving}
                />
              </div>
            </div>

            {postponeForm.days > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-1">Yeni Rotasyon Tarihi</h4>
                <p className="text-lg font-bold text-blue-700">
                  {(() => {
                    const currentDate = new Date(task?.next_rotation_date || new Date());
                    const newDate = new Date(currentDate);
                    newDate.setDate(newDate.getDate() + postponeForm.days);
                    return formatDate(newDate.toISOString());
                  })()}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Erteleme Gerekçesi <span className="text-red-500">*</span>
              </label>
              <textarea
                value={postponeForm.reason}
                onChange={(e) => setPostponeForm({ ...postponeForm, reason: e.target.value })}
                rows={4}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Rotasyon erteleme gerekçesini detaylı olarak açıklayınız..."
                disabled={saving}
              />
              <p className="mt-1 text-xs text-slate-500">
                Erteleme gerekçesi rotasyon geçmişine kaydedilecektir
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Uyarı:</strong> Rotasyon erteleme işlemi denetim raporlarına yansıyacaktır. Sık erteleme işlemleri uyarı oluşturabilir.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => setShowPostponeModal(false)}
                className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={saving}
              >
                İptal
              </button>
              <button
                onClick={handlePostpone}
                disabled={saving || !postponeForm.reason.trim() || postponeForm.days <= 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PauseCircle className="w-4 h-4" />
                {saving ? 'İşleniyor...' : 'Rotasyonu Ertele'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
