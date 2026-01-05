import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import {
  CheckCircle,
  Plus,
  Calendar,
  User,
  TrendingUp,
  AlertCircle,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';

interface ICStandard {
  id: string;
  code: string;
  name: string;
  component: {
    code: string;
    name: string;
    color: string;
  };
}

interface Assessment {
  id: string;
  standard_id: string;
  assessment_period: string;
  assessment_date: string;
  compliance_level: number;
  strengths: string | null;
  weaknesses: string | null;
  evidences: string | null;
  recommendations: string | null;
  status: string;
  assessed_by: string;
  standard?: ICStandard;
  assessor?: {
    full_name: string;
  };
}

const complianceLevels = [
  { value: 1, label: 'Uyumsuz', color: 'red' },
  { value: 2, label: 'Kısmen Uyumlu', color: 'orange' },
  { value: 3, label: 'Orta Düzey Uyumlu', color: 'yellow' },
  { value: 4, label: 'Büyük Ölçüde Uyumlu', color: 'lime' },
  { value: 5, label: 'Tam Uyumlu', color: 'green' },
];

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Onay Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

const statusColors: Record<string, string> = {
  draft: 'gray',
  submitted: 'yellow',
  approved: 'green',
  rejected: 'red',
};

export default function ICAssessments() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [standards, setStandards] = useState<ICStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState('');
  const [assessmentPeriod, setAssessmentPeriod] = useState('');
  const [complianceLevel, setComplianceLevel] = useState(3);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [evidences, setEvidences] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data: standardsData } = await supabase
        .from('ic_standards')
        .select(`
          id,
          code,
          name,
          component:ic_components!inner(code, name, color)
        `)
        .order('code');

      const { data: assessmentsData } = await supabase
        .from('ic_standard_assessments')
        .select(`
          *,
          standard:ic_standards!inner(
            id,
            code,
            name,
            component:ic_components!inner(code, name, color)
          ),
          assessor:profiles!assessed_by(full_name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('assessment_date', { ascending: false });

      if (standardsData) setStandards(standardsData as any);
      if (assessmentsData) setAssessments(assessmentsData as any);

      const currentYear = new Date().getFullYear();
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
      setAssessmentPeriod(`${currentYear}-Q${currentQuarter}`);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAssessment = async () => {
    if (!profile?.organization_id || !profile?.id || !selectedStandard) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ic_standard_assessments')
        .insert({
          organization_id: profile.organization_id,
          standard_id: selectedStandard,
          assessment_period: assessmentPeriod,
          assessment_date: new Date().toISOString().split('T')[0],
          assessed_by: profile.id,
          compliance_level: complianceLevel,
          strengths: strengths || null,
          weaknesses: weaknesses || null,
          evidences: evidences || null,
          recommendations: recommendations || null,
          status: 'draft'
        });

      if (error) throw error;

      setShowNewModal(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert('Değerlendirme oluşturulurken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssessment = async (id: string) => {
    if (!confirm('Bu değerlendirmeyi silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('ic_standard_assessments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      alert('Değerlendirme silinirken hata oluştu');
    }
  };

  const resetForm = () => {
    setSelectedStandard('');
    setComplianceLevel(3);
    setStrengths('');
    setWeaknesses('');
    setEvidences('');
    setRecommendations('');
  };

  const getComplianceColor = (level: number) => {
    const item = complianceLevels.find(l => l.value === level);
    return item?.color || 'gray';
  };

  const getComplianceLabel = (level: number) => {
    const item = complianceLevels.find(l => l.value === level);
    return item?.label || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-7 h-7 text-blue-600" />
            Standart Değerlendirmeleri
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            İç kontrol standartlarının dönemsel değerlendirmesi
          </p>
        </div>
        <Button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Yeni Değerlendirme
        </Button>
      </div>

      {assessments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Henüz değerlendirme yok
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            İç kontrol standartlarını değerlendirerek başlayın
          </p>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            İlk Değerlendirmeyi Oluştur
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded text-white"
                      style={{ backgroundColor: assessment.standard?.component.color }}
                    >
                      {assessment.standard?.code}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {assessment.standard?.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {assessment.standard?.component.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={assessment.status}
                    label={statusLabels[assessment.status]}
                    variant={statusColors[assessment.status] as any}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Dönem: {assessment.assessment_period}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Tarih: {new Date(assessment.assessment_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{assessment.assessor?.full_name}</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Uyum Seviyesi</span>
                  <span className={`text-sm font-semibold text-${getComplianceColor(assessment.compliance_level)}-600`}>
                    {getComplianceLabel(assessment.compliance_level)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-${getComplianceColor(assessment.compliance_level)}-500 h-2 rounded-full`}
                    style={{ width: `${assessment.compliance_level * 20}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/ic-assessments/${assessment.id}`)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Detaylar
                </Button>
                {assessment.status === 'draft' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/ic-assessments/${assessment.id}/edit`)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Düzenle
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteAssessment(assessment.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Sil
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <Modal
          isOpen={showNewModal}
          onClose={() => {
            setShowNewModal(false);
            resetForm();
          }}
          title="Yeni Değerlendirme"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standart
              </label>
              <select
                value={selectedStandard}
                onChange={(e) => setSelectedStandard(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Standart Seçin</option>
                {standards.map((standard) => (
                  <option key={standard.id} value={standard.id}>
                    {standard.code} - {standard.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Değerlendirme Dönemi
              </label>
              <input
                type="text"
                value={assessmentPeriod}
                onChange={(e) => setAssessmentPeriod(e.target.value)}
                placeholder="Örn: 2024-Q2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Uyum Seviyesi: {getComplianceLabel(complianceLevel)}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={complianceLevel}
                onChange={(e) => setComplianceLevel(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Uyumsuz</span>
                <span>Tam Uyumlu</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Güçlü Yönler
              </label>
              <textarea
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zayıf Yönler
              </label>
              <textarea
                value={weaknesses}
                onChange={(e) => setWeaknesses(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kanıtlar
              </label>
              <textarea
                value={evidences}
                onChange={(e) => setEvidences(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Öneriler
              </label>
              <textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewModal(false);
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button
                onClick={createAssessment}
                disabled={!selectedStandard || saving}
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
