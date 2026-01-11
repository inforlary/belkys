import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Search,
  Filter,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  BookOpen,
  Target
} from 'lucide-react';
import Modal from '../components/ui/Modal';

interface Component {
  id: string;
  code: string;
  name: string;
  order_index: number;
  color?: string;
  icon?: string;
}

interface Standard {
  id: string;
  component_id: string;
  code: string;
  name: string;
  description: string;
  order_index: number;
}

interface GeneralCondition {
  id: string;
  standard_id: string;
  code: string;
  description: string;
  order_index: number;
  action_count?: number;
}

interface Action {
  id: string;
  code: string;
  title: string;
  status: string;
  start_date: string;
  target_date: string;
  responsible_department_id: string;
  sub_standard_id: string;
  main_standard_id: string;
  created_at: string;
  progress_percent?: number;
  departments?: {
    name: string;
  };
  ic_standards?: {
    code: string;
    name: string;
  };
}

export default function ICActions() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'standards' | 'actions'>('standards');
  const [loading, setLoading] = useState(true);

  const [components, setComponents] = useState<Component[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [conditions, setConditions] = useState<GeneralCondition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'active' | 'overdue' | 'upcoming'>('all');

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<GeneralCondition | null>(null);
  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    responsible_department_id: '',
    start_date: '',
    target_date: '',
    priority: 'MEDIUM'
  });
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const orgId = profile?.organization_id;

      const [componentsRes, standardsRes, conditionsRes, actionsRes, depsRes] = await Promise.all([
        supabase
          .from('ic_components')
          .select('*')
          .order('order_index'),
        supabase
          .from('ic_standards')
          .select('*')
          .order('order_index'),
        supabase
          .from('ic_general_conditions')
          .select('*')
          .order('order_index'),
        supabase
          .from('ic_actions')
          .select(`
            *,
            departments(name),
            ic_standards(code, name)
          `)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', orgId)
          .order('name')
      ]);

      if (componentsRes.error) throw componentsRes.error;
      if (standardsRes.error) throw standardsRes.error;
      if (conditionsRes.error) throw conditionsRes.error;
      if (actionsRes.error) throw actionsRes.error;
      if (depsRes.error) throw depsRes.error;

      setComponents(componentsRes.data || []);
      setStandards(standardsRes.data || []);

      const conditionsWithCount = await Promise.all(
        (conditionsRes.data || []).map(async (condition) => {
          const { count } = await supabase
            .from('ic_actions')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .or(`sub_standard_id.eq.${condition.standard_id}`);

          return {
            ...condition,
            action_count: count || 0
          };
        })
      );

      setConditions(conditionsWithCount);
      setActions(actionsRes.data || []);
      setDepartments(depsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComponent = (componentId: string) => {
    const newExpanded = new Set(expandedComponents);
    if (newExpanded.has(componentId)) {
      newExpanded.delete(componentId);
    } else {
      newExpanded.add(componentId);
    }
    setExpandedComponents(newExpanded);
  };

  const toggleStandard = (standardId: string) => {
    const newExpanded = new Set(expandedStandards);
    if (newExpanded.has(standardId)) {
      newExpanded.delete(standardId);
    } else {
      newExpanded.add(standardId);
    }
    setExpandedStandards(newExpanded);
  };

  const handleAddAction = (condition: GeneralCondition) => {
    setSelectedCondition(condition);
    setActionForm({
      title: '',
      description: '',
      responsible_department_id: '',
      start_date: '',
      target_date: '',
      priority: 'MEDIUM'
    });
    setShowActionModal(true);
  };

  const handleSaveAction = async () => {
    if (!selectedCondition || !profile?.organization_id) return;

    try {
      const standard = standards.find(s => s.id === selectedCondition.standard_id);
      if (!standard) return;

      const actionCount = actions.filter(a =>
        a.main_standard_id === standard.id
      ).length;

      const newCode = `${standard.code}.${(actionCount + 1).toString().padStart(2, '0')}`;

      const { error } = await supabase
        .from('ic_actions')
        .insert({
          organization_id: profile.organization_id,
          code: newCode,
          title: actionForm.title,
          description: actionForm.description,
          main_standard_id: standard.id,
          sub_standard_id: selectedCondition.standard_id,
          responsible_department_id: actionForm.responsible_department_id,
          start_date: actionForm.start_date,
          target_date: actionForm.target_date,
          priority: actionForm.priority,
          status: 'PLANLANMADI',
          progress_percent: 0
        });

      if (error) throw error;

      setShowActionModal(false);
      setSelectedCondition(null);
      loadData();
    } catch (error) {
      console.error('Error saving action:', error);
      alert('Eylem kaydedilirken bir hata oluştu');
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'TAMAMLANDI':
        return {
          label: 'Tamamlandı',
          color: 'text-green-700 bg-green-50',
          icon: CheckCircle2
        };
      case 'DEVAM_EDIYOR':
      case 'BASLADI':
        return {
          label: 'Devam Ediyor',
          color: 'text-blue-700 bg-blue-50',
          icon: Clock
        };
      case 'PLANLANMADI':
      case 'BEKLEMEDE':
        return {
          label: 'Beklemede',
          color: 'text-gray-700 bg-gray-50',
          icon: Clock
        };
      default:
        return {
          label: status,
          color: 'text-gray-700 bg-gray-50',
          icon: FileText
        };
    }
  };

  const isOverdue = (targetDate: string, status: string) => {
    if (status === 'TAMAMLANDI') return false;
    const today = new Date();
    const target = new Date(targetDate);
    return target < today;
  };

  const filteredActions = actions.filter(action => {
    const matchesSearch =
      action.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.code?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || action.status === statusFilter;

    const today = new Date();
    const targetDate = new Date(action.target_date);
    const startDate = new Date(action.start_date);
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const matchesDate =
      dateFilter === 'all' ||
      (dateFilter === 'active' && startDate <= today && targetDate >= today) ||
      (dateFilter === 'overdue' && isOverdue(action.target_date, action.status)) ||
      (dateFilter === 'upcoming' && daysUntilStart > 0 && daysUntilStart <= 30);

    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">KİKS Standartları & Eylemler</h1>
        <p className="mt-2 text-gray-600">
          Kamu İç Kontrol Standartları ve ilgili eylem planları
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('standards')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'standards'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <BookOpen className="w-5 h-5" />
            KİKS Standartları
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {conditions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'actions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Target className="w-5 h-5" />
            Tüm Eylemler
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {actions.length}
            </span>
          </button>
        </nav>
      </div>

      {activeTab === 'standards' ? (
        <div className="space-y-4">
          {components.map((component) => {
            const componentStandards = standards.filter(s => s.component_id === component.id);
            const isExpanded = expandedComponents.has(component.id);

            return (
              <div key={component.id} className="bg-white rounded-lg shadow">
                <button
                  onClick={() => toggleComponent(component.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">
                        {component.code} - {component.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {componentStandards.length} standart
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {componentStandards.map((standard) => {
                      const standardConditions = conditions.filter(c => c.standard_id === standard.id);
                      const isStandardExpanded = expandedStandards.has(standard.id);

                      return (
                        <div key={standard.id} className="border-b border-gray-100 last:border-b-0">
                          <button
                            onClick={() => toggleStandard(standard.id)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-3">
                              {isStandardExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400 ml-8" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 ml-8" />
                              )}
                              <div className="text-left">
                                <div className="font-medium text-gray-900">
                                  {standard.code} - {standard.name}
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                  {standard.description}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {standardConditions.length} genel şart
                                </div>
                              </div>
                            </div>
                          </button>

                          {isStandardExpanded && (
                            <div className="bg-gray-50 px-6 py-4 space-y-3">
                              {standardConditions.map((condition) => (
                                <div
                                  key={condition.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          {condition.code}
                                        </span>
                                        {condition.action_count && condition.action_count > 0 && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {condition.action_count} eylem
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-700">
                                        {condition.description}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleAddAction(condition)}
                                      className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Eylem Ekle
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Eylem ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="TAMAMLANDI">Tamamlandı</option>
                <option value="DEVAM_EDIYOR">Devam Ediyor</option>
                <option value="BASLADI">Başladı</option>
                <option value="BEKLEMEDE">Beklemede</option>
                <option value="PLANLANMADI">Planlanmadı</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tüm Tarihler</option>
                <option value="active">Aktif</option>
                <option value="overdue">Gecikmiş</option>
                <option value="upcoming">Yaklaşan (30 gün)</option>
              </select>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Filter className="w-4 h-4" />
                <span>{filteredActions.length} eylem</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kod
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Eylem
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Standart
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Birim
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredActions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Eylem bulunamadı
                      </td>
                    </tr>
                  ) : (
                    filteredActions.map((action) => {
                      const statusInfo = getStatusInfo(action.status);
                      const StatusIcon = statusInfo.icon;
                      const overdue = isOverdue(action.target_date, action.status);

                      return (
                        <tr key={action.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {action.code}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {action.title}
                            </div>
                            {action.progress_percent !== undefined && (
                              <div className="mt-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="bg-blue-600 h-1.5 rounded-full"
                                      style={{ width: `${action.progress_percent}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {action.progress_percent}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {action.ic_standards && (
                              <div className="text-sm text-gray-900">
                                {action.ic_standards.code}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <User className="w-4 h-4 text-gray-400" />
                              {action.departments?.name || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <div>
                                <div className="text-gray-900">
                                  {new Date(action.start_date).toLocaleDateString('tr-TR')}
                                </div>
                                <div className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                  {new Date(action.target_date).toLocaleDateString('tr-TR')}
                                  {overdue && ' (Gecikmiş)'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusInfo.label}
                            </span>
                            {overdue && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-red-700 bg-red-50">
                                  <AlertTriangle className="w-3 h-3" />
                                  Gecikmiş
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setSelectedCondition(null);
        }}
        title="Yeni Eylem Ekle"
      >
        <div className="space-y-4">
          {selectedCondition && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-1">
                {selectedCondition.code}
              </div>
              <div className="text-sm text-blue-700">
                {selectedCondition.description}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Eylem Başlığı *
            </label>
            <input
              type="text"
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Eylemin kısa başlığı"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Eylem detayları"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sorumlu Birim *
            </label>
            <select
              value={actionForm.responsible_department_id}
              onChange={(e) => setActionForm({ ...actionForm, responsible_department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi *
              </label>
              <input
                type="date"
                value={actionForm.start_date}
                onChange={(e) => setActionForm({ ...actionForm, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hedef Tarihi *
              </label>
              <input
                type="date"
                value={actionForm.target_date}
                onChange={(e) => setActionForm({ ...actionForm, target_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Öncelik
            </label>
            <select
              value={actionForm.priority}
              onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="LOW">Düşük</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksek</option>
              <option value="CRITICAL">Kritik</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveAction}
              disabled={!actionForm.title || !actionForm.responsible_department_id || !actionForm.start_date || !actionForm.target_date}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Kaydet
            </button>
            <button
              onClick={() => {
                setShowActionModal(false);
                setSelectedCondition(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
