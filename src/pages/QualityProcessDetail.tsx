import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, FileText, TrendingUp, AlertTriangle } from 'lucide-react';

export default function QualityProcessDetail() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const processId = currentPath.split('/').pop() || '';
  const [process, setProcess] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (processId && profile?.organization_id) {
      loadProcess();
    }
  }, [processId, profile?.organization_id]);

  const loadProcess = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('qm_processes')
        .select(`
          *,
          owner_department:departments(name),
          owner_user:profiles(full_name),
          parent_process:qm_processes!parent_process_id(name)
        `)
        .eq('id', processId)
        .single();

      if (error) throw error;
      setProcess(data);
    } catch (error) {
      console.error('Error loading process:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!process) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Süreç bulunamadı</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/quality-management/processes')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{process.code} - {process.name}</h1>
          <p className="text-gray-600 mt-1">{process.category}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Genel Bilgiler</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Süreç Kodu</label>
              <div className="text-gray-900">{process.code}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Süreç Adı</label>
              <div className="text-gray-900">{process.name}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Kategori</label>
              <div className="text-gray-900">{process.category || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Süreç Sahibi</label>
              <div className="text-gray-900">
                {process.owner_department?.name || process.owner_user?.full_name || '-'}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Açıklama</label>
              <div className="text-gray-900">{process.description || '-'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Girdi / Çıktılar</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Girdiler</label>
              <div className="text-gray-900 mt-1">{process.inputs || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Çıktılar</label>
              <div className="text-gray-900 mt-1">{process.outputs || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">İlişkili Dokümanlar</h3>
          </div>
          <p className="text-sm text-gray-500">Henüz doküman bağlantısı yok</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">İlişkili Riskler</h3>
          </div>
          <p className="text-sm text-gray-500">Henüz risk bağlantısı yok</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Performans Göstergeleri</h3>
          </div>
          <p className="text-sm text-gray-500">Henüz gösterge tanımlanmamış</p>
        </div>
      </div>
    </div>
  );
}
