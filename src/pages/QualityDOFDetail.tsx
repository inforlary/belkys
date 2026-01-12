import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft } from 'lucide-react';

export default function QualityDOFDetail() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const dofId = currentPath.split('/').pop() || '';
  const [dof, setDof] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dofId && profile?.organization_id) {
      loadDOF();
    }
  }, [dofId, profile?.organization_id]);

  const loadDOF = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('qm_nonconformities')
        .select(`
          *,
          department:departments(name),
          responsible:profiles(full_name),
          process:qm_processes(code, name)
        `)
        .eq('id', dofId)
        .single();

      if (error) throw error;
      setDof(data);
    } catch (error) {
      console.error('Error loading DOF:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Yükleniyor...</div></div>;
  }

  if (!dof) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">DÖF bulunamadı</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/quality-management/dof')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{dof.dof_number} - {dof.title}</h1>
          <p className="text-gray-600 mt-1">
            {dof.dof_type === 'corrective' ? 'Düzeltici' : 'Önleyici'} Faaliyet
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Genel Bilgiler</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">DÖF Numarası</label>
              <div className="text-gray-900">{dof.dof_number}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Başlık</label>
              <div className="text-gray-900">{dof.title}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Kaynak</label>
              <div className="text-gray-900">{dof.source || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">İlgili Süreç</label>
              <div className="text-gray-900">
                {dof.process ? `${dof.process.code} - ${dof.process.name}` : '-'}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Birim</label>
              <div className="text-gray-900">{dof.department?.name || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Sorumlu</label>
              <div className="text-gray-900">{dof.responsible?.full_name || '-'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Termin Tarihi</label>
              <div className="text-gray-900">{dof.due_date || '-'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Uygunsuzluk Tanımı</h2>
          <div className="text-gray-900 whitespace-pre-wrap">
            {dof.nonconformity_description || 'Belirtilmemiş'}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Açıklama</h2>
          <div className="text-gray-900 whitespace-pre-wrap">
            {dof.description || 'Belirtilmemiş'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Kök Neden Analizi</h2>
        <div className="mb-2">
          <label className="text-sm font-medium text-gray-700">Yöntem</label>
          <div className="text-gray-900">{dof.root_cause_method || '-'}</div>
        </div>
        <div className="text-gray-900 whitespace-pre-wrap">
          {dof.root_cause_analysis || 'Henüz analiz yapılmamış'}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aksiyon Planı</h2>
        <div className="text-gray-900 whitespace-pre-wrap">
          {dof.action_plan || 'Henüz plan oluşturulmamış'}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Etkinlik Değerlendirme</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Durum</label>
            <div className="text-gray-900">{dof.effectiveness_status || 'Bekliyor'}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Değerlendirme</label>
            <div className="text-gray-900 whitespace-pre-wrap">
              {dof.effectiveness_evaluation || 'Henüz değerlendirilmedi'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
