import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Save, Trash2, Users, Banknote, FileText, Target, AlertTriangle, Search, Lightbulb, ChevronDown, ChevronRight, FileDown, Edit, Shield } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CollaborationRiskManagement from '../components/CollaborationRiskManagement';

interface Goal {
  id: string;
  code: string;
  title: string;
  department_id: string | null;
  risk_appetite_level?: string | null;
  risk_appetite_description?: string | null;
  risk_appetite_max_score?: number | null;
  objective?: {
    id: string;
    code: string;
    title: string;
  };
}

interface PlanItem {
  id: string;
  category: 'risk' | 'finding' | 'need';
  content: string;
  order_index: number;
}

interface CollaborationPlan {
  id: string;
  goal_id: string;
  responsible_department_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'completed';
  all_departments: boolean;
  created_at: string;
  goal?: Goal;
  responsible_department?: { name: string };
  cost_estimates?: CostEstimate[];
  partners?: Partner[];
  items?: PlanItem[];
}

interface CostEstimate {
  id: string;
  year: number;
  amount: number;
}

interface Partner {
  id: string;
  department_id: string;
  department?: { name: string };
}

interface Department {
  id: string;
  name: string;
}

interface StrategicPlan {
  id: string;
  start_year: number;
  end_year: number;
}

interface ObjectiveGroup {
  objective_id: string;
  objective_code: string;
  objective_title: string;
  department_ids: string[];
  plans: CollaborationPlan[];
}

