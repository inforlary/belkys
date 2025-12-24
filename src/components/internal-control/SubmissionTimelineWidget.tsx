import { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SubmissionLog {
  id: string;
  submission_type: string;
  action: string;
  performed_at: string;
  performed_by: string;
  notes: string;
  profiles: {
    full_name: string;
  };
}

interface SubmissionTimelineWidgetProps {
  periodId: string;
  limit?: number;
}

export function SubmissionTimelineWidget({ periodId, limit = 10 }: SubmissionTimelineWidgetProps) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<SubmissionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (periodId) {
      loadSubmissionLogs();
    }
  }, [periodId, profile?.department_id]);

  const loadSubmissionLogs = async () => {
    if (!profile?.organization_id) return;

    try {
      setLoading(true);

      let query = supabase
        .from('ic_submission_logs')
        .select(`
          *,
          profiles:performed_by (
            full_name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('period_id', periodId)
        .order('performed_at', { ascending: false })
        .limit(limit);

      if (profile.department_id && profile.role !== 'admin' && profile.role !== 'vice_president') {
        query = query.eq('department_id', profile.department_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Gönderim logları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'submitted':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'revision_requested':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      created: 'Oluşturuldu',
      updated: 'Güncellendi',
      submitted: 'Gönderildi',
      approved: 'Onaylandı',
      rejected: 'Reddedildi',
      revision_requested: 'Revizyon İstendi'
    };
    return actionMap[action] || action;
  };

  const getSubmissionTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      assessment: 'Öz Değerlendirme',
      process: 'Süreç',
      risk: 'Risk',
      control: 'Kontrol',
      capa: 'DÖF',
      period_submission: 'Dönem Gönderimi'
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Son Aktiviteler
        </h3>
      </div>

      <div className="p-6">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Henüz aktivite kaydı bulunmamaktadır</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log, index) => (
              <div key={log.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                    {getActionIcon(log.action)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {getSubmissionTypeText(log.submission_type)} - {getActionText(log.action)}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {log.profiles?.full_name || 'Bilinmeyen Kullanıcı'}
                      </p>
                      {log.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">"{log.notes}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {new Date(log.performed_at).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
