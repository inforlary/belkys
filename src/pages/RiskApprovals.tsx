import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { CheckCircle, XCircle, Clock, Eye, AlertTriangle, FileText } from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
  description: string;
  owner_department_id: string;
  goal_id: string;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  risk_response: string;
  status: string;
  approval_status: string;
  created_at: string;
  submitted_at: string | null;
  submitted_by_id: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  approved_at: string | null;
  approved_by_id: string | null;
  rejection_reason: string | null;
  categories?: Array<{
    category_id: string;
    category: {
      id: string;
      name: string;
      code: string;
      color: string;
    };
  }>;
  department?: {
    name: string;
  };
  related_goal?: {
    code: string;
    title: string;
  };
  submitted_by?: {
    full_name: string;
  };
  reviewed_by?: {
    full_name: string;
  };
  approved_by?: {
    full_name: string;
  };
}

function getApprovalStatusBadge(status: string) {
  const statusMap: Record<string, { color: string; emoji: string; label: string }> = {
    DRAFT: { color: 'bg-gray-200 text-gray-800', emoji: '📝', label: 'Taslak' },
    IN_REVIEW: { color: 'bg-blue-100 text-blue-700', emoji: '👀', label: 'İncelemede' },
    PENDING_APPROVAL: { color: 'bg-yellow-100 text-yellow-700', emoji: '⏳', label: 'Onay Bekliyor' },
    APPROVED: { color: 'bg-green-100 text-green-700', emoji: '✅', label: 'Onaylandı' },
    REJECTED: { color: 'bg-red-100 text-red-700', emoji: '❌', label: 'Reddedildi' },
  };
  return statusMap[status] || { color: 'bg-gray-200 text-gray-800', emoji: '❓', label: status };
}

function getRiskScoreBadge(score: number) {
  if (score >= 15) return { color: 'bg-red-600 text-white', emoji: '🔴', label: 'Çok Yüksek' };
  if (score >= 10) return { color: 'bg-red-500 text-white', emoji: '🟠', label: 'Yüksek' };
  if (score >= 6) return { color: 'bg-yellow-500 text-white', emoji: '🟡', label: 'Orta' };
  if (score >= 3) return { color: 'bg-blue-500 text-white', emoji: '🔵', label: 'Düşük' };
  return { color: 'bg-green-500 text-white', emoji: '🟢', label: 'Çok Düşük' };
}

function getRiskResponseLabel(response: string) {
  const responseMap: Record<string, string> = {
    ACCEPT: 'Kabul Et',
    MITIGATE: 'Azalt',
    TRANSFER: 'Transfer Et',
    AVOID: 'Kaçın'
  };
  return responseMap[response] || response;
}