export default function CollaborationPlanning() {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<CollaborationPlan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [strategicPlan, setStrategicPlan] = useState<StrategicPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CollaborationPlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [showRiskManagement, setShowRiskManagement] = useState(false);
  const [selectedPlanForRisks, setSelectedPlanForRisks] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    goal_id: '',
    responsible_department_id: '',
    all_departments: false,
    partners: [] as string[],
    cost_estimates: {} as Record<number, string>,
    risks: [''],
    findings: [''],
    needs: ['']
  });

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [plansRes, goalsRes, depsRes, planRes] = await Promise.all([
        supabase
          .from('collaboration_plans')
          .select(`
            *,
            goal:goals(id, code, title, department_id, objective:objectives(id, code, title)),
            responsible_department:departments!responsible_department_id(name),
            partners:collaboration_plan_partners(id, department_id, department:departments(name)),
            cost_estimates:collaboration_plan_cost_estimates(id, year, amount),
            items:collaboration_plan_items(id, category, content, order_index)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false }),

        supabase
          .from('goals')
          .select('*, objective:objectives(code, title), risk_appetite_level, risk_appetite_description, risk_appetite_max_score')
          .eq('organization_id', profile.organization_id)
          .order('code'),

        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('name'),

        supabase
          .from('strategic_plans')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .maybeSingle()
      ]);

      if (plansRes.error) throw plansRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (depsRes.error) throw depsRes.error;

      setPlans(plansRes.data || []);
      setGoals(goalsRes.data || []);
      setDepartments(depsRes.data || []);
      setStrategicPlan(planRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedGoal = goals.find(g => g.id === formData.goal_id);

      const planData = {
        organization_id: profile.organization_id,
        goal_id: formData.goal_id,
        responsible_department_id: formData.responsible_department_id,
        title: selectedGoal?.title || 'İşbirliği Planı',
        description: null,
        status: 'active',
        all_departments: formData.all_departments,
        created_by: user.id
      };

      let planId: string;

      if (editingPlan) {
        const { error } = await supabase
          .from('collaboration_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        planId = editingPlan.id;

        await supabase
          .from('collaboration_plan_partners')
          .delete()
          .eq('plan_id', planId);

        await supabase
          .from('collaboration_plan_cost_estimates')
          .delete()
          .eq('plan_id', planId);

        await supabase
          .from('collaboration_plan_items')
          .delete()
          .eq('plan_id', planId);
      } else {
        const { data, error } = await supabase
          .from('collaboration_plans')
          .insert(planData)
          .select()
          .single();

        if (error) throw error;
        planId = data.id;
      }

      if (!formData.all_departments && formData.partners.length > 0) {
        await supabase
          .from('collaboration_plan_partners')
          .insert(formData.partners.map(deptId => ({
            plan_id: planId,
            department_id: deptId
          })));
      }

      const costEstimates = Object.entries(formData.cost_estimates)
        .filter(([_, amount]) => amount && parseFloat(amount) > 0)
        .map(([year, amount]) => ({
          plan_id: planId,
          year: parseInt(year),
          amount: parseFloat(amount)
        }));

      if (costEstimates.length > 0) {
        await supabase
          .from('collaboration_plan_cost_estimates')
          .insert(costEstimates);
      }

      const items = [
        ...formData.risks.filter(r => r.trim()).map((content, idx) => ({
          plan_id: planId,
          category: 'risk' as const,
          content: content.trim(),
          order_index: idx
        })),
        ...formData.findings.filter(f => f.trim()).map((content, idx) => ({
          plan_id: planId,
          category: 'finding' as const,
          content: content.trim(),
          order_index: idx
        })),
        ...formData.needs.filter(n => n.trim()).map((content, idx) => ({
          plan_id: planId,
          category: 'need' as const,
          content: content.trim(),
          order_index: idx
        }))
      ];

      if (items.length > 0) {
        await supabase
          .from('collaboration_plan_items')
          .insert(items);
      }

      setShowForm(false);
      setEditingPlan(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Plan kaydedilirken hata oluştu.');
    }
  };

  const resetForm = () => {
    setFormData({
      goal_id: '',
      responsible_department_id: '',
      all_departments: false,
      partners: [],
      cost_estimates: {},
      risks: [''],
      findings: [''],
      needs: ['']
    });
  };

  const handleEdit = (plan: CollaborationPlan) => {
    const estimates: Record<number, string> = {};
    plan.cost_estimates?.forEach(ce => {
      estimates[ce.year] = ce.amount.toString();
    });

    const risks = plan.items?.filter(i => i.category === 'risk').map(i => i.content) || [''];
    const findings = plan.items?.filter(i => i.category === 'finding').map(i => i.content) || [''];
    const needs = plan.items?.filter(i => i.category === 'need').map(i => i.content) || [''];

    setEditingPlan(plan);
    setFormData({
      goal_id: plan.goal_id,
      responsible_department_id: plan.responsible_department_id,
      all_departments: plan.all_departments || false,
      partners: plan.partners?.map(p => p.department_id) || [],
      cost_estimates: estimates,
      risks: risks.length > 0 ? risks : [''],
      findings: findings.length > 0 ? findings : [''],
      needs: needs.length > 0 ? needs : ['']
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu işbirliği planını silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('collaboration_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Plan silinirken hata oluştu.');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    const labels = {
      draft: 'Taslak',
      active: 'Aktif',
      completed: 'Tamamlandı'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getYears = () => {
    if (strategicPlan) {
      const years = [];
      for (let year = strategicPlan.start_year; year <= strategicPlan.end_year; year++) {
        years.push(year);
      }
      return years;
    }

    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear + i);
  };

  const groupPlansByObjective = (): ObjectiveGroup[] => {
    let filteredPlans = plans;

    if (selectedDepartment) {
      filteredPlans = plans.filter(plan => plan.responsible_department_id === selectedDepartment);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredPlans = filteredPlans.filter(plan =>
        plan.title.toLowerCase().includes(search) ||
        plan.goal?.code.toLowerCase().includes(search) ||
        plan.goal?.title.toLowerCase().includes(search) ||
        plan.goal?.objective?.code.toLowerCase().includes(search) ||
        plan.goal?.objective?.title.toLowerCase().includes(search)
      );
    }

    const grouped = new Map<string, ObjectiveGroup>();

    filteredPlans.forEach(plan => {
      if (!plan.goal?.objective) return;

      const objId = plan.goal.objective.id;
      if (!grouped.has(objId)) {
        grouped.set(objId, {
          objective_id: objId,
          objective_code: plan.goal.objective.code,
          objective_title: plan.goal.objective.title,
          department_ids: [],
          plans: []
        });
      }
      const group = grouped.get(objId)!;
      group.plans.push(plan);

      if (plan.responsible_department_id && !group.department_ids.includes(plan.responsible_department_id)) {
        group.department_ids.push(plan.responsible_department_id);
      }
    });

    const sortedGroups = Array.from(grouped.values()).sort((a, b) =>
      a.objective_code.localeCompare(b.objective_code)
    );

    sortedGroups.forEach(group => {
      group.plans.sort((a, b) => {
        const codeA = a.goal?.code || '';
        const codeB = b.goal?.code || '';
        return codeA.localeCompare(codeB);
      });
    });

    return sortedGroups;
  };

  const filteredGroups = groupPlansByObjective();

  const toggleObjective = (objectiveId: string) => {
    const newExpanded = new Set(expandedObjectives);
    if (newExpanded.has(objectiveId)) {
      newExpanded.delete(objectiveId);
    } else {
      newExpanded.add(objectiveId);
    }
    setExpandedObjectives(newExpanded);
  };

  const transferRiskToRegister = async (riskItem: PlanItem, plan: CollaborationPlan) => {
    if (!profile?.organization_id || !plan.goal) return;

    try {
      const existingRisk = await supabase
        .from('risks')
        .select('id')
        .eq('collaboration_item_id', riskItem.id)
        .maybeSingle();

      if (existingRisk.data) {
        alert('Bu risk zaten Risk Yönetimi sistemine aktarılmış.');
        return;
      }

      const nextCode = await getNextRiskCode();

      const { error } = await supabase
        .from('risks')
        .insert({
          organization_id: profile.organization_id,
          goal_id: plan.goal_id,
          collaboration_item_id: riskItem.id,
          code: nextCode,
          name: riskItem.content,
          description: `İşbirliği planından aktarılan risk: ${plan.title}`,
          owner_department_id: plan.responsible_department_id,
          inherent_likelihood: 3,
          inherent_impact: 3,
          residual_likelihood: 3,
          residual_impact: 3,
          risk_level: 'MEDIUM',
          status: 'IDENTIFIED',
          is_active: true,
          identified_date: new Date().toISOString().split('T')[0],
          identified_by_id: user?.id
        });

      if (error) throw error;

      alert('Risk başarıyla Risk Yönetimi sistemine aktarıldı!');
      loadData();
    } catch (error) {
      console.error('Risk aktarılırken hata:', error);
      alert('Risk aktarılırken hata oluştu.');
    }
  };

  const getNextRiskCode = async (): Promise<string> => {
    if (!profile?.organization_id) return 'R001';

    try {
      const { data, error } = await supabase
        .from('risks')
        .select('code')
        .eq('organization_id', profile.organization_id)
        .order('code', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        return 'R001';
      }

      const lastCode = data[0].code;
      const numericPart = parseInt(lastCode.replace(/\D/g, ''));
      const nextNumber = numericPart + 1;

      return `R${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Risk kodu oluşturulurken hata:', error);
      return 'R001';
    }
  };

  const exportToExcel = () => {
    const data = plans.map(plan => ({
      'Amaç': plan.goal?.objective?.code || '',
      'Hedef': `${plan.goal?.code} - ${plan.goal?.title || ''}`,
      'Sorumlu Birim': plan.responsible_department?.name || '',
      'İşbirliği Birimleri': plan.all_departments
        ? 'Tüm Birimler'
        : plan.partners?.map(p => p.department?.name).join(', ') || '-',
      'Durum': plan.status === 'active' ? 'Aktif' : plan.status === 'completed' ? 'Tamamlandı' : 'Taslak',
      'Toplam Maliyet': plan.cost_estimates?.reduce((sum, ce) => sum + ce.amount, 0).toLocaleString('tr-TR') + ' ₺' || '0 ₺'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'İşbirliği Planları');
    XLSX.writeFile(wb, 'isbirligi_planlari.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Birim İşbirliği Planları', 14, 15);

    const tableData = plans.map(plan => [
      plan.goal?.objective?.code || '',
      `${plan.goal?.code} - ${plan.goal?.title || ''}`,
      plan.responsible_department?.name || '',
      plan.all_departments ? 'Tüm Birimler' : plan.partners?.map(p => p.department?.name).join(', ') || '-',
      plan.status === 'active' ? 'Aktif' : plan.status === 'completed' ? 'Tamamlandı' : 'Taslak',
      (plan.cost_estimates?.reduce((sum, ce) => sum + ce.amount, 0) || 0).toLocaleString('tr-TR') + ' TL'
    ]);

    autoTable(doc, {
      head: [['Amaç', 'Hedef', 'Sorumlu Birim', 'İşbirliği Birimleri', 'Durum', 'Toplam Maliyet']],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8, font: 'helvetica' },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 }
    });

    doc.save('isbirligi_planlari.pdf');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-600" />
              Birim İşbirliği Planlama
            </h1>
            <p className="text-gray-600 mt-2">Hedef bazlı işbirliği planları ve maliyet tahminleri</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Excel'e Aktar
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              PDF İndir
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingPlan(null);
                resetForm();
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Yeni Plan
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Amaç, hedef veya plan ara..."
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
      </div>

      {filteredGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm ? 'Arama kriterlerine uygun plan bulunamadı' : 'Henüz işbirliği planı oluşturulmamış'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map((group) => {
            const isExpanded = expandedObjectives.has(group.objective_id);

            return (
              <div key={group.objective_id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <button
                  onClick={() => toggleObjective(group.objective_id)}
                  className="w-full px-6 py-5 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="w-6 h-6 text-blue-600" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-blue-600" />
                    )}
                    <Target className="w-6 h-6 text-blue-600" />
                    <div className="text-left">
                      <h2 className="text-xl font-bold text-gray-900">
                        {group.objective_code} - {group.objective_title}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">{group.plans.length} İşbirliği Planı</p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-6 space-y-5 bg-gray-50">
                    {group.plans.map((plan) => {
                      const totalCost = plan.cost_estimates?.reduce((sum, ce) => sum + ce.amount, 0) || 0;

                      return (
                        <div key={plan.id} className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-5">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <FileText className="w-6 h-6 text-green-600" />
                                <div>
                                  <h3 className="font-bold text-gray-900 text-xl">
                                    {plan.goal?.code} - {plan.title}
                                  </h3>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(plan.status)}
                              <button
                                onClick={() => {
                                  setSelectedPlanForRisks(plan.id);
                                  setShowRiskManagement(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                                title="Risk Yönetimi"
                              >
                                <Shield className="w-4 h-4" />
                                <span className="text-sm font-medium">Riskler</span>
                              </button>
                              <button
                                onClick={() => handleEdit(plan)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Düzenle"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(plan.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Sil"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-300 shadow-sm">
                              <div className="flex items-center gap-2 text-blue-800 mb-3">
                                <Users className="w-5 h-5" />
                                <span className="font-semibold text-sm">Sorumlu Birim</span>
                              </div>
                              <p className="text-blue-900 font-bold text-lg">{plan.responsible_department?.name}</p>
                            </div>

                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-5 border border-green-300 shadow-sm">
                              <div className="flex items-center gap-2 text-green-800 mb-3">
                                <Users className="w-5 h-5" />
                                <span className="font-semibold text-sm">İşbirliği Birimleri</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {plan.all_departments ? (
                                  <span className="text-base font-bold text-green-800">Tüm Birimler</span>
                                ) : plan.partners && plan.partners.length > 0 ? (
                                  plan.partners.map((p, idx) => (
                                    <span key={idx} className="text-xs bg-green-200 text-green-900 px-2.5 py-1 rounded-full border border-green-400 font-medium">
                                      {p.department?.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-green-700">-</span>
                                )}
                              </div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-300 shadow-sm">
                              <div className="flex items-center gap-2 text-purple-800 mb-3">
                                <Banknote className="w-5 h-5" />
                                <span className="font-semibold text-sm">Maliyet Tahmini</span>
                              </div>
                              {plan.cost_estimates && plan.cost_estimates.length > 0 ? (
                                <div>
                                  <div className="space-y-1.5 mb-2">
                                    {plan.cost_estimates.map((ce, idx) => (
                                      <div key={idx} className="flex justify-between text-sm text-purple-800">
                                        <span className="font-medium">{ce.year}:</span>
                                        <span className="font-semibold">{ce.amount.toLocaleString('tr-TR')} ₺</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="pt-2 border-t-2 border-purple-300 flex justify-between font-bold text-purple-900">
                                    <span>Toplam:</span>
                                    <span>{totalCost.toLocaleString('tr-TR')} ₺</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-purple-700 font-medium">Belirtilmemiş</span>
                              )}
                            </div>

                            {plan.goal?.risk_appetite_level && (
                              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-5 border border-orange-300 shadow-sm">
                                <div className="flex items-center gap-2 text-orange-800 mb-3">
                                  <Shield className="w-5 h-5" />
                                  <span className="font-semibold text-sm">Risk İştahı</span>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                      plan.goal.risk_appetite_level === 'LOW' ? 'bg-green-200 text-green-900' :
                                      plan.goal.risk_appetite_level === 'MEDIUM' ? 'bg-yellow-200 text-yellow-900' :
                                      plan.goal.risk_appetite_level === 'HIGH' ? 'bg-orange-200 text-orange-900' :
                                      'bg-red-200 text-red-900'
                                    }`}>
                                      {plan.goal.risk_appetite_level === 'LOW' ? 'Düşük' :
                                       plan.goal.risk_appetite_level === 'MEDIUM' ? 'Orta' :
                                       plan.goal.risk_appetite_level === 'HIGH' ? 'Yüksek' : 'Çok Yüksek'}
                                    </span>
                                  </div>
                                  {plan.goal.risk_appetite_max_score && (
                                    <p className="text-sm text-orange-800 font-medium">
                                      Max Skor: {plan.goal.risk_appetite_max_score}
                                    </p>
                                  )}
                                  {plan.goal.risk_appetite_description && (
                                    <p className="text-xs text-orange-700 mt-2">{plan.goal.risk_appetite_description}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {plan.items && plan.items.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5 pt-5 border-t-2 border-gray-300">
                              {plan.items.filter(i => i.category === 'risk').length > 0 && (
                                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-5 border border-red-300 shadow-sm">
                                  <div className="flex items-center justify-between text-red-800 mb-3">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-5 h-5" />
                                      <span className="font-semibold text-sm">Riskler</span>
                                    </div>
                                  </div>
                                  <ul className="space-y-3">
                                    {plan.items.filter(i => i.category === 'risk').map((item, idx) => (
                                      <li key={idx} className="flex items-start justify-between gap-2 bg-white bg-opacity-60 rounded-md p-2.5 border border-red-200">
                                        <div className="flex items-start gap-2 flex-1">
                                          <span className="text-red-500 mt-0.5 font-bold">•</span>
                                          <span className="font-medium text-sm text-red-900 flex-1">{item.content}</span>
                                        </div>
                                        <button
                                          onClick={() => transferRiskToRegister(item, plan)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors whitespace-nowrap flex-shrink-0"
                                          title="Risk Yönetimine Aktar"
                                        >
                                          <Shield className="w-3.5 h-3.5" />
                                          Aktar
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {plan.items.filter(i => i.category === 'finding').length > 0 && (
                                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-5 border border-amber-300 shadow-sm">
                                  <div className="flex items-center gap-2 text-amber-800 mb-3">
                                    <Search className="w-5 h-5" />
                                    <span className="font-semibold text-sm">Tespitler</span>
                                  </div>
                                  <ul className="space-y-2">
                                    {plan.items.filter(i => i.category === 'finding').map((item, idx) => (
                                      <li key={idx} className="text-sm text-amber-900 flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5 font-bold">•</span>
                                        <span className="font-medium">{item.content}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {plan.items.filter(i => i.category === 'need').length > 0 && (
                                <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-5 border border-teal-300 shadow-sm">
                                  <div className="flex items-center gap-2 text-teal-800 mb-3">
                                    <Lightbulb className="w-5 h-5" />
                                    <span className="font-semibold text-sm">İhtiyaçlar</span>
                                  </div>
                                  <ul className="space-y-2">
                                    {plan.items.filter(i => i.category === 'need').map((item, idx) => (
                                      <li key={idx} className="text-sm text-teal-900 flex items-start gap-2">
                                        <span className="text-teal-500 mt-0.5 font-bold">•</span>
                                        <span className="font-medium">{item.content}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
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

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  {editingPlan ? 'İşbirliği Planını Düzenle' : 'Yeni İşbirliği Planı'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingPlan(null);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hedef *
                  </label>
                  <select
                    value={formData.goal_id}
                    onChange={(e) => {
                      const selectedGoal = goals.find(g => g.id === e.target.value);
                      setFormData({
                        ...formData,
                        goal_id: e.target.value,
                        responsible_department_id: selectedGoal?.department_id || ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Hedef Seçiniz</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.objective?.code} → {goal.code} - {goal.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sorumlu Birim *
                  </label>
                  <select
                    value={formData.responsible_department_id}
                    onChange={(e) => setFormData({ ...formData, responsible_department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Birim Seçiniz</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İşbirliği Yapılacak Birimler
                  </label>
                  <div className="border border-gray-200 rounded-lg p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold mb-3">
                      <input
                        type="checkbox"
                        checked={formData.all_departments}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            all_departments: e.target.checked,
                            partners: e.target.checked ? [] : formData.partners
                          });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-blue-700">Tüm Birimler</span>
                    </label>
                    {!formData.all_departments && (
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pt-3 border-t border-gray-200">
                        {departments.map((dept) => (
                          <label key={dept.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={formData.partners.includes(dept.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, partners: [...formData.partners, dept.id] });
                                } else {
                                  setFormData({ ...formData, partners: formData.partners.filter(id => id !== dept.id) });
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{dept.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-purple-600" />
                    Maliyet Tahmini (Yıl Bazlı)
                  </label>
                  <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                    {getYears().map((year) => (
                      <div key={year} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-purple-700 w-16">{year}:</span>
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.cost_estimates[year] || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              cost_estimates: { ...formData.cost_estimates, [year]: e.target.value }
                            })}
                            className="w-full px-3 py-2 pr-8 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="Maliyet tutarı girin"
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-600 font-semibold">₺</span>
                        </div>
                      </div>
                    ))}
                    {getYears().length > 0 && (
                      <div className="pt-3 border-t border-purple-200 text-sm text-purple-700">
                        <span className="font-semibold">Toplam Tahmini Maliyet: </span>
                        <span className="font-bold text-purple-900">
                          {Object.values(formData.cost_estimates)
                            .reduce((sum, val) => sum + (parseFloat(val as string) || 0), 0)
                            .toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Riskler
                  </label>
                  <div className="space-y-2">
                    {formData.risks.map((risk, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={risk}
                          onChange={(e) => {
                            const newRisks = [...formData.risks];
                            newRisks[idx] = e.target.value;
                            setFormData({ ...formData, risks: newRisks });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Risk açıklaması"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.risks.length > 1) {
                              setFormData({ ...formData, risks: formData.risks.filter((_, i) => i !== idx) });
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, risks: [...formData.risks, ''] })}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Risk Ekle
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tespitler
                  </label>
                  <div className="space-y-2">
                    {formData.findings.map((finding, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={finding}
                          onChange={(e) => {
                            const newFindings = [...formData.findings];
                            newFindings[idx] = e.target.value;
                            setFormData({ ...formData, findings: newFindings });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Tespit açıklaması"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.findings.length > 1) {
                              setFormData({ ...formData, findings: formData.findings.filter((_, i) => i !== idx) });
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, findings: [...formData.findings, ''] })}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Tespit Ekle
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İhtiyaçlar
                  </label>
                  <div className="space-y-2">
                    {formData.needs.map((need, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={need}
                          onChange={(e) => {
                            const newNeeds = [...formData.needs];
                            newNeeds[idx] = e.target.value;
                            setFormData({ ...formData, needs: newNeeds });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="İhtiyaç açıklaması"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.needs.length > 1) {
                              setFormData({ ...formData, needs: formData.needs.filter((_, i) => i !== idx) });
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, needs: [...formData.needs, ''] })}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + İhtiyaç Ekle
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingPlan(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4" />
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showRiskManagement && selectedPlanForRisks && (
        <CollaborationRiskManagement
          collaborationPlanId={selectedPlanForRisks}
          onClose={() => {
            setShowRiskManagement(false);
            setSelectedPlanForRisks(null);
          }}
        />
      )}
    </div>
  );
}
