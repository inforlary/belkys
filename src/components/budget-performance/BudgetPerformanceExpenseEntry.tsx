import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Save, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SelectOption {
  id: string;
  code: string;
  name: string;
  full_code?: string;
}

export default function BudgetPerformanceExpenseEntry() {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();

  const [programs, setPrograms] = useState<SelectOption[]>([]);
  const [subPrograms, setSubPrograms] = useState<SelectOption[]>([]);
  const [activities, setActivities] = useState<SelectOption[]>([]);
  const [economicCodes, setEconomicCodes] = useState<SelectOption[]>([]);
  const [institutionalCode, setInstitutionalCode] = useState<any>(null);

  const [formData, setFormData] = useState({
    program_id: '',
    sub_program_id: '',
    activity_id: '',
    economic_code_id: '',
    description: '',
    year1_amount: '',
    year2_amount: '',
    year3_amount: '',
  });

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.organization_id && profile?.department_id) {
      loadPrograms();
      loadEconomicCodes();
      loadEntries();
      loadDepartmentInstitutionalCode();
    }
  }, [profile]);

  const loadDepartmentInstitutionalCode = async () => {
    if (!profile?.department_id) return;
    const { data } = await supabase
      .from('departments')
      .select('budget_institutional_code_id, budget_institutional_codes(tam_kod, kurum_adi, birim_adi)')
      .eq('id', profile.department_id)
      .maybeSingle();
    if (data?.budget_institutional_codes) {
      setInstitutionalCode(data.budget_institutional_codes);
    }
  };

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
    setEconomicCodes(data || []);
  };

  const loadEntries = async () => {
    const { data } = await supabase
      .from('expense_budget_entries')
      .select(`
        *,
        programs:program_id(code, name),
        sub_programs:sub_program_id(code, name),
        activities:activity_id(code, name),
        expense_economic_codes:economic_code_id(full_code, name)
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
      const { error } = await supabase.from('expense_budget_entries').insert({
        organization_id: profile.organization_id,
        program_id: formData.program_id,
        sub_program_id: formData.sub_program_id || null,
        activity_id: formData.activity_id || null,
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

      alert('Gider kaydı başarıyla eklendi');
      setFormData({
        program_id: '',
        sub_program_id: '',
        activity_id: '',
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
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Yeni Gider Kaydı</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Program *
                </label>
                <select
                  value={formData.program_id}
                  onChange={(e) => setFormData({ ...formData, program_id: e.target.value, sub_program_id: '', activity_id: '' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Seçiniz</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Alt Program
                </label>
                <select
                  value={formData.sub_program_id}
                  onChange={(e) => setFormData({ ...formData, sub_program_id: e.target.value, activity_id: '' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled={!formData.program_id}
                >
                  <option value="">Seçiniz</option>
                  {subPrograms.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.code} - {sp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Faaliyet
                </label>
                <select
                  value={formData.activity_id}
                  onChange={(e) => setFormData({ ...formData, activity_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled={!formData.sub_program_id}
                >
                  <option value="">Seçiniz</option>
                  {activities.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kurumsal Kod *
              </label>
              {institutionalCode ? (
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-semibold text-blue-900">{institutionalCode.tam_kod}</span>
                      <span className="text-sm text-blue-700 ml-3">
                        {institutionalCode.kurum_adi} / {institutionalCode.birim_adi}
                      </span>
                    </div>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      Müdürlüğünüze Tanımlı
                    </span>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  ⚠️ Müdürlüğünüze kurumsal kod atanmamış. Lütfen yöneticinizle iletişime geçin.
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ekonomik Kod (Gider) *
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Son Gider Kayıtları</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Program</th>
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
                    <td className="px-4 py-2">{entry.programs?.code}</td>
                    <td className="px-4 py-2 font-mono text-xs">{entry.expense_economic_codes?.full_code}</td>
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