export default function RiskApprovals() {
  const { profile } = useAuth();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    fetchRisks();
  }, [profile?.organization_id, activeTab]);

  async function fetchRisks() {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      let query = supabase
        .from('risks')
        .select(`
          *,
          categories:risk_category_mappings(
            category_id,
            category:risk_categories(id, name, code)
          ),
          department:departments!owner_department_id(name),
          related_goal:goals!goal_id(code, title),
          submitted_by:profiles!risks_submitted_by_id_fkey(full_name),
          reviewed_by:profiles!risks_reviewed_by_id_fkey(full_name),
          approved_by:profiles!risks_approved_by_id_fkey(full_name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        if (profile.role === 'DIRECTOR') {
          query = query.in('approval_status', ['IN_REVIEW']);
        } else if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
          query = query.in('approval_status', ['PENDING_APPROVAL']);
        }
      } else {
        query = query.in('approval_status', ['APPROVED', 'REJECTED']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRisks(data || []);
    } catch (error) {
      console.error('Error fetching risks:', error);
      alert('Riskler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function handleDirectorReview(riskId: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Lütfen red gerekçesi giriniz');
      return;
    }

    try {
      setProcessing(true);

      const updateData: any = {
        reviewed_at: new Date().toISOString(),
        reviewed_by_id: profile?.id
      };

      if (action === 'approve') {
        updateData.approval_status = 'PENDING_APPROVAL';
      } else {
        updateData.approval_status = 'REJECTED';
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('risks')
        .update(updateData)
        .eq('id', riskId);

      if (error) throw error;

      alert(action === 'approve' ? 'Risk yönetici onayına gönderildi' : 'Risk reddedildi');
      setShowDetailModal(false);
      setShowRejectModal(false);
      setRejectionReason('');
      fetchRisks();
    } catch (error) {
      console.error('Error reviewing risk:', error);
      alert('İşlem sırasında bir hata oluştu');
    } finally {
      setProcessing(false);
    }
  }

  async function handleAdminApproval(riskId: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Lütfen red gerekçesi giriniz');
      return;
    }

    try {
      setProcessing(true);

      const updateData: any = {
        approved_at: new Date().toISOString(),
        approved_by_id: profile?.id
      };

      if (action === 'approve') {
        updateData.approval_status = 'APPROVED';
        updateData.status = 'ACTIVE';
      } else {
        updateData.approval_status = 'REJECTED';
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('risks')
        .update(updateData)
        .eq('id', riskId);

      if (error) throw error;

      alert(action === 'approve' ? 'Risk onaylandı' : 'Risk reddedildi');
      setShowDetailModal(false);
      setShowRejectModal(false);
      setRejectionReason('');
      fetchRisks();
    } catch (error) {
      console.error('Error approving risk:', error);
      alert('İşlem sırasında bir hata oluştu');
    } finally {
      setProcessing(false);
    }
  }

  const canReview = profile?.role === 'DIRECTOR';
  const canApprove = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Risk Onayları</h1>
          <p className="text-gray-600 mt-1">
            {canReview && 'Müdür olarak riskleri inceleyin ve yöneticiye gönderin'}
            {canApprove && 'Yönetici olarak riskleri onaylayın'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Bekleyen Onaylar
            {risks.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {risks.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Onay Geçmişi
          </div>
        </button>
      </div>

      {risks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'pending' ? 'Bekleyen onay bulunmuyor' : 'Geçmiş onay bulunmuyor'}
            </h3>
            <p className="text-gray-600">
              {activeTab === 'pending'
                ? 'Şu anda onay bekleyen risk bulunmamaktadır'
                : 'Henüz onaylanmış veya reddedilmiş risk bulunmamaktadır'}
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Kodu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Adı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategoriler
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Birim
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doğal Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Artık Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {risks.map((risk) => {
                  const inherentBadge = getRiskScoreBadge(risk.inherent_score);
                  const residualBadge = getRiskScoreBadge(risk.residual_score);
                  const statusBadge = getApprovalStatusBadge(risk.approval_status);

                  return (
                    <tr key={risk.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{risk.code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{risk.name}</div>
                        {risk.description && (
                          <div className="text-sm text-gray-500 line-clamp-2">{risk.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {risk.categories?.map((cat) => (
                            <span
                              key={cat.category_id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: cat.category.color + '20', color: cat.category.color }}
                            >
                              {cat.category.code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{risk.department?.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${inherentBadge.color}`}>
                          {inherentBadge.emoji} {risk.inherent_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${residualBadge.color}`}>
                          {residualBadge.emoji} {risk.residual_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                          {statusBadge.emoji} {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setSelectedRisk(risk);
                            setShowDetailModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showDetailModal && selectedRisk && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full my-8">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Risk Detayı</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Risk Kodu</label>
                  <p className="text-gray-900">{selectedRisk.code}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                  {(() => {
                    const badge = getApprovalStatusBadge(selectedRisk.approval_status);
                    return (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
                        {badge.emoji} {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Adı</label>
                <p className="text-gray-900">{selectedRisk.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Açıklaması</label>
                <p className="text-gray-900">{selectedRisk.description || '-'}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Birim</label>
                  <p className="text-gray-900">{selectedRisk.department?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Risk Kategorileri</label>
                  <div className="flex flex-wrap gap-1">
                    {selectedRisk.categories?.map((cat) => (
                      <span
                        key={cat.category_id}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: cat.category.color + '20', color: cat.category.color }}
                      >
                        {cat.category.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Doğal Risk Değerlendirmesi</label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">Olasılık</span>
                      <span className="font-semibold">{selectedRisk.inherent_likelihood}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">Etki</span>
                      <span className="font-semibold">{selectedRisk.inherent_impact}</span>
                    </div>
                    <div className="border-t border-blue-300 pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Risk Skoru</span>
                        <span className="text-xl font-bold">{selectedRisk.inherent_score}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Artık Risk Değerlendirmesi</label>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">Olasılık</span>
                      <span className="font-semibold">{selectedRisk.residual_likelihood}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">Etki</span>
                      <span className="font-semibold">{selectedRisk.residual_impact}</span>
                    </div>
                    <div className="border-t border-orange-300 pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Risk Skoru</span>
                        <span className="text-xl font-bold">{selectedRisk.residual_score}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Yanıt Stratejisi</label>
                <p className="text-gray-900">{getRiskResponseLabel(selectedRisk.risk_response)}</p>
              </div>

              {selectedRisk.submitted_by && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gönderen</label>
                      <p className="text-gray-900">{selectedRisk.submitted_by.full_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gönderim Tarihi</label>
                      <p className="text-gray-900">
                        {selectedRisk.submitted_at ? new Date(selectedRisk.submitted_at).toLocaleDateString('tr-TR') : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedRisk.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-red-700 mb-2">Red Gerekçesi</label>
                  <p className="text-red-900">{selectedRisk.rejection_reason}</p>
                </div>
              )}
            </div>

            {activeTab === 'pending' && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Kapat
                </button>

                {canReview && selectedRisk.approval_status === 'IN_REVIEW' && (
                  <>
                    <button
                      onClick={() => {
                        setShowRejectModal(true);
                      }}
                      disabled={processing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      Reddet
                    </button>
                    <button
                      onClick={() => handleDirectorReview(selectedRisk.id, 'approve')}
                      disabled={processing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Yöneticiye Gönder
                    </button>
                  </>
                )}

                {canApprove && selectedRisk.approval_status === 'PENDING_APPROVAL' && (
                  <>
                    <button
                      onClick={() => {
                        setShowRejectModal(true);
                      }}
                      disabled={processing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      Reddet
                    </button>
                    <button
                      onClick={() => handleAdminApproval(selectedRisk.id, 'approve')}
                      disabled={processing}
                      className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Onayla
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showRejectModal && selectedRisk && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Risk Reddetme Gerekçesi</h3>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gerekçe <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Reddetme gerekçesini detaylı olarak açıklayınız..."
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (canReview) {
                    handleDirectorReview(selectedRisk.id, 'reject');
                  } else if (canApprove) {
                    handleAdminApproval(selectedRisk.id, 'reject');
                  }
                }}
                disabled={!rejectionReason.trim() || processing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
