import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Plus, Search, Edit, Trash2, TrendingUp } from 'lucide-react';

interface Process {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  owner_department: { name: string } | null;
  owner_user: { full_name: string } | null;
  parent_process: { name: string } | null;
}

export default function QualityProcesses() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProcess, setEditingProcess] = useState<any>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      loadProcesses();
    }
  }, [profile?.organization_id]);

  const loadProcesses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quality_processes')
        .select(`
          *,
          owner_department:departments(name),
          owner_user:profiles(full_name),
          parent_process:quality_processes!parent_process_id(name)
        `)
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setProcesses(data || []);
    } catch (error) {
      console.error('Error loading processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu süreci silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('quality_processes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadProcesses();
    } catch (error) {
      console.error('Error deleting process:', error);
      alert('Süreç silinirken hata oluştu');
    }
  };

  const filteredProcesses = processes.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(processes.map(p => p.category).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Süreç Yönetimi</h1>
          <p className="mt-2 text-gray-600">Kalite süreçleri tanımlama ve yönetimi</p>
        </div>
        <button
          onClick={() => {
            setEditingProcess(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Yeni Süreç
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Süreç ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kod
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Süreç Adı
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategori
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Süreç Sahibi
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProcesses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Süreç bulunamadı
                </td>
              </tr>
            ) : (
              filteredProcesses.map((process) => (
                <tr
                  key={process.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/quality-management/processes/${process.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {process.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {process.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {process.category || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {process.owner_department?.name || process.owner_user?.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      process.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : process.status === 'inactive'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {process.status === 'active' ? 'Aktif' : process.status === 'inactive' ? 'Pasif' : 'İnceleme'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/quality-management/processes/${process.id}`);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                        title="Detay"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      {profile?.role === 'admin' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProcess(process);
                              setShowModal(true);
                            }}
                            className="text-gray-600 hover:text-gray-700"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(process.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
