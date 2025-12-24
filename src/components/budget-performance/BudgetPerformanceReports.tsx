import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

type ReportType = 'program' | 'economic' | 'detailed';

interface ReportRow {
  [key: string]: any;
}

export default function BudgetPerformanceReports() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();

  const [reportType, setReportType] = useState<ReportType>('program');
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      loadReport();
    }
  }, [profile, reportType]);

  const loadReport = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    try {
      if (reportType === 'program') {
        await loadProgramReport();
      } else if (reportType === 'economic') {
        await loadEconomicReport();
      } else {
        await loadDetailedReport();
      }
    } catch (error) {
      console.error('Report error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgramReport = async () => {
    const { data } = await supabase
      .from('expense_budget_entries')
      .select(`
        program_id,
        programs:program_id(code, name),
        year1_amount,
        year2_amount,
        year3_amount
      `)
      .eq('organization_id', profile!.organization_id);

    if (!data) {
      setReportData([]);
      return;
    }

    const grouped = data.reduce((acc: any, row: any) => {
      const key = row.program_id;
      if (!acc[key]) {
        acc[key] = {
          code: row.programs?.code,
          name: row.programs?.name,
          year1: 0,
          year2: 0,
          year3: 0,
        };
      }
      acc[key].year1 += row.year1_amount || 0;
      acc[key].year2 += row.year2_amount || 0;
      acc[key].year3 += row.year3_amount || 0;
      return acc;
    }, {});

    const result = Object.values(grouped).filter((row: any) =>
      row.year1 > 0 || row.year2 > 0 || row.year3 > 0
    );

    setReportData(result);
  };

  const loadEconomicReport = async () => {
    const { data } = await supabase
      .from('expense_budget_entries')
      .select(`
        economic_code_id,
        expense_economic_codes:economic_code_id(full_code, name),
        year1_amount,
        year2_amount,
        year3_amount
      `)
      .eq('organization_id', profile!.organization_id);

    if (!data) {
      setReportData([]);
      return;
    }

    const grouped = data.reduce((acc: any, row: any) => {
      const key = row.economic_code_id;
      if (!acc[key]) {
        acc[key] = {
          code: row.expense_economic_codes?.full_code,
          name: row.expense_economic_codes?.name,
          year1: 0,
          year2: 0,
          year3: 0,
        };
      }
      acc[key].year1 += row.year1_amount || 0;
      acc[key].year2 += row.year2_amount || 0;
      acc[key].year3 += row.year3_amount || 0;
      return acc;
    }, {});

    const result = Object.values(grouped).filter((row: any) =>
      row.year1 > 0 || row.year2 > 0 || row.year3 > 0
    );

    setReportData(result);
  };

  const loadDetailedReport = async () => {
    const { data } = await supabase
      .from('expense_budget_entries')
      .select(`
        program_id,
        sub_program_id,
        activity_id,
        programs:program_id(code, name),
        sub_programs:sub_program_id(code, name),
        activities:activity_id(code, name),
        year1_amount,
        year2_amount,
        year3_amount
      `)
      .eq('organization_id', profile!.organization_id);

    if (!data) {
      setReportData([]);
      return;
    }

    const grouped = data.reduce((acc: any, row: any) => {
      const key = `${row.program_id}-${row.sub_program_id || 'null'}-${row.activity_id || 'null'}`;
      if (!acc[key]) {
        acc[key] = {
          program_code: row.programs?.code,
          program_name: row.programs?.name,
          sub_program_code: row.sub_programs?.code || '-',
          sub_program_name: row.sub_programs?.name || '-',
          activity_code: row.activities?.code || '-',
          activity_name: row.activities?.name || '-',
          year1: 0,
          year2: 0,
          year3: 0,
        };
      }
      acc[key].year1 += row.year1_amount || 0;
      acc[key].year2 += row.year2_amount || 0;
      acc[key].year3 += row.year3_amount || 0;
      return acc;
    }, {});

    const result = Object.values(grouped).filter((row: any) =>
      row.year1 > 0 || row.year2 > 0 || row.year3 > 0
    );

    setReportData(result);
  };

  const exportToCSV = () => {
    if (reportData.length === 0) {
      alert('Rapor verisi yok');
      return;
    }

    const headers = Object.keys(reportData[0]);
    const csvContent = [
      headers.join('\t'),
      ...reportData.map(row =>
        headers.map(header => row[header]).join('\t')
      )
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `butce_rapor_${reportType}_${Date.now()}.xls`;
    link.click();
  };

  const exportToPDF = () => {
    alert('PDF export özelliği yakında eklenecek');
  };

  if (loading) return <div className="text-center py-8">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Bütçe Raporları</h3>
              <p className="text-sm text-slate-600 mt-1">Otomatik oluşturulan özet raporlar</p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={exportToCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="secondary" size="sm" onClick={exportToPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setReportType('program')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                reportType === 'program'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Program Bazlı
            </button>
            <button
              onClick={() => setReportType('economic')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                reportType === 'economic'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Ekonomik Kod Bazlı
            </button>
            <button
              onClick={() => setReportType('detailed')}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                reportType === 'detailed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Detaylı (Program-Alt Program-Faaliyet)
            </button>
          </div>

          <div className="overflow-x-auto">
            {reportType === 'program' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Program Kodu</th>
                    <th className="px-4 py-3 text-left">Program Adı</th>
                    <th className="px-4 py-3 text-right">{currentYear}</th>
                    <th className="px-4 py-3 text-right">{currentYear + 1}</th>
                    <th className="px-4 py-3 text-right">{currentYear + 2}</th>
                    <th className="px-4 py-3 text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-mono">{row.code}</td>
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 text-right">{row.year1.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right">{row.year2.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right">{row.year3.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {(row.year1 + row.year2 + row.year3).toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'economic' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Ekonomik Kod</th>
                    <th className="px-4 py-3 text-left">Açıklama</th>
                    <th className="px-4 py-3 text-right">{currentYear}</th>
                    <th className="px-4 py-3 text-right">{currentYear + 1}</th>
                    <th className="px-4 py-3 text-right">{currentYear + 2}</th>
                    <th className="px-4 py-3 text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 text-right">{row.year1.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right">{row.year2.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right">{row.year3.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {(row.year1 + row.year2 + row.year3).toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'detailed' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Program</th>
                    <th className="px-4 py-3 text-left">Alt Program</th>
                    <th className="px-4 py-3 text-left">Faaliyet</th>
                    <th className="px-4 py-3 text-right">{currentYear}</th>
                    <th className="px-4 py-3 text-right">{currentYear + 1}</th>
                    <th className="px-4 py-3 text-right">{currentYear + 2}</th>
                    <th className="px-4 py-3 text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-xs">
                        <div className="font-mono">{row.program_code}</div>
                        <div className="text-slate-600">{row.program_name}</div>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <div className="font-mono">{row.sub_program_code}</div>
                        <div className="text-slate-600">{row.sub_program_name}</div>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <div className="font-mono">{row.activity_code}</div>
                        <div className="text-slate-600">{row.activity_name}</div>
                      </td>
                      <td className="px-4 py-2 text-right">{row.year1.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right">{row.year2.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right">{row.year3.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {(row.year1 + row.year2 + row.year3).toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportData.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p>Henüz rapor verisi yok</p>
                <p className="text-sm mt-1">Gider veya gelir kaydı ekleyin</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
