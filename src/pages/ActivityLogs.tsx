import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  Activity,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  LogIn,
  LogOut,
  Plus,
  Edit,
  Trash2,
  FileText,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_email: string;
  user_name: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  changes_summary: string | null;
  severity: string;
  status: string;
  error_message: string | null;
  ip_address: string | null;
  department_id: string | null;
  created_at: string;
  old_value: any;
  new_value: any;
  metadata: any;
}

interface UserSession {
  id: string;
  user_email: string;
  user_name: string;
  login_at: string;
  logout_at: string | null;
  last_activity_at: string;
  session_duration: string | null;
  ip_address: string | null;
  is_active: boolean;
}

interface Filters {
  actionType: string;
  entityType: string;
  severity: string;
  status: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

const actionIcons: Record<string, any> = {
  login: LogIn,
  logout: LogOut,
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: Eye,
  approve: CheckCircle,
  reject: XCircle,
  export: Download,
  upload: Upload,
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
};

const statusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800',
};

export default function ActivityLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'sessions'>('logs');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<Filters>({
    actionType: '',
    entityType: '',
    severity: '',
    status: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
  });

  const [stats, setStats] = useState({
    totalLogs: 0,
    criticalLogs: 0,
    failedActions: 0,
    activeSessions: 0,
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile, filters]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      if (activeTab === 'logs') {
        await loadLogs();
      } else {
        await loadSessions();
      }
      await loadStats();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!profile?.organization_id) return;

    let query = supabase
      .from('system_audit_logs')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (filters.actionType) query = query.eq('action_type', filters.actionType);
    if (filters.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters.severity) query = query.eq('severity', filters.severity);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.searchTerm) {
      query = query.or(
        `user_name.ilike.%${filters.searchTerm}%,user_email.ilike.%${filters.searchTerm}%,entity_name.ilike.%${filters.searchTerm}%,changes_summary.ilike.%${filters.searchTerm}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    setLogs(data || []);
  };

  const loadSessions = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('login_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    setSessions(data || []);
  };

  const loadStats = async () => {
    if (!profile?.organization_id) return;

    const [logsCount, criticalCount, failedCount, activeSessionsCount] = await Promise.all([
      supabase
        .from('system_audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id),
      supabase
        .from('system_audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('severity', 'critical'),
      supabase
        .from('system_audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('status', 'failed'),
      supabase
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true),
    ]);

    setStats({
      totalLogs: logsCount.count || 0,
      criticalLogs: criticalCount.count || 0,
      failedActions: failedCount.count || 0,
      activeSessions: activeSessionsCount.count || 0,
    });
  };

  const exportLogs = async () => {
    const csv = generateCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  const generateCSV = (data: AuditLog[]) => {
    const headers = [
      'Tarih',
      'Kullanıcı',
      'E-posta',
      'İşlem',
      'Modül',
      'Varlık',
      'Özet',
      'Durum',
      'Önem',
      'IP Adresi',
    ];

    const rows = data.map((log) => [
      new Date(log.created_at).toLocaleString('tr-TR'),
      log.user_name || '-',
      log.user_email || '-',
      log.action_type,
      log.entity_type,
      log.entity_name || '-',
      log.changes_summary || '-',
      log.status,
      log.severity,
      log.ip_address || '-',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  };

  const viewLogDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatDuration = (duration: string | null) => {
    if (!duration) return '-';
    const match = duration.match(/(\d+):(\d+):(\d+)/);
    if (!match) return duration;
    const [, hours, minutes] = match;
    return `${hours}s ${minutes}d`;
  };

  const resetFilters = () => {
    setFilters({
      actionType: '',
      entityType: '',
      severity: '',
      status: '',
      userId: '',
      dateFrom: '',
      dateTo: '',
      searchTerm: '',
    });
  };

  if (!profile?.role || !['admin', 'vice_president'].includes(profile.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Erişim Yetkisi Yok</h3>
              <p className="text-gray-600">
                Bu sayfaya sadece yöneticiler erişebilir.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            Aktivite Logları
          </h1>
          <p className="text-gray-600 mt-1">
            Sistem kullanıcı aktivitelerini ve oturumlarını görüntüleyin
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            icon={Filter}
          >
            Filtreler {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
          <Button onClick={exportLogs} icon={Download}>
            Dışa Aktar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Log</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLogs}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Kritik Loglar</p>
                <p className="text-2xl font-bold text-red-600">{stats.criticalLogs}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Başarısız İşlemler</p>
                <p className="text-2xl font-bold text-orange-600">{stats.failedActions}</p>
              </div>
              <XCircle className="w-10 h-10 text-orange-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aktif Oturumlar</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeSessions}</p>
              </div>
              <User className="w-10 h-10 text-green-500" />
            </div>
          </CardBody>
        </Card>
      </div>

      {showFilters && (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arama
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    placeholder="Kullanıcı, modül, işlem..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşlem Tipi
                </label>
                <select
                  value={filters.actionType}
                  onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tümü</option>
                  <option value="login">Giriş</option>
                  <option value="logout">Çıkış</option>
                  <option value="create">Oluştur</option>
                  <option value="update">Güncelle</option>
                  <option value="delete">Sil</option>
                  <option value="view">Görüntüle</option>
                  <option value="approve">Onayla</option>
                  <option value="reject">Reddet</option>
                  <option value="export">Dışa Aktar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Önem Seviyesi
                </label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tümü</option>
                  <option value="info">Bilgi</option>
                  <option value="warning">Uyarı</option>
                  <option value="critical">Kritik</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durum
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tümü</option>
                  <option value="success">Başarılı</option>
                  <option value="failed">Başarısız</option>
                  <option value="partial">Kısmi</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={resetFilters} className="w-full">
                  Filtreleri Temizle
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Aktivite Logları
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'sessions'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Kullanıcı Oturumları
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Yükleniyor...</p>
            </div>
          ) : activeTab === 'logs' ? (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Henüz aktivite kaydı bulunmuyor.</p>
                </div>
              ) : (
                logs.map((log) => {
                  const ActionIcon = actionIcons[log.action_type] || Activity;
                  const isExpanded = expandedLogs.has(log.id);

                  return (
                    <div
                      key={log.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <ActionIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-gray-900">
                                {log.user_name || 'Bilinmeyen Kullanıcı'}
                              </h4>
                              <span className="text-sm text-gray-600">
                                {log.user_email}
                              </span>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  severityColors[log.severity]
                                }`}
                              >
                                {log.severity === 'info'
                                  ? 'Bilgi'
                                  : log.severity === 'warning'
                                  ? 'Uyarı'
                                  : 'Kritik'}
                              </span>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  statusColors[log.status]
                                }`}
                              >
                                {log.status === 'success'
                                  ? 'Başarılı'
                                  : log.status === 'failed'
                                  ? 'Başarısız'
                                  : 'Kısmi'}
                              </span>
                            </div>
                            <p className="text-gray-700 mb-2">
                              <span className="font-medium capitalize">{log.action_type}</span> -{' '}
                              <span className="text-gray-600">{log.entity_type}</span>
                              {log.entity_name && (
                                <span className="text-gray-900"> ({log.entity_name})</span>
                              )}
                            </p>
                            {log.changes_summary && (
                              <p className="text-sm text-gray-600">{log.changes_summary}</p>
                            )}
                            {log.error_message && (
                              <p className="text-sm text-red-600 mt-1">
                                Hata: {log.error_message}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(log.created_at).toLocaleString('tr-TR')}
                              </span>
                              {log.ip_address && (
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  {log.ip_address}
                                </span>
                              )}
                            </div>

                            {isExpanded && (log.old_value || log.new_value || log.metadata) && (
                              <div className="mt-4 p-3 bg-gray-100 rounded-lg space-y-2">
                                {log.old_value && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-700 mb-1">
                                      Önceki Değer:
                                    </p>
                                    <pre className="text-xs text-gray-600 overflow-x-auto">
                                      {JSON.stringify(log.old_value, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.new_value && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-700 mb-1">
                                      Yeni Değer:
                                    </p>
                                    <pre className="text-xs text-gray-600 overflow-x-auto">
                                      {JSON.stringify(log.new_value, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.metadata && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-700 mb-1">
                                      Ek Bilgi:
                                    </p>
                                    <pre className="text-xs text-gray-600 overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {(log.old_value || log.new_value || log.metadata) && (
                            <button
                              onClick={() => toggleLogExpansion(log.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => viewLogDetails(log)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Kullanıcı
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Giriş Zamanı
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Çıkış Zamanı
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Süre
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">IP</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Henüz oturum kaydı bulunmuyor.</p>
                      </td>
                    </tr>
                  ) : (
                    sessions.map((session) => (
                      <tr
                        key={session.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{session.user_name}</p>
                            <p className="text-sm text-gray-600">{session.user_email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {new Date(session.login_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {session.logout_at
                            ? new Date(session.logout_at).toLocaleString('tr-TR')
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {formatDuration(session.session_duration)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {session.ip_address || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {session.is_active ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              Sonlandı
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {showDetailsModal && selectedLog && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title="Log Detayları"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Kullanıcı</p>
                <p className="text-gray-900">{selectedLog.user_name}</p>
                <p className="text-sm text-gray-600">{selectedLog.user_email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Tarih/Saat</p>
                <p className="text-gray-900">
                  {new Date(selectedLog.created_at).toLocaleString('tr-TR')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">İşlem</p>
                <p className="text-gray-900 capitalize">{selectedLog.action_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Modül</p>
                <p className="text-gray-900">{selectedLog.entity_type}</p>
              </div>
            </div>

            {selectedLog.entity_name && (
              <div>
                <p className="text-sm font-medium text-gray-700">Varlık Adı</p>
                <p className="text-gray-900">{selectedLog.entity_name}</p>
              </div>
            )}

            {selectedLog.changes_summary && (
              <div>
                <p className="text-sm font-medium text-gray-700">Özet</p>
                <p className="text-gray-900">{selectedLog.changes_summary}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Önem</p>
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                    severityColors[selectedLog.severity]
                  }`}
                >
                  {selectedLog.severity === 'info'
                    ? 'Bilgi'
                    : selectedLog.severity === 'warning'
                    ? 'Uyarı'
                    : 'Kritik'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Durum</p>
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                    statusColors[selectedLog.status]
                  }`}
                >
                  {selectedLog.status === 'success'
                    ? 'Başarılı'
                    : selectedLog.status === 'failed'
                    ? 'Başarısız'
                    : 'Kısmi'}
                </span>
              </div>
            </div>

            {selectedLog.ip_address && (
              <div>
                <p className="text-sm font-medium text-gray-700">IP Adresi</p>
                <p className="text-gray-900">{selectedLog.ip_address}</p>
              </div>
            )}

            {selectedLog.error_message && (
              <div>
                <p className="text-sm font-medium text-red-700">Hata Mesajı</p>
                <p className="text-red-600">{selectedLog.error_message}</p>
              </div>
            )}

            {selectedLog.old_value && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Önceki Değer</p>
                <pre className="p-3 bg-gray-100 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.old_value, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_value && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Yeni Değer</p>
                <pre className="p-3 bg-gray-100 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.new_value, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.metadata && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Ek Bilgi</p>
                <pre className="p-3 bg-gray-100 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
