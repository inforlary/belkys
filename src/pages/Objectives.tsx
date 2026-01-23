import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Edit2, Trash2, Search, Sparkles, TrendingUp, FileSpreadsheet, FileDown } from 'lucide-react';
import { generateObjectiveCode } from '../utils/codeGenerator';
import { calculateObjectiveProgress, getProgressColor } from '../utils/progressCalculations';
import { exportToExcel, exportToPDF, generateTableHTML } from '../utils/exportHelpers';

interface Objective {
  id: string;
  strategic_plan_id: string;
  code: string;
  title: string;
  description: string;
  order_number: number;
  plan?: {
    name: string;
  };
}

interface Plan {
  id: string;
  name: string;
}

export default function Objectives() {
  const { profile } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [dataEntries, setDataEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    strategic_plan_id: '',
    code: '',
    title: '',
    description: '',
    order_number: 1,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile, selectedYear]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const allPlansRes = await supabase
        .from('strategic_plans')
        .select('id, name, start_year, end_year')
        .eq('organization_id', profile.organization_id)
        .order('start_year', { ascending: false });

      if (allPlansRes.error) throw allPlansRes.error;

      const allPlans = allPlansRes.data || [];
      const years = new Set<number>();
      allPlans.forEach(plan => {
        for (let year = plan.start_year; year <= plan.end_year; year++) {
          years.add(year);
        }
      });
      setAvailableYears(Array.from(years).sort((a, b) => b - a));

      const relevantPlans = allPlans.filter(plan =>
        selectedYear >= plan.start_year && selectedYear <= plan.end_year
      );

      const [objectivesRes, plansRes, goalsRes, indicatorsRes, targetsRes, entriesRes] = await Promise.all([
        supabase
          .from('objectives')
          .select(`
            *,
            strategic_plans!inner(name, start_year, end_year)
          `)
          .eq('organization_id', profile.organization_id)
          .in('strategic_plan_id', relevantPlans.map(p => p.id))
          .order('order_number', { ascending: true }),
        supabase
          .from('strategic_plans')
          .select('id, name, start_year, end_year')
          .eq('organization_id', profile.organization_id)
          .lte('start_year', selectedYear)
          .gte('end_year', selectedYear)
          .order('created_at', { ascending: false }),
        supabase
          .from('goals')
          .select('id, objective_id')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicators')
          .select('id, goal_id, goal_impact_percentage, target_value, baseline_value, calculation_method')
          .eq('organization_id', profile.organization_id),
        supabase
          .from('indicator_targets')
          .select('indicator_id, year, target_value')
          .eq('year', selectedYear),
        supabase
          .from('indicator_data_entries')
          .select('indicator_id, value, status')
          .eq('organization_id', profile.organization_id)
          .eq('period_year', selectedYear)
          .eq('status', 'approved')
      ]);

      if (objectivesRes.error) throw objectivesRes.error;
      if (plansRes.error) throw plansRes.error;
      if (goalsRes.error) throw goalsRes.error;
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

      setObjectives(objectivesRes.data?.map(obj => ({
        ...obj,
        plan: obj.strategic_plans
      })) || []);
      setPlans(plansRes.data || []);
      setGoals(goalsRes.data || []);
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
      if (editingObjective) {
        const { error } = await supabase
          .from('objectives')
          .update(formData)
          .eq('id', editingObjective.id);

        if (error) throw error;
      } else {
        const { error} = await supabase
          .from('objectives')
          .insert({
            ...formData,
            organization_id: profile.organization_id,
          });

        if (error) throw error;
      }

      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Amaç kaydedilirken hata:', error);
      alert('Amaç kaydedilirken bir hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu amacı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve amaca bağlı tüm hedefler silinecektir.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('objectives')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Amaç silinirken hata:', error);
      alert('Amaç silinirken bir hata oluştu');
    }
  };

  const handleEdit = (objective: Objective) => {
    setEditingObjective(objective);
    setFormData({
      strategic_plan_id: objective.strategic_plan_id,
      code: objective.code,
      title: objective.title,
      description: objective.description,
      order_number: objective.order_number,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingObjective(null);
    setFormData({
      strategic_plan_id: '',
      code: '',
      title: '',
      description: '',
      order_number: 1,
    });
  };

  const handleGenerateCode = async () => {
    if (!formData.strategic_plan_id) {
      alert('Lütfen önce bir stratejik plan seçin');
      return;
    }

    try {
      const code = await generateObjectiveCode(supabase, {
        organizationId: profile?.organization_id || '',
        strategicPlanId: formData.strategic_plan_id,
      });
      setFormData({ ...formData, code });
    } catch (error) {
      console.error('Kod üretilirken hata:', error);
      alert('Kod üretilirken bir hata oluştu');
    }
  };

  const filteredObjectives = objectives.filter(obj =>
    obj.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportExcel = () => {
    const exportData = filteredObjectives.map((obj, index) => {
      const progress = calculateObjectiveProgress(obj.id, goals, indicators, dataEntries);
      return {
        'Sıra': obj.order_number,
        'Kod': obj.code,
        'Amaç Başlığı': obj.title,
        'Stratejik Plan': obj.plan?.name || '-',
        'İlerleme (%)': Math.round(progress),
        'Açıklama': obj.description || '-',
      };
    });

    exportToExcel(
      exportData,
      `Amaclar_${selectedYear}_${new Date().toISOString().split('T')[0]}`
    );
  };

  const handleExportPDF = () => {
    const headers = ['Sıra', 'Kod', 'Amaç Başlığı', 'Stratejik Plan', 'İlerleme', 'Açıklama'];
    const rows = filteredObjectives.map(obj => {
      const progress = calculateObjectiveProgress(obj.id, goals, indicators, dataEntries);
      return [
        obj.order_number.toString(),
        obj.code,
        obj.title,
        obj.plan?.name || '-',
        `${Math.round(progress)}%`,
        obj.description || '-',
      ];
    });

    const content = `
      <h2>Amaçlar - ${selectedYear}</h2>
      <div class="mb-4">
        <p><strong>Toplam Amaç:</strong> ${filteredObjectives.length}</p>
        <p><strong>Ortalama İlerleme:</strong> ${Math.round(
          filteredObjectives.reduce((sum, obj) => {
            const progress = calculateObjectiveProgress(obj.id, goals, indicators, dataEntries);
            return sum + progress;
          }, 0) / filteredObjectives.length || 0
        )}%</p>
      </div>
      ${generateTableHTML(headers, rows)}
    `;

    exportToPDF(
      `Amaçlar - ${selectedYear}`,
      content,
      `Amaclar_${selectedYear}_${new Date().toISOString().split('T')[0]}`
    );
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
          <h1 className="text-3xl font-bold text-slate-900">Amaçlar</h1>
          <p className="text-slate-600 mt-1">Stratejik planlara bağlı amaçları yönetin</p>
        </div>
        <div className="flex gap-2">
          {filteredObjectives.length > 0 && (
            <>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                PDF
              </button>
            </>
          )}
          <Button onClick={() => setIsModalOpen(true)} disabled={plans.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Amaç
          </Button>
        </div>
      </div>

      {plans.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-center text-slate-500">
              Amaç eklemek için önce bir stratejik plan oluşturmalısınız.
            </p>
          </CardBody>
        </Card>
      )}

      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="w-48">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year} Yılı
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Amaç ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CardHeader>

          <CardBody className="p-0">
            {filteredObjectives.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Henüz amaç bulunmuyor</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Sıra
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Kod
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Amaç Başlığı
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Stratejik Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        İlerleme
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Açıklama
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredObjectives.map((objective) => (
                      <tr key={objective.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600">{objective.order_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">{objective.code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{objective.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">{objective.plan?.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const progress = calculateObjectiveProgress(objective.id, goals, indicators, dataEntries);
                            return (
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                                <div className="flex-1 bg-slate-200 rounded-full h-2 w-20">
                                  <div
                                    className={`h-2 rounded-full ${getProgressColor(progress)}`}
                                    style={{ width: `${Math.min(100, progress)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-slate-700">
                                  %{progress}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600 max-w-md truncate">
                            {objective.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(objective)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(objective.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingObjective ? 'Amacı Düzenle' : 'Yeni Amaç'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Stratejik Plan *
            </label>
            <select
              value={formData.strategic_plan_id}
              onChange={(e) => setFormData({ ...formData, strategic_plan_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Seçiniz...</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Amaç Kodu *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="örn: A1, A2"
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Amaç Başlığı *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Amaç başlığını girin"
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
              placeholder="Amaç hakkında detaylı açıklama..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              İptal
            </Button>
            <Button type="submit" loading={submitting}>
              {editingObjective ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
