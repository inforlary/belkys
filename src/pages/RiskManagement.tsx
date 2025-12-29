import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Edit2, Trash2, TrendingUp, TrendingDown, AlertCircle, Save, X, Link as LinkIcon, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import { RiskHeatMap } from '../components/RiskHeatMap';

interface Risk {
  id: string;
  risk_code: string;
  risk_title: string;
  risk_description: string;
  risk_category: 'strategic' | 'operational' | 'financial' | 'compliance' | 'reputational';
  process_id: string;
  process_name?: string;
  kiks_standard_id?: string;
  kiks_standard_title?: string;
  risk_owner_id: string;
  risk_owner_name?: string;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  status: 'identified' | 'assessed' | 'mitigating' | 'monitored' | 'accepted' | 'closed';
  last_assessment_date: string;
  isLinkedToStrategicPlan?: boolean;
  collaborationPlans?: string[];
  activity_count?: number;
  control_count?: number;
}

const CATEGORY_LABELS = {
  strategic: 'Stratejik',
  operational: 'Operasyonel',
  financial: 'Finansal',
  compliance: 'Uyumluluk',
  reputational: 'İtibar'
};

const CATEGORY_COLORS = {
  strategic: 'bg-purple-100 text-purple-800',
  operational: 'bg-blue-100 text-blue-800',
  financial: 'bg-green-100 text-green-800',
  compliance: 'bg-yellow-100 text-yellow-800',
  reputational: 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  identified: 'Tanımlanmış',
  assessed: 'Değerlendirilmiş',
  mitigating: 'Azaltma Çalışması',
  monitored: 'İzleniyor',
  accepted: 'Kabul Edildi',
  closed: 'Kapatıldı'
};

const STATUS_COLORS = {
  identified: 'bg-gray-100 text-gray-800',
  assessed: 'bg-blue-100 text-blue-800',
  mitigating: 'bg-yellow-100 text-yellow-800',
  monitored: 'bg-green-100 text-green-800',
  accepted: 'bg-orange-100 text-orange-800',
  closed: 'bg-gray-100 text-gray-800'
};

