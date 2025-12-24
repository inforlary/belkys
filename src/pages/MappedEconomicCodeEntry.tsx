import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Save, X, Search, DollarSign, Trash2, CreditCard as Edit2, Eye } from 'lucide-react';

interface Mapping {
  id: string;
  department: { name: string };
  program: { code: string; name: string };
  sub_program: { code: string; full_code: string; name: string };
  activity_code: string;
  activity_name: string;
}

interface InstitutionalCode {
  id: string;
  full_code: string;
  name: string;
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

interface EconomicEntry {
  id: string;
  mapping_id: string;
  mapping: Mapping;
  institutional_code: InstitutionalCode;
  economic_code: EconomicCode;
  financing_type: FinancingType;
  description: string;
  amount_2026: number;
  amount_2027: number;
  amount_2028: number;
  status: string;
  created_at: string;
}

export default function MappedEconomicCodeEntry() {
  const { profile } = useAuth();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [institutionalCodes, setInstitutionalCodes] = useState<InstitutionalCode[]>([]);
  const [economicCodes, setEconomicCodes] = useState<EconomicCode[]>([]);
  const [financingTypes, setFinancingTypes] = useState<FinancingType[]>([]);
  const [entries, setEntries] = useState<EconomicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    mapping_id: '',
    institutional_code_id: '',
    economic_code_id: '',
    financing_type_id: '',
    description: '',
    amount_2026: '',
    amount_2027: '',
    amount_2028: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMapping, setSelectedMapping] = useState<string>('all');

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  async function loadData() {
    try {
      setLoading(true);

      const [
        { data: mappingData },
        { data: instData },
        { data: econData },
        { data: finData },
        { data: entryData }
      ] = await Promise.all([
        supabase.from('program_activity_mappings').select(`
          id,
          activity_code,
          activity_name,
          department:departments(name),
          program:programs(code, name),
          sub_program:sub_programs(code, full_code, name)
        `).eq('organization_id', profile.organization_id).eq('status', 'active').order('created_at', { ascending: false }),

        supabase.from('budget_institutional_codes').select('id, full_code, name').eq('organization_id', profile.organization_id).eq('is_active', true).order('full_code'),

        supabase.from('expense_economic_codes').select('id, full_code, name').eq('organization_id', profile.organization_id).eq('is_active', true).order('full_code'),

        supabase.from('financing_types').select('id, code, name').eq('organization_id', profile.organization_id).eq('is_active', true).order('code'),

        supabase.from('mapped_economic_codes').select(`
          *,
          mapping:program_activity_mappings(
            id,
            activity_code,
            activity_name,
            department:departments(name),
            program:programs(code, name),
            sub_program:sub_programs(code, full_code, name)
          ),
          institutional_code:budget_institutional_codes(id, full_code, name),
          economic_code:expense_economic_codes(id, full_code, name),
          financing_type:financing_types(id, code, name)
        `).eq('organization_id', profile.organization_id).order('created_at', { ascending: false })
      ]);

      setMappings(mappingData || []);
      setInstitutionalCodes(instData || []);
      setEconomicCodes(econData || []);
      setFinancingTypes(finData || []);
      setEntries(entryData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload = {
        organization_id: profile.organization_id,
        mapping_id: formData.mapping_id,
        institutional_code_id: formData.institutional_code_id || null,
        economic_code_id: formData.economic_code_id,
        financing_type_id: formData.financing_type_id || null,
        description: formData.description,
        amount_2026: parseFloat(formData.amount_2026) || 0,
        amount_2027: parseFloat(formData.amount_2027) || 0,
        amount_2028: parseFloat(formData.amount_2028) || 0,
        created_by: profile.id,
        updated_by: profile.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('mapped_economic_codes')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        alert('Kayıt güncellendi');
      } else {
        const { error } = await supabase
          .from('mapped_economic_codes')
          .insert([payload]);

        if (error) throw error;
        alert('Kayıt oluşturuldu');
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving entry:', error);
      alert(error.message || 'Kayıt sırasında hata oluştu');
    }
  }

  function resetForm() {
    setFormData({
      mapping_id: '',
      institutional_code_id: '',
      economic_code_id: '',
      financing_type_id: '',
      description: '',
      amount_2026: '',
      amount_2027: '',
      amount_2028: ''
    });
    setShowForm(false);
    setEditingId(null);
  }

  function editEntry(entry: EconomicEntry) {
    setFormData({
      mapping_id: entry.mapping_id,
      institutional_code_id: entry.institutional_code?.id || '',
      economic_code_id: entry.economic_code.id,
      financing_type_id: entry.financing_type?.id || '',
      description: entry.description,
      amount_2026: entry.amount_2026.toString(),
      amount_2027: entry.amount_2027.toString(),
      amount_2028: entry.amount_2028.toString()
    });
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function deleteEntry(id: string) {
    if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('mapped_economic_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Kayıt silindi');
      loadData();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      alert(error.message || 'Silme sırasında hata oluştu');
    }
  }

  const filteredEntries = entries.filter(e => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.economic_code?.full_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.mapping?.activity_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMapping = selectedMapping === 'all' || e.mapping_id === selectedMapping;

    return matchesSearch && matchesMapping;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ₺';
  };

  const calculateTotals = () => {
    return filteredEntries.reduce((acc, entry) => ({
      total_2026: acc.total_2026 + Number(entry.amount_2026),
      total_2027: acc.total_2027 + Number(entry.amount_2027),
      total_2028: acc.total_2028 + Number(entry.amount_2028),
    }), { total_2026: 0, total_2027: 0, total_2028: 0 });
  };

  const totals = calculateTotals();

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

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ekonomik Kod Girişi</h1>
            <p className="mt-1 text-blue-100">
              Eşleştirilen program-faaliyet yapılarına ekonomik kod ve tutar girişi yapın
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 bg-white text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showForm ? 'İptal' : 'Yeni Giriş'}</span>
          </button>
        </div>
      </div>

      {mappings.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">
            Henüz program-faaliyet eşleştirmesi yapılmamış. Önce <strong>Program-Faaliyet Eşleştirme</strong> sayfasından eşleştirme oluşturun.
          </p>
        </div>
      )}

