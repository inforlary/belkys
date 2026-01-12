import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

interface ActionPlanReportProps {
  planId: string;
  onClose: () => void;
}

interface ActionStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
}

interface ComponentProgress {
  name: string;
  total: number;
  completed: number;
  overdue: number;
  progress: number;
}

interface OverdueAction {
  code: string;
  title: string;
  responsible: string;
  daysOverdue: number;
}

export default function ActionPlanReport({ planId, onClose }: ActionPlanReportProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ActionStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0
  });
  const [componentProgress, setComponentProgress] = useState<ComponentProgress[]>([]);
  const [overdueActions, setOverdueActions] = useState<OverdueAction[]>([]);

  useEffect(() => {
    loadReportData();
  }, [planId]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const { data: actionsData, error } = await supabase
        .from('ic_actions')
        .select(`
          id,
          code,
          title,
          status,
          target_date,
          responsible_departments,
          departments!inner(id, name)
        `)
        .eq('action_plan_id', planId);

      if (error) throw error;

      const today = new Date();
      let completed = 0;
      let inProgress = 0;
      let notStarted = 0;
      let overdue = 0;
      const overdueList: OverdueAction[] = [];

      actionsData?.forEach(action => {
        if (action.status === 'COMPLETED') {
          completed++;
        } else if (action.status === 'IN_PROGRESS') {
          inProgress++;
        } else if (action.status === 'PLANNED') {
          notStarted++;
        }

        if (action.target_date && action.status !== 'COMPLETED') {
          const targetDate = new Date(action.target_date);
          if (targetDate < today) {
            overdue++;
            const daysOverdue = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
            overdueList.push({
              code: action.code,
              title: action.title,
              responsible: action.departments?.name || '-',
              daysOverdue
            });
          }
        }
      });

      setStats({
        total: actionsData?.length || 0,
        completed,
        inProgress,
        notStarted,
        overdue
      });

      setOverdueActions(overdueList);

    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['EYLEM PLANI İLERLEME RAPORU'],
      [''],
      ['Toplam Eylem', stats.total],
      ['Tamamlanan', `${stats.completed} (${stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(0) : 0}%)`],
      ['Devam Eden', `${stats.inProgress} (${stats.total > 0 ? ((stats.inProgress / stats.total) * 100).toFixed(0) : 0}%)`],
      ['Başlamadı', `${stats.notStarted} (${stats.total > 0 ? ((stats.notStarted / stats.total) * 100).toFixed(0) : 0}%)`],
      ['Geciken', `${stats.overdue} (${stats.total > 0 ? ((stats.overdue / stats.total) * 100).toFixed(0) : 0}%)`]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    if (overdueActions.length > 0) {
      const overdueData = overdueActions.map(action => ({
        'Kod': action.code,
        'Eylem': action.title,
        'Sorumlu': action.responsible,
        'Gecikme (Gün)': action.daysOverdue
      }));

      const ws2 = XLSX.utils.json_to_sheet(overdueData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Geciken Eylemler');
    }

    XLSX.writeFile(wb, `Eylem_Plani_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const progressPercentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Eylem Planı İlerleme Raporu</h2>
          <p className="text-sm text-gray-600">Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Excel İndir
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">1. GENEL İLERLEME</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">TOPLAM</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">TAMAMLANAN</div>
            <div className="text-xs text-gray-500">{stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-600">DEVAM EDEN</div>
            <div className="text-xs text-gray-500">{stats.total > 0 ? ((stats.inProgress / stats.total) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.notStarted}</div>
            <div className="text-sm text-gray-600">BAŞLAMADI</div>
            <div className="text-xs text-gray-500">{stats.total > 0 ? ((stats.notStarted / stats.total) * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-gray-600">GECİKEN</div>
            <div className="text-xs text-gray-500">{stats.total > 0 ? ((stats.overdue / stats.total) * 100).toFixed(0) : 0}%</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Genel İlerleme</span>
            <span className="text-sm font-bold text-gray-900">{progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-green-600 h-4 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {overdueActions.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-900 mb-3">2. GECİKEN EYLEMLER</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eylem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sorumlu</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gecikme</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {overdueActions.map((action, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{action.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{action.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{action.responsible}</td>
                    <td className="px-4 py-3 text-center text-sm text-red-600 font-medium">{action.daysOverdue} gün</td>
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
