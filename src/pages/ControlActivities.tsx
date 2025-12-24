import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Edit2, Trash2, AlertCircle, Save, X, Link as LinkIcon, Target, FileText, TestTube } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface Control {
  id: string;
  control_code: string;
  control_title: string;
  control_description: string;
  control_type: 'preventive' | 'detective' | 'corrective' | 'directive';
  control_nature: 'manual' | 'automated' | 'it_dependent';
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  risk_id: string;
  risk_code?: string;
  risk_title?: string;
  process_id: string;
  process_name?: string;
  control_owner_id: string;
  control_performer_id?: string;
  control_owner_name?: string;
  control_performer_name?: string;
  design_effectiveness: 'effective' | 'partially_effective' | 'ineffective' | 'not_assessed';
  operating_effectiveness: 'effective' | 'partially_effective' | 'ineffective' | 'not_assessed';
  status: 'active' | 'inactive' | 'under_review';
  evidence_required?: string;
  documentation_url?: string;
  activity_count?: number;
  test_count?: number;
  finding_count?: number;
}

const TYPE_LABELS = {
  preventive: 'Önleyici',
  detective: 'Tespit Edici',
  corrective: 'Düzeltici',
  directive: 'Yönlendirici'
};

const TYPE_COLORS = {
  preventive: 'bg-green-100 text-green-800',
  detective: 'bg-blue-100 text-blue-800',
  corrective: 'bg-orange-100 text-orange-800',
  directive: 'bg-purple-100 text-purple-800'
};

const NATURE_LABELS = {
  manual: 'Manuel',
  automated: 'Otomatik',
  it_dependent: 'BT Bağımlı'
};

const FREQUENCY_LABELS = {
  continuous: 'Sürekli',
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  quarterly: 'Çeyreklik',
  annual: 'Yıllık'
};

const EFFECTIVENESS_LABELS = {
  effective: 'Etkin',
  partially_effective: 'Kısmen Etkin',
  ineffective: 'Etkisiz',
  not_assessed: 'Değerlendirilmedi'
};

const EFFECTIVENESS_COLORS = {
  effective: 'bg-green-100 text-green-800',
  partially_effective: 'bg-yellow-100 text-yellow-800',
  ineffective: 'bg-red-100 text-red-800',
  not_assessed: 'bg-gray-100 text-gray-800'
};

