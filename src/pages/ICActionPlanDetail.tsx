import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';

interface ActionPlan {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Action {
  id: string;
  code: string;
  title: string;
  description: string;
  standard_id: string;
  responsible_department_id: string;
  start_date: string;
  target_date: string;
  completed_date: string | null;
  status: string;
  priority: string;
  progress_percent: number;
  ic_standards?: {
    code: string;
    name: string;
  };
  departments?: {
    name: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface Standard {
  id: string;
  code: string;
  name: string;
}

export default function ICActionPlanDetail() {
  const { profile } = useAuth();
  const navigate = useLocation();
  const planId = window.location.pathname.split('/').pop();

  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActionModal, setShowActionModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [actionForm, setActionForm] = useState({
    standard_id: '',
    title: '',
    description: '',
    responsible_department_id: '',
    start_date: '',
    target_date: '',
    priority: 'MEDIUM'
  });

  useEffect(() => {
    if (profile?.organization_id && planId) {
      loadData();
    }
  }, [profile?.organization_id, planId]);

  const loadData = async () => {
    try {
      const [planRes, actionsRes, departmentsRes, standardsRes] = await Promise.all([
        supabase
          .from('ic_action_plans')
          .select('*')
          .eq('id', planId)
          .single(),
        supabase
          .from('ic_actions')
          .select(`
            *,
            ic_standards(code, name),
            departments(name)
          `)
          .eq('action_plan_id', planId)
          .order('code'),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', profile?.organization_id)
          .order('name'),
        supabase
          .from('ic_standards')
          .select('id, code, name')
          .order('order_index')
      ]);

      if (planRes.error) throw planRes.error;
      if (actionsRes.error) throw actionsRes.error;

      setPlan(planRes.data);
      setActions(actionsRes.data || []);
      setDepartments(departmentsRes.data || []);
      setStandards(standardsRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateActionCode = () => {
    const maxCode = actions.reduce((max, action) => {
      const num = parseInt(action.code.replace('E', ''));
      return num > max ? num : max;
    }, 0);
    return `E${maxCode + 1}`;
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('ic_actions')
        .insert({
          action_plan_id: planId,
          code: generateActionCode(),
          standard_id: actionForm.standard_id,
          title: actionForm.title,
          description: actionForm.description,
          responsible_department_id: actionForm.responsible_department_id,
          start_date: actionForm.start_date,
          target_date: actionForm.target_date,
          priority: actionForm.priority,
          status: 'NOT_STARTED',
          progress_percent: 0
        });

      if (error) throw error;

      setShowActionModal(false);
      setActionForm({
        standard_id: '',
        title: '',
        description: '',
        responsible_department_id: '',
        start_date: '',
        target_date: '',
        priority: 'MEDIUM'
      });
      loadData();
    } catch (error) {
      console.error('Eylem eklenirken hata:', error);
      alert('Eylem eklenirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      NOT_STARTED: 'bg-slate-100 text-slate-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      DELAYED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-slate-100 text-slate-800'
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NOT_STARTED: 'Başlamadı',
      IN_PROGRESS: 'Devam Ediyor',
      COMPLETED: 'Tamamlandı',
      DELAYED: 'Gecikmiş',
      CANCELLED: 'İptal Edildi'
    };
    return labels[status] || status;
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      LOW: 'bg-slate-100 text-slate-700',
      MEDIUM: 'bg-blue-100 text-blue-700',
      HIGH: 'bg-orange-100 text-orange-700',
      CRITICAL: 'bg-red-100 text-red-700'
    };
    return badges[priority] || 'bg-slate-100 text-slate-700';
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      LOW: 'Düşük',
      MEDIUM: 'Orta',
      HIGH: 'Yüksek',
      CRITICAL: 'Kritik'
    };
    return labels[priority] || priority;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Plan bulunamadı</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/internal-control/action-plans')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Eylem Planlarına Dön
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{plan.name}</h1>
              {plan.description && (
                <p className="text-slate-600 mt-2">{plan.description}</p>
              )}
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div>
                  <span className="text-slate-600">Başlangıç: </span>
                  <span className="font-medium text-slate-900">
                    {new Date(plan.start_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Bitiş: </span>
                  <span className="font-medium text-slate-900">
                    {new Date(plan.end_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Eylemler</h2>
        <button
          onClick={() => setShowActionModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Eylem Ekle
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Kod</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Standart</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Eylem</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Sorumlu</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Hedef Tarih</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Öncelik</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {actions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  Henüz eylem eklenmemiş
                </td>
              </tr>
            ) : (
              actions.map((action) => (
                <tr key={action.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {action.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {action.ic_standards?.code}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{action.title}</div>
                    {action.description && (
                      <div className="text-sm text-slate-500 mt-1 line-clamp-2">{action.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {action.departments?.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(action.target_date).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(action.priority)}`}>
                      {getPriorityLabel(action.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(action.status)}`}>
                      {getStatusLabel(action.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title="Yeni Eylem Ekle"
      >
        <form onSubmit={handleSubmitAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Standart <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={actionForm.standard_id}
              onChange={(e) => setActionForm({ ...actionForm, standard_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              {standards.map((standard) => (
                <option key={standard.id} value={standard.id}>
                  {standard.code} - {standard.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Eylem Başlığı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sorumlu Birim <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={actionForm.responsible_department_id}
              onChange={(e) => setActionForm({ ...actionForm, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seçiniz</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={actionForm.start_date}
                onChange={(e) => setActionForm({ ...actionForm, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hedef Bitiş Tarihi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={actionForm.target_date}
                onChange={(e) => setActionForm({ ...actionForm, target_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Öncelik <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={actionForm.priority}
              onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="LOW">Düşük</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksek</option>
              <option value="CRITICAL">Kritik</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowActionModal(false)}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
