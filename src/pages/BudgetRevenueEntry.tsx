import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Plus, Save, Trash2, Edit2, TrendingUp, FileText, AlertCircle } from 'lucide-react';

interface Department {
  id: string;
  code: string;
  name: string;
}

interface RevenueEconomicCode {
  id: string;
  code: string;
  name: string;
  full_code: string;
  level: number;
}

interface RevenueEntry {
  id: string;
  department_id: string;
  revenue_economic_code_id: string;
  description: string;
  created_at: string;
  created_by: string;
  department?: Department;
  revenue_economic_code?: RevenueEconomicCode;
  proposals?: RevenueProposal[];
}

interface RevenueProposal {
  id: string;
  entry_id: string;
  year: number;
  amount: number;
}

export default function BudgetRevenueEntry() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();

  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [revenueEconomicCodes, setRevenueEconomicCodes] = useState<RevenueEconomicCode[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authCheckLoading, setAuthCheckLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RevenueEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    department_id: '',
    revenue_economic_code_id: '',
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
      checkAuthorization();
      loadData();
    }
  }, [profile]);

  const checkAuthorization = async () => {
    if (!profile) return;
    setAuthCheckLoading(true);

    try {
      const { data, error } = await supabase
        .from('budget_authorizations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('budget_type', 'revenue')
        .eq('authorized_department_id', profile.department_id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setIsAuthorized(!!data || profile.role === 'admin' || profile.role === 'manager');
    } catch (error) {
      console.error('Error checking authorization:', error);
      setIsAuthorized(profile.role === 'admin' || profile.role === 'manager');
    } finally {
      setAuthCheckLoading(false);
    }
  };

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const [
        departmentsRes,
        revenueEconomicCodesRes,
        entriesRes
      ] = await Promise.all([
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('code'),
        supabase
          .from('revenue_economic_codes')
          .select('*')
          .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
          .eq('is_active', true)
          .order('full_code'),
        supabase
          .from('revenue_budget_entries')
          .select(`
            *,
            department:departments(id, code, name),
            revenue_economic_code:revenue_economic_codes(id, code, name, full_code)
          `)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
      ]);

      if (departmentsRes.data) setDepartments(departmentsRes.data);
      if (revenueEconomicCodesRes.data) setRevenueEconomicCodes(revenueEconomicCodesRes.data);

      if (entriesRes.data) {
        const entriesWithProposals = await Promise.all(
          entriesRes.data.map(async (entry: any) => {
            const { data: proposals } = await supabase
              .from('revenue_budget_proposals')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isAuthorized) return;

    try {
      if (editingEntry) {
        const { error: entryError } = await supabase
          .from('revenue_budget_entries')
          .update({
            department_id: formData.department_id,
            revenue_economic_code_id: formData.revenue_economic_code_id,
            description: formData.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingEntry.id);

        if (entryError) throw entryError;

        for (const [year, amount] of Object.entries(formData.years)) {
          if (amount && parseFloat(amount) > 0) {
            await supabase
              .from('revenue_budget_proposals')
              .upsert({
                entry_id: editingEntry.id,
                year: parseInt(year),
                amount: parseFloat(amount)
              });
          }
        }
      } else {
        const { data: newEntry, error: entryError } = await supabase
          .from('revenue_budget_entries')
          .insert({
            organization_id: profile.organization_id,
            department_id: formData.department_id,
            revenue_economic_code_id: formData.revenue_economic_code_id,
            description: formData.description,
            created_by: profile.id
          })
          .select()
          .single();

        if (entryError) throw entryError;

        for (const [year, amount] of Object.entries(formData.years)) {
          if (amount && parseFloat(amount) > 0) {
            await supabase
              .from('revenue_budget_proposals')
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

  const handleEdit = (entry: RevenueEntry) => {
    setEditingEntry(entry);
    const yearData: any = {};
    entry.proposals?.forEach(p => {
      yearData[p.year] = p.amount.toString();
    });

    setFormData({
      department_id: entry.department_id,
      revenue_economic_code_id: entry.revenue_economic_code_id,
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
        .from('revenue_budget_entries')
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
      department_id: '',
      revenue_economic_code_id: '',
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

  if (authCheckLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gelir Bütçe Fişi</h1>
          <p className="text-gray-600 mt-1">
            Müdürlük ve ekonomik kod bazlı gelir bütçe girişleri
          </p>
        </div>

        <Card>
          <CardBody>
            <div className="text-center py-16">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Yetki Gerekli
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Gelir bütçe fişi girişi yapabilmek için yetkinizin olması gerekmektedir.
                Lütfen sistem yöneticinizle iletişime geçin.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gelir Bütçe Fişi</h1>
          <p className="text-gray-600 mt-1">
            Müdürlük ve ekonomik kod bazlı gelir bütçe girişleri
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Gelir Kaydı
        </Button>
      </div>

      <Card>
        <CardBody>
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Henüz gelir kaydı bulunmuyor
              </h3>
              <p className="text-gray-600 mb-4">
                Yeni bir gelir bütçe fişi oluşturmak için yukarıdaki butona tıklayın
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold text-gray-900">
                          {entry.department?.code} - {entry.department?.name}
                        </h3>
                      </div>
                      <div className="text-sm">
                        <div>
                          <span className="text-gray-600">Ekonomik Kod:</span>
                          <span className="ml-2 font-medium">
                            {entry.revenue_economic_code?.full_code} - {entry.revenue_economic_code?.name}
                          </span>
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
                          <div key={proposal.id} className="bg-green-50 rounded px-3 py-2">
                            <div className="text-xs text-gray-600 mb-1">{proposal.year} Yılı</div>
                            <div className="font-semibold text-green-900">₺ {formatCurrency(proposal.amount)}</div>
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
        title={editingEntry ? 'Gelir Kaydını Düzenle' : 'Yeni Gelir Kaydı'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Müdürlük <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seçiniz</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ekonomik Kod (Gelir) <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.revenue_economic_code_id}
                onChange={(e) => setFormData({ ...formData, revenue_economic_code_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seçiniz</option>
                {revenueEconomicCodes.map((rc) => (
                  <option key={rc.id} value={rc.id}>{rc.full_code} - {rc.name}</option>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
