import { useState, useEffect } from 'react';
import { Crown, TrendingUp, Calendar, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StrategicPlanSummaryCard from '../components/dashboard/StrategicPlanSummaryCard';
import RiskManagementSummaryCard from '../components/dashboard/RiskManagementSummaryCard';
import InternalControlSummaryCard from '../components/dashboard/InternalControlSummaryCard';
import ProjectManagementSummaryCard from '../components/dashboard/ProjectManagementSummaryCard';
import ActivityReportSummaryCard from '../components/dashboard/ActivityReportSummaryCard';
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

export default function PresidentDashboard() {
  const { profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('current_year');
  const [notifications, setNotifications] = useState<PresidentNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadPresidentNotifications();
    }
  }, [profile?.id]);

  const loadPresidentNotifications = async () => {
    if (!profile?.id) return;

    try {
      setLoadingNotifications(true);

      const { data, error } = await supabase
        .from('president_notifications')
        .select('*')
        .eq('president_id', profile.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading president notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('president_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'high':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
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

  const currentYear = new Date().getFullYear();
  const periods = [
    { value: 'current_year', label: `${currentYear} Yılı` },
    { value: 'last_year', label: `${currentYear - 1} Yılı` },
    { value: 'current_quarter', label: 'Bu Çeyrek' },
    { value: 'last_quarter', label: 'Geçen Çeyrek' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <Crown className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Başkan Dashboard</h1>
              <p className="text-amber-100 mt-1 flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Sadece Görüntüleme Modu
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-amber-100 text-sm">Hoş Geldiniz</p>
              <p className="text-white font-semibold">{profile?.full_name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-slate-600" />
          <span className="text-sm text-slate-600">Dönem Seçimi:</span>
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        >
          {periods.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      </div>

      {!loadingNotifications && notifications.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-amber-600" />
            Kritik Bildirimler
          </h3>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${getSeverityColor(notification.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(notification.severity)}`}>
                        {notification.severity === 'critical' ? 'Kritik' :
                          notification.severity === 'high' ? 'Yüksek' :
                            notification.severity === 'medium' ? 'Orta' : 'Düşük'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {notification.related_module}
                      </span>
                    </div>
                    <h4 className="font-semibold mb-1">{notification.title}</h4>
                    <p className="text-sm">{notification.message}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(notification.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => markNotificationAsRead(notification.id)}
                    className="ml-4 text-sm text-slate-500 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StrategicPlanSummaryCard />
        <RiskManagementSummaryCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InternalControlSummaryCard />
        <ProjectManagementSummaryCard />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ActivityReportSummaryCard />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Eye className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-900 mb-1">
              Sadece Görüntüleme Modu
            </h4>
            <p className="text-sm text-amber-700">
              Başkan olarak tüm verileri görüntüleyebilirsiniz ancak herhangi bir değişiklik yapamazsınız.
              Detaylı raporlara erişmek için yan menüden "Raporlar" bölümlerini kullanabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
