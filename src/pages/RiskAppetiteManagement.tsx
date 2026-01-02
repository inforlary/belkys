import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Edit2, Save, X, CheckCircle, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AppetiteSetting {
  id: string;
  organization_id: string;
  risk_category: 'strategic' | 'operational' | 'financial' | 'compliance' | 'reputational';
  max_acceptable_score: number;
  max_impact: number;
  max_likelihood: number;
  approved_by?: string;
  approver_name?: string;
  approval_date?: string;
  valid_from: string;
  valid_until?: string;
  status: 'draft' | 'approved' | 'expired' | 'cancelled';
  notes?: string;
  created_by?: string;
  created_at: string;
}

interface ViolationStats {
  risk_category: string;
  active_violations: number;
  total_risks: number;
  violation_rate: number;
}

interface RiskViolation {
  id: string;
  risk_id: string;
  risk_code: string;
  risk_title: string;
  risk_category: string;
  residual_score: number;
  appetite_limit: number;
  excess_amount: number;
  status: string;
  violation_date: string;
}

const CATEGORY_LABELS = {
  strategic: 'Stratejik',
  operational: 'Operasyonel',
  financial: 'Finansal',
  compliance: 'Uyumluluk',
  reputational: 'İtibar'
};

const CATEGORY_COLORS = {
  strategic: 'bg-purple-100 text-purple-800 border-purple-300',
  operational: 'bg-blue-100 text-blue-800 border-blue-300',
  financial: 'bg-green-100 text-green-800 border-green-300',
  compliance: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  reputational: 'bg-red-100 text-red-800 border-red-300'
};

