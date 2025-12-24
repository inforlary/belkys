import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, AlertCircle, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { exportToExcel } from '../../utils/exportHelpers';
import { generateDataEntryStatusPDF } from '../../utils/reportPDFGenerators';

interface IndicatorEntryStatus {
  id: string;
  code: string;
  name: string;
  responsible_person: string;
  department_name: string;
  q1_status: string;
  q2_status: string;
  q3_status: string;
  q4_status: string;
  completion_rate: number;
}

export default function DataEntryStatus() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<IndicatorEntryStatus[]>([]);
  const [stats, setStats] = useState({
    total_indicators: 0,
    total_entries: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    missing: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const currentYear = new Date().getFullYear();

      // Get allowed goals first
      let goalsQuery = supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
        goalsQuery = goalsQuery.eq('department_id', profile.department_id);
      }

      const { data: allowedGoals } = await goalsQuery;
      const allowedGoalIds = allowedGoals?.map(g => g.id) || [];

      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          id,
          code,
          name,
          responsible_user_id,
          goal_id,
          goals (
            department_id,
            departments (name)
          ),
          profiles!indicators_responsible_user_id_fkey (
            full_name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('code');

      if (allowedGoalIds.length > 0) {
        indicatorsQuery = indicatorsQuery.in('goal_id', allowedGoalIds);
      } else if (profile.role !== 'admin' && profile.role !== 'manager') {
        indicatorsQuery = indicatorsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { data: indicatorsData } = await indicatorsQuery;

      if (indicatorsData) {
        const indicatorIds = indicatorsData.map(i => i.id);

        const { data: entriesData } = await supabase
          .from('indicator_data_entries')
          .select('indicator_id, period_quarter, status')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .in('indicator_id', indicatorIds);

        const entriesByIndicator: Record<
          string,
          Record<number, string>
        > = {};

        entriesData?.forEach(entry => {
          if (!entriesByIndicator[entry.indicator_id]) {
            entriesByIndicator[entry.indicator_id] = {};
          }
          entriesByIndicator[entry.indicator_id][entry.period_quarter] = entry.status;
        });

        let totalApproved = 0;
        let totalPending = 0;
        let totalRejected = 0;
        let totalMissing = 0;

        const processedIndicators = indicatorsData.map(ind => {
          const q1Status = entriesByIndicator[ind.id]?.[1] || 'missing';
          const q2Status = entriesByIndicator[ind.id]?.[2] || 'missing';
          const q3Status = entriesByIndicator[ind.id]?.[3] || 'missing';
          const q4Status = entriesByIndicator[ind.id]?.[4] || 'missing';

          const statuses = [q1Status, q2Status, q3Status, q4Status];
          const approvedCount = statuses.filter(s => s === 'approved').length;
          const completionRate = (approvedCount / 4) * 100;

          statuses.forEach(status => {
            if (status === 'approved') totalApproved++;
            else if (status === 'submitted' || status === 'pending') totalPending++;
            else if (status === 'rejected') totalRejected++;
            else totalMissing++;
          });

          return {
            id: ind.id,
            code: ind.code,
            name: ind.name,
            responsible_person: (ind.profiles as any)?.full_name || 'Atanmamış',
            department_name: (ind.goals as any)?.departments?.name || '-',
            q1_status: q1Status,
            q2_status: q2Status,
            q3_status: q3Status,
            q4_status: q4Status,
            completion_rate: completionRate,
          };
        });

        setIndicators(processedIndicators);
        setStats({
          total_indicators: processedIndicators.length,
          total_entries: processedIndicators.length * 4,
          approved: totalApproved,
          pending: totalPending,
          rejected: totalRejected,
          missing: totalMissing,
        });
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = indicators.map(ind => ({
      'Kod': ind.code,
      'Gösterge': ind.name,
      'Sorumlu': ind.responsible_person,
      'Birim': ind.department_name,
      'Ç1': getStatusLabel(ind.q1_status),
      'Ç2': getStatusLabel(ind.q2_status),
      'Ç3': getStatusLabel(ind.q3_status),
      'Ç4': getStatusLabel(ind.q4_status),
      'Tamamlanma (%)': Math.round(ind.completion_rate),
    }));

    exportToExcel(exportData, 'Veri_Giris_Durumu');
  };

  const handlePDFExport = () => {
    generateDataEntryStatusPDF(indicators, stats);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      approved: 'Onaylandı',
      submitted: 'Beklemede',
      pending: 'Beklemede',
      rejected: 'Reddedildi',
      missing: 'Girilmedi',
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === 'submitted' || status === 'pending')
      return <Clock className="w-4 h-4 text-yellow-600" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-600" />;
    return <AlertCircle className="w-4 h-4 text-slate-400" />;
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Veri Giriş Durum Raporu</h2>
          <p className="text-sm text-slate-600 mt-1">
            Çeyrek dönem veri girişlerinin takibi ve onay durumları
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePDFExport}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF'e Aktar
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-slate-900">{stats.total_entries}</div>
          <div className="text-sm text-slate-600 mt-1">Toplam Giriş</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-slate-600 mt-1">Onaylandı</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-slate-600 mt-1">Beklemede</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-slate-600 mt-1">Reddedildi</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-slate-600">{stats.missing}</div>
          <div className="text-sm text-slate-600 mt-1">Girilmedi</div>
        </div>
      </div>

      {indicators.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Henüz gösterge bulunmuyor</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                    Kod
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                    Gösterge
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                    Sorumlu
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">
                    Ç1
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">
                    Ç2
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">
                    Ç3
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">
                    Ç4
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">
                    Tamamlanma
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {indicators.map((ind) => (
                  <tr key={ind.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{ind.code}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{ind.name}</div>
                      <div className="text-xs text-slate-500">{ind.department_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{ind.responsible_person}</td>
                    <td className="px-4 py-3 text-center">{getStatusIcon(ind.q1_status)}</td>
                    <td className="px-4 py-3 text-center">{getStatusIcon(ind.q2_status)}</td>
                    <td className="px-4 py-3 text-center">{getStatusIcon(ind.q3_status)}</td>
                    <td className="px-4 py-3 text-center">{getStatusIcon(ind.q4_status)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              ind.completion_rate === 100
                                ? 'bg-green-500'
                                : ind.completion_rate >= 50
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${ind.completion_rate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {Math.round(ind.completion_rate)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
