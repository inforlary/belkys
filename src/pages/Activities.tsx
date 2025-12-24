import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit2, Trash2, Search, Sparkles, Download, ChevronDown, ChevronRight, Target } from 'lucide-react';
import { generateActivityCode } from '../utils/codeGenerator';
import { generateActivitiesReport } from '../utils/exportHelpers';

interface Activity {
  id: string;
  goal_id: string;
  code: string;
  title: string;
  description: string;
  responsible_department: string;
  department_id: string | null;
  assigned_user_id: string | null;
  status: string;
  goal?: {
    title: string;
    code: string;
    department_id: string;
    objective_id?: string;
    objective?: {
      code: string;
      title: string;
    };
  };
  departments?: {
    name: string;
  };
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface Goal {
  id: string;
  code: string;
  title: string;
  department_id: string;
  objective_id: string;
  objective?: {
    code: string;
    title: string;
  };
}

interface GoalGroup {
  goal_id: string;
  goal_code: string;
  goal_title: string;
  objective_code: string;
  objective_title: string;
  department_id: string | null;
  activities: Activity[];
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  department_id: string | null;
}

export default function Activities() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    goal_id: '',
    code: '',
    title: '',
    description: '',
    responsible_department: '',
    department_id: '',
    assigned_user_id: '',
    status: 'planned',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      let activitiesQuery = supabase
        .from('activities')
        .select(`
          *,
          goals!inner(title, code, department_id),
          departments(name),
          profiles(full_name, email)
        `)
        .eq('organization_id', profile.organization_id);

      if (profile.department_id && profile.role !== 'admin') {
        activitiesQuery = activitiesQuery.eq('goals.department_id', profile.department_id);
      }

      let goalsQuery = supabase
        .from('goals')
        .select('id, code, title, department_id')
        .eq('organization_id', profile.organization_id);

