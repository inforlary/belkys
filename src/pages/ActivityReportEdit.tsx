import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import {
  Save,
  Eye,
  Send,
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';

interface ActivityReport {
  id: string;
  organization_id: string;
  year: number;
  type: 'UNIT' | 'INSTITUTION';
  unit_id: string | null;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'UNIT_SUBMITTED' | 'CONSOLIDATING' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  completion_percentage: number;
  submission_deadline: string | null;
}

interface ReportSection {
  id: string;
  section_code: string;
  section_name: string;
  parent_section_code: string | null;
  order_index: number;
  content: any;
  html_content: string | null;
  is_auto_generated: boolean;
  auto_data_source: string | null;
  last_synced_at: string | null;
  is_locked: boolean;
  is_completed: boolean;
}

const INSTITUTION_SECTIONS = [
  { code: 'GENERAL_INFO', name: 'I. GENEL BİLGİLER', parent: null, order: 1 },
  { code: 'MISSION_VISION', name: 'A. Misyon, Vizyon, Temel Değerler', parent: 'GENERAL_INFO', order: 2, autoSource: 'strategic_plan' },
  { code: 'AUTHORITY', name: 'B. Yetki, Görev ve Sorumluluklar', parent: 'GENERAL_INFO', order: 3 },
  { code: 'ORGANIZATION', name: 'C. İdareye İlişkin Bilgiler', parent: 'GENERAL_INFO', order: 4 },
  { code: 'PHYSICAL_RESOURCES', name: '3. Fiziksel Kaynaklar', parent: 'ORGANIZATION', order: 5 },
  { code: 'HUMAN_RESOURCES', name: '5. İnsan Kaynakları', parent: 'ORGANIZATION', order: 6 },

  { code: 'GOALS_OBJECTIVES', name: 'II. AMAÇ VE HEDEFLER', parent: null, order: 7 },
  { code: 'POLICIES', name: 'A. Temel Politika ve Öncelikler', parent: 'GOALS_OBJECTIVES', order: 8, autoSource: 'strategic_plan' },
  { code: 'GOALS_LIST', name: 'B. Amaç ve Hedefler', parent: 'GOALS_OBJECTIVES', order: 9, autoSource: 'strategic_plan' },
  { code: 'PERFORMANCE_RESULTS', name: 'C. Performans Sonuçları', parent: 'GOALS_OBJECTIVES', order: 10, autoSource: 'performance_program' },
  { code: 'PERFORMANCE_ANALYSIS', name: 'D. Performans Sonuçlarının Değerlendirilmesi', parent: 'GOALS_OBJECTIVES', order: 11 },

  { code: 'ACTIVITIES_INFO', name: 'III. FAALİYETLERE İLİŞKİN BİLGİ VE DEĞERLENDİRMELER', parent: null, order: 12 },
  { code: 'BUDGET_INFO', name: 'A. Mali Bilgiler', parent: 'ACTIVITIES_INFO', order: 13, autoSource: 'budget' },
  { code: 'BUDGET_EXECUTION', name: '1. Bütçe Uygulama Sonuçları', parent: 'BUDGET_INFO', order: 14, autoSource: 'budget' },
  { code: 'ACTIVITIES_SUMMARY', name: 'B. Performans Bilgileri', parent: 'ACTIVITIES_INFO', order: 15 },

  { code: 'ASSESSMENT', name: 'IV. KURUMSAL KABİLİYET VE KAPASİTENİN DEĞERLENDİRİLMESİ', parent: null, order: 16 },
  { code: 'STRENGTHS', name: 'A. Üstünlükler', parent: 'ASSESSMENT', order: 17, autoSource: 'strategic_plan' },
  { code: 'WEAKNESSES', name: 'B. Zayıflıklar', parent: 'ASSESSMENT', order: 18, autoSource: 'strategic_plan' },

  { code: 'RECOMMENDATIONS', name: 'V. ÖNERİ VE TEDBİRLER', parent: null, order: 19 },

  { code: 'ANNEXES', name: 'EKLER', parent: null, order: 20 },
  { code: 'IC_ASSURANCE', name: 'İç Kontrol Güvence Beyanı', parent: 'ANNEXES', order: 21, autoSource: 'internal_control' },
];

const UNIT_SECTIONS = [
  { code: 'UNIT_INTRO', name: '1. Birim Tanıtımı', parent: null, order: 1 },
  { code: 'UNIT_GOALS', name: '2. Birim Hedefleri ve Gerçekleşmeleri', parent: null, order: 2, autoSource: 'performance_program' },
  { code: 'UNIT_ACTIVITIES', name: '3. Birim Faaliyetleri', parent: null, order: 3 },
  { code: 'UNIT_BUDGET', name: '4. Bütçe Kullanımı', parent: null, order: 4, autoSource: 'budget' },
  { code: 'UNIT_ISSUES', name: '5. Sorunlar ve Öneriler', parent: null, order: 5 },
  { code: 'UNIT_ASSURANCE', name: '6. Birim Güvence Beyanı', parent: null, order: 6, autoSource: 'internal_control' },
];

export default function ActivityReportEdit() {
  const { profile } = useAuth();
  const { navigate, searchParams } = useLocation();
  const hash = window.location.hash.replace(/^#\/?/, '');
  const reportId = hash.split('/')[1];

  const [report, setReport] = useState<ActivityReport | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<ReportSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [editContent, setEditContent] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  useEffect(() => {
    if (profile && reportId) {
      loadReport();
    }
  }, [profile, reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);

      const { data: reportData, error: reportError } = await supabase
        .from('activity_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError) throw reportError;
      setReport(reportData);

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_id', reportId)
        .order('order_index');

      if (sectionsError) throw sectionsError;

      if (!sectionsData || sectionsData.length === 0) {
        await initializeSections(reportData);
      } else {
        setSections(sectionsData);
        setSelectedSection(sectionsData[0]);
        setEditContent(sectionsData[0].html_content || '');
      }
    } catch (error: any) {
      console.error('Error loading report:', error);
      alert('Rapor yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeSections = async (reportData: ActivityReport) => {
    try {
      const { data: existingSections, error: checkError } = await supabase
        .from('report_sections')
        .select('id, section_code')
        .eq('report_id', reportId);

      if (checkError) throw checkError;

      if (existingSections && existingSections.length > 0) {
        const { data: allSections, error: loadError } = await supabase
          .from('report_sections')
          .select('*')
          .eq('report_id', reportId)
          .order('order_index');

        if (loadError) throw loadError;

        setSections(allSections || []);
        if (allSections && allSections.length > 0) {
          setSelectedSection(allSections[0]);
          setEditContent(allSections[0].html_content || '');
        }
        return;
      }

      const sectionTemplates = reportData.type === 'INSTITUTION' ? INSTITUTION_SECTIONS : UNIT_SECTIONS;

      const newSections = sectionTemplates.map(template => ({
        organization_id: profile!.organization_id,
        report_id: reportId,
        section_code: template.code,
        section_name: template.name,
        parent_section_code: template.parent,
        order_index: template.order,
        content: {},
        html_content: '',
        is_auto_generated: !!template.autoSource,
        auto_data_source: template.autoSource || null,
        is_locked: false,
        is_completed: false,
      }));

      const { data, error } = await supabase
        .from('report_sections')
        .insert(newSections)
        .select();

      if (error) throw error;

      setSections(data);
      setSelectedSection(data[0]);
      setEditContent(data[0].html_content || '');
    } catch (error: any) {
      console.error('Error initializing sections:', error);
      alert('Bölümler oluşturulurken hata oluştu: ' + error.message);
    }
  };

  const handleSectionSelect = (section: ReportSection) => {
    if (saving) return;

    setSelectedSection(section);
    setEditContent(section.html_content || '');
  };

  const handleSaveSection = async () => {
    if (!selectedSection) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('report_sections')
        .update({
          html_content: editContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSection.id);

      if (error) throw error;

      const updatedSections = sections.map(s =>
        s.id === selectedSection.id
          ? { ...s, html_content: editContent }
          : s
      );
      setSections(updatedSections);

      alert('Bölüm kaydedildi');
    } catch (error: any) {
      console.error('Error saving section:', error);
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async () => {
    if (!selectedSection) return;

    try {
      const newStatus = !selectedSection.is_completed;

      const { error } = await supabase
        .from('report_sections')
        .update({
          is_completed: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSection.id);

      if (error) throw error;

      const updatedSections = sections.map(s =>
        s.id === selectedSection.id
          ? { ...s, is_completed: newStatus }
          : s
      );
      setSections(updatedSections);
      setSelectedSection({ ...selectedSection, is_completed: newStatus });

      loadReport();
    } catch (error: any) {
      console.error('Error toggling complete:', error);
      alert('Durum güncellenirken hata oluştu: ' + error.message);
    }
  };

  const handleSyncAutoData = async () => {
    if (!selectedSection || !selectedSection.auto_data_source) return;

    try {
      setSyncing(true);

      let autoContent = '';

      switch (selectedSection.auto_data_source) {
        case 'strategic_plan':
          autoContent = await fetchStrategicPlanData(selectedSection.section_code);
          break;
        case 'performance_program':
          autoContent = await fetchPerformanceData(selectedSection.section_code);
          break;
        case 'budget':
          autoContent = await fetchBudgetData(selectedSection.section_code);
          break;
        case 'internal_control':
          autoContent = await fetchInternalControlData(selectedSection.section_code);
          break;
      }

      const { error } = await supabase
        .from('report_sections')
        .update({
          html_content: autoContent,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSection.id);

      if (error) throw error;

      setEditContent(autoContent);
      alert('Veriler senkronize edildi');
      loadReport();
    } catch (error: any) {
      console.error('Error syncing data:', error);
      alert('Senkronizasyon hatası: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const fetchStrategicPlanData = async (sectionCode: string): Promise<string> => {
    const { data: plans } = await supabase
      .from('strategic_plans')
      .select('*, organizations(name, mission, vision)')
      .eq('organization_id', profile!.organization_id)
      .eq('year', report!.year)
      .maybeSingle();

    if (!plans) return '<p>Stratejik plan verisi bulunamadı.</p>';

    if (sectionCode === 'MISSION_VISION') {
      return `
        <h3>Misyon</h3>
        <p>${plans.organizations?.mission || 'Belirtilmemiş'}</p>
        <h3>Vizyon</h3>
        <p>${plans.organizations?.vision || 'Belirtilmemiş'}</p>
      `;
    }

    if (sectionCode === 'STRENGTHS' || sectionCode === 'WEAKNESSES') {
      const { data: swot } = await supabase
        .from('swot_analyses')
        .select('*')
        .eq('organization_id', profile!.organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (swot && sectionCode === 'STRENGTHS') {
        return `<ul>${(swot.strengths || []).map((s: string) => `<li>${s}</li>`).join('')}</ul>`;
      }
      if (swot && sectionCode === 'WEAKNESSES') {
        return `<ul>${(swot.weaknesses || []).map((w: string) => `<li>${w}</li>`).join('')}</ul>`;
      }
    }

    return '<p>Veri henüz yüklenmedi.</p>';
  };

  const fetchPerformanceData = async (sectionCode: string): Promise<string> => {
    const { data: indicators } = await supabase
      .from('indicators')
      .select(`
        *,
        objectives(name, goals(name))
      `)
      .eq('organization_id', profile!.organization_id)
      .order('code');

    if (!indicators || indicators.length === 0) {
      return '<p>Performans göstergesi bulunamadı.</p>';
    }

    let html = '<h3>Performans Göstergeleri Tablosu</h3>';
    html += '<table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 30px;"><thead><tr>';
    html += '<th>Gösterge Kodu</th><th>Gösterge Adı</th><th>Hedef</th><th>Gerçekleşme</th><th>Gerçekleşme Oranı (%)</th><th>Sapma</th><th>Sapma Yüzdesi (%)</th>';
    html += '</tr></thead><tbody>';

    const deviations: Array<{name: string; deviation: number; deviationPercent: number; target: number; actual: number}> = [];

    for (const indicator of indicators) {
      const { data: entries } = await supabase
        .from('indicator_data_entries')
        .select('actual_value')
        .eq('indicator_id', indicator.id)
        .eq('status', 'admin_approved')
        .order('created_at', { ascending: false })
        .limit(1);

      const actualValue = entries && entries.length > 0 ? entries[0].actual_value : 0;
      const targetValue = indicator.target_value !== null && indicator.target_value !== undefined ? indicator.target_value : 0;
      const rate = targetValue > 0 ? ((actualValue / targetValue) * 100).toFixed(2) : '0';
      const deviation = actualValue - targetValue;
      const deviationPercent = targetValue > 0 ? (((actualValue - targetValue) / targetValue) * 100).toFixed(2) : '0';

      const deviationColor = deviation >= 0 ? 'green' : 'red';

      html += `<tr>
        <td>${indicator.code}</td>
        <td>${indicator.name}</td>
        <td>${targetValue.toLocaleString('tr-TR')}</td>
        <td>${actualValue.toLocaleString('tr-TR')}</td>
        <td>${rate}%</td>
        <td style="color: ${deviationColor}; font-weight: bold;">${deviation >= 0 ? '+' : ''}${deviation.toLocaleString('tr-TR')}</td>
        <td style="color: ${deviationColor}; font-weight: bold;">${deviationPercent >= 0 ? '+' : ''}${deviationPercent}%</td>
      </tr>`;

      if (Math.abs(parseFloat(deviationPercent)) > 10) {
        deviations.push({
          name: indicator.name,
          deviation,
          deviationPercent: parseFloat(deviationPercent),
          target: targetValue,
          actual: actualValue
        });
      }
    }

    html += '</tbody></table>';

    if (deviations.length > 0) {
      html += '<h3>Sapma Analizleri</h3>';
      html += '<p>Hedeften %10\'dan fazla sapma gösteren göstergeler için detaylı analiz:</p>';
      html += '<ul style="list-style-type: disc; margin-left: 20px;">';

      for (const dev of deviations) {
        const status = dev.deviationPercent > 0 ? 'hedefi aşmıştır' : 'hedefe ulaşamamıştır';
        const reason = dev.deviationPercent > 0
          ? 'Bu durum, planlanan faaliyetlerin beklenenden daha etkili gerçekleştirildiğini göstermektedir.'
          : 'Bu durumun nedenleri arasında kaynak yetersizliği, dış faktörler veya planlama eksiklikleri bulunabilir.';

        html += `<li><strong>${dev.name}:</strong> Hedeflenen ${dev.target.toLocaleString('tr-TR')} değere karşılık ${dev.actual.toLocaleString('tr-TR')} gerçekleşme ile %${Math.abs(dev.deviationPercent).toFixed(2)} ${status}. ${reason}</li>`;
      }

      html += '</ul>';
    } else {
      html += '<h3>Sapma Analizleri</h3>';
      html += '<p>Tüm göstergeler kabul edilebilir sapma aralığında (%±10) gerçekleşmiştir.</p>';
    }

    return html;
  };

  const fetchBudgetData = async (sectionCode: string): Promise<string> => {
    const { data: programs } = await supabase
      .from('programs')
      .select('*')
      .eq('organization_id', profile!.organization_id)
      .order('code');

    if (!programs || programs.length === 0) {
      return '<p>Bütçe verisi bulunamadı.</p>';
    }

    let html = '<h3>Bütçe Uygulama Sonuçları</h3>';
    html += '<table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 30px;"><thead><tr>';
    html += '<th>Program Kodu</th><th>Program Adı</th><th>Ödenek (TL)</th><th>Harcama (TL)</th><th>Kullanım Oranı (%)</th><th>Kalan Ödenek (TL)</th>';
    html += '</tr></thead><tbody>';

    let totalAllocation = 0;
    let totalExpense = 0;

    for (const program of programs) {
      const { data: expenseEntries } = await supabase
        .from('expense_budget_entries')
        .select('allocated_amount, expense_amount')
        .eq('organization_id', profile!.organization_id)
        .eq('program_id', program.id);

      let programAllocation = 0;
      let programExpense = 0;

      if (expenseEntries && expenseEntries.length > 0) {
        programAllocation = expenseEntries.reduce((sum, entry) => sum + (entry.allocated_amount || 0), 0);
        programExpense = expenseEntries.reduce((sum, entry) => sum + (entry.expense_amount || 0), 0);
      }

      const utilizationRate = programAllocation > 0 ? ((programExpense / programAllocation) * 100).toFixed(2) : '0';
      const remainingAllocation = programAllocation - programExpense;

      totalAllocation += programAllocation;
      totalExpense += programExpense;

      html += `<tr>
        <td>${program.code}</td>
        <td>${program.name}</td>
        <td>${programAllocation.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${programExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${utilizationRate}%</td>
        <td>${remainingAllocation.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`;
    }

    const totalUtilizationRate = totalAllocation > 0 ? ((totalExpense / totalAllocation) * 100).toFixed(2) : '0';
    const totalRemaining = totalAllocation - totalExpense;

    html += `<tr style="font-weight: bold; background-color: #f3f4f6;">
      <td colspan="2">TOPLAM</td>
      <td>${totalAllocation.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>${totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>${totalUtilizationRate}%</td>
      <td>${totalRemaining.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`;

    html += '</tbody></table>';

    const { data: revenueEntries } = await supabase
      .from('revenue_budget_entries')
      .select('estimated_amount, realized_amount')
      .eq('organization_id', profile!.organization_id);

    if (revenueEntries && revenueEntries.length > 0) {
      const totalEstimatedRevenue = revenueEntries.reduce((sum, entry) => sum + (entry.estimated_amount || 0), 0);
      const totalRealizedRevenue = revenueEntries.reduce((sum, entry) => sum + (entry.realized_amount || 0), 0);
      const revenueRealizationRate = totalEstimatedRevenue > 0 ? ((totalRealizedRevenue / totalEstimatedRevenue) * 100).toFixed(2) : '0';

      html += '<h3>Gelir Tahsilatı</h3>';
      html += '<table border="1" style="width:100%; border-collapse: collapse;"><thead><tr>';
      html += '<th>Tahmini Gelir (TL)</th><th>Tahsil Edilen (TL)</th><th>Tahsilat Oranı (%)</th>';
      html += '</tr></thead><tbody>';
      html += `<tr>
        <td>${totalEstimatedRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${totalRealizedRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${revenueRealizationRate}%</td>
      </tr></tbody></table>`;
    }

    return html;
  };

  const fetchInternalControlData = async (sectionCode: string): Promise<string> => {
    const { data: icPlans } = await supabase
      .from('ic_plans')
      .select('*')
      .eq('organization_id', profile!.organization_id)
      .eq('fiscal_year', report!.year)
      .maybeSingle();

    if (!icPlans) {
      return '<p>Bu dönem için iç kontrol planı bulunamadı.</p>';
    }

    const { data: assessments } = await supabase
      .from('ic_assessments')
      .select('*')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', icPlans.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: actionPlans } = await supabase
      .from('ic_action_plans')
      .select('*')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', icPlans.id);

    const { data: controlTests } = await supabase
      .from('ic_control_tests')
      .select('test_result')
      .eq('organization_id', profile!.organization_id)
      .eq('ic_plan_id', icPlans.id);

    const completedActions = actionPlans?.filter(a => a.status === 'completed').length || 0;
    const totalActions = actionPlans?.length || 0;
    const actionCompletionRate = totalActions > 0 ? ((completedActions / totalActions) * 100).toFixed(2) : '0';

    const passedTests = controlTests?.filter(t => t.test_result === 'effective').length || 0;
    const totalTests = controlTests?.length || 0;
    const testSuccessRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : '0';

    let html = '<h3>İÇ KONTROL GÜVENCE BEYANI</h3>';
    html += '<p style="text-align: justify; line-height: 1.8; margin-bottom: 20px;">';
    html += `${report!.year} yılı faaliyet sonuçlarına ilişkin olarak; harcama birimlerinin ürettikleri bilgiler esas alınmak suretiyle `;
    html += 'hazırlanan iç kontrol güvence beyanı çerçevesinde aşağıdaki hususlar değerlendirilmiştir:';
    html += '</p>';

    html += '<h4 style="margin-top: 20px;">1. İç Kontrol Sistemi Değerlendirmesi</h4>';
    html += '<p style="text-align: justify; line-height: 1.8;">';

    if (assessments) {
      const overallScore = assessments.overall_score || 0;
      let assessmentLevel = 'Geliştirilmeli';
      if (overallScore >= 80) assessmentLevel = 'İyi';
      else if (overallScore >= 60) assessmentLevel = 'Orta';

      html += `İdaremizde iç kontrol sistemi ${report!.year} yılında yapılan değerlendirme sonucunda %${overallScore} genel puan ile `;
      html += `<strong>"${assessmentLevel}"</strong> seviyesinde bulunmuştur. `;
    } else {
      html += 'İdaremizde iç kontrol sistemi mevcut olmakla birlikte, yapılan değerlendirmeler neticesinde iyileştirme gerektiren alanlar tespit edilmiştir. ';
    }

    html += 'Mali yönetim ve kontrol süreçlerimiz, 5018 sayılı Kamu Mali Yönetimi ve Kontrol Kanunu ile İç Kontrol ve Ön Mali Kontrole İlişkin Usul ve Esaslar çerçevesinde yürütülmektedir.';
    html += '</p>';

    html += '<h4 style="margin-top: 20px;">2. Tespit Edilen Aksaklıklar ve Alınan Tedbirler</h4>';
    html += '<p style="text-align: justify; line-height: 1.8;">';
    html += `Raporlama döneminde toplam ${totalActions} adet aksiyon planı tespit edilmiş olup, bunlardan ${completedActions} adedi (%${actionCompletionRate}) tamamlanmıştır. `;

    if (parseFloat(actionCompletionRate) >= 80) {
      html += 'İyileştirme faaliyetlerimiz planlanan şekilde gerçekleştirilmiş ve iç kontrol sistemimizin etkinliği artırılmıştır.';
    } else if (parseFloat(actionCompletionRate) >= 50) {
      html += 'İyileştirme faaliyetlerimiz devam etmekte olup, gelecek dönemde tamamlanması hedeflenmektedir.';
    } else {
      html += 'Tespit edilen eksikliklerin giderilmesi için gerekli aksiyonlar alınmış ve takibi yapılmaktadır.';
    }
    html += '</p>';

    html += '<h4 style="margin-top: 20px;">3. Kontrol Faaliyetleri</h4>';
    html += '<p style="text-align: justify; line-height: 1.8;">';
    html += `${report!.year} yılında toplam ${totalTests} adet kontrol testi gerçekleştirilmiş olup, ${passedTests} adedi (%${testSuccessRate}) etkin olarak değerlendirilmiştir. `;
    html += 'Kontrol faaliyetlerimiz düzenli olarak gözden geçirilmekte ve gerekli iyileştirmeler yapılmaktadır.';
    html += '</p>';

    html += '<h4 style="margin-top: 20px;">4. İzleme Faaliyetleri</h4>';
    html += '<p style="text-align: justify; line-height: 1.8;">';
    html += 'İç kontrol sisteminin işleyişi düzenli olarak izlenmekte ve değerlendirilmektedir. İç Kontrol İzleme ve Yönlendirme Kurulu toplantıları düzenli olarak yapılmakta, ';
    html += 'tespit edilen eksikliklerin giderilmesi için gerekli tedbirler alınmaktadır.';
    html += '</p>';

    html += '<div style="margin-top: 40px; padding: 20px; border: 1px solid #ccc; background-color: #f9f9f9;">';
    html += '<p style="text-align: justify; line-height: 1.8; font-style: italic;">';
    html += 'Yukarıda belirtilen hususlar dikkate alındığında, idaremizin iç kontrol sisteminin genel olarak ';

    if (parseFloat(testSuccessRate) >= 80 && parseFloat(actionCompletionRate) >= 80) {
      html += '<strong>yeterli düzeyde</strong> olduğu, ancak sürekli iyileştirme ilkesi gereğince çalışmaların devam ettiği ';
    } else if (parseFloat(testSuccessRate) >= 60 && parseFloat(actionCompletionRate) >= 60) {
      html += '<strong>kabul edilebilir düzeyde</strong> olduğu, belirli alanlarda iyileştirme çalışmalarının sürdürüldüğü ';
    } else {
      html += '<strong>geliştirilmeye muhtaç</strong> olduğu ve bu doğrultuda kapsamlı iyileştirme faaliyetlerinin yürütüldüğü ';
    }

    html += 'değerlendirilmektedir.';
    html += '</p>';
    html += '</div>';

    return html;
  };

  const handleSubmitReport = async () => {
    if (!report) return;

    try {
      const { error } = await supabase
        .from('activity_reports')
        .update({
          status: report.type === 'UNIT' ? 'UNIT_SUBMITTED' : 'REVIEW',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      alert('Rapor başarıyla gönderildi');
      navigate('activity-reports');
    } catch (error: any) {
      console.error('Error submitting report:', error);
      alert('Rapor gönderilirken hata oluştu: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Rapor Bulunamadı</h2>
        <Button onClick={() => navigate('activity-reports')} className="mt-4">
          Raporlara Dön
        </Button>
      </div>
    );
  }

  const completedSections = sections.filter(s => s.is_completed).length;
  const totalSections = sections.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate('activity-reports')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{report.title}</h1>
            <p className="text-gray-600">{report.year} - Rapor Düzenleme</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={report.status} label={report.status} />
          <Button
            variant="secondary"
            onClick={() => navigate(`activity-reports/${reportId}`)}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Önizle
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-2">
                Tamamlanan Bölümler: {completedSections} / {totalSections}
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-2 w-64">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${report.completion_percentage}%` }}
                ></div>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              %{report.completion_percentage}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3">
          <Card>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Rapor Bölümleri</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionSelect(section)}
                  className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                    selectedSection?.id === section.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  } ${section.parent_section_code ? 'pl-6 text-sm' : 'font-medium'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex-1">{section.section_name}</span>
                    <div className="flex items-center gap-2">
                      {section.is_auto_generated && (
                        <RefreshCw className="w-3 h-3 text-blue-500" />
                      )}
                      {section.is_completed && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {section.is_locked && (
                        <Lock className="w-3 h-3 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-9">
          <Card>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedSection?.section_name}
                  </h3>
                  {selectedSection?.auto_data_source && (
                    <p className="text-sm text-blue-600 mt-1">
                      Otomatik Veri Kaynağı: {selectedSection.auto_data_source}
                      {selectedSection.last_synced_at && (
                        <span className="text-gray-500 ml-2">
                          (Son senkronizasyon: {new Date(selectedSection.last_synced_at).toLocaleString('tr-TR')})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedSection?.is_auto_generated && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSyncAutoData}
                      disabled={syncing}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      Senkronize Et
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleToggleComplete}
                    className="flex items-center gap-2"
                  >
                    {selectedSection?.is_completed ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Tamamlandı
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        Tamamlanmadı
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleSaveSection}
                    disabled={saving || selectedSection?.is_locked}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={selectedSection?.is_locked}
                rows={20}
                className="w-full border border-gray-300 rounded-lg p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Bölüm içeriğini buraya yazın veya HTML formatında girin..."
              />
            </div>
          </Card>

          {report.status === 'DRAFT' && (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setIsSubmitModalOpen(true)}
                disabled={completedSections < totalSections}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Raporu Gönder
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Raporu Gönder"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Raporu göndermek istediğinizden emin misiniz? Gönderildikten sonra düzenleyemezsiniz.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Tamamlanma Durumu:</strong> {completedSections} / {totalSections} bölüm tamamlandı
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>İlerleme:</strong> %{report.completion_percentage}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsSubmitModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmitReport}>
              Onayla ve Gönder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
