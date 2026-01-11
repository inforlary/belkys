import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { AlertTriangle, Save, X } from 'lucide-react';

export default function RiskRegisterNew() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [filteredGoals, setFilteredGoals] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category_ids: [] as string[],
    owner_department_id: '',
    objective_id: '',
    goal_id: '',
    causes: '',
    consequences: '',
    inherent_likelihood: 3,
    inherent_impact: 3,
    residual_likelihood: 2,
    residual_impact: 2,
    risk_response: 'REDUCE',
    response_rationale: '',
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadCategories();
      loadDepartments();
      loadGoals();
      generateNextCode();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (formData.owner_department_id) {
      const filtered = goals.filter(
        (goal) => goal.department_id === formData.owner_department_id
      );
      setFilteredGoals(filtered);
      if (!filtered.find((g) => g.id === formData.goal_id)) {
        setFormData((prev) => ({ ...prev, goal_id: '', objective_id: '' }));
      }
    } else {
      setFilteredGoals(goals);
    }
  }, [formData.owner_department_id, goals]);

  const generateNextCode = async () => {
    try {
      const { data, error } = await supabase
        .from('risks')
        .select('code')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastCode = data[0].code;
        const match = lastCode.match(/R-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const nextCode = `R-${nextNumber.toString().padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, code: nextCode }));
    } catch (error) {
      console.error('Kod oluşturulurken hata:', error);
      setFormData(prev => ({ ...prev, code: 'R-001' }));
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('risk_categories')
        .select('id, code, name, type')
        .or(`organization_id.is.null,organization_id.eq.${profile?.organization_id}`)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Birimler yüklenirken hata:', error);
    }
  };

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('id, title, code, department_id, objective_id')
        .eq('organization_id', profile?.organization_id)
        .order('code');

      if (error) throw error;
      setGoals(data || []);
      setFilteredGoals(data || []);
    } catch (error) {
      console.error('Hedefler yüklenirken hata:', error);
    }
  };

  const inherentScore = formData.inherent_likelihood * formData.inherent_impact;
  const residualScore = formData.residual_likelihood * formData.residual_impact;

  const getRiskLevel = (score: number) => {
    if (score >= 20) return 'CRITICAL';
    if (score >= 15) return 'HIGH';
    if (score >= 9) return 'MEDIUM';
    return 'LOW';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      alert('Lütfen zorunlu alanları doldurun!');
      return;
    }

    if (formData.category_ids.length === 0) {
      alert('En az bir risk kategorisi seçmelisiniz!');
      return;
    }

    setLoading(true);
    try {
      const { data: riskData, error: riskError } = await supabase
        .from('risks')
        .insert({
          organization_id: profile?.organization_id,
          objective_id: formData.objective_id || null,
          goal_id: formData.goal_id || null,
          owner_department_id: formData.owner_department_id || null,
          code: formData.code,
          name: formData.name,
          description: formData.description,
          causes: formData.causes,
          consequences: formData.consequences,
          inherent_likelihood: formData.inherent_likelihood,
          inherent_impact: formData.inherent_impact,
          residual_likelihood: formData.residual_likelihood,
          residual_impact: formData.residual_impact,
          risk_level: getRiskLevel(residualScore),
          risk_response: formData.risk_response,
          response_rationale: formData.response_rationale,
          status: 'ACTIVE',
          is_active: true,
          identified_date: new Date().toISOString().split('T')[0],
          identified_by_id: profile?.id,
        })
        .select()
        .single();

      if (riskError) throw riskError;

      const categoryMappings = formData.category_ids.map(categoryId => ({
        risk_id: riskData.id,
        category_id: categoryId
      }));

      const { error: mappingError } = await supabase
        .from('risk_category_mappings')
        .insert(categoryMappings);

      if (mappingError) throw mappingError;

      alert('Risk başarıyla kaydedildi!');
      navigate('risks/register');
    } catch (error) {
      console.error('Risk kaydedilirken hata:', error);
      alert('Risk kaydedilemedi!');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (score: number) => {
    if (score >= 20) return 'text-red-600 font-bold';
    if (score >= 15) return 'text-orange-600 font-bold';
    if (score >= 9) return 'text-yellow-600 font-bold';
    return 'text-green-600 font-bold';
  };

  const getRiskLevelLabel = (score: number) => {
    if (score >= 20) return 'Kritik';
    if (score >= 15) return 'Yüksek';
    if (score >= 9) return 'Orta';
    return 'Düşük';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            Yeni Risk Ekle
          </h1>
          <p className="text-slate-600 mt-2">Risk kaydı oluşturun</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Temel Bilgiler</h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Risk Kodu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Risk Kategorileri <span className="text-red-500">*</span> (Birden fazla seçilebilir)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border border-slate-300 rounded-lg p-4">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.category_ids.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              category_ids: [...prev.category_ids, category.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              category_ids: prev.category_ids.filter(id => id !== category.id)
                            }));
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">
                        {category.code} - {category.name}
                        <span className="text-xs text-slate-500 ml-1">({category.type})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Açıklama
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sorumlu Birim
                </label>
                <select
                  value={formData.owner_department_id}
                  onChange={(e) => setFormData({ ...formData, owner_department_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  İlişkili Hedef (Opsiyonel)
                  {formData.owner_department_id && (
                    <span className="text-xs text-slate-500 ml-2">
                      (Seçilen birime ait hedefler gösteriliyor)
                    </span>
                  )}
                </label>
                <select
                  value={formData.goal_id}
                  onChange={(e) => {
                    const selectedGoal = goals.find(g => g.id === e.target.value);
                    setFormData({
                      ...formData,
                      goal_id: e.target.value,
                      objective_id: selectedGoal?.objective_id || ''
                    });
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!formData.owner_department_id}
                >
                  <option value="">
                    {formData.owner_department_id ? 'Seçiniz' : 'Önce sorumlu birim seçiniz'}
                  </option>
                  {filteredGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.code} - {goal.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Nedenleri ve Etkileri</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nedenleri
              </label>
              <textarea
                value={formData.causes}
                onChange={(e) => setFormData({ ...formData, causes: e.target.value })}
                rows={3}
                placeholder="Riskin oluşma nedenleri..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Olası Sonuçları
              </label>
              <textarea
                value={formData.consequences}
                onChange={(e) => setFormData({ ...formData, consequences: e.target.value })}
                rows={3}
                placeholder="Riskin olası sonuçları..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Doğal Risk Değerlendirmesi</h3>
            <p className="text-sm text-slate-600 mb-4">Kontrol önlemleri olmadan riskin değerlendirmesi</p>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Olasılık (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.inherent_likelihood}
                  onChange={(e) => setFormData({ ...formData, inherent_likelihood: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>Çok Düşük</span>
                  <span className="font-semibold text-blue-600 text-lg">{formData.inherent_likelihood}</span>
                  <span>Çok Yüksek</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Etki (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.inherent_impact}
                  onChange={(e) => setFormData({ ...formData, inherent_impact: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>Çok Düşük</span>
                  <span className="font-semibold text-blue-600 text-lg">{formData.inherent_impact}</span>
                  <span>Çok Yüksek</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Doğal Risk Skoru:</span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-slate-900">{inherentScore}</span>
                  <span className={`text-sm ${getRiskLevelColor(inherentScore)}`}>
                    ({getRiskLevelLabel(inherentScore)})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Artık Risk Değerlendirmesi</h3>
            <p className="text-sm text-slate-600 mb-4">Kontrol önlemleri uygulandıktan sonra kalan risk</p>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Olasılık (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.residual_likelihood}
                  onChange={(e) => setFormData({ ...formData, residual_likelihood: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>Çok Düşük</span>
                  <span className="font-semibold text-blue-600 text-lg">{formData.residual_likelihood}</span>
                  <span>Çok Yüksek</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Etki (1-5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.residual_impact}
                  onChange={(e) => setFormData({ ...formData, residual_impact: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>Çok Düşük</span>
                  <span className="font-semibold text-blue-600 text-lg">{formData.residual_impact}</span>
                  <span>Çok Yüksek</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Artık Risk Skoru:</span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-slate-900">{residualScore}</span>
                  <span className={`text-sm ${getRiskLevelColor(residualScore)}`}>
                    ({getRiskLevelLabel(residualScore)})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Yanıtı</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Risk Yanıt Stratejisi
              </label>
              <select
                value={formData.risk_response}
                onChange={(e) => setFormData({ ...formData, risk_response: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ACCEPT">Kabul Et</option>
                <option value="REDUCE">Azalt</option>
                <option value="TRANSFER">Transfer Et</option>
                <option value="AVOID">Kaçın</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Yanıt Gerekçesi
              </label>
              <textarea
                value={formData.response_rationale}
                onChange={(e) => setFormData({ ...formData, response_rationale: e.target.value })}
                rows={3}
                placeholder="Risk yanıt stratejisinin gerekçesi..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => navigate('risks/register')}
              className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              İptal
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