export default function ControlActivities() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [controls, setControls] = useState<Control[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [kiksStandards, setKiksStandards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEffectiveness, setFilterEffectiveness] = useState<string>('all');

  const [formData, setFormData] = useState({
    control_title: '',
    control_description: '',
    control_type: 'preventive' as const,
    control_nature: 'manual' as const,
    frequency: 'monthly' as const,
    risk_id: '',
    process_id: '',
    control_owner_id: '',
    control_performer_id: '',
    design_effectiveness: 'not_assessed' as const,
    operating_effectiveness: 'not_assessed' as const,
    evidence_required: '',
    documentation_url: '',
    status: 'active' as const
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
        loadControls(),
        loadRisks(),
        loadProcesses(),
        loadUsers(),
        loadKiksStandards()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadControls = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_controls')
        .select(`
          *,
          ic_risks(risk_code, risk_title),
          ic_processes(name),
          owner:profiles!ic_controls_control_owner_id_fkey(full_name),
          performer:profiles!ic_controls_control_performer_id_fkey(full_name)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('control_code', { ascending: true });

      if (error) {
        console.error('Kontroller yüklenirken hata:', error);
        return;
      }

      console.log('Kontroller yüklendi:', data?.length, 'kayıt');

      const controlsWithCounts = await Promise.all(
        (data || []).map(async (control) => {
          const [activitiesResult, testsResult, findingsResult] = await Promise.all([
            supabase
              .from('ic_activity_control_mappings')
              .select('*', { count: 'exact', head: true })
              .eq('control_id', control.id),
            supabase
              .from('ic_control_tests')
              .select('*', { count: 'exact', head: true })
              .eq('control_id', control.id),
            supabase
              .from('ic_findings')
              .select('*', { count: 'exact', head: true })
              .eq('control_id', control.id)
          ]);

          return {
            ...control,
            risk_code: control.ic_risks?.risk_code,
            risk_title: control.ic_risks?.risk_title,
            process_name: control.ic_processes?.name,
            control_owner_name: control.owner?.full_name,
            control_performer_name: control.performer?.full_name,
            activity_count: activitiesResult.count || 0,
            test_count: testsResult.count || 0,
            finding_count: findingsResult.count || 0
          };
        })
      );

      setControls(controlsWithCounts);
    } catch (error) {
      console.error('Kontroller yüklenirken exception:', error);
    }
  };

  const loadRisks = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_risks')
        .select('id, risk_code, risk_title')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('risk_code', { ascending: true });

      if (error) throw error;
      setRisks(data || []);
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
        title: `${item.code} - ${item.ic_kiks_main_standards?.title || ''} - ${item.title}`
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
        risk_id: formData.risk_id || null,
        process_id: formData.process_id || null,
        control_owner_id: formData.control_owner_id || null,
        control_performer_id: formData.control_performer_id || null,
        evidence_required: formData.evidence_required || null,
        documentation_url: formData.documentation_url || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('ic_controls')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const maxCodeResult = await supabase
          .from('ic_controls')
          .select('control_code')
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', selectedPlanId)
          .order('control_code', { ascending: false })
          .limit(1);

        let nextNumber = 1;
        if (maxCodeResult.data && maxCodeResult.data.length > 0) {
          const lastCode = maxCodeResult.data[0].control_code;
          const match = lastCode.match(/CTRL-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        const controlCode = `CTRL-${String(nextNumber).padStart(3, '0')}`;

        const { error } = await supabase
          .from('ic_controls')
          .insert({
            ...dataToSave,
            control_code: controlCode,
            organization_id: profile.organization_id,
            ic_plan_id: selectedPlanId
          });

        if (error) throw error;
      }

      resetForm();
      loadControls();
    } catch (error: any) {
      console.error('Kontrol kaydedilirken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const handleEdit = (control: Control) => {
    setFormData({
      control_title: control.control_title,
      control_description: control.control_description || '',
      control_type: control.control_type,
      control_nature: control.control_nature,
      frequency: control.frequency,
      risk_id: control.risk_id || '',
      process_id: control.process_id || '',
      control_performer_id: control.control_performer_id || '',
      control_owner_id: control.control_owner_id || '',
      design_effectiveness: control.design_effectiveness,
      operating_effectiveness: control.operating_effectiveness,
      evidence_required: control.evidence_required || '',
      documentation_url: control.documentation_url || '',
      status: control.status
    });
    setEditingId(control.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kontrolü silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_controls')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadControls();
    } catch (error) {
      console.error('Kontrol silinirken hata:', error);
      alert('Kontrol silinemedi. Bu kontrol başka kayıtlarda kullanılıyor olabilir.');
    }
  };

  const resetForm = () => {
    setFormData({
      control_title: '',
      control_description: '',
      control_type: 'preventive',
      control_nature: 'manual',
      frequency: 'monthly',
      risk_id: '',
      process_id: '',
      control_performer_id: '',
      control_owner_id: '',
      design_effectiveness: 'not_assessed',
      operating_effectiveness: 'not_assessed',
      evidence_required: '',
      documentation_url: '',
      status: 'active'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const filteredControls = controls.filter(c => {
    const matchesType = filterType === 'all' || c.control_type === filterType;
    const matchesEffectiveness = filterEffectiveness === 'all' ||
      c.design_effectiveness === filterEffectiveness ||
      c.operating_effectiveness === filterEffectiveness;
    return matchesType && matchesEffectiveness;
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                Kontrol Aktiviteleri modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kontrol Faaliyetleri</h1>
            <p className="text-sm text-gray-600">Kontrol Envanteri ve Yönetimi</p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Kontrol
          </button>
        )}
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-8 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Toplam Kontrol</div>
          <div className="text-2xl font-bold text-gray-900">{controls.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Aktif Kontrol</div>
          <div className="text-2xl font-bold text-green-600">
            {controls.filter(c => c.status === 'active').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Tasarım Etkin</div>
          <div className="text-2xl font-bold text-blue-600">
            {controls.filter(c => c.design_effectiveness === 'effective').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">İşleyiş Etkin</div>
          <div className="text-2xl font-bold text-green-600">
            {controls.filter(c => c.operating_effectiveness === 'effective').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <Target className="w-4 h-4" />
            Bağlı Faaliyet
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {controls.reduce((sum, c) => sum + (c.activity_count || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <TestTube className="w-4 h-4" />
            Toplam Test
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {controls.reduce((sum, c) => sum + (c.test_count || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Toplam Bulgu
          </div>
          <div className="text-2xl font-bold text-red-600">
            {controls.reduce((sum, c) => sum + (c.finding_count || 0), 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Etkisiz</div>
          <div className="text-2xl font-bold text-red-600">
            {controls.filter(c => c.operating_effectiveness === 'ineffective').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Önleyici Kontrol</div>
          <div className="text-2xl font-bold text-green-600">
            {controls.filter(c => c.control_type === 'preventive').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Otomatik Kontrol</div>
          <div className="text-2xl font-bold text-purple-600">
            {controls.filter(c => c.control_nature === 'automated').length}
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tip Filtresi</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Tipler</option>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Etkinlik Filtresi</label>
            <select
              value={filterEffectiveness}
              onChange={(e) => setFilterEffectiveness(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Durumlar</option>
              {Object.entries(EFFECTIVENESS_LABELS).map(([key, label]) => (
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
                  {editingId ? 'Kontrol Düzenle' : 'Yeni Kontrol Ekle'}
                </h2>
                <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Not:</strong> Kontrol kodu otomatik olarak oluşturulacaktır (Örn: CTRL-001, CTRL-002)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Tipi *</label>
                  <select
                    required
                    value={formData.control_type}
                    onChange={(e) => setFormData({ ...formData, control_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Başlığı *</label>
                  <input
                    type="text"
                    required
                    value={formData.control_title}
                    onChange={(e) => setFormData({ ...formData, control_title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Açıklaması</label>
                  <textarea
                    value={formData.control_description}
                    onChange={(e) => setFormData({ ...formData, control_description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Niteliği *</label>
                    <select
                      required
                      value={formData.control_nature}
                      onChange={(e) => setFormData({ ...formData, control_nature: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(NATURE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Frekansı *</label>
                    <select
                      required
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">İlgili Risk</label>
                    <select
                      value={formData.risk_id}
                      onChange={(e) => setFormData({ ...formData, risk_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {risks.map(risk => (
                        <option key={risk.id} value={risk.id}>
                          {risk.risk_code} - {risk.risk_title}
                        </option>
                      ))}
                    </select>
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
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Sahibi</label>
                    <select
                      value={formData.control_owner_id}
                      onChange={(e) => setFormData({ ...formData, control_owner_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Uygulayıcı</label>
                    <select
                      value={formData.control_performer_id}
                      onChange={(e) => setFormData({ ...formData, control_performer_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tasarım Etkinliği</label>
                    <select
                      value={formData.design_effectiveness}
                      onChange={(e) => setFormData({ ...formData, design_effectiveness: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(EFFECTIVENESS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Çalışma Etkinliği</label>
                    <select
                      value={formData.operating_effectiveness}
                      onChange={(e) => setFormData({ ...formData, operating_effectiveness: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(EFFECTIVENESS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
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

      {/* Kontroller Listesi */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      ) : filteredControls.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Henüz kontrol eklenmemiş.</p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              İlk Kontrolü Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontrol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nitelik</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frekans</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Etkinlik</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entegrasyon</th>
                {isAdmin && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredControls.map((control) => (
                <tr key={control.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{control.control_code}</span>
                      {control.is_key_control && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Anahtar</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{control.control_title}</div>
                    {control.control_owner_name && (
                      <div className="text-xs text-gray-500">Sahip: {control.control_owner_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${TYPE_COLORS[control.control_type]}`}>
                      {TYPE_LABELS[control.control_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{NATURE_LABELS[control.control_nature]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{FREQUENCY_LABELS[control.frequency]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {control.risk_code ? (
                      <div className="flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" />
                        {control.risk_code}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${EFFECTIVENESS_COLORS[control.operating_effectiveness]}`}>
                      {EFFECTIVENESS_LABELS[control.operating_effectiveness]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {(control.activity_count || 0) > 0 && (
                        <span className="flex items-center gap-1 text-purple-600">
                          <Target className="w-3 h-3" />
                          {control.activity_count} Faaliyet
                        </span>
                      )}
                      {(control.test_count || 0) > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <TestTube className="w-3 h-3" />
                          {control.test_count} Test
                        </span>
                      )}
                      {(control.finding_count || 0) > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <FileText className="w-3 h-3" />
                          {control.finding_count} Bulgu
                        </span>
                      )}
                      {(!control.activity_count && !control.test_count && !control.finding_count) && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(control)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(control.id)}
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
    </div>
  );
}
