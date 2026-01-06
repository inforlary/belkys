import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ClipboardCheck } from 'lucide-react';

export default function ICActionPlans() {
  const { profile } = useAuth();
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.organization_id) {
      loadActionPlans();
    }
  }, [profile?.organization_id]);

  const loadActionPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('ic_action_plans')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActionPlans(data || []);
    } catch (error) {
      console.error('Eylem planları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-800',
      ACTIVE: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Taslak',
      ACTIVE: 'Aktif',
      COMPLETED: 'Tamamlandı',
      CANCELLED: 'İptal Edildi',
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
          <ClipboardCheck className="w-8 h-8 text-green-600" />
          İç Kontrol Eylem Planları
        </h1>
        <p className="text-slate-600 mt-2">İç kontrol iyileştirme eylem planlarını yönetin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {actionPlans.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-500">Henüz eylem planı bulunmuyor</p>
          </div>
        ) : (
          actionPlans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex-1">{plan.name}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(plan.status)}`}>
                  {getStatusLabel(plan.status)}
                </span>
              </div>

              {plan.description && (
                <p className="text-sm text-slate-600 mb-4">{plan.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Başlangıç:</span>
                  <span className="font-medium text-slate-900">
                    {new Date(plan.start_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Bitiş:</span>
                  <span className="font-medium text-slate-900">
                    {new Date(plan.end_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
