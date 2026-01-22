import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import { X, FileSpreadsheet, FileText, Printer, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface IlyasReportModalProps {
  onClose: () => void;
}

interface ProjectData {
  id: string;
  project_no: string;
  project_name: string;
  sector: string;
  contract_amount: number;
  total_expense: number;
  physical_progress: number;
  financial_progress: number;
  end_date: string;
  status: string;
  period_1_expense?: number;
  period_1_progress?: number;
  period_2_expense?: number;
  period_2_progress?: number;
  period_3_expense?: number;
  period_3_progress?: number;
  period_4_expense?: number;
  period_4_progress?: number;
}

const SECTORS = ['Tümü', 'DKH-SOSYAL', 'ULAŞIM', 'ALTYAPI', 'ÇEVRE', 'EĞİTİM', 'SAĞLIK'];
const STATUS_OPTIONS = ['Tümü', 'Devam Eden', 'Tamamlanan'];

export default function IlyasReportModal({ onClose }: IlyasReportModalProps) {
  const { profile } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState(4);
  const [sector, setSector] = useState('Tümü');
  const [statusFilter, setStatusFilter] = useState('Tümü');
  const [format, setFormat] = useState<'screen' | 'excel' | 'pdf'>('screen');
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectData[]>([]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const generateReport = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('projects')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('year', year);

      if (sector !== 'Tümü') {
        query = query.eq('sector', sector);
      }

      if (statusFilter === 'Devam Eden') {
        query = query.eq('status', 'in_progress');
      } else if (statusFilter === 'Tamamlanan') {
        query = query.eq('status', 'completed');
      }

      const { data, error } = await query.order('project_no');

      if (error) throw error;

      setProjects(data || []);

      if (format === 'screen') {
        setShowReport(true);
      } else if (format === 'excel') {
        exportToExcel(data || []);
      } else if (format === 'pdf') {
        window.print();
      }
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      alert('Rapor oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data: ProjectData[]) => {
    const excelData = data.map((p, index) => ({
      'SIRA NO': index + 1,
      'PROJE NO': p.project_no,
      'PROJE ADI': p.project_name,
      'SEKTÖR': p.sector,
      'SÖZLEŞME TUTARI': p.contract_amount,
      'I.DÖNEM HARCAMA': p.period_1_expense || 0,
      'I.DÖNEM FİZİKİ': p.period_1_progress || 0,
      'II.DÖNEM HARCAMA': p.period_2_expense || 0,
      'II.DÖNEM FİZİKİ': p.period_2_progress || 0,
      'III.DÖNEM HARCAMA': p.period_3_expense || 0,
      'III.DÖNEM FİZİKİ': p.period_3_progress || 0,
      'IV.DÖNEM HARCAMA': p.period_4_expense || 0,
      'IV.DÖNEM FİZİKİ': p.period_4_progress || 0,
      'TOPLAM HARCAMA': p.total_expense,
      'NAKDİ GERÇEKLEŞME': p.financial_progress,
      'FİZİKİ GERÇEKLEŞME': p.physical_progress,
      'BİTİŞ YILI': p.end_date?.substring(0, 4),
      'DURUM': p.status === 'completed' ? 'BİTTİ' : 'DEVAM'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    ws['!cols'] = [
      { wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 10 },
      { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 10 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'İLYAS Raporu');
    XLSX.writeFile(wb, `ILYAS_Raporu_${year}_D${period}.xlsx`);
  };

  const getTotalStats = () => {
    return {
      total: projects.length,
      completed: projects.filter(p => p.status === 'completed').length,
      inProgress: projects.filter(p => p.status === 'in_progress').length,
      totalExpense: projects.reduce((sum, p) => sum + (p.total_expense || 0), 0)
    };
  };

  const formatCurrency = (amount: number) => {
    return (amount / 1000000).toFixed(2) + 'M ₺';
  };

  if (showReport) {
    const stats = getTotalStats();

    return (
      <Modal onClose={() => setShowReport(false)} size="full">
        <div className="bg-white">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
            <button
              onClick={() => setShowReport(false)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Geri
            </button>
            <h2 className="text-lg font-semibold">İLYAS {year} {['I', 'II', 'III', 'IV'][period - 1]}. Dönem Raporu</h2>
            <div className="flex gap-2">
              <button
                onClick={() => exportToExcel(projects)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Yazdır
              </button>
            </div>
          </div>

          <div className="p-8">
            <div className="text-center border-b border-gray-300 pb-6 mb-6">
              <h1 className="text-2xl font-bold mb-4">YATIRIM PROJELERİ İZLEME RAPORU</h1>
              <div className="flex justify-between text-sm">
                <div>
                  <div>İL: {profile?.organization_name || 'KOCAELİ'}</div>
                  <div>YIL: {year}</div>
                  <div>REFERANS: ÖS/{year}/{period}</div>
                </div>
                <div className="text-right">
                  <div>DÖNEM: {['I', 'II', 'III', 'IV'][period - 1]} ({['Ocak-Mart', 'Nisan-Haziran', 'Temmuz-Eylül', 'Ekim-Aralık'][period - 1]})</div>
                  <div>KURULUŞ: {profile?.organization_name || 'KÖRFEZ BELEDİYESİ'}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Toplam Proje</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-gray-600">Tamamlanan</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl font-bold text-orange-600">{stats.inProgress}</div>
                <div className="text-sm text-gray-600">Devam Eden</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xl font-bold text-gray-800">{formatCurrency(stats.totalExpense)}</div>
                <div className="text-sm text-gray-600">Toplam Harcama</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th rowSpan={3} className="border border-gray-300 p-2">SIRA NO</th>
                    <th rowSpan={3} className="border border-gray-300 p-2">PROJE NO</th>
                    <th rowSpan={3} className="border border-gray-300 p-2 min-w-[200px]">PROJE ADI</th>
                    <th rowSpan={3} className="border border-gray-300 p-2">SEKTÖR</th>
                    <th rowSpan={3} className="border border-gray-300 p-2">SÖZLEŞME TUTARI (TL)</th>
                    <th colSpan={8} className="border border-gray-300 p-2">DÖNEMSEL HARCAMALAR</th>
                    <th colSpan={2} className="border border-gray-300 p-2">TOPLAM</th>
                    <th rowSpan={3} className="border border-gray-300 p-2">BİTİŞ YILI</th>
                    <th rowSpan={3} className="border border-gray-300 p-2">DURUM</th>
                  </tr>
                  <tr className="bg-gray-100">
                    <th colSpan={2} className="border border-gray-300 p-2">I. DÖNEM</th>
                    <th colSpan={2} className="border border-gray-300 p-2">II. DÖNEM</th>
                    <th colSpan={2} className="border border-gray-300 p-2">III. DÖNEM</th>
                    <th colSpan={2} className="border border-gray-300 p-2">IV. DÖNEM</th>
                    <th rowSpan={2} className="border border-gray-300 p-2">HARCAMA (TL)</th>
                    <th rowSpan={2} className="border border-gray-300 p-2">GERÇEKLEŞME NAKDİ/FİZİKİ</th>
                  </tr>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2">Harcama</th>
                    <th className="border border-gray-300 p-2">Fiziki %</th>
                    <th className="border border-gray-300 p-2">Harcama</th>
                    <th className="border border-gray-300 p-2">Fiziki %</th>
                    <th className="border border-gray-300 p-2">Harcama</th>
                    <th className="border border-gray-300 p-2">Fiziki %</th>
                    <th className="border border-gray-300 p-2">Harcama</th>
                    <th className="border border-gray-300 p-2">Fiziki %</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project, index) => (
                    <tr key={project.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${project.status === 'completed' ? 'bg-green-50' : ''}`}>
                      <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.project_no}</td>
                      <td className="border border-gray-300 p-2">{project.project_name}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.sector}</td>
                      <td className="border border-gray-300 p-2 text-right">{project.contract_amount?.toLocaleString()}</td>
                      <td className="border border-gray-300 p-2 text-right">{project.period_1_expense?.toLocaleString() || 0}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.period_1_progress || 0}</td>
                      <td className="border border-gray-300 p-2 text-right">{project.period_2_expense?.toLocaleString() || 0}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.period_2_progress || 0}</td>
                      <td className="border border-gray-300 p-2 text-right">{project.period_3_expense?.toLocaleString() || 0}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.period_3_progress || 0}</td>
                      <td className="border border-gray-300 p-2 text-right">{project.period_4_expense?.toLocaleString() || 0}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.period_4_progress || 0}</td>
                      <td className="border border-gray-300 p-2 text-right">{project.total_expense?.toLocaleString()}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.financial_progress}/{project.physical_progress}</td>
                      <td className="border border-gray-300 p-2 text-center">{project.end_date ? project.end_date.substring(0, 4) : 'D'}</td>
                      <td className="border border-gray-300 p-2 text-center font-semibold">
                        {project.status === 'completed' ? 'BİTTİ' : 'DEVAM'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 text-sm text-gray-600 border-t border-gray-300 pt-4">
              <div>Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</div>
              <div>Oluşturan: {profile?.full_name || 'Sistem Yöneticisi'}</div>
              <div>Not: D = Devam Eden Proje</div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="İLYAS Raporu Oluştur">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Yıl:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dönem:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>I. Dönem</option>
            <option value={2}>II. Dönem</option>
            <option value={3}>III. Dönem</option>
            <option value={4}>IV. Dönem</option>
            <option value={0}>Tümü</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sektör:</label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Durum:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Oluşturuluyor...' : 'Raporu Oluştur'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
