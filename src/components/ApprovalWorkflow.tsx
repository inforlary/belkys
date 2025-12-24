import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import type { ApprovalWorkflow } from '../types/database';

interface ApprovalWorkflowProps {
  entityType: 'strategic_plan' | 'objective' | 'goal' | 'indicator' | 'activity';
  entityId: string;
  entityName: string;
}

export function ApprovalWorkflowComponent({ entityType, entityId, entityName }: ApprovalWorkflowProps) {
  const { user, profile } = useAuth();
  const [workflow, setWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comments, setComments] = useState('');

  useEffect(() => {
    loadWorkflow();
  }, [entityId]);

  async function loadWorkflow() {
    try {
      const { data } = await supabase
        .from('approval_workflows')
        .select('*, requested_by_profile:profiles!approval_workflows_requested_by_fkey(full_name), reviewed_by_profile:profiles!approval_workflows_reviewed_by_fkey(full_name)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setWorkflow(data);
    } catch (error) {
      console.error('Onay durumu yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestApproval() {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('approval_workflows')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          requested_by: user.id,
          status: 'pending',
        });

      if (error) throw error;
      await loadWorkflow();
    } catch (error: any) {
      alert(error.message || 'Onay talebi oluşturulurken hata oluştu');
    }
  }

  async function handleApprove() {
    if (!user?.id || !workflow) return;

    try {
      const { error } = await supabase
        .from('approval_workflows')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          comments: comments || null,
        })
        .eq('id', workflow.id);

      if (error) throw error;
      setShowCommentModal(false);
      setComments('');
      await loadWorkflow();
    } catch (error: any) {
      alert(error.message || 'Onay işlemi sırasında hata oluştu');
    }
  }

  async function handleReject() {
    if (!user?.id || !workflow || !comments.trim()) {
      alert('Red nedeni girmelisiniz');
      return;
    }

    try {
      const { error } = await supabase
        .from('approval_workflows')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          comments: comments,
        })
        .eq('id', workflow.id);

      if (error) throw error;
      setShowCommentModal(false);
      setComments('');
      await loadWorkflow();
    } catch (error: any) {
      alert(error.message || 'Red işlemi sırasında hata oluştu');
    }
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
  const canReview = isAdmin && workflow?.status === 'pending';

  if (loading) return null;

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  const statusIcons = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle,
  };

  const statusLabels = {
    pending: 'Onay Bekliyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
  };

  return (
    <div className="space-y-3">
      {!workflow && (
        <Button onClick={handleRequestApproval} variant="outline" size="sm">
          <CheckCircle className="w-4 h-4 mr-2" />
          Onay Talep Et
        </Button>
      )}

      {workflow && (
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const Icon = statusIcons[workflow.status as keyof typeof statusIcons];
                  return <Icon className="w-5 h-5" />;
                })()}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[workflow.status as keyof typeof statusColors]}`}>
                  {statusLabels[workflow.status as keyof typeof statusLabels]}
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>Talep Eden:</strong> {(workflow as any).requested_by_profile?.full_name || 'Bilinmiyor'}
                </p>
                {workflow.reviewed_by && (
                  <>
                    <p>
                      <strong>İnceleyen:</strong> {(workflow as any).reviewed_by_profile?.full_name || 'Bilinmiyor'}
                    </p>
                    <p>
                      <strong>İnceleme Tarihi:</strong> {new Date(workflow.reviewed_at!).toLocaleDateString('tr-TR')}
                    </p>
                  </>
                )}
                {workflow.comments && (
                  <div className="mt-2 p-2 bg-gray-50 rounded">
                    <p className="text-xs font-medium text-gray-700 mb-1">Açıklama:</p>
                    <p className="text-sm">{workflow.comments}</p>
                  </div>
                )}
              </div>
            </div>

            {canReview && (
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setShowCommentModal(true);
                    setComments('');
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Onayla
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setShowCommentModal(true);
                    setComments('');
                  }}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reddet
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Onay/Red Açıklaması</h3>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Açıklama giriniz (isteğe bağlı)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <Button onClick={handleApprove} className="flex-1">
                Onayla
              </Button>
              <Button onClick={handleReject} variant="danger" className="flex-1">
                Reddet
              </Button>
              <Button
                onClick={() => {
                  setShowCommentModal(false);
                  setComments('');
                }}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
