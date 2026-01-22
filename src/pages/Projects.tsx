import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Plus, Eye, Edit, Trash2, Search } from 'lucide-react';

interface Project {
  id: string;
  project_no: string;
  project_name: string;
  source: string;
  responsible_unit: string;
  physical_progress: number;
  last_update_date: string;
  status: string;
  year: number;
  period: number;
  strategic_plan_id?: string;
}

const SOURCE_COLORS = {
  ilyas: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  beyanname: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  genel: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
};

const SOURCE_LABELS = {
  ilyas: 'İLYAS',
  beyanname: 'Beyanname',
  genel: 'Genel'
};

const STATUS_CONFIG = {
  completed: { label: 'Tamamlandı', bg: 'bg-green-100', text: 'text-green-800' },
  in_progress: { label: 'Devam Ediyor', bg: 'bg-orange-100', text: 'text-orange-800' },
  planned: { label: 'Planlandı', bg: 'bg-gray-100', text: 'text-gray-800' },
  delayed: { label: 'Gecikmiş', bg: 'bg-red-100', text: 'text-red-800' }
};

export default function Projects() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [filters, setFilters] = useState({
    source: '',
    year: '',
    period: '',
    status: '',
    sp_connection: '',
    search: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadProjects();
    }
  }, [profile?.organization_id]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('last_update_date', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Projeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInDays = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return { text: 'Bugün', days: 0 };
    if (diffInDays === 1) return { text: 'Dün', days: 1 };
    if (diffInDays < 7) return { text: `${diffInDays} gün önce`, days: diffInDays };
    if (diffInDays < 30) return { text: `${Math.floor(diffInDays / 7)} hafta önce`, days: diffInDays };
    return { text: `${Math.floor(diffInDays / 30)} ay önce`, days: diffInDays };
  };

  const getTimeColor = (days: number) => {
    if (days >= 20) return 'text-red-600 font-semibold';
    if (days >= 10) return 'text-orange-600 font-semibold';
    return 'text-green-600';
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 71) return 'bg-blue-500';
    if (progress >= 31) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const filteredProjects = projects.filter(p => {
    if (filters.source && p.source !== filters.source) return false;
    if (filters.year && p.year?.toString() !== filters.year) return false;
    if (filters.period && p.period?.toString() !== filters.period) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.sp_connection === 'connected' && !p.strategic_plan_id) return false;
    if (filters.sp_connection === 'not_connected' && p.strategic_plan_id) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        p.project_no?.toLowerCase().includes(search) ||
        p.project_name?.toLowerCase().includes(search) ||
        p.responsible_unit?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

  const handleDelete = async (id: string, projectNo: string) => {
    if (!confirm(`${projectNo} numaralı projeyi silmek istediğinize emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadProjects();
    } catch (error) {
      console.error('Proje silinirken hata:', error);
      alert('Proje silinemedi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const years = Array.from(new Set(projects.map(p => p.year))).filter(Boolean).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projeler</h1>
          <p className="mt-1 text-gray-600">Tüm projeleri görüntüle</p>
        </div>
        <button
          onClick={() => navigate('project-management/projects/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Yeni Proje
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Kaynak (Tümü)</option>
              <option value="ilyas">İLYAS</option>
              <option value="beyanname">Beyanname</option>
              <option value="genel">Genel</option>
            </select>
          </div>

          <div>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Yıl (Tümü)</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Dönem (Tümü)</option>
              <option value="1">I. Dönem</option>
              <option value="2">II. Dönem</option>
              <option value="3">III. Dönem</option>
              <option value="4">IV. Dönem</option>
            </select>
          </div>

          <div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Durum (Tümü)</option>
              <option value="in_progress">Devam Ediyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="planned">Planlandı</option>
              <option value="delayed">Gecikmiş</option>
            </select>
          </div>

          <div>
            <select
              value={filters.sp_connection}
              onChange={(e) => setFilters({ ...filters, sp_connection: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">SP Bağlantısı (Tümü)</option>
              <option value="connected">Bağlı</option>
              <option value="not_connected">Bağlı Değil</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Proje ara..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proje No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proje Adı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kaynak
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sorumlu Birim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fiziki %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Son Güncelleme
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Proje bulunamadı
                  </td>
                </tr>
              ) : (
                currentProjects.map((project) => {
                  const sourceColors = SOURCE_COLORS[project.source as keyof typeof SOURCE_COLORS] || SOURCE_COLORS.genel;
                  const statusConfig = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planned;
                  const timeAgo = getTimeAgo(project.last_update_date);
                  const timeColor = getTimeColor(timeAgo.days);
                  const progressColor = getProgressColor(project.physical_progress);

                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`project-management/projects/${project.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-900">{project.project_no}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={project.project_name}>
                          {project.project_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sourceColors.bg} ${sourceColors.text} ${sourceColors.border}`}
                        >
                          {SOURCE_LABELS[project.source as keyof typeof SOURCE_LABELS] || project.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{project.responsible_unit}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-2.5 min-w-[100px]">
                            <div
                              className={`h-2.5 rounded-full transition-all ${progressColor}`}
                              style={{ width: `${project.physical_progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 min-w-[42px]">
                            {project.physical_progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${timeColor}`}>
                          {timeAgo.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`project-management/projects/${project.id}`)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Detay"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`project-management/projects/${project.id}/edit`)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(project.id, project.project_no)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {filteredProjects.length > 0 && (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg shadow">
          <div className="text-sm text-gray-700">
            <span className="font-medium">{startIndex + 1}-{Math.min(endIndex, filteredProjects.length)}</span>
            {' / '}
            <span className="font-medium">{filteredProjects.length}</span>
            {' proje gösteriliyor'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Önceki
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
