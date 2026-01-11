import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Treatment {
  id: string;
  code: string;
  action_plan: string;
  status: string;
  due_date: string;
  responsible_department: string;
  risk_id: string;
  risk: { code: string; title: string; };
}

export default function ActivityProgressReport({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    try {
      const [treatmentsRes, deptRes] = await Promise.all([
        supabase
          .from('risk_treatments')
          .select(`
            *,
            risk:risks(code, title)
          `)
          .eq('organization_id', profile.organization_id),
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile.organization_id)
      ]);

      if (treatmentsRes.data) setTreatments(treatmentsRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverdueDays = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const overdueTreatments = treatments.filter(t => t.status !== 'completed' && getOverdueDays(t.due_date) > 0);
  const completedTreatments = treatments.filter(t => t.status === 'completed');
  const inProgressTreatments = treatments.filter(t => t.status === 'in_progress');

  const departmentStats = departments.map(dept => {
    const deptTreatments = treatments.filter(t => t.responsible_department === dept.id);
    return {
      name: dept.name,
      total: deptTreatments.length,
      completed: deptTreatments.filter(t => t.status === 'completed').length,
      inProgress: deptTreatments.filter(t => t.status === 'in_progress').length,
      overdue: deptTreatments.filter(t => t.status !== 'completed' && getOverdueDays(t.due_date) > 0).length
    };
  }).filter(d => d.total > 0);

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('FAALIYET ILERLEME RAPORU', 14, 20);
    doc.setFontSize(10);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    let yPos = 40;

    doc.setFontSize(14);
    doc.text('1. OZET', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.text(`Toplam Faaliyet: ${treatments.length}`, 14, yPos);
    yPos += 6;
    doc.text(`Tamamlanan: ${completedTreatments.length} (${treatments.length > 0 ? Math.round((completedTreatments.length / treatments.length) * 100) : 0}%)`, 14, yPos);
    yPos += 6;
    doc.text(`Devam Eden: ${inProgressTreatments.length} (${treatments.length > 0 ? Math.round((inProgressTreatments.length / treatments.length) * 100) : 0}%)`, 14, yPos);
    yPos += 6;
    doc.text(`Geciken: ${overdueTreatments.length} (${treatments.length > 0 ? Math.round((overdueTreatments.length / treatments.length) * 100) : 0}%)`, 14, yPos);
    yPos += 15;

    if (overdueTreatments.length > 0) {
      doc.setFontSize(14);
      doc.text('2. GECIKEN FAALIYETLER', 14, yPos);
      yPos += 10;

      const tableData = overdueTreatments.slice(0, 15).map(t => [
        t.code || '-',
        t.action_plan?.substring(0, 35) || '-',
        t.risk?.code || '-',
        `${getOverdueDays(t.due_date)} gun`,
        departments.find(d => d.id === t.responsible_department)?.name?.substring(0, 20) || '-'
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['KOD', 'FAALIYET', 'RISK', 'GECIKME', 'SORUMLU']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (departmentStats.length > 0 && yPos < 250) {
      doc.setFontSize(14);
      doc.text('3. BIRIM BAZLI FAALIYET DURUMU', 14, yPos);
      yPos += 10;

      const deptTableData = departmentStats.slice(0, 10).map(dept => [
        dept.name?.substring(0, 30) || '-',
        dept.total.toString(),
        dept.completed.toString(),
        dept.inProgress.toString(),
        dept.overdue.toString()
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['Birim', 'Toplam', 'Tamamlanan', 'Devam', 'Geciken']],
        body: deptTableData,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 }
      });
    }

    doc.save('faaliyet-ilerleme-raporu.pdf');
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['FAALİYET İLERLEME RAPORU'],
      ['Rapor Tarihi:', new Date().toLocaleDateString('tr-TR')],
      [''],
      ['ÖZET'],
      ['Toplam Faaliyet', treatments.length],
      ['Tamamlanan', completedTreatments.length],
      ['Devam Eden', inProgressTreatments.length],
      ['Geciken', overdueTreatments.length]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    const overdueData = overdueTreatments.map(t => ({
      'KOD': t.code || '-',
      'FAALİYET': t.action_plan,
      'RİSK': t.risk?.code || '-',
      'GECİKME (GÜN)': getOverdueDays(t.due_date),
      'SORUMLU': departments.find(d => d.id === t.responsible_department)?.name || '-'
    }));

    const ws2 = XLSX.utils.json_to_sheet(overdueData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Geciken Faaliyetler');

    XLSX.writeFile(wb, 'faaliyet-ilerleme-raporu.xlsx');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faaliyet İlerleme Raporu</h1>
          <p className="text-sm text-slate-600 mt-1">Risk faaliyetlerinin ilerleme durumu</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        <div className="flex gap-2 justify-end">
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">1. ÖZET</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-slate-900">{treatments.length}</div>
              <div className="text-sm text-slate-600 mt-2">TOPLAM</div>
            </div>
            <div className="bg-green-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-600">{completedTreatments.length}</div>
              <div className="text-sm text-slate-600 mt-2">TAMAMLANAN</div>
              <div className="text-xs text-slate-500 mt-1">
                {treatments.length > 0 ? Math.round((completedTreatments.length / treatments.length) * 100) : 0}%
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{inProgressTreatments.length}</div>
              <div className="text-sm text-slate-600 mt-2">DEVAM EDEN</div>
              <div className="text-xs text-slate-500 mt-1">
                {treatments.length > 0 ? Math.round((inProgressTreatments.length / treatments.length) * 100) : 0}%
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-red-600">{overdueTreatments.length}</div>
              <div className="text-sm text-slate-600 mt-2">GECİKEN</div>
              <div className="text-xs text-slate-500 mt-1">
                {treatments.length > 0 ? Math.round((overdueTreatments.length / treatments.length) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>

        {overdueTreatments.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">2. GECİKEN FAALİYETLER</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  {overdueTreatments.length} faaliyet gecikmede
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Lütfen sorumlu birimlerle iletişime geçin
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">KOD</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">FAALİYET</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">RİSK</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">GECİKME</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">SORUMLU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {overdueTreatments.map(treatment => (
                    <tr key={treatment.id}>
                      <td className="px-4 py-3 text-sm text-slate-900">{treatment.code || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{treatment.action_plan?.substring(0, 50)}...</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{treatment.risk?.code || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                          {getOverdueDays(treatment.due_date)} gün
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {departments.find(d => d.id === treatment.responsible_department)?.name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {departmentStats.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">3. BİRİM BAZLI FAALİYET DURUMU</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" name="Tamamlanan" fill="#22c55e" />
                <Bar dataKey="inProgress" name="Devam Eden" fill="#3b82f6" />
                <Bar dataKey="overdue" name="Geciken" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Birim</th>
                    <th className="px-4 py-2 text-center font-semibold">Toplam</th>
                    <th className="px-4 py-2 text-center font-semibold">Tamamlanan</th>
                    <th className="px-4 py-2 text-center font-semibold">Devam</th>
                    <th className="px-4 py-2 text-center font-semibold">Geciken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {departmentStats.map(dept => (
                    <tr key={dept.name}>
                      <td className="px-4 py-2">{dept.name}</td>
                      <td className="px-4 py-2 text-center">{dept.total}</td>
                      <td className="px-4 py-2 text-center text-green-600 font-medium">{dept.completed}</td>
                      <td className="px-4 py-2 text-center text-blue-600 font-medium">{dept.inProgress}</td>
                      <td className="px-4 py-2 text-center text-red-600 font-medium">{dept.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
