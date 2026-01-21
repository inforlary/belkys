import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { IndicatorForm } from '../components/IndicatorForm';
import { Plus, Edit2, Trash2, Search, TrendingUp, Download, ChevronDown, ChevronRight, Target } from 'lucide-react';
import { generateIndicatorReport } from '../utils/exportHelpers';
import { calculateIndicatorProgress, getProgressColor } from '../utils/progressCalculations';

interface Indicator {
  id: string;
  goal_id: string;
  code: string;
  name: string;
  unit: string;
  baseline_value: number;
  current_value: number;
  target_value: number | null;
  yearly_target?: number | null;
  measurement_frequency: string;
  reporting_frequency?: string | null;
  calculation_method?: string;
  goal_impact_percentage?: number | null;
  goal?: {
    title: string;
    code: string;
    objective_id?: string;
    objective?: {
      code: string;
      title: string;
    };
  };
}

interface Goal {
  id: string;
  code: string;
  title: string;
  objective_id: string;
  department_id?: string | null;
  objective?: {
    code: string;
    title: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface GoalGroup {
  goal_id: string;
  goal_code: string;
  goal_title: string;
  objective_code: string;
  objective_title: string;
  department_id?: string | null;
  indicators: Indicator[];
}

interface StrategicPlan {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
}

interface DataEntry {
  indicator_id: string;
  value: number;
  status: string;
}

export default function Indicators() {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [strategicPlans, setStrategicPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StrategicPlan | null>(null);
  const [dataEntries, setDataEntries] = useState<DataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  const naturalSort = (a: string, b: string): number => {
    const regex = /(\d+)|(\D+)/g;
    const aParts = a.match(regex) || [];
    const bParts = b.match(regex) || [];

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || '';
      const bPart = bParts[i] || '';

      const aNum = parseInt(aPart);
      const bNum = parseInt(bPart);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        if (aNum !== bNum) return aNum - bNum;
      } else {
        if (aPart !== bPart) return aPart.localeCompare(bPart);
      }
    }

    return 0;
  };

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const allPlansRes = await supabase
        .from('strategic_plans')
        .select('id, name, start_year, end_year')
        .eq('organization_id', profile.organization_id)
        .order('start_year', { ascending: false });

      if (allPlansRes.data) {
        const years = new Set<number>();
        allPlansRes.data.forEach(plan => {
          for (let year = plan.start_year; year <= plan.end_year; year++) {
            years.add(year);
          }
        });
        setAvailableYears(Array.from(years).sort((a, b) => b - a));
        setStrategicPlans(allPlansRes.data);
      }

      const relevantPlans = allPlansRes.data?.filter(plan =>
        selectedYear >= plan.start_year && selectedYear <= plan.end_year
      ) || [];

      const relevantObjectivesRes = await supabase
        .from('objectives')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .in('strategic_plan_id', relevantPlans.map(p => p.id));

      const relevantObjectiveIds = relevantObjectivesRes.data?.map(o => o.id) || [];

      const relevantGoalsRes = await supabase
        .from('goals')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .in('objective_id', relevantObjectiveIds);

      const relevantGoalIds = relevantGoalsRes.data?.map(g => g.id) || [];

      const [indicatorsRes, goalsRes, deptsRes, plansRes, entriesRes, targetsRes] = await Promise.all([
        supabase
          .from('indicators')
          .select(`
            *,
            goals!inner(title, code, department_id)
          `)
          .eq('organization_id', profile.organization_id)
          .in('goal_id', relevantGoalIds)
          .order('code', { ascending: true }),
        supabase
          .from('goals')
          .select('id, code, title, department_id')
          .eq('organization_id', profile.organization_id)
          .in('id', relevantGoalIds)
          .order('code', { ascending: true }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name', { ascending: true }),
        supabase
          .from('strategic_plans')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status, period_year')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', selectedYear)
          .in('status', ['approved', 'submitted']),
        supabase
          .from('indicator_targets')
          .select(`
            indicator_id,
            year,
            target_value,
            indicators!inner(organization_id)
          `)
          .eq('year', selectedYear)
          .eq('indicators.organization_id', profile.organization_id)
      ]);

      if (indicatorsRes.error) throw indicatorsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (deptsRes.error) throw deptsRes.error;
      if (plansRes.error) throw plansRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (targetsRes.error) throw targetsRes.error;

      const entriesByIndicator: Record<string, number> = {};
      entriesRes.data?.forEach(entry => {
        if (!entriesByIndicator[entry.indicator_id]) {
          entriesByIndicator[entry.indicator_id] = 0;
        }
        entriesByIndicator[entry.indicator_id] += entry.value;
      });

      const targetsByIndicator: Record<string, number> = {};
      targetsRes.data?.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      setDataEntries(entriesRes.data || []);
      setIndicators(indicatorsRes.data?.map(ind => ({
        ...ind,
        goal: ind.goals,
        yearly_target: targetsByIndicator[ind.id] || null,
        current_value: entriesByIndicator[ind.id] || 0
      })) || []);
      setGoals(goalsRes.data || []);
      setDepartments(deptsRes.data || []);
      setStrategicPlans(plansRes.data || []);

      if (plansRes.data && plansRes.data.length > 0) {
        setSelectedPlan(plansRes.data[0]);
      }
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu göstergeyi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('indicators')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Gösterge silinirken hata:', error);
      alert('Gösterge silinirken bir hata oluştu');
    }
  };

  const handleEdit = (indicator: Indicator) => {
    setEditingIndicator(indicator);
    setSelectedGoal(indicator.goal_id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingIndicator(null);
    setSelectedGoal('');
  };

  const handleSuccess = () => {
    handleCloseModal();
    loadData();
  };

  const groupIndicatorsByGoal = (): GoalGroup[] => {
    const grouped = new Map<string, GoalGroup>();

    indicators.forEach(indicator => {
      if (!indicator.goal) return;

      const goalId = indicator.goal_id;
      if (!grouped.has(goalId)) {
        const goal = goals.find(g => g.id === goalId);
        grouped.set(goalId, {
          goal_id: goalId,
          goal_code: indicator.goal.code,
          goal_title: indicator.goal.title,
          objective_code: goal?.objective?.code || indicator.goal.objective?.code || '',
          objective_title: goal?.objective?.title || indicator.goal.objective?.title || '',
          department_id: goal?.department_id || null,
          indicators: []
        });
      }
      grouped.get(goalId)!.indicators.push(indicator);
    });

    const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
      const objCompare = naturalSort(a.objective_code, b.objective_code);
      if (objCompare !== 0) return objCompare;
      return naturalSort(a.goal_code, b.goal_code);
    });

    sortedGroups.forEach(group => {
      group.indicators.sort((a, b) => naturalSort(a.code, b.code));
    });

    return sortedGroups;
  };

  const filteredGroups = groupIndicatorsByGoal().filter(group => {
    if (selectedDepartment && group.department_id !== selectedDepartment) {
      return false;
    }

    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      group.objective_title.toLowerCase().includes(search) ||
      group.objective_code.toLowerCase().includes(search) ||
      group.goal_title.toLowerCase().includes(search) ||
      group.goal_code.toLowerCase().includes(search) ||
      group.indicators.some(ind =>
        ind.name.toLowerCase().includes(search) ||
        ind.code.toLowerCase().includes(search) ||
        ind.unit.toLowerCase().includes(search)
      )
    );
  });

  const toggleGoal = (goalId: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  const measurementFrequencyLabels = {
    monthly: 'Aylık',
    quarterly: '3 Aylık',
    semi_annual: '6 Aylık',
    annual: 'Yıllık',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performans Göstergeleri</h1>
          <p className="text-gray-600 mt-1">Hedeflere bağlı performans göstergelerini yönetin</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => generateIndicatorReport(indicators)}
            variant="outline"
            disabled={indicators.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            disabled={goals.length === 0 || !selectedPlan}
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Gösterge
          </Button>
        </div>
      </div>

      {goals.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500">
              Gösterge eklemek için önce hedefler oluşturmalısınız.
            </p>
          </CardBody>
        </Card>
      )}

      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="w-48">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year} Yılı
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Gösterge ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-64">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tüm Birimler</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardBody>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchTerm ? 'Arama kriterlerine uygun gösterge bulunamadı' : 'Henüz gösterge bulunmuyor'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGoals.has(group.goal_id);

                  return (
                    <div key={group.goal_id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleGoal(group.goal_id)}
                        className="w-full px-6 py-4 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-blue-600" />
                          )}
                          <Target className="w-5 h-5 text-blue-600" />
                          <div className="text-left">
                            <div className="text-xs text-blue-600 font-medium mb-1">
                              {group.objective_code} - {group.objective_title}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {group.goal_code} - {group.goal_title}
                            </h3>
                            <p className="text-sm text-gray-600">{group.indicators.length} Gösterge</p>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-6 space-y-4 bg-white">
                          {group.indicators.map((indicator) => {
                            const progress = calculateIndicatorProgress(indicator, dataEntries);

                            return (
                              <div key={indicator.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                        {indicator.code}
                                      </span>
                                      <h4 className="font-semibold text-gray-900 text-lg">
                                        {indicator.name}
                                      </h4>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEdit(indicator)}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(indicator.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <div className="text-xs text-gray-500 mb-1">Birim</div>
                                    <div className="text-sm font-medium text-gray-900">{indicator.unit}</div>
                                  </div>

                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <div className="text-xs text-gray-500 mb-1">Başlangıç / Güncel</div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {indicator.baseline_value} / {indicator.current_value}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <div className="text-xs text-gray-500 mb-1">Hedef Değer</div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {indicator.yearly_target !== null && indicator.yearly_target !== undefined
                                        ? indicator.yearly_target
                                        : indicator.target_value !== null && indicator.target_value !== undefined
                                        ? indicator.target_value
                                        : '-'}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <div className="text-xs text-gray-500 mb-2">İlerleme</div>
                                    {progress === 0 && indicator.yearly_target === null && indicator.yearly_target === undefined && indicator.target_value === null && indicator.target_value === undefined ? (
                                      <span className="text-xs text-gray-400">Hedef yok</span>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full ${getProgressColor(progress)}`}
                                            style={{ width: `${Math.min(100, progress)}%` }}
                                          />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">
                                          %{progress}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <div className="text-xs text-gray-500 mb-1">Hedefe Etkisi</div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {indicator.goal_impact_percentage ? `%${indicator.goal_impact_percentage}` : 'Belirtilmemiş'}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <div className="text-xs text-gray-500 mb-1">Ölçüm Sıklığı</div>
                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                      {(measurementFrequencyLabels as any)[indicator.measurement_frequency] || indicator.measurement_frequency}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingIndicator ? 'Gösterge Düzenle' : 'Yeni Gösterge'}
        size="lg"
      >
        {isModalOpen && selectedPlan && (
          <div className="space-y-4">
            {!editingIndicator && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hedef Seçin *
                </label>
                <select
                  value={selectedGoal}
                  onChange={(e) => setSelectedGoal(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seçiniz...</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.code} - {goal.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(selectedGoal || editingIndicator) && (
              <IndicatorForm
                goalId={selectedGoal || editingIndicator?.goal_id || ''}
                startYear={selectedPlan.start_year}
                endYear={selectedPlan.end_year}
                onSuccess={handleSuccess}
                onCancel={handleCloseModal}
                editingIndicator={editingIndicator}
                organizationId={profile?.organization_id || ''}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
