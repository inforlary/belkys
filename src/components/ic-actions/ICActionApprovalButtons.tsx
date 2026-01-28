import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Send, RotateCcw } from 'lucide-react';

interface ICActionApprovalButtonsProps {
  action: any;
  userRole: string;
  userDepartmentId?: string;
  onSuccess: () => void;
}

export default function ICActionApprovalButtons({
  action,
  userRole,
  userDepartmentId,
  onSuccess
}: ICActionApprovalButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const canSubmitForApproval = () => {
    return (
      action.approval_status === 'taslak' ||
      action.approval_status === 'reddedildi'
    ) && (
      userRole === 'user' ||
      userRole === 'director' ||
      action.responsible_department_id === userDepartmentId
    );
  };

  const canApproveAsUnit = () => {
    return (
      action.approval_status === 'birim_onayi_bekliyor' &&
      userRole === 'director' &&
      action.responsible_department_id === userDepartmentId
    );
  };

  const canApproveAsManagement = () => {
    return (
      action.approval_status === 'yonetim_onayi_bekliyor' &&
      (userRole === 'admin' || userRole === 'super_admin')
    );
  };

  const handleSubmitForApproval = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('submit_ic_action_for_approval', {
        p_action_id: action.id,
        p_user_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;

      if (data?.success) {
        alert('Eylem başarıyla onaya gönderildi!');
        onSuccess();
      } else {
        alert('Hata: ' + (data?.message || 'Bilinmeyen hata'));
      }
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (level: 'unit' | 'management') => {
    if (!confirm('Bu eylemi onaylamak istediğinizden emin misiniz?')) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('approve_ic_action', {
        p_action_id: action.id,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_approval_level: level
      });

      if (error) throw error;

      if (data?.success) {
        alert('Eylem başarıyla onaylandı!');
        onSuccess();
      } else {
        alert('Hata: ' + (data?.message || 'Bilinmeyen hata'));
      }
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Lütfen red gerekçesi giriniz!');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('reject_ic_action', {
        p_action_id: action.id,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_rejection_reason: rejectionReason
      });

      if (error) throw error;

      if (data?.success) {
        alert('Eylem reddedildi.');
        setShowRejectModal(false);
        setRejectionReason('');
        onSuccess();
      } else {
        alert('Hata: ' + (data?.message || 'Bilinmeyen hata'));
      }
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {canSubmitForApproval() && (
          <button
            onClick={handleSubmitForApproval}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1"
          >
            <Send className="w-4 h-4" />
            {action.approval_status === 'reddedildi' ? 'Tekrar Gönder' : 'Onaya Gönder'}
          </button>
        )}

        {canApproveAsUnit() && (
          <>
            <button
              onClick={() => handleApprove('unit')}
              disabled={loading}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Birim Onayı Ver
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm flex items-center gap-1"
            >
              <XCircle className="w-4 h-4" />
              Reddet
            </button>
          </>
        )}

        {canApproveAsManagement() && (
          <>
            <button
              onClick={() => handleApprove('management')}
              disabled={loading}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Yönetim Onayı Ver
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm flex items-center gap-1"
            >
              <XCircle className="w-4 h-4" />
              Reddet
            </button>
          </>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-4">Red Gerekçesi</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full border-gray-300 rounded-lg mb-4"
              placeholder="Lütfen red gerekçesini detaylı olarak açıklayınız..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4 inline mr-2" />
                {loading ? 'Reddediliyor...' : 'Onayla ve Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
