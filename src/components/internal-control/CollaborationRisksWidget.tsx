import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, AlertTriangle, Shield, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import { useLocation } from '../../hooks/useLocation';

interface CollaborationRisk {
  id: string;
  content: string;
  ic_risk_id: string | null;
  plan_id: string;
  collaboration_plan?: {
    title: string;
    goal?: {
      code: string;
      title: string;
    };
  };
}

export default function CollaborationRisksWidget() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [risks, setRisks] = useState<CollaborationRisk[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    unsynced: 0,
    critical: 0,
    high: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollaborationRisks();
  }, [profile?.organization_id]);

  const loadCollaborationRisks = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const { data: planData, error: planError } = await supabase
        .from('collaboration_plans')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (planError) throw planError;

      const planIds = planData?.map(p => p.id) || [];

      if (planIds.length === 0) {
        setStats({ total: 0, synced: 0, unsynced: 0, critical: 0, high: 0 });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('collaboration_plan_items')
        .select(`
          *,
          collaboration_plan:collaboration_plans(
            title,
            goal:goals(code, title)
          )
        `)
        .eq('category', 'risk')
        .in('plan_id', planIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setRisks(data || []);

      const total = data?.length || 0;
      const synced = data?.filter(r => r.ic_risk_id !== null).length || 0;

      setStats({
        total,
        synced,
        unsynced: total - synced,
        critical: 0,
        high: 0
      });
    } catch (error) {
      console.error('İşbirliği riskleri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">İşbirliği Planı Riskleri</h3>
              <p className="text-xs text-gray-500 mt-0.5">Stratejik planlama entegrasyonu</p>
            </div>
          </div>
          <button
            onClick={() => navigate?.('/collaboration-planning')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
          >
            Tümünü Gör
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-blue-700 mt-1">Toplam Risk</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
            <div className="text-xs text-green-700 mt-1">Bağlantılı</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.unsynced}</div>
            <div className="text-xs text-orange-700 mt-1">Bağlantısız</div>
          </div>
        </div>

        {risks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm">Henüz işbirliği riski bulunmuyor</p>
          </div>
        ) : (
          <div className="space-y-3">
            {risks.slice(0, 5).map((risk) => (
              <div
                key={risk.id}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {risk.ic_risk_id ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                          <Shield className="w-3 h-3" />
                          Bağlantılı
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Bağlantısız
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {risk.content}
                    </p>
                    {risk.collaboration_plan?.goal && (
                      <p className="text-xs text-gray-500 mt-1">
                        {risk.collaboration_plan.goal.code} - {risk.collaboration_plan.title}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {risks.length > 5 && (
              <div className="text-center pt-3 border-t border-gray-200">
                <button
                  onClick={() => navigate?.('/collaboration-planning')}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  +{risks.length - 5} risk daha göster
                </button>
              </div>
            )}
          </div>
        )}

        {stats.unsynced > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  {stats.unsynced} risk iç kontrol sistemine entegre edilmemiş
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  İşbirliği Planlama sayfasından risklerinizi iç kontrole bağlayabilirsiniz
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
