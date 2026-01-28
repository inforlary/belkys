import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, X, Eye, CheckCircle2 } from 'lucide-react';
import { useLocation } from '../hooks/useLocation';

interface Notification {
  id: string;
  action_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_by: string[];
  sent_at: string;
}

export default function ICActionNotificationBell() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
      const subscription = subscribeToNotifications();
      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [profile?.id]);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ic_action_notifications')
        .select('*')
        .contains('recipient_ids', [profile.id])
        .order('sent_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);

      const unread = (data || []).filter(
        n => !n.read_by || !n.read_by.includes(profile.id)
      );
      setUnreadCount(unread.length);
    } catch (error) {
      console.error('Bildirimler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    return supabase
      .channel('ic_action_notifications_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ic_action_notifications',
          filter: `recipient_ids=cs.{${profile?.id}}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();
  };

  const markAsRead = async (notificationId: string) => {
    if (!profile?.id) return;

    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) return;

      const updatedReadBy = Array.from(new Set([...(notification.read_by || []), profile.id]));

      const { error } = await supabase
        .from('ic_action_notifications')
        .update({
          read_by: updatedReadBy,
          is_read: true
        })
        .eq('id', notificationId);

      if (error) throw error;

      loadNotifications();
    } catch (error) {
      console.error('Bildirim okundu işaretlenirken hata:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!profile?.id) return;

    try {
      const unreadNotifications = notifications.filter(
        n => !n.read_by || !n.read_by.includes(profile.id)
      );

      for (const notification of unreadNotifications) {
        const updatedReadBy = Array.from(new Set([...(notification.read_by || []), profile.id]));

        await supabase
          .from('ic_action_notifications')
          .update({
            read_by: updatedReadBy,
            is_read: true
          })
          .eq('id', notification.id);
      }

      loadNotifications();
    } catch (error) {
      console.error('Tüm bildirimler okundu işaretlenirken hata:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    navigate(`/ic-action-detail/${notification.action_id}`);
  };

  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, { icon: any; color: string }> = {
      hatirlatma_30: { icon: Bell, color: 'text-blue-500' },
      hatirlatma_7: { icon: Bell, color: 'text-yellow-500' },
      gecikme: { icon: Bell, color: 'text-red-500' },
      onay_talebi: { icon: Bell, color: 'text-purple-500' },
      onay_sonuc: { icon: CheckCircle2, color: 'text-green-500' },
      red_sonuc: { icon: X, color: 'text-red-500' }
    };
    return iconMap[type] || { icon: Bell, color: 'text-gray-500' };
  };

  const isNotificationRead = (notification: Notification) => {
    return notification.read_by && notification.read_by.includes(profile?.id || '');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg z-40 border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Bildirimler</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Tümünü okundu işaretle
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Yükleniyor...</div>
              ) : notifications.length > 0 ? (
                notifications.map((notification) => {
                  const { icon: Icon, color } = getNotificationIcon(notification.notification_type);
                  const read = isNotificationRead(notification);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        !read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!read ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.sent_at).toLocaleString('tr-TR')}
                          </p>
                        </div>
                        {!read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500">
                  Henüz bildiriminiz bulunmamaktadır.
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 text-center">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/notification-center');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Tüm Bildirimleri Gör
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
