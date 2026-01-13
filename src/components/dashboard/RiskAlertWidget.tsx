import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface RiskAlert {
  id: string;
  code: string;
  name: string;
  risk_level: string;
  residual_risk_score?: number;
  created_at: string;
}

const riskLevelConfig = {
  low: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Düşük Risk' },
  medium: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Orta Risk' },
  high: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Yüksek Risk' },
  critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', label: 'Kritik Risk' }
};

export default function RiskAlertWidget() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) loadAlerts();
  }, [profile]);

  const loadAlerts = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data: risksData, error } = await supabase
        .from('risks')
        .select('id, code, name, risk_level, residual_risk_score, created_at')
        .eq('organization_id', profile.organization_id)
        .in('risk_level', ['high', 'critical'])
        .order('residual_risk_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      setAlerts(risksData || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Risk Uyarıları</h3>
        </CardHeader>
        <CardBody>
          <div className="text-center py-4 text-gray-500">Yükleniyor...</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Risk Uyarıları</h3>
          {alerts.length > 0 && (
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {alerts.length} Aktif
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-gray-600">Aktif risk uyarısı bulunmuyor</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => {
              const config = riskLevelConfig[alert.risk_level as keyof typeof riskLevelConfig];
              const Icon = config.icon;

              return (
                <div key={alert.id} className={`p-3 rounded-lg ${config.bg} border border-gray-200`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 ${config.color} mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {alert.residual_risk_score && (
                          <span className="text-xs font-semibold text-gray-700">
                            Skor: {alert.residual_risk_score}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(alert.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {alert.code} - {alert.name}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
