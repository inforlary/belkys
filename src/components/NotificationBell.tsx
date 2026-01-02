import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  category: string;
  is_read: boolean;
  created_at: string;
  action_url: string | null;
}

export default function NotificationBell() {
  const { profile } = useAuth();
  const { navigate } = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [profile?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    try {
      const { data: count } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: profile.id
      });

      setUnreadCount(count || 0);

      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, notification_type, category, is_read, created_at, action_url')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await supabase.rpc('mark_notification_as_read', {
        p_notification_id: notificationId,
        p_user_id: profile?.id
      });

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await supabase.rpc('mark_notification_as_read', {
          p_notification_id: notification.id,
          p_user_id: profile?.id
        });

        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    }

    setIsOpen(false);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Az önce';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}d`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}s`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}g`;
    return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'budget':
        return 'bg-green-100 text-green-800';
      case 'performance':
        return 'bg-blue-100 text-blue-800';
      case 'ic':
        return 'bg-purple-100 text-purple-800';
      case 'risk':
        return 'bg-red-100 text-red-800';
      case 'collaboration':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!profile) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Bildirimler"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Bildirimler</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                {unreadCount} yeni
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Bildirim yok</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></span>
                          )}
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 mb-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(notification.category)}`}>
                            {notification.category === 'budget' ? 'Bütçe' :
                             notification.category === 'performance' ? 'Performans' :
                             notification.category === 'ic' ? 'İç Kontrol' :
                             notification.category === 'risk' ? 'Risk' :
                             notification.category === 'collaboration' ? 'İş Birliği' : 'Genel'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getTimeAgo(notification.created_at)}
                          </span>
                        </div>
                      </div>
                      {!notification.is_read && (
                        <button
                          onClick={(e) => markAsRead(notification.id, e)}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                          title="Okundu işaretle"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200">
            <button
              onClick={() => {
                navigate('notification-center');
                setIsOpen(false);
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Tümünü Görüntüle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
