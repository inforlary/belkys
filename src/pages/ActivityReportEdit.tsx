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
  const reportId = window.location.hash.split('/')[2];

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

    let html = '<table border="1" style="width:100%; border-collapse: collapse;"><thead><tr>';
    html += '<th>Gösterge Kodu</th><th>Gösterge Adı</th><th>Hedef</th><th>Gerçekleşme</th><th>Oran (%)</th>';
    html += '</tr></thead><tbody>';

    for (const indicator of indicators) {
      const { data: entries } = await supabase
        .from('indicator_data_entries')
        .select('actual_value')
        .eq('indicator_id', indicator.id)
        .eq('status', 'admin_approved')
        .order('created_at', { ascending: false })
        .limit(1);

      const actualValue = entries && entries.length > 0 ? entries[0].actual_value : 0;
      const rate = indicator.target_value ? ((actualValue / indicator.target_value) * 100).toFixed(2) : '0';

      html += `<tr>
        <td>${indicator.code}</td>
        <td>${indicator.name}</td>
        <td>${indicator.target_value || '-'}</td>
        <td>${actualValue}</td>
        <td>${rate}%</td>
      </tr>`;
    }

    html += '</tbody></table>';
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

    let html = '<table border="1" style="width:100%; border-collapse: collapse;"><thead><tr>';
    html += '<th>Program Kodu</th><th>Program Adı</th><th>Ödenek</th><th>Harcama</th><th>Oran (%)</th>';
    html += '</tr></thead><tbody>';

    for (const program of programs) {
      html += `<tr>
        <td>${program.code}</td>
        <td>${program.name}</td>
        <td>0</td>
        <td>0</td>
        <td>0%</td>
      </tr>`;
    }

    html += '</tbody></table>';
    return html;
  };

  const fetchInternalControlData = async (sectionCode: string): Promise<string> => {
    return '<p>İç kontrol güvence beyanı buraya eklenecektir.</p>';
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
