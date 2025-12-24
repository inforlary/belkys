import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import {
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  MessageSquare,
  TrendingUp,
  Settings,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';

interface ReportStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  overdue: number;
}

interface Department {
  id: string;
  name: string;
  _count: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
}

interface Deadline {
  id: string;
  period_type: string;
  period_year: number;
  period_quarter?: number;
  period_month?: number;
  deadline_date: string;
  department: { name: string } | null;
}

interface Template {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export default function ReportManagement() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'deadlines' | 'templates' | 'workflow'>('overview');
  const [stats, setStats] = useState<ReportStats>({
    total: 0,
    draft: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    overdue: 0,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [deadlineForm, setDeadlineForm] = useState({
    period_type: 'yearly',
    period_year: new Date().getFullYear(),
    period_quarter: null as number | null,
    period_month: null as number | null,
    deadline_date: '',
    reminder_days_before: 7,
    department_id: null as string | null,
  });

  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    sections: [] as { title: string; required: boolean }[],
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);

    const { data: reports } = await supabase
      .from('activity_reports')
      .select('id, status, created_at, department_id')
      .eq('organization_id', profile.organization_id);

    if (reports) {
      const today = new Date();
      setStats({
        total: reports.length,
        draft: reports.filter(r => r.status === 'draft').length,
        submitted: reports.filter(r => r.status === 'submitted').length,
        approved: reports.filter(r => r.status === 'approved').length,
        rejected: reports.filter(r => r.status === 'rejected').length,
        overdue: reports.filter(r => {
          return r.status === 'draft' &&
            new Date(r.created_at) < new Date(today.setDate(today.getDate() - 30));
        }).length,
      });
    }

    const { data: deptData } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', profile.organization_id);

    if (deptData && reports) {
      const deptStats = deptData.map(dept => ({
        ...dept,
        _count: {
          draft: reports.filter(r => r.department_id === dept.id && r.status === 'draft').length,
          submitted: reports.filter(r => r.department_id === dept.id && r.status === 'submitted').length,
          approved: reports.filter(r => r.department_id === dept.id && r.status === 'approved').length,
          rejected: reports.filter(r => r.department_id === dept.id && r.status === 'rejected').length,
        }
      }));
      setDepartments(deptStats);
    }

    const { data: deadlineData } = await supabase
      .from('activity_report_deadlines')
      .select(`
        id,
        period_type,
        period_year,
        period_quarter,
        period_month,
        deadline_date,
        department:departments(name)
      `)
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('deadline_date', { ascending: true });

    if (deadlineData) {
      setDeadlines(deadlineData as any);
    }

    const { data: templateData } = await supabase
      .from('activity_report_templates')
      .select('id, name, description, is_active, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (templateData) {
      setTemplates(templateData);
    }

    setLoading(false);
  };

  const handleCreateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    const { error } = await supabase
      .from('activity_report_deadlines')
      .insert([{
        ...deadlineForm,
        organization_id: profile.organization_id,
        created_by: profile.id,
      }]);

    if (!error) {
      setShowDeadlineModal(false);
      loadData();
      setDeadlineForm({
        period_type: 'yearly',
        period_year: new Date().getFullYear(),
        period_quarter: null,
        period_month: null,
        deadline_date: '',
        reminder_days_before: 7,
        department_id: null,
      });
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    const { error } = await supabase
      .from('activity_report_templates')
      .insert([{
        ...templateForm,
        sections: JSON.stringify(templateForm.sections),
        organization_id: profile.organization_id,
        created_by: profile.id,
      }]);

    if (!error) {
      setShowTemplateModal(false);
      loadData();
      setTemplateForm({
        name: '',
        description: '',
        sections: [],
      });
    }
  };

