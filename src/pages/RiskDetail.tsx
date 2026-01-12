import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { ArrowLeft, Info, BarChart3, Shield, Activity, TrendingUp, History, CreditCard as Edit2, Trash2, Plus, X, Save, AlertTriangle, MoreVertical, ChevronDown } from 'lucide-react';

interface Risk {
  id: string;
  code: string;
  name: string;
  description: string;
  causes: string;
  consequences: string;
  category_id: string;
  owner_department_id: string;
  objective_id: string;
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_score: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  risk_response: string;
  response_rationale: string;
  status: string;
  identified_date: string;
  identified_by_id: string;
  categories?: Array<{ category_id: string; category: { id: string; code: string; name: string; color: string } }>;
  department?: { name: string };
  objective?: { code: string; title: string };
  identified_by?: { full_name: string };
}

interface RiskControl {
  id: string;
  name: string;
  description: string;
  control_type: string;
  control_nature: string;
  design_effectiveness: number;
  operating_effectiveness: number;
  responsible_department_id: string;
  responsible_department?: { name: string };
}

interface RiskTreatment {
  id: string;
  code: string;
  title: string;
  description: string;
  treatment_type: string;
  responsible_department_id: string;
  responsible_person_id: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  progress_percent: number;
  status: string;
  responsible_department?: { name: string };
  responsible_person?: { full_name: string };
}

interface RiskIndicator {
  id: string;
  code: string;
  name: string;
  description: string;
  indicator_type: string;
  unit_of_measure: string;
  measurement_frequency: string;
  green_threshold: string;
  yellow_threshold: string;
  red_threshold: string;
  direction: string;
  target_value: number;
}

function getRiskScoreBadge(score: number) {
  if (score >= 20) return { color: 'bg-gray-800 text-white', emoji: '⬛', label: 'Kritik' };
  if (score >= 15) return { color: 'bg-red-500 text-white', emoji: '🔴', label: 'Çok Yüksek' };
  if (score >= 10) return { color: 'bg-orange-500 text-white', emoji: '🟠', label: 'Yüksek' };
  if (score >= 5) return { color: 'bg-yellow-500 text-black', emoji: '🟡', label: 'Orta' };
  return { color: 'bg-green-500 text-white', emoji: '🟢', label: 'Düşük' };
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'bg-gray-200 text-gray-800', label: 'Taslak' },
    ACTIVE: { color: 'bg-blue-500 text-white', label: 'Aktif' },
    IDENTIFIED: { color: 'bg-yellow-500 text-white', label: 'Tespit Edildi' },
    ASSESSING: { color: 'bg-orange-500 text-white', label: 'Değerlendiriliyor' },
    TREATING: { color: 'bg-blue-600 text-white', label: 'Tedavi Ediliyor' },
    MONITORING: { color: 'bg-purple-500 text-white', label: 'İzlemede' },
    CLOSED: { color: 'bg-gray-500 text-white', label: 'Kapatıldı' }
  };
  return statusMap[status] || { color: 'bg-gray-200 text-gray-800', label: status };
}

function getTreatmentStatusBadge(status: string) {
  const statusMap: Record<string, { color: string; emoji: string; label: string }> = {
    PLANNED: { color: 'bg-gray-200 text-gray-800', emoji: '⚪', label: 'Başlamadı' },
    IN_PROGRESS: { color: 'bg-yellow-500 text-white', emoji: '🟡', label: 'Devam Ediyor' },
    COMPLETED: { color: 'bg-green-500 text-white', emoji: '🟢', label: 'Tamamlandı' },
    DELAYED: { color: 'bg-red-500 text-white', emoji: '🔴', label: 'Gecikmiş' },
    CANCELLED: { color: 'bg-gray-500 text-white', emoji: '⚫', label: 'İptal' }
  };
  return statusMap[status] || statusMap['PLANNED'];
}

