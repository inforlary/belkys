import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, AlertCircle, Eye, MessageSquare } from 'lucide-react';

interface Proposal {
  id: string;
  status: string;
  total_year1: number;
  total_year2: number;
  total_year3: number;
  submitted_at: string;
  campaign: { name: string; fiscal_year: number };
  department: { name: string };
}

const ROLE_STATUSES = {
  vice_president: {
    pending: 'vp_review',
    approved: 'vp_approved',
    rejected: 'vp_revision_requested',
    nextStatus: 'finance_review',
  },
  finance: {
    pending: 'finance_review',
    approved: 'finance_approved',
    rejected: 'finance_revision_requested',
    nextStatus: 'final_review',
  },
  president: {
    pending: 'final_review',
    approved: 'approved',
    rejected: 'rejected',
    nextStatus: null,
  },
};

export default function BudgetApprovals() {
  const { user, profile } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'revise' | null>(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);

  const roleType = profile?.role === 'vice_president' ? 'vice_president' :
                   profile?.role === 'finance' ? 'finance' :
                   profile?.role === 'admin' ? 'president' : null;

  useEffect(() => {
    if (user && profile && roleType) {
      loadProposals();
    }
  }, [user, profile, roleType]);

  async function loadProposals() {
    if (!roleType) return;

    try {
      setLoading(true);
      const roleConfig = ROLE_STATUSES[roleType];

      const statusesToShow = [roleConfig.pending];
      if (roleType === 'vice_president') {
        statusesToShow.push('submitted');
      }

      const { data, error } = await supabase
        .from('budget_proposals')
        .select(`
          *,
          campaign:budget_proposal_campaigns(name, fiscal_year),
          department:departments(name)
        `)
        .eq('organization_id', profile.organization_id)
        .in('status', statusesToShow)
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      let filteredData = data || [];

      if (roleType === 'vice_president' && profile.department_id) {
        const { data: vpDepts } = await supabase
          .from('vice_president_departments')
          .select('department_id')
          .eq('vice_president_id', user.id);

        const deptIds = vpDepts?.map(d => d.department_id) || [];
        filteredData = filteredData.filter(p => deptIds.includes(p.department_id));
      }

      setProposals(filteredData);
    } catch (error) {
      console.error('Error loading proposals:', error);
      alert('Teklifler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  function openModal(proposalId: string, decisionType: 'approve' | 'reject' | 'revise') {
    setSelectedProposal(proposalId);
    setDecision(decisionType);
    setComments('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedProposal(null);
    setDecision(null);
    setComments('');
  }

  async function processDecision() {
    if (!selectedProposal || !decision || !roleType) return;

    try {
      setProcessing(true);

      const roleConfig = ROLE_STATUSES[roleType];
      let newStatus = '';

      if (decision === 'approve') {
        newStatus = roleConfig.nextStatus || roleConfig.approved;
        if (roleType === 'vice_president') {
          newStatus = roleConfig.approved;
        }
      } else if (decision === 'reject') {
        newStatus = roleConfig.rejected;
      } else if (decision === 'revise') {
        newStatus = roleConfig.rejected;
      }

      const { error: updateError } = await supabase
        .from('budget_proposals')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedProposal);

      if (updateError) throw updateError;

      const approvalLevel = roleType === 'vice_president' ? 'vice_president' :
                           roleType === 'finance' ? 'finance' : 'president';

      const approvalDecision = decision === 'approve' ? 'approved' :
                              decision === 'reject' ? 'rejected' : 'revision_requested';

      await supabase.from('budget_proposal_approvals').insert({
        proposal_id: selectedProposal,
        approval_level: approvalLevel,
        approver_id: user.id,
        approver_role: profile.role,
        decision: approvalDecision,
        comments: comments,
        decision_date: new Date().toISOString(),
      });

      await supabase.from('budget_proposal_history').insert({
        proposal_id: selectedProposal,
        change_type: 'status_changed',
        field_name: 'status',
        new_value: newStatus,
        changed_by: user.id,
        changed_by_name: profile.full_name,
        changed_by_role: profile.role,
        notes: comments,
      });

      if (comments) {
        await supabase.from('budget_proposal_comments').insert({
          proposal_id: selectedProposal,
          user_id: user.id,
          comment_text: comments,
          comment_type: decision === 'approve' ? 'approval_note' : 'revision_request',
        });
      }

      alert('İşlem başarılı!');
      closeModal();
      loadProposals();
    } catch (error) {
      console.error('Error processing decision:', error);
      alert('İşlem sırasında hata oluştu');
    } finally {
      setProcessing(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ₺';
  };

  if (!roleType) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Bu sayfaya erişim yetkiniz yok</p>
      </div>
    );
  }

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

  const roleTitle = roleType === 'vice_president' ? 'Başkan Yardımcısı' :
                    roleType === 'finance' ? 'Mali Hizmetler' : 'Başkan';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bütçe Onayları</h1>
          <p className="mt-1 text-sm text-gray-600">
            {roleTitle} onayı bekleyen teklifler ({proposals.length})
          </p>
        </div>
      </div>

      {proposals.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Bekleyen Teklif Yok</h3>
          <p className="mt-2 text-sm text-gray-600">
            Şu anda onayınız bekleyen bütçe teklifi bulunmuyor
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {proposal.department.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {proposal.campaign.name} - Mali Yıl {proposal.campaign.fiscal_year}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Gönderim: {new Date(proposal.submitted_at).toLocaleString('tr-TR')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">Yıl 1</p>
                  <p className="text-lg font-bold text-blue-900 mt-1">
                    {formatCurrency(proposal.total_year1)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Yıl 2</p>
                  <p className="text-lg font-bold text-green-900 mt-1">
                    {formatCurrency(proposal.total_year2)}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-600">Yıl 3</p>
                  <p className="text-lg font-bold text-purple-900 mt-1">
                    {formatCurrency(proposal.total_year3)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <a
                  href={`#budget-proposals/${proposal.id}`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Detay
                </a>
                <button
                  onClick={() => openModal(proposal.id, 'revise')}
                  className="inline-flex items-center px-4 py-2 border border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Düzeltme İste
                </button>
                <button
                  onClick={() => openModal(proposal.id, 'reject')}
                  className="inline-flex items-center px-4 py-2 border border-red-500 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reddet
                </button>
                <button
                  onClick={() => openModal(proposal.id, 'approve')}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Onayla
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {decision === 'approve' && 'Teklifi Onayla'}
                {decision === 'reject' && 'Teklifi Reddet'}
                {decision === 'revise' && 'Düzeltme Talep Et'}
              </h2>
            </div>

            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama / Yorumlar
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder={
                  decision === 'approve' ? 'Onay notunuzu yazın...' :
                  decision === 'reject' ? 'Red gerekçenizi yazın...' :
                  'Düzeltme talebinizi detaylı açıklayın...'
                }
                required={decision !== 'approve'}
              />
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={processing}
              >
                İptal
              </button>
              <button
                onClick={processDecision}
                disabled={processing || (decision !== 'approve' && !comments.trim())}
                className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
                  decision === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  decision === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {processing ? 'İşleniyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
