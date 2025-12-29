import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Edit2, Trash2, AlertCircle, Save, X, FileText, TestTube } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface Finding {
  id: string;
  finding_code: string;
  finding_title: string;
  finding_description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  finding_source: 'control_test' | 'internal_audit' | 'external_audit' | 'self_assessment' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  identified_date: string;
  control_id?: string;
  control_code?: string;
  control_title?: string;
  control_test_id?: string;
  test_date?: string;
  identified_by_name?: string;
  root_cause_analysis?: string;
  capa_count?: number;
}

const SEVERITY_LABELS = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik'
};

const SEVERITY_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  open: 'Açık',
  in_progress: 'Devam Ediyor',
  resolved: 'Çözüldü',
  closed: 'Kapatıldı'
};

const STATUS_COLORS = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800'
};

const SOURCE_LABELS = {
  control_test: 'Kontrol Testi',
  internal_audit: 'İç Denetim',
  external_audit: 'Dış Denetim',
  self_assessment: 'Öz Değerlendirme',
  other: 'Diğer'
};

export default function FindingsManagement() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [controls, setControls] = useState<any[]>([]);
  const [controlTests, setControlTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [formData, setFormData] = useState({
    finding_title: '',
    finding_description: '',
    severity: 'medium' as const,
    finding_source: 'control_test' as const,
    status: 'open' as const,
    identified_date: new Date().toISOString().split('T')[0],
    control_id: '',
    control_test_id: '',
    root_cause_analysis: ''
  });

  useEffect(() => {
    if (selectedPlanId) {
      loadData();
    }
  }, [profile?.organization_id, selectedPlanId]);

  const loadData = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      setLoading(true);
      await Promise.all([
        loadFindings(),
        loadControls(),
        loadControlTests()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadFindings = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_findings')
        .select(`
          *,
          ic_controls(control_code, control_title),
          ic_control_tests(test_date),
          profiles!ic_findings_identified_by_fkey(full_name)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('identified_date', { ascending: false });

      if (error) throw error;

      const findingsWithCounts = await Promise.all(
        (data || []).map(async (finding) => {
          const { count } = await supabase
            .from('ic_capas')
            .select('*', { count: 'exact', head: true })
            .eq('finding_id', finding.id);

          return {
            ...finding,
            control_code: finding.ic_controls?.control_code,
            control_title: finding.ic_controls?.control_title,
            test_date: finding.ic_control_tests?.test_date,
            identified_by_name: finding.profiles?.full_name,
            capa_count: count || 0
          };
        })
      );

      setFindings(findingsWithCounts);
    } catch (error) {
      console.error('Bulgular yüklenirken hata:', error);
    }
  };

  const loadControls = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_controls')
        .select('id, control_code, control_title')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('control_code', { ascending: true });

      if (error) throw error;
      setControls(data || []);
    } catch (error) {
      console.error('Kontroller yüklenirken hata:', error);
    }
  };

  const loadControlTests = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_control_tests')
        .select('id, test_code, test_date, control_id')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .order('test_date', { ascending: false });

      if (error) throw error;
      setControlTests(data || []);
    } catch (error) {
      console.error('Testler yüklenirken hata:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const dataToSave = {
        ...formData,
        control_id: formData.control_id || null,
        control_test_id: formData.control_test_id || null,
        root_cause_analysis: formData.root_cause_analysis || null,
        identified_by: profile.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('ic_findings')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ic_findings')
          .insert({
            ...dataToSave,
            organization_id: profile.organization_id,
            ic_plan_id: selectedPlanId
          });

        if (error) throw error;
      }

      resetForm();
      loadFindings();
    } catch (error: any) {
      console.error('Bulgu kaydedilirken hata:', error);
      alert(error.message || 'Bir hata oluştu');
    }
  };

  const handleEdit = (finding: Finding) => {
    setFormData({
      finding_title: finding.finding_title,
      finding_description: finding.finding_description || '',
      severity: finding.severity,
      finding_source: finding.finding_source,
      status: finding.status,
      identified_date: finding.identified_date,
      control_id: finding.control_id || '',
      control_test_id: finding.control_test_id || '',
      root_cause_analysis: finding.root_cause_analysis || ''
    });
    setEditingId(finding.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu bulguyu silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_findings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadFindings();
    } catch (error) {
      console.error('Bulgu silinirken hata:', error);
      alert('Bulgu silinemedi. Bu bulguya bağlı CAPA kayıtları olabilir.');
    }
  };

  const resetForm = () => {
    setFormData({
      finding_title: '',
      finding_description: '',
      severity: 'medium',
      finding_source: 'control_test',
      status: 'open',
      identified_date: new Date().toISOString().split('T')[0],
      control_id: '',
      control_test_id: '',
      root_cause_analysis: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const filteredFindings = findings.filter(f => {
    const matchesSeverity = filterSeverity === 'all' || f.severity === filterSeverity;
    const matchesStatus = filterStatus === 'all' || f.status === filterStatus;
    return matchesSeverity && matchesStatus;
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
                Bulgular modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
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
          <AlertTriangle className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulgular Yönetimi</h1>
            <p className="text-sm text-gray-600">Kontrol Testlerinden ve Denetimlerden Tespit Edilen Bulgular</p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Yeni Bulgu
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Toplam Bulgu</div>
          <div className="text-2xl font-bold text-gray-900">{findings.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Açık</div>
          <div className="text-2xl font-bold text-red-600">
            {findings.filter(f => f.status === 'open').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Devam Ediyor</div>
          <div className="text-2xl font-bold text-yellow-600">
            {findings.filter(f => f.status === 'in_progress').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Kritik</div>
          <div className="text-2xl font-bold text-red-600">
            {findings.filter(f => f.severity === 'critical').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">CAPA Gerekli</div>
          <div className="text-2xl font-bold text-blue-600">
            {findings.filter(f => (f.capa_count || 0) === 0 && f.status !== 'closed').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Önem Derecesi Filtresi</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Dereceler</option>
              {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Durum Filtresi</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Tüm Durumlar</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Bulgu Düzenle' : 'Yeni Bulgu Ekle'}
                </h2>
                <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bulgu Başlığı *</label>
                  <input
                    type="text"
                    required
                    value={formData.finding_title}
                    onChange={(e) => setFormData({ ...formData, finding_title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bulgu Açıklaması</label>
                  <textarea
                    value={formData.finding_description}
                    onChange={(e) => setFormData({ ...formData, finding_description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Önem Derecesi *</label>
                    <select
                      required
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kaynak *</label>
                    <select
                      required
                      value={formData.finding_source}
                      onChange={(e) => setFormData({ ...formData, finding_source: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">İlgili Kontrol</label>
                    <select
                      value={formData.control_id}
                      onChange={(e) => setFormData({ ...formData, control_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {controls.map(control => (
                        <option key={control.id} value={control.id}>
                          {control.control_code} - {control.control_title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">İlgili Test</label>
                    <select
                      value={formData.control_test_id}
                      onChange={(e) => setFormData({ ...formData, control_test_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seçiniz</option>
                      {controlTests.map(test => (
                        <option key={test.id} value={test.id}>
                          {test.test_code} - {new Date(test.test_date).toLocaleDateString('tr-TR')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kök Neden Analizi</label>
                  <textarea
                    value={formData.root_cause_analysis}
                    onChange={(e) => setFormData({ ...formData, root_cause_analysis: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Bulgunun temel nedenlerini açıklayın..."
                  />
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
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
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

      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Yükleniyor...</div>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Henüz bulgu eklenmemiş.</p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
            >
              İlk Bulguyu Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bulgu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kaynak</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Önem</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kontrol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CAPA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                {isAdmin && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFindings.map((finding) => (
                <tr key={finding.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{finding.finding_code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 font-medium">{finding.finding_title}</div>
                    {finding.identified_by_name && (
                      <div className="text-xs text-gray-500">Tespit: {finding.identified_by_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {SOURCE_LABELS[finding.finding_source]}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${SEVERITY_COLORS[finding.severity]}`}>
                      {SEVERITY_LABELS[finding.severity]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[finding.status]}`}>
                      {STATUS_LABELS[finding.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {finding.control_code || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">{finding.capa_count || 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(finding.identified_date).toLocaleDateString('tr-TR')}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(finding)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(finding.id)}
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
