import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Search, FileText, Download } from 'lucide-react';

export default function QualityDocuments() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (profile?.organization_id) {
      loadDocuments();
    }
  }, [profile?.organization_id]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quality_documents')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter(d =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Doküman Yönetimi</h1>
          <p className="mt-2 text-gray-600">Prosedür, talimat ve form yönetimi</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Yeni Doküman
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Doküman ara..."
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doküman Adı</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tür</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revizyon</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Doküman bulunamadı
                </td>
              </tr>
            ) : (
              filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{doc.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{doc.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{doc.document_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{doc.revision_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      doc.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                      doc.approval_status === 'draft' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {doc.approval_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-blue-600 hover:text-blue-700" title="İndir">
                      <Download className="w-4 h-4" />
                    </button>
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
