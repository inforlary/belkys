import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Plus, Edit, Trash2, Eye, Filter, FolderOpen, Target, Link as LinkIcon } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface Manager {
  id: string;
  full_name: string;
}

interface Goal {
  id: string;
  code: string;
  name: string;
  objective_id: string;
  objective?: {
    id: string;
    code: string;
    name: string;
  };
}

interface Activity {
  id: string;
  code: string;
  name: string;
  goal_id: string;
}

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
  related_goal_id?: string;
  related_activity_id?: string;
  department?: Department;
  manager?: Manager;
  goal?: Goal;
  activity?: Activity;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PLANNED: { label: 'Planlandı', color: 'bg-gray-100 text-gray-800' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-800' },
  ON_HOLD: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-800' },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'İptal Edildi', color: 'bg-red-100 text-red-800' }
};

export default function Projects() {
  const { navigate } = useLocation();
  const { profile } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [filters, setFilters] = useState({
    status: '',
    department_id: '',
    date_from: '',
    date_to: '',
    search: '',
    sp_connection: ''
  });

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    department_id: '',
    manager_id: '',
    budget: '',
    start_date: '',
    end_date: '',
    status: 'PLANNED',
    progress: 0,
    has_sp_connection: false,
    related_goal_id: '',
    related_activity_id: ''
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isDirector = profile?.role === 'director';

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      const [projectsRes, departmentsRes, managersRes, goalsRes, activitiesRes] = await Promise.all([
        supabase
          .from('projects')
          .select(`
            *,
            department:departments!department_id(id, name),
            manager:profiles!manager_id(id, full_name),
            goal:goals!related_goal_id(id, code, name, objective_id, objective:objectives!objective_id(id, code, name)),
            activity:activities!related_activity_id(id, code, name, goal_id)
          `)
          .eq('organization_id', profile?.organization_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name'),

        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile?.organization_id)
          .in('role', ['admin', 'director', 'user'])
          .order('full_name'),

        supabase
          .from('goals')
          .select(`
            id, code, name, objective_id,
            objective:objectives!objective_id(id, code, name)
          `)
          .eq('organization_id', profile?.organization_id)
          .order('code'),

        supabase
          .from('activities')
          .select('id, code, name, goal_id')
          .eq('organization_id', profile?.organization_id)
          .order('code')
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (managersRes.error) throw managersRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      setProjects(projectsRes.data || []);
      setDepartments(departmentsRes.data || []);
      setManagers(managersRes.data || []);
      setGoals(goalsRes.data || []);
      setActivities(activitiesRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  function openModal(project?: Project) {
    if (project) {
      setEditingProject(project);
      setFormData({
        code: project.code,
        name: project.name,
        description: project.description || '',
        department_id: project.department_id,
        manager_id: project.manager_id || '',
        budget: project.budget?.toString() || '',
        start_date: project.start_date,
        end_date: project.end_date,
        status: project.status,
        progress: project.progress,
        has_sp_connection: !!(project.related_goal_id || project.related_activity_id),
        related_goal_id: project.related_goal_id || '',
        related_activity_id: project.related_activity_id || ''
      });
    } else {
      setEditingProject(null);
      setFormData({
        code: '',
        name: '',
        description: '',
        department_id: '',
        manager_id: '',
        budget: '',
        start_date: '',
        end_date: '',
        status: 'PLANNED',
        progress: 0,
        has_sp_connection: false,
        related_goal_id: '',
        related_activity_id: ''
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProject(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.department_id || !formData.start_date || !formData.end_date) {
      alert('Lütfen zorunlu alanları doldurun');
      return;
    }

    if (formData.has_sp_connection && !formData.related_goal_id && !formData.related_activity_id) {
      alert('Stratejik Plan bağlantısı için en az bir hedef veya faaliyet seçmelisiniz');
      return;
    }

    try {
      let code = formData.code;
      if (!editingProject && !code) {
        const year = new Date().getFullYear();
        const { data: existingProjects } = await supabase
          .from('projects')
          .select('code')
          .eq('organization_id', profile?.organization_id)
          .like('code', `PRJ-${year}-%`)
          .order('created_at', { ascending: false })
          .limit(1);

        let nextNumber = 1;
        if (existingProjects && existingProjects.length > 0) {
          const lastCode = existingProjects[0].code;
          const match = lastCode?.match(/PRJ-\d+-(\d+)$/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        code = `PRJ-${year}-${nextNumber.toString().padStart(3, '0')}`;
      }

      const projectData = {
        organization_id: profile?.organization_id,
        code,
        name: formData.name,
        description: formData.description || null,
        department_id: formData.department_id,
        manager_id: formData.manager_id || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        status: formData.status,
        progress: formData.progress,
        related_goal_id: formData.has_sp_connection && formData.related_goal_id ? formData.related_goal_id : null,
        related_activity_id: formData.has_sp_connection && formData.related_activity_id ? formData.related_activity_id : null
      };

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editingProject.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(projectData);

        if (error) throw error;
      }

      closeModal();
      loadData();
    } catch (error) {
      console.error('Proje kaydedilirken hata:', error);
      alert('Proje kaydedilemedi');
    }
  }

  async function handleDelete(project: Project) {
    if (!confirm(`${project.code} - ${project.name} projesini silmek istediğinize emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Proje silinirken hata:', error);
      alert('Proje silinemedi');
    }
  }

  function getRemainingDays(endDate: string): number {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  const filteredActivities = formData.related_goal_id
    ? activities.filter(a => a.goal_id === formData.related_goal_id)
    : activities;

  const filteredProjects = projects.filter(p => {
    if (!p) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.department_id && p.department_id !== filters.department_id) return false;
    if (filters.date_from && p.start_date < filters.date_from) return false;
    if (filters.date_to && p.end_date > filters.date_to) return false;
    if (filters.sp_connection === 'connected' && !p.related_goal_id && !p.related_activity_id) return false;
    if (filters.sp_connection === 'not_connected' && (p.related_goal_id || p.related_activity_id)) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return p.code?.toLowerCase().includes(search) || p.name?.toLowerCase().includes(search);
    }
    return true;
  });

  function clearFilters() {
    setFilters({
      status: '',
      department_id: '',
      date_from: '',
      date_to: '',
      search: '',
      sp_connection: ''
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  const hasActiveFilters = filters.status || filters.department_id || filters.date_from || filters.date_to || filters.search || filters.sp_connection;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Proje Yönetimi</h1>
            <p className="text-sm text-gray-500">Organizasyon projelerini yönetin</p>
          </div>
        </div>
        {(isAdmin || isDirector) && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Yeni Proje
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{filteredProjects.length}</div>
            <div className="text-sm text-gray-600">Toplam Proje</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {filteredProjects.filter(p => p.status === 'COMPLETED').length}
            </div>
            <div className="text-sm text-gray-600">Tamamlanan</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {filteredProjects.filter(p => p.status === 'IN_PROGRESS').length}
            </div>
            <div className="text-sm text-gray-600">Devam Eden</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {filteredProjects.filter(p => p.related_goal_id || p.related_activity_id).length}
            </div>
            <div className="text-sm text-gray-600">SP Bağlantılı</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Filtreler</h3>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Temizle
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Durum</option>
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filters.department_id}
              onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Birim</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filters.sp_connection}
              onChange={(e) => setFilters({ ...filters, sp_connection: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">SP Bağlantısı</option>
              <option value="connected">Bağlantılı</option>
              <option value="not_connected">Bağlantısız</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Başlangıç"
            />
          </div>

          <div>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Bitiş"
            />
          </div>

          <div>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Ara..."
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje Kodu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje Adı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu Birim</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SP Bağlantısı</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlerleme</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Proje bulunamadı
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                  const statusInfo = statusLabels[project.status] || statusLabels['PLANNED'];
                  const remainingDays = getRemainingDays(project.end_date);
                  const isOverdue = remainingDays < 0 && project.status !== 'COMPLETED' && project.status !== 'CANCELLED';
                  const hasSpConnection = !!(project.related_goal_id || project.related_activity_id);

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{project.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {project.department?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {hasSpConnection ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Target className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-medium">
                              {project.goal?.code || project.activity?.code || '-'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">
                          <div>{new Date(project.start_date).toLocaleDateString('tr-TR')}</div>
                          <div className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            {new Date(project.end_date).toLocaleDateString('tr-TR')}
                            {isOverdue && <span className="ml-1">⚠️</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{project.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                            title="Detay"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(isAdmin || (isDirector && project.department_id === profile?.department_id)) && (
                            <>
                              <button
                                onClick={() => openModal(project)}
                                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition"
                                title="Düzenle"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(project)}
                                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingProject ? 'Proje Düzenle' : 'Yeni Proje Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingProject && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proje Kodu</label>
              <input
                type="text"
                value={formData.code || 'Otomatik oluşturulacak'}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                placeholder="Boş bırakılırsa otomatik oluşturulur"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proje Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seçiniz...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proje Yöneticisi</label>
            <select
              value={formData.manager_id}
              onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seçiniz...</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>{manager.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planlanan Bütçe (TL)</label>
            <input
              type="number"
              step="0.01"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durum <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              İlerleme (%): <span className="font-semibold text-blue-600">{formData.progress}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.progress}
              onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="has_sp_connection"
                checked={formData.has_sp_connection}
                onChange={(e) => setFormData({
                  ...formData,
                  has_sp_connection: e.target.checked,
                  related_goal_id: e.target.checked ? formData.related_goal_id : '',
                  related_activity_id: e.target.checked ? formData.related_activity_id : ''
                })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="has_sp_connection" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Bu proje Stratejik Plana bağlı mı?
              </label>
            </div>

            {formData.has_sp_connection && (
              <div className="ml-6 space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bağlı Hedef
                  </label>
                  <select
                    value={formData.related_goal_id}
                    onChange={(e) => setFormData({
                      ...formData,
                      related_goal_id: e.target.value,
                      related_activity_id: ''
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seçiniz...</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.objective?.code} - {goal.objective?.name} &gt; {goal.code} - {goal.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bağlı Faaliyet
                  </label>
                  <select
                    value={formData.related_activity_id}
                    onChange={(e) => setFormData({ ...formData, related_activity_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    disabled={!formData.related_goal_id}
                  >
                    <option value="">Seçiniz...</option>
                    {filteredActivities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.code} - {activity.name}
                      </option>
                    ))}
                  </select>
                  {!formData.related_goal_id && (
                    <p className="text-xs text-gray-500 mt-1">Önce bir hedef seçmelisiniz</p>
                  )}
                </div>

                <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                  En az bir hedef veya faaliyet seçmelisiniz
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Kaydet
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
