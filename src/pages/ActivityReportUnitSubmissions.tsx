import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import {
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Calendar,
  Users,
  TrendingUp,
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface UnitSubmission {
  department_id: string;
  department_name: string;
  report_id: string | null;
  report_title: string | null;
  status: string | null;
  completion_percentage: number;
  submission_deadline: string | null;
  submitted_at: string | null;
  prepared_by?: string;
}

export default function ActivityReportUnitSubmissions() {
  const { profile } = useAuth();
  const { navigate } = useLocation();

  const [year, setYear] = useState(new Date().getFullYear());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submissions, setSubmissions] = useState<UnitSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile, year]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('organization_id', profile!.organization_id)
        .order('name');

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      const { data: reportsData, error: reportsError } = await supabase
        .from('activity_reports')
        .select(`
          id,
          unit_id,
          title,
          status,
          completion_percentage,
          submission_deadline,
          submitted_at,
          prepared_by:prepared_by_id(full_name)
        `)
        .eq('organization_id', profile!.organization_id)
        .eq('year', year)
        .eq('type', 'UNIT');

      if (reportsError) throw reportsError;

      const submissionList: UnitSubmission[] = deptData.map((dept) => {
        const report = reportsData?.find((r) => r.unit_id === dept.id);

        return {
          department_id: dept.id,
          department_name: dept.name,
          report_id: report?.id || null,
          report_title: report?.title || null,
          status: report?.status || null,
          completion_percentage: report?.completion_percentage || 0,
          submission_deadline: report?.submission_deadline || null,
          submitted_at: report?.submitted_at || null,
          prepared_by: report?.prepared_by?.full_name || null,
        };
      });

      setSubmissions(submissionList);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      alert('Veriler yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return <StatusBadge status="draft" label="Başlanmadı" variant="gray" />;
    }

    const statusLabels: Record<string, string> = {
      DRAFT: 'Taslak',
      UNIT_SUBMITTED: 'Teslim Edildi',
      CONSOLIDATING: 'Birleştiriliyor',
      REVIEW: 'İnceleme',
      APPROVED: 'Onaylandı',
      PUBLISHED: 'Yayınlandı',
    };

    const statusColors: Record<string, any> = {
      DRAFT: 'gray',
      UNIT_SUBMITTED: 'blue',
      CONSOLIDATING: 'purple',
      REVIEW: 'yellow',
      APPROVED: 'green',
      PUBLISHED: 'emerald',
    };

    return (
      <StatusBadge
        status={status}
        label={statusLabels[status] || status}
        variant={statusColors[status] || 'gray'}
      />
    );
  };

  const getStatusIcon = (status: string | null, deadline: string | null) => {
    if (!status) {
      if (deadline && new Date(deadline) < new Date()) {
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      }
      return <Clock className="w-5 h-5 text-gray-400" />;
    }

    if (status === 'UNIT_SUBMITTED' || status === 'APPROVED' || status === 'PUBLISHED') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }

    return <Clock className="w-5 h-5 text-blue-500" />;
  };

  const stats = {
    total: submissions.length,
    notStarted: submissions.filter((s) => !s.status).length,
    draft: submissions.filter((s) => s.status === 'DRAFT').length,
    submitted: submissions.filter((s) =>
      ['UNIT_SUBMITTED', 'CONSOLIDATING', 'REVIEW', 'APPROVED', 'PUBLISHED'].includes(s.status || '')
    ).length,
    overdue: submissions.filter(
      (s) => !s.submitted_at && s.submission_deadline && new Date(s.submission_deadline) < new Date()
    ).length,
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

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
          <h1 className="text-3xl font-bold text-gray-900">Birim Faaliyet Raporu Teslim Durumu</h1>
          <p className="text-gray-600 mt-2">Birimlerin rapor hazırlama ve teslim durumunu takip edin</p>
        </div>
        <div className="w-48">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Birim</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Başlanmadı</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.notStarted}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taslak</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.draft}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Teslim Edildi</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.submitted}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gecikmiş</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Birim Detayları</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4" />
              <span>
                Tamamlanma Oranı: %
                {submissions.length > 0
                  ? Math.round((stats.submitted / stats.total) * 100)
                  : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Birim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İlerleme
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teslim Tarihi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hazırlayan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map((submission) => (
                <tr key={submission.department_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(submission.status, submission.submission_deadline)}
                      <div>
                        <div className="font-medium text-gray-900">
                          {submission.department_name}
                        </div>
                        {submission.report_title && (
                          <div className="text-sm text-gray-500">{submission.report_title}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(submission.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${submission.completion_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        %{submission.completion_percentage}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {submission.submission_deadline ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span
                          className={`text-sm ${
                            !submission.submitted_at &&
                            new Date(submission.submission_deadline) < new Date()
                              ? 'text-red-600 font-semibold'
                              : 'text-gray-900'
                          }`}
                        >
                          {new Date(submission.submission_deadline).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Belirtilmemiş</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {submission.prepared_by ? (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{submission.prepared_by}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {submission.report_id ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`activity-reports/${submission.report_id}`)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Görüntüle
                      </Button>
                    ) : (
                      <span className="text-gray-400">Henüz oluşturulmadı</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
