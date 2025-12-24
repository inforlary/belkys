import { useState, useEffect } from 'react';
import { Target, TrendingUp, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CompletionStatus {
  overall_completion_pct: number;
  self_assessment_completion_pct: number;
  processes_documented_pct: number;
  risks_assessed_pct: number;
  controls_tested_pct: number;
  capas_completed_pct: number;
  overall_status: string;
  quality_score: number;
  timeliness_score: number;
  completeness_score: number;
  completed_assessments: number;
  total_kiks_standards: number;
  target_completion_date: string;
}

interface DepartmentCompletionWidgetProps {
  periodId: string;
}

export function DepartmentCompletionWidget({ periodId }: DepartmentCompletionWidgetProps) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<CompletionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (periodId && profile?.department_id) {
      loadCompletionStatus();
    }
  }, [periodId, profile?.department_id]);

  const loadCompletionStatus = async () => {
    if (!profile?.organization_id || !profile?.department_id) return;

    try {
      setLoading(true);

      let { data, error } = await supabase
        .from('ic_department_completion_status')
        .select('*')
        .eq('period_id', periodId)
        .eq('department_id', profile.department_id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: kiksData } = await supabase
          .from('ic_kiks_standards')
          .select('id')
          .eq('organization_id', profile.organization_id);

        const totalStandards = kiksData?.length || 0;

        const { data: newStatus, error: insertError } = await supabase
          .from('ic_department_completion_status')
          .insert([{
            organization_id: profile.organization_id,
            period_id: periodId,
            department_id: profile.department_id,
            total_kiks_standards: totalStandards,
            overall_status: 'not_started'
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        data = newStatus;
      }

      setStatus(data);
    } catch (error) {
      console.error('Tamamlanma durumu yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Tamamlanma durumu bulunamadı</p>
      </div>
    );
  }

  const getStatusColor = (statusKey: string) => {
    switch (statusKey) {
      case 'completed':
        return 'bg-green-500';
      case 'pending_review':
        return 'bg-blue-500';
      case 'in_progress':
        return 'bg-yellow-500';
      case 'late':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (statusKey: string) => {
    const statusMap: Record<string, string> = {
      not_started: 'Başlanmadı',
      in_progress: 'Devam Ediyor',
      pending_review: 'İnceleme Bekliyor',
      completed: 'Tamamlandı',
      late: 'Gecikmede'
    };
    return statusMap[statusKey] || statusKey;
  };

  const isLate = status.target_completion_date && new Date(status.target_completion_date) < new Date();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            İlerleme Durumu
          </h3>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(status.overall_status)} text-white`}>
            {getStatusText(status.overall_status)}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Genel Tamamlanma</span>
            <span className="text-2xl font-bold text-blue-600">{status.overall_completion_pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${status.overall_completion_pct}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Öz Değerlendirme</span>
              <span className="text-sm font-semibold text-gray-900">{status.self_assessment_completion_pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${status.self_assessment_completion_pct}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {status.completed_assessments} / {status.total_kiks_standards} standart
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Risk Değerlendirme</span>
              <span className="text-sm font-semibold text-gray-900">{status.risks_assessed_pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-600 h-2 rounded-full"
                style={{ width: `${status.risks_assessed_pct}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Kontrol Testleri</span>
              <span className="text-sm font-semibold text-gray-900">{status.controls_tested_pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${status.controls_tested_pct}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">DÖF Tamamlanması</span>
              <span className="text-sm font-semibold text-gray-900">{status.capas_completed_pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-yellow-600 h-2 rounded-full"
                style={{ width: `${status.capas_completed_pct}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Performans Skorları</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Kalite</div>
              <div className="text-lg font-bold text-blue-600">{status.quality_score || 0}</div>
              <div className="text-xs text-gray-500">/ 100</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Zamanlama</div>
              <div className="text-lg font-bold text-green-600">{status.timeliness_score || 0}</div>
              <div className="text-xs text-gray-500">/ 100</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Eksiksizlik</div>
              <div className="text-lg font-bold text-purple-600">{status.completeness_score || 0}</div>
              <div className="text-xs text-gray-500">/ 100</div>
            </div>
          </div>
        </div>

        {status.target_completion_date && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${isLate ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
            {isLate ? (
              <>
                <AlertTriangle className="h-5 w-5" />
                <div className="text-sm">
                  <span className="font-semibold">Hedef tarih geçti:</span> {new Date(status.target_completion_date).toLocaleDateString('tr-TR')}
                </div>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5" />
                <div className="text-sm">
                  <span className="font-semibold">Hedef tarih:</span> {new Date(status.target_completion_date).toLocaleDateString('tr-TR')}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
