import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle, Clock, ChevronDown, ChevronRight, Save, Send, Check, X, BarChart3 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface Department {
  id: string;
  name: string;
}

interface Indicator {
  id: string;
  code: string;
  name: string;
  goal_id: string;
}

interface YearEndEvaluation {
  id: string;
  organization_id: string;
  fiscal_year: number;
  department_id: string;
  general_performance_summary: string | null;
  achievements: string | null;
  challenges: string | null;
  recommendations: string | null;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  director_approved_at: string | null;
  director_approved_by: string | null;
  director_comments: string | null;
  admin_approved_at: string | null;
  admin_approved_by: string | null;
  admin_comments: string | null;
  department?: Department;
}

interface IndicatorEvaluation {
  id: string;
  indicator_id: string;
  relevance_environment_changes: string | null;
  relevance_needs_change: string | null;
  relevance_target_change_needed: string | null;
  effectiveness_target_achieved: string | null;
  effectiveness_needs_met: string | null;
  effectiveness_update_needed: string | null;
  effectiveness_contribution: string | null;
  efficiency_unexpected_costs: string | null;
  efficiency_cost_table_update: string | null;
  efficiency_target_change_due_cost: string | null;
  sustainability_risks: string | null;
  sustainability_measures: string | null;
  sustainability_risk_changes: string | null;
  sustainability_risk_impact: string | null;
  sustainability_plan_update_needed: string | null;
  status: string;
}

interface EvaluationProgress {
  total_departments: number;
  evaluations_draft: number;
  evaluations_submitted: number;
  evaluations_director_approved: number;
  evaluations_admin_approved: number;
  evaluations_completed: number;
  completion_percentage: number;
}

