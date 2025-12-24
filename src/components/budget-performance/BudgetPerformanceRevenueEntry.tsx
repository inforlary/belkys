import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Save } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SelectOption {
  id: string;
  code: string;
  name: string;
  full_code?: string;
}

export default function BudgetPerformanceRevenueEntry() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();

  const [economicCodes, setEconomicCodes] = useState<SelectOption[]>([]);

  const [formData, setFormData] = useState({
    economic_code_id: '',
    description: '',
    year1_amount: '',
    year2_amount: '',
    year3_amount: '',
  });

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadEconomicCodes();
      loadEntries();
    }
  }, [profile]);

  const loadEconomicCodes = async () => {
    const { data } = await supabase
      .from('revenue_economic_codes')
      .select('id, code, name, full_code')
      .eq('organization_id', profile!.organization_id)
      .eq('level', 4)
      .eq('is_active', true)
      .order('full_code');
    setEconomicCodes(data || []);
  };

  const loadEntries = async () => {
    const { data } = await supabase
      .from('revenue_budget_entries')
      .select(`
        *,
        revenue_economic_codes:economic_code_id(full_code, name)
      `)
      .eq('organization_id', profile!.organization_id)
      .order('created_at', { ascending: false })
      .limit(10);
    setEntries(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('revenue_budget_entries').insert({
        organization_id: profile.organization_id,
        economic_code_id: formData.economic_code_id,
        description: formData.description,
        year1: currentYear,
        year1_amount: parseFloat(formData.year1_amount) || 0,
        year2: currentYear + 1,
        year2_amount: parseFloat(formData.year2_amount) || 0,
        year3: currentYear + 2,
        year3_amount: parseFloat(formData.year3_amount) || 0,
      });

      if (error) throw error;

      alert('Gelir kaydı başarıyla eklendi');
      setFormData({
        economic_code_id: '',
        description: '',
        year1_amount: '',
        year2_amount: '',
        year3_amount: '',
      });
      loadEntries();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Yeni Gelir Kaydı</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ekonomik Kod *
              </label>
              <select
                value={formData.economic_code_id}
                onChange={(e) => setFormData({ ...formData, economic_code_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">Seçiniz</option>
                {economicCodes.map(ec => (
                  <option key={ec.id} value={ec.id}>{ec.full_code} - {ec.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Açıklama *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {currentYear} Yılı Tutarı (TL) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.year1_amount}
                  onChange={(e) => setFormData({ ...formData, year1_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {currentYear + 1} Yılı Tutarı (TL) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.year2_amount}
                  onChange={(e) => setFormData({ ...formData, year2_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {currentYear + 2} Yılı Tutarı (TL) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.year3_amount}
                  onChange={(e) => setFormData({ ...formData, year3_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Son Gelir Kayıtları</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Ekonomik Kod</th>
                  <th className="px-4 py-2 text-left">Açıklama</th>
                  <th className="px-4 py-2 text-right">{currentYear}</th>
                  <th className="px-4 py-2 text-right">{currentYear + 1}</th>
                  <th className="px-4 py-2 text-right">{currentYear + 2}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map(entry => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 font-mono text-xs">{entry.revenue_economic_codes?.full_code}</td>
                    <td className="px-4 py-2 text-xs">{entry.description}</td>
                    <td className="px-4 py-2 text-right">{entry.year1_amount.toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-2 text-right">{entry.year2_amount.toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-2 text-right">{entry.year3_amount.toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
