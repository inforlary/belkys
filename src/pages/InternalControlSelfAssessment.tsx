import { useState, useEffect } from 'react';
import { ClipboardCheck, Save, Send, FileText, AlertCircle, CheckCircle, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';

interface Period {
  id: string;
  year: number;
  title: string;
  status: string;
  assessment_deadline: string;
}

interface KIKSStandard {
  id: string;
  code: string;
  component: string;
  theme: string;
  standard_no: number;
  title: string;
  description: string;
  is_critical: boolean;
}

interface Assessment {
  id?: string;
  kiks_standard_id: string;
  compliance_level: number;
  maturity_level: string;
  effectiveness_score: number;
  current_situation: string;
  evidence_description: string;
  gaps_identified: string;
  strengths: string;
  weaknesses: string;
  improvement_actions: string;
  improvement_priority: string;
  status: string;
}

const componentNames: Record<string, string> = {
  kontrol_ortami: 'Kontrol Ortamı',
  risk_degerlendirme: 'Risk Değerlendirme',
  kontrol_faaliyetleri: 'Kontrol Faaliyetleri',
  bilgi_iletisim: 'Bilgi ve İletişim',
  izleme: 'İzleme'
};

const complianceLevels = [
  { value: 1, label: '1 - Yetersiz', color: 'text-red-600' },
  { value: 2, label: '2 - Geliştirilmeli', color: 'text-orange-600' },
  { value: 3, label: '3 - Kısmen Uyumlu', color: 'text-yellow-600' },
  { value: 4, label: '4 - Uyumlu', color: 'text-green-600' },
  { value: 5, label: '5 - Tam Uyumlu', color: 'text-emerald-600' }
];

const maturityLevels = [
  { value: 'initial', label: 'İlk Seviye - Geçici' },
  { value: 'developing', label: 'Gelişen - Tekrarlanabilir' },
  { value: 'defined', label: 'Tanımlanmış - Standart Süreçler' },
  { value: 'managed', label: 'Yönetilen - Ölçülebilir' },
  { value: 'optimized', label: 'Optimize - Sürekli İyileştirme' }
];

const priorityLevels = [
  { value: 'low', label: 'Düşük' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' }
];

export default function InternalControlSelfAssessment() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan } = useICPlan();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [standards, setStandards] = useState<KIKSStandard[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string>('');
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [assessments, setAssessments] = useState<Record<string, Assessment>>({});
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedPlanId) {
      loadPeriods();
      loadStandards();
    }
  }, [profile?.organization_id, selectedPlanId]);

  useEffect(() => {
    if (selectedPeriod) {
      loadAssessments();
    }
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedStandard && assessments[selectedStandard]) {
      setCurrentAssessment(assessments[selectedStandard]);
    } else if (selectedStandard) {
      setCurrentAssessment({
        kiks_standard_id: selectedStandard,
        compliance_level: 3,
        maturity_level: 'defined',
        effectiveness_score: 3,
        current_situation: '',
        evidence_description: '',
        gaps_identified: '',
        strengths: '',
        weaknesses: '',
        improvement_actions: '',
        improvement_priority: 'medium',
        status: 'draft'
      });
    }
  }, [selectedStandard, assessments]);

  const loadPeriods = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_periods')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('ic_plan_id', selectedPlanId)
        .in('status', ['active', 'assessment_phase'])
        .order('year', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);

      const currentPeriod = data?.find(p => p.status === 'active' || p.status === 'assessment_phase');
      if (currentPeriod) {
        setSelectedPeriod(currentPeriod.id);
      }
    } catch (error) {
      console.error('Dönemler yüklenirken hata:', error);
    }
  };

  const loadStandards = async () => {
    if (!profile?.organization_id || !selectedPlanId) return;

    try {
      const { data, error } = await supabase
        .from('ic_kiks_sub_standards')
        .select(`
          *,
          ic_kiks_main_standards!inner(
            standard_no,
            ic_kiks_categories!inner(
              name,
              code
            )
          )
        `)
        .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`)
        .eq('ic_plan_id', selectedPlanId)
        .order('code');

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        code: item.code,
        component: item.ic_kiks_main_standards?.ic_kiks_categories?.code || '',
        theme: item.ic_kiks_main_standards?.ic_kiks_categories?.name || '',
        standard_no: item.ic_kiks_main_standards?.standard_no || 0,
        title: item.title,
        description: item.description,
        is_critical: item.is_critical || false
      }));

      setStandards(formattedData);

      if (formattedData && formattedData.length > 0 && !selectedComponent) {
        setSelectedComponent(formattedData[0].component);
      }
    } catch (error) {
      console.error('Standartlar yüklenirken hata:', error);
    }
  };

  const loadAssessments = async () => {
    if (!profile?.organization_id || !profile?.department_id || !selectedPeriod) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ic_self_assessments')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('department_id', profile.department_id)
        .eq('period_id', selectedPeriod);

      if (error) throw error;

      const assessmentMap: Record<string, Assessment> = {};
      data?.forEach(assessment => {
        assessmentMap[assessment.kiks_standard_id] = assessment;
      });

      setAssessments(assessmentMap);
    } catch (error) {
      console.error('Değerlendirmeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAssessment = async (submitStatus: 'draft' | 'submitted' = 'draft') => {
    if (!profile?.organization_id || !profile?.department_id || !selectedPeriod || !currentAssessment) {
      alert('Lütfen tüm gerekli alanları doldurun');
      return;
    }

    try {
      setSaving(true);

      const assessmentData = {
        organization_id: profile.organization_id,
        period_id: selectedPeriod,
        department_id: profile.department_id,
        ic_plan_id: selectedPlanId,
        kiks_standard_id: currentAssessment.kiks_standard_id,
        compliance_level: currentAssessment.compliance_level,
        maturity_level: currentAssessment.maturity_level,
        effectiveness_score: currentAssessment.effectiveness_score,
        current_situation: currentAssessment.current_situation,
        evidence_description: currentAssessment.evidence_description,
        gaps_identified: currentAssessment.gaps_identified,
        strengths: currentAssessment.strengths,
        weaknesses: currentAssessment.weaknesses,
        improvement_actions: currentAssessment.improvement_actions,
        improvement_priority: currentAssessment.improvement_priority,
        assessed_by: profile.id,
        assessment_date: new Date().toISOString().split('T')[0],
        status: submitStatus
      };

      if (currentAssessment.id) {
        const { error } = await supabase
          .from('ic_self_assessments')
          .update(assessmentData)
          .eq('id', currentAssessment.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('ic_self_assessments')
          .insert([assessmentData])
          .select()
          .single();

        if (error) throw error;

        setCurrentAssessment({ ...currentAssessment, id: data.id });
      }

      await loadAssessments();

      if (submitStatus === 'submitted') {
        alert('Değerlendirme başarıyla gönderildi!');
      } else {
        alert('Değerlendirme taslak olarak kaydedildi');
      }
    } catch (error: any) {
      console.error('Kaydetme hatası:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getAssessmentStatus = (standardId: string) => {
    const assessment = assessments[standardId];
    if (!assessment) return { icon: null, text: 'Başlanmadı', color: 'text-gray-400' };

    if (assessment.status === 'approved') {
      return { icon: <CheckCircle className="h-5 w-5" />, text: 'Onaylandı', color: 'text-green-600' };
    } else if (assessment.status === 'submitted' || assessment.status === 'under_review') {
      return { icon: <FileText className="h-5 w-5" />, text: 'İncelemede', color: 'text-blue-600' };
    } else if (assessment.status === 'rejected') {
      return { icon: <AlertCircle className="h-5 w-5" />, text: 'Reddedildi', color: 'text-red-600' };
    } else {
      return { icon: <FileText className="h-5 w-5" />, text: 'Taslak', color: 'text-yellow-600' };
    }
  };

  const componentStandards = standards.filter(s => s.component === selectedComponent);
  const components = Array.from(new Set(standards.map(s => s.component)));

  const getCompletionStats = () => {
    const total = standards.length;
    const completed = Object.values(assessments).filter(a => a.status === 'approved').length;
    const submitted = Object.values(assessments).filter(a => a.status === 'submitted' || a.status === 'under_review').length;
    const draft = Object.values(assessments).filter(a => a.status === 'draft').length;

    return { total, completed, submitted, draft };
  };

  const stats = getCompletionStats();

  if (!hasPlan) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
              <p className="text-yellow-700 mt-1">
                KİKS Öz Değerlendirme modülünü kullanmak için lütfen önce bir İç Kontrol Planı seçin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-blue-600" />
            KİKS Öz Değerlendirme
          </h1>
          <p className="mt-1 text-gray-600">Kamu İç Kontrol Standartları uyumluluk değerlendirmesi</p>
          {selectedPlan && (
            <p className="text-xs text-gray-500 mt-1">Plan: {selectedPlan.name} ({selectedPlan.start_year}-{selectedPlan.end_year})</p>
          )}
        </div>

        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Dönem Seçin</option>
          {periods.map(period => (
            <option key={period.id} value={period.id}>
              {period.title} ({period.year})
            </option>
          ))}
        </select>
      </div>

      {selectedPeriod && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm text-gray-600">Toplam Standart</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm text-gray-600">Onaylanan</div>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm text-gray-600">İncelemede</div>
              <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm text-gray-600">Taslak</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900">KİKS Bileşenleri</h2>
              </div>
              <div className="p-2 space-y-1">
                {components.map(component => {
                  const compStandards = standards.filter(s => s.component === component);
                  const compAssessments = compStandards.filter(s => assessments[s.id]?.status === 'approved');
                  const progress = compStandards.length > 0 ? (compAssessments.length / compStandards.length) * 100 : 0;

                  return (
                    <button
                      key={component}
                      onClick={() => setSelectedComponent(component)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedComponent === component
                          ? 'bg-blue-50 border-2 border-blue-600 text-blue-900'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{componentNames[component]}</span>
                        <span className="text-sm text-gray-600">{compAssessments.length}/{compStandards.length}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900">
                  {componentNames[selectedComponent]} Standartları
                </h2>
              </div>
              <div className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
                {componentStandards.map(standard => {
                  const status = getAssessmentStatus(standard.id);
                  return (
                    <button
                      key={standard.id}
                      onClick={() => setSelectedStandard(standard.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedStandard === standard.id
                          ? 'bg-blue-50 border-2 border-blue-600'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900 mb-1">
                            {standard.code} - {standard.title}
                            {standard.is_critical && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">Kritik</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 line-clamp-2">{standard.description}</div>
                        </div>
                        <div className={`flex items-center gap-1 ${status.color}`}>
                          {status.icon}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900">Değerlendirme Formu</h2>
              </div>
              {selectedStandard && currentAssessment ? (
                <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Uyumluluk Seviyesi
                    </label>
                    <select
                      value={currentAssessment.compliance_level}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        compliance_level: parseInt(e.target.value)
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {complianceLevels.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Olgunluk Seviyesi
                    </label>
                    <select
                      value={currentAssessment.maturity_level}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        maturity_level: e.target.value
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {maturityLevels.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Etkinlik Skoru (1-5)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={currentAssessment.effectiveness_score}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        effectiveness_score: parseInt(e.target.value) || 1
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mevcut Durum
                    </label>
                    <textarea
                      value={currentAssessment.current_situation}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        current_situation: e.target.value
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Standardın mevcut uygulama durumunu açıklayın..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kanıt Açıklaması
                    </label>
                    <textarea
                      value={currentAssessment.evidence_description}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        evidence_description: e.target.value
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Değerlendirmeyi destekleyen kanıtları belirtin..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Güçlü Yönler
                    </label>
                    <textarea
                      value={currentAssessment.strengths}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        strengths: e.target.value
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="İyi çalışan uygulamalar..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tespit Edilen Eksiklikler
                    </label>
                    <textarea
                      value={currentAssessment.gaps_identified}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        gaps_identified: e.target.value
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="İyileştirilmesi gereken alanlar..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İyileştirme Aksiyonları
                    </label>
                    <textarea
                      value={currentAssessment.improvement_actions}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        improvement_actions: e.target.value
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Planlanan iyileştirme aksiyonları..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İyileştirme Önceliği
                    </label>
                    <select
                      value={currentAssessment.improvement_priority}
                      onChange={(e) => setCurrentAssessment({
                        ...currentAssessment,
                        improvement_priority: e.target.value
                      })}
                      disabled={currentAssessment.status === 'submitted' || currentAssessment.status === 'approved'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {priorityLevels.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>

                  {currentAssessment.status !== 'submitted' && currentAssessment.status !== 'approved' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <button
                        onClick={() => saveAssessment('draft')}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        <Save className="h-5 w-5" />
                        Taslak Kaydet
                      </button>
                      <button
                        onClick={() => saveAssessment('submitted')}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send className="h-5 w-5" />
                        Gönder
                      </button>
                    </div>
                  )}

                  {currentAssessment.status === 'submitted' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Bu değerlendirme gönderilmiştir ve yönetici onayı beklenmektedir.
                      </p>
                    </div>
                  )}

                  {currentAssessment.status === 'approved' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        Bu değerlendirme onaylanmıştır.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <ClipboardCheck className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p>Değerlendirme yapmak için sol taraftan bir standart seçin</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
