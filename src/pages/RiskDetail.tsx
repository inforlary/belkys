import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import {
  ArrowLeft, Info, BarChart3, Shield, Activity, TrendingUp, History,
  Edit2, Trash2, Plus, X, Save, AlertTriangle, MoreVertical, ChevronDown
} from 'lucide-react';

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
  category?: { name: string; color: string };
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

  const [showControlModal, setShowControlModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (riskId && profile?.organization_id) {
      loadData();
    }
  }, [riskId, profile?.organization_id]);

  async function loadData() {
    try {
      setLoading(true);

      const [riskRes, controlsRes, treatmentsRes, indicatorsRes, deptsRes, profilesRes] = await Promise.all([
        supabase
          .from('risks')
          .select(`
            *,
            category:risk_categories(name, color),
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
          .order('full_name')
      ]);

      if (riskRes.error) throw riskRes.error;

      setRisk(riskRes.data);
      setControls(controlsRes.data || []);
      setTreatments(treatmentsRes.data || []);
      setIndicators(indicatorsRes.data || []);
      setDepartments(deptsRes.data || []);
      setProfiles(profilesRes.data || []);
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
              onClick={() => navigate(`risk-management/risks/${riskId}?edit=true`)}
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
                    <div className="text-base font-medium text-gray-900">{risk.category?.name || '-'}</div>
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
                    onClick={() => setShowControlModal(true)}
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
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-5 h-5" />
                          </button>
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
                    onClick={() => setShowIndicatorModal(true)}
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
                                {indicator.direction === 'LOWER_BETTER' ? '↓ Düşük iyi' : '↑ Yüksek iyi'}
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
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-5 h-5" />
                          </button>
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
    </div>
  );
}
