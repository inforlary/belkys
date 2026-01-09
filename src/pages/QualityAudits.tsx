import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Plus, Search, ClipboardCheck } from 'lucide-react';

export default function QualityAudits() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (profile?.organization_id) {
      loadAudits();
    }
  }, [profile?.organization_id]);

  const loadAudits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quality_audits')
        .select(`
          *,
          lead_auditor:profiles(full_name),
          audited_department:departments(name)
        `)
        .eq('organization_id', profile?.organization_id)
        .order('audit_date', { ascending: false });

      if (error) throw error;
      setAudits(data || []);
    } catch (error) {
      console.error('Error loading audits:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAudits = audits.filter(a =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.audit_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">İç Tetkik Yönetimi</h1>
          <p className="mt-2 text-gray-600">Tetkik planı ve raporları</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Yeni Tetkik
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tetkik ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tetkik Kodu</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Başlık</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tür</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Baş Denetçi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAudits.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Tetkik bulunamadı
                </td>
              </tr>
            ) : (
              filteredAudits.map((audit) => (
                <tr
                  key={audit.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/quality-management/audits/${audit.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{audit.audit_code}</td>
                  <td className="px-6 py-4 text-sm">{audit.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{audit.audit_type || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{audit.audit_date || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{audit.lead_auditor?.full_name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      audit.status === 'planned' ? 'bg-blue-100 text-blue-800' :
                      audit.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      audit.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {audit.status === 'planned' ? 'Planlandı' :
                       audit.status === 'in_progress' ? 'Devam Ediyor' :
                       audit.status === 'completed' ? 'Tamamlandı' : 'İptal'}
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
