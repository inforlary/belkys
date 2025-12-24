import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Plus, Trash2, Save, Send, AlertCircle } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  fiscal_year: number;
  require_indicator_link: boolean;
  require_justification: boolean;
}

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
}

interface Activity {
  id: string;
  name: string;
}

interface Indicator {
  id: string;
  code: string;
  name: string;
}

interface EconomicCode {
  id: string;
  code: string;
  name: string;
}

interface FinancingType {
  id: string;
  code: string;
  name: string;
}

interface InstitutionalCode {
  id: string;
  tam_kod: string;
  kurum_adi: string;
}

export default function BudgetProposalForm() {
  const { user, profile } = useAuth();
  const { navigate } = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [economicCodes, setEconomicCodes] = useState<EconomicCode[]>([]);
  const [financingTypes, setFinancingTypes] = useState<FinancingType[]>([]);
  const [institutionalCodes, setInstitutionalCodes] = useState<InstitutionalCode[]>([]);

  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ProposalItem[]>([]);

  useEffect(() => {
    if (user && profile) {
      loadData();
    }
  }, [user, profile]);

  useEffect(() => {
    if (selectedCampaign) {
      const camp = campaigns.find(c => c.id === selectedCampaign);
      setCampaign(camp || null);
    }
  }, [selectedCampaign, campaigns]);

  async function loadData() {
    try {
      setLoading(true);

      const [campaignsRes, programsRes, economicCodesRes, financingRes, institutionalRes] = await Promise.all([
        supabase
          .from('budget_proposal_campaigns')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('status', 'active')
          .order('fiscal_year', { ascending: false }),

        supabase
          .from('programs')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('expense_economic_codes')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('financing_types')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .order('code'),

        supabase
          .from('budget_institutional_codes')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true)
          .order('tam_kod')
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (programsRes.error) throw programsRes.error;
      if (economicCodesRes.error) throw economicCodesRes.error;
      if (financingRes.error) throw financingRes.error;
      if (institutionalRes.error) throw institutionalRes.error;

      setCampaigns(campaignsRes.data || []);
      setPrograms(programsRes.data || []);
      setEconomicCodes(economicCodesRes.data || []);
      setFinancingTypes(financingRes.data || []);
      setInstitutionalCodes(institutionalRes.data || []);

      const urlParams = new URLSearchParams(window.location.search);
      const campaignId = urlParams.get('campaign');
      if (campaignId && campaignsRes.data?.some(c => c.id === campaignId)) {
        setSelectedCampaign(campaignId);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function loadSubPrograms(programId: string) {
    try {
      const { data, error } = await supabase
        .from('sub_programs')
        .select('*')
        .eq('program_id', programId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setSubPrograms(data || []);
    } catch (error) {
      console.error('Error loading sub-programs:', error);
    }
  }

  async function loadActivities(subProgramId: string) {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('sub_program_id', subProgramId)
        .order('name');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  }

  async function loadIndicators() {
    try {
      const { data, error } = await supabase
        .from('indicators')
        .select('id, code, name')
        .eq('organization_id', profile.organization_id)
        .order('code');

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Error loading indicators:', error);
    }
  }

  useEffect(() => {
    if (profile) {
      loadIndicators();
    }
  }, [profile]);

  function addItem() {
    if (!campaign) {
      alert('Lütfen önce kampanya seçin');
      return;
    }

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

  async function saveProposal(submit: boolean = false) {
    if (!selectedCampaign) {
      alert('Lütfen kampanya seçin');
      return;
    }

    if (items.length === 0) {
      alert('En az bir kalem eklemelisiniz');
      return;
    }

    if (campaign?.require_indicator_link) {
      const missingIndicator = items.some(item => !item.indicator_id);
      if (missingIndicator) {
        alert('Tüm kalemlere gösterge bağlamanız gerekiyor');
        return;
      }
    }

    if (campaign?.require_justification) {
      const missingJustification = items.some(item => !item.justification.trim());
      if (missingJustification) {
        alert('Tüm kalemler için gerekçe girmelisiniz');
        return;
      }
    }

    try {
      setSaving(true);

      const { data: proposal, error: proposalError } = await supabase
        .from('budget_proposals')
        .insert({
          campaign_id: selectedCampaign,
          department_id: profile.department_id,
          organization_id: profile.organization_id,
          status: submit ? 'submitted' : 'draft',
          notes: notes,
          submitted_at: submit ? new Date().toISOString() : null,
          submitted_by: submit ? user.id : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (proposalError) throw proposalError;

      const itemsToInsert = items.map((item, index) => ({
        proposal_id: proposal.id,
        ...item,
        sort_order: index,
        created_by: user.id,
      }));

      const { error: itemsError } = await supabase
        .from('budget_proposal_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      await supabase.from('budget_proposal_history').insert({
        proposal_id: proposal.id,
        change_type: 'status_changed',
        field_name: 'status',
        old_value: null,
        new_value: submit ? 'submitted' : 'draft',
        changed_by: user.id,
        changed_by_name: profile.full_name,
        changed_by_role: profile.role,
        notes: submit ? 'Teklif gönderildi' : 'Teklif oluşturuldu',
      });

      alert(submit ? 'Teklif başarıyla gönderildi!' : 'Teklif taslak olarak kaydedildi!');
      navigate('budget-proposals');
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
          <a href="#budget-proposals" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-6 w-6" />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Yeni Bütçe Teklifi</h1>
            <p className="mt-1 text-sm text-gray-600">
              Müdürlüğünüz için bütçe teklifi oluşturun
            </p>
          </div>
        </div>
      </div>

      {campaigns.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Aktif Kampanya Yok
              </h3>
              <p className="mt-2 text-sm text-yellow-700">
                Şu anda aktif bir bütçe kampanyası bulunmamaktadır.
              </p>
            </div>
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kampanya Seçimi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bütçe Kampanyası <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Kampanya Seçin</option>
                  {campaigns.map(camp => (
                    <option key={camp.id} value={camp.id}>
                      {camp.name} - Mali Yıl {camp.fiscal_year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genel Notlar
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Teklif hakkında genel notlar..."
                />
              </div>
            </div>
          </div>

          {selectedCampaign && (
            <>
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Bütçe Kalemleri ({items.length})
                  </h2>
                  <button
                    onClick={addItem}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Kalem Ekle
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {items.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      Henüz kalem eklenmedi. "Kalem Ekle" butonuna tıklayarak başlayın.
                    </div>
                  )}

                  {items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6 space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-md font-semibold text-gray-900">
                          Kalem #{index + 1}
                        </h3>
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Program <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={item.program_id}
                            onChange={(e) => updateItem(index, 'program_id', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="">Seçin</option>
                            {programs.map(prog => (
                              <option key={prog.id} value={prog.id}>
                                {prog.code} - {prog.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Alt Program <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={item.sub_program_id}
                            onChange={(e) => updateItem(index, 'sub_program_id', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={!item.program_id}
                            required
                          >
                            <option value="">Seçin</option>
                            {subPrograms.map(sub => (
                              <option key={sub.id} value={sub.id}>
                                {sub.full_code} - {sub.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Faaliyet
                          </label>
                          <select
                            value={item.activity_id}
                            onChange={(e) => updateItem(index, 'activity_id', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={!item.sub_program_id}
                          >
                            <option value="">Seçin</option>
                            {activities.map(act => (
                              <option key={act.id} value={act.id}>
                                {act.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Gösterge {campaign?.require_indicator_link && <span className="text-red-500">*</span>}
                          </label>
                          <select
                            value={item.indicator_id}
                            onChange={(e) => updateItem(index, 'indicator_id', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required={campaign?.require_indicator_link}
                          >
                            <option value="">Seçin</option>
                            {indicators.map(ind => (
                              <option key={ind.id} value={ind.id}>
                                {ind.code} - {ind.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Kurumsal Kod
                          </label>
                          <select
                            value={item.institutional_code_id}
                            onChange={(e) => updateItem(index, 'institutional_code_id', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ekonomik Kod <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={item.expense_economic_code_id}
                            onChange={(e) => updateItem(index, 'expense_economic_code_id', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="">Seçin</option>
                            {economicCodes.map(code => (
                              <option key={code.id} value={code.id}>
                                {code.code} - {code.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Finansman Tipi <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={item.financing_type_id}
                            onChange={(e) => updateItem(index, 'financing_type_id', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {campaign?.fiscal_year} Tutarı (TRY) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={item.year1_amount}
                            onChange={(e) => updateItem(index, 'year1_amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {campaign?.fiscal_year + 1} Tutarı (TRY) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={item.year2_amount}
                            onChange={(e) => updateItem(index, 'year2_amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {campaign?.fiscal_year + 2} Tutarı (TRY) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={item.year3_amount}
                            onChange={(e) => updateItem(index, 'year3_amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Artış Oranı (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.increase_percentage}
                            onChange={(e) => updateItem(index, 'increase_percentage', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Açıklama
                        </label>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Kalem açıklaması..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gerekçe {campaign?.require_justification && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          value={item.justification}
                          onChange={(e) => updateItem(index, 'justification', e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Neden bu bütçeye ihtiyaç var? Detaylı gerekçe..."
                          required={campaign?.require_justification}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Yıl Sonu Harcama Tahmini
                        </label>
                        <textarea
                          value={item.year_end_estimate}
                          onChange={(e) => updateItem(index, 'year_end_estimate', e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Yıl sonuna kadar tahmini harcama durumu..."
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
                      <p className="text-sm text-blue-600 font-medium">
                        {campaign?.fiscal_year} Yılı Toplam
                      </p>
                      <p className="text-2xl font-bold text-blue-900 mt-2">
                        {new Intl.NumberFormat('tr-TR').format(totalYear1)} ₺
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-green-600 font-medium">
                        {campaign?.fiscal_year + 1} Yılı Toplam
                      </p>
                      <p className="text-2xl font-bold text-green-900 mt-2">
                        {new Intl.NumberFormat('tr-TR').format(totalYear2)} ₺
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-purple-600 font-medium">
                        {campaign?.fiscal_year + 2} Yılı Toplam
                      </p>
                      <p className="text-2xl font-bold text-purple-900 mt-2">
                        {new Intl.NumberFormat('tr-TR').format(totalYear3)} ₺
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-4">
                <a
                  href="#budget-proposals"
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </a>
                <button
                  onClick={() => saveProposal(false)}
                  disabled={saving || items.length === 0}
                  className="inline-flex items-center px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  <Save className="h-5 w-5 mr-2" />
                  Taslak Kaydet
                </button>
                <button
                  onClick={() => saveProposal(true)}
                  disabled={saving || items.length === 0}
                  className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-5 w-5 mr-2" />
                  Gönder
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
