import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, AlertTriangle, Link as LinkIcon, Shield, ExternalLink, Unlink } from 'lucide-react';

interface ICRisk {
  id: string;
  risk_code: string;
  risk_title: string;
  risk_category: string;
  risk_description: string;
}

interface CollaborationPlanItem {
  id: string;
  plan_id: string;
  category: string;
  content: string;
  order_index: number;
  ic_risk_id: string | null;
  ic_risk?: ICRisk;
}

interface Props {
  collaborationPlanId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function CollaborationRiskManagement({ collaborationPlanId, onClose, onUpdate }: Props) {
  const { profile } = useAuth();
  const [risks, setRisks] = useState<CollaborationPlanItem[]>([]);
  const [icRisks, setIcRisks] = useState<ICRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [collaborationPlanId]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [risksRes, icRisksRes] = await Promise.all([
        supabase
          .from('collaboration_plan_items')
          .select(`
            *,
            ic_risk:ic_risks(id, risk_code, risk_title, risk_category, risk_description)
          `)
          .eq('plan_id', collaborationPlanId)
          .eq('category', 'risk')
          .order('order_index'),

        supabase
          .from('ic_risks')
          .select('id, risk_code, risk_title, risk_category, risk_description')
          .eq('organization_id', profile.organization_id)
          .neq('status', 'closed')
          .order('risk_code')
      ]);

      if (risksRes.error) throw risksRes.error;
      if (icRisksRes.error) throw icRisksRes.error;

      setRisks(risksRes.data || []);
      setIcRisks(icRisksRes.data || []);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkRisk = async (icRiskId: string) => {
    if (!selectedRiskId) return;

    try {
      const { error } = await supabase
        .from('collaboration_plan_items')
        .update({ ic_risk_id: icRiskId })
        .eq('id', selectedRiskId);

      if (error) throw error;

      setShowLinkModal(false);
      setSelectedRiskId(null);
      setSearchTerm('');
      loadData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Risk bağlama hatası:', error);
      alert('Risk bağlanırken hata oluştu');
    }
  };

  const handleUnlinkRisk = async (riskItemId: string) => {
    if (!confirm('İç kontrol riski bağlantısını kaldırmak istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('collaboration_plan_items')
        .update({ ic_risk_id: null })
        .eq('id', riskItemId);

      if (error) throw error;

      loadData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Bağlantı kaldırma hatası:', error);
      alert('Bağlantı kaldırılırken hata oluştu');
    }
  };

  const filteredIcRisks = icRisks.filter(risk => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      risk.risk_code.toLowerCase().includes(search) ||
      risk.risk_title.toLowerCase().includes(search) ||
      risk.risk_description.toLowerCase().includes(search)
    );
  });

  const linkedCount = risks.filter(r => r.ic_risk_id).length;
  const unlinkedCount = risks.length - linkedCount;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-7 h-7 text-blue-600" />
                  Riskleri İç Kontrole Bağla
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  İşbirliği planındaki riskleri iç kontrol sisteminize bağlayın
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{risks.length}</div>
                <div className="text-sm text-blue-700 mt-1">Toplam Risk</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{linkedCount}</div>
                <div className="text-sm text-green-700 mt-1">Bağlantılı</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{unlinkedCount}</div>
                <div className="text-sm text-orange-700 mt-1">Bağlantısız</div>
              </div>
            </div>

            {risks.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Bu işbirliği planında henüz risk tanımlanmamış</p>
              </div>
            ) : (
              <div className="space-y-3">
                {risks.map((risk) => (
                  <div
                    key={risk.id}
                    className={`border rounded-lg p-4 ${
                      risk.ic_risk_id ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {risk.ic_risk_id ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">
                              <Shield className="w-3 h-3" />
                              Bağlantılı
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white rounded text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Bağlantısız
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900 font-medium mb-2">{risk.content}</p>
                        {risk.ic_risk && (
                          <div className="flex items-center gap-2 p-3 bg-white rounded border border-green-300">
                            <LinkIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">
                                {risk.ic_risk.risk_code} - {risk.ic_risk.risk_title}
                              </p>
                              <p className="text-xs text-green-700 mt-1">
                                {risk.ic_risk.risk_description.substring(0, 100)}...
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {risk.ic_risk_id ? (
                          <button
                            onClick={() => handleUnlinkRisk(risk.id)}
                            className="flex items-center gap-1 px-3 py-2 text-red-700 bg-red-100 hover:bg-red-200 rounded"
                            title="Bağlantıyı Kaldır"
                          >
                            <Unlink className="w-4 h-4" />
                            <span className="text-sm">Kaldır</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedRiskId(risk.id);
                              setShowLinkModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-2 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded"
                            title="İç Kontrole Bağla"
                          >
                            <LinkIcon className="w-4 h-4" />
                            <span className="text-sm">Bağla</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">İç Kontrol Riski Seç</h3>
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setSelectedRiskId(null);
                    setSearchTerm('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Risk kodu, başlık veya açıklama ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {filteredIcRisks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p>İç kontrol riski bulunamadı</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIcRisks.map((icRisk) => (
                    <button
                      key={icRisk.id}
                      onClick={() => handleLinkRisk(icRisk.id)}
                      className="w-full text-left border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">
                            {icRisk.risk_code} - {icRisk.risk_title}
                          </p>
                          <p className="text-sm text-gray-600">
                            {icRisk.risk_description}
                          </p>
                          <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {icRisk.risk_category}
                          </span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
