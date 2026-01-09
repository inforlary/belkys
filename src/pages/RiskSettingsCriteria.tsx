import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Edit2, Save, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface RiskCriterion {
  id: string;
  organization_id: string;
  criteria_type: 'LIKELIHOOD' | 'IMPACT';
  level: number;
  name: string;
  description: string;
  percentage_min: number | null;
  percentage_max: number | null;
}

export default function RiskSettingsCriteria() {
  const { profile } = useAuth();
  const [criteria, setCriteria] = useState<RiskCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      loadCriteria();
    }
  }, [profile?.organization_id]);

  const loadCriteria = async () => {
    try {
      setLoading(true);
      if (!profile?.organization_id) return;

      const { data, error } = await supabase
        .from('risk_criteria')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('criteria_type')
        .order('level');

      if (error) throw error;

      if (!data || data.length === 0) {
        await supabase.rpc('initialize_default_risk_criteria', {
          org_id: profile.organization_id
        });

        const { data: newData } = await supabase
          .from('risk_criteria')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('criteria_type')
          .order('level');

        if (newData) {
          setCriteria(newData);
        }
      } else {
        setCriteria(data);
      }
    } catch (error) {
      console.error('Error loading criteria:', error);
      setMessage({ type: 'error', text: 'Kriterler yüklenirken hata oluştu' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      for (const criterion of criteria) {
        const { error } = await supabase
          .from('risk_criteria')
          .update({
            name: criterion.name,
            description: criterion.description,
            percentage_min: criterion.percentage_min,
            percentage_max: criterion.percentage_max
          })
          .eq('id', criterion.id);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Kriterler başarıyla güncellendi' });
      setEditMode(false);
      await loadCriteria();
    } catch (error) {
      console.error('Error saving criteria:', error);
      setMessage({ type: 'error', text: 'Kaydetme sırasında hata oluştu' });
    } finally {
      setSaving(false);
    }
  };

  const updateCriterion = (id: string, field: keyof RiskCriterion, value: any) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const likelihoodCriteria = criteria.filter((c) => c.criteria_type === 'LIKELIHOOD');
  const impactCriteria = criteria.filter((c) => c.criteria_type === 'IMPACT');

  const getRiskLevelColor = (score: number): string => {
    if (score >= 20) return 'bg-gray-800';
    if (score >= 15) return 'bg-red-500';
    if (score >= 10) return 'bg-orange-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getRiskLevelEmoji = (score: number): string => {
    if (score >= 20) return '⬛';
    if (score >= 15) return '🔴';
    if (score >= 10) return '🟠';
    if (score >= 5) return '🟡';
    return '🟢';
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

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
          <h1 className="text-3xl font-bold text-gray-900">Risk Kriterleri</h1>
          <p className="mt-2 text-gray-600">Olasılık ve etki değerlendirme kriterleri</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {editMode ? (
              <>
                <button
                  onClick={() => {
                    setEditMode(false);
                    loadCriteria();
                  }}
                  disabled={saving}
                  className="btn-secondary flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Düzenle
              </button>
            )}
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Olasılık Kriterleri</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Seviye
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Açıklama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Yüzde
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {likelihoodCriteria.map((criterion) => (
                <tr key={criterion.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{criterion.level}</span>
                  </td>
                  <td className="px-6 py-4">
                    {editMode ? (
                      <input
                        type="text"
                        value={criterion.name}
                        onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{criterion.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editMode ? (
                      <textarea
                        value={criterion.description}
                        onChange={(e) =>
                          updateCriterion(criterion.id, 'description', e.target.value)
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">{criterion.description}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={criterion.percentage_min || 0}
                          onChange={(e) =>
                            updateCriterion(
                              criterion.id,
                              'percentage_min',
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-gray-500">-</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={criterion.percentage_max || 0}
                          onChange={(e) =>
                            updateCriterion(
                              criterion.id,
                              'percentage_max',
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-900">
                        %{criterion.percentage_min} - %{criterion.percentage_max}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Etki Kriterleri</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Seviye
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Açıklama
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {impactCriteria.map((criterion) => (
                <tr key={criterion.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{criterion.level}</span>
                  </td>
                  <td className="px-6 py-4">
                    {editMode ? (
                      <input
                        type="text"
                        value={criterion.name}
                        onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{criterion.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editMode ? (
                      <textarea
                        value={criterion.description}
                        onChange={(e) =>
                          updateCriterion(criterion.id, 'description', e.target.value)
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">{criterion.description}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Risk Seviye Skalası</h2>
          <p className="text-sm text-gray-500 mt-1">
            Olasılık × Etki hesaplaması sonucunda elde edilen skorlar
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Skor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seviye
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Renk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Açıklama
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  1 - 4
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Düşük</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded"></div>
                    <span className="text-2xl">🟢</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  Kabul edilebilir, izlenir
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  5 - 9
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Orta</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-500 rounded"></div>
                    <span className="text-2xl">🟡</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Kontrol gerekli</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  10 - 14
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Yüksek</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500 rounded"></div>
                    <span className="text-2xl">🟠</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  Azaltma faaliyeti gerekli
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  15 - 19
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Çok Yüksek</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-500 rounded"></div>
                    <span className="text-2xl">🔴</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Acil önlem alınmalı</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  20 - 25
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Kritik</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-800 rounded"></div>
                    <span className="text-2xl">⬛</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">Derhal müdahale edilmeli</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Risk Matrisi Önizleme</h2>
        <p className="text-sm text-gray-500 mb-6">
          Olasılık ve etki seviyelerine göre risk skorları (Olasılık × Etki)
        </p>

        <div className="inline-block">
          <div className="flex items-end gap-2 mb-2">
            <div className="w-16"></div>
            <div className="text-center font-medium text-sm text-gray-700" style={{ width: '280px' }}>
              ETKİ →
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col justify-center items-center" style={{ width: '64px' }}>
              <div className="transform -rotate-90 whitespace-nowrap font-medium text-sm text-gray-700">
                OLASILIK ↑
              </div>
            </div>

            <div>
              <div className="flex gap-1 mb-2">
                <div className="w-14"></div>
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className="w-14 h-8 flex items-center justify-center text-xs font-medium text-gray-700"
                  >
                    {level}
                  </div>
                ))}
              </div>

              {[5, 4, 3, 2, 1].map((likelihood) => (
                <div key={likelihood} className="flex gap-1 mb-1">
                  <div className="w-14 h-14 flex items-center justify-center text-sm font-medium text-gray-700">
                    {likelihood}
                  </div>
                  {[1, 2, 3, 4, 5].map((impact) => {
                    const score = likelihood * impact;
                    return (
                      <div
                        key={impact}
                        className={`w-14 h-14 flex items-center justify-center rounded border-2 border-white ${getRiskLevelColor(
                          score
                        )} text-white font-bold text-sm transition-transform hover:scale-105`}
                        title={`Olasılık: ${likelihood}, Etki: ${impact}, Skor: ${score}`}
                      >
                        {score}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Düşük (1-4)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Orta (5-9)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span>Yüksek (10-14)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Çok Yüksek (15-19)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-800 rounded"></div>
              <span>Kritik (20-25)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
