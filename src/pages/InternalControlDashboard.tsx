import { useState, useEffect, useRef } from 'react';
import { Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, FileText, Activity, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import { RiskHeatMap } from '../components/RiskHeatMap';
import CollaborationRisksWidget from '../components/internal-control/CollaborationRisksWidget';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface DashboardStats {
  totalProcesses: number;
  activeProcesses: number;
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  totalControls: number;
  keyControls: number;
  effectiveControls: number;
  totalCapas: number;
  openCapas: number;
  overdueCapas: number;
  kiksCompliance: number;
}

export default function InternalControlDashboard() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [stats, setStats] = useState<DashboardStats>({
    totalProcesses: 0,
    activeProcesses: 0,
    totalRisks: 0,
    criticalRisks: 0,
    highRisks: 0,
    totalControls: 0,
    keyControls: 0,
    effectiveControls: 0,
    totalCapas: 0,
    openCapas: 0,
    overdueCapas: 0,
    kiksCompliance: 0
  });
  const [risks, setRisks] = useState<any[]>([]);
  const [recentCapas, setRecentCapas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const inherentHeatMapRef = useRef<HTMLDivElement>(null);
  const residualHeatMapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedPlanId) {
      loadDashboardData();
    }
  }, [profile?.organization_id, selectedPlanId]);

  const loadDashboardData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      await Promise.all([
        loadProcessStats(),
        loadRiskStats(),
        loadControlStats(),
        loadCapaStats(),
        loadKiksCompliance(),
        loadRisksForHeatmap(),
        loadRecentCapas()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadProcessStats = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_processes')
        .select('id, status')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId);

      if (error) throw error;

      setStats(prev => ({
        ...prev,
        totalProcesses: data?.length || 0,
        activeProcesses: data?.filter(p => p.status === 'active').length || 0
      }));
    } catch (error) {
      console.error('Süreç istatistikleri yüklenirken hata:', error);
    }
  };

  const loadRiskStats = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_risks')
        .select('id, residual_score')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId);

      if (error) throw error;

      setStats(prev => ({
        ...prev,
        totalRisks: data?.length || 0,
        criticalRisks: data?.filter(r => r.residual_score >= 20).length || 0,
        highRisks: data?.filter(r => r.residual_score >= 15 && r.residual_score < 20).length || 0
      }));
    } catch (error) {
      console.error('Risk istatistikleri yüklenirken hata:', error);
    }
  };

  const loadControlStats = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_controls')
        .select('id, is_key_control, operating_effectiveness')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId);

      if (error) throw error;

      setStats(prev => ({
        ...prev,
        totalControls: data?.length || 0,
        keyControls: data?.filter(c => c.is_key_control).length || 0,
        effectiveControls: data?.filter(c => c.operating_effectiveness === 'effective').length || 0
      }));
    } catch (error) {
      console.error('Kontrol istatistikleri yüklenirken hata:', error);
    }
  };

  const loadCapaStats = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_capas')
        .select('id, status, due_date')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId);

      if (error) throw error;

      const today = new Date();
      const overdueCount = data?.filter(c => {
        return c.due_date &&
          new Date(c.due_date) < today &&
          !['completed', 'verified', 'closed'].includes(c.status);
      }).length || 0;

      setStats(prev => ({
        ...prev,
        totalCapas: data?.length || 0,
        openCapas: data?.filter(c => ['open', 'in_progress'].includes(c.status)).length || 0,
        overdueCapas: overdueCount
      }));
    } catch (error) {
      console.error('DÖF istatistikleri yüklenirken hata:', error);
    }
  };

  const loadKiksCompliance = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data: standards, error: standardsError } = await supabase
        .from('ic_kiks_sub_standards')
        .select('id')
        .eq('ic_plan_id', selectedPlanId);

      if (standardsError) throw standardsError;

      const { data: controls, error: controlsError } = await supabase
        .from('ic_controls')
        .select('kiks_standard_id')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .not('kiks_standard_id', 'is', null);

      if (controlsError) throw controlsError;

      const totalStandards = standards?.length || 0;
      const coveredStandards = new Set(controls?.map(c => c.kiks_standard_id)).size;
      const compliance = totalStandards > 0 ? Math.round((coveredStandards / totalStandards) * 100) : 0;

      setStats(prev => ({
        ...prev,
        kiksCompliance: compliance
      }));
    } catch (error) {
      console.error('KİKS uyum istatistikleri yüklenirken hata:', error);
    }
  };

  const loadRisksForHeatmap = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_risks')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .limit(50);

      if (error) throw error;
      setRisks(data || []);
    } catch (error) {
      console.error('Risk ısı haritası yüklenirken hata:', error);
    }
  };

  const loadRecentCapas = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_capas')
        .select(`
          *,
          profiles!ic_capas_responsible_user_id_fkey(full_name)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentCapas(data || []);
    } catch (error) {
      console.error('Son DÖF kayıtları yüklenirken hata:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      open: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

    const summaryData = [
      ['İÇ KONTROL DASHBOARD RAPORU'],
      ['Tarih:', new Date().toLocaleDateString('tr-TR')],
      [''],
      ['ÖZET İSTATİSTİKLER'],
      ['Süreç İstatistikleri', ''],
      ['Toplam Süreç', stats.totalProcesses],
      ['Aktif Süreç', stats.activeProcesses],
      [''],
      ['Risk İstatistikleri', ''],
      ['Toplam Risk', stats.totalRisks],
      ['Kritik Risk', stats.criticalRisks],
      ['Yüksek Risk', stats.highRisks],
      [''],
      ['Kontrol İstatistikleri', ''],
      ['Toplam Kontrol', stats.totalControls],
      ['Anahtar Kontrol', stats.keyControls],
      ['Etkin Kontrol', stats.effectiveControls],
      [''],
      ['DÖF İstatistikleri', ''],
      ['Toplam DÖF', stats.totalCapas],
      ['Açık/Devam Eden DÖF', stats.openCapas],
      ['Gecikmiş DÖF', stats.overdueCapas],
      [''],
      ['KİKS Uyum', ''],
      ['Uyum Oranı', `${stats.kiksCompliance}%`]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Özet');

    const riskData = [
      ['Risk Kodu', 'Risk Başlığı', 'Doğal Olasılık', 'Doğal Etki', 'Doğal Skor', 'Artık Olasılık', 'Artık Etki', 'Artık Skor', 'Risk Seviyesi']
    ];
    risks.forEach(risk => {
      const residualScore = risk.residual_score || 0;
      let riskLevel = 'Çok Düşük';
      if (residualScore >= 20) riskLevel = 'Kritik';
      else if (residualScore >= 15) riskLevel = 'Yüksek';
      else if (residualScore >= 10) riskLevel = 'Orta';
      else if (residualScore >= 5) riskLevel = 'Düşük';

      riskData.push([
        risk.risk_code || '',
        risk.risk_title || '',
        risk.inherent_likelihood || '',
        risk.inherent_impact || '',
        risk.inherent_score || '',
        risk.residual_likelihood || '',
        risk.residual_impact || '',
        risk.residual_score || '',
        riskLevel
      ]);
    });
    const wsRisks = XLSX.utils.aoa_to_sheet(riskData);
    XLSX.utils.book_append_sheet(wb, wsRisks, 'Risk Detayları');

    const capaData = [
      ['DÖF Kodu', 'DÖF Başlığı', 'Durum', 'Sorumlu', 'Son Tarih', 'Oluşturma Tarihi']
    ];
    recentCapas.forEach(capa => {
      const isOverdue = capa.due_date &&
        new Date(capa.due_date) < new Date() &&
        !['completed', 'verified', 'closed'].includes(capa.status);

      let statusText = 'Açık';
      if (isOverdue) statusText = 'Gecikmiş';
      else if (capa.status === 'in_progress') statusText = 'Devam Ediyor';
      else if (capa.status === 'completed') statusText = 'Tamamlandı';

      capaData.push([
        capa.capa_code || '',
        capa.capa_title || '',
        statusText,
        capa.profiles?.full_name || '',
        capa.due_date ? new Date(capa.due_date).toLocaleDateString('tr-TR') : '',
        capa.created_at ? new Date(capa.created_at).toLocaleDateString('tr-TR') : ''
      ]);
    });
    const wsCapas = XLSX.utils.aoa_to_sheet(capaData);
    XLSX.utils.book_append_sheet(wb, wsCapas, 'Son DÖF Kayıtları');

    console.log('Creating heat maps with', risks.length, 'risks');

    const inherentHeatMapData = [];
    inherentHeatMapData.push(['DOĞAL RİSK ISI HARİTASI']);
    inherentHeatMapData.push(['']);
    inherentHeatMapData.push(['', 'ETKİ →', '', '', '', '']);
    const headerRow = ['OLASILIK ↓', '1', '2', '3', '4', '5'];
    inherentHeatMapData.push(headerRow);

    for (let likelihood = 5; likelihood >= 1; likelihood--) {
      const row = [likelihood.toString()];
      for (let impact = 1; impact <= 5; impact++) {
        const score = likelihood * impact;
        let level = 'Çok Düşük';
        if (score >= 20) level = 'Kritik';
        else if (score >= 15) level = 'Yüksek';
        else if (score >= 10) level = 'Orta';
        else if (score >= 5) level = 'Düşük';

        const cellRisks = risks.filter(r =>
          r.inherent_likelihood === likelihood && r.inherent_impact === impact
        );
        const riskCodes = cellRisks.map(r => r.risk_code).join(', ');
        const cellText = `${level} (${likelihood}x${impact}=${score})\n${cellRisks.length} Risk${riskCodes ? '\n' + riskCodes : ''}`;
        row.push(cellText);
      }
      inherentHeatMapData.push(row);
    }
    const wsInherent = XLSX.utils.aoa_to_sheet(inherentHeatMapData);
    wsInherent['!cols'] = [{wch: 12}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}];
    XLSX.utils.book_append_sheet(wb, wsInherent, 'Doğal Risk Isı Haritası');

    console.log('Inherent heat map created');

    const residualHeatMapData = [];
    residualHeatMapData.push(['ARTIK RİSK ISI HARİTASI']);
    residualHeatMapData.push(['']);
    residualHeatMapData.push(['', 'ETKİ →', '', '', '', '']);
    residualHeatMapData.push(headerRow);

    for (let likelihood = 5; likelihood >= 1; likelihood--) {
      const row = [likelihood.toString()];
      for (let impact = 1; impact <= 5; impact++) {
        const score = likelihood * impact;
        let level = 'Çok Düşük';
        if (score >= 20) level = 'Kritik';
        else if (score >= 15) level = 'Yüksek';
        else if (score >= 10) level = 'Orta';
        else if (score >= 5) level = 'Düşük';

        const cellRisks = risks.filter(r =>
          r.residual_likelihood === likelihood && r.residual_impact === impact
        );
        const riskCodes = cellRisks.map(r => r.risk_code).join(', ');
        const cellText = `${level} (${likelihood}x${impact}=${score})\n${cellRisks.length} Risk${riskCodes ? '\n' + riskCodes : ''}`;
        row.push(cellText);
      }
      residualHeatMapData.push(row);
    }
    const wsResidual = XLSX.utils.aoa_to_sheet(residualHeatMapData);
    wsResidual['!cols'] = [{wch: 12}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}];
    XLSX.utils.book_append_sheet(wb, wsResidual, 'Artık Risk Isı Haritası');

    console.log('Residual heat map created');

    XLSX.writeFile(wb, `ic-dashboard-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Excel export error:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();

    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('helvetica');

    doc.setFontSize(18);
    doc.text('IC KONTROL DASHBOARD RAPORU', 14, 20);

    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

    doc.setFontSize(14);
    doc.text('OZET ISTATISTIKLER', 14, 40);

    const summaryTableData = [
      ['Surec Istatistikleri', ''],
      ['Toplam Surec', stats.totalProcesses.toString()],
      ['Aktif Surec', stats.activeProcesses.toString()],
      ['Risk Istatistikleri', ''],
      ['Toplam Risk', stats.totalRisks.toString()],
      ['Kritik Risk', stats.criticalRisks.toString()],
      ['Yuksek Risk', stats.highRisks.toString()],
      ['Kontrol Istatistikleri', ''],
      ['Toplam Kontrol', stats.totalControls.toString()],
      ['Anahtar Kontrol', stats.keyControls.toString()],
      ['Etkin Kontrol', stats.effectiveControls.toString()],
      ['DOF Istatistikleri', ''],
      ['Toplam DOF', stats.totalCapas.toString()],
      ['Acik/Devam Eden DOF', stats.openCapas.toString()],
      ['Gecikmis DOF', stats.overdueCapas.toString()],
      ['KIKS Uyum', ''],
      ['Uyum Orani', `${stats.kiksCompliance}%`]
    ];

    autoTable(doc, {
      startY: 45,
      head: [['Metrik', 'Deger']],
      body: summaryTableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { font: 'helvetica', fontSize: 9 }
    });

    doc.addPage();
    doc.setFontSize(14);
    doc.text('RISK DETAYLARI', 14, 20);

    const riskTableData = risks.map(risk => {
      const residualScore = risk.residual_score || 0;
      let riskLevel = 'Cok Dusuk';
      if (residualScore >= 20) riskLevel = 'Kritik';
      else if (residualScore >= 15) riskLevel = 'Yuksek';
      else if (residualScore >= 10) riskLevel = 'Orta';
      else if (residualScore >= 5) riskLevel = 'Dusuk';

      return [
        risk.risk_code || '',
        risk.risk_title ? risk.risk_title.substring(0, 30) + (risk.risk_title.length > 30 ? '...' : '') : '',
        `${risk.inherent_likelihood || ''}x${risk.inherent_impact || ''}=${risk.inherent_score || ''}`,
        `${risk.residual_likelihood || ''}x${risk.residual_impact || ''}=${risk.residual_score || ''}`,
        riskLevel
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [['Risk Kodu', 'Risk Basligi', 'Dogal', 'Artik', 'Seviye']],
      body: riskTableData,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22], textColor: 255 },
      styles: { font: 'helvetica', fontSize: 8 }
    });

    if (recentCapas.length > 0) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text('SON DOF KAYITLARI', 14, 20);

      const capaTableData = recentCapas.map(capa => {
        const isOverdue = capa.due_date &&
          new Date(capa.due_date) < new Date() &&
          !['completed', 'verified', 'closed'].includes(capa.status);

        let statusText = 'Acik';
        if (isOverdue) statusText = 'Gecikmis';
        else if (capa.status === 'in_progress') statusText = 'Devam Ediyor';
        else if (capa.status === 'completed') statusText = 'Tamamlandi';

        return [
          capa.capa_code || '',
          capa.capa_title ? capa.capa_title.substring(0, 40) + (capa.capa_title.length > 40 ? '...' : '') : '',
          statusText,
          capa.profiles?.full_name || '',
          capa.due_date ? new Date(capa.due_date).toLocaleDateString('tr-TR') : ''
        ];
      });

      autoTable(doc, {
        startY: 25,
        head: [['DOF Kodu', 'DOF Basligi', 'Durum', 'Sorumlu', 'Son Tarih']],
        body: capaTableData,
        theme: 'grid',
        headStyles: { fillColor: [168, 85, 247], textColor: 255 },
        styles: { font: 'helvetica', fontSize: 8 }
      });
    }

      if (inherentHeatMapRef.current) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('DOGAL RISK ISI HARITASI', 14, 20);

        const canvas = await html2canvas(inherentHeatMapRef.current, {
          scale: 3,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          allowTaint: true,
          width: inherentHeatMapRef.current.scrollWidth,
          height: inherentHeatMapRef.current.scrollHeight
        });
        const imgData = canvas.toDataURL('image/png');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 30;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const maxHeight = pageHeight - 40;
        let finalWidth = imgWidth;
        let finalHeight = imgHeight;

        if (imgHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = (canvas.width * finalHeight) / canvas.height;
        }

        const xPos = (pageWidth - finalWidth) / 2;
        doc.addImage(imgData, 'PNG', xPos, 30, finalWidth, finalHeight);
      }

      if (residualHeatMapRef.current) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('ARTIK RISK ISI HARITASI', 14, 20);

        const canvas = await html2canvas(residualHeatMapRef.current, {
          scale: 3,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          allowTaint: true,
          width: residualHeatMapRef.current.scrollWidth,
          height: residualHeatMapRef.current.scrollHeight
        });
        const imgData = canvas.toDataURL('image/png');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 30;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const maxHeight = pageHeight - 40;
        let finalWidth = imgWidth;
        let finalHeight = imgHeight;

        if (imgHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = (canvas.width * finalHeight) / canvas.height;
        }

        const xPos = (pageWidth - finalWidth) / 2;
        doc.addImage(imgData, 'PNG', xPos, 30, finalWidth, finalHeight);
      }

      doc.save(`ic-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF dosyası oluşturulurken hata oluştu.');
    } finally {
      setExporting(false);
    }
  };

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                İç Kontrol Dashboard'unu kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Dashboard yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">İç Kontrol Dashboard</h1>
            <p className="text-sm text-gray-600">Merkezi İzleme ve Raporlama</p>
            {selectedPlan && (
              <p className="text-xs text-gray-500">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'İndiriliyor...' : 'Excel İndir'}
          </button>
          <button
            onClick={exportToPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'İndiriliyor...' : 'PDF İndir'}
          </button>
        </div>
      </div>

      {/* Ana KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalProcesses}</span>
          </div>
          <div className="text-sm opacity-90">Toplam Süreç</div>
          <div className="text-xs opacity-75 mt-1">{stats.activeProcesses} Aktif</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalRisks}</span>
          </div>
          <div className="text-sm opacity-90">Toplam Risk</div>
          <div className="text-xs opacity-75 mt-1">
            {stats.criticalRisks} Kritik, {stats.highRisks} Yüksek
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalControls}</span>
          </div>
          <div className="text-sm opacity-90">Toplam Kontrol</div>
          <div className="text-xs opacity-75 mt-1">
            {stats.keyControls} Anahtar, {stats.effectiveControls} Etkin
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.totalCapas}</span>
          </div>
          <div className="text-sm opacity-90">Toplam DÖF</div>
          <div className="text-xs opacity-75 mt-1">
            {stats.openCapas} Açık, {stats.overdueCapas} Gecikmiş
          </div>
        </div>
      </div>

      {/* İkinci Seviye KPI'lar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Kontrol Etkinliği</h3>
            {stats.totalControls > 0 && (
              <span className={`text-2xl font-bold ${
                (stats.effectiveControls / stats.totalControls) >= 0.8 ? 'text-green-600' :
                (stats.effectiveControls / stats.totalControls) >= 0.6 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.round((stats.effectiveControls / stats.totalControls) * 100)}%
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                stats.totalControls > 0 && (stats.effectiveControls / stats.totalControls) >= 0.8 ? 'bg-green-600' :
                stats.totalControls > 0 && (stats.effectiveControls / stats.totalControls) >= 0.6 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${stats.totalControls > 0 ? (stats.effectiveControls / stats.totalControls) * 100 : 0}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-2">
            {stats.effectiveControls} / {stats.totalControls} kontrol etkin
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">KİKS Uyum Oranı</h3>
            <span className={`text-2xl font-bold ${
              stats.kiksCompliance >= 80 ? 'text-green-600' :
              stats.kiksCompliance >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.kiksCompliance}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                stats.kiksCompliance >= 80 ? 'bg-green-600' :
                stats.kiksCompliance >= 60 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${stats.kiksCompliance}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-2">
            KİKS standartları karşılama oranı
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Risk Yönetimi</h3>
            <div className="flex gap-2">
              {stats.criticalRisks > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded font-semibold">
                  {stats.criticalRisks} Kritik
                </span>
              )}
              {stats.highRisks > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded font-semibold">
                  {stats.highRisks} Yüksek
                </span>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {stats.totalRisks > 0 ? (
              <div>
                <div className="flex justify-between mb-1">
                  <span>Kritik/Yüksek Risk Oranı:</span>
                  <span className="font-semibold">
                    {Math.round(((stats.criticalRisks + stats.highRisks) / stats.totalRisks) * 100)}%
                  </span>
                </div>
              </div>
            ) : (
              <span>Henüz risk tanımlanmamış</span>
            )}
          </div>
        </div>
      </div>

      {/* İşbirliği Riskleri Widget */}
      <div className="mb-6">
        <CollaborationRisksWidget />
      </div>

      {/* Risk Isı Haritaları */}
      {risks.length > 0 && (
        <div className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div ref={inherentHeatMapRef}>
            <RiskHeatMap risks={risks} type="inherent" />
          </div>
          <div ref={residualHeatMapRef}>
            <RiskHeatMap risks={risks} type="residual" />
          </div>
        </div>
      )}

      {/* Son DÖF Kayıtları */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Son DÖF Kayıtları
          </h3>
        </div>
        <div className="p-4">
          {recentCapas.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Henüz DÖF kaydı yok</p>
          ) : (
            <div className="space-y-3">
              {recentCapas.map((capa) => {
                const isOverdue = capa.due_date &&
                  new Date(capa.due_date) < new Date() &&
                  !['completed', 'verified', 'closed'].includes(capa.status);

                return (
                  <div key={capa.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{capa.capa_code}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(isOverdue ? 'overdue' : capa.status)}`}>
                          {isOverdue ? 'Gecikmiş' : capa.status === 'open' ? 'Açık' : capa.status === 'in_progress' ? 'Devam Ediyor' : 'Tamamlandı'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900">{capa.capa_title}</div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-600">
                        {capa.profiles?.full_name && <span>Sorumlu: {capa.profiles.full_name}</span>}
                        {capa.due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(capa.due_date).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOverdue && (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Uyarılar ve Aksiyonlar */}
      {(stats.overdueCapas > 0 || stats.criticalRisks > 0) && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" />
            Dikkat Gerektiren Konular
          </h3>
          <div className="space-y-2 text-sm">
            {stats.overdueCapas > 0 && (
              <div className="flex items-center gap-2 text-yellow-800">
                <span className="w-2 h-2 bg-yellow-600 rounded-full" />
                {stats.overdueCapas} adet gecikmiş DÖF kaydı bulunmaktadır
              </div>
            )}
            {stats.criticalRisks > 0 && (
              <div className="flex items-center gap-2 text-yellow-800">
                <span className="w-2 h-2 bg-red-600 rounded-full" />
                {stats.criticalRisks} adet kritik risk acil aksiyon gerektirmektedir
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
