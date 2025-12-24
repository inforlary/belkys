import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Edit, Trash2, Eye, FileText } from 'lucide-react';
import Modal from '../components/ui/Modal';

interface Form {
  id: string;
  department_id: string;
  departments: { name: string };
  program_id: string;
  programs: { code: string; name: string };
  sub_program_id: string;
  sub_programs: { code: string; name: string };
  activity_id: string;
  activities: { code: string; name: string };
  legal_basis: string;
  justification: string;
  cost_elements: string;
  status: string;
  created_at: string;
}

interface SelectOption {
  id: string;
  code: string;
  name: string;
}

interface EconomicCode {
  id: string;
  code: string;
  name: string;
  full_code: string;
}

interface FormDetail {
  id?: string;
  economic_code_id: string;
  year1: number;
  year1_budget_allocation: number;
  year1_actual_spending: number;
  year2: number;
  year2_budget_allocation: number;
  year2_actual_spending: number;
  year3: number;
  year3_requested_amount: number;
  year2_year_end_allocation: number;
  year2_total_allocation: number;
  year3_estimated_cost: number;
  year4_estimated_cost: number;
}

export default function BudgetPerformanceForms() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();

  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const [programs, setPrograms] = useState<SelectOption[]>([]);
  const [subPrograms, setSubPrograms] = useState<SelectOption[]>([]);
  const [activities, setActivities] = useState<SelectOption[]>([]);
  const [economicCodes, setEconomicCodes] = useState<EconomicCode[]>([]);
  const [filteredEconomicCodes, setFilteredEconomicCodes] = useState<EconomicCode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formDetails, setFormDetails] = useState<FormDetail[]>([]);
  const [inflationRate2027, setInflationRate2027] = useState(10);
  const [inflationRate2028, setInflationRate2028] = useState(10);

  const [formData, setFormData] = useState({
    program_id: '',
    sub_program_id: '',
    activity_id: '',
    legal_basis: '',
    justification: '',
    cost_elements: '',
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadForms();
      loadPrograms();
      loadEconomicCodes();
    }
  }, [profile]);

  useEffect(() => {
    if (formData.program_id) {
      loadSubPrograms(formData.program_id);
    } else {
      setSubPrograms([]);
      setActivities([]);
    }
  }, [formData.program_id]);

  useEffect(() => {
    if (formData.sub_program_id) {
      loadActivities(formData.sub_program_id);
    } else {
      setActivities([]);
    }
  }, [formData.sub_program_id]);

  const sortByCode = (a: SelectOption, b: SelectOption) => {
    const aNum = parseInt(a.code.split('-')[0]);
    const bNum = parseInt(b.code.split('-')[0]);
    return aNum - bNum;
  };

  const loadPrograms = async () => {
    const { data } = await supabase
      .from('programs')
      .select('id, code, name')
      .eq('organization_id', profile!.organization_id)
      .order('code');
    const sorted = (data || []).sort(sortByCode);
    setPrograms(sorted);
  };

  const loadSubPrograms = async (programId: string) => {
    const { data } = await supabase
      .from('sub_programs')
      .select('id, code, name')
      .eq('program_id', programId)
      .order('code');
    const sorted = (data || []).sort(sortByCode);
    setSubPrograms(sorted);
  };

  const loadActivities = async (subProgramId: string) => {
    const { data } = await supabase
      .from('activities')
      .select('id, code, name')
      .eq('sub_program_id', subProgramId)
      .order('code');
    const sorted = (data || []).sort(sortByCode);
    setActivities(sorted);
  };

  const loadEconomicCodes = async () => {
    const { data } = await supabase
      .from('expense_economic_codes')
      .select('id, code, name, full_code')
      .eq('organization_id', profile!.organization_id)
      .eq('level', 4)
      .eq('is_active', true)
      .order('full_code');
    const sorted = (data || []).sort((a, b) => {
      const parseCode = (code: string) => {
        const parts = code.split('.');
        return parts.map(p => parseInt(p) || 0);
      };
      const aParts = parseCode(a.full_code);
      const bParts = parseCode(b.full_code);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const diff = (aParts[i] || 0) - (bParts[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    setEconomicCodes(sorted);
    setFilteredEconomicCodes(sorted);
  };

  const loadForms = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('budget_performance_forms')
        .select(`
          *,
          departments:department_id(name),
          programs:program_id(code, name),
          sub_programs:sub_program_id(code, name),
          activities:activity_id(code, name)
        `)
        .eq('organization_id', profile!.organization_id)
        .order('created_at', { ascending: false });

      if (profile?.role !== 'admin' && profile?.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setForms(data || []);
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFormDetails = async (formId: string) => {
    const { data } = await supabase
      .from('budget_performance_form_details')
      .select('*')
      .eq('form_id', formId);

    const detailsMap = new Map(data?.map(d => [d.economic_code_id, d]) || []);

    const allDetails = economicCodes.map(ec => {
      const existing = detailsMap.get(ec.id);
      return existing || {
        economic_code_id: ec.id,
        year1: currentYear,
        year1_budget_allocation: 0,
        year1_actual_spending: 0,
        year2: currentYear + 1,
        year2_budget_allocation: 0,
        year2_actual_spending: 0,
        year3: currentYear + 2,
        year3_requested_amount: 0,
        year2_year_end_allocation: 0,
        year2_total_allocation: 0,
        year3_estimated_cost: 0,
        year4_estimated_cost: 0,
      };
    });

    setFormDetails(allDetails);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !profile?.department_id) return;

    setLoading(true);
    try {
      if (editingForm) {
        const { error } = await supabase
          .from('budget_performance_forms')
          .update({
            program_id: formData.program_id,
            sub_program_id: formData.sub_program_id,
            activity_id: formData.activity_id,
            legal_basis: formData.legal_basis,
            justification: formData.justification,
            cost_elements: formData.cost_elements,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingForm.id);

        if (error) throw error;
        alert('Form başarıyla güncellendi');
      } else {
        const { error } = await supabase
          .from('budget_performance_forms')
          .insert({
            organization_id: profile.organization_id,
            department_id: profile.department_id,
            program_id: formData.program_id,
            sub_program_id: formData.sub_program_id,
            activity_id: formData.activity_id,
            legal_basis: formData.legal_basis,
            justification: formData.justification,
            cost_elements: formData.cost_elements,
            created_by: profile.id,
            status: 'draft',
          });

        if (error) throw error;
        alert('Form başarıyla oluşturuldu');
      }

      setShowModal(false);
      setEditingForm(null);
      resetForm();
      loadForms();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (form: Form) => {
    setEditingForm(form);
    setFormData({
      program_id: form.program_id,
      sub_program_id: form.sub_program_id,
      activity_id: form.activity_id,
      legal_basis: form.legal_basis,
      justification: form.justification,
      cost_elements: form.cost_elements,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu formu silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('budget_performance_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Form başarıyla silindi');
      loadForms();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleViewDetails = async (formId: string) => {
    setSelectedFormId(formId);
    await loadFormDetails(formId);
    setShowDetailModal(true);
  };

  const handleSaveDetails = async () => {
    if (!selectedFormId) return;

    setLoading(true);
    try {
      for (const detail of formDetails) {
        if (detail.id) {
          await supabase
            .from('budget_performance_form_details')
            .update({
              year1_budget_allocation: detail.year1_budget_allocation,
              year1_actual_spending: detail.year1_actual_spending,
              year2_budget_allocation: detail.year2_budget_allocation,
              year2_actual_spending: detail.year2_actual_spending,
              year3_requested_amount: detail.year3_requested_amount,
              year2_year_end_allocation: detail.year2_year_end_allocation,
              year2_total_allocation: detail.year2_total_allocation,
              year3_estimated_cost: detail.year3_estimated_cost,
              year4_estimated_cost: detail.year4_estimated_cost,
              updated_at: new Date().toISOString(),
            })
            .eq('id', detail.id);
        } else {
          await supabase
            .from('budget_performance_form_details')
            .insert({
              form_id: selectedFormId,
              economic_code_id: detail.economic_code_id,
              year1: detail.year1,
              year1_budget_allocation: detail.year1_budget_allocation,
              year1_actual_spending: detail.year1_actual_spending,
              year2: detail.year2,
              year2_budget_allocation: detail.year2_budget_allocation,
              year2_actual_spending: detail.year2_actual_spending,
              year3: detail.year3,
              year3_requested_amount: detail.year3_requested_amount,
              year2_year_end_allocation: detail.year2_year_end_allocation,
              year2_total_allocation: detail.year2_total_allocation,
              year3_estimated_cost: detail.year3_estimated_cost,
              year4_estimated_cost: detail.year4_estimated_cost,
            });
        }
      }

      alert('Detaylar başarıyla kaydedildi');
      setShowDetailModal(false);
      setSelectedFormId(null);
      setFormDetails([]);
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateDetail = (economicCodeId: string, field: keyof FormDetail, value: number) => {
    setFormDetails(prev =>
      prev.map(d => {
        if (d.economic_code_id !== economicCodeId) return d;
        const updated = { ...d, [field]: value };

        if (field === 'year3_requested_amount') {
          if (value > 0) {
            const year2027 = Math.round(value * (1 + inflationRate2027 / 100) * 100) / 100;
            const year2028 = Math.round(year2027 * (1 + inflationRate2028 / 100) * 100) / 100;
            updated.year3_estimated_cost = year2027;
            updated.year4_estimated_cost = year2028;
          } else {
            updated.year3_estimated_cost = 0;
            updated.year4_estimated_cost = 0;
          }
        }

        return updated;
      })
    );
  };

  const formatCurrency = (value: number | string): string => {
    if (!value || value === 0 || value === '') return '';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue === 0) return '';
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue) + ' ₺';
  };

  const handleCurrencyInput = (economicCodeId: string, field: keyof FormDetail, inputValue: string) => {
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      updateDetail(economicCodeId, field, 0);
      return;
    }

    const cleanValue = inputValue.replace(/[^\d.,]/g, '').replace(',', '.');
    const numValue = parseFloat(cleanValue);

    if (isNaN(numValue)) {
      updateDetail(economicCodeId, field, 0);
      return;
    }

    updateDetail(economicCodeId, field, Math.round(numValue * 100) / 100);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredEconomicCodes(economicCodes);
      return;
    }
    const filtered = economicCodes.filter(ec =>
      ec.name.toLowerCase().includes(term.toLowerCase()) ||
      ec.full_code.includes(term)
    );
    setFilteredEconomicCodes(filtered);
  };

  const resetForm = () => {
    setFormData({
      program_id: '',
      sub_program_id: '',
      activity_id: '',
      legal_basis: '',
      justification: '',
      cost_elements: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels = {
      draft: 'Taslak',
      submitted: 'Gönderildi',
      approved: 'Onaylandı',
      rejected: 'Reddedildi',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bütçe Performans Formları</h1>
            <p className="text-sm text-gray-600 mt-1">
              Faaliyet bazlı bütçe performans formlarını yönetin
            </p>
          </div>
          {profile?.role === 'manager' && (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Form
            </Button>
          )}
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alt Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Faaliyet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Müdürlük
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Yükleniyor...
                    </td>
                  </tr>
                ) : forms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Henüz form bulunmuyor
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => (
                    <tr key={form.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {form.programs?.code} - {form.programs?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {form.sub_programs?.code} - {form.sub_programs?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {form.activities?.code} - {form.activities?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {form.departments?.name}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(form.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewDetails(form.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Detayları Görüntüle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {profile?.role === 'manager' && form.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleEdit(form)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Düzenle"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(form.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingForm(null);
            resetForm();
          }}
          title={editingForm ? 'Form Düzenle' : 'Yeni Form Oluştur'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program
              </label>
              <select
                value={formData.program_id}
                onChange={(e) => setFormData({ ...formData, program_id: e.target.value, sub_program_id: '', activity_id: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seçiniz</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alt Program
              </label>
              <select
                value={formData.sub_program_id}
                onChange={(e) => setFormData({ ...formData, sub_program_id: e.target.value, activity_id: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!formData.program_id}
              >
                <option value="">Seçiniz</option>
                {subPrograms.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.code} - {sp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faaliyet
              </label>
              <select
                value={formData.activity_id}
                onChange={(e) => setFormData({ ...formData, activity_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!formData.sub_program_id}
              >
                <option value="">Seçiniz</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yasal Dayanak
              </label>
              <textarea
                value={formData.legal_basis}
                onChange={(e) => setFormData({ ...formData, legal_basis: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gerekçe ve Yürütülecek İşler
              </label>
              <textarea
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maliyet Unsurları
              </label>
              <textarea
                value={formData.cost_elements}
                onChange={(e) => setFormData({ ...formData, cost_elements: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditingForm(null);
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Kaydediliyor...' : editingForm ? 'Güncelle' : 'Oluştur'}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedFormId(null);
            setFormDetails([]);
            setSearchTerm('');
            setFilteredEconomicCodes(economicCodes);
          }}
          title="Faaliyet Ödeneği İhtiyacı"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <input
                  type="text"
                  placeholder="Ekonomik kod veya açıklama ara..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">2027 Artış Oranı (%)</label>
                <input
                  type="number"
                  value={inflationRate2027}
                  onChange={(e) => setInflationRate2027(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">2028 Artış Oranı (%)</label>
                <input
                  type="number"
                  value={inflationRate2028}
                  onChange={(e) => setInflationRate2028(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="border px-2 py-2 text-left sticky left-0 bg-gray-50 z-10">Ekonomik Kod</th>
                    <th className="border px-2 py-2">{currentYear + 1}<br/>Talep</th>
                    <th className="border px-2 py-2">{currentYear + 2}<br/>Tahmin</th>
                    <th className="border px-2 py-2">{currentYear + 3}<br/>Tahmin</th>
                  </tr>
                </thead>
                <tbody>
                  {formDetails
                    .filter(detail => {
                      if (!searchTerm) return true;
                      return filteredEconomicCodes.some(ec => ec.id === detail.economic_code_id);
                    })
                    .map((detail) => {
                    const code = economicCodes.find(ec => ec.id === detail.economic_code_id);
                    return (
                      <tr key={detail.economic_code_id}>
                        <td className="border px-2 py-2 sticky left-0 bg-white">
                          <div className="text-xs font-medium">{code?.full_code}</div>
                          <div className="text-xs text-gray-600 max-w-xs">{code?.name}</div>
                        </td>
                        <td className="border px-2 py-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={detail.year3_requested_amount > 0 ? detail.year3_requested_amount : ''}
                            onChange={(e) => handleCurrencyInput(detail.economic_code_id, 'year3_requested_amount', e.target.value)}
                            className="w-32 px-2 py-1 text-sm border rounded text-right"
                            disabled={profile?.role !== 'manager'}
                            placeholder="0"
                          />
                        </td>
                        <td className="border px-2 py-1 bg-blue-50">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={detail.year3_estimated_cost > 0 ? detail.year3_estimated_cost.toFixed(2) : ''}
                            onChange={(e) => handleCurrencyInput(detail.economic_code_id, 'year3_estimated_cost', e.target.value)}
                            className="w-32 px-2 py-1 text-sm border rounded text-right bg-white"
                            disabled={profile?.role !== 'manager'}
                            placeholder="0"
                          />
                        </td>
                        <td className="border px-2 py-1 bg-blue-50">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={detail.year4_estimated_cost > 0 ? detail.year4_estimated_cost.toFixed(2) : ''}
                            onChange={(e) => handleCurrencyInput(detail.economic_code_id, 'year4_estimated_cost', e.target.value)}
                            className="w-32 px-2 py-1 text-sm border rounded text-right bg-white"
                            disabled={profile?.role !== 'manager'}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
                  <tr>
                    <td className="border px-2 py-2 sticky left-0 bg-gray-100 z-10">TOPLAM</td>
                    <td className="border px-2 py-2 text-right">
                      {formatCurrency(formDetails.reduce((sum, d) => sum + (d.year3_requested_amount || 0), 0))}
                    </td>
                    <td className="border px-2 py-2 text-right">
                      {formatCurrency(formDetails.reduce((sum, d) => sum + (d.year3_estimated_cost || 0), 0))}
                    </td>
                    <td className="border px-2 py-2 text-right">
                      {formatCurrency(formDetails.reduce((sum, d) => sum + (d.year4_estimated_cost || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {profile?.role === 'manager' && (
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedFormId(null);
                    setFormDetails([]);
                    setSearchTerm('');
                    setFilteredEconomicCodes(economicCodes);
                  }}
                >
                  İptal
                </Button>
                <Button onClick={handleSaveDetails} disabled={loading}>
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      </div>
  );
}
