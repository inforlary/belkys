import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Send, XCircle, Edit2, MessageSquare, History, Download } from 'lucide-react';

interface Proposal {
  id: string;
  campaign_id: string;
  department_id: string;
  status: string;
  version: number;
  notes: string;
  total_year1: number;
  total_year2: number;
  total_year3: number;
  submitted_at: string;
  submitted_by: string;
  created_at: string;
  campaign: {
    name: string;
    fiscal_year: number;
  };
  department: {
    name: string;
  };
}

interface ProposalItem {
  id: string;
  program_id: string;
  sub_program_id: string;
  activity_id: string;
  indicator_id: string;
  institutional_code_id: string;
  expense_economic_code_id: string;
  financing_type_id: string;
  year1: number;
  year1_amount: number;
  year2: number;
  year2_amount: number;
  year3: number;
  year3_amount: number;
  increase_percentage: number;
  description: string;
  justification: string;
  year_end_estimate: string;
  program: { code: string; name: string };
  sub_program: { code: string; name: string };
  activity: { name: string };
  indicator: { code: string; name: string };
  institutional_code: { tam_kod: string; kurum_adi: string };
  expense_economic_code: { code: string; name: string };
  financing_type: { code: string; name: string };
}

interface Comment {
  id: string;
  user_id: string;
  comment_text: string;
  comment_type: string;
  created_at: string;
  user: {
    full_name: string;
    role: string;
  };
}

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  vp_review: 'Başkan Yrd. İnceliyor',
  vp_approved: 'Başkan Yrd. Onayladı',
  vp_revision_requested: 'Başkan Yrd. Düzeltme İstedi',
  finance_review: 'Mali Hizmetler İnceliyor',
  finance_approved: 'Mali Hizmetler Onayladı',
  finance_revision_requested: 'Mali Hizmetler Düzeltme İstedi',
  final_review: 'Başkan İnceliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