      {showForm && mappings.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Girişi Düzenle' : 'Yeni Giriş Oluştur'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program-Faaliyet Seçimi *
              </label>
              <select
                required
                value={formData.mapping_id}
                onChange={(e) => setFormData({ ...formData, mapping_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {mappings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.department.name} - {m.program.code} - {m.sub_program.full_code} - {m.activity_code} {m.activity_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kurumsal Kod
                </label>
                <select
                  value={formData.institutional_code_id}
                  onChange={(e) => setFormData({ ...formData, institutional_code_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {institutionalCodes.map(ic => (
                    <option key={ic.id} value={ic.id}>{ic.full_code} - {ic.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ekonomik Kod *
                </label>
                <select
                  required
                  value={formData.economic_code_id}
                  onChange={(e) => setFormData({ ...formData, economic_code_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {economicCodes.map(ec => (
                    <option key={ec.id} value={ec.id}>{ec.full_code} - {ec.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Finansman Tipi
                </label>
                <select
                  value={formData.financing_type_id}
                  onChange={(e) => setFormData({ ...formData, financing_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçiniz</option>
                  {financingTypes.map(ft => (
                    <option key={ft.id} value={ft.id}>{ft.code} - {ft.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama *
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Gider açıklamasını giriniz"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2026 Tutarı (TRY)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount_2026}
                  onChange={(e) => setFormData({ ...formData, amount_2026: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2027 Tutarı (TRY)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount_2027}
                  onChange={(e) => setFormData({ ...formData, amount_2027: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2028 Tutarı (TRY)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount_2028}
                  onChange={(e) => setFormData({ ...formData, amount_2028: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{editingId ? 'Güncelle' : 'Kaydet'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Ekonomik Kod Girişleri ({filteredEntries.length})
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedMapping}
                onChange={(e) => setSelectedMapping(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Faaliyetler</option>
                {mappings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.activity_code} - {m.activity_name}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ara..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Faaliyet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kodlar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Açıklama</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">2026</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">2027</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">2028</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <div className="font-medium text-gray-900">{entry.mapping?.department?.name}</div>
                      <div className="text-gray-600">{entry.mapping?.activity_code} - {entry.mapping?.activity_name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs space-y-1">
                      {entry.institutional_code && (
                        <div className="text-gray-600">K: {entry.institutional_code.full_code}</div>
                      )}
                      <div className="text-gray-900 font-medium">E: {entry.economic_code?.full_code}</div>
                      {entry.financing_type && (
                        <div className="text-gray-600">F: {entry.financing_type.code}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{entry.description}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(entry.amount_2026)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(entry.amount_2027)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(entry.amount_2028)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => editEntry(entry)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredEntries.length > 0 && (
              <tfoot className="bg-gradient-to-r from-blue-50 to-blue-100 border-t-2 border-blue-300">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-900 text-sm uppercase">
                    Genel Toplam:
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-base font-bold text-blue-700">
                      {formatCurrency(totals.total_2026)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-base font-bold text-blue-700">
                      {formatCurrency(totals.total_2027)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-base font-bold text-blue-700">
                      {formatCurrency(totals.total_2028)}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz ekonomik kod girişi yapılmamış'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