export default function RiskAppetiteManagement() {
  const { profile } = useAuth();
  const [appetiteSettings, setAppetiteSettings] = useState<AppetiteSetting[]>([]);
  const [violationStats, setViolationStats] = useState<ViolationStats[]>([]);
  const [violations, setViolations] = useState<RiskViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'violations'>('settings');

  const [formData, setFormData] = useState({
    risk_category: 'operational' as const,
    max_acceptable_score: 12,
    max_impact: 4,
    max_likelihood: 3,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: ''
  });

  const canManageAppetite = profile?.role === 'admin' || profile?.role === 'vice_president';

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      const [appetiteRes, statsRes, violationsRes] = await Promise.all([
        supabase
          .from('risk_appetite_settings')
          .select(`
            *,
            approver:approved_by(full_name)
          `)
          .eq('organization_id', profile.organization_id)
          .order('risk_category', { ascending: true })
          .order('valid_from', { ascending: false }),

        supabase.rpc('count_appetite_violations', {
          p_organization_id: profile.organization_id
        }),

        supabase
          .from('risk_appetite_violations')
          .select(`
            *,
            ic_risks(risk_code, risk_title, risk_category)
          `)
          .eq('organization_id', profile.organization_id)
          .eq('status', 'active')
          .order('excess_amount', { ascending: false })
      ]);

      if (appetiteRes.error) throw appetiteRes.error;
      if (statsRes.error) throw statsRes.error;
      if (violationsRes.error) throw violationsRes.error;

      const settings = appetiteRes.data.map(s => ({
        ...s,
        approver_name: s.approver?.full_name
      }));

      const formattedViolations = violationsRes.data.map(v => ({
        ...v,
        risk_code: v.ic_risks.risk_code,
        risk_title: v.ic_risks.risk_title,
        risk_category: v.ic_risks.risk_category
      }));

      setAppetiteSettings(settings);
      setViolationStats(statsRes.data || []);
      setViolations(formattedViolations);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const payload = {
        organization_id: profile.organization_id,
        ...formData,
        valid_until: formData.valid_until || null,
        created_by: profile.id,
        status: 'draft'
      };

      if (editingId) {
        const { error } = await supabase
          .from('risk_appetite_settings')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('risk_appetite_settings')
          .insert([payload]);

        if (error) throw error;
      }

      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving appetite setting:', error);
      alert('Risk iştahı ayarı kaydedilemedi');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('risk_appetite_settings')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approval_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error approving setting:', error);
      alert('Onaylama işlemi başarısız');
    }
  };

  const handleEdit = (setting: AppetiteSetting) => {
    setFormData({
      risk_category: setting.risk_category,
      max_acceptable_score: setting.max_acceptable_score,
      max_impact: setting.max_impact,
      max_likelihood: setting.max_likelihood,
      valid_from: setting.valid_from,
      valid_until: setting.valid_until || '',
      notes: setting.notes || ''
    });
    setEditingId(setting.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      risk_category: 'operational',
      max_acceptable_score: 12,
      max_impact: 4,
      max_likelihood: 3,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      notes: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getRiskLevel = (score: number) => {
    if (score >= 15) return { label: 'Kritik', color: 'text-red-600' };
    if (score >= 10) return { label: 'Yüksek', color: 'text-orange-600' };
    if (score >= 6) return { label: 'Orta', color: 'text-yellow-600' };
    return { label: 'Düşük', color: 'text-green-600' };
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kurumsal Risk İştahı</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kurum için kabul edilebilir maksimum risk seviyelerini tanımlayın
          </p>
        </div>
        {canManageAppetite && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Risk İştahı</span>
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Risk İştahı Nedir?</p>
            <p>
              Risk iştahı, kurumunuzun stratejik hedeflerine ulaşmak için kabul etmeye hazır olduğu
              maksimum risk seviyesidir. Artık risk skorları bu limitleri aştığında sistem otomatik uyarı verir
              ve "kabul" seçeneği devre dışı bırakılır.
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            İştah Ayarları
          </button>
          <button
            onClick={() => setActiveTab('violations')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'violations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>İştah İhlalleri</span>
            {violations.length > 0 && (
              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">
                {violations.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-6">
          {violationStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {violationStats.map(stat => (
                <div key={stat.risk_category} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      {CATEGORY_LABELS[stat.risk_category as keyof typeof CATEGORY_LABELS]}
                    </span>
                    {stat.active_violations > 0 && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stat.active_violations}/{stat.total_risks}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    İhlal Oranı: %{stat.violation_rate || 0}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showForm && (
            <div className="bg-white border rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? 'Risk İştahı Düzenle' : 'Yeni Risk İştahı'}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Kategorisi
                    </label>
                    <select
                      value={formData.risk_category}
                      onChange={(e) => setFormData({ ...formData, risk_category: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    >
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maksimum Kabul Edilebilir Skor (1-25)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      value={formData.max_acceptable_score}
                      onChange={(e) => setFormData({ ...formData, max_acceptable_score: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Hesaplanan: Olasılık × Etki
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maksimum Etki (1-5)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={formData.max_impact}
                      onChange={(e) => setFormData({ ...formData, max_impact: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maksimum Olasılık (1-5)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={formData.max_likelihood}
                      onChange={(e) => setFormData({ ...formData, max_likelihood: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Geçerlilik Başlangıç
                    </label>
                    <input
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Geçerlilik Bitiş (Opsiyonel)
                    </label>
                    <input
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notlar
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="Risk iştahı ile ilgili açıklamalar..."
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    İptal
                  </button>
                  <button type="submit" className="btn btn-primary flex items-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>Kaydet</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Risk Kategorisi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Maks. Skor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Etki/Olasılık
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Geçerlilik
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Onaylayan
                  </th>
                  {canManageAppetite && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      İşlemler
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appetiteSettings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">Henüz risk iştahı tanımlanmamış</p>
                      <p className="text-sm mt-2">Yeni bir risk iştahı oluşturarak başlayın</p>
                    </td>
                  </tr>
                ) : (
                  appetiteSettings.map((setting) => (
                    <tr key={setting.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          CATEGORY_COLORS[setting.risk_category]
                        }`}>
                          {CATEGORY_LABELS[setting.risk_category]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-lg font-bold ${getRiskLevel(setting.max_acceptable_score).color}`}>
                          {setting.max_acceptable_score}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({getRiskLevel(setting.max_acceptable_score).label})
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {setting.max_impact} / {setting.max_likelihood}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(setting.valid_from).toLocaleDateString('tr-TR')}
                        {setting.valid_until && (
                          <> - {new Date(setting.valid_until).toLocaleDateString('tr-TR')}</>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          setting.status === 'approved' ? 'bg-green-100 text-green-800' :
                          setting.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {setting.status === 'approved' ? 'Onaylı' :
                           setting.status === 'draft' ? 'Taslak' :
                           setting.status === 'expired' ? 'Süresi Dolmuş' : 'İptal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {setting.approver_name ? (
                          <div>
                            <div>{setting.approver_name}</div>
                            <div className="text-xs text-gray-500">
                              {setting.approval_date && new Date(setting.approval_date).toLocaleDateString('tr-TR')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {canManageAppetite && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                          {setting.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleEdit(setting)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Düzenle"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleApprove(setting.id)}
                                className="text-green-600 hover:text-green-800"
                                title="Onayla"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'violations' && (
        <div className="space-y-6">
          {violations.length === 0 ? (
            <div className="bg-white border rounded-lg shadow-sm p-12 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium text-gray-900">Tüm Riskler İştah Limitlerinde</p>
              <p className="text-sm text-gray-500 mt-2">
                Şu anda risk iştahını aşan bir risk bulunmamaktadır
              </p>
            </div>
          ) : (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">
                    Risk İştahı İhlalleri ({violations.length})
                  </h3>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  Aşağıdaki riskler tanımlanan iştah limitlerini aşmaktadır
                </p>
              </div>

              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Risk Kodu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Risk Başlığı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Artık Skor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      İştah Limiti
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Aşım
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tarih
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {violations.map((violation) => (
                    <tr key={violation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {violation.risk_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {violation.risk_title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          CATEGORY_COLORS[violation.risk_category as keyof typeof CATEGORY_COLORS]
                        }`}>
                          {CATEGORY_LABELS[violation.risk_category as keyof typeof CATEGORY_LABELS]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-red-600">
                          {violation.residual_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {violation.appetite_limit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-4 h-4 text-red-500" />
                          <span className="font-semibold text-red-600">
                            +{violation.excess_amount}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(violation.violation_date).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
