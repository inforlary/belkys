import { useState, useEffect } from 'react';
import { Activity, Calendar, User, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface ActivityLog {
  id: string;
  super_admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  super_admin?: {
    full_name: string;
    email: string;
  };
}

interface ActivityLogsModalProps {
  organizationId?: string;
  organizationName?: string;
  onClose: () => void;
}

export default function ActivityLogsModal({ organizationId, organizationName, onClose }: ActivityLogsModalProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadLogs();
  }, [organizationId, filter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('super_admin_activity_logs')
        .select(`
          *,
          super_admin:profiles!super_admin_activity_logs_super_admin_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (organizationId) {
        query = query.eq('entity_id', organizationId);
      }

      if (filter !== 'all') {
        query = query.eq('action', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const actions: Record<string, { label: string; color: string }> = {
      create_organization: { label: 'Belediye Oluşturuldu', color: 'text-green-700' },
      update_organization: { label: 'Belediye Güncellendi', color: 'text-blue-700' },
      delete_organization: { label: 'Belediye Silindi', color: 'text-red-700' },
      activate_organization: { label: 'Belediye Aktif Edildi', color: 'text-green-700' },
      deactivate_organization: { label: 'Belediye Devre Dışı Bırakıldı', color: 'text-orange-700' },
      delete_user: { label: 'Kullanıcı Silindi', color: 'text-red-700' },
    };
    return actions[action] || { label: action, color: 'text-gray-700' };
  };

  const formatDetails = (details: any) => {
    if (!details) return null;

    return (
      <div className="mt-2 text-sm space-y-1">
        {details.organizationName && (
          <div className="text-gray-600">
            <span className="font-medium">Belediye:</span> {details.organizationName}
          </div>
        )}
        {details.userEmail && (
          <div className="text-gray-600">
            <span className="font-medium">Kullanıcı:</span> {details.userEmail}
          </div>
        )}
        {details.changes && (
          <div className="text-gray-600">
            <span className="font-medium">Değişiklikler:</span>
            <div className="ml-4 mt-1 space-y-1">
              {Object.entries(details.changes).map(([key, value]: [string, any]) => {
                if (!value) return null;
                return (
                  <div key={key} className="text-xs">
                    <span className="font-medium">{key}:</span> {value.from} → {value.to}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={organizationName ? `${organizationName} - Aktivite Logları` : 'Tüm Aktivite Logları'}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Aktiviteler</option>
            <option value="create_organization">Belediye Oluşturma</option>
            <option value="update_organization">Belediye Güncelleme</option>
            <option value="delete_organization">Belediye Silme</option>
            <option value="activate_organization">Belediye Aktifleştirme</option>
            <option value="deactivate_organization">Belediye Devre Dışı Bırakma</option>
            <option value="delete_user">Kullanıcı Silme</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <Activity className="w-5 h-5" />
            <span className="font-medium">Toplam {logs.length} aktivite kaydı</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Aktivite logları yükleniyor...</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => {
              const actionInfo = getActionLabel(log.action);
              return (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Activity className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </div>
                      {log.super_admin && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <User className="w-4 h-4" />
                          <span>{log.super_admin.full_name} ({log.super_admin.email})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(log.created_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {formatDetails(log.details)}
                    </div>
                  </div>
                </div>
              );
            })}

            {logs.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Henüz aktivite kaydı bulunmuyor</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </Modal>
  );
}
