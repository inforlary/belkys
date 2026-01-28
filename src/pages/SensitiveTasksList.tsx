import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import {
  Search,
  Filter,
  Eye,
  Edit,
  AlertTriangle,
  UserX
} from 'lucide-react';
import {
  SensitiveTask,
  TaskStatus,
  ROTATION_PERIOD_LABELS,
  STATUS_LABELS,
  STATUS_COLORS
} from '../types/sensitive-tasks';

export default function SensitiveTasksList() {
  const { navigate } = useLocation();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<SensitiveTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<SensitiveTask[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('');

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    applyFilters();
  }, [tasks, searchQuery, selectedDepartment, selectedStatus]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [tasksResult, departmentsResult] = await Promise.all([
        supabase
          .from('sensitive_tasks')
          .select(`
            *,
            department:departments(id, name),
            assigned_primary:profiles!assigned_primary_id(id, full_name, email, role),
            assigned_backup:profiles!assigned_backup_id(id, full_name, email, role),
            workflow:workflow_processes(id, name, code)
          `)
          .eq('organization_id', profile!.organization_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile!.organization_id)
          .order('name')
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (departmentsResult.error) throw departmentsResult.error;

      setTasks((tasksResult.data || []) as unknown as SensitiveTask[]);
      setDepartments(departmentsResult.data || []);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      alert('Veri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        task =>
          task.task_name.toLowerCase().includes(query) ||
          task.process_name.toLowerCase().includes(query)
      );
    }

    if (selectedDepartment) {
      filtered = filtered.filter(task => task.department_id === selectedDepartment);
    }

    if (selectedStatus) {
      filtered = filtered.filter(task => task.status === selectedStatus);
    }

    setFilteredTasks(filtered);
  };

  const getDaysUntilRotation = (nextRotationDate?: string) => {
    if (!nextRotationDate) return null;
    const days = Math.floor(
      (new Date(nextRotationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const formatRotationDate = (date?: string) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hassas Görev Listesi</h1>
          <p className="mt-2 text-slate-600">Tüm hassas görevleri görüntüleyin ve yönetin</p>
        </div>
        <button
          onClick={() => navigate('/sensitive-tasks')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Dashboard'a Dön
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Görev veya süreç adı ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Tüm Birimler</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as TaskStatus | '')}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Tüm Durumlar</option>
              <option value="awaiting_assignment">Atama Bekliyor</option>
              <option value="normal">Normal</option>
              <option value="rotation_due">Rotasyon Yakın</option>
              <option value="rotation_overdue">Rotasyon Geçti</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">{filteredTasks.length}</span> görev bulundu
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Hassas Görev
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Süreç
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Birim
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Asil Personel
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Yedek Personel
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Rotasyon Periyodu
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Sonraki Rotasyon
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-500">
                    {tasks.length === 0 ? (
                      <div className="max-w-2xl mx-auto">
                        <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-lg font-medium text-slate-700 mb-2">Henüz Hassas Görev Yok</p>
                        <p className="text-sm text-slate-600 mb-6">
                          İş akış şemalarında hassas olarak işaretlenen adımlar otomatik olarak buraya aktarılacaktır.
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                          <p className="text-sm font-medium text-blue-900 mb-2">Nasıl Oluşturulur?</p>
                          <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                            <li>İş Akışı Yönetimi modülünden yeni bir iş akış şeması oluşturun</li>
                            <li>Adımları eklerken hassas olanları "Hassas Görev" olarak işaretleyin</li>
                            <li>İş akışını onaya gönderin ve onaylayın</li>
                            <li>Hassas adımlar otomatik olarak bu listeye eklenecektir</li>
                          </ol>
                        </div>
                        <button
                          onClick={() => navigate('/workflows')}
                          className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          İş Akış Şemalarına Git
                        </button>
                      </div>
                    ) : (
                      <div>
                        <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-lg font-medium text-slate-700">Görev bulunamadı</p>
                        <p className="text-sm mt-2">Filtreleri değiştirmeyi deneyin</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const daysUntilRotation = getDaysUntilRotation(task.next_rotation_date);
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/sensitive-tasks/${task.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{task.task_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">{task.process_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          {task.department?.name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {task.assigned_primary ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {task.assigned_primary.full_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {task.assigned_primary.role}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-red-600">
                            <UserX className="w-4 h-4" />
                            Atanmadı
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {task.assigned_backup ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {task.assigned_backup.full_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {task.assigned_backup.role}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-yellow-600">
                            <UserX className="w-4 h-4" />
                            Atanmadı
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          {ROTATION_PERIOD_LABELS[task.rotation_period]}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">
                          {formatRotationDate(task.next_rotation_date)}
                        </div>
                        {daysUntilRotation !== null && (
                          <div
                            className={`text-xs mt-1 ${
                              daysUntilRotation < 0
                                ? 'text-red-600'
                                : daysUntilRotation <= 15
                                ? 'text-yellow-600'
                                : 'text-green-600'
                            }`}
                          >
                            {daysUntilRotation < 0
                              ? `${Math.abs(daysUntilRotation)} gün geçti`
                              : `${daysUntilRotation} gün kaldı`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            STATUS_COLORS[task.status]
                          }`}
                        >
                          {STATUS_LABELS[task.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/sensitive-tasks/${task.id}`);
                            }}
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Detay"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/sensitive-tasks/${task.id}?action=edit`);
                            }}
                            className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
