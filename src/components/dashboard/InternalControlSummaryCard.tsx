import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function InternalControlSummaryCard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalActions, setTotalActions] = useState(0);
  const [completedActions, setCompletedActions] = useState(0);
  const [overdueActions, setOverdueActions] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);

  useEffect(() => {
    if (profile?.organization_id) {
      loadICSummary();
    }
  }, [profile?.organization_id]);

  const loadICSummary = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const { data: actions, count } = await supabase
        .from('ic_actions')
        .select('id, status, due_date, completion_date', { count: 'exact' })
        .eq('organization_id', profile.organization_id);

      setTotalActions(count || 0);

      const completed = actions?.filter(a => a.status === 'Tamamlandı' || a.status === 'completed').length || 0;
      setCompletedActions(completed);

      const today = new Date();
      const overdue = actions?.filter(a => {
        if (a.status === 'Tamamlandı' || a.status === 'completed') return false;
        if (!a.due_date) return false;
        return new Date(a.due_date) < today;
      }).length || 0;
      setOverdueActions(overdue);

      const rate = count ? (completed / count) * 100 : 0;
      setCompletionRate(rate);

    } catch (error) {
      console.error('Error loading IC summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBg = (rate: number) => {
    if (rate >= 80) return 'bg-green-50';
    if (rate >= 60) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">İç Kontrol Özeti</h3>
            <p className="text-sm text-slate-500">Eylem planları ve tamamlanma durumu</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`${getStatusBg(completionRate)} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tamamlanma Oranı</p>
              <p className={`text-2xl font-bold ${getStatusColor(completionRate)}`}>
                %{completionRate.toFixed(1)}
              </p>
            </div>
            <CheckCircle className={`w-8 h-8 ${getStatusColor(completionRate)}`} />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tamamlanan Eylemler</p>
              <p className="text-2xl font-bold text-blue-600">
                {completedActions}/{totalActions}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className={`${overdueActions > 0 ? 'bg-red-50' : 'bg-green-50'} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Geciken Eylemler</p>
              <p className={`text-2xl font-bold ${overdueActions > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {overdueActions}
              </p>
            </div>
            {overdueActions > 0 ? (
              <AlertCircle className="w-8 h-8 text-red-600" />
            ) : (
              <Clock className="w-8 h-8 text-green-600" />
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Toplam Eylem</span>
            <span className="text-sm font-semibold text-slate-900">{totalActions}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Devam Eden</span>
            <span className="text-sm font-semibold text-slate-900">{totalActions - completedActions}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
