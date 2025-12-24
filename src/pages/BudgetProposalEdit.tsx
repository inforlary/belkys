import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';

interface ProposalItem {
  id?: string;
  program_id: string;
  sub_program_id: string;
  activity_id: string;
  indicator_id: string;
  institutional_code_id: string;
  expense_economic_code_id: string;
  financing_type_id: string;
  year1: number;
  year1_amount: number;
  year2: number;
  year2_amount: number;
  year3: number;
  year3_amount: number;
  increase_percentage: number;
  description: string;
  justification: string;
  year_end_estimate: string;
}

export default function BudgetProposalEdit() {
  const { user, profile } = useAuth();
  const { currentPath, navigate } = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const proposalId = currentPath.split('/')[1];

  const [proposal, setProposal] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ProposalItem[]>([]);

  const [programs, setPrograms] = useState<any[]>([]);
  const [subPrograms, setSubPrograms] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [economicCodes, setEconomicCodes] = useState<any[]>([]);
  const [financingTypes, setFinancingTypes] = useState<any[]>([]);
  const [institutionalCodes, setInstitutionalCodes] = useState<any[]>([]);

  useEffect(() => {
    if (user && profile && proposalId) {
      loadData();
    }
  }, [user, profile, proposalId]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: proposalData, error: proposalError } = await supabase
        .from('budget_proposals')
        .select(`
          *,
          campaign:budget_proposal_campaigns(*)
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError) throw proposalError;
      setProposal(proposalData);
      setCampaign(proposalData.campaign);
      setNotes(proposalData.notes || '');

      const { data: itemsData, error: itemsError } = await supabase
        .from('budget_proposal_items')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('sort_order');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      const [programsRes, economicCodesRes, financingRes, institutionalRes, indicatorsRes] = await Promise.all([
        supabase.from('programs').select('*').eq('organization_id', profile.organization_id).eq('is_active', true).order('code'),
        supabase.from('expense_economic_codes').select('*').eq('organization_id', profile.organization_id).eq('is_active', true).order('code'),
        supabase.from('financing_types').select('*').eq('organization_id', profile.organization_id).eq('is_active', true).order('code'),
        supabase.from('budget_institutional_codes').select('*').eq('organization_id', profile.organization_id).eq('is_active', true).order('tam_kod'),
        supabase.from('indicators').select('id, code, name').eq('organization_id', profile.organization_id).order('code')
      ]);

      setPrograms(programsRes.data || []);
      setEconomicCodes(economicCodesRes.data || []);
      setFinancingTypes(financingRes.data || []);
      setInstitutionalCodes(institutionalRes.data || []);
      setIndicators(indicatorsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function loadSubPrograms(programId: string) {
    const { data } = await supabase.from('sub_programs').select('*').eq('program_id', programId).eq('is_active', true).order('code');
    setSubPrograms(data || []);
  }

  async function loadActivities(subProgramId: string) {
    const { data } = await supabase.from('activities').select('*').eq('sub_program_id', subProgramId).order('name');
    setActivities(data || []);
  }

  function addItem() {
    const newItem: ProposalItem = {
      program_id: '',
      sub_program_id: '',
      activity_id: '',
      indicator_id: '',
      institutional_code_id: '',
      expense_economic_code_id: '',
      financing_type_id: '',
      year1: campaign.fiscal_year,
      year1_amount: 0,
      year2: campaign.fiscal_year + 1,
      year2_amount: 0,
      year3: campaign.fiscal_year + 2,
      year3_amount: 0,
      increase_percentage: 0,
      description: '',
      justification: '',
      year_end_estimate: '',
    };
    setItems([...items, newItem]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ProposalItem, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'program_id' && value) {
      loadSubPrograms(value);
      newItems[index].sub_program_id = '';
      newItems[index].activity_id = '';
    }

    if (field === 'sub_program_id' && value) {
      loadActivities(value);
      newItems[index].activity_id = '';
    }

    setItems(newItems);
  }

  async function saveProposal() {
    if (items.length === 0) {
      alert('En az bir kalem eklemelisiniz');
      return;
    }

    try {
      setSaving(true);

      await supabase.from('budget_proposal_items').delete().eq('proposal_id', proposalId);

      const { error: proposalError } = await supabase
        .from('budget_proposals')
        .update({
          notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposalId);

      if (proposalError) throw proposalError;

      const itemsToInsert = items.map((item, index) => ({
        proposal_id: proposalId,
        ...item,
        sort_order: index,
        created_by: user.id,
      }));

      const { error: itemsError } = await supabase
        .from('budget_proposal_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      await supabase.from('budget_proposal_history').insert({
        proposal_id: proposalId,
        change_type: 'updated',
        field_name: 'items',
        changed_by: user.id,
        changed_by_name: profile.full_name,
        changed_by_role: profile.role,
        notes: 'Teklif güncellendi',
      });

      alert('Teklif güncellendi!');
      navigate(`budget-proposals/${proposalId}`);
    } catch (error) {
      console.error('Error saving proposal:', error);
      alert('Teklif kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const totalYear1 = items.reduce((sum, item) => sum + (item.year1_amount || 0), 0);
  const totalYear2 = items.reduce((sum, item) => sum + (item.year2_amount || 0), 0);
  const totalYear3 = items.reduce((sum, item) => sum + (item.year3_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <a href={`#budget-proposals/${proposalId}`} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-6 w-6" />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bütçe Teklifi Düzenle</h1>
            <p className="mt-1 text-sm text-gray-600">
              {campaign?.name} - Mali Yıl {campaign?.fiscal_year}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Genel Notlar</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Teklif hakkında genel notlar..."
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Bütçe Kalemleri ({items.length})</h2>
          <button onClick={addItem} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-5 w-5 mr-2" />
            Kalem Ekle
          </button>
        </div>

        <div className="p-6 space-y-6">
          {items.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-900">Kalem #{index + 1}</h3>
                <button onClick={() => removeItem(index)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Program *</label>
                  <select
                    value={item.program_id}
                    onChange={(e) => updateItem(index, 'program_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seçin</option>
                    {programs.map(prog => (
                      <option key={prog.id} value={prog.id}>{prog.code} - {prog.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alt Program *</label>
                  <select
                    value={item.sub_program_id}
                    onChange={(e) => updateItem(index, 'sub_program_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    disabled={!item.program_id}
                    required
                  >
                    <option value="">Seçin</option>
                    {subPrograms.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gösterge</label>
                  <select
                    value={item.indicator_id}
                    onChange={(e) => updateItem(index, 'indicator_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seçin</option>
                    {indicators.map(ind => (
                      <option key={ind.id} value={ind.id}>{ind.code} - {ind.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ekonomik Kod *</label>
                  <select
                    value={item.expense_economic_code_id}
                    onChange={(e) => updateItem(index, 'expense_economic_code_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seçin</option>
                    {economicCodes.map(code => (
                      <option key={code.id} value={code.id}>{code.code} - {code.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Finansman Tipi *</label>
                  <select
                    value={item.financing_type_id}
                    onChange={(e) => updateItem(index, 'financing_type_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seçin</option>
                    {financingTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.code} - {type.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Yıl 1 Tutar *</label>
                  <input
                    type="number"
                    value={item.year1_amount}
                    onChange={(e) => updateItem(index, 'year1_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Yıl 2 Tutar *</label>
                  <input
                    type="number"
                    value={item.year2_amount}
                    onChange={(e) => updateItem(index, 'year2_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Yıl 3 Tutar *</label>
                  <input
                    type="number"
                    value={item.year3_amount}
                    onChange={(e) => updateItem(index, 'year3_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gerekçe</label>
                <textarea
                  value={item.justification}
                  onChange={(e) => updateItem(index, 'justification', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Neden bu bütçeye ihtiyaç var?"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Özet</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Yıl 1 Toplam</p>
              <p className="text-2xl font-bold text-blue-900 mt-2">
                {new Intl.NumberFormat('tr-TR').format(totalYear1)} ₺
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">Yıl 2 Toplam</p>
              <p className="text-2xl font-bold text-green-900 mt-2">
                {new Intl.NumberFormat('tr-TR').format(totalYear2)} ₺
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600">Yıl 3 Toplam</p>
              <p className="text-2xl font-bold text-purple-900 mt-2">
                {new Intl.NumberFormat('tr-TR').format(totalYear3)} ₺
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end space-x-4">
        <a href={`#budget-proposals/${proposalId}`} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
          İptal
        </a>
        <button
          onClick={saveProposal}
          disabled={saving || items.length === 0}
          className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-5 w-5 mr-2" />
          Kaydet
        </button>
      </div>
    </div>
  );
}
