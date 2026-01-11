import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../hooks/useLocation';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { AlertTriangle, Shield, TrendingUp } from 'lucide-react';

interface GoalWithRisks {
  id: string;
  code: string;
  title: string;
  risk_appetite_max_score: number;
  riskCount: number;
  exceedingRiskCount: number;
  highestRiskScore: number;
}

export default function RiskAppetiteWidget() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [goalsExceedingAppetite, setGoalsExceedingAppetite] = useState<GoalWithRisks[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const [goalsRes, risksRes] = await Promise.all([
        supabase
          .from('goals')
          .select('id, code, title, risk_appetite_max_score')
          .eq('organization_id', profile.organization_id)
          .not('risk_appetite_max_score', 'is', null),
        supabase
          .from('risks')
          .select('id, goal_id, residual_score')
          .eq('organization_id', profile.organization_id)
          .in('status', ['ACTIVE', 'MONITORING'])
          .not('goal_id', 'is', null)
      ]);

      if (goalsRes.error) throw goalsRes.error;
      if (risksRes.error) throw risksRes.error;

      const goals = goalsRes.data || [];
      const risks = risksRes.data || [];

      const goalsWithExceedingRisks: GoalWithRisks[] = goals
        .map(goal => {
          const goalRisks = risks.filter(r => r.goal_id === goal.id);
          const exceedingRisks = goalRisks.filter(
            r => r.residual_score > (goal.risk_appetite_max_score || 0)
          );
          const highestRiskScore = goalRisks.length > 0
            ? Math.max(...goalRisks.map(r => r.residual_score))
            : 0;

          return {
            id: goal.id,
            code: goal.code,
            title: goal.title,
            risk_appetite_max_score: goal.risk_appetite_max_score || 0,
            riskCount: goalRisks.length,
            exceedingRiskCount: exceedingRisks.length,
            highestRiskScore
          };
        })
        .filter(goal => goal.exceedingRiskCount > 0)
        .sort((a, b) => b.exceedingRiskCount - a.exceedingRiskCount)
        .slice(0, 5);

      setGoalsExceedingAppetite(goalsWithExceedingRisks);
    } catch (error) {
      console.error('Error loading risk appetite data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Risk İştahını Aşan Hedefler</h3>
          </div>
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
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Risk İştahını Aşan Hedefler</h3>
          </div>
          {goalsExceedingAppetite.length > 0 && (
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {goalsExceedingAppetite.length} Hedef
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {goalsExceedingAppetite.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-gray-600">Tüm hedefler risk iştahı sınırları içinde</p>
            <p className="text-sm text-gray-500 mt-1">Risk yönetimi hedeflerle uyumlu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {goalsExceedingAppetite.map(goal => (
              <button
                key={goal.id}
                onClick={() => navigate('risk-management/risks?goal=' + goal.id)}
                className="w-full p-3 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                        {goal.code}
                      </span>
                      <span className="text-xs text-red-600 font-medium">
                        {goal.exceedingRiskCount} risk iştahı aşıyor
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1 truncate">
                      {goal.title}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {goal.riskCount} toplam risk
                      </span>
                      <span>•</span>
                      <span>
                        İştah limiti: {goal.risk_appetite_max_score}
                      </span>
                      <span>•</span>
                      <span className="text-red-600 font-medium">
                        En yüksek: {goal.highestRiskScore}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
