import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import {
  FileText,
  Plus,
  Calendar,
  Building2,
  Users,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Edit,
  Trash2,
  Download,
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
  prepared_by_id: string | null;
  submission_deadline: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
  departments?: { name: string };
  prepared_by?: { full_name: string };
}

interface Department {
  id: string;
  name: string;
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

export default function ActivityReports() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    type: 'all',
    status: 'all',
    unitId: 'all',
  });

  const [newReport, setNewReport] = useState({
    year: new Date().getFullYear(),
    type: 'INSTITUTION' as 'UNIT' | 'INSTITUTION',
    unitId: '',
    title: '',
    description: '',
    submissionDeadline: '',
  });

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile, filters]);

  const loadData = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('activity_reports')
        .select(`
          *,
          departments:unit_id(name),
          prepared_by:prepared_by_id(full_name)
        `)
        .eq('organization_id', profile!.organization_id)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.year) {
        query = query.eq('year', filters.year);
      }
      if (filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.unitId !== 'all') {
        query = query.eq('unit_id', filters.unitId);
      }

      const { data: reportsData, error: reportsError } = await query;

      if (reportsError) throw reportsError;
      setReports(reportsData || []);

      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile!.organization_id)
        .order('name');

      setDepartments(deptData || []);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      alert('Raporlar yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = async () => {
    try {
      if (!newReport.title.trim()) {
        alert('Lütfen rapor başlığı girin');
        return;
      }

      if (newReport.type === 'UNIT' && !newReport.unitId) {
        alert('Lütfen birim seçin');
        return;
      }

      const reportData: any = {
        organization_id: profile!.organization_id,
        year: newReport.year,
        type: newReport.type,
        title: newReport.title,
        description: newReport.description,
        status: 'DRAFT',
        prepared_by_id: profile!.id,
      };

      if (newReport.type === 'UNIT') {
        reportData.unit_id = newReport.unitId;
      }

      if (newReport.submissionDeadline) {
        reportData.submission_deadline = newReport.submissionDeadline;
      }

      const { data, error } = await supabase
        .from('activity_reports')
        .insert([reportData])
        .select()
        .single();

      if (error) throw error;

      alert('Rapor başarıyla oluşturuldu');
      setIsCreateModalOpen(false);
      setNewReport({
        year: new Date().getFullYear(),
        type: 'INSTITUTION',
        unitId: '',
        title: '',
        description: '',
        submissionDeadline: '',
      });

      navigate(`activity-reports/${data.id}/edit`);
    } catch (error: any) {
      console.error('Error creating report:', error);
      alert('Rapor oluşturulurken hata oluştu: ' + error.message);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Bu raporu silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('activity_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      alert('Rapor silindi');
      loadData();
    } catch (error: any) {
      console.error('Error deleting report:', error);
      alert('Rapor silinirken hata oluştu: ' + error.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Edit className="w-4 h-4" />;
      case 'UNIT_SUBMITTED':
        return <Send className="w-4 h-4" />;
      case 'CONSOLIDATING':
      case 'REVIEW':
        return <Clock className="w-4 h-4" />;
      case 'APPROVED':
      case 'PUBLISHED':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const canCreateReport = profile?.role === 'admin' || profile?.role === 'vice_president' || profile?.role === 'director';
  const canDelete = profile?.role === 'admin' || profile?.role === 'vice_president';

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Faaliyet Raporları</h1>
          <p className="text-gray-600 mt-2">
            İdare ve birim faaliyet raporlarını oluşturun ve yönetin
          </p>
        </div>
        {canCreateReport && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Rapor
          </Button>
        )}
      </div>

      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yıl
              </label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rapor Türü
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">Tümü</option>
                <option value="INSTITUTION">İdare Raporu</option>
                <option value="UNIT">Birim Raporu</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durum
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">Tümü</option>
                <option value="DRAFT">Taslak</option>
                <option value="UNIT_SUBMITTED">Birim Teslim</option>
                <option value="CONSOLIDATING">Birleştiriliyor</option>
                <option value="REVIEW">İnceleme</option>
                <option value="APPROVED">Onaylı</option>
                <option value="PUBLISHED">Yayınlandı</option>
              </select>
            </div>

            {departments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birim
                </label>
                <select
                  value={filters.unitId}
                  onChange={(e) => setFilters({ ...filters, unitId: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Tümü</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Rapor Bulunamadı</h3>
              <p className="text-gray-500 mb-6">
                Seçili filtrelere uygun rapor bulunmuyor. Yeni bir rapor oluşturabilirsiniz.
              </p>
              {canCreateReport && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-5 h-5 mr-2" />
                  İlk Raporunuzu Oluşturun
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {report.title}
                        </h3>
                        <StatusBadge
                          status={report.status}
                          label={STATUS_LABELS[report.status]}
                          variant={STATUS_COLORS[report.status]}
                        />
                        {getStatusIcon(report.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{report.year}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {report.type === 'INSTITUTION' ? (
                            <>
                              <Building2 className="w-4 h-4" />
                              <span>İdare Raporu</span>
                            </>
                          ) : (
                            <>
                              <Users className="w-4 h-4" />
                              <span>Birim: {report.departments?.name || 'Bilinmiyor'}</span>
                            </>
                          )}
                        </div>
                        {report.prepared_by?.full_name && (
                          <div className="flex items-center gap-1">
                            <span>Hazırlayan: {report.prepared_by.full_name}</span>
                          </div>
                        )}
                      </div>

                      {report.description && (
                        <p className="text-gray-600 text-sm mb-3">{report.description}</p>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${report.completion_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          %{report.completion_percentage} Tamamlandı
                        </span>
                      </div>

                      {report.submission_deadline && (
                        <div className="mt-3 text-sm text-orange-600">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Teslim Tarihi: {new Date(report.submission_deadline).toLocaleDateString('tr-TR')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`activity-reports/${report.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {report.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`activity-reports/${report.id}/edit`)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>

                          {canDelete && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteReport(report.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}

                      {report.status === 'PUBLISHED' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`activity-reports/${report.id}/export`)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Yeni Faaliyet Raporu Oluştur"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Yıl <span className="text-red-500">*</span>
            </label>
            <select
              value={newReport.year}
              onChange={(e) => setNewReport({ ...newReport, year: parseInt(e.target.value) })}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rapor Türü <span className="text-red-500">*</span>
            </label>
            <select
              value={newReport.type}
              onChange={(e) => setNewReport({ ...newReport, type: e.target.value as 'UNIT' | 'INSTITUTION' })}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="INSTITUTION">İdare Faaliyet Raporu</option>
              <option value="UNIT">Birim Faaliyet Raporu</option>
            </select>
          </div>

          {newReport.type === 'UNIT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Birim <span className="text-red-500">*</span>
              </label>
              <select
                value={newReport.unitId}
                onChange={(e) => setNewReport({ ...newReport, unitId: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Birim Seçin</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rapor Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newReport.title}
              onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
              placeholder="Örn: 2024 Yılı Faaliyet Raporu"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={newReport.description}
              onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
              rows={3}
              placeholder="Rapor hakkında kısa açıklama..."
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teslim Tarihi
            </label>
            <input
              type="date"
              value={newReport.submissionDeadline}
              onChange={(e) => setNewReport({ ...newReport, submissionDeadline: e.target.value })}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateReport}>
              Rapor Oluştur ve Düzenlemeye Başla
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
