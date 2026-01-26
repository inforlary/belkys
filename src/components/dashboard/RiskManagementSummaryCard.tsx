import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, TrendingDown, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface RiskDistribution {
  level: string;
  count: number;
  color: string;
}

export default function RiskManagementSummaryCard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [criticalRisks, setCriticalRisks] = useState(0);
  const [highRisks, setHighRisks] = useState(0);
  const [totalRisks, setTotalRisks] = useState(0);
  const [controlEffectiveness, setControlEffectiveness] = useState(0);
  const [riskDistribution, setRiskDistribution] = useState<RiskDistribution[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadRiskSummary();
    }
  }, [profile?.organization_id]);

  const loadRiskSummary = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const { data: risks, count } = await supabase
        .from('risks')
        .select('id, risk_level, residual_risk_score', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active');

      setTotalRisks(count || 0);

      const critical = risks?.filter(r => r.risk_level === 'Kritik' || r.risk_level === 'critical').length || 0;
      const high = risks?.filter(r => r.risk_level === 'Yüksek' || r.risk_level === 'high').length || 0;

      setCriticalRisks(critical);
      setHighRisks(high);

      const distribution: RiskDistribution[] = [
        { level: 'Kritik', count: critical, color: 'bg-red-500' },
        { level: 'Yüksek', count: high, color: 'bg-orange-500' },
        { level: 'Orta', count: risks?.filter(r => r.risk_level === 'Orta' || r.risk_level === 'medium').length || 0, color: 'bg-yellow-500' },
        { level: 'Düşük', count: risks?.filter(r => r.risk_level === 'Düşük' || r.risk_level === 'low').length || 0, color: 'bg-green-500' },
      ];

      setRiskDistribution(distribution);

      const { data: controls } = await supabase
        .from('risk_controls')
        .select('effectiveness_rating')
        .eq('organization_id', profile.organization_id);

      if (controls && controls.length > 0) {
        const avgEffectiveness = controls.reduce((sum, c) => sum + (c.effectiveness_rating || 0), 0) / controls.length;
        setControlEffectiveness(avgEffectiveness);
      }

    } catch (error) {
      console.error('Error loading risk summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (count: number) => {
    if (count >= 5) return 'text-red-600';
    if (count >= 3) return 'text-orange-600';
    return 'text-green-600';
  };

  const getSeverityBg = (count: number) => {
    if (count >= 5) return 'bg-red-50';
    if (count >= 3) return 'bg-orange-50';
    return 'bg-green-50';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Risk Yönetimi Özeti</h3>
            <p className="text-sm text-slate-500">Risk dağılımı ve kontrol etkinliği</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`${getSeverityBg(criticalRisks)} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Kritik Riskler</p>
              <p className={`text-2xl font-bold ${getSeverityColor(criticalRisks)}`}>
                {criticalRisks}
              </p>
            </div>
            <AlertTriangle className={`w-8 h-8 ${getSeverityColor(criticalRisks)}`} />
          </div>
        </div>

        <div className={`${getSeverityBg(highRisks)} p-4 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Yüksek Riskler</p>
              <p className={`text-2xl font-bold ${getSeverityColor(highRisks)}`}>
                {highRisks}
              </p>
            </div>
            <TrendingDown className={`w-8 h-8 ${getSeverityColor(highRisks)}`} />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Kontrol Etkinliği</p>
              <p className="text-2xl font-bold text-blue-600">
                %{(controlEffectiveness * 20).toFixed(0)}
              </p>
            </div>
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
          <Activity className="w-4 h-4 mr-2" />
          Risk Dağılımı
        </h4>
        <div className="space-y-3">
          {riskDistribution.map((dist, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-700 font-medium">{dist.level}</span>
                <span className="text-sm text-slate-600">{dist.count} Risk</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`${dist.color} h-2 rounded-full transition-all duration-300`}
                  style={{ width: totalRisks > 0 ? `${(dist.count / totalRisks) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Toplam Risk</span>
          <span className="font-semibold text-slate-900">{totalRisks}</span>
        </div>
      </div>
    </div>
  );
}
