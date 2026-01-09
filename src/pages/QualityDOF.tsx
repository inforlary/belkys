import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Plus, Search } from 'lucide-react';

export default function QualityDOF() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [dofs, setDofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (profile?.organization_id) {
      loadDOFs();
    }
  }, [profile?.organization_id]);

  const loadDOFs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quality_dof')
        .select(`
          *,
          department:departments(name),
          responsible:profiles(full_name)
        `)
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDofs(data || []);
    } catch (error) {
      console.error('Error loading DOFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDOFs = dofs.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.dof_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || d.dof_type === filterType;
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DÖF Yönetimi</h1>
          <p className="mt-2 text-gray-600">Düzeltici ve Önleyici Faaliyet kayıtları</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Yeni DÖF
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="DÖF ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Tüm Türler</option>
            <option value="corrective">Düzeltici</option>
            <option value="preventive">Önleyici</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="open">Açık</option>
            <option value="in_progress">Devam Ediyor</option>
            <option value="closed">Kapatıldı</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DÖF No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Başlık</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tür</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kaynak</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Termin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDOFs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  DÖF kaydı bulunamadı
                </td>
              </tr>
            ) : (
              filteredDOFs.map((dof) => (
                <tr
                  key={dof.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/quality-management/dof/${dof.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{dof.dof_number}</td>
                  <td className="px-6 py-4 text-sm">{dof.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {dof.dof_type === 'corrective' ? 'Düzeltici' : 'Önleyici'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{dof.source || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{dof.responsible?.full_name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{dof.due_date || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      dof.status === 'open' ? 'bg-red-100 text-red-800' :
                      dof.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {dof.status === 'open' ? 'Açık' : dof.status === 'in_progress' ? 'Devam Ediyor' : 'Kapatıldı'}
                    </span>
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
