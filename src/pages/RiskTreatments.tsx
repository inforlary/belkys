import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckSquare } from 'lucide-react';

export default function RiskTreatments() {
  const { profile } = useAuth();
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadTreatments();
    }
  }, [profile?.organization_id]);

  const loadTreatments = async () => {
    try {
      const { data, error } = await supabase
        .from('risk_treatments')
        .select(`
          *,
          risk:risks(code, name),
          responsible_department:departments(name),
          responsible_person:profiles(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTreatments(data || []);
    } catch (error) {
      console.error('Faaliyetler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PLANNED: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
      DELAYED: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PLANNED: 'Planlandı',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      DELAYED: 'Gecikti',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-green-600" />
          Risk Faaliyetleri
        </h1>
        <p className="text-slate-600 mt-2">Risk azaltma ve tedavi faaliyetlerini yönetin</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Faaliyet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sorumlu</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">İlerleme</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Durum</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Hedef Tarih</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {treatments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  Henüz faaliyet bulunmuyor
                </td>
              </tr>
            ) : (
              treatments.map((treatment) => (
                <tr key={treatment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {treatment.code || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">{treatment.title}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {treatment.risk?.code} - {treatment.risk?.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {treatment.responsible_person?.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${treatment.progress_percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600">{treatment.progress_percent}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(treatment.status)}`}>
                      {getStatusLabel(treatment.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
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