  const handleDeleteDeadline = async (id: string) => {
    if (!confirm('Son tarihi silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase
      .from('activity_report_deadlines')
      .delete()
      .eq('id', id);

    if (!error) {
      loadData();
    }
  };

  const handleToggleTemplate = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('activity_report_templates')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (!error) {
      loadData();
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Rapor Yönetimi</h1>
        <p className="mt-1 text-sm text-gray-500">
          Faaliyet raporlarını yönetin, son tarihler belirleyin ve şablonlar oluşturun
        </p>
      </div>

      <div className="flex space-x-2 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Genel Bakış
        </button>
        <button
          onClick={() => setActiveTab('deadlines')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'deadlines'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Son Tarihler
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'templates'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Şablonlar
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'workflow'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          İş Akışı
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Toplam</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Taslak</p>
                    <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
                  </div>
                  <Edit2 className="h-8 w-8 text-gray-400" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Gönderildi</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Onaylandı</p>
                    <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Reddedildi</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Gecikmiş</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.overdue}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-400" />
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold mb-4">Müdürlük Bazlı Durum</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Müdürlük
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Taslak
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Gönderildi
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Onaylandı
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Reddedildi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {departments.map((dept) => (
                      <tr key={dept.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {dept.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {dept._count.draft}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-blue-600">
                          {dept._count.submitted}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-green-600">
                          {dept._count.approved}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-red-600">
                          {dept._count.rejected}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'deadlines' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowDeadlineModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Son Tarih
            </Button>
          </div>

          <Card>
            <CardBody>
              <div className="space-y-3">
                {deadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {deadline.period_type === 'yearly' && `${deadline.period_year} Yılı`}
                        {deadline.period_type === 'quarterly' && `${deadline.period_year} - Q${deadline.period_quarter}`}
                        {deadline.period_type === 'monthly' && `${deadline.period_year}/${deadline.period_month}`}
                      </p>
                      <p className="text-sm text-gray-600">
                        {deadline.department ? deadline.department.name : 'Tüm Müdürlükler'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Son Tarih: {new Date(deadline.deadline_date).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDeadline(deadline.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
                {deadlines.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Henüz son tarih belirlenmemiş</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowTemplateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Şablon
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardBody>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    <button
                      onClick={() => handleToggleTemplate(template.id, template.is_active)}
                      className={`px-2 py-1 rounded text-xs ${
                        template.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {template.is_active ? 'Aktif' : 'Pasif'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{template.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(template.created_at).toLocaleDateString('tr-TR')}
                  </p>
                </CardBody>
              </Card>
            ))}
            {templates.length === 0 && (
              <p className="col-span-3 text-center text-gray-500 py-8">Henüz şablon oluşturulmamış</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'workflow' && (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">İş akışı yönetimi yakında eklenecek</p>
            </div>
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={showDeadlineModal}
        onClose={() => setShowDeadlineModal(false)}
        title="Yeni Son Tarih Belirle"
      >
        <form onSubmit={handleCreateDeadline} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dönem Tipi
            </label>
            <select
              value={deadlineForm.period_type}
              onChange={(e) => setDeadlineForm({ ...deadlineForm, period_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="yearly">Yıllık</option>
              <option value="quarterly">Çeyreklik</option>
              <option value="monthly">Aylık</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yıl
            </label>
            <input
              type="number"
              value={deadlineForm.period_year}
              onChange={(e) => setDeadlineForm({ ...deadlineForm, period_year: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Son Tarih
            </label>
            <input
              type="date"
              value={deadlineForm.deadline_date}
              onChange={(e) => setDeadlineForm({ ...deadlineForm, deadline_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hatırlatma (Gün Önce)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={deadlineForm.reminder_days_before}
              onChange={(e) => setDeadlineForm({ ...deadlineForm, reminder_days_before: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowDeadlineModal(false)}>
              İptal
            </Button>
            <Button type="submit">Oluştur</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Yeni Şablon Oluştur"
      >
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Şablon Adı
            </label>
            <input
              type="text"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={templateForm.description}
              onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowTemplateModal(false)}>
              İptal
            </Button>
            <Button type="submit">Oluştur</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
