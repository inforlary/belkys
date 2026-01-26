import { useState, useEffect } from 'react';
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function ActivityReportSummaryCard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalReports, setTotalReports] = useState(0);
  const [submittedReports, setSubmittedReports] = useState(0);
  const [draftReports, setDraftReports] = useState(0);
  const [overdueReports, setOverdueReports] = useState(0);
  const [submissionRate, setSubmissionRate] = useState(0);

  useEffect(() => {
    if (profile?.organization_id) {
      loadReportSummary();
    }
  }, [profile?.organization_id]);

  const loadReportSummary = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const { data: reports, count } = await supabase
        .from('activity_reports')
        .select('id, status, due_date, submitted_at', { count: 'exact' })
        .eq('organization_id', profile.organization_id);

      setTotalReports(count || 0);

      const submitted = reports?.filter(r =>
        r.status === 'Teslim Edildi' ||
        r.status === 'submitted' ||
        r.status === 'Onaylandı' ||
        r.status === 'approved'
      ).length || 0;
      setSubmittedReports(submitted);

      const drafts = reports?.filter(r => r.status === 'Taslak' || r.status === 'draft').length || 0;
      setDraftReports(drafts);

      const today = new Date();
      const overdue = reports?.filter(r => {
        if (r.status === 'Teslim Edildi' || r.status === 'submitted' || r.status === 'Onaylandı' || r.status === 'approved') return false;
        if (!r.due_date) return false;
        return new Date(r.due_date) < today;
      }).length || 0;
      setOverdueReports(overdue);

      const rate = count ? (submitted / count) * 100 : 0;
      setSubmissionRate(rate);

    } catch (error) {
      console.error('Error loading report summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBg = (rate: number) => {
    if (rate >= 80) return 'bg-green-50';
    if (rate >= 60) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Faaliyet Raporu Özeti</h3>
            <p className="text-sm text-slate-500">Rapor teslim durumu ve gecikme analizi</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`${getStatusBg(submissionRate)} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Teslim Oranı</p>
              <p className={`text-2xl font-bold ${getStatusColor(submissionRate)}`}>
                %{submissionRate.toFixed(1)}
              </p>
            </div>
            <CheckCircle className={`w-8 h-8 ${getStatusColor(submissionRate)}`} />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Taslak Raporlar</p>
              <p className="text-2xl font-bold text-blue-600">{draftReports}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className={`${overdueReports > 0 ? 'bg-red-50' : 'bg-green-50'} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Geciken Raporlar</p>
              <p className={`text-2xl font-bold ${overdueReports > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {overdueReports}
              </p>
            </div>
            <AlertCircle className={`w-8 h-8 ${overdueReports > 0 ? 'text-red-600' : 'text-green-600'}`} />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Toplam Rapor</span>
            <span className="text-sm font-semibold text-slate-900">{totalReports}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Teslim Edildi</span>
            <span className="text-sm font-semibold text-green-600">{submittedReports}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Taslak</span>
            <span className="text-sm font-semibold text-blue-600">{draftReports}</span>
          </div>

          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${submissionRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
