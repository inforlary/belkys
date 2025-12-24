import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Plus, Trash2, Edit2, Building2 } from 'lucide-react';

interface Activity {
  id: string;
  name: string;
  description: string;
  program?: {
    id: string;
    code: string;
    name: string;
  };
  sub_program?: {
    id: string;
    full_code: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
  };
}

interface ExpenseEntry {
  id: string;
  institutional_code_id: string;
  expense_economic_code_id: string;
  financing_type_id: string;
  description: string;
  institutional_code?: {
    tam_kod: string;
    kurum_adi: string;
  };
  expense_economic_code?: {
    full_code: string;
    name: string;
  };
  financing_type?: {
    code: string;
    name: string;
  };
  proposals?: Array<{
    year: number;
    amount: number;
  }>;
}

interface InstitutionalCode {
  id: string;
  tam_kod: string;
  kurum_adi: string;
}

interface EconomicCode {
  id: string;
  full_code: string;
  name: string;
}

interface FinancingType {
  id: string;
  code: string;
  name: string;
}

interface FormData {
  institutional_code_id: string;
  expense_economic_code_id: string;
  financing_type_id: string;
  description: string;
  amount_2026: number;
  amount_2027: number;
  amount_2028: number;
}

export default function BudgetExpenseItems() {
  const { user, profile } = useAuth();
  const { navigate, searchParams } = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activityId = searchParams.get('activity');
  const campaignId = searchParams.get('campaign');

  const [activity, setActivity] = useState<Activity | null>(null);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [institutionalCodes, setInstitutionalCodes] = useState<InstitutionalCode[]>([]);
  const [economicCodes, setEconomicCodes] = useState<EconomicCode[]>([]);
  const [financingTypes, setFinancingTypes] = useState<FinancingType[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  const [formData, setFormData] = useState<FormData>({
    institutional_code_id: '',
    expense_economic_code_id: '',
    financing_type_id: '',
    description: '',
    amount_2026: 0,
    amount_2027: 0,
    amount_2028: 0
  });

  useEffect(() => {
    if (user && profile && activityId) {
      loadAll();
    } else if (!activityId) {
      alert('Faaliyet ID bulunamadı');
      navigate('/budget-program-structure');
    }
  }, [user, profile, activityId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadActivity(),
      loadExpenseEntries(),
      loadCodes()
    ]);
    setLoading(false);
  };

  const loadActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          sub_program:sub_programs(
            id,
            full_code,
            name,
            program:programs(id, code, name)
          ),
          department:departments(id, name)
        `)
        .eq('id', activityId)
        .single();

      if (error) throw error;

      if (data && data.sub_program) {
        const enrichedData = {
          ...data,
          program: (data.sub_program as any).program
        };
        setActivity(enrichedData);
      } else {
        setActivity(data);
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      alert('Faaliyet yüklenirken hata oluştu');
      navigate('/budget-program-structure');
    }
  };

  const loadExpenseEntries = async () => {
    try {
      console.log('[loadExpenseEntries] Loading entries for activity:', activityId);

      const { data: entries, error: entriesError } = await supabase
        .from('expense_budget_entries')
        .select(`
          *,
          institutional_code:budget_institutional_codes(tam_kod, kurum_adi),
          expense_economic_code:expense_economic_codes(code, full_code, name),
          financing_type:financing_types(code, name)
        `)
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false });

      console.log('[loadExpenseEntries] Entries:', entries?.length, 'Error:', entriesError);

      if (entriesError) throw entriesError;

      const entriesWithProposals = await Promise.all(
        (entries || []).map(async (entry) => {
          const { data: proposals } = await supabase
            .from('expense_budget_proposals')
            .select('year, amount')
            .eq('entry_id', entry.id);

          return {
            ...entry,
            proposals: proposals || []
          };
        })
      );

      console.log('[loadExpenseEntries] Final entries with proposals:', entriesWithProposals);
      setExpenseEntries(entriesWithProposals);
    } catch (error) {
      console.error('Error loading expense entries:', error);
      alert('Gider kalemleri yüklenirken hata: ' + (error as any).message);
    }
  };

  const loadCodes = async () => {
    try {
      const [instCodes, econCodes, finTypes] = await Promise.all([
        supabase
          .from('budget_institutional_codes')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('tam_kod'),
        supabase
          .from('expense_economic_codes')
          .select('id, full_code, name')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .eq('level', 4)
          .order('full_code'),
        supabase
          .from('financing_types')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .eq('is_active', true)
          .order('code')
      ]);

      if (instCodes.error) throw instCodes.error;
      if (econCodes.error) throw econCodes.error;
      if (finTypes.error) throw finTypes.error;

      setInstitutionalCodes(instCodes.data || []);
      setEconomicCodes(econCodes.data || []);
      setFinancingTypes(finTypes.data || []);
    } catch (error) {
      console.error('Error loading codes:', error);
    }
  };

  const openAddModal = () => {
    setEditingEntry(null);
    setFormData({
      institutional_code_id: '',
      expense_economic_code_id: '',
      financing_type_id: '',
      description: '',
      amount_2026: 0,
      amount_2027: 0,
      amount_2028: 0
    });
    setShowModal(true);
  };

  const openEditModal = (entry: ExpenseEntry) => {
    setEditingEntry(entry);
    const proposals = entry.proposals || [];
    setFormData({
      institutional_code_id: entry.institutional_code_id,
      expense_economic_code_id: entry.expense_economic_code_id,
      financing_type_id: entry.financing_type_id,
      description: entry.description || '',
      amount_2026: proposals.find(p => p.year === 2026)?.amount || 0,
      amount_2027: proposals.find(p => p.year === 2027)?.amount || 0,
      amount_2028: proposals.find(p => p.year === 2028)?.amount || 0
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.institutional_code_id || !formData.expense_economic_code_id || !formData.financing_type_id) {
      alert('Lütfen tüm kod alanlarını doldurun.');
      return;
    }

    if (formData.amount_2026 <= 0 && formData.amount_2027 <= 0 && formData.amount_2028 <= 0) {
      alert('En az bir yıl için tutar girmelisiniz.');
      return;
    }

    try {
      setSaving(true);

      if (!activity?.program || !activity?.sub_program) {
        alert('Program bilgileri eksik.');
        return;
      }

      const entryData = {
        activity_id: activityId,
        organization_id: profile?.organization_id,
        program_id: (activity.program as any).id,
        sub_program_id: (activity.sub_program as any).id,
        institutional_code_id: formData.institutional_code_id,
        expense_economic_code_id: formData.expense_economic_code_id,
        financing_type_id: formData.financing_type_id,
        description: formData.description.trim(),
        created_by: user?.id
      };

      let entryId: string;

      if (editingEntry) {
        const { error: updateError } = await supabase
          .from('expense_budget_entries')
          .update(entryData)
          .eq('id', editingEntry.id);

        if (updateError) throw updateError;
        entryId = editingEntry.id;

        await supabase
          .from('expense_budget_proposals')
          .delete()
          .eq('entry_id', entryId);
      } else {
        const { data: newEntry, error: insertError } = await supabase
          .from('expense_budget_entries')
          .insert(entryData)
          .select()
          .single();

        if (insertError) throw insertError;
        entryId = newEntry.id;
      }

      const proposals = [];
      if (formData.amount_2026 > 0) {
        proposals.push({ entry_id: entryId, year: 2026, amount: formData.amount_2026 });
      }
      if (formData.amount_2027 > 0) {
        proposals.push({ entry_id: entryId, year: 2027, amount: formData.amount_2027 });
      }
      if (formData.amount_2028 > 0) {
        proposals.push({ entry_id: entryId, year: 2028, amount: formData.amount_2028 });
      }

      if (proposals.length > 0) {
        const { error: proposalError } = await supabase
          .from('expense_budget_proposals')
          .insert(proposals);

        if (proposalError) throw proposalError;
      }

      setShowModal(false);
      await loadExpenseEntries();
    } catch (error: any) {
      console.error('Error saving:', error);
      alert('Kaydetme hatası: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Bu gider kalemini silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await supabase
        .from('expense_budget_proposals')
        .delete()
        .eq('entry_id', entryId);

      const { error } = await supabase
        .from('expense_budget_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      await loadExpenseEntries();
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert('Silme hatası: ' + error.message);
    }
  };

  const getAmount = (entry: ExpenseEntry, year: number) => {
    return entry.proposals?.find(p => p.year === year)?.amount || 0;
  };

  const calculateTotal = (year: number) => {
    return expenseEntries.reduce((sum, entry) => sum + getAmount(entry, year), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ₺';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  if (!profile || !activity) {
    return <div className="p-6">Faaliyet bulunamadı</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/budget-program-structure')}
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 transition"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Faaliyet Listesine Dön
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{activity.name}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {activity.department && (
              <div className="flex items-start">
                <Building2 className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-700">Müdürlük:</span>
                  <span className="ml-2 text-gray-900">{activity.department.name}</span>
                </div>
              </div>
            )}

            <div>
              <span className="font-semibold text-gray-700">Program:</span>
              <span className="ml-2 text-gray-900">{activity.program?.code} - {activity.program?.name}</span>
            </div>

            <div className="md:col-span-2">
              <span className="font-semibold text-gray-700">Alt Program:</span>
              <span className="ml-2 text-gray-900">{activity.sub_program?.full_code} - {activity.sub_program?.name}</span>
            </div>

            {activity.description && (
              <div className="md:col-span-2">
                <span className="font-semibold text-gray-700">Açıklama:</span>
                <span className="ml-2 text-gray-600">{activity.description}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Gider Kalemleri</h2>
              <button
                onClick={openAddModal}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="h-5 w-5 mr-2" />
                Gider Kalemi Ekle
              </button>
            </div>
          </div>

          {expenseEntries.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 mb-4">Henüz gider kalemi eklenmemiş</p>
              <button
                onClick={openAddModal}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="h-5 w-5 mr-2" />
                İlk Gider Kalemini Ekle
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kurumsal Kod
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ekonomik Kod
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Finansman
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      2026
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      2027
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      2028
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenseEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.institutional_code?.tam_kod}
                        </div>
                        <div className="text-xs text-gray-500">
                          {entry.institutional_code?.kurum_adi}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.expense_economic_code?.full_code}
                        </div>
                        <div className="text-xs text-gray-500 max-w-xs truncate">
                          {entry.expense_economic_code?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {entry.financing_type?.code}
                        </div>
                        <div className="text-xs text-gray-500">
                          {entry.financing_type?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(getAmount(entry, 2026))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(getAmount(entry, 2027))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(getAmount(entry, 2028))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(entry)}
                          className="text-blue-600 hover:text-blue-900 mr-4 transition"
                        >
                          <Edit2 className="h-4 w-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-red-600 hover:text-red-900 transition"
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                      TOPLAM:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-blue-900">
                        {formatCurrency(calculateTotal(2026))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-blue-900">
                        {formatCurrency(calculateTotal(2027))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-blue-900">
                        {formatCurrency(calculateTotal(2028))}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingEntry ? 'Gider Kalemi Düzenle' : 'Yeni Gider Kalemi Ekle'}
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kurumsal Kod *
                    </label>
                    <select
                      value={formData.institutional_code_id}
                      onChange={(e) => setFormData({ ...formData, institutional_code_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seçin</option>
                      {institutionalCodes.map(code => (
                        <option key={code.id} value={code.id}>
                          {code.tam_kod} - {code.kurum_adi}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ekonomik Kod *
                    </label>
                    <select
                      value={formData.expense_economic_code_id}
                      onChange={(e) => setFormData({ ...formData, expense_economic_code_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seçin</option>
                      {economicCodes.map(code => (
                        <option key={code.id} value={code.id}>
                          {code.full_code} - {code.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Finansman Tipi *
                  </label>
                  <select
                    value={formData.financing_type_id}
                    onChange={(e) => setFormData({ ...formData, financing_type_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seçin</option>
                    {financingTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.code} - {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-gray-200 pt-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Yıllık Tutarlar</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        2026 Tutarı (₺) *
                      </label>
                      <input
                        type="number"
                        value={formData.amount_2026 || ''}
                        onChange={(e) => setFormData({ ...formData, amount_2026: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        2027 Tutarı (₺) *
                      </label>
                      <input
                        type="number"
                        value={formData.amount_2027 || ''}
                        onChange={(e) => setFormData({ ...formData, amount_2027: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        2028 Tutarı (₺) *
                      </label>
                      <input
                        type="number"
                        value={formData.amount_2028 || ''}
                        onChange={(e) => setFormData({ ...formData, amount_2028: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Gider kalemi hakkında açıklama..."
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium shadow-sm"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
