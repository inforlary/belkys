import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Download, Calendar, FileText } from 'lucide-react';
import { exportToExcel } from '../../utils/exportHelpers';
import { generateStrategicPlanPDF } from '../../utils/reportPDFGenerators';

interface PlanSummary {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  objectives_count: number;
  goals_count: number;
  indicators_count: number;
}

export default function StrategicPlanSummary() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) {
      console.log('No organization_id found in profile');
      return;
    }

    try {
      const { data: plansData, error: plansError } = await supabase
        .from('strategic_plans')
        .select('id, name, start_year, end_year')
        .eq('organization_id', profile.organization_id)
        .order('start_year', { ascending: false });

      if (plansError) {
        console.error('Stratejik planlar yüklenirken hata:', plansError);
        throw plansError;
      }

      console.log('Stratejik planlar yüklendi:', plansData);

      if (plansData && plansData.length > 0) {
        const summaries = await Promise.all(
          plansData.map(async (plan) => {
            const { data: objectives, count: objectivesCount } = await supabase
              .from('objectives')
              .select('id', { count: 'exact' })
              .eq('strategic_plan_id', plan.id);

            if (!objectives || objectives.length === 0) {
              return {
                id: plan.id,
                name: plan.name,
                start_year: plan.start_year,
                end_year: plan.end_year,
                objectives_count: 0,
                goals_count: 0,
                indicators_count: 0,
              };
            }

            const objectiveIds = objectives.map(o => o.id);

            let goalsQuery = supabase
              .from('goals')
              .select('id', { count: 'exact' })
              .in('objective_id', objectiveIds);

            if (profile.role !== 'admin' && profile.role !== 'manager' && profile.department_id) {
              goalsQuery = goalsQuery.eq('department_id', profile.department_id);
            }

            const { data: goals, count: goalsCount } = await goalsQuery;

            let indicatorCount = 0;
            if (goals && goals.length > 0) {
              const goalIds = goals.map(g => g.id);
              const { count } = await supabase
                .from('indicators')
                .select('id', { count: 'exact', head: true })
                .in('goal_id', goalIds);
              indicatorCount = count || 0;
            }

            return {
              id: plan.id,
              name: plan.name,
              start_year: plan.start_year,
              end_year: plan.end_year,
              objectives_count: objectivesCount || 0,
              goals_count: goalsCount || 0,
              indicators_count: indicatorCount,
            };
          })
        );

        setPlans(summaries);
      } else {
        setPlans([]);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = plans.map(plan => ({
      'Stratejik Plan': plan.name,
      'Başlangıç Yılı': plan.start_year,
      'Bitiş Yılı': plan.end_year,
      'Amaç Sayısı': plan.objectives_count,
      'Hedef Sayısı': plan.goals_count,
      'Gösterge Sayısı': plan.indicators_count,
    }));

    exportToExcel(exportData, 'Stratejik_Plan_Ozeti');
  };

  const handlePDFExport = () => {
    generateStrategicPlanPDF(plans);
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stratejik Plan Özet Raporu</h2>
          <p className="text-sm text-slate-600 mt-1">
            Tüm stratejik planların genel durumu
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePDFExport}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF'e Aktar
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <p className="text-slate-500">Henüz stratejik plan bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {plan.start_year} - {plan.end_year}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{plan.objectives_count}</div>
                  <div className="text-sm text-slate-600 mt-1">Amaç</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{plan.goals_count}</div>
                  <div className="text-sm text-slate-600 mt-1">Hedef</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-orange-600">{plan.indicators_count}</div>
                  <div className="text-sm text-slate-600 mt-1">Gösterge</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
