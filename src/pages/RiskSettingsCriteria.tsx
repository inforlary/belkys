import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface Criteria {
  id?: string;
  likelihood_criteria: Array<{ level: number; label: string; description: string }>;
  impact_criteria: Array<{ level: number; label: string; description: string }>;
  score_ranges: Array<{ min: number; max: number; label: string; color: string }>;
}

export default function RiskSettingsCriteria() {
  const { profile } = useAuth();
  const [criteria, setCriteria] = useState<Criteria>({
    likelihood_criteria: [
      { level: 1, label: 'Çok Düşük', description: 'Neredeyse hiç gerçekleşmez (0-10%)' },
      { level: 2, label: 'Düşük', description: 'Nadiren gerçekleşir (10-30%)' },
      { level: 3, label: 'Orta', description: 'Bazen gerçekleşebilir (30-50%)' },
      { level: 4, label: 'Yüksek', description: 'Sık sık gerçekleşir (50-75%)' },
      { level: 5, label: 'Çok Yüksek', description: 'Neredeyse kesin gerçekleşir (75-100%)' }
    ],
    impact_criteria: [
      { level: 1, label: 'Önemsiz', description: 'Minimum etki, ihmal edilebilir' },
      { level: 2, label: 'Düşük', description: 'Küçük aksaklıklar, kısa süreli' },
      { level: 3, label: 'Orta', description: 'Önemli aksaklıklar, müdahale gerekli' },
      { level: 4, label: 'Yüksek', description: 'Ciddi aksaklıklar, acil müdahale' },
      { level: 5, label: 'Kritik', description: 'Felaket senaryosu, geri dönüşsüz' }
    ],
    score_ranges: [
      { min: 1, max: 4, label: 'Düşük', color: '#22C55E' },
      { min: 5, max: 9, label: 'Orta', color: '#F59E0B' },
      { min: 10, max: 15, label: 'Yüksek', color: '#EF4444' },
      { min: 16, max: 25, label: 'Kritik', color: '#991B1B' }
    ]
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCriteria();
  }, [profile?.organization_id]);

  const loadCriteria = async () => {
    try {
      setLoading(true);
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const { data, error } = await supabase
        .from('risk_criteria')
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setCriteria(data);
      }
    } catch (error) {
      console.error('Error loading criteria:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const orgId = profile?.organization_id;
      if (!orgId) return;

      const dataToSave = {
        ...criteria,
        organization_id: orgId,
        updated_at: new Date().toISOString()
      };

      let error;
      if (criteria.id) {
        const result = await supabase
          .from('risk_criteria')
          .update(dataToSave)
          .eq('id', criteria.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('risk_criteria')
          .insert([dataToSave])
          .select()
          .single();
        error = result.error;
        if (result.data) {
          setCriteria(result.data);
        }
      }

      if (error) throw error;

      setMessage({ type: 'success', text: 'Kriterler başarıyla kaydedildi' });
    } catch (error) {
      console.error('Error saving criteria:', error);
      setMessage({ type: 'error', text: 'Kaydetme sırasında hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const updateLikelihoodCriteria = (index: number, field: string, value: string) => {
    const updated = [...criteria.likelihood_criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria({ ...criteria, likelihood_criteria: updated });
  };

  const updateImpactCriteria = (index: number, field: string, value: string) => {
    const updated = [...criteria.impact_criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria({ ...criteria, impact_criteria: updated });
  };

  const updateScoreRange = (index: number, field: string, value: any) => {
    const updated = [...criteria.score_ranges];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria({ ...criteria, score_ranges: updated });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Olasılık ve Etki Kriterleri</h1>
          <p className="mt-2 text-gray-600">Risk değerlendirme ölçüt tanımları</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Olasılık Kriterleri (1-5)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Seviye
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Etiket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Açıklama
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {criteria.likelihood_criteria.map((item, index) => (
                <tr key={item.level}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.level}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateLikelihoodCriteria(index, 'label', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLikelihoodCriteria(index, 'description', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Etki Kriterleri (1-5)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Seviye
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Etiket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Açıklama
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {criteria.impact_criteria.map((item, index) => (
                <tr key={item.level}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.level}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateImpactCriteria(index, 'label', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateImpactCriteria(index, 'description', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Skoru Renk Aralıkları</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Min Skor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Max Skor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Etiket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Renk
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Önizleme
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {criteria.score_ranges.map((range, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="number"
                      value={range.min}
                      onChange={(e) => updateScoreRange(index, 'min', parseInt(e.target.value))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="number"
                      value={range.max}
                      onChange={(e) => updateScoreRange(index, 'max', parseInt(e.target.value))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="text"
                      value={range.label}
                      onChange={(e) => updateScoreRange(index, 'label', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="color"
                      value={range.color}
                      onChange={(e) => updateScoreRange(index, 'color', e.target.value)}
                      className="w-16 h-8 border border-gray-300 rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div
                      className="w-24 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: range.color }}
                    >
                      {range.label}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
