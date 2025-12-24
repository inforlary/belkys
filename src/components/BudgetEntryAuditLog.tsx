import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardBody } from './ui/Card';
import { History, User, Clock, FileEdit } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  changed_by: string;
  changed_at: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  change_reason?: string;
  user?: {
    full_name: string;
    email: string;
  };
}

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

interface BudgetEntryAuditLogProps {
  entryType: 'expense' | 'revenue';
  entryId: string;
}

export default function BudgetEntryAuditLog({ entryType, entryId }: BudgetEntryAuditLogProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (entryId) {
      loadAuditData();
    }
  }, [entryId, entryType]);

  const loadAuditData = async () => {
    try {
      setLoading(true);

      const { data: logs } = await supabase
        .from('budget_entry_audit_log')
        .select(`
          *,
          user:profiles!changed_by(full_name, email)
        `)
        .eq('entry_type', entryType)
        .eq('entry_id', entryId)
        .order('changed_at', { ascending: false });

      const { data: commentData } = await supabase
        .from('budget_entry_comments')
        .select(`
          *,
          user:profiles!user_id(full_name, email)
        `)
        .eq('entry_type', entryType)
        .eq('entry_id', entryId)
        .order('created_at', { ascending: false });

      if (logs) setAuditLogs(logs);
      if (commentData) setComments(commentData);
    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      created: 'Oluşturuldu',
      updated: 'Güncellendi',
      status_changed: 'Durum Değişti',
      approved: 'Onaylandı',
      rejected: 'Reddedildi',
      posted: 'Muhasebeleştirildi',
      deleted: 'Silindi'
    };
    return labels[action] || action;
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      status: 'Durum',
      description: 'Açıklama',
      program_id: 'Program',
      sub_program_id: 'Alt Program',
      activity_id: 'Faaliyet',
      institutional_code_id: 'Kurumsal Kod',
      expense_economic_code_id: 'Ekonomik Kod',
      revenue_economic_code_id: 'Gelir Ekonomik Kodu',
      financing_type_id: 'Finansman Türü'
    };
    return labels[field] || field;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Yorumlar</h3>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-sm text-blue-900">
                        {comment.user?.full_name || 'Bilinmeyen Kullanıcı'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-700">
                      <Clock className="w-3 h-3" />
                      {formatDate(comment.created_at)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{comment.comment}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Değişiklik Geçmişi</h3>
          </div>
        </CardHeader>
        <CardBody>
          {auditLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz değişiklik kaydı bulunmuyor
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-sm">
                        {log.user?.full_name || 'Sistem'}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                        {getActionLabel(log.action)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock className="w-3 h-3" />
                      {formatDate(log.changed_at)}
                    </div>
                  </div>

                  {log.field_name && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium text-gray-700">{getFieldLabel(log.field_name)}:</span>
                      <div className="flex items-center gap-2 mt-1">
                        {log.old_value && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                            {log.old_value}
                          </span>
                        )}
                        {log.old_value && log.new_value && (
                          <span className="text-gray-400">→</span>
                        )}
                        {log.new_value && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            {log.new_value}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {log.change_reason && (
                    <div className="mt-2 text-xs text-gray-600 italic">
                      Sebep: {log.change_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