export default function RiskDetail() {
  const { profile } = useAuth();
  const { navigate, currentPath } = useLocation();
  const riskId = currentPath.split('/').pop() || '';

  const [activeTab, setActiveTab] = useState('general');
  const [risk, setRisk] = useState<Risk | null>(null);
  const [controls, setControls] = useState<RiskControl[]>([]);
  const [treatments, setTreatments] = useState<RiskTreatment[]>([]);
  const [indicators, setIndicators] = useState<RiskIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [riskCategories, setRiskCategories] = useState<string[]>([]);

  const [showControlModal, setShowControlModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<RiskIndicator | null>(null);
  const [deletingIndicator, setDeletingIndicator] = useState<RiskIndicator | null>(null);
  const [editingControl, setEditingControl] = useState<RiskControl | null>(null);
  const [deletingControl, setDeletingControl] = useState<RiskControl | null>(null);
  const [controlDropdown, setControlDropdown] = useState<string | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    if (riskId && profile?.organization_id) {
      loadData();
    }
  }, [riskId, profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      const [riskRes, controlsRes, treatmentsRes, indicatorsRes, deptsRes, profilesRes, categoriesRes, riskCategoriesRes, goalsRes] = await Promise.all([
        supabase
          .from('risks')
          .select(`
            *,
            categories:risk_category_mappings(category_id, category:risk_categories(id, code, name, color)),
            department:departments!owner_department_id(name),
            objective:objectives(code, title),
            identified_by:profiles!identified_by_id(full_name)
          `)
          .eq('id', riskId)
          .single(),
        supabase
          .from('risk_controls')
          .select(`
            *,
            responsible_department:departments(name)
          `)
          .eq('risk_id', riskId),
        supabase
          .from('risk_treatments')
          .select(`
            *,
            responsible_department:departments(name),
            responsible_person:profiles(full_name)
          `)
          .eq('risk_id', riskId),
        supabase
          .from('risk_indicators')
          .select('*')
          .eq('risk_id', riskId),
        supabase
          .from('departments')
          .select('*')
          .eq('organization_id', profile?.organization_id)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', profile?.organization_id)
          .order('full_name'),
        supabase
          .from('risk_categories')
          .select('id, code, name, type, color')
          .or(`organization_id.is.null,organization_id.eq.${profile?.organization_id}`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('risk_category_mappings')
          .select('category_id')
          .eq('risk_id', riskId),
        supabase
          .from('goals')
          .select('id, code, title')
          .eq('organization_id', profile?.organization_id)
          .order('code')
      ]);

      if (riskRes.error) throw riskRes.error;

      setRisk(riskRes.data);
      setControls(controlsRes.data || []);
      setTreatments(treatmentsRes.data || []);
      setIndicators(indicatorsRes.data || []);
      setDepartments(deptsRes.data || []);
      setProfiles(profilesRes.data || []);
      setCategories(categoriesRes.data || []);
      setRiskCategories((riskCategoriesRes.data || []).map((m: any) => m.category_id));
      setGoals(goalsRes.data || []);
    } catch (error) {
      console.error('Error loading risk:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase.from('risks').delete().eq('id', riskId);
      if (error) throw error;
      navigate('risk-management/risks');
    } catch (error) {
      console.error('Error deleting risk:', error);
      alert('Risk silinirken hata oluştu.');
    }
  }

  async function handleSaveEdit() {
    if (!editFormData) return;

    if (!editFormData.name || editFormData.category_ids.length === 0 || !editFormData.owner_department_id) {
      alert('Lütfen zorunlu alanları doldurun! (Risk Adı, Kategori, Sorumlu Birim)');
      return;
    }

    try {
      const inherentScore = editFormData.inherent_likelihood * editFormData.inherent_impact;
      const residualScore = editFormData.residual_likelihood * editFormData.residual_impact;

      const getRiskLevel = (score: number) => {
        if (score >= 20) return 'CRITICAL';
        if (score >= 15) return 'HIGH';
        if (score >= 9) return 'MEDIUM';
        return 'LOW';
      };

      const { error: updateError } = await supabase
        .from('risks')
        .update({
          name: editFormData.name,
          description: editFormData.description,
          causes: editFormData.causes,
          consequences: editFormData.consequences,
          owner_department_id: editFormData.owner_department_id,
          goal_id: editFormData.goal_id || null,
          inherent_likelihood: editFormData.inherent_likelihood,
          inherent_impact: editFormData.inherent_impact,
          inherent_score: inherentScore,
          residual_likelihood: editFormData.residual_likelihood,
          residual_impact: editFormData.residual_impact,
          residual_score: residualScore,
          risk_level: getRiskLevel(residualScore),
          risk_response: editFormData.risk_response,
          response_rationale: editFormData.response_rationale,
          status: editFormData.status
        })
        .eq('id', riskId);

      if (updateError) throw updateError;

      await supabase
        .from('risk_category_mappings')
        .delete()
        .eq('risk_id', riskId);

      const categoryMappings = editFormData.category_ids.map((categoryId: string) => ({
        risk_id: riskId,
        category_id: categoryId
      }));

      const { error: mappingError } = await supabase
        .from('risk_category_mappings')
        .insert(categoryMappings);

      if (mappingError) throw mappingError;

      alert('Risk başarıyla güncellendi!');
      setShowEditModal(false);
      setEditFormData(null);
      loadData();
    } catch (error) {
      console.error('Risk güncellenirken hata:', error);
      alert('Risk güncellenirken hata oluştu.');
    }
  }

  const tabs = [
    { id: 'general', label: 'Genel Bilgiler', icon: Info },
    { id: 'assessment', label: 'Değerlendirme', icon: BarChart3 },
    { id: 'controls', label: 'Kontroller', icon: Shield },
    { id: 'treatments', label: 'Faaliyetler', icon: Activity },
    { id: 'indicators', label: 'Göstergeler', icon: TrendingUp },
    { id: 'history', label: 'Tarihçe', icon: History }
  ];

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'director';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-16 h-16 text-gray-400" />
        <div className="text-gray-500 text-lg">Risk bulunamadı</div>
        <button
          onClick={() => navigate('risk-management/risks')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Risk Listesine Dön
        </button>
      </div>
    );
  }

  const inherentBadge = getRiskScoreBadge(risk.inherent_score);
  const residualBadge = getRiskScoreBadge(risk.residual_score);
  const statusBadge = getStatusBadge(risk.status);

  const activeControls = controls.filter(c => c.operating_effectiveness >= 3).length;
  const activeTreatments = treatments.filter(t => t.status === 'IN_PROGRESS' || t.status === 'DELAYED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('risk-management/risks')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-sm text-gray-500 mb-1">
              Risk Yönetimi {'>'} Riskler {'>'} {risk.code}
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {risk.code} - {risk.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditFormData({
                  name: risk.name,
                  description: risk.description || '',
                  causes: risk.causes || '',
                  consequences: risk.consequences || '',
                  owner_department_id: risk.owner_department_id,
                  goal_id: risk.objective_id || '',
                  inherent_likelihood: risk.inherent_likelihood,
                  inherent_impact: risk.inherent_impact,
                  residual_likelihood: risk.residual_likelihood,
                  residual_impact: risk.residual_impact,
                  risk_response: risk.risk_response,
                  response_rationale: risk.response_rationale || '',
                  status: risk.status,
                  category_ids: [...riskCategories]
                });
                setShowEditModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Edit2 className="w-4 h-4" />
              Düzenle
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              Sil
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">DOĞAL RİSK</div>
          <div className={`text-4xl font-bold ${inherentBadge.color} inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto`}>
            <span>{inherentBadge.emoji}</span>
            <span className="ml-1 text-2xl">{risk.inherent_score}</span>
          </div>
          <div className="text-sm text-gray-700 mt-2 font-medium">{inherentBadge.label}</div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">ARTIK RİSK</div>
          <div className={`text-4xl font-bold ${residualBadge.color} inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto`}>
            <span>{residualBadge.emoji}</span>
            <span className="ml-1 text-2xl">{risk.residual_score}</span>
          </div>
          <div className="text-sm text-gray-700 mt-2 font-medium">{residualBadge.label}</div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">KONTROL SAYISI</div>
          <div className="text-4xl font-bold text-blue-600 my-4">{activeControls}</div>
          <div className="text-sm text-gray-700">mevcut</div>
        </Card>

        <Card className="p-6 text-center">
          <div className="text-sm text-gray-600 mb-2">AÇIK FAALİYET</div>
          <div className="text-4xl font-bold text-orange-600 my-4">{activeTreatments}</div>
          <div className="text-sm text-gray-700">devam ediyor</div>
        </Card>
      </div>

      <Card>
        <div className="border-b border-gray-200">
          <div className="flex gap-2 px-6 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Risk Kodu</div>
                    <div className="text-base font-medium text-gray-900">{risk.code}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Risk Adı</div>
                    <div className="text-base font-medium text-gray-900">{risk.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Kategori</div>
                    <div className="text-base font-medium text-gray-900">
                      {risk.categories && risk.categories.length > 0
                        ? risk.categories.map((c: any) => c.category?.name).filter(Boolean).join(', ')
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Sorumlu Birim</div>
                    <div className="text-base font-medium text-gray-900">{risk.department?.name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Tanımlama Tarihi</div>
                    <div className="text-base font-medium text-gray-900">
                      {risk.identified_date ? new Date(risk.identified_date).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Tanımlayan</div>
                    <div className="text-base font-medium text-gray-900">{risk.identified_by?.full_name || '-'}</div>
                  </div>
                </div>
              </div>

              {risk.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Risk Açıklaması</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{risk.description}</p>
                </div>
              )}

              {risk.causes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Risk Kaynağı</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{risk.causes}</p>
                </div>
              )}

              {risk.consequences && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Olası Sonuçlar</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{risk.consequences}</p>
                </div>
              )}

              {risk.objective && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">İlişkili Stratejik Hedef</h4>
                  <div className="text-gray-700">
                    {risk.objective.code} - {risk.objective.title}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assessment' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Risk Değerlendirmesi</h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Doğal Risk (Kontrol öncesi)</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Olasılık:</span>
                      <span className="ml-2 font-medium">{risk.inherent_likelihood} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.inherent_likelihood]}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Etki:</span>
                      <span className="ml-2 font-medium">{risk.inherent_impact} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.inherent_impact]}</span>
                    </div>
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-sm text-gray-600">Skor:</span>
                      <span className={`ml-2 text-xl font-bold inline-flex items-center gap-1 ${inherentBadge.color} px-3 py-1 rounded`}>
                        <span>{inherentBadge.emoji}</span>
                        <span>{risk.inherent_score}</span>
                        <span className="text-sm">({inherentBadge.label})</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs text-gray-600 mb-2 text-center">ETKİ →</div>
                    <div className="grid grid-cols-6 gap-1">
                      <div className="text-xs text-gray-600 flex items-center justify-center">↓ O</div>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="text-xs text-center text-gray-600">{i}</div>
                      ))}
                      {[5, 4, 3, 2, 1].map(likelihood => (
                        <>
                          <div key={`l${likelihood}`} className="text-xs flex items-center justify-center text-gray-600">{likelihood}</div>
                          {[1, 2, 3, 4, 5].map(impact => {
                            const isSelected = likelihood === risk.inherent_likelihood && impact === risk.inherent_impact;
                            const score = likelihood * impact;
                            const badge = getRiskScoreBadge(score);
                            return (
                              <div
                                key={`${likelihood}-${impact}`}
                                className={`aspect-square rounded ${isSelected ? 'ring-2 ring-blue-600' : ''} ${badge.color} flex items-center justify-center text-xs font-bold`}
                              >
                                {isSelected && '●'}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Artık Risk (Kontrol sonrası)</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Olasılık:</span>
                      <span className="ml-2 font-medium">{risk.residual_likelihood} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.residual_likelihood]}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Etki:</span>
                      <span className="ml-2 font-medium">{risk.residual_impact} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][risk.residual_impact]}</span>
                    </div>
                    <div className="pt-3 border-t border-green-200">
                      <span className="text-sm text-gray-600">Skor:</span>
                      <span className={`ml-2 text-xl font-bold inline-flex items-center gap-1 ${residualBadge.color} px-3 py-1 rounded`}>
                        <span>{residualBadge.emoji}</span>
                        <span>{risk.residual_score}</span>
                        <span className="text-sm">({residualBadge.label})</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs text-gray-600 mb-2 text-center">ETKİ →</div>
                    <div className="grid grid-cols-6 gap-1">
                      <div className="text-xs text-gray-600 flex items-center justify-center">↓ O</div>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="text-xs text-center text-gray-600">{i}</div>
                      ))}
                      {[5, 4, 3, 2, 1].map(likelihood => (
                        <>
                          <div key={`l${likelihood}`} className="text-xs flex items-center justify-center text-gray-600">{likelihood}</div>
                          {[1, 2, 3, 4, 5].map(impact => {
                            const isSelected = likelihood === risk.residual_likelihood && impact === risk.residual_impact;
                            const score = likelihood * impact;
                            const badge = getRiskScoreBadge(score);
                            return (
                              <div
                                key={`${likelihood}-${impact}`}
                                className={`aspect-square rounded ${isSelected ? 'ring-2 ring-green-600' : ''} ${badge.color} flex items-center justify-center text-xs font-bold`}
                              >
                                {isSelected && '●'}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Risk Yanıtı</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Strateji:</span>
                    <span className="ml-2 font-medium">
                      {risk.risk_response === 'ACCEPT' && '✓ KABUL ET'}
                      {risk.risk_response === 'MITIGATE' && '🔽 AZALT'}
                      {risk.risk_response === 'TRANSFER' && '↗️ TRANSFER ET'}
                      {risk.risk_response === 'AVOID' && '🚫 KAÇIN'}
                    </span>
                  </div>
                  {risk.response_rationale && (
                    <div>
                      <span className="text-sm text-gray-600">Açıklama:</span>
                      <p className="text-gray-700 mt-1 whitespace-pre-wrap">{risk.response_rationale}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Mevcut Kontroller</h3>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingControl(null);
                      setShowControlModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Ekle
                  </button>
                )}
              </div>

              {controls.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Henüz kontrol eklenmemiş</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {controls.map(control => (
                    <div key={control.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{control.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{control.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-600">
                              Tür: <span className="font-medium">
                                {control.control_type === 'PREVENTIVE' && 'Önleyici'}
                                {control.control_type === 'DETECTIVE' && 'Tespit Edici'}
                                {control.control_type === 'CORRECTIVE' && 'Düzeltici'}
                              </span>
                            </span>
                            <span className="text-gray-600">
                              Etkinlik: <span className={`font-medium ${control.operating_effectiveness >= 4 ? 'text-green-600' : control.operating_effectiveness >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {control.operating_effectiveness >= 4 ? 'Etkin ✓' : control.operating_effectiveness >= 3 ? 'Kısmen Etkin ⚠️' : 'Etkin Değil ✗'}
                              </span>
                            </span>
                            {control.responsible_department && (
                              <span className="text-gray-600">
                                Sorumlu: <span className="font-medium">{control.responsible_department.name}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="relative">
                            <button
                              onClick={() => setControlDropdown(controlDropdown === control.id ? null : control.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                            {controlDropdown === control.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                <button
                                  onClick={() => {
                                    setEditingControl(control);
                                    setShowControlModal(true);
                                    setControlDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Düzenle
                                </button>
                                <button
                                  onClick={() => {
                                    setDeletingControl(control);
                                    setControlDropdown(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Sil
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'treatments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Risk Faaliyetleri</h3>
                {isAdmin && (
                  <button
                    onClick={() => setShowTreatmentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Ekle
                  </button>
                )}
              </div>

              {treatments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Henüz faaliyet eklenmemiş</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {treatments.map(treatment => {
                    const statusBadge = getTreatmentStatusBadge(treatment.status);
                    const isDelayed = treatment.status === 'DELAYED';
                    return (
                      <div key={treatment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{treatment.code} {treatment.title}</h4>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge.color}`}>
                                {statusBadge.emoji} {statusBadge.label}
                              </span>
                            </div>
                            {treatment.description && (
                              <p className="text-sm text-gray-600 mt-1">{treatment.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="text-gray-600">
                                Sorumlu: <span className="font-medium">{treatment.responsible_department?.name || '-'}</span>
                              </span>
                              <span className="text-gray-600">
                                Hedef: <span className="font-medium">
                                  {treatment.planned_end_date ? new Date(treatment.planned_end_date).toLocaleDateString('tr-TR') : '-'}
                                </span>
                              </span>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600">İlerleme</span>
                                <span className="font-medium">{treatment.progress_percent}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${isDelayed ? 'bg-red-500' : treatment.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`}
                                  style={{ width: `${treatment.progress_percent}%` }}
                                />
                              </div>
                            </div>
                            {isDelayed && (
                              <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                Gecikme var
                              </div>
                            )}
                          </div>
                          {isAdmin && (
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'indicators' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Risk Göstergeleri (KRI)</h3>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingIndicator(null);
                      setShowIndicatorModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Ekle
                  </button>
                )}
              </div>

              {indicators.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Henüz gösterge eklenmemiş</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {indicators.map(indicator => (
                    <div key={indicator.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{indicator.code} {indicator.name}</h4>
                          {indicator.description && (
                            <p className="text-sm text-gray-600 mt-1">{indicator.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-600">
                              Birim: <span className="font-medium">{indicator.unit_of_measure}</span>
                            </span>
                            <span className="text-gray-600">
                              Sıklık: <span className="font-medium">{indicator.measurement_frequency}</span>
                            </span>
                            <span className="text-gray-600">
                              Yön: <span className="font-medium">
                                {indicator.direction === 'LOWER_BETTER' ? '↓ Düşük iyi' : indicator.direction === 'HIGHER_BETTER' ? '↑ Yüksek iyi' : '🎯 Hedef'}
                              </span>
                            </span>
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-gray-600">Eşikler:</span>
                            <span className="ml-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white rounded text-xs">
                                🟢 {indicator.green_threshold}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500 text-white rounded text-xs ml-1">
                                🟡 {indicator.yellow_threshold}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white rounded text-xs ml-1">
                                🔴 {indicator.red_threshold}
                              </span>
                            </span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingIndicator(indicator);
                                setShowIndicatorModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingIndicator(indicator)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Değişiklik Geçmişi</h3>
              <div className="text-center py-12 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Değişiklik geçmişi yakında eklenecek</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Risk Sil</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Bu riski silmek istediğinize emin misiniz?
                </p>
                <p className="text-sm text-red-600">
                  Bu işlem geri alınamaz. İlişkili kontroller, faaliyetler ve göstergeler de silinecektir.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <ControlModal
        isOpen={showControlModal}
        onClose={() => {
          setShowControlModal(false);
          setEditingControl(null);
        }}
        riskId={riskId}
        departments={departments}
        onSuccess={loadData}
        editingControl={editingControl}
      />

      {deletingControl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kontrolü Sil</h3>
            <p className="text-gray-600 mb-6">
              "{deletingControl.name}" kontrolünü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingControl(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('risk_controls')
                      .delete()
                      .eq('id', deletingControl.id);

                    if (error) throw error;

                    alert('Kontrol başarıyla silindi!');
                    setDeletingControl(null);
                    loadData();
                  } catch (error) {
                    console.error('Error deleting control:', error);
                    alert('Kontrol silinirken hata oluştu.');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <TreatmentModal
        isOpen={showTreatmentModal}
        onClose={() => setShowTreatmentModal(false)}
        riskId={riskId}
        departments={departments}
        profiles={profiles}
        onSuccess={loadData}
      />

      <IndicatorModal
        isOpen={showIndicatorModal}
        onClose={() => {
          setShowIndicatorModal(false);
          setEditingIndicator(null);
        }}
        riskId={riskId}
        indicator={editingIndicator}
        onSuccess={loadData}
      />

      {deletingIndicator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Gösterge Sil</h3>
                <p className="text-sm text-gray-600 mb-4">
                  "{deletingIndicator.name}" göstergesini silmek istediğinize emin misiniz?
                </p>
                <p className="text-sm text-red-600">
                  Bu işlem geri alınamaz.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingIndicator(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('risk_indicators')
                      .delete()
                      .eq('id', deletingIndicator.id);

                    if (error) throw error;

                    alert('Gösterge başarıyla silindi!');
                    setDeletingIndicator(null);
                    loadData();
                  } catch (error) {
                    console.error('Error deleting indicator:', error);
                    alert('Gösterge silinirken hata oluştu.');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                  Risk Düzenle
                </h2>
                <p className="text-sm text-gray-600 mt-1">Tüm alanları dikkatlice doldurun</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Temel Bilgiler</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Risk Kategorileri <span className="text-red-500">*</span> (Birden fazla seçilebilir)
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {categories.map(cat => (
                      <label key={cat.id} className="flex items-center space-x-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editFormData.category_ids.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditFormData({ ...editFormData, category_ids: [...editFormData.category_ids, cat.id] });
                            } else {
                              setEditFormData({ ...editFormData, category_ids: editFormData.category_ids.filter((id: string) => id !== cat.id) });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Risk adını giriniz"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Açıklaması
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Riskin detaylı açıklaması..."
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Kaynağı
                  </label>
                  <textarea
                    value={editFormData.causes}
                    onChange={(e) => setEditFormData({ ...editFormData, causes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Riskin ortaya çıkma nedeni..."
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Olası Sonuçlar
                  </label>
                  <textarea
                    value={editFormData.consequences}
                    onChange={(e) => setEditFormData({ ...editFormData, consequences: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Riskin olası sonuçları..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sorumlu Birim <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editFormData.owner_department_id}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        owner_department_id: e.target.value,
                        goal_id: ''
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seçiniz...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      İlişkili Hedef (Opsiyonel)
                    </label>
                    <select
                      value={editFormData.goal_id}
                      onChange={(e) => setEditFormData({ ...editFormData, goal_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!editFormData.owner_department_id}
                    >
                      <option value="">
                        {editFormData.owner_department_id ? 'Seçiniz...' : 'Önce sorumlu birim seçiniz'}
                      </option>
                      {goals
                        .filter(goal => goal.department_id === editFormData.owner_department_id)
                        .map(goal => (
                          <option key={goal.id} value={goal.id}>{goal.code} - {goal.title}</option>
                        ))}
                    </select>
                    {editFormData.owner_department_id && goals.filter(g => g.department_id === editFormData.owner_department_id).length === 0 && (
                      <p className="mt-1 text-sm text-amber-600">Bu birime ait hedef bulunamadı</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Doğal Risk Değerlendirmesi</h3>
                <p className="text-sm text-gray-600 mb-4">Herhangi bir kontrol olmadan riskin değerlendirilmesi</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Olasılık <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="edit_inherent_likelihood"
                            value={level}
                            checked={editFormData.inherent_likelihood === level}
                            onChange={(e) => setEditFormData({ ...editFormData, inherent_likelihood: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Etki <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                          <input
                            type="radio"
                            name="edit_inherent_impact"
                            value={level}
                            checked={editFormData.inherent_impact === level}
                            onChange={(e) => setEditFormData({ ...editFormData, inherent_impact: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-300">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">DOĞAL RİSK SKORU:</span>
                    <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(editFormData.inherent_likelihood * editFormData.inherent_impact).color} px-4 py-2 rounded-lg`}>
                      <span>{getRiskScoreBadge(editFormData.inherent_likelihood * editFormData.inherent_impact).emoji}</span>
                      <span>{editFormData.inherent_likelihood * editFormData.inherent_impact}</span>
                      <span className="text-sm">({getRiskScoreBadge(editFormData.inherent_likelihood * editFormData.inherent_impact).label})</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Artık Risk Değerlendirmesi</h3>
                <p className="text-sm text-gray-600 mb-4">Mevcut kontroller uygulandıktan sonra kalan risk</p>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Olasılık <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                          <input
                            type="radio"
                            name="edit_residual_likelihood"
                            value={level}
                            checked={editFormData.residual_likelihood === level}
                            onChange={(e) => setEditFormData({ ...editFormData, residual_likelihood: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Etki <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <label key={level} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-green-100">
                          <input
                            type="radio"
                            name="edit_residual_impact"
                            value={level}
                            checked={editFormData.residual_impact === level}
                            onChange={(e) => setEditFormData({ ...editFormData, residual_impact: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{level} - {['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level]}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-300">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">ARTIK RİSK SKORU:</span>
                    <span className={`text-2xl font-bold flex items-center gap-2 ${getRiskScoreBadge(editFormData.residual_likelihood * editFormData.residual_impact).color} px-4 py-2 rounded-lg`}>
                      <span>{getRiskScoreBadge(editFormData.residual_likelihood * editFormData.residual_impact).emoji}</span>
                      <span>{editFormData.residual_likelihood * editFormData.residual_impact}</span>
                      <span className="text-sm">({getRiskScoreBadge(editFormData.residual_likelihood * editFormData.residual_impact).label})</span>
                    </span>
                  </div>
                  {(editFormData.residual_likelihood * editFormData.residual_impact) > (editFormData.inherent_likelihood * editFormData.inherent_impact) && (
                    <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Uyarı: Artık risk skoru, doğal risk skorundan büyük olamaz!
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">4. Risk Yanıtı</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Risk Yanıt Stratejisi <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="edit_risk_response"
                        value="ACCEPT"
                        checked={editFormData.risk_response === 'ACCEPT'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">KABUL ET</div>
                        <div className="text-sm text-gray-600">Risk mevcut haliyle kabul edilir</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="edit_risk_response"
                        value="MITIGATE"
                        checked={editFormData.risk_response === 'MITIGATE'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">AZALT</div>
                        <div className="text-sm text-gray-600">Risk azaltıcı önlemler alınacak</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="edit_risk_response"
                        value="TRANSFER"
                        checked={editFormData.risk_response === 'TRANSFER'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">TRANSFER ET</div>
                        <div className="text-sm text-gray-600">Risk üçüncü tarafa aktarılacak (sigorta vb.)</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-gray-200 hover:bg-gray-100">
                      <input
                        type="radio"
                        name="edit_risk_response"
                        value="AVOID"
                        checked={editFormData.risk_response === 'AVOID'}
                        onChange={(e) => setEditFormData({ ...editFormData, risk_response: e.target.value })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">KAÇIN</div>
                        <div className="text-sm text-gray-600">Riske neden olan faaliyetten vazgeçilecek</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yanıt Açıklaması
                  </label>
                  <textarea
                    value={editFormData.response_rationale}
                    onChange={(e) => setEditFormData({ ...editFormData, response_rationale: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Alınacak önlemler ve gerekçe..."
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="IDENTIFIED">Tespit Edildi</option>
                    <option value="ASSESSING">Değerlendiriliyor</option>
                    <option value="TREATING">Tedavi Ediliyor</option>
                    <option value="MONITORING">İzleniyor</option>
                    <option value="CLOSED">Kapatıldı</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg flex items-center justify-between">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlModal({ isOpen, onClose, riskId, departments, onSuccess, editingControl }: any) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    control_type: 'PREVENTIVE',
    control_nature: 'MANUAL',
    design_effectiveness: 3,
    operating_effectiveness: 3,
    responsible_department_id: '',
    frequency: 'Çeyreklik',
    evidence: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingControl) {
      setFormData({
        name: editingControl.name || '',
        description: editingControl.description || '',
        control_type: editingControl.control_type || 'PREVENTIVE',
        control_nature: editingControl.control_nature || 'MANUAL',
        design_effectiveness: editingControl.design_effectiveness || 3,
        operating_effectiveness: editingControl.operating_effectiveness || 3,
        responsible_department_id: editingControl.responsible_department_id || '',
        frequency: 'Çeyreklik',
        evidence: ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        control_type: 'PREVENTIVE',
        control_nature: 'MANUAL',
        design_effectiveness: 3,
        operating_effectiveness: 3,
        responsible_department_id: '',
        frequency: 'Çeyreklik',
        evidence: ''
      });
    }
  }, [editingControl, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingControl) {
        const { error } = await supabase
          .from('risk_controls')
          .update(formData)
          .eq('id', editingControl.id);

        if (error) throw error;
        alert('Kontrol başarıyla güncellendi!');
      } else {
        const { error } = await supabase.from('risk_controls').insert({
          risk_id: riskId,
          ...formData
        });

        if (error) throw error;
        alert('Kontrol başarıyla eklendi!');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving control:', error);
      alert('Kontrol kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingControl ? 'Kontrol Düzenle' : 'Yeni Kontrol Ekle'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kontrol Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Türü</label>
              <select
                value={formData.control_type}
                onChange={e => setFormData({ ...formData, control_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="PREVENTIVE">Önleyici</option>
                <option value="DETECTIVE">Tespit Edici</option>
                <option value="CORRECTIVE">Düzeltici</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kontrol Yapısı</label>
              <select
                value={formData.control_nature}
                onChange={e => setFormData({ ...formData, control_nature: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="MANUAL">Manuel</option>
                <option value="AUTOMATED">Otomatik</option>
                <option value="SEMI_AUTOMATED">Yarı Otomatik</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tasarım Etkinliği (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.design_effectiveness}
                onChange={e => setFormData({ ...formData, design_effectiveness: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Çalışma Etkinliği (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.operating_effectiveness}
                onChange={e => setFormData({ ...formData, operating_effectiveness: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.responsible_department_id}
              onChange={e => setFormData({ ...formData, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seçiniz</option>
              {departments.map((dept: any) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TreatmentModal({ isOpen, onClose, riskId, departments, profiles, onSuccess }: any) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    treatment_type: 'NEW_CONTROL',
    responsible_department_id: '',
    responsible_person_id: '',
    planned_start_date: '',
    planned_end_date: '',
    status: 'PLANNED'
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: lastTreatment } = await supabase
        .from('risk_treatments')
        .select('code')
        .eq('risk_id', riskId)
        .order('code', { ascending: false })
        .limit(1)
        .single();

      let nextCode = 'F001';
      if (lastTreatment?.code) {
        const lastNum = parseInt(lastTreatment.code.substring(1));
        nextCode = `F${String(lastNum + 1).padStart(3, '0')}`;
      }

      const { error } = await supabase.from('risk_treatments').insert({
        risk_id: riskId,
        code: nextCode,
        progress_percent: 0,
        ...formData
      });

      if (error) throw error;

      alert('Faaliyet başarıyla eklendi!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding treatment:', error);
      alert('Faaliyet eklenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Yeni Faaliyet Ekle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Faaliyet Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Faaliyet Türü</label>
            <select
              value={formData.treatment_type}
              onChange={e => setFormData({ ...formData, treatment_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="NEW_CONTROL">Yeni Kontrol</option>
              <option value="IMPROVE_CONTROL">Kontrol İyileştirme</option>
              <option value="TRANSFER">Transfer</option>
              <option value="AVOID">Kaçınma</option>
              <option value="ACCEPT">Kabul</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sorumlu Birim <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.responsible_department_id}
                onChange={e => setFormData({ ...formData, responsible_department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {departments.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
              <select
                value={formData.responsible_person_id}
                onChange={e => setFormData({ ...formData, responsible_person_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                {profiles.map((profile: any) => (
                  <option key={profile.id} value={profile.id}>{profile.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.planned_start_date}
                onChange={e => setFormData({ ...formData, planned_start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.planned_end_date}
                onChange={e => setFormData({ ...formData, planned_end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IndicatorModal({ isOpen, onClose, riskId, indicator, onSuccess }: any) {
  const isEditMode = !!indicator;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    indicator_type: 'LEI',
    unit_of_measure: '',
    measurement_frequency: 'MONTHLY',
    green_threshold: '',
    yellow_threshold: '',
    red_threshold: '',
    direction: 'LOWER_BETTER',
    target_value: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (indicator) {
      setFormData({
        name: indicator.name || '',
        description: indicator.description || '',
        indicator_type: indicator.indicator_type || 'LEI',
        unit_of_measure: indicator.unit_of_measure || '',
        measurement_frequency: indicator.measurement_frequency || 'MONTHLY',
        green_threshold: indicator.green_threshold || '',
        yellow_threshold: indicator.yellow_threshold || '',
        red_threshold: indicator.red_threshold || '',
        direction: indicator.direction || 'LOWER_BETTER',
        target_value: indicator.target_value || 0
      });
    } else {
      setFormData({
        name: '',
        description: '',
        indicator_type: 'LEI',
        unit_of_measure: '',
        measurement_frequency: 'MONTHLY',
        green_threshold: '',
        yellow_threshold: '',
        red_threshold: '',
        direction: 'LOWER_BETTER',
        target_value: 0
      });
    }
  }, [indicator]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditMode) {
        const { error } = await supabase
          .from('risk_indicators')
          .update(formData)
          .eq('id', indicator.id);

        if (error) throw error;

        alert('Gösterge başarıyla güncellendi!');
      } else {
        const prefix = formData.indicator_type;

        const { data: lastIndicator } = await supabase
          .from('risk_indicators')
          .select('code')
          .eq('risk_id', riskId)
          .like('code', `${prefix}%`)
          .order('code', { ascending: false })
          .limit(1)
          .single();

        let nextCode = `${prefix}001`;
        if (lastIndicator?.code) {
          const lastNum = parseInt(lastIndicator.code.substring(3));
          nextCode = `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
        }

        const { error } = await supabase.from('risk_indicators').insert({
          risk_id: riskId,
          code: nextCode,
          ...formData
        });

        if (error) throw error;

        alert('Gösterge başarıyla eklendi!');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving indicator:', error);
      alert(`Gösterge ${isEditMode ? 'güncellenirken' : 'eklenirken'} hata oluştu.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Risk Göstergesi Düzenle' : 'Yeni Risk Göstergesi Ekle'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gösterge Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gösterge Türü</label>
              <select
                value={formData.indicator_type}
                onChange={e => setFormData({ ...formData, indicator_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="LEI">Öncü Gösterge (LEI)</option>
                <option value="KRI">Anahtar Risk Göstergesi (KRI)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ölçüm Birimi</label>
              <input
                type="text"
                value={formData.unit_of_measure}
                onChange={e => setFormData({ ...formData, unit_of_measure: e.target.value })}
                placeholder="Adet, %, TL, vb."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ölçüm Sıklığı</label>
              <select
                value={formData.measurement_frequency}
                onChange={e => setFormData({ ...formData, measurement_frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="DAILY">Günlük</option>
                <option value="WEEKLY">Haftalık</option>
                <option value="MONTHLY">Aylık</option>
                <option value="QUARTERLY">Çeyreklik</option>
                <option value="ANNUAL">Yıllık</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yön</label>
              <select
                value={formData.direction}
                onChange={e => setFormData({ ...formData, direction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOWER_BETTER">Düşük İyi</option>
                <option value="HIGHER_BETTER">Yüksek İyi</option>
                <option value="TARGET">Hedefe Ulaşma</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yeşil Eşik <span className="text-green-600">🟢</span>
              </label>
              <input
                type="text"
                value={formData.green_threshold}
                onChange={e => setFormData({ ...formData, green_threshold: e.target.value })}
                placeholder="örn: <5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sarı Eşik <span className="text-yellow-500">🟡</span>
              </label>
              <input
                type="text"
                value={formData.yellow_threshold}
                onChange={e => setFormData({ ...formData, yellow_threshold: e.target.value })}
                placeholder="örn: 5-10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kırmızı Eşik <span className="text-red-600">🔴</span>
              </label>
              <input
                type="text"
                value={formData.red_threshold}
                onChange={e => setFormData({ ...formData, red_threshold: e.target.value })}
                placeholder="örn: >10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
