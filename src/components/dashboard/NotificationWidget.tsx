import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Bell, AlertCircle, CheckCircle, Info, TrendingUp } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

const notificationIcons = {
  reminder: Bell,
  alert: AlertCircle,
  success: CheckCircle,
  info: Info,
  approval_request: TrendingUp
};

const notificationColors = {
  reminder: 'text-blue-600 bg-blue-50',
  alert: 'text-red-600 bg-red-50',
  success: 'text-green-600 bg-green-50',
  info: 'text-gray-600 bg-gray-50',
  approval_request: 'text-yellow-600 bg-yellow-50'
};

export default function NotificationWidget() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) loadNotifications();
  }, [profile]);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Bildirimler</h3>
        </CardHeader>
        <CardBody>
          <div className="text-center py-4 text-gray-500">Yükleniyor...</div>
        </CardBody>
      </Card>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Bildirimler</h3>
          {unreadCount > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {unreadCount} Okunmamış
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600">Henüz bildirim bulunmuyor</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notification => {
              const Icon = notificationIcons[notification.type as keyof typeof notificationIcons] || Bell;
              const colorClass = notificationColors[notification.type as keyof typeof notificationColors] || 'text-gray-600 bg-gray-50';

              return (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    notification.is_read
                      ? 'bg-white border-gray-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colorClass.split(' ')[1]}`}>
                      <Icon className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(notification.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
