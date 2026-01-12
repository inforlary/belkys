import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import {
  FileText,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  Eye,
  ArrowRight,
  ChevronDown,
  Download,
  Filter,
  X,
  Search,
  CheckSquare,
  Square,
  MoreVertical
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Action {
  id: string;
  code: string;
  title: string;
  description: string;
  status: string;
  progress_percent: number;
  target_date: string;
  start_date: string;
  completed_date?: string;
  responsible_department_id: string;
  related_department_ids: string[];
  condition_id: string;
  standard_id: string;
  action_plan_id: string;
  outputs?: string;
  is_continuous?: boolean;
  delay_days?: number;
  condition_code?: string;
  condition_description?: string;
  standard_code?: string;
  standard_name?: string;
  component_code?: string;
  component_name?: string;
  department_name?: string;
  related_departments?: string[];
}

interface ActionPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Component {
  id: string;
  code: string;
  name: string;
}

interface Standard {
  id: string;
  code: string;
  name: string;
  component_id: string;
}

interface Department {
  id: string;
  name: string;
}

interface ProgressEntry {
  id: string;
  report_date: string;
  reported_by_id: string;
  previous_progress: number;
  new_progress: number;
  previous_status: string;
  new_status: string;
  description: string;
  reporter_name?: string;
  created_at: string;
}

export default function ICActions() {
  const { profile } = useAuth();
  const { navigate } = useLocation();

  const [actions, setActions] = useState<Action[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [selectedStandardId, setSelectedStandardId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [sortColumn, setSortColumn] = useState<string>('delay');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressEntry[]>([]);

  const [progressForm, setProgressForm] = useState({
    new_progress: 0,
    new_status: '',
    completed_date: '',
    description: ''
  });

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    responsible_department_id: '',
    related_department_ids: [] as string[],
    outputs: '',
    is_continuous: false,
    start_date: '',
    target_date: '',
    notes: ''
  });

  useEffect(() => {
    if (profile?.organization_id) {
      loadData();
    }
  }, [profile?.organization_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadActionPlans(),
        loadComponents(),
        loadStandards(),
        loadDepartments()
      ]);
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActionPlans = async () => {
    const { data, error } = await supabase
      .from('ic_action_plans')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('start_date', { ascending: false });

    if (error) throw error;

    setActionPlans(data || []);
    const activePlan = data?.find(p => p.status === 'ACTIVE');
    if (activePlan && !selectedPlanId) {
      setSelectedPlanId(activePlan.id);
    }
  };

  const loadComponents = async () => {
    const { data, error } = await supabase
      .from('ic_components')
      .select('*')
      .order('code');

    if (error) throw error;
    setComponents(data || []);
  };

  const loadStandards = async () => {
    const { data, error } = await supabase
      .from('ic_standards')
      .select('*')
      .order('code');

    if (error) throw error;
    setStandards(data || []);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('organization_id', profile?.organization_id)
      .order('name');

    if (error) throw error;
    setDepartments(data || []);
  };

  const loadActions = async () => {
    if (!selectedPlanId) return;

    try {
      const { data: actionsData, error } = await supabase
        .from('ic_actions')
        .select(`
          *,
          ic_general_conditions!ic_actions_condition_id_fkey (
            code,
            description,
            standard_id
          ),
          departments!ic_actions_responsible_department_id_fkey (
            name
          )
        `)
        .eq('action_plan_id', selectedPlanId);

      if (error) throw error;

      const enrichedActions = await Promise.all((actionsData || []).map(async (action) => {
        const condition = action.ic_general_conditions;
        let standard = null;
        let component = null;

        if (condition?.standard_id) {
          const { data: standardData } = await supabase
            .from('ic_standards')
            .select('code, name, component_id')
            .eq('id', condition.standard_id)
            .single();

          standard = standardData;

          if (standardData?.component_id) {
            const { data: componentData } = await supabase
              .from('ic_components')
              .select('code, name')
              .eq('id', standardData.component_id)
              .single();

            component = componentData;
          }
        }

        const relatedDepts: string[] = [];
        if (action.related_department_ids && action.related_department_ids.length > 0) {
          const { data: depts } = await supabase
            .from('departments')
            .select('name')
            .in('id', action.related_department_ids);

          if (depts) {
            relatedDepts.push(...depts.map(d => d.name));
          }
        }

        const delayDays = action.target_date &&
          new Date(action.target_date) < new Date() &&
          !['COMPLETED', 'CANCELLED', 'ONGOING'].includes(action.status)
            ? Math.floor((new Date().getTime() - new Date(action.target_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        return {
          ...action,
          condition_code: condition?.code,
          condition_description: condition?.description,
          standard_code: standard?.code,
          standard_name: standard?.name,
          component_code: component?.code,
          component_name: component?.name,
          department_name: action.departments?.name,
          related_departments: relatedDepts,
          delay_days: delayDays
        };
      }));

      setActions(enrichedActions);
    } catch (error) {
      console.error('Eylemler yüklenirken hata:', error);
    }
  };

  useEffect(() => {
    if (selectedPlanId) {
      loadActions();
    }
  }, [selectedPlanId]);

  const filteredStandards = useMemo(() => {
    if (!selectedComponentId) return standards;
    return standards.filter(s => s.component_id === selectedComponentId);
  }, [selectedComponentId, standards]);

  const baseFilteredActions = useMemo(() => {
    let filtered = actions;

    if (selectedComponentId) {
      filtered = filtered.filter(a => {
        const standard = standards.find(s => s.id === a.standard_id);
        return standard?.component_id === selectedComponentId;
      });
    }

    if (selectedStandardId) {
      filtered = filtered.filter(a => {
        const condition = a.condition_id;
        const gc = actions.find(ac => ac.id === a.id);
        return gc?.standard_id === selectedStandardId;
      });
    }

    if (selectedDepartmentId) {
      filtered = filtered.filter(a => a.responsible_department_id === selectedDepartmentId);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.code.toLowerCase().includes(term) ||
        a.title.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [actions, selectedComponentId, selectedStandardId, selectedDepartmentId, searchTerm, standards]);

  const filteredActions = useMemo(() => {
    let filtered = baseFilteredActions;

    if (selectedStatus) {
      if (selectedStatus === 'DELAYED') {
        filtered = filtered.filter(a =>
          a.delay_days && a.delay_days > 0 && !['COMPLETED', 'CANCELLED', 'ONGOING'].includes(a.status)
        );
      } else {
        filtered = filtered.filter(a => a.status === selectedStatus);
      }
    }

    return filtered;
  }, [baseFilteredActions, selectedStatus]);

  const sortedActions = useMemo(() => {
    const sorted = [...filteredActions];

    sorted.sort((a, b) => {
      if (sortColumn === 'delay') {
        const aDelay = a.delay_days || 0;
        const bDelay = b.delay_days || 0;
        if (aDelay !== bDelay) {
          return sortDirection === 'asc' ? aDelay - bDelay : bDelay - aDelay;
        }
        const aDate = new Date(a.target_date || '');
        const bDate = new Date(b.target_date || '');
        return aDate.getTime() - bDate.getTime();
      }

      if (sortColumn === 'code') {
        return sortDirection === 'asc'
          ? a.code.localeCompare(b.code)
          : b.code.localeCompare(a.code);
      }

      if (sortColumn === 'standard') {
        const aStd = a.standard_code || '';
        const bStd = b.standard_code || '';
        return sortDirection === 'asc'
          ? aStd.localeCompare(bStd)
          : bStd.localeCompare(aStd);
      }

      if (sortColumn === 'target_date') {
        const aDate = new Date(a.target_date || '');
        const bDate = new Date(b.target_date || '');
        return sortDirection === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      if (sortColumn === 'progress') {
        return sortDirection === 'asc'
          ? a.progress_percent - b.progress_percent
          : b.progress_percent - a.progress_percent;
      }

      return 0;
    });

    return sorted;
  }, [filteredActions, sortColumn, sortDirection]);

  const paginatedActions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedActions.slice(start, end);
  }, [sortedActions, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedActions.length / pageSize);

  const stats = useMemo(() => {
    const total = baseFilteredActions.length;
    const completed = baseFilteredActions.filter(a => a.status === 'COMPLETED').length;
    const inProgress = baseFilteredActions.filter(a => a.status === 'IN_PROGRESS').length;
    const notStarted = baseFilteredActions.filter(a => a.status === 'NOT_STARTED').length;
    const delayed = baseFilteredActions.filter(a =>
      a.delay_days && a.delay_days > 0 && !['COMPLETED', 'CANCELLED', 'ONGOING'].includes(a.status)
    ).length;
    const ongoing = baseFilteredActions.filter(a => a.status === 'ONGOING').length;

    return {
      total,
      completed,
      completedPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      inProgress: inProgress + ongoing,
      inProgressPercent: total > 0 ? Math.round(((inProgress + ongoing) / total) * 100) : 0,
      notStarted,
      notStartedPercent: total > 0 ? Math.round((notStarted / total) * 100) : 0,
      delayed,
      delayedPercent: total > 0 ? Math.round((delayed / total) * 100) : 0
    };
  }, [baseFilteredActions]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(selectedStatus === status ? '' : status);
  };

  const clearFilters = () => {
    setSelectedComponentId('');
    setSelectedStandardId('');
    setSelectedDepartmentId('');
    setSelectedStatus('');
    setSearchTerm('');
  };

  const toggleSelectAll = () => {
    if (selectedActionIds.size === paginatedActions.length) {
      setSelectedActionIds(new Set());
    } else {
      setSelectedActionIds(new Set(paginatedActions.map(a => a.id)));
    }
  };

  const toggleSelectAction = (id: string) => {
    const newSet = new Set(selectedActionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedActionIds(newSet);
  };

  const handleUpdateProgress = (action: Action) => {
    setSelectedAction(action);
    setProgressForm({
      new_progress: action.progress_percent,
      new_status: action.status,
      completed_date: action.completed_date || '',
      description: ''
    });
    setShowProgressModal(true);
  };

  const handleViewDetail = async (action: Action) => {
    setSelectedAction(action);
    await loadProgressHistory(action.id);
    setShowDetailModal(true);
  };

  const handleEdit = (action: Action) => {
    setSelectedAction(action);
    setEditForm({
      title: action.title,
      description: action.description || '',
      responsible_department_id: action.responsible_department_id,
      related_department_ids: action.related_department_ids || [],
      outputs: action.outputs || '',
      is_continuous: action.is_continuous || false,
      start_date: action.start_date || '',
      target_date: action.target_date,
      notes: ''
    });
    setShowEditModal(true);
  };

  const loadProgressHistory = async (actionId: string) => {
    const { data, error } = await supabase
      .from('ic_action_progress')
      .select('*, profiles!ic_action_progress_reported_by_id_fkey(full_name)')
      .eq('action_id', actionId)
      .order('report_date', { ascending: false });

    if (error) {
      console.error('İlerleme geçmişi yüklenirken hata:', error);
      return;
    }

    const enriched = (data || []).map(p => ({
      ...p,
      reporter_name: p.profiles?.full_name || 'Bilinmiyor'
    }));

    setProgressHistory(enriched);
  };

  const submitProgressUpdate = async () => {
    if (!selectedAction) return;

    if (progressForm.new_progress === 100 && progressForm.new_status !== 'COMPLETED') {
      if (!confirm('İlerleme %100 ama durum "Tamamlandı" değil. Devam etmek istiyor musunuz?')) {
        return;
      }
    }

    try {
      const { error: updateError } = await supabase
        .from('ic_actions')
        .update({
          progress_percent: progressForm.new_progress,
          status: progressForm.new_status,
          completed_date: progressForm.new_status === 'COMPLETED' ? (progressForm.completed_date || new Date().toISOString().split('T')[0]) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAction.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('ic_action_progress')
        .insert({
          action_id: selectedAction.id,
          report_date: new Date().toISOString().split('T')[0],
          reported_by_id: profile?.id,
          previous_progress: selectedAction.progress_percent,
          new_progress: progressForm.new_progress,
          previous_status: selectedAction.status,
          new_status: progressForm.new_status,
          description: progressForm.description
        });

      if (logError) throw logError;

      alert('İlerleme başarıyla güncellendi');
      setShowProgressModal(false);
      loadActions();
    } catch (error) {
      console.error('İlerleme güncellenirken hata:', error);
      alert('İlerleme güncellenirken bir hata oluştu');
    }
  };

  const submitEdit = async () => {
    if (!selectedAction) return;

    try {
      const { error } = await supabase
        .from('ic_actions')
        .update({
          title: editForm.title,
          description: editForm.description,
          responsible_department_id: editForm.responsible_department_id,
          related_department_ids: editForm.related_department_ids,
          outputs: editForm.outputs,
          is_continuous: editForm.is_continuous,
          start_date: editForm.start_date,
          target_date: editForm.target_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAction.id);

      if (error) throw error;

      alert('Eylem başarıyla güncellendi');
      setShowEditModal(false);
      loadActions();
    } catch (error) {
      console.error('Eylem güncellenirken hata:', error);
      alert('Eylem güncellenirken bir hata oluştu');
    }
  };

  const handleDelete = async (action: Action) => {
    if (!confirm(`"${action.code} - ${action.title}" eylemini silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ic_actions')
        .delete()
        .eq('id', action.id);

      if (error) throw error;

      alert('Eylem başarıyla silindi');
      loadActions();
    } catch (error) {
      console.error('Eylem silinirken hata:', error);
      alert('Eylem silinirken bir hata oluştu');
    }
  };

  const exportToExcel = () => {
    const data = sortedActions.map(action => ({
      'Kod': action.code,
      'Eylem': action.title,
      'Standart': action.standard_code || '',
      'Genel Şart': action.condition_code || '',
      'Sorumlu Birim': action.department_name || '',
      'İş Birliği': action.related_departments?.join(', ') || '',
      'Hedef Tarih': action.target_date ? new Date(action.target_date).toLocaleDateString('tr-TR') : '',
      'Durum': getStatusLabel(action.status),
      'İlerleme': `%${action.progress_percent}`
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eylemler');
    XLSX.writeFile(wb, `ic-eylemler-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('İç Kontrol Eylemleri', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);

    const selectedPlan = actionPlans.find(p => p.id === selectedPlanId);
    if (selectedPlan) {
      doc.text(`Eylem Planı: ${selectedPlan.name}`, 14, 27);
    }

    doc.text(`Toplam: ${stats.total} | Tamamlanan: ${stats.completed} (%${stats.completedPercent}) | Devam Eden: ${stats.inProgress} (%${stats.inProgressPercent}) | Geciken: ${stats.delayed} (%${stats.delayedPercent})`, 14, 32);

    const tableData = sortedActions.map(action => [
      action.code,
      action.title.length > 40 ? action.title.substring(0, 37) + '...' : action.title,
      action.standard_code || '',
      action.department_name || '',
      action.target_date ? new Date(action.target_date).toLocaleDateString('tr-TR') : '',
      `%${action.progress_percent}`,
      getStatusLabel(action.status)
    ]);

    autoTable(doc, {
      startY: 37,
      head: [['Kod', 'Eylem', 'Standart', 'Sorumlu', 'Hedef', 'İlerleme', 'Durum']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`ic-eylemler-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'NOT_STARTED': 'Başlamadı',
      'IN_PROGRESS': 'Devam Ediyor',
      'COMPLETED': 'Tamamlandı',
      'DELAYED': 'Gecikmiş',
      'CANCELLED': 'İptal',
      'ONGOING': 'Sürekli'
    };
    return labels[status] || status;
  };

  const getStatusBadge = (action: Action) => {
    if (action.status === 'COMPLETED') {
      return 'bg-green-100 text-green-800';
    }
    if (action.delay_days && action.delay_days > 0) {
      return 'bg-red-100 text-red-800';
    }
    if (action.status === 'IN_PROGRESS') {
      return 'bg-blue-100 text-blue-800';
    }
    if (action.status === 'ONGOING') {
      return 'bg-purple-100 text-purple-800';
    }
    if (action.status === 'NOT_STARTED') {
      return 'bg-gray-100 text-gray-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getProgressDisplay = (action: Action) => {
    if (action.status === 'COMPLETED') {
      return (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="font-medium">%100</span>
        </div>
      );
    }

    if (action.delay_days && action.delay_days > 0) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="font-medium">%{action.progress_percent}</span>
          </div>
          <div className="text-xs text-red-600">{action.delay_days} gün gecikmiş</div>
        </div>
      );
    }

    if (action.status === 'IN_PROGRESS') {
      return (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="font-medium">%{action.progress_percent}</span>
        </div>
      );
    }

    if (action.status === 'ONGOING') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-600 rounded-full" />
          <span className="font-medium">Sürekli</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
        <span>%0</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!selectedPlanId) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg mb-4">Henüz aktif bir eylem planı bulunamadı</p>
        <button
          onClick={() => navigate('/internal-control/action-plans')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Eylem Planı Oluştur
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tüm Eylemler</h1>
          <p className="text-gray-600 mt-1">İç kontrol eylemlerinin toplu görünümü ve takibi</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Excel İndir
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            PDF İndir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <button
          onClick={() => handleStatusFilter('')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedStatus === '' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">TOPLAM</div>
          <div className="text-xs text-gray-500 mt-1">Eylem</div>
        </button>

        <button
          onClick={() => handleStatusFilter('COMPLETED')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedStatus === 'COMPLETED' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600 mt-1">TAMAMLANAN</div>
          <div className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            %{stats.completedPercent}
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('IN_PROGRESS')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedStatus === 'IN_PROGRESS' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-sm text-gray-600 mt-1">DEVAM EDEN</div>
          <div className="text-xs text-blue-600 mt-1 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            %{stats.inProgressPercent}
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('NOT_STARTED')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedStatus === 'NOT_STARTED' ? 'border-gray-500 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-gray-600">{stats.notStarted}</div>
          <div className="text-sm text-gray-600 mt-1">BAŞLAMADI</div>
          <div className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
            <div className="w-3 h-3 border-2 border-gray-400 rounded-full" />
            %{stats.notStartedPercent}
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('DELAYED')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedStatus === 'DELAYED' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-3xl font-bold text-red-600">{stats.delayed}</div>
          <div className="text-sm text-gray-600 mt-1">GECİKEN</div>
          <div className="text-xs text-red-600 mt-1 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            %{stats.delayedPercent}
          </div>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eylem Planı
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {actionPlans.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              value={selectedComponentId}
              onChange={(e) => {
                setSelectedComponentId(e.target.value);
                setSelectedStandardId('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Bileşenler</option>
              {components.map(comp => (
                <option key={comp.id} value={comp.id}>{comp.code} - {comp.name}</option>
              ))}
            </select>

            <select
              value={selectedStandardId}
              onChange={(e) => setSelectedStandardId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Standartlar</option>
              {filteredStandards.map(std => (
                <option key={std.id} value={std.id}>{std.code} - {std.name}</option>
              ))}
            </select>

            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Birimler</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={clearFilters}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
              Temizle
            </button>
          </div>
        </div>
      </div>

      {selectedActionIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-900">
              {selectedActionIds.size} eylem seçildi
            </span>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                Toplu Durum Güncelle
              </button>
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                Toplu Birim Ata
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button onClick={toggleSelectAll}>
                    {selectedActionIds.size === paginatedActions.length ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-2">
                    KOD
                    {sortColumn === 'code' && (
                      <ChevronDown className={`w-4 h-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EYLEM
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('standard')}
                >
                  <div className="flex items-center gap-2">
                    STANDART
                    {sortColumn === 'standard' && (
                      <ChevronDown className={`w-4 h-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SORUMLU BİRİM
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('target_date')}
                >
                  <div className="flex items-center gap-2">
                    HEDEF TARİH
                    {sortColumn === 'target_date' && (
                      <ChevronDown className={`w-4 h-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('progress')}
                >
                  <div className="flex items-center gap-2">
                    İLERLEME
                    {sortColumn === 'progress' && (
                      <ChevronDown className={`w-4 h-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İŞLEM
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedActions.map((action) => (
                <tr key={action.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <button onClick={() => toggleSelectAction(action.id)}>
                      {selectedActionIds.has(action.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {action.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-md">
                      <div className="font-medium truncate" title={action.title}>
                        {action.title}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {action.standard_code || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {action.department_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {action.is_continuous ? (
                      <span className="text-purple-600 font-medium">Sürekli</span>
                    ) : (
                      action.target_date ? new Date(action.target_date).toLocaleDateString('tr-TR') : '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getProgressDisplay(action)}
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(action)}`}>
                        {getStatusLabel(action.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateProgress(action)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="İlerleme Güncelle"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewDetail(action)}
                        className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                        title="Detay"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(action)}
                        className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                        title="Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                        <button
                          onClick={() => handleDelete(action)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">
                  Sayfa başına:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">
                  Toplam {sortedActions.length} kayıt
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Önceki
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="İlerleme Güncelle"
      >
        {selectedAction && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div><strong>{selectedAction.code}</strong> - {selectedAction.title}</div>
              <div><strong>Standart:</strong> {selectedAction.standard_code} - {selectedAction.standard_name}</div>
              <div><strong>Genel Şart:</strong> {selectedAction.condition_code} - {selectedAction.condition_description}</div>
              <div><strong>Sorumlu:</strong> {selectedAction.department_name}</div>
              <div><strong>Hedef Tarih:</strong> {selectedAction.target_date ? new Date(selectedAction.target_date).toLocaleDateString('tr-TR') : '-'}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mevcut İlerleme: %{selectedAction.progress_percent}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yeni İlerleme *
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressForm.new_progress}
                  onChange={(e) => setProgressForm({ ...progressForm, new_progress: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-lg font-medium w-12 text-right">%{progressForm.new_progress}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durum *
              </label>
              <select
                value={progressForm.new_status}
                onChange={(e) => setProgressForm({ ...progressForm, new_status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="NOT_STARTED">Başlamadı</option>
                <option value="IN_PROGRESS">Devam Ediyor</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="CANCELLED">İptal</option>
                <option value="ONGOING">Sürekli</option>
              </select>
            </div>

            {progressForm.new_status === 'COMPLETED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tamamlanma Tarihi
                </label>
                <input
                  type="date"
                  value={progressForm.completed_date}
                  onChange={(e) => setProgressForm({ ...progressForm, completed_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Güncelleme Notu *
              </label>
              <textarea
                value={progressForm.description}
                onChange={(e) => setProgressForm({ ...progressForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Yapılan işlemler ve güncellemeler..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowProgressModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={submitProgressUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Güncelle
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Eylem Detayı"
      >
        {selectedAction && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">EYLEM BİLGİLERİ</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Eylem Kodu:</strong> {selectedAction.code}</div>
                <div><strong>Eylem Başlığı:</strong> {selectedAction.title}</div>
                {selectedAction.description && (
                  <div><strong>Açıklama:</strong> {selectedAction.description}</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">İLİŞKİ BİLGİLERİ</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Bileşen:</strong> {selectedAction.component_name}</div>
                <div><strong>Standart:</strong> {selectedAction.standard_code} - {selectedAction.standard_name}</div>
                <div><strong>Genel Şart:</strong> {selectedAction.condition_code} - {selectedAction.condition_description}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">SORUMLULUK</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Sorumlu Birim:</strong> {selectedAction.department_name}</div>
                {selectedAction.related_departments && selectedAction.related_departments.length > 0 && (
                  <div><strong>İş Birliği:</strong> {selectedAction.related_departments.join(', ')}</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">TARİHLER</h3>
              <div className="space-y-2 text-sm">
                {selectedAction.start_date && (
                  <div><strong>Başlangıç:</strong> {new Date(selectedAction.start_date).toLocaleDateString('tr-TR')}</div>
                )}
                <div><strong>Hedef Tarih:</strong> {selectedAction.is_continuous ? 'Sürekli' : new Date(selectedAction.target_date).toLocaleDateString('tr-TR')}</div>
                <div><strong>Sürekli Eylem:</strong> {selectedAction.is_continuous ? 'Evet' : 'Hayır'}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">DURUM</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Durum:</strong> <span className={`px-2 py-1 text-xs rounded ${getStatusBadge(selectedAction)}`}>{getStatusLabel(selectedAction.status)}</span></div>
                <div className="flex items-center gap-2">
                  <strong>İlerleme:</strong>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all"
                      style={{ width: `${selectedAction.progress_percent}%` }}
                    />
                  </div>
                  <span>%{selectedAction.progress_percent}</span>
                </div>
                {selectedAction.outputs && (
                  <div><strong>Beklenen Çıktı:</strong> {selectedAction.outputs}</div>
                )}
              </div>
            </div>

            {progressHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">İLERLEME GEÇMİŞİ</h3>
                <div className="space-y-3">
                  {progressHistory.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-blue-500 pl-3 text-sm">
                      <div className="font-medium">
                        {new Date(entry.report_date).toLocaleDateString('tr-TR')} - {entry.reporter_name}
                      </div>
                      <div className="text-gray-600">
                        %{entry.previous_progress} → %{entry.new_progress} | {entry.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleUpdateProgress(selectedAction);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                İlerleme Güncelle
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Eylem Düzenle"
      >
        {selectedAction && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eylem Kodu
              </label>
              <input
                type="text"
                value={selectedAction.code}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eylem Başlığı *
              </label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Açıklama
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sorumlu Birim *
              </label>
              <select
                value={editForm.responsible_department_id}
                onChange={(e) => setEditForm({ ...editForm, responsible_department_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                İş Birliği Yapılacak Birimler
              </label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                {departments.map(dept => (
                  <label key={dept.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={editForm.related_department_ids.includes(dept.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditForm({
                            ...editForm,
                            related_department_ids: [...editForm.related_department_ids, dept.id]
                          });
                        } else {
                          setEditForm({
                            ...editForm,
                            related_department_ids: editForm.related_department_ids.filter(id => id !== dept.id)
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{dept.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beklenen Çıktı/Sonuç
              </label>
              <input
                type="text"
                value={editForm.outputs}
                onChange={(e) => setEditForm({ ...editForm, outputs: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.is_continuous}
                  onChange={(e) => setEditForm({ ...editForm, is_continuous: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Bu eylem sürekli olarak tekrarlanacak</span>
              </label>
            </div>

            {!editForm.is_continuous && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hedef Tarih *
                  </label>
                  <input
                    type="date"
                    value={editForm.target_date}
                    onChange={(e) => setEditForm({ ...editForm, target_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notlar
              </label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={submitEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
