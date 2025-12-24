import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Save, Trash2, Edit2, TrendingDown, FileText, Send, CheckCircle, XCircle, History, AlertCircle } from 'lucide-react';
import { canEdit, canDelete, getAvailableActions, executeWorkflowAction, getStatusBadgeClass, getStatusLabel } from '../utils/budgetEntryWorkflow';
import BudgetEntryAuditLog from '../components/BudgetEntryAuditLog';

interface Program {
  id: string;
  code: string;
  name: string;
}

interface SubProgram {
  id: string;
  code: string;
  name: string;
  full_code: string;
  program_id: string;
}

interface Activity {
  id: string;
  name?: string;
  code?: string;
  activity_name?: string;
  activity_code?: string;
}

interface InstitutionalCode {
  id: string;
  code: string;
  name: string;
  full_code: string;
  level: number;
}

interface Department {
  id: string;
  name: string;
  budget_institutional_code_id: string;
}

interface ExpenseEconomicCode {
  id: string;
  code: string;
  name: string;
  full_code: string;
  level: number;
}

interface FinancingType {
  id: string;
  code: string;
  name: string;
}

interface ExpenseEntry {
  id: string;
  program_id: string;
  sub_program_id: string;
  activity_id: string;
  institutional_code_id: string;
  expense_economic_code_id: string;
  financing_type_id: string;
  description: string;
  status?: string;
  department_id?: string;
  created_at: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  posted_by?: string;
  posted_at?: string;
  rejection_reason?: string;
  last_modified_by?: string;
  program?: Program;
  sub_program?: SubProgram;
  activity?: Activity;
  institutional_code?: InstitutionalCode;
  expense_economic_code?: ExpenseEconomicCode;
  financing_type?: FinancingType;
  proposals?: ExpenseProposal[];
}

interface ExpenseProposal {
  id: string;
  entry_id: string;
  year: number;
  amount: number;
}

