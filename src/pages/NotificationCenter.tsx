import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  Trash2,
  Filter,
  AlertCircle,
  Info,
  Clock,
  Mail,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';

interface Notification {
  id: string;
  notification_type: string;
  priority: string;
  category: string;
  title: string;
  message: string;
  action_url: string | null;
  action_label: string | null;
  related_entity_type: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  notify_approval_requests: boolean;
  notify_deadlines: boolean;
  notify_mentions: boolean;
  notify_reports: boolean;
  notify_system_alerts: boolean;
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const typeIcons: Record<string, any> = {
  approval: CheckCheck,
  alert: AlertCircle,
  info: Info,
  warning: AlertCircle,
  error: AlertCircle,
  reminder: Clock,
  success: Check,
};

export default function NotificationCenter() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_enabled: true,
    push_enabled: true,
    notify_approval_requests: true,
    notify_deadlines: true,
    notify_mentions: true,
    notify_reports: true,
    notify_system_alerts: true,
  });

  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
  });

  useEffect(() => {
    if (profile) {
      loadNotifications();
      loadPreferences();
    }
  }, [profile, filter]);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query.limit(200);

      if (error) throw error;
      setNotifications(data || []);

      const [totalCount, unreadCount] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('is_read', false),
      ]);

      setStats({
        total: totalCount.count || 0,
        unread: unreadCount.count || 0,
      });
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_notification_preferences');

      if (error) throw error;
      if (data) {
        setPreferences({
          email_enabled: data.email_enabled,
          push_enabled: data.push_enabled,
          notify_approval_requests: data.notify_approval_requests,
          notify_deadlines: data.notify_deadlines,
          notify_mentions: data.notify_mentions,
          notify_reports: data.notify_reports,
          notify_system_alerts: data.notify_system_alerts,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.rpc('mark_notification_as_read', {
        p_notification_id: notificationId,
        p_user_id: profile?.id
      });
      loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase.rpc('mark_all_notifications_as_read', {
        p_user_id: profile?.id
      });
      loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!confirm('Bu bildirimi kalıcı olarak silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const savePreferences = async () => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: profile.id,
          organization_id: profile.organization_id,
          ...preferences,
        });

      if (error) throw error;
      setShowSettings(false);
      alert('Tercihleriniz kaydedildi.');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Tercihler kaydedilirken bir hata oluştu.');
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Az önce';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika önce`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat önce`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-8 h-8 text-blue-600" />
            Bildirim Merkezi
          </h1>
          <p className="text-gray-600 mt-1">Tüm bildirimlerinizi buradan yönetin</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowSettings(true)}
            icon={SettingsIcon}
          >
            Tercihler
          </Button>
          {stats.unread > 0 && (
            <Button onClick={markAllAsRead} icon={CheckCheck}>
              Tümünü Okundu İşaretle
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Bildirim</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Bell className="w-10 h-10 text-blue-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Okunmamış</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unread}</p>
              </div>
              <Mail className="w-10 h-10 text-orange-500" />
            </div>
          </CardBody>
        </Card>

      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tümü ({stats.total})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Okunmamış ({stats.unread})
            </button>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Yükleniyor...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {filter === 'unread'
                  ? 'Okunmamış bildiriminiz yok.'
                  : 'Henüz bildiriminiz yok.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const TypeIcon = typeIcons[notification.notification_type] || Info;

                return (
                  <div
                    key={notification.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      notification.is_read
                        ? 'bg-white border-gray-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          notification.is_read ? 'bg-gray-100' : 'bg-blue-100'
                        }`}
                      >
                        <TypeIcon
                          className={`w-5 h-5 ${
                            notification.is_read ? 'text-gray-600' : 'text-blue-600'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4
                                className={`font-semibold ${
                                  notification.is_read
                                    ? 'text-gray-900'
                                    : 'text-blue-900'
                                }`}
                              >
                                {notification.title}
                              </h4>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  priorityColors[notification.priority]
                                }`}
                              >
                                {notification.priority === 'low'
                                  ? 'Düşük'
                                  : notification.priority === 'medium'
                                  ? 'Orta'
                                  : notification.priority === 'high'
                                  ? 'Yüksek'
                                  : 'Acil'}
                              </span>
                            </div>
                            <p className="text-gray-700 text-sm mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500">
                              {getTimeAgo(notification.created_at)}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            {!notification.is_read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Okundu olarak işaretle"
                              >
                                <Check className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {notification.action_url && notification.action_label && (
                          <button
                            onClick={() => (window.location.hash = notification.action_url!)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {notification.action_label} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {showSettings && (
        <Modal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          title="Bildirim Tercihleri"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Genel Ayarlar
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">E-posta Bildirimleri</span>
                  <input
                    type="checkbox"
                    checked={preferences.email_enabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, email_enabled: e.target.checked })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Push Bildirimleri</span>
                  <input
                    type="checkbox"
                    checked={preferences.push_enabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, push_enabled: e.target.checked })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Bildirim Türleri
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Onay İstekleri</span>
                  <input
                    type="checkbox"
                    checked={preferences.notify_approval_requests}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        notify_approval_requests: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Deadline Hatırlatmaları</span>
                  <input
                    type="checkbox"
                    checked={preferences.notify_deadlines}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        notify_deadlines: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Bahsetmeler</span>
                  <input
                    type="checkbox"
                    checked={preferences.notify_mentions}
                    onChange={(e) =>
                      setPreferences({ ...preferences, notify_mentions: e.target.checked })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Rapor Bildirimleri</span>
                  <input
                    type="checkbox"
                    checked={preferences.notify_reports}
                    onChange={(e) =>
                      setPreferences({ ...preferences, notify_reports: e.target.checked })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Sistem Uyarıları</span>
                  <input
                    type="checkbox"
                    checked={preferences.notify_system_alerts}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        notify_system_alerts: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={savePreferences} className="flex-1">
                Kaydet
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
