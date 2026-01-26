import { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, AlertCircle, TrendingDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface PresidentNotification {
  id: string;
  title: string;
  message: string;
  severity: string;
  related_module: string;
  created_at: string;
  is_read: boolean;
}

export default function PresidentNotificationBell() {
  const { profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<PresidentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.id && profile?.role === 'president') {
      loadNotifications();

      const interval = setInterval(() => {
        loadNotifications();
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [profile?.id, profile?.role]);

  const loadNotifications = async () => {
    if (!profile?.id || profile?.role !== 'president') return;

    try {
      const { data, error } = await supabase
        .from('president_notifications')
        .select('*')
        .eq('president_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading president notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('president_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);

      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;

      await supabase
        .from('president_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <TrendingDown className="w-4 h-4 text-yellow-600" />;
      default:
        return <Bell className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'high':
        return 'bg-orange-50 border-orange-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  if (profile?.role !== 'president') return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-amber-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowNotifications(false)}
          ></div>

          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Kritik Bildirimler</h3>
                <p className="text-xs text-slate-500">{unreadCount} okunmamış bildirim</p>
              </div>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Tümünü Okundu İşaretle
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">Henüz bildirim yok</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-amber-50/30' : ''
                      }`}
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${getSeverityColor(notification.severity)}`}>
                          {getSeverityIcon(notification.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(notification.severity)}`}>
                              {notification.severity === 'critical' ? 'Kritik' :
                                notification.severity === 'high' ? 'Yüksek' :
                                  notification.severity === 'medium' ? 'Orta' : 'Düşük'}
                            </span>
                            <span className="text-xs text-slate-500">{notification.related_module}</span>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(notification.created_at).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
