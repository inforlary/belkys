import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, FileText, CheckCircle2, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';

interface AssuranceReportProps {
  onClose: () => void;
}

interface AssuranceStatement {
  department_id: string;
  department_name: string;
  assurance_level: string | null;
  status: string;
  approved_at: string | null;
  limitations: string | null;
}

export default function AssuranceReport({ onClose }: AssuranceReportProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statements, setStatements] = useState<AssuranceStatement[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({
    totalDepartments: 0,
    submitted: 0,
    pending: 0,
    fullAssurance: 0,
    limitedAssurance: 0,
    noAssurance: 0
  });

  useEffect(() => {
    loadReportData();
  }, [selectedYear]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      const { data: departments, error: deptError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (deptError) throw deptError;

      const { data: statementsData, error: stmtError } = await supabase
        .from('ic_assurance_statements')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('statement_year', selectedYear)
        .eq('statement_type', 'DEPARTMENT');

      if (stmtError) throw stmtError;

      const statementsMap = new Map();
      statementsData?.forEach(stmt => {
        statementsMap.set(stmt.department_id, stmt);
      });

      const statementsList: AssuranceStatement[] = [];
      let submitted = 0;
      let fullAssurance = 0;
      let limitedAssurance = 0;
      let noAssurance = 0;

      departments?.forEach(dept => {
        const statement = statementsMap.get(dept.id);
        if (statement) {
          submitted++;
          if (statement.assurance_level === 'FULL') fullAssurance++;
          else if (statement.assurance_level === 'LIMITED') limitedAssurance++;
          else if (statement.assurance_level === 'NONE') noAssurance++;

          statementsList.push({
            department_id: dept.id,
            department_name: dept.name,
            assurance_level: statement.assurance_level,
            status: statement.status,
            approved_at: statement.approved_at,
            limitations: statement.limitations
          });
        } else {
          statementsList.push({
            department_id: dept.id,
            department_name: dept.name,
            assurance_level: null,
            status: 'PENDING',
            approved_at: null,
            limitations: null
          });
        }
      });

      setStatements(statementsList);
      setStats({
        totalDepartments: departments?.length || 0,
        submitted,
        pending: (departments?.length || 0) - submitted,
        fullAssurance,
        limitedAssurance,
        noAssurance
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const summaryData = [
      ['GÜVENCE BEYANI RAPORU'],
      ['Yıl', selectedYear],
      [''],
      ['Toplam Birim', stats.totalDepartments],
      ['Beyan Veren', `${stats.submitted} (${stats.totalDepartments > 0 ? ((stats.submitted / stats.totalDepartments) * 100).toFixed(0) : 0}%)`],
      ['Bekleyen', stats.pending],
      [''],
      ['Tam Güvence', stats.fullAssurance],
      ['Sınırlı Güvence', stats.limitedAssurance],
      ['Güvence Verilemiyor', stats.noAssurance]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const statementsData = statements.map(stmt => ({
      'Birim': stmt.department_name,
      'Güvence Düzeyi': stmt.assurance_level === 'FULL' ? 'Tam Güvence' :
                        stmt.assurance_level === 'LIMITED' ? 'Sınırlı Güvence' :
                        stmt.assurance_level === 'NONE' ? 'Güvence Verilemiyor' : '-',
      'Durum': stmt.status === 'APPROVED' ? 'Onaylı' : 'Beklemede',
      'Tarih': stmt.approved_at ? new Date(stmt.approved_at).toLocaleDateString('tr-TR') : '-',
      'Kısıtlamalar': stmt.limitations || '-'
    }));

    const ws2 = XLSX.utils.json_to_sheet(statementsData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Birim Beyanları');

    XLSX.writeFile(wb, `Güvence_Beyani_Raporu_${selectedYear}.xlsx`);
  };

  const pieData = [
    { name: 'Tam Güvence', value: stats.fullAssurance, color: '#10b981' },
    { name: 'Sınırlı Güvence', value: stats.limitedAssurance, color: '#f59e0b' },
    { name: 'Güvence Verilemiyor', value: stats.noAssurance, color: '#ef4444' }
  ].filter(item => item.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const progressPercentage = stats.totalDepartments > 0 ? (stats.submitted / stats.totalDepartments) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Güvence Beyanı Raporu</h2>
          <p className="text-sm text-gray-600">Yıl: {selectedYear}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input-field"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Excel İndir
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">GENEL DURUM</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Birim Beyanları</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{stats.submitted}</span>
              <span className="text-sm text-gray-500">/ {stats.totalDepartments}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{stats.totalDepartments > 0 ? ((stats.submitted / stats.totalDepartments) * 100).toFixed(0) : 0}% tamamlandı</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Beyan Veren</div>
            <div className="text-2xl font-bold text-green-600">{stats.submitted}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Bekleyen</div>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">İlerleme</span>
            <span className="text-sm font-bold text-gray-900">{progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-teal-600 h-4 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {pieData.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-900 mb-3">GÜVENCE DÜZEYİ DAĞILIMI</h3>
          <div className="bg-white border rounded-lg p-4">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">BİRİM BEYAN DURUMU</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Birim</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Güvence Düzeyi</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tarih</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {statements.map((stmt) => (
                <tr key={stmt.department_id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{stmt.department_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {stmt.assurance_level === 'FULL' && 'Tam Güvence'}
                    {stmt.assurance_level === 'LIMITED' && 'Sınırlı Güvence'}
                    {stmt.assurance_level === 'NONE' && 'Güvence Verilemiyor'}
                    {!stmt.assurance_level && '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {stmt.status === 'APPROVED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Onaylı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Clock className="w-3 h-3" />
                        Bekleme
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {stmt.approved_at ? new Date(stmt.approved_at).toLocaleDateString('tr-TR') : '-'}
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