export default function StrategicPlanEvaluation() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [evaluationYear, setEvaluationYear] = useState<number>(currentYear - 1);

  const [allEvaluations, setAllEvaluations] = useState<YearEndEvaluation[]>([]);
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);

  const [myEvaluation, setMyEvaluation] = useState<YearEndEvaluation | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [indicatorEvaluations, setIndicatorEvaluations] = useState<Map<string, IndicatorEvaluation>>(new Map());

  const [expandedIndicators, setExpandedIndicators] = useState<Set<string>>(new Set());
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const [showDashboard, setShowDashboard] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isDirector = profile?.role === 'director';
  const isVP = profile?.role === 'vice_president';
  const canApprove = isAdmin || isDirector || isVP;

  useEffect(() => {
    loadData();
  }, [evaluationYear, profile?.organization_id]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      await Promise.all([
        loadProgress(),
        loadAllEvaluations(),
        loadMyEvaluation(),
        loadIndicators()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase.rpc('get_evaluation_progress', {
      p_organization_id: profile.organization_id,
      p_fiscal_year: evaluationYear
    });

    if (error) {
      console.error('Error loading progress:', error);
      return;
    }

    if (data && data.length > 0) {
      setProgress(data[0]);
    }
  };

  const loadAllEvaluations = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('year_end_evaluations')
      .select(`
        *,
        department:departments(id, name)
      `)
      .eq('organization_id', profile.organization_id)
      .eq('fiscal_year', evaluationYear)
      .order('department(name)');

    if (error) {
      console.error('Error loading evaluations:', error);
      return;
    }

    setAllEvaluations(data || []);
  };

  const loadMyEvaluation = async () => {
    if (!profile?.organization_id || !profile?.department_id) return;

    const { data, error } = await supabase
      .from('year_end_evaluations')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('fiscal_year', evaluationYear)
      .eq('department_id', profile.department_id)
      .maybeSingle();

    if (error) {
      console.error('Error loading my evaluation:', error);
      return;
    }

    if (data) {
      setMyEvaluation(data);
      await loadIndicatorEvaluations(data.id);
    } else {
      setMyEvaluation(null);
      setIndicatorEvaluations(new Map());
    }
  };

  const loadIndicators = async () => {
    if (!profile?.organization_id) return;

    const { data: goalsData, error: goalsError } = await supabase
      .from('goals')
      .select('id')
      .eq('organization_id', profile.organization_id);

    if (goalsError || !goalsData) return;

    const goalIds = goalsData.map(g => g.id);

    const { data, error } = await supabase
      .from('indicators')
      .select('id, code, name, goal_id')
      .in('goal_id', goalIds)
      .order('code');

    if (error) {
      console.error('Error loading indicators:', error);
      return;
    }

    setIndicators(data || []);
  };

  const loadIndicatorEvaluations = async (evaluationId: string) => {
    const { data, error } = await supabase
      .from('indicator_year_evaluations')
      .select('*')
      .eq('year_end_evaluation_id', evaluationId);

    if (error) {
      console.error('Error loading indicator evaluations:', error);
      return;
    }

    const map = new Map<string, IndicatorEvaluation>();
    data?.forEach(item => {
      map.set(item.indicator_id, item);
    });
    setIndicatorEvaluations(map);
  };

  const createNewEvaluation = async () => {
    if (!profile?.organization_id || !profile?.department_id || !user?.id) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('year_end_evaluations')
        .insert({
          organization_id: profile.organization_id,
          fiscal_year: evaluationYear,
          department_id: profile.department_id,
          status: 'draft',
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setMyEvaluation(data);
      alert('Yeni değerlendirme oluşturuldu.');
    } catch (error: any) {
      console.error('Error creating evaluation:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEvaluation = async () => {
    if (!myEvaluation?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('year_end_evaluations')
        .update({
          general_performance_summary: myEvaluation.general_performance_summary,
          achievements: myEvaluation.achievements,
          challenges: myEvaluation.challenges,
          recommendations: myEvaluation.recommendations,
          updated_at: new Date().toISOString()
        })
        .eq('id', myEvaluation.id);

      if (error) throw error;

      for (const [indicatorId, evaluation] of indicatorEvaluations.entries()) {
        if (evaluation.id) {
          await supabase
            .from('indicator_year_evaluations')
            .update({
              ...evaluation,
              updated_at: new Date().toISOString()
            })
            .eq('id', evaluation.id);
        } else {
          await supabase
            .from('indicator_year_evaluations')
            .insert({
              year_end_evaluation_id: myEvaluation.id,
              indicator_id: indicatorId,
              ...evaluation,
              created_by: user?.id
            });
        }
      }

      alert('Değerlendirme kaydedildi.');
      await loadMyEvaluation();
    } catch (error: any) {
      console.error('Error saving evaluation:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const submitForApproval = async () => {
    if (!myEvaluation?.id || !user?.id) return;

    if (!confirm('Değerlendirmeyi onaya göndermek istediğinize emin misiniz?')) return;

    setSaving(true);
    try {
      await saveEvaluation();

      const { error } = await supabase
        .from('year_end_evaluations')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: user.id
        })
        .eq('id', myEvaluation.id);

      if (error) throw error;

      alert('Değerlendirme onaya gönderildi.');
      await loadData();
    } catch (error: any) {
      console.error('Error submitting evaluation:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const approveEvaluation = async (evaluationId: string, currentStatus: string) => {
    if (!user?.id) return;

    let newStatus = '';
    let updateFields: any = { updated_at: new Date().toISOString() };

    if (currentStatus === 'submitted' && isDirector) {
      newStatus = 'director_approved';
      updateFields.status = newStatus;
      updateFields.director_approved_at = new Date().toISOString();
      updateFields.director_approved_by = user.id;
    } else if (currentStatus === 'director_approved' && (isAdmin || isVP)) {
      newStatus = 'admin_approved';
      updateFields.status = newStatus;
      updateFields.admin_approved_at = new Date().toISOString();
      updateFields.admin_approved_by = user.id;
    } else if (currentStatus === 'admin_approved' && (isAdmin || isVP)) {
      newStatus = 'completed';
      updateFields.status = newStatus;
    } else {
      alert('Bu durumda onaylama yetkiniz yok.');
      return;
    }

    if (!confirm(`Değerlendirmeyi onaylamak istediğinize emin misiniz?`)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('year_end_evaluations')
        .update(updateFields)
        .eq('id', evaluationId);

      if (error) throw error;

      alert('Değerlendirme onaylandı.');
      await loadData();
    } catch (error: any) {
      console.error('Error approving evaluation:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const rejectEvaluation = async (evaluationId: string, currentStatus: string) => {
    const comments = prompt('Reddetme gerekçesini giriniz:');
    if (!comments) return;

    setSaving(true);
    try {
      const updateFields: any = {
        status: 'draft',
        updated_at: new Date().toISOString()
      };

      if (currentStatus === 'submitted') {
        updateFields.director_comments = comments;
      } else if (currentStatus === 'director_approved') {
        updateFields.admin_comments = comments;
      }

      const { error } = await supabase
        .from('year_end_evaluations')
        .update(updateFields)
        .eq('id', evaluationId);

      if (error) throw error;

      alert('Değerlendirme reddedildi ve taslağa geri döndü.');
      await loadData();
    } catch (error: any) {
      console.error('Error rejecting evaluation:', error);
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleIndicator = (indicatorId: string) => {
    const newExpanded = new Set(expandedIndicators);
    if (newExpanded.has(indicatorId)) {
      newExpanded.delete(indicatorId);
    } else {
      newExpanded.add(indicatorId);
    }
    setExpandedIndicators(newExpanded);
  };

  const toggleCriteria = (key: string) => {
    const newExpanded = new Set(expandedCriteria);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCriteria(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-800' },
      submitted: { label: 'Onay Bekliyor', className: 'bg-yellow-100 text-yellow-800' },
      director_approved: { label: 'Müdür Onayladı', className: 'bg-blue-100 text-blue-800' },
      admin_approved: { label: 'Yönetici Onayladı', className: 'bg-green-100 text-green-800' },
      completed: { label: 'Tamamlandı', className: 'bg-green-600 text-white' }
    };

    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const updateIndicatorEvaluation = (indicatorId: string, field: string, value: string) => {
    const current = indicatorEvaluations.get(indicatorId) || {
      id: '',
      indicator_id: indicatorId,
      status: 'draft'
    } as IndicatorEvaluation;

    const updated = { ...current, [field]: value };
    const newMap = new Map(indicatorEvaluations);
    newMap.set(indicatorId, updated);
    setIndicatorEvaluations(newMap);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yıl Sonu Değerlendirme</h1>
          <p className="text-sm text-gray-600 mt-1">
            {evaluationYear} yılı stratejik plan performans değerlendirmesi
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={evaluationYear}
            onChange={(e) => setEvaluationYear(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          {(isAdmin || isVP) && (
            <Button
              onClick={() => setShowDashboard(!showDashboard)}
              variant="secondary"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {showDashboard ? 'Dashboard Gizle' : 'Dashboard Göster'}
            </Button>
          )}
        </div>
      </div>

      {showDashboard && (isAdmin || isVP) && progress && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Değerlendirme İlerlemesi</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{progress.total_departments}</div>
              <div className="text-sm text-gray-600">Toplam Müdürlük</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-500">{progress.evaluations_draft}</div>
              <div className="text-sm text-gray-600">Taslak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{progress.evaluations_submitted}</div>
              <div className="text-sm text-gray-600">Onay Bekliyor</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{progress.evaluations_director_approved}</div>
              <div className="text-sm text-gray-600">Müdür Onayı</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{progress.evaluations_admin_approved}</div>
              <div className="text-sm text-gray-600">Yönetici Onayı</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{progress.evaluations_completed}</div>
              <div className="text-sm text-gray-600">Tamamlandı</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Tamamlanma Oranı</span>
              <span className="font-semibold">{progress.completion_percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all"
                style={{ width: `${progress.completion_percentage}%` }}
              />
            </div>
          </div>

          {progress.completion_percentage < 100 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Uyarı:</strong> Tüm müdürlükler değerlendirmelerini tamamlamadan yeni yıla geçiş yapılamaz.
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-medium mb-3">Müdürlük Bazında Durum</h3>
            <div className="space-y-2">
              {allEvaluations.map(evalItem => (
                <div key={evalItem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{evalItem.department?.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(evalItem.status)}
                    {canApprove && evalItem.status !== 'draft' && evalItem.status !== 'completed' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveEvaluation(evalItem.id, evalItem.status)}
                          disabled={saving}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => rejectEvaluation(evalItem.id, evalItem.status)}
                          disabled={saving}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {!myEvaluation ? (
        <Card className="p-8 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {evaluationYear} Yılı Değerlendirmesi Bulunamadı
          </h3>
          <p className="text-gray-600 mb-4">
            Müdürlüğünüz için henüz bir değerlendirme oluşturulmamış.
          </p>
          <Button onClick={createNewEvaluation} disabled={saving}>
            Yeni Değerlendirme Oluştur
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Genel Değerlendirme</h2>
              {getStatusBadge(myEvaluation.status)}
            </div>

            {(myEvaluation.director_comments || myEvaluation.admin_comments) && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="font-medium text-yellow-900 mb-2">Geri Bildirimler:</div>
                {myEvaluation.director_comments && (
                  <div className="text-sm text-yellow-800 mb-2">
                    <strong>Müdür:</strong> {myEvaluation.director_comments}
                  </div>
                )}
                {myEvaluation.admin_comments && (
                  <div className="text-sm text-yellow-800">
                    <strong>Yönetici:</strong> {myEvaluation.admin_comments}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genel Performans Özeti
                </label>
                <textarea
                  value={myEvaluation.general_performance_summary || ''}
                  onChange={(e) => setMyEvaluation({ ...myEvaluation, general_performance_summary: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Yıl içinde genel performansı özetleyiniz..."
                  disabled={myEvaluation.status !== 'draft'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Başarılar ve Kazanımlar
                </label>
                <textarea
                  value={myEvaluation.achievements || ''}
                  onChange={(e) => setMyEvaluation({ ...myEvaluation, achievements: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Neler iyi gitti? Hangi hedeflere ulaşıldı?..."
                  disabled={myEvaluation.status !== 'draft'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Karşılaşılan Zorluklar
                </label>
                <textarea
                  value={myEvaluation.challenges || ''}
                  onChange={(e) => setMyEvaluation({ ...myEvaluation, challenges: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Hangi engeller ve zorluklar yaşandı?..."
                  disabled={myEvaluation.status !== 'draft'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Çözüm Önerileri ve Gelecek Yıl Hedefleri
                </label>
                <textarea
                  value={myEvaluation.recommendations || ''}
                  onChange={(e) => setMyEvaluation({ ...myEvaluation, recommendations: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Gelecek yıl için önerileriniz ve odak alanlarınız..."
                  disabled={myEvaluation.status !== 'draft'}
                />
              </div>
            </div>

            {myEvaluation.status === 'draft' && (
              <div className="flex gap-3 mt-6">
                <Button onClick={saveEvaluation} disabled={saving} variant="secondary">
                  <Save className="w-4 h-4 mr-2" />
                  Kaydet
                </Button>
                <Button onClick={submitForApproval} disabled={saving}>
                  <Send className="w-4 h-4 mr-2" />
                  Onaya Gönder
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Gösterge Bazında Detaylı Değerlendirme</h2>
            <p className="text-sm text-gray-600 mb-6">
              Her gösterge için değerlendirme kriterlerine göre soruları cevaplayınız.
            </p>

            <div className="space-y-3">
              {indicators.map(indicator => {
                const evaluation = indicatorEvaluations.get(indicator.id);
                const isExpanded = expandedIndicators.has(indicator.id);

                return (
                  <div key={indicator.id} className="border rounded-lg">
                    <button
                      onClick={() => toggleIndicator(indicator.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="text-left">
                          <div className="font-medium">{indicator.code}</div>
                          <div className="text-sm text-gray-600">{indicator.name}</div>
                        </div>
                      </div>
                      {evaluation && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          Dolduruldu
                        </span>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="p-4 border-t space-y-6">
                        <CriteriaSection
                          title="İlgililik (Relevance)"
                          criteriaKey={`${indicator.id}-relevance`}
                          expanded={expandedCriteria}
                          toggleExpanded={toggleCriteria}
                          disabled={myEvaluation.status !== 'draft'}
                        >
                          <QuestionField
                            label="Planın başlangıç döneminden itibaren iç ve dış çevrede ciddi değişiklikler meydana geldi mi?"
                            value={evaluation?.relevance_environment_changes || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'relevance_environment_changes', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Bu değişiklikler tespitler ve ihtiyaçları ne ölçüde değiştirdi?"
                            value={evaluation?.relevance_needs_change || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'relevance_needs_change', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Tespitler ve ihtiyaçlardaki değişim hedef ve performans göstergelerinde bir değişiklik ihtiyacı doğurdu mu?"
                            value={evaluation?.relevance_target_change_needed || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'relevance_target_change_needed', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                        </CriteriaSection>

                        <CriteriaSection
                          title="Etkililik (Effectiveness)"
                          criteriaKey={`${indicator.id}-effectiveness`}
                          expanded={expandedCriteria}
                          toggleExpanded={toggleCriteria}
                          disabled={myEvaluation.status !== 'draft'}
                        >
                          <QuestionField
                            label="Performans göstergesi değerlerine ulaşıldı mı?"
                            value={evaluation?.effectiveness_target_achieved || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'effectiveness_target_achieved', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Performans göstergesine ulaşma düzeyiyle tespit edilen ihtiyaçlar karşılandı mı?"
                            value={evaluation?.effectiveness_needs_met || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'effectiveness_needs_met', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Performans göstergelerinde istenilen düzeye ulaşılmadıysa güncelleme ihtiyacı var mı?"
                            value={evaluation?.effectiveness_update_needed || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'effectiveness_update_needed', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Performans göstergesi gerçekleşmelerinin kalkınma planına katkısı ne oldu?"
                            value={evaluation?.effectiveness_contribution || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'effectiveness_contribution', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                        </CriteriaSection>

                        <CriteriaSection
                          title="Etkinlik (Efficiency)"
                          criteriaKey={`${indicator.id}-efficiency`}
                          expanded={expandedCriteria}
                          toggleExpanded={toggleCriteria}
                          disabled={myEvaluation.status !== 'draft'}
                        >
                          <QuestionField
                            label="Performans gösterge değerlerine ulaşılırken öngörülemeyen maliyetler ortaya çıktı mı?"
                            value={evaluation?.efficiency_unexpected_costs || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'efficiency_unexpected_costs', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Tahmini maliyet tablosunda değişiklik ihtiyacı var mı?"
                            value={evaluation?.efficiency_cost_table_update || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'efficiency_cost_table_update', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Yüksek maliyetlerin ortaya çıkması durumunda hedefte ve performans göstergesi değerlerinde değişiklik ihtiyacı oluştu mu?"
                            value={evaluation?.efficiency_target_change_due_cost || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'efficiency_target_change_due_cost', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                        </CriteriaSection>

                        <CriteriaSection
                          title="Sürdürülebilirlik (Sustainability)"
                          criteriaKey={`${indicator.id}-sustainability`}
                          expanded={expandedCriteria}
                          toggleExpanded={toggleCriteria}
                          disabled={myEvaluation.status !== 'draft'}
                        >
                          <QuestionField
                            label="Performans göstergelerinin devam ettirilmesinde kurumsal, yasal, çevresel vb. unsurlar açısından riskler nelerdir?"
                            value={evaluation?.sustainability_risks || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'sustainability_risks', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Bu riskleri ortadan kaldırmak ve sürdürülebilirliği sağlamak için hangi tedbirlerin alınması gerekir?"
                            value={evaluation?.sustainability_measures || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'sustainability_measures', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Hedef bazında belirlenen risklerde bir değişiklik oldu mu?"
                            value={evaluation?.sustainability_risk_changes || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'sustainability_risk_changes', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Gerçekleşen riskler hedeflere ulaşılamamasına neden olabilir mi?"
                            value={evaluation?.sustainability_risk_impact || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'sustainability_risk_impact', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                          <QuestionField
                            label="Gerçekleşen riskler ya da öngörülemeyen ancak maruz kalınan ilave riskler, stratejik planın güncellenmesini gerektirir mi?"
                            value={evaluation?.sustainability_plan_update_needed || ''}
                            onChange={(value) => updateIndicatorEvaluation(indicator.id, 'sustainability_plan_update_needed', value)}
                            disabled={myEvaluation.status !== 'draft'}
                          />
                        </CriteriaSection>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {myEvaluation.status === 'draft' && (
              <div className="flex gap-3 mt-6">
                <Button onClick={saveEvaluation} disabled={saving} variant="secondary">
                  <Save className="w-4 h-4 mr-2" />
                  Tümünü Kaydet
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

interface CriteriaSectionProps {
  title: string;
  criteriaKey: string;
  expanded: Set<string>;
  toggleExpanded: (key: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function CriteriaSection({ title, criteriaKey, expanded, toggleExpanded, children, disabled }: CriteriaSectionProps) {
  const isExpanded = expanded.has(criteriaKey);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => toggleExpanded(criteriaKey)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg"
        disabled={disabled}
      >
        <span className="font-medium text-gray-900">{title}</span>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4 space-y-4 border-t">
          {children}
        </div>
      )}
    </div>
  );
}

interface QuestionFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function QuestionField({ label, value, onChange, disabled }: QuestionFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        placeholder="Cevabınızı yazınız..."
        disabled={disabled}
      />
    </div>
  );
}
