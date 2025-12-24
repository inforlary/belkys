import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import AdvancedFilter, { FilterField, FilterValue } from '../components/ui/AdvancedFilter';
import { Plus, Edit2, Trash2, Search, Download, Calendar, User, DollarSign } from 'lucide-react';
import { useCachedData, invalidateCache } from '../utils/cache';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';

interface Activity {
  id: string;
  code: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  budget: number;
  progress_percentage: number;
  goal?: { title: string; code: string };
  departments?: { name: string };
  profiles?: { full_name: string };
}

export default function ActivitiesOptimized() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);

  const [filters, setFilters] = useState<FilterValue[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadActivities();
  }, [profile, currentPage, pageSize, searchTerm, filters, statusFilter]);

  const loadActivities = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      const cacheKey = `activities_${profile.organization_id}_${currentPage}_${pageSize}_${searchTerm}_${statusFilter}_${JSON.stringify(filters)}`;

      const data = await useCachedData(
        cacheKey,
        async () => {
          let query = supabase
            .from('activities')
            .select(`
              *,
              goals!inner(title, code),
              departments(name),
              profiles(full_name)
            `, { count: 'exact' })
            .eq('organization_id', profile.organization_id);

          if (profile.department_id && profile.role !== 'admin') {
            query = query.eq('department_id', profile.department_id);
          }

          if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`);
          }

          if (statusFilter) {
            query = query.eq('status', statusFilter);
          }

          filters.forEach(filter => {
            if (filter.operator === 'contains') {
              query = query.ilike(filter.field, `%${filter.value}%`);
            } else if (filter.operator === 'equals') {
              query = query.eq(filter.field, filter.value);
            } else if (filter.operator === 'gt') {
              query = query.gt(filter.field, filter.value);
            } else if (filter.operator === 'lt') {
              query = query.lt(filter.field, filter.value);
            } else if (filter.operator === 'gte') {
              query = query.gte(filter.field, filter.value);
            } else if (filter.operator === 'lte') {
              query = query.lte(filter.field, filter.value);
            }
          });

          const from = (currentPage - 1) * pageSize;
          const to = from + pageSize - 1;

          query = query
            .order('created_at', { ascending: false })
            .range(from, to);

          const { data, error, count } = await query;
          if (error) throw error;

          return { data: data || [], count: count || 0 };
        },
        2
      );

      setActivities(data.data);
      setTotalItems(data.count);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const exportData = activities.map(activity => ({
      'Kod': activity.code,
      'Başlık': activity.title,
      'Hedef': activity.goal?.title || '-',
      'Müdürlük': activity.departments?.name || '-',
      'Sorumlu': activity.profiles?.full_name || '-',
      'Durum': getStatusLabel(activity.status),
      'Başlangıç': new Date(activity.start_date).toLocaleDateString('tr-TR'),
      'Bitiş': new Date(activity.end_date).toLocaleDateString('tr-TR'),
      'Bütçe': activity.budget,
      'İlerleme': `%${activity.progress_percentage}`
    }));
    exportToCSV(exportData, 'faaliyetler');
  };

  const handleExportExcel = () => {
    const exportData = activities.map(activity => ({
      'Kod': activity.code,
      'Başlık': activity.title,
      'Hedef': activity.goal?.title || '-',
      'Müdürlük': activity.departments?.name || '-',
      'Sorumlu': activity.profiles?.full_name || '-',
      'Durum': getStatusLabel(activity.status),
      'Başlangıç': new Date(activity.start_date).toLocaleDateString('tr-TR'),
      'Bitiş': new Date(activity.end_date).toLocaleDateString('tr-TR'),
      'Bütçe': activity.budget,
      'İlerleme': `%${activity.progress_percentage}`
    }));
    exportToExcel(exportData, 'faaliyetler');
  };

  const handleExportPDF = () => {
    const exportData = activities.map(activity => ({
      code: activity.code,
      title: activity.title,
      goal: activity.goal?.title || '-',
      department: activity.departments?.name || '-',
      status: getStatusLabel(activity.status),
      start_date: new Date(activity.start_date).toLocaleDateString('tr-TR'),
      end_date: new Date(activity.end_date).toLocaleDateString('tr-TR'),
      progress: `%${activity.progress_percentage}`
    }));

    exportToPDF(
      exportData,
      'faaliyetler',
      'Faaliyetler Raporu',
      [
        { header: 'Kod', key: 'code', width: 80 },
        { header: 'Başlık', key: 'title', width: 200 },
        { header: 'Hedef', key: 'goal', width: 150 },
        { header: 'Müdürlük', key: 'department', width: 120 },
        { header: 'Durum', key: 'status', width: 80 },
        { header: 'Başlangıç', key: 'start_date', width: 90 },
        { header: 'Bitiş', key: 'end_date', width: 90 },
        { header: 'İlerleme', key: 'progress', width: 70 }
      ]
    );
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      planned: 'Planlandı',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal Edildi'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filterFields: FilterField[] = [
    { key: 'title', label: 'Başlık', type: 'text', placeholder: 'Başlık ara...' },
    { key: 'code', label: 'Kod', type: 'text', placeholder: 'Kod ara...' },
    { key: 'budget', label: 'Bütçe', type: 'number' },
    { key: 'progress_percentage', label: 'İlerleme %', type: 'number' },
    { key: 'start_date', label: 'Başlangıç Tarihi', type: 'date' },
    { key: 'end_date', label: 'Bitiş Tarihi', type: 'date' },
    {
      key: 'status',
      label: 'Durum',
      type: 'select',
      options: [
        { value: 'planned', label: 'Planlandı' },
        { value: 'in_progress', label: 'Devam Ediyor' },
        { value: 'completed', label: 'Tamamlandı' },
        { value: 'cancelled', label: 'İptal Edildi' }
      ]
    }
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleApplyFilters = (newFilters: FilterValue[]) => {
    setFilters(newFilters);
    setCurrentPage(1);
    invalidateCache('activities');
  };

  const handleClearFilters = () => {
    setFilters([]);
    setStatusFilter('');
    setSearchTerm('');
    setCurrentPage(1);
    invalidateCache('activities');
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Faaliyetler</h1>
          <p className="text-gray-600 mt-1">
            Hedeflere bağlı faaliyetleri yönetin - {totalItems} toplam kayıt
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <Download className="w-4 h-4 inline mr-2" />
              CSV
            </button>
          </div>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 inline mr-2" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 inline mr-2" />
            PDF
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Faaliyet ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Durumlar</option>
              <option value="planned">Planlandı</option>
              <option value="in_progress">Devam Ediyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal Edildi</option>
            </select>
            <AdvancedFilter
              fields={filterFields}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              defaultFilters={filters}
            />
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Yükleniyor...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {searchTerm || statusFilter || filters.length > 0
                  ? 'Arama kriterlerinize uygun faaliyet bulunamadı.'
                  : 'Henüz faaliyet eklenmemiş.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Kod</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Başlık</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Hedef</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Müdürlük</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Durum</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Tarih</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">İlerleme</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-gray-900">{activity.code}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{activity.title}</p>
                          {activity.description && (
                            <p className="text-sm text-gray-600 truncate max-w-md">
                              {activity.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {activity.goal?.title || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {activity.departments?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            activity.status
                          )}`}
                        >
                          {getStatusLabel(activity.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(activity.start_date).toLocaleDateString('tr-TR')}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(activity.end_date).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${activity.progress_percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            %{activity.progress_percentage}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
        {!loading && activities.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </Card>
    </div>
  );
}
