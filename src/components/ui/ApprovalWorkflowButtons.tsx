import { useState } from 'react';
import { CheckCircle, XCircle, Send, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ApprovalWorkflowButtonsProps {
  itemId: string;
  itemType: 'risk' | 'qm_process' | 'workflow';
  status: string;
  createdBy: string;
  currentUserId: string;
  userRole: string;
  userDepartmentId?: string;
  itemDepartmentId?: string;
  onStatusChange: () => void;
}

export default function ApprovalWorkflowButtons({
  itemId,
  itemType,
  status,
  createdBy,
  currentUserId,
  userRole,
  userDepartmentId,
  itemDepartmentId,
  onStatusChange
}: ApprovalWorkflowButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const normalizeStatus = (status: string) => {
    return status.toUpperCase().replace(/-/g, '_');
  };

  const currentStatus = normalizeStatus(status);
  const isCreator = createdBy === currentUserId;
  const isDirector = userRole === 'director' || userRole === 'DIRECTOR';
  const isAdmin = userRole === 'admin' || userRole === 'ADMIN';
  const isSameDepartment = userDepartmentId === itemDepartmentId;

  const canSubmit = isCreator && (currentStatus === 'DRAFT' || currentStatus === 'REJECTED');
  const canDirectorReview = isDirector && isSameDepartment && currentStatus === 'IN_REVIEW' && !isCreator;
  const canAdminApprove = isAdmin && currentStatus === 'PENDING_APPROVAL' && !isCreator;

  const getFunctionNames = () => {
    switch (itemType) {
      case 'risk':
        return {
          submit: 'submit_risk_for_director_review',
          directorReview: 'director_review_risk',
          adminApprove: 'admin_final_approve_risk'
        };
      case 'qm_process':
        return {
          submit: 'submit_qm_process_to_director',
          directorReview: 'director_approve_qm_process',
          adminApprove: 'admin_final_approve_qm_process'
        };
      case 'workflow':
        return {
          submit: 'submit_workflow_to_director',
          directorReview: 'director_approve_workflow',
          adminApprove: 'admin_final_approve_workflow'
        };
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const functions = getFunctionNames();
      const { data, error } = await supabase.rpc(functions.submit, {
        [`${itemType}_id`]: itemId
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message);
        onStatusChange();
      } else {
        alert(data?.message || 'Bir hata oluştu');
      }
    } catch (error: any) {
      console.error('Error submitting:', error);
      alert(error.message || 'Gönderim sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectorAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Lütfen red nedeni giriniz');
      return;
    }

    setLoading(true);
    try {
      const functions = getFunctionNames();
      const { data, error } = await supabase.rpc(functions.directorReview, {
        [`${itemType}_id`]: itemId,
        action: action,
        rejection_reason_text: action === 'reject' ? rejectionReason : null
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message);
        setShowRejectModal(false);
        setRejectionReason('');
        onStatusChange();
      } else {
        alert(data?.message || 'Bir hata oluştu');
      }
    } catch (error: any) {
      console.error('Error in director action:', error);
      alert(error.message || 'İşlem sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Lütfen red nedeni giriniz');
      return;
    }

    setLoading(true);
    try {
      const functions = getFunctionNames();
      const { data, error } = await supabase.rpc(functions.adminApprove, {
        [`${itemType}_id`]: itemId,
        action: action,
        rejection_reason_text: action === 'reject' ? rejectionReason : null
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message);
        setShowRejectModal(false);
        setRejectionReason('');
        onStatusChange();
      } else {
        alert(data?.message || 'Bir hata oluştu');
      }
    } catch (error: any) {
      console.error('Error in admin action:', error);
      alert(error.message || 'İşlem sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
      DRAFT: { label: 'Taslak', color: 'text-gray-700', bgColor: 'bg-gray-100' },
      IN_REVIEW: { label: 'Müdür İncelemesinde', color: 'text-blue-700', bgColor: 'bg-blue-100' },
      PENDING_APPROVAL: { label: 'Admin Onayı Bekliyor', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
      APPROVED: { label: 'Onaylandı', color: 'text-green-700', bgColor: 'bg-green-100' },
      REJECTED: { label: 'Reddedildi', color: 'text-red-700', bgColor: 'bg-red-100' }
    };

    const config = statusConfig[currentStatus] || statusConfig.DRAFT;

    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${config.bgColor} ${config.color}`}>
        <AlertCircle className="w-5 h-5" />
        <span className="font-medium">{config.label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {getStatusBadge()}

      <div className="flex gap-3">
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Gönderiliyor...' : 'Müdür Onayına Gönder'}
          </button>
        )}

        {canDirectorReview && (
          <>
            <button
              onClick={() => handleDirectorAction('approve')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'İşleniyor...' : 'Onayla ve Admin\'e Gönder'}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reddet
            </button>
          </>
        )}

        {canAdminApprove && (
          <>
            <button
              onClick={() => handleAdminAction('approve')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'İşleniyor...' : 'Final Onayla'}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reddet
            </button>
          </>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Red Nedeni</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4 h-32"
              placeholder="Lütfen red nedeninizi açıklayınız..."
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (canDirectorReview) {
                    handleDirectorAction('reject');
                  } else if (canAdminApprove) {
                    handleAdminAction('reject');
                  }
                }}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'İşleniyor...' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
