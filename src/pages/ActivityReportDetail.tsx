import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import {
  ArrowLeft,
  Edit,
  Download,
  Calendar,
  User,
  Building2,
  FileText,
  CheckCircle,
  Clock,
  Send,
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
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  prepared_by_id: string | null;
  departments?: { name: string };
  prepared_by?: { full_name: string };
  approved_by?: { full_name: string };
}

interface ReportSection {
  id: string;
  section_code: string;
  section_name: string;
  parent_section_code: string | null;
  order_index: number;
  html_content: string | null;
  is_completed: boolean;
}

interface WorkflowLog {
  id: string;
  from_status: string;
  to_status: string;
  action: string;
  action_date: string;
  action_by?: { full_name: string };
  notes: string | null;
}

const STATUS_COLORS = {
  DRAFT: 'gray',
  UNIT_SUBMITTED: 'blue',
  CONSOLIDATING: 'purple',
  REVIEW: 'yellow',
  APPROVED: 'green',
  PUBLISHED: 'emerald',
} as const;

const STATUS_LABELS = {
  DRAFT: 'Taslak',
  UNIT_SUBMITTED: 'Birim Teslim',
  CONSOLIDATING: 'Birleştiriliyor',
  REVIEW: 'İnceleme',
  APPROVED: 'Onaylı',
  PUBLISHED: 'Yayınlandı',
};

export default function ActivityReportDetail() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const hash = window.location.hash.replace(/^#\/?/, '');
  const reportId = hash.split('/')[1];

  const [report, setReport] = useState<ActivityReport | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [workflowLogs, setWorkflowLogs] = useState<WorkflowLog[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select(`
          *,
          departments:unit_id(name),
          prepared_by:prepared_by_id(full_name),
          approved_by:approved_by_id(full_name)
        `)
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
      setSections(sectionsData || []);

      const { data: workflowData, error: workflowError } = await supabase
        .from('report_workflow')
        .select(`
          *,
          action_by:action_by_id(full_name)
        `)
        .eq('report_id', reportId)
        .order('action_date', { ascending: false });

      if (workflowError) throw workflowError;
      setWorkflowLogs(workflowData || []);
    } catch (error: any) {
      console.error('Error loading report:', error);
      alert('Rapor yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'SUBMIT':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'APPROVE':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PUBLISH':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const canEdit = report && report.status === 'DRAFT' && (
    profile?.role === 'admin' ||
    profile?.role === 'vice_president' ||
    (profile?.role === 'director' && report.type === 'UNIT' && report.unit_id === profile.department_id)
  );

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
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Rapor Bulunamadı</h2>
        <Button onClick={() => navigate('activity-reports')} className="mt-4">
          Raporlara Dön
        </Button>
      </div>
    );
  }

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
            <p className="text-gray-600">Rapor Detayı ve Önizleme</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            status={report.status}
            label={STATUS_LABELS[report.status]}
            variant={STATUS_COLORS[report.status]}
          />
          {canEdit && (
            <Button
              onClick={() => navigate(`activity-reports/${reportId}/edit`)}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Düzenle
            </Button>
          )}
          {report.status === 'PUBLISHED' && (
            <Button
              variant="secondary"
              onClick={() => navigate(`activity-reports/${reportId}/export`)}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              İndir
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Rapor Bilgileri</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Yıl</span>
                  </div>
                  <div className="font-semibold text-gray-900">{report.year}</div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <FileText className="w-4 h-4" />
                    <span>Rapor Türü</span>
                  </div>
                  <div className="font-semibold text-gray-900">
                    {report.type === 'INSTITUTION' ? 'İdare Raporu' : 'Birim Raporu'}
                  </div>
                </div>

                {report.type === 'UNIT' && report.departments && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Building2 className="w-4 h-4" />
                      <span>Birim</span>
                    </div>
                    <div className="font-semibold text-gray-900">{report.departments.name}</div>
                  </div>
                )}

                {report.prepared_by && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <User className="w-4 h-4" />
                      <span>Hazırlayan</span>
                    </div>
                    <div className="font-semibold text-gray-900">{report.prepared_by.full_name}</div>
                  </div>
                )}

                {report.submission_deadline && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Clock className="w-4 h-4" />
                      <span>Teslim Tarihi</span>
                    </div>
                    <div className="font-semibold text-gray-900">
                      {new Date(report.submission_deadline).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                )}

                {report.submitted_at && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Send className="w-4 h-4" />
                      <span>Gönderim Tarihi</span>
                    </div>
                    <div className="font-semibold text-gray-900">
                      {new Date(report.submitted_at).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                )}

                {report.approved_at && report.approved_by && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>Onaylayan</span>
                    </div>
                    <div className="font-semibold text-gray-900">{report.approved_by.full_name}</div>
                  </div>
                )}
              </div>

              {report.description && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">Açıklama</div>
                  <div className="text-gray-900">{report.description}</div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Tamamlanma Durumu</div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${report.completion_percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    %{report.completion_percentage}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {sections.filter(s => s.is_completed).length} / {sections.length} bölüm tamamlandı
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Rapor İçeriği</h2>
            </div>
            <div className="p-6 space-y-6">
              {sections.map((section) => (
                <div key={section.id} className={section.parent_section_code ? 'ml-6' : ''}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`${section.parent_section_code ? 'text-base' : 'text-lg font-semibold'} text-gray-900`}>
                      {section.section_name}
                    </h3>
                    {section.is_completed && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  {section.html_content ? (
                    <div
                      className="prose max-w-none text-gray-700"
                      dangerouslySetInnerHTML={{ __html: section.html_content }}
                    />
                  ) : (
                    <p className="text-gray-400 italic">Bu bölüm henüz doldurulmamış.</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Bölüm Durumu</h3>
            </div>
            <div className="p-4 space-y-2">
              {sections.map((section) => (
                <div key={section.id} className={`flex items-center justify-between py-2 ${section.parent_section_code ? 'pl-4' : ''}`}>
                  <span className={`text-sm ${section.parent_section_code ? 'text-gray-600' : 'font-medium text-gray-900'}`}>
                    {section.section_name}
                  </span>
                  {section.is_completed ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {workflowLogs.length > 0 && (
            <Card>
              <div className="p-6 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">İş Akışı Geçmişi</h3>
              </div>
              <div className="p-4 space-y-4">
                {workflowLogs.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {log.from_status} → {log.to_status}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {log.action_by?.full_name || 'Sistem'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.action_date).toLocaleString('tr-TR')}
                      </div>
                      {log.notes && (
                        <div className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded">
                          {log.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