export default function BudgetProposalDetail() {
  const { user, profile } = useAuth();
  const { currentPath, navigate } = useLocation();
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const proposalId = currentPath.split('/')[1];

  useEffect(() => {
    if (user && profile && proposalId) {
      loadData();
    }
  }, [user, profile, proposalId]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: proposalData, error: proposalError } = await supabase
        .from('budget_proposals')
        .select(`
          *,
          campaign:budget_proposal_campaigns(name, fiscal_year),
          department:departments(name)
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError) throw proposalError;
      setProposal(proposalData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('budget_proposal_items')
        .select(`
          *,
          program:programs(code, name),
          sub_program:sub_programs(code, name),
          activity:activities(name),
          indicator:indicators(code, name),
          institutional_code:budget_institutional_codes(tam_kod, kurum_adi),
          expense_economic_code:expense_economic_codes(code, name),
          financing_type:financing_types(code, name)
        `)
        .eq('proposal_id', proposalId)
        .order('sort_order');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      const { data: commentsData, error: commentsError } = await supabase
        .from('budget_proposal_comments')
        .select(`
          *,
          user:profiles(full_name, role)
        `)
        .eq('proposal_id', proposalId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function submitProposal() {
    if (!confirm('Teklifi göndermek istediğinizden emin misiniz?')) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('budget_proposals')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
        })
        .eq('id', proposalId);

      if (error) throw error;

      await supabase.from('budget_proposal_history').insert({
        proposal_id: proposalId,
        change_type: 'status_changed',
        field_name: 'status',
        old_value: 'draft',
        new_value: 'submitted',
        changed_by: user.id,
        changed_by_name: profile.full_name,
        changed_by_role: profile.role,
        notes: 'Teklif gönderildi',
      });

      alert('Teklif başarıyla gönderildi!');
      loadData();
    } catch (error) {
      console.error('Error submitting proposal:', error);
      alert('Teklif gönderilirken hata oluştu');
    } finally {
      setSubmitting(false);
    }
  }

  async function addComment() {
    if (!newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('budget_proposal_comments')
        .insert({
          proposal_id: proposalId,
          user_id: user.id,
          comment_text: newComment,
          comment_type: 'note',
        });

      if (error) throw error;

      setNewComment('');
      loadData();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Yorum eklenirken hata oluştu');
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ₺';
  };

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

  if (!proposal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Teklif bulunamadı</p>
      </div>
    );
  }

  const canEdit = ['draft', 'vp_revision_requested', 'finance_revision_requested'].includes(proposal.status);
  const canSubmit = proposal.status === 'draft';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <a href="#budget-proposals" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-6 w-6" />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bütçe Teklifi Detayı</h1>
            <p className="mt-1 text-sm text-gray-600">
              {proposal.campaign.name} - {proposal.department.name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {canEdit && (
            <a
              href={`#budget-proposals/${proposalId}/edit`}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Edit2 className="h-5 w-5 mr-2" />
              Düzenle
            </a>
          )}
          {canSubmit && (
            <button
              onClick={submitProposal}
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-5 w-5 mr-2" />
              Gönder
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Durum</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {statusLabels[proposal.status]}
          </p>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg shadow">
          <p className="text-sm text-blue-600">Yıl 1 - {proposal.campaign.fiscal_year}</p>
          <p className="text-lg font-semibold text-blue-900 mt-2">
            {formatCurrency(proposal.total_year1)}
          </p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow">
          <p className="text-sm text-green-600">Yıl 2 - {proposal.campaign.fiscal_year + 1}</p>
          <p className="text-lg font-semibold text-green-900 mt-2">
            {formatCurrency(proposal.total_year2)}
          </p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg shadow">
          <p className="text-sm text-purple-600">Yıl 3 - {proposal.campaign.fiscal_year + 2}</p>
          <p className="text-lg font-semibold text-purple-900 mt-2">
            {formatCurrency(proposal.total_year3)}
          </p>
        </div>
      </div>

      {proposal.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800">Genel Notlar:</p>
          <p className="text-sm text-yellow-700 mt-1">{proposal.notes}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Bütçe Kalemleri ({items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program/Faaliyet</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gösterge</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ekonomik Kod</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Yıl 1</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Yıl 2</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Yıl 3</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {item.program?.code} - {item.program?.name}
                        </div>
                        <div className="text-gray-600">
                          {item.sub_program?.code} - {item.sub_program?.name}
                        </div>
                        {item.activity && (
                          <div className="text-gray-500 text-xs">{item.activity.name}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.indicator && (
                        <div>
                          <div className="font-medium text-gray-900">{item.indicator.code}</div>
                          <div className="text-gray-600 text-xs">{item.indicator.name}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.expense_economic_code && (
                        <div>
                          <div className="font-medium text-gray-900">{item.expense_economic_code.code}</div>
                          <div className="text-gray-600 text-xs">{item.expense_economic_code.name}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(item.year1_amount)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(item.year2_amount)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(item.year3_amount)}
                    </td>
                  </tr>
                  {(item.description || item.justification) && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-3">
                        {item.description && (
                          <div className="mb-2">
                            <span className="text-xs font-medium text-gray-700">Açıklama: </span>
                            <span className="text-xs text-gray-600">{item.description}</span>
                          </div>
                        )}
                        {item.justification && (
                          <div>
                            <span className="text-xs font-medium text-gray-700">Gerekçe: </span>
                            <span className="text-xs text-gray-600">{item.justification}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowComments(!showComments)}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Yorumlar ({comments.length})
        </button>
      </div>

      {showComments && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Yorumlar</h3>

          <div className="space-y-4 mb-6">
            {comments.map((comment) => (
              <div key={comment.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {comment.user?.full_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleString('tr-TR')}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{comment.comment_text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Yorum ekleyin..."
            />
            <button
              onClick={addComment}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Yorum Ekle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
