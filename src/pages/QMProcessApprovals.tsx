import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Check, X, Eye, Clock, User, Building2 } from 'lucide-react';

interface PendingProcess {
  id: string;
  code: string;
  name: string;
  description: string | null;
  purpose: string | null;
  scope: string | null;
  status: string;
  submitted_at: string | null;
  created_by: string;
  owner_department_id: string;
  category: { name: string } | null;
  creator: { full_name: string } | null;
  owner_department: { name: string; code: string } | null;
}

export default function QMProcessApprovals() {
  const { profile } = useAuth();
  const [pendingProcesses, setPendingProcesses] = useState<PendingProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<PendingProcess | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectingProcess, setRejectingProcess] = useState<PendingProcess | null>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      loadPendingProcesses();
    }
  }, [profile?.organization_id]);

  const loadPendingProcesses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('qm_processes')
        .select(`
          *,
          category:qm_process_categories(name),
          creator:profiles!qm_processes_created_by_fkey(full_name),
          owner_department:departments(name, code)
        `)
        .eq('organization_id', profile?.organization_id)
        .eq('status', 'PENDING_APPROVAL')
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      setPendingProcesses(data || []);
    } catch (error) {
      console.error('Error loading pending processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (processId: string) => {
    if (!confirm('Bu süreci onaylamak istediğinize emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase.rpc('approve_qm_process', {
        process_id: processId,
        approver_id: profile?.id,
        approve: true
      });

      if (error) throw error;
      alert('Süreç başarıyla onaylandı');
      loadPendingProcesses();
      setShowDetailModal(false);
    } catch (error: any) {
      console.error('Error approving process:', error);
      alert('Onaylama sırasında hata oluştu: ' + error.message);
    }
  };

  const handleOpenRejectModal = (process: PendingProcess) => {
    setRejectingProcess(process);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleReject = async () => {
    if (!rejectingProcess) return;

    if (!rejectionReason.trim()) {
      alert('Lütfen red nedeni giriniz');
      return;
    }

    try {
      const { error } = await supabase.rpc('approve_qm_process', {
        process_id: rejectingProcess.id,
        approver_id: profile?.id,
        approve: false,
        reason: rejectionReason
      });

      if (error) throw error;
      alert('Süreç reddedildi');
      loadPendingProcesses();
      setShowRejectionModal(false);
      setShowDetailModal(false);
    } catch (error: any) {
      console.error('Error rejecting process:', error);
      alert('Reddetme sırasında hata oluştu: ' + error.message);
    }
  };

  const handleViewDetail = (process: PendingProcess) => {
    setSelectedProcess(process);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysSince = (dateString: string | null) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">QM Süreç Onayları</h1>
          <p className="mt-2 text-gray-600">Onay bekleyen süreçleri görüntüleyin ve onaylayın</p>
        </div>
        <div className="bg-blue-50 px-4 py-2 rounded-lg">
          <div className="text-sm text-gray-600">Bekleyen Onay</div>
          <div className="text-2xl font-bold text-blue-600">{pendingProcesses.length}</div>
        </div>
      </div>

      {pendingProcesses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Onay bekleyen süreç yok</h3>
          <p className="text-gray-600">Şu anda onayınızı bekleyen QM süreci bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kod
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Süreç Adı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Birim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Oluşturan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gönderilme Tarihi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bekliyor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingProcesses.map((process) => {
                const daysSince = getDaysSince(process.submitted_at);
                return (
                  <tr key={process.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {process.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {process.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {process.owner_department?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {process.creator?.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(process.submitted_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        daysSince > 3 ? 'bg-red-100 text-red-800' :
                        daysSince > 1 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {daysSince} gün
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetail(process)}
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          title="Detay"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleApprove(process.id)}
                          className="text-green-600 hover:text-green-700 flex items-center gap-1"
                          title="Onayla"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenRejectModal(process)}
                          className="text-red-600 hover:text-red-700 flex items-center gap-1"
                          title="Reddet"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showDetailModal && selectedProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Süreç Detayı - {selectedProcess.code}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Birim</div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedProcess.owner_department?.name || '-'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Oluşturan</div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedProcess.creator?.full_name || '-'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Gönderilme Tarihi</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(selectedProcess.submitted_at)}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">Bekleme Süresi</div>
                    <div className="text-sm font-medium text-gray-900">
                      {getDaysSince(selectedProcess.submitted_at)} gün
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Süreç Adı</h3>
                <p className="text-gray-900">{selectedProcess.name}</p>
              </div>

              {selectedProcess.purpose && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Amaç</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedProcess.purpose}</p>
                </div>
              )}

              {selectedProcess.scope && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Kapsam</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedProcess.scope}</p>
                </div>
              )}

              {selectedProcess.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Açıklama</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedProcess.description}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Kapat
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenRejectModal(selectedProcess);
                }}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Reddet
              </button>
              <button
                onClick={() => handleApprove(selectedProcess.id)}
                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectionModal && rejectingProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Süreci Reddet</h2>
              <p className="text-sm text-gray-600 mt-1">
                {rejectingProcess.code} - {rejectingProcess.name}
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Red Nedeni <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Lütfen reddetme nedeninizi detaylı olarak açıklayınız..."
              />
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowRejectionModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
