import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  Plus,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  FileText,
  BarChart3,
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import Modal from '../components/ui/Modal';

interface Assessment {
  id: string;
  name: string;
  year: number;
  period: string;
  assessment_date: string;
  overall_compliance_percent: number;
  status: string;
  assessed_by: {
    full_name: string;
  };
  detail_count?: number;
  completed_count?: number;
}

interface AssessmentSummary {
  total_assessments: number;
  latest_assessment: Assessment | null;
  avg_compliance: number;
  strongest_standard: { code: string; name: string; avg_level: number } | null;
  weakest_standard: { code: string; name: string; avg_level: number } | null;
}

export default function ICAssessments() {
  const { profile } = useAuth();
  const navigate = useLocation();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [summary, setSummary] = useState<AssessmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [newForm, setNewForm] = useState({
    name: '',
    year: new Date().getFullYear(),
    period: 'Q2' as 'Q2' | 'Q4',
    assessment_date: new Date().toISOString().split('T')[0],
    copy_from_previous: false,
    source_assessment_id: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id, filterYear, filterPeriod, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('ic_assessments')
        .select(`
          *,
          assessed_by:profiles!ic_assessments_assessed_by_id_fkey(full_name)
        `)
        .eq('organization_id', profile?.organization_id)
        .order('year', { ascending: false })
        .order('period', { ascending: false });

      if (filterYear !== 'all') {
        query = query.eq('year', parseInt(filterYear));
      }
      if (filterPeriod !== 'all') {
        query = query.eq('period', filterPeriod);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data: assessmentsData, error } = await query;
      if (error) throw error;

      const assessmentsWithCounts = await Promise.all(
        (assessmentsData || []).map(async (assessment) => {
          const { data: details } = await supabase
            .from('ic_assessment_details')
            .select('id, compliance_level', { count: 'exact' })
            .eq('assessment_id', assessment.id);

          return {
            ...assessment,
            detail_count: details?.length || 0,
            completed_count: details?.filter(d => d.compliance_level > 0).length || 0
          };
        })
      );

      setAssessments(assessmentsWithCounts);

      await loadSummary();
    } catch (error: any) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const { data: allAssessments, error: assessError } = await supabase
        .from('ic_assessments')
        .select(`
          *,
          assessed_by:profiles!ic_assessments_assessed_by_id_fkey(full_name)
        `)
        .eq('organization_id', profile?.organization_id)
        .eq('status', 'APPROVED')
        .order('year', { ascending: false })
        .order('period', { ascending: false })
        .limit(1);

      if (assessError) throw assessError;

      const latestAssessment = allAssessments?.[0] || null;

      const { data: allDetails, error: detailsError } = await supabase
        .from('ic_assessment_details')
        .select(`
          compliance_level,
          standard:ic_standards(code, name)
        `)
        .in('assessment_id', (allAssessments || []).map(a => a.id));

      if (detailsError) throw detailsError;

      const avgCompliance = allDetails && allDetails.length > 0
        ? (allDetails.reduce((sum, d) => sum + (d.compliance_level || 0), 0) / allDetails.length) * 20
        : 0;

      const standardStats = new Map<string, { code: string; name: string; total: number; count: number }>();

      allDetails?.forEach(detail => {
        if (detail.standard) {
          const key = detail.standard.code;
          if (!standardStats.has(key)) {
            standardStats.set(key, {
              code: detail.standard.code,
              name: detail.standard.name,
              total: 0,
              count: 0
            });
          }
          const stat = standardStats.get(key)!;
          stat.total += detail.compliance_level;
          stat.count += 1;
        }
      });

      const standardAverages = Array.from(standardStats.values()).map(stat => ({
        code: stat.code,
        name: stat.name,
        avg_level: stat.total / stat.count
      }));

      standardAverages.sort((a, b) => b.avg_level - a.avg_level);

      setSummary({
        total_assessments: allAssessments?.length || 0,
        latest_assessment: latestAssessment,
        avg_compliance: avgCompliance,
        strongest_standard: standardAverages[0] || null,
        weakest_standard: standardAverages[standardAverages.length - 1] || null
      });
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const handleCreateAssessment = async () => {
    if (!profile?.organization_id) return;

    try {
      setSaving(true);

      const { data: assessment, error: assessmentError } = await supabase
        .from('ic_assessments')
        .insert({
          organization_id: profile.organization_id,
          name: newForm.name,
          year: newForm.year,
          period: newForm.period,
          assessment_date: newForm.assessment_date,
          assessed_by_id: profile.id,
          status: 'DRAFT'
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      const { data: standards, error: standardsError } = await supabase
        .from('ic_standards')
        .select('id')
        .order('code');

      if (standardsError) throw standardsError;

      let detailsToInsert: any[] = [];

      if (newForm.copy_from_previous && newForm.source_assessment_id) {
        const { data: sourceDetails, error: sourceError } = await supabase
          .from('ic_assessment_details')
          .select('*')
          .eq('assessment_id', newForm.source_assessment_id);

        if (sourceError) throw sourceError;

        detailsToInsert = sourceDetails.map(detail => ({
          assessment_id: assessment.id,
          standard_id: detail.standard_id,
          compliance_level: detail.compliance_level,
          strengths: detail.strengths,
          weaknesses: detail.weaknesses,
          evidences: detail.evidences,
          recommendations: detail.recommendations
        }));
      } else {
        detailsToInsert = standards.map(standard => ({
          assessment_id: assessment.id,
          standard_id: standard.id,
          compliance_level: 1,
          strengths: '',
          weaknesses: '',
          evidences: '',
          recommendations: ''
        }));
      }

      const { error: detailsError } = await supabase
        .from('ic_assessment_details')
        .insert(detailsToInsert);

      if (detailsError) throw detailsError;

      setShowNewModal(false);
      setNewForm({
        name: '',
        year: new Date().getFullYear(),
        period: 'Q2',
        assessment_date: new Date().toISOString().split('T')[0],
        copy_from_previous: false,
        source_assessment_id: ''
      });

      navigate(`/internal-control/assessments/${assessment.id}`);
    } catch (error: any) {
      console.error('Error creating assessment:', error);
      alert('Değerlendirme oluşturulurken hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Taslak',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      APPROVED: 'Onaylandı'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'gray',
      IN_PROGRESS: 'blue',
      COMPLETED: 'yellow',
      APPROVED: 'green'
    };
    return colors[status] || 'gray';
  };

  const availableYears = Array.from(
    new Set(assessments.map(a => a.year))
  ).sort((a, b) => b - a);

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
          <h1 className="text-2xl font-bold text-gray-900">İç Kontrol Öz Değerlendirme</h1>
          <p className="text-gray-600 mt-1">18 standart için uyum değerlendirmesi</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Yeni Değerlendirme Başlat
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Son Değerlendirme</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          {summary?.latest_assessment ? (
            <>
              <div className="text-2xl font-bold text-gray-900">
                {summary.latest_assessment.year}-{summary.latest_assessment.period}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {new Date(summary.latest_assessment.assessment_date).toLocaleDateString('tr-TR')}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400">Henüz değerlendirme yok</div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Genel Uyum</span>
            <BarChart3 className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            %{summary?.avg_compliance?.toFixed(0) || 0}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${summary?.avg_compliance || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">En Güçlü</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          {summary?.strongest_standard ? (
            <>
              <div className="text-lg font-bold text-gray-900">
                {summary.strongest_standard.code}
              </div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                {summary.strongest_standard.name}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400">-</div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">En Zayıf</span>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          {summary?.weakest_standard ? (
            <>
              <div className="text-lg font-bold text-gray-900">
                {summary.weakest_standard.code}
              </div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                {summary.weakest_standard.name}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400">-</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="input-field"
          >
            <option value="all">Tüm Yıllar</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="input-field"
          >
            <option value="all">Tüm Dönemler</option>
            <option value="Q2">Q2 (1. Yarıyıl)</option>
            <option value="Q4">Q4 (2. Yarıyıl)</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="DRAFT">Taslak</option>
            <option value="IN_PROGRESS">Devam Ediyor</option>
            <option value="COMPLETED">Tamamlandı</option>
            <option value="APPROVED">Onaylandı</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {assessments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Henüz değerlendirme bulunmuyor</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="btn-primary mt-4"
            >
              İlk Değerlendirmeyi Başlat
            </button>
          </div>
        ) : (
          assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {assessment.name}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      assessment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      assessment.status === 'COMPLETED' ? 'bg-yellow-100 text-yellow-800' :
                      assessment.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(assessment.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Dönem: {assessment.year}-{assessment.period}</span>
                    <span>•</span>
                    <span>Tarih: {new Date(assessment.assessment_date).toLocaleDateString('tr-TR')}</span>
                    <span>•</span>
                    <span>Değerlendiren: {assessment.assessed_by?.full_name || '-'}</span>
                  </div>
                </div>
              </div>

              {assessment.overall_compliance_percent && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">GENEL UYUM:</span>
                    <span className="text-lg font-bold text-gray-900">
                      %{assessment.overall_compliance_percent.toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${assessment.overall_compliance_percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {assessment.completed_count || 0}/18 standart değerlendirildi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/internal-control/assessments/${assessment.id}`)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Görüntüle
                  </button>
                  <button
                    className="btn-secondary flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Rapor
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Yeni İç Kontrol Değerlendirmesi Başlat"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Değerlendirme Adı *
            </label>
            <input
              type="text"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder={`${newForm.year} Yılı ${newForm.period === 'Q2' ? '1' : '2'}. Dönem İç Kontrol Değerlendirmesi`}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Değerlendirme Yılı *
              </label>
              <select
                value={newForm.year}
                onChange={(e) => setNewForm({ ...newForm, year: parseInt(e.target.value) })}
                className="input-field"
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Değerlendirme Dönemi *
              </label>
              <select
                value={newForm.period}
                onChange={(e) => setNewForm({ ...newForm, period: e.target.value as 'Q2' | 'Q4' })}
                className="input-field"
              >
                <option value="Q2">Q2 - 1. Yarıyıl (Haziran)</option>
                <option value="Q4">Q4 - 2. Yarıyıl (Aralık)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Değerlendirme Tarihi *
            </label>
            <input
              type="date"
              value={newForm.assessment_date}
              onChange={(e) => setNewForm({ ...newForm, assessment_date: e.target.value })}
              className="input-field"
            />
          </div>

          {assessments.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newForm.copy_from_previous}
                  onChange={(e) => setNewForm({ ...newForm, copy_from_previous: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Önceki değerlendirmeden başlangıç değerlerini kopyala
                </span>
              </label>

              {newForm.copy_from_previous && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kaynak Değerlendirme
                  </label>
                  <select
                    value={newForm.source_assessment_id}
                    onChange={(e) => setNewForm({ ...newForm, source_assessment_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Seçiniz...</option>
                    {assessments.filter(a => a.status === 'APPROVED').map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.year}-{a.period})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowNewModal(false)}
              className="btn-secondary"
              disabled={saving}
            >
              İptal
            </button>
            <button
              onClick={handleCreateAssessment}
              className="btn-primary"
              disabled={saving || !newForm.name}
            >
              {saving ? 'Oluşturuluyor...' : 'Değerlendirmeyi Başlat'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
