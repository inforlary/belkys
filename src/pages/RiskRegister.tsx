import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Plus, Search, X } from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
  category_id: string;
  owner_department_id: string;
  inherent_score: number;
  residual_score: number;
  status: string;
  risk_level: string;
  category?: {
    name: string;
    color: string;
  };
  department?: {
    name: string;
  };
}

const statusOptions = [
  { value: '', label: 'Tümü' },
  { value: 'IDENTIFIED', label: 'Tanımlandı' },
  { value: 'ASSESSED', label: 'Değerlendirildi' },
  { value: 'TREATMENT_PLANNED', label: 'İşlem Plan Yap' },
  { value: 'UNDER_TREATMENT', label: 'İşlem Görüyor' },
  { value: 'MONITORING', label: 'İzleniyor' },
  { value: 'CLOSED', label: 'Kapatıldı' }
];

function getRiskScoreBadge(score: number) {
  if (score >= 1 && score <= 4) {
    return { color: 'bg-green-500 text-white', label: 'Düşük' };
  } else if (score >= 5 && score <= 9) {
    return { color: 'bg-yellow-500 text-white', label: 'Orta' };
  } else if (score >= 10 && score <= 16) {
    return { color: 'bg-orange-500 text-white', label: 'Yüksek' };
  } else if (score >= 17 && score <= 20) {
    return { color: 'bg-red-500 text-white', label: 'Çok Yüksek' };
  } else {
    return { color: 'bg-red-900 text-white', label: 'Kritik' };
  }
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { color: string; label: string }> = {
    IDENTIFIED: { color: 'bg-gray-100 text-gray-800', label: 'Tanımlandı' },
    ASSESSED: { color: 'bg-blue-100 text-blue-800', label: 'Değerlendirildi' },
    TREATMENT_PLANNED: { color: 'bg-purple-100 text-purple-800', label: 'İşlem Planlandı' },
    UNDER_TREATMENT: { color: 'bg-yellow-100 text-yellow-800', label: 'İşlem Görüyor' },
    MONITORING: { color: 'bg-green-100 text-green-800', label: 'İzleniyor' },
    CLOSED: { color: 'bg-gray-300 text-gray-700', label: 'Kapatıldı' }
  };
  return statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status };
}

export default function RiskRegister() {
  const { navigate } = useLocation();
  const { profile } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    category: '',
    department: '',
    status: '',
    search: ''
  });

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [profile?.organization_id]);

  async function loadData() {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [risksRes, categoriesRes, departmentsRes] = await Promise.all([
        supabase
          .from('risks')
          .select(`
            *,
            category:risk_categories(name, color),
            department:departments!owner_department_id(name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('code', { ascending: true }),
        supabase
          .from('risk_categories')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('order_index', { ascending: true }),
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('name', { ascending: true })
      ]);

      if (risksRes.error) throw risksRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;

      setRisks(risksRes.data || []);
      setCategories(categoriesRes.data || []);
      setDepartments(departmentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu riski silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase.from('risks').delete().eq('id', id);

      if (error) throw error;

      setRisks(risks.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting risk:', error);
      alert('Risk silinirken hata oluştu.');
    }
  }

  function handleSort(key: string) {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }

  const filteredRisks = risks.filter(risk => {
    if (filters.category && risk.category_id !== filters.category) return false;
    if (filters.department && risk.owner_department_id !== filters.department) return false;
    if (filters.status && risk.status !== filters.status) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        risk.code.toLowerCase().includes(searchLower) ||
        risk.name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const sortedRisks = [...filteredRisks].sort((a, b) => {
    if (!sortConfig) return 0;

    let aValue = a[sortConfig.key as keyof Risk];
    let bValue = b[sortConfig.key as keyof Risk];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue, 'tr')
        : bValue.localeCompare(aValue, 'tr');
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Kayıt Defteri</h1>
          <p className="text-gray-600 mt-1">Kurum risklerini yönetin ve izleyin</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'director') && (
          <button
            onClick={() => navigate('risks/register/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Yeni Risk Ekle
          </button>
        )}
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birim
              </label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tümü</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arama
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Kod veya ad ara..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                {filters.search && (
                  <button
                    onClick={() => setFilters({ ...filters, search: '' })}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('code')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Risk Kodu
                  {sortConfig?.key === 'code' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Risk Adı
                  {sortConfig?.key === 'name' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sorumlu Birim
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doğal Risk
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Artık Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRisks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <p>Henüz risk kaydı bulunmuyor.</p>
                      {(profile?.role === 'admin' || profile?.role === 'director') && (
                        <button
                          onClick={() => navigate('risks/register/new')}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Yeni risk eklemek için tıklayın
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRisks.map((risk) => {
                  const inherentBadge = getRiskScoreBadge(risk.inherent_score);
                  const residualBadge = getRiskScoreBadge(risk.residual_score);
                  const statusBadge = getStatusBadge(risk.status);

                  return (
                    <tr
                      key={risk.id}
                      onClick={() => navigate(`risks/register/${risk.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {risk.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={risk.name}>
                          {risk.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {risk.category && (
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${risk.category.color}20`,
                              color: risk.category.color
                            }}
                          >
                            {risk.category.name}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {risk.department?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${inherentBadge.color}`}
                        >
                          {risk.inherent_score} - {inherentBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${residualBadge.color}`}
                        >
                          {risk.residual_score} - {residualBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`risks/register/${risk.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Görüntüle
                        </button>
                        {(profile?.role === 'admin' || profile?.role === 'director') && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`risks/register/${risk.id}`);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(risk.id);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Sil
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {sortedRisks.length > 0 && (
        <div className="text-sm text-gray-600">
          Toplam {sortedRisks.length} risk gösteriliyor
        </div>
      )}
    </div>
  );
}
