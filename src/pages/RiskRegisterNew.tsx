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

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category_id: '',
    owner_department_id: '',
    objective_id: '',
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
      loadObjectives();
      generateNextCode();
    }
  }, [profile?.organization_id]);

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
        .select('id, name')
        .eq('organization_id', profile?.organization_id)
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

  const loadObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from('objectives')
        .select('id, title')
        .eq('organization_id', profile?.organization_id)
        .order('title');

      if (error) throw error;
      setObjectives(data || []);
    } catch (error) {
      console.error('Amaçlar yüklenirken hata:', error);
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

    setLoading(true);
    try {
      const { error } = await supabase
        .from('risks')
        .insert({
          organization_id: profile?.organization_id,
          category_id: formData.category_id || null,
          objective_id: formData.objective_id || null,
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
        });

      if (error) throw error;

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
                  Kategori
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
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
                </label>
                <select
                  value={formData.objective_id}
                  onChange={(e) => setFormData({ ...formData, objective_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seçiniz</option>
                  {objectives.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.title}
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
