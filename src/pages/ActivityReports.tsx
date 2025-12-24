import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ReportComments from '../components/activity-reports/ReportComments';
import DeadlineWarning from '../components/activity-reports/DeadlineWarning';
import VersionHistory from '../components/activity-reports/VersionHistory';
import TemplateSelector from '../components/activity-reports/TemplateSelector';
import EnhancedReportEditor from '../components/activity-reports/EnhancedReportEditor';
import MarkdownRenderer from '../components/activity-reports/MarkdownRenderer';
import TableRenderer from '../components/activity-reports/TableRenderer';
import {
  Search,
  Edit2,
  FileText,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Calendar,
  MessageSquare,
  History,
  AlertCircle,
} from 'lucide-react';

interface Indicator {
  id: string;
  code: string;
  name: string;
  target_value: number | null;
  unit: string | null;
}

interface Report {
  id: string;
  indicator_id: string;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  content: any;
  rejection_reason?: string;
  rejection_count: number;
  submitted_at?: string;
  approved_at?: string;
  version: number;
  template_id?: string;
  period_quarter?: number;
  period_month?: number;
}

interface Deadline {
  deadline_date: string;
  period_type: string;
  period_year: number;
  period_quarter?: number;
  period_month?: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  sections: any[];
}

export default function ActivityReports() {
  const { profile, user } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [deadlines, setDeadlines] = useState<Record<string, Deadline>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<'yearly' | 'quarterly' | 'monthly'>('yearly');
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [editData, setEditData] = useState({
    title: '',
    content: { text: '', images: [], tables: [] },
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile, selectedYear, selectedPeriod, selectedQuarter, selectedMonth]);

  const loadData = async () => {
    if (!profile?.organization_id || !profile?.department_id) return;

    try {
      setLoading(true);

      // Load indicators
      let indicatorsQuery = supabase
        .from('indicators')
        .select(`
          id,
          code,
          name,
          target_value,
          unit,
          goal:goals!inner(department_id)
        `)
        .eq('organization_id', profile.organization_id)
        .order('code');

      if (profile.role !== 'admin') {
        indicatorsQuery = indicatorsQuery.eq('goal.department_id', profile.department_id);
      }

      const { data: indicatorsData } = await indicatorsQuery;

      // Load reports
      let reportsQuery = supabase
        .from('activity_reports')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('period_year', selectedYear);

      if (selectedPeriod === 'quarterly' && selectedQuarter) {
        reportsQuery = reportsQuery.eq('period_quarter', selectedQuarter);
      } else if (selectedPeriod === 'monthly' && selectedMonth) {
        reportsQuery = reportsQuery.eq('period_month', selectedMonth);
      }

      if (profile.role !== 'admin') {
        reportsQuery = reportsQuery.eq('department_id', profile.department_id);
      }

      const { data: reportsData } = await reportsQuery;

      // Load deadlines
      let deadlinesQuery = supabase
        .from('activity_report_deadlines')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('period_year', selectedYear)
        .eq('period_type', selectedPeriod)
        .eq('is_active', true);

      if (selectedPeriod === 'quarterly' && selectedQuarter) {
        deadlinesQuery = deadlinesQuery.eq('period_quarter', selectedQuarter);
      } else if (selectedPeriod === 'monthly' && selectedMonth) {
        deadlinesQuery = deadlinesQuery.eq('period_month', selectedMonth);
      }

      const { data: deadlinesData } = await deadlinesQuery;

      setIndicators(indicatorsData || []);

      const reportsMap: Record<string, Report> = {};
      (reportsData || []).forEach((report) => {
        reportsMap[report.indicator_id] = report;
      });
      setReports(reportsMap);

      const deadlinesMap: Record<string, Deadline> = {};
      (deadlinesData || []).forEach((deadline) => {
        const key = deadline.department_id || 'all';
        deadlinesMap[key] = deadline;
      });
      setDeadlines(deadlinesMap);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (indicator: Indicator) => {
    const report = reports[indicator.id];

    if (report && report.status !== 'draft' && profile?.role !== 'admin') {
      alert('Sadece taslak durumundaki raporları düzenleyebilirsiniz');
      return;
    }

    setSelectedIndicator(indicator);

    let content = { text: '', images: [], tables: [] };
    if (report?.content) {
      if (typeof report.content === 'string') {
        content = { text: report.content, images: [], tables: [] };
      } else {
        content = {
          text: report.content.text || report.content.description || '',
          images: report.content.images || [],
          tables: report.content.tables || []
        };
      }
    }

    setEditData({
      title: report?.title || `${indicator.code} - ${indicator.name} Raporu`,
      content,
    });
    setIsEditModalOpen(true);
  };

  const handleView = (indicator: Indicator) => {
    const report = reports[indicator.id];
    if (!report) return;

    setSelectedIndicator(indicator);

    let content = { text: '', images: [], tables: [] };
    if (report.content) {
      if (typeof report.content === 'string') {
        content = { text: report.content, images: [], tables: [] };
      } else {
        content = {
          text: report.content.text || report.content.description || '',
          images: report.content.images || [],
          tables: report.content.tables || []
        };
      }
    }

    setEditData({
      title: report.title,
      content,
    });
    setIsViewModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedIndicator || !profile) return;

    try {
      const report = reports[selectedIndicator.id];
      const content = editData.content;

      if (report) {
        // Update existing report
        const { error } = await supabase
          .from('activity_reports')
          .update({
            title: editData.title,
            content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', report.id);

        if (error) throw error;

        // Create version
        await supabase.from('activity_report_versions').insert([{
          report_id: report.id,
          version_number: report.version + 1,
          title: editData.title,
          content,
          changed_by: user?.id,
          change_description: 'Rapor güncellendi',
        }]);

        // Update version number
        await supabase
          .from('activity_reports')
          .update({ version: report.version + 1 })
          .eq('id', report.id);
      } else {
        // Create new report
        const { data: newReport, error } = await supabase
          .from('activity_reports')
          .insert([{
            organization_id: profile.organization_id,
            department_id: profile.department_id,
            indicator_id: selectedIndicator.id,
            title: editData.title,
            period_year: selectedYear,
            period_quarter: selectedPeriod === 'quarterly' ? selectedQuarter : null,
            period_month: selectedPeriod === 'monthly' ? selectedMonth : null,
            content,
            template_id: selectedTemplate?.id,
            created_by: user?.id,
            status: 'draft',
            version: 1,
          }])
          .select()
          .single();

        if (error) throw error;

        // Create initial version
        if (newReport) {
          await supabase.from('activity_report_versions').insert([{
            report_id: newReport.id,
            version_number: 1,
            title: editData.title,
            content,
            changed_by: user?.id,
            change_description: 'İlk versiyon',
          }]);
        }
      }

      setIsEditModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      alert('Rapor kaydedilirken bir hata oluştu');
    }
  };

  const handleSubmit = async (indicatorId: string) => {
    const report = reports[indicatorId];
    if (!report) return;

    if (!confirm('Raporu göndermek istediğinizden emin misiniz? Gönderildikten sonra düzenleyemezsiniz.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('activity_reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      if (error) throw error;

      // Create notification for admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', profile?.organization_id)
        .eq('role', 'admin');

      if (admins) {
        await supabase.from('activity_report_notifications').insert(
          admins.map(admin => ({
            organization_id: profile?.organization_id,
            user_id: admin.id,
            report_id: report.id,
            notification_type: 'submitted',
            title: 'Yeni Rapor Gönderildi',
            message: `${profile?.full_name} tarafından ${report.title} raporu gönderildi.`,
          }))
        );
      }

      loadData();
    } catch (error) {
      console.error('Gönderme hatası:', error);
      alert('Rapor gönderilirken bir hata oluştu');
    }
  };

  const handleApprove = async (indicatorId: string) => {
    const report = reports[indicatorId];
    if (!report || profile?.role !== 'admin') return;

    if (!confirm('Raporu onaylamak istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('activity_reports')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', report.id);

      if (error) throw error;

      // Notification
      await supabase.from('activity_report_notifications').insert([{
        organization_id: profile.organization_id,
        user_id: report.created_by,
        report_id: report.id,
        notification_type: 'approved',
        title: 'Rapor Onaylandı',
        message: `${report.title} raporunuz onaylandı.`,
      }]);

      loadData();
    } catch (error) {
      console.error('Onay hatası:', error);
    }
  };

  const handleReject = async (indicatorId: string, reason: string) => {
    const report = reports[indicatorId];
    if (!report || profile?.role !== 'admin') return;

    try {
      const { error } = await supabase
        .from('activity_reports')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejection_count: report.rejection_count + 1,
        })
        .eq('id', report.id);

      if (error) throw error;

      // Notification
      await supabase.from('activity_report_notifications').insert([{
        organization_id: profile.organization_id,
        user_id: report.created_by,
        report_id: report.id,
        notification_type: 'rejected',
        title: 'Rapor Reddedildi',
        message: `${report.title} raporunuz reddedildi: ${reason}`,
      }]);

      loadData();
    } catch (error) {
      console.error('Red hatası:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { icon: Edit2, text: 'Taslak', class: 'bg-gray-100 text-gray-800' },
      submitted: { icon: Clock, text: 'Gönderildi', class: 'bg-blue-100 text-blue-800' },
      approved: { icon: CheckCircle, text: 'Onaylandı', class: 'bg-green-100 text-green-800' },
      rejected: { icon: XCircle, text: 'Reddedildi', class: 'bg-red-100 text-red-800' },
    };

    const badge = badges[status as keyof typeof badges];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  const filteredIndicators = indicators.filter(indicator => {
    const matchesSearch = indicator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         indicator.code.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const report = reports[indicator.id];
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return !report || report.status === 'draft';
    return report?.status === statusFilter;
  });

  const getDeadline = () => {
    return deadlines[profile?.department_id || ''] || deadlines['all'] || null;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Faaliyet Raporlarım</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gösterge bazlı faaliyet raporlarınızı oluşturun ve yönetin
        </p>
      </div>

      <DeadlineWarning
        deadline={getDeadline()}
        hasReport={Object.keys(reports).length > 0}
        reportStatus={Object.values(reports)[0]?.status}
      />

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="h-4 w-4 inline mr-1" />
                Yıl
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dönem
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value as any);
                  setSelectedQuarter(null);
                  setSelectedMonth(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="yearly">Yıllık</option>
                <option value="quarterly">Çeyreklik</option>
                <option value="monthly">Aylık</option>
              </select>
            </div>

            {selectedPeriod === 'quarterly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Çeyrek
                </label>
                <select
                  value={selectedQuarter || ''}
                  onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  <option value="1">Q1 (Ocak-Mart)</option>
                  <option value="2">Q2 (Nisan-Haziran)</option>
                  <option value="3">Q3 (Temmuz-Eylül)</option>
                  <option value="4">Q4 (Ekim-Aralık)</option>
                </select>
              </div>
            )}

            {selectedPeriod === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ay
                </label>
                <select
                  value={selectedMonth || ''}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleString('tr-TR', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tümü</option>
                <option value="pending">Bekleyen</option>
                <option value="draft">Taslak</option>
                <option value="submitted">Gönderildi</option>
                <option value="approved">Onaylandı</option>
                <option value="rejected">Reddedildi</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Gösterge ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {filteredIndicators.map((indicator) => {
          const report = reports[indicator.id];

          return (
            <Card key={indicator.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {indicator.code}
                      </span>
                      <h3 className="font-semibold text-gray-900">{indicator.name}</h3>
                    </div>

                    {report && (
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        {getStatusBadge(report.status)}
                        <span className="flex items-center">
                          <History className="h-4 w-4 mr-1" />
                          v{report.version}
                        </span>
                        {report.rejection_count > 0 && (
                          <span className="text-red-600 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {report.rejection_count}x reddedildi
                          </span>
                        )}
                      </div>
                    )}

                    {report?.rejection_reason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        <strong>Red Nedeni:</strong> {report.rejection_reason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {report ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleView(indicator)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Görüntüle
                        </Button>

                        {(report.status === 'draft' || report.status === 'rejected' || profile?.role === 'admin') && (
                          <Button size="sm" onClick={() => handleEdit(indicator)}>
                            <Edit2 className="h-4 w-4 mr-1" />
                            Düzenle
                          </Button>
                        )}

                        {report.status === 'draft' && profile?.role !== 'admin' && (
                          <Button size="sm" onClick={() => handleSubmit(indicator.id)}>
                            <Send className="h-4 w-4 mr-1" />
                            Gönder
                          </Button>
                        )}

                        {report.status === 'submitted' && profile?.role === 'admin' && (
                          <>
                            <Button size="sm" onClick={() => handleApprove(indicator.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Onayla
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const reason = prompt('Red nedeni:');
                                if (reason) handleReject(indicator.id, reason);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reddet
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleEdit(indicator)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Rapor Oluştur
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {filteredIndicators.length === 0 && (
          <Card>
            <CardBody>
              <p className="text-center text-gray-500 py-8">
                {searchTerm ? 'Arama sonucu bulunamadı' : 'Gösterge bulunamadı'}
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedIndicator ? `${selectedIndicator.code} - Rapor Düzenle` : 'Rapor Düzenle'}
      >
        <div className="space-y-4">
          {!reports[selectedIndicator?.id || ''] && (
            <TemplateSelector
              onSelect={setSelectedTemplate}
              selectedTemplateId={selectedTemplate?.id}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rapor Başlığı
            </label>
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <EnhancedReportEditor
            value={editData.content}
            onChange={(content) => setEditData({ ...editData, content })}
            reportId={selectedIndicator ? reports[selectedIndicator.id]?.id : undefined}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSave}>
              <FileText className="h-4 w-4 mr-2" />
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={selectedIndicator ? `${selectedIndicator.code} - Rapor Görüntüle` : 'Rapor Görüntüle'}
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">{editData.title}</h3>
            {selectedIndicator && reports[selectedIndicator.id] && (
              <div className="flex items-center space-x-3 mb-4">
                {getStatusBadge(reports[selectedIndicator.id].status)}
                <VersionHistory reportId={reports[selectedIndicator.id].id} />
              </div>
            )}
          </div>

          {editData.content.images && editData.content.images.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Görseller:</h4>
              <div className="grid grid-cols-2 gap-3">
                {editData.content.images.map((img: any, idx: number) => (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                    <img src={img.url} alt={img.name} className="w-full h-auto" />
                    <p className="text-xs text-gray-500 p-2">{img.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editData.content.tables && editData.content.tables.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Tablolar:</h4>
              <TableRenderer tables={editData.content.tables} />
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">İçerik:</h4>
            <MarkdownRenderer content={editData.content.text || editData.content.description || ''} />
          </div>

          {selectedIndicator && reports[selectedIndicator.id] && (
            <ReportComments reportId={reports[selectedIndicator.id].id} />
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Kapat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