      if (profile.department_id && !['admin', 'super_admin'].includes(profile.role || '')) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const [activitiesRes, goalsRes, deptsRes, usersRes] = await Promise.all([
        activitiesQuery.order('code', { ascending: true }),
        goalsQuery.order('order_number', { ascending: true }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, email, department_id')
          .eq('organization_id', profile.organization_id)
          .order('full_name', { ascending: true })
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (deptsRes.error) throw deptsRes.error;
      if (usersRes.error) throw usersRes.error;

      setActivities(activitiesRes.data?.map(act => ({
        ...act,
        goal: act.goals
      })) || []);
      setGoals(goalsRes.data || []);
      setDepartments(deptsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    setSubmitting(true);

    try {
      if (!formData.title || !formData.code || !formData.department_id) {
        alert('Lütfen tüm zorunlu alanları doldurun');
        return;
      }

      const activityData = {
        goal_id: formData.goal_id || null,
        code: formData.code,
        name: formData.title,
        title: formData.title,
        description: formData.description || '',
        responsible_department: formData.responsible_department || '',
        department_id: formData.department_id,
        assigned_user_id: formData.assigned_user_id || null,
        status: formData.status,
        budget: 0,
        progress_percentage: 0,
        start_date: null,
        end_date: null,
      };

      if (editingActivity) {
        const { error } = await supabase
          .from('activities')
          .update(activityData)
          .eq('id', editingActivity.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('activities')
          .insert({
            ...activityData,
            organization_id: profile.organization_id,
          });

        if (error) throw error;
      }

      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Faaliyet kaydedilirken hata:', error);
      alert('Faaliyet kaydedilirken bir hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const activity = activities.find(a => a.id === id);
    if (!activity) return;

    const canDelete = profile?.role === 'admin' || profile?.role === 'super_admin' ||
                      (profile?.role === 'manager' && profile?.department_id === activity.department_id) ||
                      (profile?.role === 'user' && profile?.department_id === activity.department_id);

    if (!canDelete) {
      alert('Bu faaliyeti silme yetkiniz yok');
      return;
    }

    if (!confirm('Bu faaliyeti silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Faaliyet silinirken hata:', error);
      alert('Faaliyet silinirken bir hata oluştu');
    }
  };

  const handleEdit = (activity: Activity) => {
    const canEdit = profile?.role === 'admin' || profile?.role === 'super_admin' ||
                    (profile?.role === 'manager' && profile?.department_id === activity.department_id) ||
                    (profile?.role === 'user' && profile?.department_id === activity.department_id);

    if (!canEdit) {
      alert('Bu faaliyeti düzenleme yetkiniz yok');
      return;
    }

    setEditingActivity(activity);
    setFormData({
      goal_id: activity.goal_id,
      code: activity.code,
      title: activity.title,
      description: activity.description,
      responsible_department: activity.responsible_department || '',
      department_id: activity.department_id || '',
      assigned_user_id: activity.assigned_user_id || '',
      status: activity.status,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingActivity(null);
    setFormData({
      goal_id: '',
      code: '',
      title: '',
      description: '',
      responsible_department: '',
      department_id: '',
      assigned_user_id: '',
      status: 'planned',
    });
  };

  const handleGenerateCode = async () => {
    if (!formData.goal_id) {
      alert('Lütfen önce bir hedef seçin');
      return;
    }

    try {
      const code = await generateActivityCode(supabase, {
        organizationId: profile?.organization_id || '',
        goalId: formData.goal_id,
      });
      setFormData({ ...formData, code });
    } catch (error) {
      console.error('Kod üretilirken hata:', error);
      alert('Kod üretilirken bir hata oluştu');
    }
  };

  const groupActivitiesByGoal = (): GoalGroup[] => {
    const grouped = new Map<string, GoalGroup>();

    activities.forEach(activity => {
      if (!activity.goal) return;

      const goalId = activity.goal_id;
      if (!grouped.has(goalId)) {
        const goal = goals.find(g => g.id === goalId);
        grouped.set(goalId, {
          goal_id: goalId,
          goal_code: activity.goal.code,
          goal_title: activity.goal.title,
          objective_code: goal?.objective?.code || activity.goal.objective?.code || '',
          objective_title: goal?.objective?.title || activity.goal.objective?.title || '',
          department_id: activity.goal.department_id || goal?.department_id || null,
          activities: []
        });
      }
      grouped.get(goalId)!.activities.push(activity);
    });

    const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
      const objCompare = a.objective_code.localeCompare(b.objective_code);
      if (objCompare !== 0) return objCompare;
      return a.goal_code.localeCompare(b.goal_code);
    });

    sortedGroups.forEach(group => {
      group.activities.sort((a, b) => a.code.localeCompare(b.code));
    });

    return sortedGroups;
  };

  const filteredGroups = groupActivitiesByGoal().filter(group => {
    if (selectedDepartment && group.department_id !== selectedDepartment) {
      return false;
    }

    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      group.objective_title.toLowerCase().includes(search) ||
      group.objective_code.toLowerCase().includes(search) ||
      group.goal_title.toLowerCase().includes(search) ||
      group.goal_code.toLowerCase().includes(search) ||
      group.activities.some(act =>
        act.title.toLowerCase().includes(search) ||
        act.code.toLowerCase().includes(search) ||
        act.responsible_department.toLowerCase().includes(search) ||
        (act.departments?.name || '').toLowerCase().includes(search) ||
        (act.profiles?.full_name || '').toLowerCase().includes(search)
      )
    );
  });

  const toggleGoal = (goalId: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { label: string; color: string }> = {
      planned: { label: 'Planlandı', color: 'bg-slate-100 text-slate-700' },
      ongoing: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-700' },
      completed: { label: 'Tamamlandı', color: 'bg-green-100 text-green-700' },
      delayed: { label: 'Gecikmiş', color: 'bg-orange-100 text-orange-700' },
      cancelled: { label: 'İptal Edildi', color: 'bg-red-100 text-red-700' },
    };

    const statusInfo = statuses[status] || statuses.planned;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const canManageActivity = (activity: Activity) => {
    if (profile?.role === 'admin' || profile?.role === 'super_admin') return true;
    if (profile?.role === 'manager' && profile?.department_id === activity.department_id) return true;
    if (profile?.role === 'user' && profile?.department_id === activity.department_id) return true;
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Faaliyetler / Projeler</h1>
          <p className="text-slate-600 mt-1">Hedeflere bağlı faaliyet ve projeleri yönetin</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => generateActivitiesReport(activities)}
            variant="outline"
            disabled={activities.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={() => setIsModalOpen(true)} disabled={goals.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Faaliyet
          </Button>
        </div>
      </div>

      {goals.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-center text-slate-500">
              Faaliyet eklemek için önce bir hedef oluşturmalısınız.
            </p>
          </CardBody>
        </Card>
      )}

      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Faaliyet ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-64">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tüm Birimler</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardBody>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">
                  {searchTerm ? 'Arama kriterlerine uygun faaliyet bulunamadı' : 'Henüz faaliyet bulunmuyor'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGoals.has(group.goal_id);

                  return (
                    <div key={group.goal_id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleGoal(group.goal_id)}
                        className="w-full px-6 py-4 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-blue-600" />
                          )}
                          <Target className="w-5 h-5 text-blue-600" />
                          <div className="text-left">
                            <div className="text-xs text-blue-600 font-medium mb-1">
                              {group.objective_code} - {group.objective_title}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {group.goal_code} - {group.goal_title}
                            </h3>
                            <p className="text-sm text-slate-600">{group.activities.length} Faaliyet</p>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-6 space-y-4 bg-white">
                          {group.activities.map((activity) => (
                            <div key={activity.id} className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      {activity.code}
                                    </span>
                                    <h4 className="font-semibold text-slate-900 text-lg">
                                      {activity.title}
                                    </h4>
                                    {getStatusBadge(activity.status)}
                                  </div>
                                  {activity.description && (
                                    <p className="text-sm text-slate-600 mt-2">{activity.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  {canManageActivity(activity) && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEdit(activity)}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(activity.id)}
                                      >
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                  <div className="text-xs text-slate-500 mb-1">Sorumlu Müdürlük</div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {activity.departments?.name || activity.responsible_department || '-'}
                                  </div>
                                </div>

                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                  <div className="text-xs text-slate-500 mb-1">Atanan Kullanıcı</div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {activity.profiles?.full_name ? (
                                      <div>
                                        <div>{activity.profiles.full_name}</div>
                                        <div className="text-xs text-slate-500">{activity.profiles.email}</div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">Atanmadı</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingActivity ? 'Faaliyeti Düzenle' : 'Yeni Faaliyet / Proje'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hedef *
            </label>
            <select
              value={formData.goal_id}
              onChange={(e) => {
                const selectedGoal = goals.find(g => g.id === e.target.value);
                if (selectedGoal && selectedGoal.department_id) {
                  const dept = departments.find(d => d.id === selectedGoal.department_id);
                  setFormData({
                    ...formData,
                    goal_id: e.target.value,
                    department_id: selectedGoal.department_id,
                    responsible_department: dept?.name || ''
                  });
                } else {
                  setFormData({
                    ...formData,
                    goal_id: e.target.value,
                    department_id: '',
                    responsible_department: ''
                  });
                }
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz...</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.code} - {goal.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Faaliyet Kodu *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="örn: F1.1.1"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateCode}
                title="Otomatik kod üret"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sorumlu Müdürlük *
              </label>
              <input
                type="text"
                value={formData.responsible_department || 'Önce hedef seçiniz'}
                readOnly
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">
                Seçilen hedefin müdürlüğü otomatik atanır
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Atanan Kullanıcı
              </label>
              <select
                value={formData.assigned_user_id}
                onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz...</option>
                {users
                  .filter(user => !formData.department_id || user.department_id === formData.department_id)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {formData.department_id ? 'Seçili müdürlükteki kullanıcılar gösteriliyor' : 'Önce müdürlük seçiniz'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Faaliyet Başlığı *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Faaliyet başlığını girin"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Faaliyet hakkında detaylı açıklama..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Durum
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="planned">Planlandı</option>
              <option value="ongoing">Devam Ediyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="delayed">Gecikmiş</option>
              <option value="cancelled">İptal Edildi</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              İptal
            </Button>
            <Button type="submit" loading={submitting}>
              {editingActivity ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
