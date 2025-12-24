import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit2, Trash2, Search, Sparkles, TrendingUp, ChevronDown, ChevronRight, Target } from 'lucide-react';
import { generateGoalCode } from '../utils/codeGenerator';
import { calculateGoalProgress, getProgressColor } from '../utils/progressCalculations';

interface Goal {
  id: string;
  objective_id: string;
  code: string;
  title: string;
  description: string;
  order_number: number;
  department_id: string | null;
  vice_president_id: string | null;
  objective?: {
    title: string;
    code: string;
  };
  departments?: {
    name: string;
  };
  vice_president?: {
    full_name: string;
  };
}

interface Objective {
  id: string;
  code: string;
  title: string;
}

interface Department {
  id: string;
  name: string;
}

interface VicePresident {
  id: string;
  full_name: string;
}

interface ObjectiveGroup {
  objective_id: string;
  objective_code: string;
  objective_title: string;
  goals: Goal[];
}

export default function Goals() {
  const { profile } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [vicePresidents, setVicePresidents] = useState<VicePresident[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [dataEntries, setDataEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    objective_id: '',
    code: '',
    title: '',
    description: '',
    order_number: 1,
    department_id: '',
    vice_president_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

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
      const currentYear = new Date().getFullYear();

      const [goalsRes, objectivesRes, deptsRes, vpsRes, indicatorsRes, targetsRes, entriesRes] = await Promise.all([
        supabase
          .from('goals')
          .select(`
            *,
            objectives!inner(title, code),
            departments(name),
            vice_president:profiles!vice_president_id(full_name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('order_number', { ascending: true }),
        supabase
          .from('objectives')
          .select('id, code, title')
          .eq('organization_id', profile.organization_id)
          .order('order_number', { ascending: true }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile.organization_id)
          .eq('role', 'vice_president')
          .order('full_name', { ascending: true }),
        supabase
          .from('indicators')
          .select('id, goal_id, goal_impact_percentage, target_value, baseline_value, calculation_method')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicator_targets')
          .select('indicator_id, year, target_value')
          .eq('year', currentYear),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', currentYear)
          .in('status', ['approved', 'submitted'])
      ]);

      if (goalsRes.error) throw goalsRes.error;
      if (objectivesRes.error) throw objectivesRes.error;
      if (deptsRes.error) throw deptsRes.error;
      if (vpsRes.error) throw vpsRes.error;
      if (indicatorsRes.error) throw indicatorsRes.error;
      if (targetsRes.error) throw targetsRes.error;
      if (entriesRes.error) throw entriesRes.error;

      const targetsByIndicator: Record<string, number> = {};
      targetsRes.data?.forEach(target => {
        targetsByIndicator[target.indicator_id] = target.target_value;
      });

      const indicatorsData = indicatorsRes.data?.map(ind => ({
        ...ind,
        yearly_target: targetsByIndicator[ind.id] || ind.target_value
      })) || [];

      setGoals(goalsRes.data?.map(goal => ({
        ...goal,
        objective: goal.objectives,
        vice_president: Array.isArray(goal.vice_president) ? goal.vice_president[0] : goal.vice_president
      })) || []);
      setObjectives(objectivesRes.data || []);
      setDepartments(deptsRes.data || []);
      setVicePresidents(vpsRes.data || []);
      setIndicators(indicatorsData);
      setDataEntries(entriesRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    setSubmitting(true);

    try {
      const dataToSave = {
        ...formData,
        department_id: formData.department_id || null,
        vice_president_id: formData.vice_president_id || null,
      };

      if (editingGoal) {
        const { error } = await supabase
          .from('goals')
          .update(dataToSave)
          .eq('id', editingGoal.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('goals')
          .insert({
            ...dataToSave,
            organization_id: profile.organization_id,
          });

        if (error) throw error;
      }

      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Hedef kaydedilirken hata:', error);
      alert('Hedef kaydedilirken bir hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu hedefi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve hedefe bağlı tüm göstergeler ve faaliyetler silinecektir.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Hedef silinirken hata:', error);
      alert('Hedef silinirken bir hata oluştu');
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      objective_id: goal.objective_id,
      code: goal.code,
      title: goal.title,
      description: goal.description,
      order_number: goal.order_number,
      department_id: goal.department_id || '',
      vice_president_id: goal.vice_president_id || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGoal(null);
    setFormData({
      objective_id: '',
      code: '',
      title: '',
      description: '',
      order_number: 1,
      department_id: '',
      vice_president_id: '',
    });
  };

  const handleGenerateCode = async () => {
    if (!formData.objective_id) {
      alert('Lütfen önce bir amaç seçin');
      return;
    }

    try {
      const code = await generateGoalCode(supabase, {
        organizationId: profile?.organization_id || '',
        objectiveId: formData.objective_id,
      });
      setFormData({ ...formData, code });
    } catch (error) {
      console.error('Kod üretilirken hata:', error);
      alert('Kod üretilirken bir hata oluştu');
    }
  };

  const groupGoalsByObjective = (): ObjectiveGroup[] => {
    const grouped = new Map<string, ObjectiveGroup>();

    goals.forEach(goal => {
      if (!goal.objective) return;

      const objId = goal.objective_id;
      if (!grouped.has(objId)) {
        grouped.set(objId, {
          objective_id: objId,
          objective_code: goal.objective.code,
          objective_title: goal.objective.title,
          goals: []
        });
      }
      grouped.get(objId)!.goals.push(goal);
    });

    const sortedGroups = Array.from(grouped.values()).sort((a, b) =>
      naturalSort(a.objective_code, b.objective_code)
    );

    sortedGroups.forEach(group => {
      group.goals.sort((a, b) => naturalSort(a.code, b.code));
    });

    return sortedGroups;
  };

  const filteredGroups = groupGoalsByObjective().map(group => {
    let filteredGoals = group.goals;

    if (selectedDepartment) {
      filteredGoals = filteredGoals.filter(goal => goal.department_id === selectedDepartment);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredGoals = filteredGoals.filter(goal =>
        goal.title.toLowerCase().includes(search) ||
        goal.code.toLowerCase().includes(search) ||
        goal.description.toLowerCase().includes(search)
      );
    }

    return { ...group, goals: filteredGoals };
  }).filter(group => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const objectiveMatches = group.objective_title.toLowerCase().includes(search) ||
                              group.objective_code.toLowerCase().includes(search);
      return objectiveMatches || group.goals.length > 0;
    }
    return group.goals.length > 0;
  });

  const toggleObjective = (objectiveId: string) => {
    const newExpanded = new Set(expandedObjectives);
    if (newExpanded.has(objectiveId)) {
      newExpanded.delete(objectiveId);
    } else {
      newExpanded.add(objectiveId);
    }
    setExpandedObjectives(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hedefler</h1>
          <p className="text-slate-600 mt-1">Amaçlara bağlı hedefleri yönetin</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} disabled={objectives.length === 0}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Hedef
        </Button>
      </div>

      {objectives.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-center text-slate-500">
              Hedef eklemek için önce bir amaç oluşturmalısınız.
            </p>
          </CardBody>
        </Card>
      )}

      {objectives.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Hedef ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-64">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <p className="text-slate-500">
                  {searchTerm ? 'Arama kriterlerine uygun hedef bulunamadı' : 'Henüz hedef bulunmuyor'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedObjectives.has(group.objective_id);

                  return (
                    <div key={group.objective_id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleObjective(group.objective_id)}
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
                            <h3 className="text-lg font-semibold text-slate-900">
                              {group.objective_code} - {group.objective_title}
                            </h3>
                            <p className="text-sm text-slate-600">{group.goals.length} Hedef</p>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-6 space-y-4 bg-white">
                          {group.goals.map((goal) => {
                            const progress = calculateGoalProgress(goal.id, indicators, dataEntries);

                            return (
                              <div key={goal.id} className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                        {goal.code}
                                      </span>
                                      <h4 className="font-semibold text-slate-900 text-lg">
                                        {goal.title}
                                      </h4>
                                    </div>
                                    {goal.description && (
                                      <p className="text-sm text-slate-600 mt-2">{goal.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEdit(goal)}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(goal.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                                    <div className="text-xs text-slate-500 mb-1">Müdürlük</div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {goal.departments?.name || '-'}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                                    <div className="text-xs text-slate-500 mb-1">Başkan Yardımcısı</div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {goal.vice_president?.full_name || '-'}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                                    <div className="text-xs text-slate-500 mb-2">İlerleme</div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-slate-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full ${getProgressColor(progress)}`}
                                          style={{ width: `${Math.min(100, progress)}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-semibold text-slate-900">
                                        %{progress}
                                      </span>
                                    </div>
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
        title={editingGoal ? 'Hedefi Düzenle' : 'Yeni Hedef'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Amaç *
            </label>
            <select
              value={formData.objective_id}
              onChange={(e) => setFormData({ ...formData, objective_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz...</option>
              {objectives.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.code} - {obj.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hedef Kodu *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="örn: H1.1, H1.2"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateCode}
                  title="Otomatik kod üret"
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sıra Numarası *
              </label>
              <input
                type="number"
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Müdürlük *
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seçiniz...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Başkan Yardımcısı
              </label>
              <select
                value={formData.vice_president_id}
                onChange={(e) => setFormData({ ...formData, vice_president_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz...</option>
                {vicePresidents.map((vp) => (
                  <option key={vp.id} value={vp.id}>
                    {vp.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hedef Başlığı *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Hedef başlığını girin"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Hedef hakkında detaylı açıklama..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              İptal
            </Button>
            <Button type="submit" loading={submitting}>
              {editingGoal ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
