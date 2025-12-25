import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, AlertTriangle, Eye, Download, MessageSquare } from 'lucide-react';

interface Submission {
  id: string;
  status: string;
  version: number;
  submitted_at: string;
  reviewed_at: string;
  review_notes: string;
  submitted_by_profile: {
    full_name: string;
    email: string;
  };
  department: {
    name: string;
  };
  assignment: {
    id: string;
    request: {
      id: string;
      title: string;
      priority: string;
    };
  };
}

interface SubmissionValue {
  field_label: string;
  field_type: string;
  value_text: string;
  value_number: number;
  value_date: string;
  value_boolean: boolean;
  value_json: any;
}

export default function DataRequestTracking() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionValues, setSubmissionValues] = useState<SubmissionValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'revision'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');

  useEffect(() => {
    loadSubmissions();
  }, [profile?.organization_id, statusFilter]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('data_request_submissions')
        .select(`
          *,
          profiles!data_request_submissions_submitted_by_fkey(full_name, email),
          departments(name),
          data_request_assignments!inner(
            id,
            data_requests!inner(id, title, priority, organization_id)
          )
        `)
        .eq('data_request_assignments.data_requests.organization_id', profile?.organization_id)
        .order('submitted_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = (data || []).map((sub: any) => ({
        ...sub,
        submitted_by_profile: sub.profiles,
        department: sub.departments,
        assignment: {
          id: sub.data_request_assignments.id,
          request: sub.data_request_assignments.data_requests,
        },
      }));

      setSubmissions(formattedData);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissionValues = async (submissionId: string) => {
    try {
      const { data, error } = await supabase
        .from('data_request_submission_values')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSubmissionValues(data || []);
    } catch (error: any) {
      console.error('Error loading submission values:', error);
    }
  };

  const handleReview = async () => {
    if (!selectedSubmission) return;

    try {
      const newStatus = reviewAction === 'approve' ? 'approved' : reviewAction === 'reject' ? 'rejected' : 'revision_requested';

      const { error } = await supabase
        .from('data_request_submissions')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      if (reviewAction === 'approve') {
        const { error: assignmentError } = await supabase
          .from('data_request_assignments')
          .update({ status: 'completed' })
          .eq('id', selectedSubmission.assignment.id);

        if (assignmentError) throw assignmentError;
      }

      setShowReviewModal(false);
      setReviewNotes('');
      setSelectedSubmission(null);
      loadSubmissions();
      alert('Değerlendirme başarıyla kaydedildi!');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleExport = async (submission: Submission) => {
    try {
      const { data, error } = await supabase
        .from('data_request_submission_values')
        .select('*')
        .eq('submission_id', submission.id);

      if (error) throw error;

      const exportData = (data || []).map((value: any) => ({
        'Alan': value.field_label,
        'Değer': getDisplayValue(value),
      }));

      const csv = [
        ['Talep', submission.assignment.request.title].join(','),
        ['Müdürlük', submission.department.name].join(','),
        ['Gönderen', submission.submitted_by_profile.full_name].join(','),
        ['Gönderim Tarihi', new Date(submission.submitted_at).toLocaleString('tr-TR')].join(','),
        '',
        Object.keys(exportData[0] || {}).join(','),
        ...exportData.map((row: any) => Object.values(row).join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `veri-talebi-${submission.id}.csv`;
      link.click();
    } catch (error: any) {
      alert('Export hatası: ' + error.message);
    }
  };

  const getDisplayValue = (value: any): string => {
    if (value.field_type === 'number') {
      return value.value_number?.toString() || '';
    } else if (value.field_type === 'date' || value.field_type === 'datetime') {
      return value.value_date ? new Date(value.value_date).toLocaleString('tr-TR') : '';
    } else if (value.field_type === 'checkbox') {
      return value.value_boolean ? 'Evet' : 'Hayır';
    } else if (value.field_type === 'multi_select') {
      return Array.isArray(value.value_json) ? value.value_json.join(', ') : '';
    } else {
      return value.value_text || '';
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string; icon: any }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Taslak', icon: MessageSquare },
      submitted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Gönderildi', icon: MessageSquare },
      under_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'İnceleniyor', icon: Eye },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Onaylandı', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Reddedildi', icon: XCircle },
      revision_requested: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Revizyon İstendi', icon: AlertTriangle },
    };

    const badge = badges[status] || badges.submitted;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      low: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Düşük' },
      normal: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Normal' },
      high: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Yüksek' },
      urgent: { bg: 'bg-red-100', text: 'text-red-800', label: 'Acil' },
    };

    const badge = badges[priority] || badges.normal;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gelen Cevapları Takip Et</h1>
        <p className="mt-1 text-sm text-gray-500">
          Müdürlüklerden gelen verileri inceleyin, onaylayın veya revizyon isteyin
        </p>
      </div>

      <div className="flex gap-2">
        {['all', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              statusFilter === status
                ? 'bg-blue-100 text-blue-700'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {status === 'all' ? 'Tümü' : getStatusBadge(status).props.children[1]}
          </button>
        ))}
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Talep / Müdürlük
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gönderen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gönderim Tarihi
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  Henüz gelen cevap bulunmuyor
                </td>
              </tr>
            ) : (
              submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {submission.assignment.request.title}
                        </span>
                        {getPriorityBadge(submission.assignment.request.priority)}
                      </div>
                      <span className="text-xs text-gray-500 mt-1">
                        {submission.department.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">
                        {submission.submitted_by_profile.full_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {submission.submitted_by_profile.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(submission.status)}
                    {submission.version > 1 && (
                      <span className="ml-2 text-xs text-gray-500">
                        v{submission.version}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(submission.submitted_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async () => {
                          setSelectedSubmission(submission);
                          await loadSubmissionValues(submission.id);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Görüntüle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleExport(submission)}
                        className="text-green-600 hover:text-green-900"
                        title="Export"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {submission.status === 'submitted' && (
                        <button
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setShowReviewModal(true);
                          }}
                          className="text-purple-600 hover:text-purple-900"
                          title="Değerlendir"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedSubmission && !showReviewModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedSubmission.assignment.request.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedSubmission.department.name} - {selectedSubmission.submitted_by_profile.full_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSubmission(null);
                  setSubmissionValues([]);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {submissionValues.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  Veri bulunamadı
                </div>
              ) : (
                <div className="space-y-4">
                  {submissionValues.map((value: any, index) => (
                    <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
                      <label className="block text-sm font-medium text-gray-700">
                        {value.field_label}
                      </label>
                      <div className="mt-1 text-sm text-gray-900">
                        {getDisplayValue(value) || <span className="text-gray-400 italic">Boş</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedSubmission.review_notes && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <h4 className="text-sm font-medium text-yellow-800">Değerlendirme Notu:</h4>
                  <p className="mt-1 text-sm text-yellow-700">{selectedSubmission.review_notes}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              {selectedSubmission.status === 'submitted' && (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Değerlendir
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedSubmission(null);
                  setSubmissionValues([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && selectedSubmission && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Değerlendirme Yap</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşlem Seçin
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reviewAction"
                      value="approve"
                      checked={reviewAction === 'approve'}
                      onChange={(e) => setReviewAction(e.target.value as any)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Onayla</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reviewAction"
                      value="revision"
                      checked={reviewAction === 'revision'}
                      onChange={(e) => setReviewAction(e.target.value as any)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Revizyon İste</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reviewAction"
                      value="reject"
                      checked={reviewAction === 'reject'}
                      onChange={(e) => setReviewAction(e.target.value as any)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Reddet</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Not {reviewAction !== 'approve' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={
                    reviewAction === 'approve'
                      ? 'İsteğe bağlı açıklama...'
                      : reviewAction === 'revision'
                      ? 'Hangi alanların düzeltilmesi gerektiğini belirtin...'
                      : 'Reddetme sebebini açıklayın...'
                  }
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewNotes('');
                  setReviewAction('approve');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleReview}
                disabled={reviewAction !== 'approve' && !reviewNotes}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}