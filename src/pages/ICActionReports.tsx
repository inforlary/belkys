import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { FileText, Download, Calendar, Filter, BarChart3, AlertTriangle, TrendingUp, FileCheck, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportFilter {
  action_plan_id: string;
  component_id: string;
  department_id: string;
  status: string;
  approval_status: string;
  start_date: string;
  end_date: string;
}

export default function ICActionReports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [filters, setFilters] = useState<ReportFilter>({
    action_plan_id: '',
    component_id: '',
    department_id: '',
    status: '',
    approval_status: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    const [plansData, compsData, deptsData] = await Promise.all([
      supabase.from('ic_action_plans').select('*').eq('organization_id', profile?.organization_id).order('start_date', { ascending: false }),
      supabase.from('ic_components').select('*').order('order_index'),
      supabase.from('departments').select('*').eq('organization_id', profile?.organization_id).order('name')
    ]);

    setActionPlans(plansData.data || []);
    setComponents(compsData.data || []);
    setDepartments(deptsData.data || []);

    const activePlan = plansData.data?.find(p => p.status === 'ACTIVE');
    if (activePlan) {
      setFilters(prev => ({ ...prev, action_plan_id: activePlan.id }));
    }
  };

  const generateActionPlanReport = async (format: 'pdf' | 'excel') => {
    setLoading(true);
    try {
      let query = supabase
        .from('ic_action_progress_summary')
        .select('*')
        .eq('organization_id', profile?.organization_id);

      if (filters.action_plan_id) query = query.eq('action_plan_id', filters.action_plan_id);
      if (filters.component_id) query = query.eq('component_id', filters.component_id);
      if (filters.department_id) query = query.eq('responsible_department_id', filters.department_id);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.approval_status) query = query.eq('approval_status', filters.approval_status);

      const { data } = await query.order('code');

      if (!data || data.length === 0) {
        alert('Seçilen filtrelere uygun veri bulunamadı.');
        return;
      }

      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(data.map(d => ({
          'Eylem Kodu': d.code,
          'Başlık': d.title,
          'Bileşen': d.component_name,
          'Standart': d.standard_name,
          'Birim': d.department_name,
          'Durum': getStatusLabel(d.status),
          'Onay Durumu': getApprovalStatusLabel(d.approval_status),
          'İlerleme': `%${d.calculated_progress}`,
          'Başlangıç': d.start_date ? new Date(d.start_date).toLocaleDateString('tr-TR') : '-',
          'Hedef Tarih': d.target_date ? new Date(d.target_date).toLocaleDateString('tr-TR') : '-'
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Eylem Planı');
        XLSX.writeFile(wb, `Eylem_Plani_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        const doc = new jsPDF('landscape');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('İç Kontrol Eylem Planı Raporu', 14, 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);

        autoTable(doc, {
          startY: 28,
          head: [['Kod', 'Başlık', 'Bileşen', 'Birim', 'Durum', 'Onay', 'İlerleme %', 'Hedef Tarih']],
          body: data.map(d => [
            d.code,
            d.title.substring(0, 40) + (d.title.length > 40 ? '...' : ''),
            d.component_code,
            d.department_name,
            getStatusLabel(d.status),
            getApprovalStatusLabel(d.approval_status),
            d.calculated_progress,
            d.target_date ? new Date(d.target_date).toLocaleDateString('tr-TR') : '-'
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] }
        });

        doc.save(`Eylem_Plani_Raporu_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      alert('Rapor oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const generateProgressReport = async () => {
    setLoading(true);
    try {
      const { data: actionsData } = await supabase
        .from('ic_action_progress_summary')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('action_plan_id', filters.action_plan_id);

      if (!actionsData || actionsData.length === 0) {
        alert('Veri bulunamadı.');
        return;
      }

      const componentStats = actionsData.reduce((acc: any, curr) => {
        const key = curr.component_code || 'Diğer';
        if (!acc[key]) {
          acc[key] = { total: 0, completed: 0, avg_progress: 0, total_progress: 0 };
        }
        acc[key].total++;
        acc[key].total_progress += curr.calculated_progress || 0;
        if (curr.status === 'COMPLETED') acc[key].completed++;
        return acc;
      }, {});

      Object.keys(componentStats).forEach(key => {
        componentStats[key].avg_progress = Math.round(componentStats[key].total_progress / componentStats[key].total);
      });

      const doc = new jsPDF();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('İlerleme Raporu', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);
      doc.text(`Toplam Eylem: ${actionsData.length}`, 14, 28);

      let yPos = 38;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Bileşen Bazlı İlerleme:', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Bileşen', 'Toplam Eylem', 'Tamamlanan', 'Ortalama İlerleme']],
        body: Object.entries(componentStats).map(([key, value]: [string, any]) => [
          key,
          value.total,
          value.completed,
          `%${value.avg_progress}`
        ]),
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`Ilerleme_Raporu_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      alert('Rapor oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const generateOverdueReport = async (format: 'pdf' | 'excel') => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('ic_action_progress_summary')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .eq('is_overdue', true)
        .order('target_date');

      if (!data || data.length === 0) {
        alert('Geciken eylem bulunamadı.');
        return;
      }

      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(data.map(d => ({
          'Eylem Kodu': d.code,
          'Başlık': d.title,
          'Birim': d.department_name,
          'Hedef Tarih': new Date(d.target_date).toLocaleDateString('tr-TR'),
          'Gecikme (Gün)': Math.floor((new Date().getTime() - new Date(d.target_date).getTime()) / (1000 * 60 * 60 * 24)),
          'İlerleme': `%${d.calculated_progress}`
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Geciken Eylemler');
        XLSX.writeFile(wb, `Geciken_Eylemler_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        const doc = new jsPDF();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Geciken Eylemler Raporu', 14, 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);
        doc.text(`Toplam Geciken Eylem: ${data.length}`, 14, 28);

        autoTable(doc, {
          startY: 35,
          head: [['Kod', 'Başlık', 'Birim', 'Hedef Tarih', 'Gecikme (Gün)', 'İlerleme']],
          body: data.map(d => [
            d.code,
            d.title.substring(0, 40) + (d.title.length > 40 ? '...' : ''),
            d.department_name,
            new Date(d.target_date).toLocaleDateString('tr-TR'),
            Math.floor((new Date().getTime() - new Date(d.target_date).getTime()) / (1000 * 60 * 60 * 24)),
            `%${d.calculated_progress}`
          ]),
          headStyles: { fillColor: [239, 68, 68] }
        });

        doc.save(`Geciken_Eylemler_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      alert('Rapor oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NOT_STARTED: 'Başlamadı',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      CANCELLED: 'İptal'
    };
    return labels[status] || status;
  };

  const getApprovalStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      taslak: 'Taslak',
      birim_onayi_bekliyor: 'Birim Onayı Bekliyor',
      yonetim_onayi_bekliyor: 'Yönetim Onayı Bekliyor',
      onaylandi: 'Onaylandı',
      reddedildi: 'Reddedildi'
    };
    return labels[status] || status;
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Eylem Planı Raporları</h1>
        <p className="text-gray-600 mt-1">İç kontrol eylem planı raporlarını oluşturun ve indirin</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-600" />
          Filtreler
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Eylem Planı</label>
            <select
              value={filters.action_plan_id}
              onChange={(e) => setFilters({ ...filters, action_plan_id: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
            >
              <option value="">Tümü</option>
              {actionPlans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bileşen</label>
            <select
              value={filters.component_id}
              onChange={(e) => setFilters({ ...filters, component_id: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
            >
              <option value="">Tümü</option>
              {components.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
            <select
              value={filters.department_id}
              onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
            >
              <option value="">Tümü</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
            >
              <option value="">Tümü</option>
              <option value="NOT_STARTED">Başlamadı</option>
              <option value="IN_PROGRESS">Devam Ediyor</option>
              <option value="COMPLETED">Tamamlandı</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Onay Durumu</label>
            <select
              value={filters.approval_status}
              onChange={(e) => setFilters({ ...filters, approval_status: e.target.value })}
              className="w-full border-gray-300 rounded-lg"
            >
              <option value="">Tümü</option>
              <option value="taslak">Taslak</option>
              <option value="onaylandi">Onaylandı</option>
              <option value="reddedildi">Reddedildi</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Eylem Planı Raporu</h3>
              <p className="text-sm text-gray-600 mb-4">
                Tüm eylemler detaylı liste halinde. Seçilen filtrelere göre raporlanır.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => generateActionPlanReport('pdf')}
                  disabled={loading}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PDF İndir
                </button>
                <button
                  onClick={() => generateActionPlanReport('excel')}
                  disabled={loading}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel İndir
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">İlerleme Raporu</h3>
              <p className="text-sm text-gray-600 mb-4">
                Bileşen ve birim bazlı ilerleme durumu. Grafikler ve tablolar içerir.
              </p>
              <button
                onClick={generateProgressReport}
                disabled={loading}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                PDF İndir
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Geciken Eylemler Raporu</h3>
              <p className="text-sm text-gray-600 mb-4">
                Sadece geciken eylemler. Gecikme süresi ve sorumlu birim bilgileriyle.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => generateOverdueReport('pdf')}
                  disabled={loading}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PDF İndir
                </button>
                <button
                  onClick={() => generateOverdueReport('excel')}
                  disabled={loading}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel İndir
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileCheck className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Denetim Raporu</h3>
              <p className="text-sm text-gray-600 mb-4">
                Sayıştay ve İç Denetim için hazır rapor. Genel uyum oranı ve kanıt dokümanlarıyla.
              </p>
              <button
                disabled
                className="px-3 py-2 bg-gray-400 text-white rounded-lg text-sm flex items-center gap-2 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Yakında
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
