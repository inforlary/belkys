import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Bell, Plus, Edit2, Trash2, Clock, CheckCircle, AlertCircle, Play, Pause } from 'lucide-react';

interface ReminderRule {
  id: string;
  name: string;
  reminder_type: string;
  entity_type: string;
  trigger_before_days: number;
  trigger_time: string;
  is_active: boolean;
  message_template: string;
}

interface ScheduledReminder {
  id: string;
  entity_type: string;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  metadata: any;
  recipient?: {
    full_name: string;
    email: string;
  };
  rule?: {
    name: string;
  };
}

export default function RemindersManagement() {
  const { profile } = useAuth();
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [scheduledReminders, setScheduledReminders] = useState<ScheduledReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
  const [stats, setStats] = useState({
    totalRules: 0,
    activeRules: 0,
    pendingReminders: 0,
    sentToday: 0
  });

  const [formData, setFormData] = useState({
    name: '',
    reminder_type: 'deadline',
    entity_type: 'activity',
    trigger_before_days: 1,
    trigger_time: '09:00',
    message_template: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    try {
      await Promise.all([loadRules(), loadScheduledReminders(), loadStats()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('reminder_rules')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading rules:', error);
      return;
    }

    setRules(data || []);
  };

  const loadScheduledReminders = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('scheduled_reminders')
      .select(`
        *,
        recipient:profiles(full_name, email),
        rule:reminder_rules(name)
      `)
      .eq('organization_id', profile.organization_id)
      .order('scheduled_for', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading scheduled reminders:', error);
      return;
    }

    setScheduledReminders(data || []);
  };

  const loadStats = async () => {
    if (!profile?.organization_id) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRes, activeRes, pendingRes, sentRes] = await Promise.all([
      supabase.from('reminder_rules').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
      supabase.from('reminder_rules').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('is_active', true),
      supabase.from('scheduled_reminders').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('status', 'pending'),
      supabase.from('scheduled_reminders').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('status', 'sent').gte('sent_at', today.toISOString())
    ]);

    setStats({
      totalRules: totalRes.count || 0,
      activeRules: activeRes.count || 0,
      pendingReminders: pendingRes.count || 0,
      sentToday: sentRes.count || 0
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('reminder_rules')
          .update({
            name: formData.name,
            reminder_type: formData.reminder_type,
            entity_type: formData.entity_type,
            trigger_before_days: formData.trigger_before_days,
            trigger_time: formData.trigger_time,
            message_template: formData.message_template
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        alert('Hatırlatma kuralı güncellendi!');
      } else {
        const { error } = await supabase.from('reminder_rules').insert({
          organization_id: profile.organization_id,
          created_by: profile.id,
          ...formData
        });

        if (error) throw error;
        alert('Hatırlatma kuralı oluşturuldu!');
      }

      setShowRuleModal(false);
      setEditingRule(null);
      setFormData({
        name: '',
        reminder_type: 'deadline',
        entity_type: 'activity',
        trigger_before_days: 1,
        trigger_time: '09:00',
        message_template: ''
      });
      loadData();
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Kural kaydedilirken bir hata oluştu.');
    }
  };

  const handleToggleActive = async (rule: ReminderRule) => {
    try {
      const { error } = await supabase
        .from('reminder_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const handleDelete = async (rule: ReminderRule) => {
    if (!confirm(`"${rule.name}" kuralını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('reminder_rules')
        .delete()
        .eq('id', rule.id);

      if (error) throw error;
      loadData();
      alert('Kural silindi.');
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Kural silinirken bir hata oluştu.');
    }
  };

  const handleEdit = (rule: ReminderRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      reminder_type: rule.reminder_type,
      entity_type: rule.entity_type,
      trigger_before_days: rule.trigger_before_days,
      trigger_time: rule.trigger_time,
      message_template: rule.message_template
    });
    setShowRuleModal(true);
  };

  const handleGenerateReminders = async () => {
    try {
      await supabase.rpc('generate_activity_deadline_reminders');
      await supabase.rpc('generate_data_entry_reminders');
      await supabase.rpc('check_overdue_items');

      alert('Hatırlatmalar oluşturuldu!');
      loadData();
    } catch (error) {
      console.error('Error generating reminders:', error);
      alert('Hatırlatmalar oluşturulurken bir hata oluştu.');
    }
  };

  const handleSendReminders = async () => {
    try {
      const { data } = await supabase.rpc('send_pending_reminders');
      alert(`${data || 0} hatırlatma gönderildi!`);
      loadData();
    } catch (error) {
      console.error('Error sending reminders:', error);
      alert('Hatırlatmalar gönderilirken bir hata oluştu.');
    }
  };

  const getReminderTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deadline: 'Deadline',
      data_entry: 'Veri Girişi',
      approval: 'Onay Bekleyen',
      custom: 'Özel'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-8 h-8 text-blue-600" />
            Otomatik Hatırlatmalar
          </h1>
          <p className="text-gray-600 mt-1">Deadline ve veri girişi hatırlatmalarını yönetin</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleGenerateReminders}>
            Hatırlatmaları Oluştur
          </Button>
          <Button variant="outline" onClick={handleSendReminders}>
            Bekleyenleri Gönder
          </Button>
          <Button onClick={() => setShowRuleModal(true)} icon={Plus}>
            Kural Ekle
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Kurallar</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRules}</p>
              </div>
              <Bell className="w-10 h-10 text-blue-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aktif Kurallar</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeRules}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bekleyen</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pendingReminders}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bugün Gönderilen</p>
                <p className="text-2xl font-bold text-blue-900">{stats.sentToday}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-blue-500" />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Hatırlatma Kuralları</h3>
          </CardHeader>
          <CardBody>
            {rules.length === 0 ? (
              <p className="text-center text-gray-600 py-8">Henüz kural eklenmemiş.</p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{rule.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {getReminderTypeLabel(rule.reminder_type)}
                          </span>
                          <span className="text-xs text-gray-600">
                            {rule.trigger_before_days} gün önce, {rule.trigger_time}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className={`p-2 rounded-lg transition-colors ${
                            rule.is_active ? 'text-green-600 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={rule.is_active ? 'Aktif' : 'Pasif'}
                        >
                          {rule.is_active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(rule)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{rule.message_template}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Zamanlanmış Hatırlatmalar</h3>
          </CardHeader>
          <CardBody>
            {scheduledReminders.length === 0 ? (
              <p className="text-center text-gray-600 py-8">Henüz zamanlanmış hatırlatma yok.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scheduledReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="border border-gray-200 rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-gray-900">
                        {reminder.rule?.name || 'Otomatik Hatırlatma'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(reminder.status)}`}>
                        {reminder.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs mb-1">
                      Alıcı: {reminder.recipient?.full_name || 'Bilinmiyor'}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {new Date(reminder.scheduled_for).toLocaleString('tr-TR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {showRuleModal && (
        <Modal
          isOpen={showRuleModal}
          onClose={() => {
            setShowRuleModal(false);
            setEditingRule(null);
            setFormData({
              name: '',
              reminder_type: 'deadline',
              entity_type: 'activity',
              trigger_before_days: 1,
              trigger_time: '09:00',
              message_template: ''
            });
          }}
          title={editingRule ? 'Kuralı Düzenle' : 'Yeni Kural Ekle'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kural Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hatırlatma Tipi
                </label>
                <select
                  value={formData.reminder_type}
                  onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="deadline">Deadline</option>
                  <option value="data_entry">Veri Girişi</option>
                  <option value="approval">Onay Bekleyen</option>
                  <option value="custom">Özel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Varlık Tipi
                </label>
                <select
                  value={formData.entity_type}
                  onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="activity">Faaliyet</option>
                  <option value="indicator">Gösterge</option>
                  <option value="approval">Onay</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kaç Gün Önce
                </label>
                <input
                  type="number"
                  value={formData.trigger_before_days}
                  onChange={(e) => setFormData({ ...formData, trigger_before_days: parseInt(e.target.value) })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gönderim Saati
                </label>
                <input
                  type="time"
                  value={formData.trigger_time}
                  onChange={(e) => setFormData({ ...formData, trigger_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mesaj Şablonu <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.message_template}
                onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                required
                rows={3}
                placeholder="Örn: {{activity_title}} faaliyeti {{end_date}} tarihinde sona eriyor."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Değişkenler: activity_title, end_date, indicator_name, period_month, vb.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                {editingRule ? 'Güncelle' : 'Oluştur'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRuleModal(false)}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
