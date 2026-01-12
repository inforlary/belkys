import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DepartmentReportProps {
  planId: string;
  onClose: () => void;
}

interface DepartmentStats {
  id: string;
  name: string;
  total: number;
  completed: number;
  overdue: number;
  progress: number;
}

export default function DepartmentReport({ planId, onClose }: DepartmentReportProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DepartmentStats[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  useEffect(() => {
    loadReportData();
  }, [planId]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (deptError) throw deptError;

      const deptStats: DepartmentStats[] = [];

      for (const dept of deptData || []) {
        const { data: actionsData } = await supabase
          .from('ic_actions')
          .select('id, status, target_date')
          .eq('action_plan_id', planId)
          .contains('responsible_departments', [dept.id]);

        const total = actionsData?.length || 0;
        const completed = actionsData?.filter(a => a.status === 'COMPLETED').length || 0;
        const today = new Date();
        const overdue = actionsData?.filter(a =>
          a.target_date && new Date(a.target_date) < today && a.status !== 'COMPLETED'
        ).length || 0;

        const progress = total > 0 ? (completed / total) * 100 : 0;

        deptStats.push({
          id: dept.id,
          name: dept.name,
          total,
          completed,
          overdue,
          progress
        });
      }

      setDepartments(deptStats.filter(d => d.total > 0));
      if (deptStats.length > 0) {
        setSelectedDeptId(deptStats[0].id);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = departments.map(dept => ({
      'Birim': dept.name,
      'Eylem Sayısı': dept.total,
      'Tamamlanan': dept.completed,
      'Geciken': dept.overdue,
      'İlerleme (%)': dept.progress.toFixed(0)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Birim Bazlı');
    XLSX.writeFile(wb, `Birim_Bazli_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Birim Bazlı İç Kontrol Raporu</h2>
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
        <h3 className="text-md font-semibold text-gray-900 mb-3">BİRİM ÖZET TABLOSU</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birim</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Eylem</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamamlanan</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Geciken</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">İlerleme</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{dept.name}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{dept.total}</td>
                  <td className="px-4 py-3 text-center text-sm text-green-600">{dept.completed}</td>
                  <td className="px-4 py-3 text-center text-sm text-red-600">{dept.overdue}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${dept.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{dept.progress.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