export default function RiskManagement() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan, loading: planLoading } = useICPlan();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [kiksStandards, setKiksStandards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'heatmap'>('list');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [formData, setFormData] = useState({
    risk_title: '',
    risk_description: '',
    risk_category: 'operational' as const,
    process_id: '',
    kiks_standard_id: '',
    risk_owner_id: '',
    inherent_likelihood: 3,
    inherent_impact: 3,
    residual_likelihood: 2,
    residual_impact: 2,
    status: 'identified' as const
  });

  useEffect(() => {
    if (selectedPlanId) {
      loadData();
    }
  }, [profile?.organization_id, selectedPlanId]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);
      await Promise.all([
        loadRisks(),
        loadProcesses(),
        loadUsers(),
        loadKiksStandards()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadRisks = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const [risksRes, linkedRisksRes] = await Promise.all([
        supabase
          .from('ic_risks')
          .select(`
            *,
            ic_processes(name),
            profiles!ic_risks_risk_owner_id_fkey(full_name),
            kiks:ic_kiks_sub_standards(code, title)
          `)
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId)
          .order('risk_code', { ascending: true }),

        supabase
          .from('collaboration_plan_items')
          .select(`
            ic_risk_id,
            collaboration_plans!inner(name)
          `)
          .eq('category', 'risk')
          .not('ic_risk_id', 'is', null)
      ]);

      if (risksRes.error) throw risksRes.error;

      const linkedRiskMap = new Map<string, string[]>();
      (linkedRisksRes.data || []).forEach((item: any) => {
        if (item.ic_risk_id) {
          if (!linkedRiskMap.has(item.ic_risk_id)) {
            linkedRiskMap.set(item.ic_risk_id, []);
          }
          linkedRiskMap.get(item.ic_risk_id)!.push(item.collaboration_plans?.name || 'İşbirliği Planı');
        }
      });

      const risksWithCounts = await Promise.all(
        (risksRes.data || []).map(async (risk) => {
          const [activitiesResult, controlsResult] = await Promise.all([
            supabase
              .from('ic_activity_risk_mappings')
              .select('*', { count: 'exact', head: true })
              .eq('risk_id', risk.id),
            supabase
              .from('ic_controls')
              .select('*', { count: 'exact', head: true })
              .eq('risk_id', risk.id)
          ]);

          return {
            ...risk,
            process_name: risk.ic_processes?.name,
            risk_owner_name: risk.profiles?.full_name,
            kiks_standard_title: risk.kiks ? `${risk.kiks.code} - ${risk.kiks.title}` : undefined,
            isLinkedToStrategicPlan: linkedRiskMap.has(risk.id),
            collaborationPlans: linkedRiskMap.get(risk.id) || [],
            activity_count: activitiesResult.count || 0,
            control_count: controlsResult.count || 0
          };
        })
      );

      setRisks(risksWithCounts);
    } catch (error) {
      console.error('Riskler yüklenirken hata:', error);
    }
  };

  const loadProcesses = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_processes')
        .select('id, code, name')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('name', { ascending: true });

      if (error) throw error;
      setProcesses(data || []);
    } catch (error) {
      console.error('Süreçler yüklenirken hata:', error);
    }
  };

  const loadUsers = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', profile.organization_id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
    }
  };

  const loadKiksStandards = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_kiks_sub_standards')
        .select(`
          id,
          code,
          title,
          ic_kiks_main_standards!inner(
            title,
            ic_kiks_categories!inner(
              name
            )
          )
        `)
        .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`)
        .eq('ic_plan_id', selectedPlanId)
        .order('code', { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        code: item.code,
        title: `${item.code} - ${item.ic_kiks_main_standards?.title || ''} - ${item.title}`,
        component: item.ic_kiks_main_standards?.ic_kiks_categories?.name || ''
      }));

      setKiksStandards(formattedData);
    } catch (error) {
      console.error('KİKS standartları yüklenirken hata:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const dataToSave = {
        ...formData,
        process_id: formData.process_id || null,
        kiks_standard_id: formData.kiks_standard_id || null,
        risk_owner_id: formData.risk_owner_id || null,
        risk_description: formData.risk_description || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('ic_risks')
          .update({
            ...dataToSave,
            last_assessment_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const year = new Date().getFullYear();
        const maxCodeResult = await supabase
          .from('ic_risks')
          .select('risk_code')
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId)
          .like('risk_code', `RSK-${year}-%`)
          .order('risk_code', { ascending: false })
          .limit(1);

        let nextNumber = 1;
        if (maxCodeResult.data && maxCodeResult.data.length > 0) {
          const lastCode = maxCodeResult.data[0].risk_code;
          const match = lastCode.match(/RSK-\d{4}-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        const riskCode = `RSK-${year}-${String(nextNumber).padStart(3, '0')}`;

        const { error } = await supabase
          .from('ic_risks')
          .insert({
            ...dataToSave,
            risk_code: riskCode,
            organization_id: profile.organization_id,
            ic_plan_id: selectedPlanId,
            last_assessment_date: new Date().toISOString().split('T')[0]
          });

        if (error) throw error;
      }

      resetForm();
      loadRisks();
    } catch (error: any) {
      console.error('Risk kaydedilirken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const handleEdit = (risk: Risk) => {
    setFormData({
      risk_title: risk.risk_title,
      risk_description: risk.risk_description || '',
      risk_category: risk.risk_category,
      process_id: risk.process_id || '',
      kiks_standard_id: risk.kiks_standard_id || '',
      risk_owner_id: risk.risk_owner_id || '',
      inherent_likelihood: risk.inherent_likelihood || 3,
      inherent_impact: risk.inherent_impact || 3,
      residual_likelihood: risk.residual_likelihood || 2,
      residual_impact: risk.residual_impact || 2,
      status: risk.status
    });
    setEditingId(risk.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu riski silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_risks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadRisks();
    } catch (error) {
      console.error('Risk silinirken hata:', error);
      alert('Risk silinemedi. Bu risk başka kayıtlarda kullanılıyor olabilir.');
    }
  };

  const resetForm = () => {
    setFormData({
      risk_title: '',
      risk_description: '',
      risk_category: 'operational',
      process_id: '',
      kiks_standard_id: '',
      risk_owner_id: '',
      inherent_likelihood: 3,
      inherent_impact: 3,
      residual_likelihood: 2,
      residual_impact: 2,
      status: 'identified'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getRiskLevelColor = (score: number) => {
    if (score >= 20) return 'text-red-600';
    if (score >= 15) return 'text-red-500';
    if (score >= 10) return 'text-orange-500';
    if (score >= 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 20) return 'Kritik';
    if (score >= 15) return 'Yüksek';
    if (score >= 10) return 'Orta';
    if (score >= 5) return 'Düşük';
    return 'Çok Düşük';
  };

  const filteredRisks = risks.filter(r => {
    const matchesCategory = filterCategory === 'all' || r.risk_category === filterCategory;
    return matchesCategory;
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Risk Yönetimi</h1>
            <p className="text-sm text-gray-600">Risk Değerlendirme ve İzleme</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Liste
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'heatmap'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Isı Haritası
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Risk
            </button>
          )}
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Toplam Risk</div>
          <div className="text-2xl font-bold text-gray-900">{risks.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Kritik Risk</div>
          <div className="text-2xl font-bold text-red-600">
            {risks.filter(r => r.residual_score >= 20).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Yüksek Risk</div>
          <div className="text-2xl font-bold text-orange-600">
            {risks.filter(r => r.residual_score >= 15 && r.residual_score < 20).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Orta Risk</div>
          <div className="text-2xl font-bold text-yellow-600">
            {risks.filter(r => r.residual_score >= 10 && r.residual_score < 15).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Ort. Risk Azalma</div>
          <div className="text-2xl font-bold text-green-600">
            {risks.length > 0
              ? Math.round(
                  (risks.reduce((sum, r) => sum + (r.inherent_score - r.residual_score), 0) /
                    risks.length) *
                    10
                ) / 10
              : 0}
          </div>
        </div>
      </div>

      {/* Isı Haritası Görünümü */}
      {viewMode === 'heatmap' ? (
        <div className="space-y-6">
          <RiskHeatMap risks={filteredRisks} type="inherent" />
          <RiskHeatMap risks={filteredRisks} type="residual" />
        </div>
      ) : (
        <>
          {/* Filtreler */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Filtresi</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">Tüm Kategoriler</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                      {editingId ? 'Risk Düzenle' : 'Yeni Risk Ekle'}
                    </h2>
                    <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>Not:</strong> Risk kodu kayıt sırasında otomatik olarak oluşturulacaktır (Örn: RSK-2024-001)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                      <select
                        required
                        value={formData.risk_category}
                        onChange={(e) => setFormData({ ...formData, risk_category: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Risk Başlığı *</label>
                      <input
                        type="text"
                        required
                        value={formData.risk_title}
                        onChange={(e) => setFormData({ ...formData, risk_title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Risk Açıklaması</label>
                      <textarea
                        value={formData.risk_description}
                        onChange={(e) => setFormData({ ...formData, risk_description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">İlgili Süreç</label>
                      <select
                        value={formData.process_id}
                        onChange={(e) => setFormData({ ...formData, process_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Seçiniz</option>
                        {processes.map(process => (
                          <option key={process.id} value={process.id}>
                            {process.code} - {process.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Süreç seçerseniz, KİKS otomatik atanır</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">KİKS Standardı (İsteğe Bağlı)</label>
                      <select
                        value={formData.kiks_standard_id}
                        onChange={(e) => setFormData({ ...formData, kiks_standard_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Seçiniz</option>
                        {kiksStandards.map(kiks => (
                          <option key={kiks.id} value={kiks.id}>
                            {kiks.title}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Süreçten farklı bir KİKS seçebilirsiniz</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Risk Sahibi</label>
                        <select
                          value={formData.risk_owner_id}
                          onChange={(e) => setFormData({ ...formData, risk_owner_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Seçiniz</option>
                          {users.map(user => (
                            <option key={user.id} value={user.id}>{user.full_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Doğal Risk Değerlendirmesi</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Olasılık (1-5) *</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="5"
                            value={formData.inherent_likelihood}
                            onChange={(e) => setFormData({ ...formData, inherent_likelihood: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Etki (1-5) *</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="5"
                            value={formData.inherent_impact}
                            onChange={(e) => setFormData({ ...formData, inherent_impact: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Skor</label>
                          <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-bold">
                            {formData.inherent_likelihood * formData.inherent_impact}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Artık Risk Değerlendirmesi</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Olasılık (1-5) *</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="5"
                            value={formData.residual_likelihood}
                            onChange={(e) => setFormData({ ...formData, residual_likelihood: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Etki (1-5) *</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="5"
                            value={formData.residual_impact}
                            onChange={(e) => setFormData({ ...formData, residual_impact: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Skor</label>
                          <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-bold">
                            {formData.residual_likelihood * formData.residual_impact}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Save className="w-5 h-5" />
                        Kaydet
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Riskler Listesi */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Yükleniyor...</div>
            </div>
          ) : filteredRisks.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Henüz risk eklenmemiş.</p>
              {isAdmin && (
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  İlk Riski Ekle
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Süreç</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stratejik Plan</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Doğal Risk</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Artık Risk</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Azalma</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                    {isAdmin && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRisks.map((risk) => (
                    <tr key={risk.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{risk.risk_code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{risk.risk_title}</div>
                        {risk.risk_owner_name && (
                          <div className="text-xs text-gray-500">Sahip: {risk.risk_owner_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${CATEGORY_COLORS[risk.risk_category]}`}>
                          {CATEGORY_LABELS[risk.risk_category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{risk.process_name || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {risk.isLinkedToStrategicPlan ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <LinkIcon className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-medium text-blue-600">Bağlı</span>
                            </div>
                            {risk.collaborationPlans && risk.collaborationPlans.length > 0 && (
                              <div className="text-xs text-gray-500" title={risk.collaborationPlans.join(', ')}>
                                {risk.collaborationPlans.length} plan
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`font-bold ${getRiskLevelColor(risk.inherent_score)}`}>
                          {risk.inherent_score}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getRiskLevel(risk.inherent_score)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`font-bold ${getRiskLevelColor(risk.residual_score)}`}>
                          {risk.residual_score}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getRiskLevel(risk.residual_score)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {risk.inherent_score > risk.residual_score ? (
                            <TrendingDown className="w-4 h-4 text-green-600" />
                          ) : risk.inherent_score < risk.residual_score ? (
                            <TrendingUp className="w-4 h-4 text-red-600" />
                          ) : null}
                          <span className="font-medium">
                            {risk.inherent_score - risk.residual_score}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${STATUS_COLORS[risk.status]}`}>
                          {STATUS_LABELS[risk.status]}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(risk)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(risk.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