export default function BudgetExpenseEntry() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const currentYear = new Date().getFullYear();

  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [institutionalCodes, setInstitutionalCodes] = useState<InstitutionalCode[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expenseEconomicCodes, setExpenseEconomicCodes] = useState<ExpenseEconomicCode[]>([]);
  const [financingTypes, setFinancingTypes] = useState<FinancingType[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [selectedEntryForAudit, setSelectedEntryForAudit] = useState<string | null>(null);
  const [workflowComment, setWorkflowComment] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    program_id: '',
    sub_program_id: '',
    activity_id: '',
    institutional_code_id: '',
    expense_economic_code_id: '',
    financing_type_id: '',
    description: '',
    years: {
      [currentYear - 1]: '',
      [currentYear]: '',
      [currentYear + 1]: '',
      [currentYear + 2]: ''
    }
  });

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      let programsQuery;
      let subProgramsQuery;
      let activitiesQuery;

      if (profile.role === 'admin') {
        programsQuery = supabase
          .from('programs')
          .select('*')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .eq('is_active', true)
          .order('code');

        subProgramsQuery = supabase
          .from('sub_programs')
          .select('*')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .eq('is_active', true)
          .order('full_code');

        activitiesQuery = supabase
          .from('sub_program_activities')
          .select('id, activity_name, activity_code')
          .order('activity_code');
      } else if (profile.department_id) {
        const { data: mappings } = await supabase
          .from('department_program_mappings')
          .select('program_id, sub_program_id, activity_id')
          .eq('department_id', profile.department_id)
          .eq('is_active', true);

        const programIds = [...new Set(mappings?.map(m => m.program_id).filter(Boolean))];
        const subProgramIds = [...new Set(mappings?.map(m => m.sub_program_id).filter(Boolean))];
        const activityIds = [...new Set(mappings?.map(m => m.activity_id).filter(Boolean))];

        if (programIds.length === 0) {
          setPrograms([]);
          setSubPrograms([]);
          setActivities([]);
          setLoading(false);
          return;
        }

        programsQuery = supabase
          .from('programs')
          .select('*')
          .in('id', programIds)
          .eq('is_active', true)
          .order('code');

        subProgramsQuery = supabase
          .from('sub_programs')
          .select('*')
          .in('id', subProgramIds)
          .eq('is_active', true)
          .order('full_code');

        activitiesQuery = supabase
          .from('sub_program_activities')
          .select('id, activity_name, activity_code')
          .in('id', activityIds)
          .order('activity_code');
      } else {
        setPrograms([]);
        setSubPrograms([]);
        setActivities([]);
        setLoading(false);
        return;
      }

      let institutionalCodesQuery;
      if (profile.role === 'admin') {
        institutionalCodesQuery = supabase
          .from('budget_institutional_codes')
          .select('id, tam_kod as full_code, birim_adi as name, kurum_kodu as code, level, is_active')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .order('tam_kod');
      } else if (profile.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('budget_institutional_code_id')
          .eq('id', profile.department_id)
          .single();

        if (dept?.budget_institutional_code_id) {
          institutionalCodesQuery = supabase
            .from('budget_institutional_codes')
            .select('id, tam_kod as full_code, birim_adi as name, kurum_kodu as code, level, is_active')
            .eq('id', dept.budget_institutional_code_id)
            .eq('is_active', true);
        } else {
          institutionalCodesQuery = supabase
            .from('budget_institutional_codes')
            .select('id, tam_kod as full_code, birim_adi as name, kurum_kodu as code, level, is_active')
            .eq('id', 'no-match')
            .eq('is_active', true);
        }
      } else {
        institutionalCodesQuery = supabase
          .from('budget_institutional_codes')
          .select('id, tam_kod as full_code, birim_adi as name, kurum_kodu as code, level, is_active')
          .eq('id', 'no-match')
          .eq('is_active', true);
      }

      const [
        programsRes,
        subProgramsRes,
        activitiesRes,
        institutionalCodesRes,
        departmentsRes,
        expenseEconomicCodesRes,
        financingTypesRes,
        entriesRes
      ] = await Promise.all([
        programsQuery,
        subProgramsQuery,
        activitiesQuery,
        institutionalCodesQuery,
        supabase
          .from('departments')
          .select('id, name, budget_institutional_code_id')
          .eq('organization_id', profile.organization_id)
          .order('name'),
        supabase
          .from('expense_economic_codes')
          .select('*')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .eq('is_active', true)
          .order('full_code'),
        supabase
          .from('financing_types')
          .select('*')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .eq('is_active', true)
          .order('code'),
        supabase
          .from('expense_budget_entries')
          .select(`
            *,
            program:programs(id, code, name),
            sub_program:sub_programs(id, code, name, full_code),
            activity:sub_program_activities(id, name:activity_name, code:activity_code),
            institutional_code:budget_institutional_codes(id, code:kurum_kodu, name:birim_adi, full_code:tam_kod),
            expense_economic_code:expense_economic_codes(id, code, name, full_code),
            financing_type:financing_types(id, code, name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
      ]);

      if (programsRes.data) setPrograms(programsRes.data);
      if (subProgramsRes.data) setSubPrograms(subProgramsRes.data);
      if (activitiesRes.data) setActivities(activitiesRes.data);
      if (institutionalCodesRes.data) setInstitutionalCodes(institutionalCodesRes.data);
      if (departmentsRes.data) setDepartments(departmentsRes.data);
      if (expenseEconomicCodesRes.data) setExpenseEconomicCodes(expenseEconomicCodesRes.data);
      if (financingTypesRes.data) setFinancingTypes(financingTypesRes.data);

      if (entriesRes.data) {
        const entriesWithProposals = await Promise.all(
          entriesRes.data.map(async (entry: any) => {
            const { data: proposals } = await supabase
              .from('expense_budget_proposals')
              .select('*')
              .eq('entry_id', entry.id);
            return { ...entry, proposals: proposals || [] };
          })
        );
        setEntries(entriesWithProposals);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubPrograms = subPrograms.filter(
    sp => !formData.program_id || sp.program_id === formData.program_id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      if (editingEntry) {
        const { error: entryError } = await supabase
          .from('expense_budget_entries')
          .update({
            program_id: formData.program_id,
            sub_program_id: formData.sub_program_id,
            activity_id: formData.activity_id,
            institutional_code_id: formData.institutional_code_id,
            expense_economic_code_id: formData.expense_economic_code_id,
            financing_type_id: formData.financing_type_id,
            description: formData.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingEntry.id);

        if (entryError) throw entryError;

        for (const [year, amount] of Object.entries(formData.years)) {
          if (amount && parseFloat(amount) > 0) {
            await supabase
              .from('expense_budget_proposals')
              .upsert({
                entry_id: editingEntry.id,
                year: parseInt(year),
                amount: parseFloat(amount)
              });
          }
        }
      } else {
        const { data: newEntry, error: entryError } = await supabase
          .from('expense_budget_entries')
          .insert({
            organization_id: profile.organization_id,
            program_id: formData.program_id,
            sub_program_id: formData.sub_program_id,
            activity_id: formData.activity_id,
            institutional_code_id: formData.institutional_code_id,
            expense_economic_code_id: formData.expense_economic_code_id,
            financing_type_id: formData.financing_type_id,
            description: formData.description,
            created_by: profile.id
          })
          .select()
          .single();

        if (entryError) throw entryError;

        for (const [year, amount] of Object.entries(formData.years)) {
          if (amount && parseFloat(amount) > 0) {
            await supabase
              .from('expense_budget_proposals')
              .insert({
                entry_id: newEntry.id,
                year: parseInt(year),
                amount: parseFloat(amount)
              });
          }
        }
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Kayıt sırasında bir hata oluştu');
    }
  };

  const handleEdit = (entry: ExpenseEntry) => {
    setEditingEntry(entry);
    const yearData: any = {};
    entry.proposals?.forEach(p => {
      yearData[p.year] = p.amount.toString();
    });

    setFormData({
      program_id: entry.program_id,
      sub_program_id: entry.sub_program_id,
      activity_id: entry.activity_id,
      institutional_code_id: entry.institutional_code_id,
      expense_economic_code_id: entry.expense_economic_code_id,
      financing_type_id: entry.financing_type_id,
      description: entry.description,
      years: {
        [currentYear - 1]: yearData[currentYear - 1] || '',
        [currentYear]: yearData[currentYear] || '',
        [currentYear + 1]: yearData[currentYear + 1] || '',
        [currentYear + 2]: yearData[currentYear + 2] || ''
      }
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('expense_budget_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Silme işlemi sırasında bir hata oluştu');
    }
  };

  const resetForm = () => {
    setFormData({
      program_id: '',
      sub_program_id: '',
      activity_id: '',
      institutional_code_id: '',
      expense_economic_code_id: '',
      financing_type_id: '',
      description: '',
      years: {
        [currentYear - 1]: '',
        [currentYear]: '',
        [currentYear + 1]: '',
        [currentYear + 2]: ''
      }
    });
    setEditingEntry(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ₺';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gider Bütçe Fişi</h1>
          <p className="text-gray-600 mt-1">
            Program, Alt Program, Faaliyet bazlı gider bütçe girişleri
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Gider Kaydı
        </Button>
      </div>

      <Card>
        <CardBody>
          {!loading && programs.length === 0 && profile?.role !== 'admin' && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-yellow-900 mb-1">Program Eşleştirmesi Gerekli</h3>
                  <p className="text-sm text-yellow-800 mb-3">
                    Bütçe girişi yapabilmek için öncelikle müdürlüğünüzün sorumlu olduğu programları eşleştirmeniz gerekmektedir.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('program-mapping')}
                  >
                    Program Eşleştirme Sayfasına Git
                  </Button>
                </div>
              </div>
            </div>
          )}

          {entries.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Henüz gider kaydı bulunmuyor
              </h3>
              <p className="text-gray-600 mb-4">
                Yeni bir gider bütçe fişi oluşturmak için yukarıdaki butona tıklayın
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">
                          {entry.program?.code} - {entry.program?.name}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-gray-600">Alt Program:</span>
                          <span className="ml-2 font-medium">{entry.sub_program?.full_code} - {entry.sub_program?.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Faaliyet:</span>
                          <span className="ml-2 font-medium">{entry.activity?.code} - {entry.activity?.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Müdürlük:</span>
                          <span className="ml-2 font-medium">{entry.institutional_code?.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Ekonomik Kod:</span>
                          <span className="ml-2 font-medium">{entry.expense_economic_code?.full_code} - {entry.expense_economic_code?.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Finansman Tipi:</span>
                          <span className="ml-2 font-medium">{entry.financing_type?.code} - {entry.financing_type?.name}</span>
                        </div>
                      </div>
                      {entry.description && (
                        <p className="text-sm text-gray-600 mt-2">{entry.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  {entry.proposals && entry.proposals.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-4 gap-4">
                        {entry.proposals.map((proposal) => (
                          <div key={proposal.id} className="bg-blue-50 rounded px-3 py-2">
                            <div className="text-xs text-gray-600 mb-1">{proposal.year} Yılı</div>
                            <div className="font-semibold text-blue-900">₺ {formatCurrency(proposal.amount)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editingEntry ? 'Gider Kaydını Düzenle' : 'Yeni Gider Kaydı'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.program_id}
                onChange={(e) => setFormData({ ...formData, program_id: e.target.value, sub_program_id: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alt Program <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.sub_program_id}
                onChange={(e) => setFormData({ ...formData, sub_program_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={!formData.program_id}
              >
                <option value="">Seçiniz</option>
                {filteredSubPrograms.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.full_code} - {sp.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faaliyet <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.activity_id}
                onChange={(e) => setFormData({ ...formData, activity_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {activities.map((a) => {
                  const code = a.code || a.activity_code;
                  const name = a.name || a.activity_name;
                  return (
                    <option key={a.id} value={a.id}>{code ? `${code} - ` : ''}{name}</option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Müdürlük <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={departments.find(d => d.budget_institutional_code_id === formData.institutional_code_id)?.id || ''}
                onChange={(e) => {
                  const selectedDept = departments.find(d => d.id === e.target.value);
                  if (selectedDept) {
                    setFormData({ ...formData, institutional_code_id: selectedDept.budget_institutional_code_id });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ekonomik Kod (Gider) <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.expense_economic_code_id}
                onChange={(e) => setFormData({ ...formData, expense_economic_code_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {expenseEconomicCodes.map((ec) => (
                  <option key={ec.id} value={ec.id}>{ec.full_code} - {ec.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finansman Tipi <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.financing_type_id}
                onChange={(e) => setFormData({ ...formData, financing_type_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {financingTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>{ft.code} - {ft.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="İsteğe bağlı açıklama giriniz"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Çok Yıllı Bütçe Teklifleri</h3>
            <div className="grid grid-cols-4 gap-4">
              {Object.keys(formData.years).map((year) => (
                <div key={year}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {year} Yılı (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.years[parseInt(year) as keyof typeof formData.years]}
                    onChange={(e) => setFormData({
                      ...formData,
                      years: { ...formData.years, [year]: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowModal(false); resetForm(); }}
            >
              İptal
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
