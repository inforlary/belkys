import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import { FileSpreadsheet, Printer, CheckCircle, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';

interface BeyanReportModalProps {
  onClose: () => void;
}

interface BeyanProject {
  id: string;
  project_no: string;
  project_name: string;
  responsible_unit: string;
  tender_status: string;
  physical_progress: number;
  total_expense: number;
  status: string;
  sp_connected: boolean;
}

const COLORS = ['#10b981', '#f59e0b', '#6b7280'];

export default function BeyanReportModal({ onClose }: BeyanReportModalProps) {
  const { profile } = useAuth();
  const [period, setPeriod] = useState('2024-2029');
  const [type, setType] = useState('Tümü');
  const [district, setDistrict] = useState('KÖRFEZ');
  const [statusFilter, setStatusFilter] = useState('Tümü');
  const [department, setDepartment] = useState('Tümü');
  const [format, setFormat] = useState<'screen' | 'excel' | 'pdf'>('screen');
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<BeyanProject[]>([]);

  const generateReport = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('projects')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('source', 'beyanname');

      if (statusFilter === 'Tamamlandı') {
        query = query.eq('status', 'completed');
      } else if (statusFilter === 'Devam') {
        query = query.eq('status', 'in_progress');
      } else if (statusFilter === 'Planlandı') {
        query = query.eq('status', 'planned');
      }

      const { data, error } = await query.order('project_no');

      if (error) throw error;

      setProjects(data || []);

      if (format === 'screen') {
        setShowReport(true);
      } else if (format === 'excel') {
        exportToExcel(data || []);
      }
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      alert('Rapor oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data: BeyanProject[]) => {
    const excelData = data.map((p, index) => ({
      'SIRA': index + 1,
      'İŞ TANIMI': p.project_name,
      'DAİRE': p.responsible_unit,
      'İHALE DURUMU': p.tender_status || 'Belirtilmemiş',
      'FİZİKİ %': p.physical_progress,
      'HARCAMA': p.total_expense,
      'DURUM': p.status === 'completed' ? 'Tamamlandı' : p.status === 'in_progress' ? 'Devam' : 'Planlandı',
      'SP BAĞLANTI': p.sp_connected ? '✓' : '−'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    ws['!cols'] = [
      { wch: 6 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Beyanname Raporu');
    XLSX.writeFile(wb, `Beyanname_Raporu_${period}.xlsx`);
  };

  const getStats = () => {
    const completed = projects.filter(p => p.status === 'completed').length;
    const inProgress = projects.filter(p => p.status === 'in_progress').length;
    const planned = projects.filter(p => p.status === 'planned').length;
    const total = projects.length;
    const realization = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, planned, realization };
  };

  const getChartData = () => {
    const stats = getStats();
    return [
      { name: 'Tamamlandı', value: stats.completed },
      { name: 'Devam Ediyor', value: stats.inProgress },
      { name: 'Planlandı', value: stats.planned }
    ];
  };

  const getDepartmentStats = () => {
    const deptMap = new Map<string, any>();

    projects.forEach(p => {
      const dept = p.responsible_unit || 'Diğer';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { total: 0, completed: 0, inProgress: 0, planned: 0 });
      }
      const stats = deptMap.get(dept);
      stats.total++;
      if (p.status === 'completed') stats.completed++;
      else if (p.status === 'in_progress') stats.inProgress++;
      else if (p.status === 'planned') stats.planned++;
    });

    return Array.from(deptMap.entries()).map(([name, stats]) => ({
      name,
      ...stats,
      realization: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    }));
  };

  if (showReport) {
    const stats = getStats();
    const chartData = getChartData();
    const deptStats = getDepartmentStats();

    return (
      <Modal onClose={() => setShowReport(false)} size="full">
        <div className="bg-white">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
            <button
              onClick={() => setShowReport(false)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              ← Geri
            </button>
            <h2 className="text-lg font-semibold">Beyanname Raporu</h2>
            <div className="flex gap-2">
              <button
                onClick={() => exportToExcel(projects)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Yazdır
              </button>
            </div>
          </div>

          <div className="p-8">
            <div className="text-center border-b border-gray-300 pb-6 mb-6">
              <h1 className="text-2xl font-bold mb-4">SEÇİM BEYANNAMESİ PROJELERİ DURUM RAPORU</h1>
              <div className="text-sm space-y-1">
                <div>KURUM: {profile?.organization_name || 'KÖRFEZ BELEDİYESİ'}</div>
                <div>SEÇİM DÖNEMİ: {period}</div>
                <div>RAPOR TARİHİ: {new Date().toLocaleDateString('tr-TR')}</div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Toplam Proje</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-gray-600">Tamamlandı</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl font-bold text-orange-600">{stats.inProgress}</div>
                <div className="text-sm text-gray-600">Devam Ediyor</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-3xl font-bold text-gray-600">{stats.planned}</div>
                <div className="text-sm text-gray-600">Planlandı</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">%{stats.realization}</div>
                <div className="text-sm text-gray-600">Gerçekleşme Oranı</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">Durum Dağılımı</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value} (%${((entry.value / stats.total) * 100).toFixed(0)})`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Açıklama</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Tamamlandı: {stats.completed} (%{stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded"></div>
                    <span>Devam Ediyor: {stats.inProgress} (%{stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-500 rounded"></div>
                    <span>Planlandı: {stats.planned} (%{stats.total > 0 ? Math.round((stats.planned / stats.total) * 100) : 0})</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-4">Proje Listesi</h3>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2">SIRA</th>
                    <th className="border border-gray-300 p-2">İŞ TANIMI</th>
                    <th className="border border-gray-300 p-2">DAİRE</th>
                    <th className="border border-gray-300 p-2">İHALE DURUMU</th>
                    <th className="border border-gray-300 p-2">FİZİKİ %</th>
                    <th className="border border-gray-300 p-2">HARCAMA</th>
                    <th className="border border-gray-300 p-2">DURUM</th>
                    <th className="border border-gray-300 p-2">SP BAĞLANTI</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project, index) => (
                    <tr key={project.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-2">{project.project_name}</td>
                      <td className="border border-gray-300 p-2">{project.responsible_unit}</td>
                      <td className="border border-gray-300 p-2">{project.tender_status || 'Belirtilmemiş'}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.physical_progress}%</td>
                      <td className="border border-gray-300 p-2 text-right">{project.total_expense?.toLocaleString()}</td>
                      <td className="border border-gray-300 p-2 text-center">
                        {project.status === 'completed' ? '✅ Tamamlandı' : project.status === 'in_progress' ? '🔄 Devam' : '📋 Planlandı'}
                      </td>
                      <td className="border border-gray-300 p-2 text-center">{project.sp_connected ? '✓' : '−'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold mb-4">Daire Bazlı Özet</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2">DAİRE</th>
                    <th className="border border-gray-300 p-2">TOPLAM</th>
                    <th className="border border-gray-300 p-2">TAMAMLANAN</th>
                    <th className="border border-gray-300 p-2">DEVAM</th>
                    <th className="border border-gray-300 p-2">PLANLANMIŞ</th>
                    <th className="border border-gray-300 p-2">GERÇEKLEŞME</th>
                  </tr>
                </thead>
                <tbody>
                  {deptStats.map((dept, index) => (
                    <tr key={dept.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 p-2">{dept.name}</td>
                      <td className="border border-gray-300 p-2 text-center">{dept.total}</td>
                      <td className="border border-gray-300 p-2 text-center">{dept.completed}</td>
                      <td className="border border-gray-300 p-2 text-center">{dept.inProgress}</td>
                      <td className="border border-gray-300 p-2 text-center">{dept.planned}</td>
                      <td className="border border-gray-300 p-2 text-center">%{dept.realization}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-200 font-bold">
                    <td className="border border-gray-300 p-2">TOPLAM</td>
                    <td className="border border-gray-300 p-2 text-center">{stats.total}</td>
                    <td className="border border-gray-300 p-2 text-center">{stats.completed}</td>
                    <td className="border border-gray-300 p-2 text-center">{stats.inProgress}</td>
                    <td className="border border-gray-300 p-2 text-center">{stats.planned}</td>
                    <td className="border border-gray-300 p-2 text-center">%{stats.realization}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Beyanname Raporu Oluştur">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Seçim Dönemi:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="2024-2029">2024-2029</option>
            <option value="2019-2024">2019-2024</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Beyanname Türü:</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="Tümü">Tümü</option>
            <option value="İlçe">İlçe</option>
            <option value="İl">İl</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Durum:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="Tümü">Tümü</option>
            <option value="Tamamlandı">Tamamlandı</option>
            <option value="Devam">Devam</option>
            <option value="Planlandı">Planlandı</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format:</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="screen"
                checked={format === 'screen'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              Ekranda Görüntüle
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="excel"
                checked={format === 'excel'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              Excel (.xlsx)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="pdf"
                checked={format === 'pdf'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              PDF
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Oluşturuluyor...' : 'Raporu Oluştur'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
