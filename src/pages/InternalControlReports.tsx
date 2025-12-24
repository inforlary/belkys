import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, FileText, Download, TrendingUp, AlertTriangle, CheckCircle, Target, Shield, X, ListChecks, Search, GitBranch, Building2, Network, ClipboardList, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import { Card } from '../components/ui/Card';
import { exportToExcel, exportToPDF } from '../utils/reportExport';
import { RiskHeatMap } from '../components/RiskHeatMap';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

interface ReportStats {
  kiks_compliance: number;
  total_processes: number;
  total_risks: number;
  total_controls: number;
  control_effectiveness: number;
  high_risks: number;
  open_capas: number;
  overdue_capas: number;
  total_action_plans: number;
  completed_action_plans: number;
  overdue_action_plans: number;
  total_findings: number;
  critical_findings: number;
  total_tests: number;
  failed_tests: number;
}

export default function InternalControlReports() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [stats, setStats] = useState<ReportStats>({
    kiks_compliance: 0,
    total_processes: 0,
    total_risks: 0,
    total_controls: 0,
    control_effectiveness: 0,
    high_risks: 0,
    open_capas: 0,
    overdue_capas: 0,
    total_action_plans: 0,
    completed_action_plans: 0,
    overdue_action_plans: 0,
    total_findings: 0,
    critical_findings: 0,
    total_tests: 0,
    failed_tests: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<string>('summary');
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [pendingReport, setPendingReport] = useState<string>('');
  const [risks, setRisks] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const inherentHeatMapRef = useRef<HTMLDivElement>(null);
  const residualHeatMapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.organization_id && selectedPlanId) {
      loadReportData();
      loadRisksForHeatmap();
    }
  }, [profile, selectedPlanId]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [
        kiksResult,
        processResult,
        riskResult,
        controlResult,
        capaResult,
        actionPlanResult,
        findingsResult,
        testResult
      ] = await Promise.all([
        loadKIKSCompliance(),
        loadProcessStats(),
        loadRiskStats(),
        loadControlStats(),
        loadCAPAStats(),
        loadActionPlanStats(),
        loadFindingsStats(),
        loadTestStats()
      ]);

      setStats({
        kiks_compliance: kiksResult,
        total_processes: processResult.total,
        total_risks: riskResult.total,
        total_controls: controlResult.total,
        control_effectiveness: controlResult.effectiveness,
        high_risks: riskResult.high_risks,
        open_capas: capaResult.open,
        overdue_capas: capaResult.overdue,
        total_action_plans: actionPlanResult.total,
        completed_action_plans: actionPlanResult.completed,
        overdue_action_plans: actionPlanResult.overdue,
        total_findings: findingsResult.total,
        critical_findings: findingsResult.critical,
        total_tests: testResult.total,
        failed_tests: testResult.failed
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
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
        .in('status', ['identified', 'assessed', 'mitigating', 'monitored'])
        .limit(50);

      if (error) throw error;
      setRisks(data || []);
    } catch (error) {
      console.error('Risk heat map data load error:', error);
    }
  };

  const loadKIKSCompliance = async () => {
    const { data: totalStandards } = await supabase
      .from('ic_kiks_sub_standards')
      .select('id', { count: 'exact' })
      .eq('ic_plan_id', selectedPlanId!);

    const { data: compliantMappings } = await supabase
      .from('ic_process_kiks_mappings')
      .select('kiks_standard_id', { count: 'exact' })
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .in('compliance_level', ['compliant', 'fully_compliant']);

    const total = totalStandards?.length || 0;
    const compliant = new Set(compliantMappings?.map(m => (m as any).kiks_standard_id)).size;

    return total > 0 ? Math.round((compliant / total) * 100) : 0;
  };

  const loadProcessStats = async () => {
    const { data } = await supabase
      .from('ic_processes')
      .select('id', { count: 'exact' })
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .eq('status', 'active');

    return { total: data?.length || 0 };
  };

  const loadRiskStats = async () => {
    const { data } = await supabase
      .from('ic_risks')
      .select('residual_score')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .in('status', ['identified', 'assessed', 'mitigating', 'monitored']);

    const total = data?.length || 0;
    const highRisks = data?.filter(r => r.residual_score >= 15).length || 0;

    return { total, high_risks: highRisks };
  };

  const loadControlStats = async () => {
    const { data } = await supabase
      .from('ic_controls')
      .select('operating_effectiveness')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .eq('status', 'active');

    const total = data?.length || 0;
    const effective = data?.filter(c => c.operating_effectiveness === 'effective').length || 0;
    const effectiveness = total > 0 ? Math.round((effective / total) * 100) : 0;

    return { total, effectiveness };
  };

  const loadCAPAStats = async () => {
    const { data: openData } = await supabase
      .from('ic_capas')
      .select('id', { count: 'exact' })
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .in('status', ['open', 'in_progress']);

    const { data: overdueData } = await supabase
      .from('ic_capas')
      .select('id', { count: 'exact' })
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .eq('status', 'overdue');

    return {
      open: openData?.length || 0,
      overdue: overdueData?.length || 0
    };
  };

  const loadActionPlanStats = async () => {
    const { data: allPlans } = await supabase
      .from('ic_action_plans')
      .select('status, target_completion_date')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!);

    const total = allPlans?.length || 0;
    const completed = allPlans?.filter(p => p.status === 'completed').length || 0;
    const overdue = allPlans?.filter(p =>
      p.status !== 'completed' &&
      p.target_completion_date &&
      new Date(p.target_completion_date) < new Date()
    ).length || 0;

    return { total, completed, overdue };
  };

  const loadFindingsStats = async () => {
    const { data } = await supabase
      .from('ic_findings')
      .select('severity')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .in('status', ['open', 'in_progress']);

    const total = data?.length || 0;
    const critical = data?.filter(f => f.severity === 'critical').length || 0;

    return { total, critical };
  };

  const loadTestStats = async () => {
    const { data } = await supabase
      .from('ic_control_tests')
      .select('test_result')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!);

    const total = data?.length || 0;
    const failed = data?.filter(t => t.test_result === 'fail').length || 0;

    return { total, failed };
  };

  const generateReport = (reportType: string) => {
    setPendingReport(reportType);
    setShowFormatModal(true);
  };

  const downloadReport = async (format: 'excel' | 'pdf') => {
    try {
      if (!profile?.organization_id) return;

      setShowFormatModal(false);

      switch (pendingReport) {
        case 'KİKS Uyumluluk':
          await generateKIKSComplianceReport(format);
          break;
        case 'Risk Heat Map':
          await generateRiskHeatMapReport(format);
          break;
        case 'Kontrol Olgunluğu':
          await generateControlMaturityReport(format);
          break;
        case 'Süreç Envanter':
          await generateProcessInventoryReport(format);
          break;
        case 'DÖF Takip':
          await generateCAPAReport(format);
          break;
        case 'Test Sonuçları':
          await generateTestResultsReport(format);
          break;
        case 'Eylem Planı İlerleme':
          await generateActionPlanProgressReport(format);
          break;
        case 'Bulgular Raporu':
          await generateFindingsReport(format);
          break;
        case 'Entegre Eylem Planı':
          await generateIntegratedActionPlanReport(format);
          break;
        case 'Stratejik Hedef İlişkilendirme':
          await generateStrategicGoalIntegrationReport(format);
          break;
        case 'Departman Performansı':
          await generateDepartmentPerformanceReport(format);
          break;
        case 'Risk-Kontrol Matrisi':
          await generateRiskControlMatrixReport(format);
          break;
        case 'Yönetim Özeti':
          await generateExecutiveSummaryReport(format);
          break;
        default:
          alert('Rapor tipi bulunamadı');
      }
    } catch (error) {
      console.error('Rapor oluşturma hatası:', error);
      alert('Rapor oluşturulurken bir hata oluştu');
    }
  };

  const generateKIKSComplianceReport = async (format: 'excel' | 'pdf') => {
    const { data: mappings } = await supabase
      .from('ic_process_kiks_mappings')
      .select(`
        *,
        ic_processes(code, name),
        ic_kiks_standards(code, title)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!);

    const reportData = (mappings || []).map(m => ({
      'Süreç Kodu': (m as any).ic_processes?.code || '',
      'Süreç Adı': (m as any).ic_processes?.name || '',
      'KİKS Kodu': (m as any).ic_kiks_standards?.code || '',
      'KİKS Standardı': (m as any).ic_kiks_standards?.title || '',
      'Uyumluluk Seviyesi': m.compliance_level === 'fully_compliant' ? 'Tam Uyumlu' :
                             m.compliance_level === 'compliant' ? 'Uyumlu' :
                             m.compliance_level === 'partially_compliant' ? 'Kısmen Uyumlu' : 'Uyumsuz',
      'Açıklama': m.notes || ''
    }));

    if (reportData.length === 0) {
      alert('Rapor için veri bulunamadı. Lütfen önce KİKS-Süreç eşleştirmesi yapın.');
      return;
    }

    if (format === 'excel') {
      exportToExcel(reportData, 'KIKS_Uyumluluk_Raporu', 'KİKS Uyumluluk');
    } else {
      exportToPDF(reportData, 'KIKS_Uyumluluk_Raporu', 'KİKS Uyumluluk Raporu');
    }
  };

  const generateRiskHeatMapReport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const { data: riskData } = await supabase
        .from('ic_risks')
        .select(`
          *,
          ic_processes(code, name)
        `)
        .eq('organization_id', profile!.organization_id)
        .eq('ic_plan_id', selectedPlanId!)
        .in('status', ['identified', 'assessed', 'mitigating', 'monitored']);

      const reportData = (riskData || []).map(r => ({
        'Risk Kodu': r.risk_code,
        'Risk Başlığı': r.risk_title,
        'Süreç': (r as any).ic_processes?.name || '',
        'Olasılık': r.inherent_likelihood,
        'Etki': r.inherent_impact,
        'İç Skor': r.inherent_score,
        'Kalıntı Olasılık': r.residual_likelihood,
        'Kalıntı Etki': r.residual_impact,
        'Kalıntı Skor': r.residual_score,
        'Risk Seviyesi': r.residual_score >= 15 ? 'Yüksek' : r.residual_score >= 8 ? 'Orta' : 'Düşük',
        'Durum': r.status === 'identified' ? 'Tanımlandı' :
                 r.status === 'assessed' ? 'Değerlendirildi' :
                 r.status === 'mitigating' ? 'Azaltılıyor' : 'İzleniyor'
      }));

      if (format === 'excel') {
        const wb = XLSX.utils.book_new();

        const ws = XLSX.utils.json_to_sheet(reportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Risk Detayları');

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

            const cellRisks = (riskData || []).filter(r =>
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

            const cellRisks = (riskData || []).filter(r =>
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

        XLSX.writeFile(wb, `Risk_Isi_Haritasi_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        const doc = new jsPDF();

        doc.setFont('helvetica');
        doc.setFontSize(18);
        doc.text('RISK ISI HARITASI RAPORU', 14, 20);
        doc.setFontSize(10);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

        const riskTableData = (riskData || []).map(r => [
          r.risk_code || '',
          r.risk_title ? r.risk_title.substring(0, 30) + (r.risk_title.length > 30 ? '...' : '') : '',
          `${r.inherent_likelihood || ''}x${r.inherent_impact || ''}=${r.inherent_score || ''}`,
          `${r.residual_likelihood || ''}x${r.residual_impact || ''}=${r.residual_score || ''}`,
          r.residual_score >= 15 ? 'Yuksek' : r.residual_score >= 8 ? 'Orta' : 'Dusuk'
        ]);

        autoTable(doc, {
          startY: 35,
          head: [['Risk Kodu', 'Risk Basligi', 'Dogal', 'Artik', 'Seviye']],
          body: riskTableData,
          theme: 'grid',
          headStyles: { fillColor: [249, 115, 22], textColor: 255 },
          styles: { font: 'helvetica', fontSize: 8 }
        });

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

        doc.save(`Risk_Isi_Haritasi_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Rapor oluşturulurken hata oluştu.');
    } finally {
      setExporting(false);
      setShowFormatModal(false);
    }
  };

  const generateControlMaturityReport = async (format: 'excel' | 'pdf') => {
    const { data: controls } = await supabase
      .from('ic_controls')
      .select(`
        *,
        ic_risks(risk_code, risk_title),
        ic_processes(code, name),
        owner:profiles!ic_controls_control_owner_id_fkey(full_name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!);

    const reportData = (controls || []).map(c => ({
      'Kontrol Kodu': c.control_code,
      'Kontrol Başlığı': c.control_title,
      'Risk Kodu': (c as any).ic_risks?.risk_code || '',
      'Süreç': (c as any).ic_processes?.name || '',
      'Kontrol Tipi': c.control_type === 'preventive' ? 'Önleyici' :
                      c.control_type === 'detective' ? 'Tespit Edici' :
                      c.control_type === 'corrective' ? 'Düzeltici' : 'Yönlendirici',
      'Kontrol Niteliği': c.control_nature === 'manual' ? 'Manuel' :
                          c.control_nature === 'automated' ? 'Otomatik' : 'BT Bağımlı',
      'Frekans': c.frequency,
      'Tasarım Etkinliği': c.design_effectiveness === 'effective' ? 'Etkin' :
                           c.design_effectiveness === 'partially_effective' ? 'Kısmen Etkin' :
                           c.design_effectiveness === 'ineffective' ? 'Etkisiz' : 'Değerlendirilmedi',
      'İşletim Etkinliği': c.operating_effectiveness === 'effective' ? 'Etkin' :
                           c.operating_effectiveness === 'partially_effective' ? 'Kısmen Etkin' :
                           c.operating_effectiveness === 'ineffective' ? 'Etkisiz' : 'Değerlendirilmedi',
      'Kontrol Sahibi': (c as any).owner?.full_name || '',
      'Durum': c.status === 'active' ? 'Aktif' : c.status === 'inactive' ? 'Pasif' : 'İnceleniyor'
    }));

    if (format === 'excel') {
      exportToExcel(reportData, 'Kontrol_Olgunluk_Raporu', 'Kontrol Olgunluğu');
    } else {
      exportToPDF(reportData, 'Kontrol_Olgunluk_Raporu', 'Kontrol Olgunluk Raporu');
    }
  };

  const generateProcessInventoryReport = async (format: 'excel' | 'pdf') => {
    const { data: processes } = await supabase
      .from('ic_processes')
      .select(`
        *,
        owner:profiles!owner_user_id(full_name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!);

    const reportData: any[] = [];

    for (const process of processes || []) {
      const { data: steps } = await supabase
        .from('ic_process_steps')
        .select(`
          *,
          responsible:profiles!responsible_user_id(full_name)
        `)
        .eq('process_id', process.id)
        .order('step_number');

      reportData.push({
        'Süreç Kodu': process.code,
        'Süreç Adı': process.name,
        'Süreç Kategorisi': process.process_category || '',
        'Süreç Sahibi': (process as any).owner?.full_name || '',
        'Kritik Süreç': process.is_critical ? 'Evet' : 'Hayır',
        'Durum': process.status === 'active' ? 'Aktif' :
                 process.status === 'inactive' ? 'Pasif' : 'Taslak',
        'Açıklama': process.description || '',
        'Adım Sayısı': steps?.length || 0,
        'Adım Detayları': ''
      });

      (steps || []).forEach(step => {
        reportData.push({
          'Süreç Kodu': `  ${process.code} - Adım ${step.step_number}`,
          'Süreç Adı': step.step_name,
          'Süreç Kategorisi': (step as any).responsible?.full_name || step.responsible_role || '',
          'Süreç Sahibi': step.estimated_duration || '',
          'Kritik Süreç': step.inputs || '',
          'Durum': step.outputs || '',
          'Açıklama': step.step_description || '',
          'Adım Sayısı': '',
          'Adım Detayları': step.tools_used || ''
        });
      });
    }

    if (format === 'excel') {
      exportToExcel(reportData, 'Surec_Envanteri', 'Süreç Envanteri');
    } else {
      exportToPDF(reportData, 'Surec_Envanteri', 'Süreç Envanteri Raporu');
    }
  };

  const generateCAPAReport = async (format: 'excel' | 'pdf') => {
    const { data: capas } = await supabase
      .from('ic_capas')
      .select(`
        *,
        ic_findings(finding_code, finding_title),
        responsible:profiles!responsible_user_id(full_name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!);

    const reportData = (capas || []).map(c => ({
      'DÖF Kodu': c.capa_code,
      'DÖF Başlığı': c.title || '',
      'Bulgu Kodu': (c as any).ic_findings?.finding_code || '',
      'Bulgu Başlığı': (c as any).ic_findings?.finding_title || '',
      'DÖF Tipi': c.capa_type === 'corrective' ? 'Düzeltici' : 'Önleyici',
      'Açıklama': c.description || '',
      'Kök Neden': c.root_cause || '',
      'Önerilen Aksiyon': c.proposed_action || '',
      'Sorumlu': (c as any).responsible?.full_name || '',
      'Bitiş Tarihi': c.due_date || '',
      'Tamamlanma Tarihi': c.actual_completion_date || '',
      'Öncelik': c.priority === 'high' ? 'Yüksek' :
                 c.priority === 'medium' ? 'Orta' : 'Düşük',
      'Durum': c.status === 'open' ? 'Açık' :
               c.status === 'in_progress' ? 'Devam Ediyor' :
               c.status === 'completed' ? 'Tamamlandı' :
               c.status === 'verified' ? 'Doğrulandı' : 'Gecikmiş',
      'Tamamlanma Oranı': c.completion_percentage ? `${c.completion_percentage}%` : '0%',
      'Etkinlik': c.is_effective === true ? 'Etkin' :
                  c.is_effective === false ? 'Etkisiz' : 'Değerlendirilmedi'
    }));

    if (format === 'excel') {
      exportToExcel(reportData, 'DOF_Takip_Raporu', 'DÖF Takip');
    } else {
      exportToPDF(reportData, 'DOF_Takip_Raporu', 'DÖF Takip Raporu');
    }
  };

  const generateTestResultsReport = async (format: 'excel' | 'pdf') => {
    const { data: tests } = await supabase
      .from('ic_control_tests')
      .select(`
        *,
        ic_controls(control_code, control_title),
        profiles(full_name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .order('test_date', { ascending: false });

    const reportData = (tests || []).map(t => ({
      'Test Tarihi': t.test_date,
      'Kontrol Kodu': (t as any).ic_controls?.control_code || '',
      'Kontrol Başlığı': (t as any).ic_controls?.control_title || '',
      'Test Eden': (t as any).profiles?.full_name || '',
      'Dönem Başlangıç': t.test_period_start,
      'Dönem Bitiş': t.test_period_end,
      'Örnek Büyüklüğü': t.sample_size,
      'Bulunan İstisna': t.exceptions_found,
      'Test Sonucu': t.test_result === 'pass' ? 'Başarılı' :
                     t.test_result === 'fail' ? 'Başarısız' : 'İstisnalı Başarı',
      'Notlar': t.test_notes || ''
    }));

    if (format === 'excel') {
      exportToExcel(reportData, 'Test_Sonuclari_Raporu', 'Test Sonuçları');
    } else {
      exportToPDF(reportData, 'Test_Sonuclari_Raporu', 'Test Sonuçları Raporu');
    }
  };

  const generateActionPlanProgressReport = async (format: 'excel' | 'pdf') => {
    const { data: actionPlans, error } = await supabase
      .from('ic_action_plans')
      .select(`
        *,
        ic_kiks_actions(
          kiks_sub_standard_id,
          ic_kiks_sub_standards(
            code,
            title,
            ic_kiks_standards(code, title)
          )
        ),
        responsible:profiles!responsible_user_id(full_name),
        departments(name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .order('created_at', { ascending: false });

    if (!actionPlans || actionPlans.length === 0) {
      alert('Rapor için veri bulunamadı. Lütfen önce eylem planları oluşturun.');
      return;
    }

    const reportData = (actionPlans || []).map(ap => {
      const kiksAction = (ap as any).ic_kiks_actions;
      const subStandard = kiksAction?.ic_kiks_sub_standards;
      const standard = subStandard?.ic_kiks_standards;

      const isOverdue = ap.status !== 'completed' &&
                        ap.target_completion_date &&
                        new Date(ap.target_completion_date) < new Date();

      return {
        'Eylem Planı Kodu': ap.action_plan_code || '',
        'KİKS Standardı': standard ? `${standard.code} - ${standard.title}` : '',
        'KİKS Alt Standardı': subStandard ? `${subStandard.code} - ${subStandard.title}` : '',
        'Eylem Açıklaması': ap.action_description || '',
        'Sorumlu': (ap as any).responsible?.full_name || '',
        'Departman': (ap as any).departments?.name || '',
        'Başlangıç Tarihi': ap.start_date || '',
        'Hedef Tarih': ap.target_completion_date || '',
        'Tamamlanma Tarihi': ap.completion_date || '',
        'Durum': ap.status === 'planned' ? 'Planlandı' :
                 ap.status === 'in_progress' ? 'Devam Ediyor' :
                 ap.status === 'completed' ? 'Tamamlandı' :
                 ap.status === 'on_hold' ? 'Beklemede' : 'İptal Edildi',
        'İlerleme %': ap.progress_percentage || 0,
        'Öncelik': ap.priority === 'high' ? 'Yüksek' :
                   ap.priority === 'medium' ? 'Orta' : 'Düşük',
        'Gecikme Durumu': isOverdue ? 'Gecikmiş' : 'Zamanında',
        'Notlar': ap.notes || ''
      };
    });

    if (format === 'excel') {
      exportToExcel(reportData, 'Eylem_Plani_Ilerleme_Raporu', 'Eylem Planı İlerleme');
    } else {
      exportToPDF(reportData, 'Eylem_Plani_Ilerleme_Raporu', 'KİKS Eylem Planı İlerleme Raporu');
    }
  };

  const generateFindingsReport = async (format: 'excel' | 'pdf') => {
    const { data: findings } = await supabase
      .from('ic_findings')
      .select(`
        *,
        ic_control_tests(
          test_date,
          ic_controls(control_code, control_title)
        ),
        ic_processes(code, name),
        identified_by:profiles!identified_by_user_id(full_name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .order('identified_date', { ascending: false });

    if (!findings || findings.length === 0) {
      alert('Rapor için veri bulunamadı. Lütfen önce bulgu kayıtları oluşturun.');
      return;
    }

    const reportData = (findings || []).map(f => {
      const test = (f as any).ic_control_tests;
      const control = test?.ic_controls;

      return {
        'Bulgu Kodu': f.finding_code,
        'Bulgu Başlığı': f.finding_title,
        'Süreç': (f as any).ic_processes?.name || '',
        'Kontrol Kodu': control?.control_code || '',
        'Kontrol': control?.control_title || '',
        'Test Tarihi': test?.test_date || '',
        'Bulgu Tipi': f.finding_type === 'control_deficiency' ? 'Kontrol Eksikliği' :
                      f.finding_type === 'process_gap' ? 'Süreç Açığı' :
                      f.finding_type === 'compliance_issue' ? 'Uyumluluk Sorunu' : 'Diğer',
        'Önem Derecesi': f.severity === 'critical' ? 'Kritik' :
                         f.severity === 'high' ? 'Yüksek' :
                         f.severity === 'medium' ? 'Orta' : 'Düşük',
        'Açıklama': f.description || '',
        'Tespit Tarihi': f.identified_date,
        'Tespit Eden': (f as any).identified_by?.full_name || '',
        'Durum': f.status === 'open' ? 'Açık' :
                 f.status === 'in_progress' ? 'İşlemde' :
                 f.status === 'resolved' ? 'Çözüldü' : 'Kapalı',
        'Çözüm Tarihi': f.resolution_date || '',
        'Önerilen Çözüm': f.recommended_action || ''
      };
    });

    if (format === 'excel') {
      exportToExcel(reportData, 'Bulgular_Raporu', 'Bulgular');
    } else {
      exportToPDF(reportData, 'Bulgular_Raporu', 'İç Kontrol Bulguları Raporu');
    }
  };

  const generateIntegratedActionPlanReport = async (format: 'excel' | 'pdf') => {
    const { data: actionPlans } = await supabase
      .from('ic_action_plans')
      .select(`
        *,
        ic_kiks_actions(
          kiks_sub_standard_id,
          control_id,
          test_id,
          finding_id,
          capa_id,
          ic_kiks_sub_standards(code, title),
          ic_controls(control_code, control_title),
          ic_control_tests(test_date, test_result),
          ic_findings(finding_code, finding_title, severity),
          ic_capas(capa_code, title, status)
        ),
        responsible:profiles!responsible_user_id(full_name),
        departments(name)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .order('created_at', { ascending: false });

    if (!actionPlans || actionPlans.length === 0) {
      alert('Rapor için veri bulunamadı. Lütfen önce entegre eylem planları oluşturun.');
      return;
    }

    const reportData = (actionPlans || []).map(ap => {
      const kiksAction = (ap as any).ic_kiks_actions;
      const subStandard = kiksAction?.ic_kiks_sub_standards;
      const control = kiksAction?.ic_controls;
      const test = kiksAction?.ic_control_tests;
      const finding = kiksAction?.ic_findings;
      const capa = kiksAction?.ic_capas;

      return {
        'Eylem Planı': ap.action_plan_code || '',
        'KİKS Alt Standardı': subStandard ? `${subStandard.code} - ${subStandard.title}` : '',
        'İlişkili Kontrol': control ? `${control.control_code} - ${control.control_title}` : 'Yok',
        'Test Durumu': test ? `${test.test_date} - ${test.test_result === 'pass' ? 'Başarılı' : 'Başarısız'}` : 'Test Yapılmadı',
        'İlişkili Bulgu': finding ? `${finding.finding_code} - ${finding.finding_title} (${finding.severity})` : 'Bulgu Yok',
        'İlişkili DÖF': capa ? `${capa.capa_code} - ${capa.title} (${capa.status})` : 'DÖF Yok',
        'Eylem Açıklaması': ap.action_description || '',
        'Sorumlu': (ap as any).responsible?.full_name || '',
        'Departman': (ap as any).departments?.name || '',
        'Durum': ap.status === 'planned' ? 'Planlandı' :
                 ap.status === 'in_progress' ? 'Devam Ediyor' :
                 ap.status === 'completed' ? 'Tamamlandı' :
                 ap.status === 'on_hold' ? 'Beklemede' : 'İptal Edildi',
        'İlerleme %': ap.progress_percentage || 0,
        'Hedef Tarih': ap.target_completion_date || '',
        'Tamamlanma Tarihi': ap.completion_date || ''
      };
    });

    if (format === 'excel') {
      exportToExcel(reportData, 'Entegre_Eylem_Plani_Raporu', 'Entegre Eylem Planı');
    } else {
      exportToPDF(reportData, 'Entegre_Eylem_Plani_Raporu', 'Entegre İç Kontrol Eylem Planı Raporu');
    }
  };

  const generateStrategicGoalIntegrationReport = async (format: 'excel' | 'pdf') => {
    const { data: processes } = await supabase
      .from('ic_processes')
      .select(`
        *,
        ic_risks(
          risk_code,
          risk_title,
          residual_score,
          ic_controls(control_code, control_title, operating_effectiveness)
        ),
        goals!ic_processes_goal_id_fkey(code, title)
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .not('goal_id', 'is', null);

    if (!processes || processes.length === 0) {
      alert('Rapor için veri bulunamadı. Lütfen önce süreçlerinizi stratejik hedeflerle ilişkilendirin.');
      return;
    }

    const reportData: any[] = [];

    (processes || []).forEach(process => {
      const goal = (process as any).goals;
      const risks = (process as any).ic_risks || [];

      risks.forEach((risk: any) => {
        const controls = risk.ic_controls || [];

        controls.forEach((control: any) => {
          reportData.push({
            'Stratejik Hedef Kodu': goal?.code || '',
            'Stratejik Hedef': goal?.title || '',
            'Süreç Kodu': process.code,
            'Süreç Adı': process.name,
            'Risk Kodu': risk.risk_code,
            'Risk Başlığı': risk.risk_title,
            'Risk Skoru': risk.residual_score,
            'Risk Seviyesi': risk.residual_score >= 15 ? 'Yüksek' :
                            risk.residual_score >= 8 ? 'Orta' : 'Düşük',
            'Kontrol Kodu': control.control_code,
            'Kontrol Başlığı': control.control_title,
            'Kontrol Etkinliği': control.operating_effectiveness === 'effective' ? 'Etkin' :
                                control.operating_effectiveness === 'partially_effective' ? 'Kısmen Etkin' :
                                control.operating_effectiveness === 'ineffective' ? 'Etkisiz' : 'Değerlendirilmedi'
          });
        });
      });
    });

    if (format === 'excel') {
      exportToExcel(reportData, 'Stratejik_Hedef_Iliskilendirme', 'Stratejik Hedef İlişkilendirme');
    } else {
      exportToPDF(reportData, 'Stratejik_Hedef_Iliskilendirme', 'Stratejik Hedef-İç Kontrol İlişkilendirme Raporu');
    }
  };

  const generateDepartmentPerformanceReport = async (format: 'excel' | 'pdf') => {
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name, code')
      .eq('organization_id', profile!.organization_id);

    if (!departments || departments.length === 0) {
      alert('Rapor için veri bulunamadı. Lütfen önce departman bilgilerini ekleyin.');
      return;
    }

    const reportData: any[] = [];

    for (const dept of departments || []) {
      const { data: processes } = await supabase
        .from('ic_processes')
        .select('id')
        .eq('organization_id', profile!.organization_id)
        .eq('ic_plan_id', selectedPlanId!)
        .eq('department_id', dept.id);

      const { data: actionPlans } = await supabase
        .from('ic_action_plans')
        .select('status, target_completion_date')
        .eq('organization_id', profile!.organization_id)
        .eq('ic_plan_id', selectedPlanId!)
        .eq('department_id', dept.id);

      const { data: capas } = await supabase
        .from('ic_capas')
        .select('status')
        .eq('organization_id', profile!.organization_id)
        .eq('ic_plan_id', selectedPlanId!)
        .eq('department_id', dept.id);

      const totalActionPlans = actionPlans?.length || 0;
      const completedActionPlans = actionPlans?.filter(ap => ap.status === 'completed').length || 0;
      const overdueActionPlans = actionPlans?.filter(ap =>
        ap.status !== 'completed' &&
        ap.target_completion_date &&
        new Date(ap.target_completion_date) < new Date()
      ).length || 0;

      const openCapas = capas?.filter(c => c.status === 'open' || c.status === 'in_progress').length || 0;
      const completionRate = totalActionPlans > 0 ? Math.round((completedActionPlans / totalActionPlans) * 100) : 0;

      reportData.push({
        'Departman Kodu': dept.code || '',
        'Departman Adı': dept.name,
        'Süreç Sayısı': processes?.length || 0,
        'Toplam Eylem Planı': totalActionPlans,
        'Tamamlanan Eylem Planı': completedActionPlans,
        'Tamamlanma Oranı %': completionRate,
        'Geciken Eylem Planı': overdueActionPlans,
        'Açık DÖF Sayısı': openCapas,
        'Performans Değerlendirmesi': completionRate >= 80 ? 'Mükemmel' :
                                      completionRate >= 60 ? 'İyi' :
                                      completionRate >= 40 ? 'Orta' : 'Geliştirilmeli'
      });
    }

    if (format === 'excel') {
      exportToExcel(reportData, 'Departman_Performans_Raporu', 'Departman Performansı');
    } else {
      exportToPDF(reportData, 'Departman_Performans_Raporu', 'Departman Bazlı İç Kontrol Performans Raporu');
    }
  };

  const generateRiskControlMatrixReport = async (format: 'excel' | 'pdf') => {
    const { data: risks } = await supabase
      .from('ic_risks')
      .select(`
        *,
        ic_processes(code, name),
        ic_controls(
          control_code,
          control_title,
          control_type,
          operating_effectiveness
        )
      `)
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', selectedPlanId!)
      .in('status', ['identified', 'assessed', 'mitigating', 'monitored']);

    if (!risks || risks.length === 0) {
      alert('Rapor için veri bulunamadı. Lütfen önce risk kayıtları oluşturun.');
      return;
    }

    const reportData: any[] = [];

    (risks || []).forEach(risk => {
      const controls = (risk as any).ic_controls || [];
      const controlCount = controls.length;

      if (controlCount === 0) {
        reportData.push({
          'Risk Kodu': risk.risk_code,
          'Risk Başlığı': risk.risk_title,
          'Süreç': (risk as any).ic_processes?.name || '',
          'Doğal Risk Skoru': risk.inherent_score,
          'Artık Risk Skoru': risk.residual_score,
          'Risk Azaltma %': risk.inherent_score > 0 ?
            Math.round(((risk.inherent_score - risk.residual_score) / risk.inherent_score) * 100) : 0,
          'Kontrol Sayısı': 0,
          'Kontrol Kodu': 'KONTROL YOK',
          'Kontrol Başlığı': 'Bu risk için kontrol tanımlanmamış',
          'Kontrol Tipi': '-',
          'Kontrol Etkinliği': '-',
          'Kontrol Boşluğu': 'Evet'
        });
      } else {
        controls.forEach((control: any) => {
          reportData.push({
            'Risk Kodu': risk.risk_code,
            'Risk Başlığı': risk.risk_title,
            'Süreç': (risk as any).ic_processes?.name || '',
            'Doğal Risk Skoru': risk.inherent_score,
            'Artık Risk Skoru': risk.residual_score,
            'Risk Azaltma %': risk.inherent_score > 0 ?
              Math.round(((risk.inherent_score - risk.residual_score) / risk.inherent_score) * 100) : 0,
            'Kontrol Sayısı': controlCount,
            'Kontrol Kodu': control.control_code,
            'Kontrol Başlığı': control.control_title,
            'Kontrol Tipi': control.control_type === 'preventive' ? 'Önleyici' :
                           control.control_type === 'detective' ? 'Tespit Edici' :
                           control.control_type === 'corrective' ? 'Düzeltici' : 'Yönlendirici',
            'Kontrol Etkinliği': control.operating_effectiveness === 'effective' ? 'Etkin' :
                                control.operating_effectiveness === 'partially_effective' ? 'Kısmen Etkin' :
                                control.operating_effectiveness === 'ineffective' ? 'Etkisiz' : 'Değerlendirilmedi',
            'Kontrol Boşluğu': 'Hayır'
          });
        });
      }
    });

    if (format === 'excel') {
      exportToExcel(reportData, 'Risk_Kontrol_Matrisi', 'Risk-Kontrol Matrisi');
    } else {
      exportToPDF(reportData, 'Risk_Kontrol_Matrisi', 'Risk-Kontrol İlişkilendirme Matrisi Raporu');
    }
  };

  const generateExecutiveSummaryReport = async (format: 'excel' | 'pdf') => {
    const summaryData = [
      {
        'Metrik': 'KİKS Uyumluluk Oranı',
        'Değer': `${stats.kiks_compliance}%`,
        'Durum': stats.kiks_compliance >= 80 ? 'Mükemmel' :
                 stats.kiks_compliance >= 60 ? 'İyi' :
                 stats.kiks_compliance >= 40 ? 'Orta' : 'Geliştirilmeli',
        'Açıklama': `${stats.kiks_compliance}% KİKS standartlarına uyum sağlanmıştır.`
      },
      {
        'Metrik': 'Toplam Süreç Sayısı',
        'Değer': stats.total_processes.toString(),
        'Durum': 'Bilgi',
        'Açıklama': `${stats.total_processes} aktif süreç tanımlanmıştır.`
      },
      {
        'Metrik': 'Toplam Risk Sayısı',
        'Değer': stats.total_risks.toString(),
        'Durum': 'Bilgi',
        'Açıklama': `${stats.total_risks} risk tanımlanmış, bunlardan ${stats.high_risks} tanesi yüksek seviyededir.`
      },
      {
        'Metrik': 'Yüksek Seviye Risk',
        'Değer': stats.high_risks.toString(),
        'Durum': stats.high_risks > 10 ? 'Dikkat' :
                 stats.high_risks > 5 ? 'İzlenmeli' : 'Kabul Edilebilir',
        'Açıklama': `${stats.high_risks} adet yüksek seviye risk acil aksiyona ihtiyaç duymaktadır.`
      },
      {
        'Metrik': 'Kontrol Etkinliği',
        'Değer': `${stats.control_effectiveness}%`,
        'Durum': stats.control_effectiveness >= 80 ? 'Mükemmel' :
                 stats.control_effectiveness >= 60 ? 'İyi' : 'Geliştirilmeli',
        'Açıklama': `${stats.total_controls} kontrolün ${stats.control_effectiveness}%'si etkin olarak çalışmaktadır.`
      },
      {
        'Metrik': 'Açık DÖF Sayısı',
        'Değer': stats.open_capas.toString(),
        'Durum': stats.overdue_capas > 0 ? 'Kritik' :
                 stats.open_capas > 20 ? 'Dikkat' : 'Normal',
        'Açıklama': `${stats.open_capas} açık DÖF var, bunlardan ${stats.overdue_capas} tanesi gecikmiştir.`
      },
      {
        'Metrik': 'Eylem Planı Tamamlanma',
        'Değer': stats.total_action_plans > 0 ?
          `${Math.round((stats.completed_action_plans / stats.total_action_plans) * 100)}%` : '0%',
        'Durum': stats.total_action_plans > 0 &&
                 (stats.completed_action_plans / stats.total_action_plans) >= 0.7 ? 'İyi' : 'Geliştirilmeli',
        'Açıklama': `${stats.total_action_plans} eylem planından ${stats.completed_action_plans} tanesi tamamlanmıştır.`
      },
      {
        'Metrik': 'Kritik Bulgular',
        'Değer': stats.critical_findings.toString(),
        'Durum': stats.critical_findings > 0 ? 'Kritik' : 'İyi',
        'Açıklama': `${stats.total_findings} bulguda ${stats.critical_findings} tanesi kritik seviyededir.`
      },
      {
        'Metrik': 'Test Başarı Oranı',
        'Değer': stats.total_tests > 0 ?
          `${Math.round(((stats.total_tests - stats.failed_tests) / stats.total_tests) * 100)}%` : '0%',
        'Durum': stats.total_tests > 0 &&
                 ((stats.total_tests - stats.failed_tests) / stats.total_tests) >= 0.8 ? 'Mükemmel' : 'Geliştirilmeli',
        'Açıklama': `${stats.total_tests} testin ${stats.total_tests - stats.failed_tests} tanesi başarılıdır.`
      }
    ];

    if (format === 'excel') {
      exportToExcel(summaryData, 'Yonetim_Ozet_Raporu', 'Yönetim Özeti');
    } else {
      exportToPDF(summaryData, 'Yonetim_Ozet_Raporu', 'İç Kontrol Yönetim Özet Raporu');
    }
  };

  const getComplianceLevel = (score: number) => {
    if (score >= 90) return { level: 'Mükemmel', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 75) return { level: 'İyi', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 60) return { level: 'Orta', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { level: 'Düşük', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const complianceInfo = getComplianceLevel(stats.kiks_compliance);

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                İç Kontrol Raporlarını kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">İç Kontrol Raporları</h1>
            <p className="text-sm text-gray-600">Kontrol Olgunluk Seviyesi ve Uyumluluk Raporları</p>
            {selectedPlan && (
              <p className="text-xs text-gray-500">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Card>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Yükleniyor...</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                    <Target className="w-6 h-6 text-green-600" />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${complianceInfo.bg} ${complianceInfo.color}`}>
                    {complianceInfo.level}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">KİKS Uyum Oranı</p>
                <p className="text-3xl font-bold text-gray-900">{stats.kiks_compliance}%</p>
                <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-500"
                    style={{ width: `${stats.kiks_compliance}%` }}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Kontrol Etkinliği</p>
                <p className="text-3xl font-bold text-gray-900">{stats.control_effectiveness}%</p>
                <p className="text-xs text-gray-500 mt-2">{stats.total_controls} aktif kontrol</p>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Yüksek Seviye Riskler</p>
                <p className="text-3xl font-bold text-red-600">{stats.high_risks}</p>
                <p className="text-xs text-gray-500 mt-2">Toplam {stats.total_risks} risk</p>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg">
                    <Shield className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Açık DÖF'ler</p>
                <p className="text-3xl font-bold text-gray-900">{stats.open_capas}</p>
                <p className="text-xs text-red-600 mt-2">{stats.overdue_capas} gecikmiş</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-lg">
                    <ListChecks className="w-6 h-6 text-cyan-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Eylem Planları</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_action_plans}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {stats.completed_action_plans} tamamlandı • {stats.overdue_action_plans} gecikmiş
                </p>
                <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-full transition-all duration-500"
                    style={{
                      width: `${stats.total_action_plans > 0 ? Math.round((stats.completed_action_plans / stats.total_action_plans) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-rose-100 to-rose-200 rounded-lg">
                    <Search className="w-6 h-6 text-rose-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Bulgular</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_findings}</p>
                <p className="text-xs text-rose-600 mt-2">{stats.critical_findings} kritik bulgu</p>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-teal-100 to-teal-200 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-teal-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Test Başarı Oranı</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.total_tests > 0 ? Math.round(((stats.total_tests - stats.failed_tests) / stats.total_tests) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {stats.total_tests - stats.failed_tests} / {stats.total_tests} test
                </p>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg">
                    <Award className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Genel Sağlık Skoru</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round((stats.kiks_compliance + stats.control_effectiveness +
                    (stats.total_tests > 0 ? ((stats.total_tests - stats.failed_tests) / stats.total_tests) * 100 : 0)) / 3)}%
                </p>
                <p className="text-xs text-gray-500 mt-2">İç kontrol olgunluk seviyesi</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk İstatistikleri</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Yüksek Seviye Riskler</p>
                    <p className="text-4xl font-bold text-red-600">{stats.high_risks}</p>
                    <p className="text-xs text-gray-500 mt-1">Risk skoru ≥ 15</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Toplam Risk</p>
                    <p className="text-4xl font-bold text-gray-900">{stats.total_risks}</p>
                    <p className="text-xs text-gray-500 mt-1">Aktif riskler</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Kontrol Kapsamı</p>
                    <p className="text-4xl font-bold text-blue-600">
                      {stats.total_risks > 0 ? Math.round((stats.total_controls / stats.total_risks) * 100) : 0}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Risk başına kontrol</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Kontrol Etkinliği</p>
                    <p className="text-4xl font-bold text-green-600">{stats.control_effectiveness}%</p>
                    <p className="text-xs text-gray-500 mt-1">Etkin kontroller</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Özet İstatistikler</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Süreç Sayısı</span>
                    <span className="text-lg font-semibold text-gray-900">{stats.total_processes}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Risk Sayısı</span>
                    <span className="text-lg font-semibold text-gray-900">{stats.total_risks}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Kontrol Sayısı</span>
                    <span className="text-lg font-semibold text-gray-900">{stats.total_controls}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                    <span className="text-sm text-cyan-700 font-medium">Eylem Planları</span>
                    <span className="text-lg font-semibold text-cyan-900">{stats.total_action_plans}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-200">
                    <span className="text-sm text-rose-700 font-medium">Bulgular</span>
                    <span className="text-lg font-semibold text-rose-900">{stats.total_findings}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Test Sayısı</span>
                    <span className="text-lg font-semibold text-gray-900">{stats.total_tests}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rapor Şablonları</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => generateReport('KİKS Uyumluluk')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Target className="w-5 h-5 text-green-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">KİKS Uyumluluk Raporu</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Kamu İç Kontrol Standartları uyumluluk seviyesi ve detayları
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Risk Heat Map')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <AlertTriangle className="w-5 h-5 text-red-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Risk Isı Haritası</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Organizasyon genelinde risk dağılımı ve önceliklendirme
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Kontrol Olgunluğu')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <CheckCircle className="w-5 h-5 text-blue-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Kontrol Olgunluk Raporu</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Kontrol tasarımı ve işletim etkinliği analizi
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Süreç Envanter')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <FileText className="w-5 h-5 text-purple-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Süreç Envanteri</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Tüm süreçler, sahipleri ve kritik kontrol noktaları
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('DÖF Takip')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-yellow-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Shield className="w-5 h-5 text-yellow-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">DÖF Takip Raporu</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Açık, gecikmiş ve kapatılan düzeltici faaliyetler
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Test Sonuçları')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-teal-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <TrendingUp className="w-5 h-5 text-teal-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Test Sonuçları</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Kontrol testleri ve etkinlik değerlendirmeleri
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Eylem Planı İlerleme')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-cyan-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <ListChecks className="w-5 h-5 text-cyan-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Eylem Planı İlerleme</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    KİKS eylem planlarının durumu ve tamamlanma oranları
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Bulgular Raporu')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-rose-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Search className="w-5 h-5 text-rose-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Bulgular Raporu</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Test ve denetimlerden kaynaklanan tüm bulgular
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Entegre Eylem Planı')}
                  className="p-4 border-2 border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group bg-orange-50/50"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                      <GitBranch className="w-5 h-5 text-orange-600 group-hover:text-orange-700" />
                    </div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      Entegre Eylem Planı
                      <span className="px-2 py-0.5 bg-orange-600 text-white text-xs rounded-full">YENİ</span>
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    KİKS → Kontrol → Test → Bulgu → DÖF tam entegrasyonu
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Stratejik Hedef İlişkilendirme')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Target className="w-5 h-5 text-indigo-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Stratejik Hedef İlişkilendirme</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    İç kontrolün stratejik hedeflere katkısı ve bağlantıları
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Departman Performansı')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Building2 className="w-5 h-5 text-emerald-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Departman Performansı</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Departman bazında iç kontrol başarı oranları
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Risk-Kontrol Matrisi')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-fuchsia-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Network className="w-5 h-5 text-fuchsia-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Risk-Kontrol Matrisi</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Risk ve kontrol ilişkilendirme, kontrol boşlukları analizi
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>

                <button
                  onClick={() => generateReport('Yönetim Özeti')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <Award className="w-5 h-5 text-amber-600 group-hover:text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Yönetim Özeti</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Üst yönetim için özet metrikler ve kritik noktalar
                  </p>
                  <div className="mt-3 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                    <Download className="w-4 h-4 mr-1" />
                    <span>Rapor İndir</span>
                  </div>
                </button>
              </div>
            </div>
          </Card>

          <Card className="mt-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Kontrol Ortamı Değerlendirmesi</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Kontrol Ortamı</p>
                  <p className="text-2xl font-bold text-blue-600">{Math.round(stats.kiks_compliance * 0.85)}%</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Risk Değerlendirme</p>
                  <p className="text-2xl font-bold text-green-600">{Math.round(stats.control_effectiveness * 0.90)}%</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Kontrol Faaliyetleri</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.control_effectiveness}%</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Bilgi & İletişim</p>
                  <p className="text-2xl font-bold text-yellow-600">{Math.round(stats.kiks_compliance * 0.95)}%</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">İzleme</p>
                  <p className="text-2xl font-bold text-teal-600">{Math.round((stats.control_effectiveness + stats.kiks_compliance) / 2)}%</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                COSO İç Kontrol Bileşenleri - Otomatik hesaplanan yüzdeler
              </p>
            </div>
          </Card>

          {/* Risk Heat Maps for Export - Hidden but rendered for capture */}
          {risks.length > 0 && (
            <div className="hidden">
              <div ref={inherentHeatMapRef}>
                <RiskHeatMap risks={risks} type="inherent" />
              </div>
              <div ref={residualHeatMapRef}>
                <RiskHeatMap risks={risks} type="residual" />
              </div>
            </div>
          )}
        </>
      )}

      {showFormatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Rapor Formatı Seçin</h3>
                <button
                  onClick={() => setShowFormatModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                <strong>{pendingReport}</strong> raporunu hangi formatta indirmek istersiniz?
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => downloadReport('excel')}
                  className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors mb-3">
                    <FileText className="w-8 h-8 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">Excel</span>
                  <span className="text-xs text-gray-500 mt-1">.xlsx</span>
                </button>

                <button
                  onClick={() => downloadReport('pdf')}
                  className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all group"
                >
                  <div className="p-3 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors mb-3">
                    <FileText className="w-8 h-8 text-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">PDF</span>
                  <span className="text-xs text-gray-500 mt-1">.pdf</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
