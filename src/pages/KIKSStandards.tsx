import { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Download, ChevronRight, ChevronDown, Save, X, Building2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useICPlan } from '../hooks/useICPlan';
import { useLocation } from '../hooks/useLocation';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface Department {
  id: string;
  name: string;
}

interface KIKSCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  order_index: number;
  is_active: boolean;
  mainStandards?: KIKSMainStandard[];
}

interface KIKSMainStandard {
  id: string;
  category_id: string;
  code: string;
  title: string;
  description?: string;
  current_status?: string;
  responsible_departments: string[];
  collaboration_departments: string[];
  all_departments_responsible?: boolean;
  all_departments_collaboration?: boolean;
  order_index: number;
  is_active: boolean;
  subStandards?: KIKSSubStandard[];
}

interface KIKSSubStandard {
  id: string;
  main_standard_id: string;
  code: string;
  title: string;
  description?: string;
  responsible_departments: string[];
  collaboration_departments: string[];
  all_departments_responsible?: boolean;
  all_departments_collaboration?: boolean;
  order_index: number;
  is_active: boolean;
  actions?: KIKSAction[];
  status?: SubStandardStatus;
}

interface SubStandardStatus {
  id: string;
  sub_standard_id: string;
  organization_id: string;
  current_status?: string;
  provides_reasonable_assurance: boolean;
}

interface KIKSAction {
  id: string;
  sub_standard_id: string;
  code: string;
  description: string;
  current_status?: string;
  responsible_departments: string[];
  collaboration_departments: string[];
  all_departments_responsible?: boolean;
  all_departments_collaboration?: boolean;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  start_date?: string;
  target_date?: string;
  completion_date?: string;
  notes?: string;
  order_index: number;
  is_active: boolean;
}

type ModalType = 'category' | 'main_standard' | 'sub_standard' | 'action';

const STATUS_LABELS = {
  not_started: 'Başlanmadı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  delayed: 'Gecikmiş'
};

const STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  delayed: 'bg-red-100 text-red-800'
};

export default function KIKSStandards() {
  const { profile } = useAuth();
  const { selectedPlanId, selectedPlan, hasPlan, loading: planLoading } = useICPlan();
  const { navigate } = useLocation();
  const [categories, setCategories] = useState<KIKSCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('category');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<KIKSCategory | null>(null);
  const [selectedMainStandard, setSelectedMainStandard] = useState<KIKSMainStandard | null>(null);
  const [selectedSubStandard, setSelectedSubStandard] = useState<KIKSSubStandard | null>(null);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedMainStandards, setExpandedMainStandards] = useState<Set<string>>(new Set());
  const [expandedSubStandards, setExpandedSubStandards] = useState<Set<string>>(new Set());
  const [selectedResponsibleDepartmentFilter, setSelectedResponsibleDepartmentFilter] = useState<string>('');
  const [selectedCollaborationDepartmentFilter, setSelectedCollaborationDepartmentFilter] = useState<string>('');

  const [formData, setFormData] = useState<any>({
    code: '',
    name: '',
    title: '',
    description: '',
    current_status: '',
    provides_reasonable_assurance: false,
    output_result: '',
    responsible_departments: [],
    collaboration_departments: [],
    all_departments_responsible: false,
    all_departments_collaboration: false,
    status: 'not_started',
    target_date: ''
  });

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (profile && selectedPlanId) {
      loadCategories(selectedPlanId);
    }
  }, [selectedPlanId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadCategories(), loadDepartments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    if (!profile) return;

    if (profile.is_super_admin) {
      setDepartments([]);
      return;
    }

    if (!profile.organization_id) return;

    const { data, error } = await supabase
      .from('departments')
      .select('id, name, is_system_unit')
      .or(`organization_id.eq.${profile.organization_id},is_system_unit.eq.true`)
      .order('is_system_unit.desc.nullslast, name');

    if (error) throw error;
    setDepartments(data || []);
  };

  const loadCategories = async (planId?: string | null) => {
    if (!profile) return;

    const isSuperAdmin = profile?.is_super_admin === true;
    const activePlanId = planId !== undefined ? planId : selectedPlanId;

    const { data: categoriesData, error: catError } = await supabase
      .from('ic_kiks_categories')
      .select('*')
      .is('organization_id', null)
      .order('order_index');

    if (catError) throw catError;

    const { data: mainStandardsData, error: mainError } = await supabase
      .from('ic_kiks_main_standards')
      .select('*')
      .is('organization_id', null)
      .order('order_index');

    if (mainError) throw mainError;

    const { data: subStandardsData, error: subError } = await supabase
      .from('ic_kiks_sub_standards')
      .select('*')
      .is('organization_id', null)
      .order('order_index');

    if (subError) throw subError;

    let actionsData = [];
    let statusesData = [];
    if (!isSuperAdmin && profile.organization_id && activePlanId) {
      const [actionsRes, statusesRes] = await Promise.all([
        supabase
          .from('ic_kiks_actions')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', activePlanId)
          .order('order_index'),
        supabase
          .from('ic_kiks_sub_standard_statuses')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('ic_plan_id', activePlanId)
      ]);

      if (actionsRes.error) throw actionsRes.error;
      if (statusesRes.error) throw statusesRes.error;

      actionsData = actionsRes.data || [];
      statusesData = statusesRes.data || [];
    }

    const subStandardsWithActions = (subStandardsData || []).map(sub => ({
      ...sub,
      actions: actionsData.filter(act => act.sub_standard_id === sub.id),
      status: statusesData.find((s: any) => s.sub_standard_id === sub.id)
    }));

    const mainStandardsWithSubs = (mainStandardsData || []).map(main => ({
      ...main,
      subStandards: subStandardsWithActions.filter(sub => sub.main_standard_id === main.id)
    }));

    const categoriesWithStandards = (categoriesData || []).map(cat => ({
      ...cat,
      mainStandards: mainStandardsWithSubs.filter(main => main.category_id === cat.id)
    }));

    setCategories(categoriesWithStandards);
  };

  const toggleCategory = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleMainStandard = (id: string) => {
    const newExpanded = new Set(expandedMainStandards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMainStandards(newExpanded);
  };

  const toggleSubStandard = (id: string) => {
    const newExpanded = new Set(expandedSubStandards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSubStandards(newExpanded);
  };

  const filterCategoriesByDepartment = (categories: KIKSCategory[]): KIKSCategory[] => {
    if (!selectedResponsibleDepartmentFilter && !selectedCollaborationDepartmentFilter) {
      return categories;
    }

    return categories.map(category => {
      const filteredMainStandards = (category.mainStandards || []).map(mainStandard => {
        const filteredSubStandards = (mainStandard.subStandards || []).map(subStandard => {
          const filteredActions = (subStandard.actions || []).filter(action => {
            let matchesResponsible = true;
            let matchesCollaboration = true;

            if (selectedResponsibleDepartmentFilter) {
              matchesResponsible =
                action.responsible_departments.includes(selectedResponsibleDepartmentFilter) ||
                action.all_departments_responsible;
            }

            if (selectedCollaborationDepartmentFilter) {
              matchesCollaboration =
                action.collaboration_departments.includes(selectedCollaborationDepartmentFilter) ||
                action.all_departments_collaboration;
            }

            return matchesResponsible && matchesCollaboration;
          });

          return {
            ...subStandard,
            actions: filteredActions
          };
        }).filter(subStandard => subStandard.actions && subStandard.actions.length > 0);

        return {
          ...mainStandard,
          subStandards: filteredSubStandards
        };
      }).filter(mainStandard => mainStandard.subStandards && mainStandard.subStandards.length > 0);

      return {
        ...category,
        mainStandards: filteredMainStandards
      };
    }).filter(category => category.mainStandards && category.mainStandards.length > 0);
  };

  const handleAddCategory = () => {
    setModalType('category');
    setEditingId(null);
    setSelectedCategory(null);
    setSelectedMainStandard(null);
    setSelectedSubStandard(null);
    setFormData({ code: '', name: '', description: '' });
    setShowModal(true);
  };

  const handleAddMainStandard = (category: KIKSCategory) => {
    setModalType('main_standard');
    setEditingId(null);
    setSelectedCategory(category);
    setSelectedMainStandard(null);
    setSelectedSubStandard(null);

    const nextIndex = (category.mainStandards?.length || 0) + 1;
    const autoCode = `${category.code} ${nextIndex}`;

    setFormData({
      code: autoCode,
      title: '',
      current_status: '',
      responsible_departments: [],
      collaboration_departments: [],
      all_departments_responsible: false,
      all_departments_collaboration: false
    });
    setShowModal(true);
  };

  const handleAddSubStandard = (mainStandard: KIKSMainStandard, category: KIKSCategory) => {
    setModalType('sub_standard');
    setEditingId(null);
    setSelectedCategory(category);
    setSelectedMainStandard(mainStandard);
    setSelectedSubStandard(null);

    const nextIndex = (mainStandard.subStandards?.length || 0) + 1;
    const autoCode = `${mainStandard.code}.${nextIndex}`;

    setFormData({
      code: autoCode,
      title: '',
      current_status: '',
      provides_reasonable_assurance: false,
      responsible_departments: [],
      collaboration_departments: [],
      all_departments_responsible: false,
      all_departments_collaboration: false
    });
    setShowModal(true);
  };

  const handleAddAction = (subStandard: KIKSSubStandard, mainStandard: KIKSMainStandard, category: KIKSCategory) => {
    if (!hasPlan) {
      alert('Lütfen önce bir İç Kontrol Planı seçiniz.');
      return;
    }

    setModalType('action');
    setEditingId(null);
    setSelectedCategory(category);
    setSelectedMainStandard(mainStandard);
    setSelectedSubStandard(subStandard);

    const nextIndex = (subStandard.actions?.length || 0) + 1;
    const autoCode = `${subStandard.code}.${nextIndex}`;

    setFormData({
      code: autoCode,
      description: '',
      output_result: '',
      notes: '',
      responsible_departments: [],
      collaboration_departments: [],
      all_departments_responsible: false,
      all_departments_collaboration: false,
      status: 'not_started',
      target_date: ''
    });
    setShowModal(true);
  };

  const handleEdit = (type: ModalType, item: any, parent?: any, grandParent?: any) => {
    setModalType(type);
    setEditingId(item.id);

    if (type === 'category') {
      setFormData({
        code: item.code,
        name: item.name,
        description: item.description || ''
      });
    } else if (type === 'main_standard') {
      setSelectedCategory(parent);
      setFormData({
        code: item.code,
        title: item.title,
        current_status: item.current_status || '',
        responsible_departments: item.responsible_departments || [],
        collaboration_departments: item.collaboration_departments || [],
        all_departments_responsible: item.all_departments_responsible || false,
        all_departments_collaboration: item.all_departments_collaboration || false
      });
    } else if (type === 'sub_standard') {
      setSelectedCategory(grandParent);
      setSelectedMainStandard(parent);
      setFormData({
        code: item.code,
        title: item.title,
        current_status: item.status?.current_status || '',
        provides_reasonable_assurance: item.status?.provides_reasonable_assurance || false,
        responsible_departments: item.responsible_departments || [],
        collaboration_departments: item.collaboration_departments || [],
        all_departments_responsible: item.all_departments_responsible || false,
        all_departments_collaboration: item.all_departments_collaboration || false
      });
    } else if (type === 'action') {
      setSelectedSubStandard(parent);
      setSelectedMainStandard(grandParent);
      setFormData({
        code: item.code,
        description: item.description || '',
        output_result: item.output_result || '',
        notes: item.notes || '',
        responsible_departments: item.responsible_departments || [],
        collaboration_departments: item.collaboration_departments || [],
        all_departments_responsible: item.all_departments_responsible || false,
        all_departments_collaboration: item.all_departments_collaboration || false,
        status: item.status || 'not_started',
        target_date: item.target_date || ''
      });
    }

    setShowModal(true);
  };

  const handleSave = async () => {
    if (!profile) return;

    const isSuperAdmin = profile.is_super_admin === true;

    if (!isSuperAdmin && !profile.organization_id) return;

    try {
      if (modalType === 'category') {
        if (editingId) {
          const { error } = await supabase
            .from('ic_kiks_categories')
            .update({
              code: formData.code,
              name: formData.name,
              description: formData.description || null
            })
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('ic_kiks_categories')
            .insert({
              organization_id: null,
              code: formData.code,
              name: formData.name,
              description: formData.description || null,
              order_index: categories.length
            });
          if (error) throw error;
        }
      } else if (modalType === 'main_standard' && selectedCategory) {
        if (editingId) {
          const updateData: any = {
            current_status: formData.current_status || null
          };

          if (isSuperAdmin) {
            updateData.code = formData.code;
            updateData.title = formData.title;
            updateData.responsible_departments = formData.responsible_departments || [];
            updateData.collaboration_departments = formData.collaboration_departments || [];
            updateData.all_departments_responsible = formData.all_departments_responsible || false;
            updateData.all_departments_collaboration = formData.all_departments_collaboration || false;
          }

          const { error } = await supabase
            .from('ic_kiks_main_standards')
            .update(updateData)
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('ic_kiks_main_standards')
            .insert({
              organization_id: null,
              category_id: selectedCategory.id,
              code: formData.code,
              title: formData.title,
              current_status: formData.current_status || null,
              responsible_departments: formData.responsible_departments || [],
              collaboration_departments: formData.collaboration_departments || [],
              all_departments_responsible: formData.all_departments_responsible || false,
              all_departments_collaboration: formData.all_departments_collaboration || false,
              order_index: selectedCategory.mainStandards?.length || 0
            });
          if (error) throw error;
        }
      } else if (modalType === 'sub_standard' && selectedMainStandard) {
        if (editingId) {
          if (isSuperAdmin) {
            const updateData: any = {
              code: formData.code,
              title: formData.title,
              responsible_departments: formData.responsible_departments || [],
              collaboration_departments: formData.collaboration_departments || [],
              all_departments_responsible: formData.all_departments_responsible || false,
              all_departments_collaboration: formData.all_departments_collaboration || false
            };

            const { error } = await supabase
              .from('ic_kiks_sub_standards')
              .update(updateData)
              .eq('id', editingId);
            if (error) throw error;
          }

          if (!isSuperAdmin && profile.organization_id) {
            const subStandard = categories
              .flatMap(c => c.mainStandards || [])
              .flatMap(m => m.subStandards || [])
              .find(s => s.id === editingId);

            if (subStandard?.status) {
              const { error: statusError } = await supabase
                .from('ic_kiks_sub_standard_statuses')
                .update({
                  ic_plan_id: selectedPlanId,
                  current_status: formData.current_status || null,
                  provides_reasonable_assurance: formData.provides_reasonable_assurance || false
                })
                .eq('id', subStandard.status.id);
              if (statusError) throw statusError;
            } else {
              const { error: statusError } = await supabase
                .from('ic_kiks_sub_standard_statuses')
                .insert({
                  sub_standard_id: editingId,
                  organization_id: profile.organization_id,
                  ic_plan_id: selectedPlanId,
                  current_status: formData.current_status || null,
                  provides_reasonable_assurance: formData.provides_reasonable_assurance || false
                });
              if (statusError) throw statusError;
            }
          }
        } else {
          const { data: newSubStandard, error } = await supabase
            .from('ic_kiks_sub_standards')
            .insert({
              organization_id: null,
              main_standard_id: selectedMainStandard.id,
              code: formData.code,
              title: formData.title,
              responsible_departments: formData.responsible_departments || [],
              collaboration_departments: formData.collaboration_departments || [],
              all_departments_responsible: formData.all_departments_responsible || false,
              all_departments_collaboration: formData.all_departments_collaboration || false,
              order_index: selectedMainStandard.subStandards?.length || 0
            })
            .select()
            .single();
          if (error) throw error;

          if (!isSuperAdmin && profile.organization_id && newSubStandard) {
            const { error: statusError } = await supabase
              .from('ic_kiks_sub_standard_statuses')
              .insert({
                sub_standard_id: newSubStandard.id,
                organization_id: profile.organization_id,
                ic_plan_id: selectedPlanId,
                current_status: formData.current_status || null,
                provides_reasonable_assurance: formData.provides_reasonable_assurance || false
              });
            if (statusError) throw statusError;
          }
        }
      } else if (modalType === 'action' && selectedSubStandard) {
        if (editingId) {
          const { error: actionError } = await supabase
            .from('ic_kiks_actions')
            .update({
              code: formData.code,
              description: formData.description,
              output_result: formData.output_result || null,
              notes: formData.notes || null,
              responsible_departments: formData.responsible_departments,
              collaboration_departments: formData.collaboration_departments,
              all_departments_responsible: formData.all_departments_responsible || false,
              all_departments_collaboration: formData.all_departments_collaboration || false,
              status: formData.status,
              target_date: formData.target_date || null
            })
            .eq('id', editingId);
          if (actionError) throw actionError;

          const { error: planError } = await supabase
            .from('ic_action_plans')
            .update({
              ic_plan_id: selectedPlanId,
              current_situation: selectedSubStandard.current_status || null,
              planned_actions: formData.description,
              output_result: formData.output_result || null,
              notes: formData.notes || null,
              responsible_unit_id: formData.responsible_departments?.[0] || null,
              collaboration_units: formData.collaboration_departments || [],
              completion_date: formData.target_date || null,
              status: formData.status === 'not_started' ? 'planned' : formData.status,
              updated_by: profile.id,
              updated_at: new Date().toISOString()
            })
            .eq('kiks_action_id', editingId);
          if (planError) console.error('Action plan update error:', planError);
        } else {
          if (!selectedPlanId) {
            alert('Lütfen önce bir İç Kontrol Planı seçiniz.');
            return;
          }

          const { data: actionData, error: actionError } = await supabase
            .from('ic_kiks_actions')
            .insert({
              organization_id: profile.organization_id,
              ic_plan_id: selectedPlanId,
              sub_standard_id: selectedSubStandard.id,
              code: formData.code,
              description: formData.description,
              output_result: formData.output_result || null,
              notes: formData.notes || null,
              responsible_departments: formData.responsible_departments,
              collaboration_departments: formData.collaboration_departments,
              all_departments_responsible: formData.all_departments_responsible || false,
              all_departments_collaboration: formData.all_departments_collaboration || false,
              status: formData.status,
              target_date: formData.target_date || null,
              order_index: selectedSubStandard.actions?.length || 0
            })
            .select()
            .single();
          if (actionError) throw actionError;

          const planCount = await supabase
            .from('ic_action_plans')
            .select('plan_code', { count: 'exact' })
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false })
            .limit(1);

          let nextPlanCode = 'EP-001';
          if (planCount.data && planCount.data.length > 0) {
            const lastCode = planCount.data[0].plan_code;
            const match = lastCode.match(/EP-(\d+)/);
            if (match) {
              const nextNum = parseInt(match[1]) + 1;
              nextPlanCode = `EP-${String(nextNum).padStart(3, '0')}`;
            }
          }

          const { error: planError } = await supabase
            .from('ic_action_plans')
            .insert({
              organization_id: profile.organization_id,
              ic_plan_id: selectedPlanId,
              plan_code: nextPlanCode,
              kiks_action_id: actionData.id,
              current_situation: selectedSubStandard.current_status || null,
              planned_actions: formData.description,
              output_result: formData.output_result || null,
              notes: formData.notes || null,
              responsible_unit_id: formData.responsible_departments?.[0] || null,
              responsible_persons: [],
              collaboration_units: formData.collaboration_departments || [],
              completion_date: formData.target_date || null,
              status: formData.status === 'not_started' ? 'planned' : formData.status,
              approval_status: 'draft',
              progress_percentage: 0,
              created_by: profile.id,
              updated_by: profile.id
            });
          if (planError) console.error('Action plan creation error:', planError);
        }
      }

      setShowModal(false);
      await loadCategories(selectedPlanId);
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      alert('Kayıt başarısız: ' + (error.message || ''));
    }
  };

  const handleDelete = async (type: ModalType, id: string) => {
    if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;

    try {
      const table = type === 'category' ? 'ic_kiks_categories' :
                   type === 'main_standard' ? 'ic_kiks_main_standards' :
                   type === 'sub_standard' ? 'ic_kiks_sub_standards' : 'ic_kiks_actions';

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCategories(selectedPlanId);
    } catch (error: any) {
      console.error('Silme hatası:', error);
      alert('Silme başarısız: ' + (error.message || ''));
    }
  };

  const getDepartmentNames = (deptIds: string[], allDepartments?: boolean) => {
    if (allDepartments === true) return 'Tüm Birimler';
    if (!deptIds || deptIds.length === 0) return 'Belirtilmemiş';
    return deptIds
      .map(id => departments.find(d => d.id === id)?.name || '')
      .filter(Boolean)
      .join(', ') || 'Belirtilmemiş';
  };

  const isSuperAdmin = profile?.is_super_admin === true;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'vice_president';

  if (loading || planLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const filteredCategories = filterCategoriesByDepartment(categories);

  const categoryStats = filteredCategories.map(category => {
    const mainStandardsCount = category.mainStandards?.length || 0;
    const subStandardsCount = category.mainStandards?.reduce((sum, main) =>
      sum + (main.subStandards?.length || 0), 0) || 0;
    const actionsCount = category.mainStandards?.reduce((mainSum, main) =>
      mainSum + (main.subStandards?.reduce((subSum, sub) =>
        subSum + (sub.actions?.length || 0), 0) || 0), 0) || 0;

    return {
      ...category,
      mainStandardsCount,
      subStandardsCount,
      actionsCount
    };
  });

  const gradients = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
    'from-cyan-500 to-cyan-600',
    'from-red-500 to-red-600',
    'from-emerald-500 to-emerald-600'
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">KİKS Standartları</h1>
            <p className="text-sm text-gray-600">Kamu İç Kontrol Standartları Yönetimi</p>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex gap-2">
            <Button onClick={handleAddCategory} className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Yeni Kategori Ekle
            </Button>
          </div>
        )}
        {!isSuperAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-sm text-blue-800">
              <strong>Bilgi:</strong> KİKS standartları merkezi olarak yönetilmektedir. Sadece eylemlerinizi ekleyebilirsiniz.
            </p>
          </div>
        )}
      </div>

      {!isSuperAdmin && !hasPlan && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">İç Kontrol Planı Seçilmedi</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Eylem eklemek için lütfen önce bir İç Kontrol Planı oluşturup seçiniz.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('ic-plans')}
              className="ml-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 whitespace-nowrap"
            >
              Plan Seç
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!isSuperAdmin && hasPlan && selectedPlan && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
          <div className="flex items-start">
            <FileText className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Seçili Plan: {selectedPlan.name}</h3>
              <p className="mt-1 text-sm text-green-700">
                {selectedPlan.start_year} - {selectedPlan.end_year}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isSuperAdmin && departments.length > 0 && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <Building2 className="w-5 h-5 text-gray-600" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sorumlu Birim/ler
                </label>
                <select
                  value={selectedResponsibleDepartmentFilter}
                  onChange={(e) => setSelectedResponsibleDepartmentFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tüm Birimler</option>
                  {departments.filter(d => (d as any).is_system_unit).length > 0 && (
                    <optgroup label="─── Sistem Birimleri ───">
                      {departments.filter(d => (d as any).is_system_unit).map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {departments.filter(d => !(d as any).is_system_unit).length > 0 && (
                    <optgroup label="─── Organizasyon Birimleri ───">
                      {departments.filter(d => !(d as any).is_system_unit).map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşbirliği Yapılacak Birim
                </label>
                <select
                  value={selectedCollaborationDepartmentFilter}
                  onChange={(e) => setSelectedCollaborationDepartmentFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tüm Birimler</option>
                  {departments.filter(d => (d as any).is_system_unit).length > 0 && (
                    <optgroup label="─── Sistem Birimleri ───">
                      {departments.filter(d => (d as any).is_system_unit).map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {departments.filter(d => !(d as any).is_system_unit).length > 0 && (
                    <optgroup label="─── Organizasyon Birimleri ───">
                      {departments.filter(d => !(d as any).is_system_unit).map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          </div>
          {(selectedResponsibleDepartmentFilter || selectedCollaborationDepartmentFilter) && (
            <p className="mt-3 text-sm text-gray-600 ml-9">
              {selectedResponsibleDepartmentFilter && selectedCollaborationDepartmentFilter ? (
                <>Seçili sorumlu ve işbirliği birimleri için eylemler gösteriliyor</>
              ) : selectedResponsibleDepartmentFilter ? (
                <>Seçili sorumlu birim için eylemler gösteriliyor</>
              ) : (
                <>Seçili işbirliği birimi için eylemler gösteriliyor</>
              )}
            </p>
          )}
        </div>
      )}

      {categoryStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {categoryStats.map((category, index) => (
            <div
              key={category.id}
              className={`bg-gradient-to-br ${gradients[index % gradients.length]} rounded-lg shadow-lg p-5 text-white hover:shadow-xl transition-shadow cursor-pointer`}
              onClick={() => toggleCategory(category.id)}
            >
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg">{category.code}</span>
                  <div className="bg-white bg-opacity-30 rounded-full p-1.5">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="font-semibold text-sm leading-tight">{category.name}</h3>
              </div>
              <div className="space-y-2 border-t border-white border-opacity-30 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">Standart</span>
                  <span className="font-bold text-lg">{category.mainStandardsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">Genel Şart</span>
                  <span className="font-bold text-lg">{category.subStandardsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs opacity-90">Eylem</span>
                  <span className="font-bold text-lg">{category.actionsCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Henüz KİKS standardı tanımlanmamış.</p>
          {isSuperAdmin && (
            <Button onClick={handleAddCategory}>
              İlk Kategoriyi Ekle
            </Button>
          )}
          {!isSuperAdmin && (
            <p className="text-sm text-gray-500">Super Admin tarafından standartlar tanımlanması bekleniyor.</p>
          )}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Seçili birim için eylem bulunamadı.</p>
          <p className="text-sm text-gray-500">Farklı bir birim seçerek tekrar deneyebilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCategories.map(category => {
            const isCategoryExpanded = expandedCategories.has(category.id);
            const hasMainStandards = category.mainStandards && category.mainStandards.length > 0;

            return (
              <div key={category.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    {hasMainStandards ? (
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="p-1 hover:bg-blue-200 rounded"
                      >
                        {isCategoryExpanded ? (
                          <ChevronDown className="w-5 h-5 text-blue-700" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-blue-700" />
                        )}
                      </button>
                    ) : (
                      <div className="w-7" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-blue-900 text-lg">{category.code}</span>
                        <span className="font-semibold text-gray-900">{category.name}</span>
                        {hasMainStandards && (
                          <span className="text-xs text-blue-700 bg-blue-200 px-2 py-1 rounded">
                            {category.mainStandards!.length} standart
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddMainStandard(category)}
                        className="text-green-600 hover:text-green-800 p-2 hover:bg-green-50 rounded"
                        title="Ana Standart Ekle"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit('category', category)}
                        className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('category', category.id)}
                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {hasMainStandards && isCategoryExpanded && (
                  <div className="p-2 bg-gray-50">
                    {category.mainStandards!.map(mainStandard => {
                      const isMainExpanded = expandedMainStandards.has(mainStandard.id);
                      const hasSubStandards = mainStandard.subStandards && mainStandard.subStandards.length > 0;

                      return (
                        <div key={mainStandard.id} className="mb-2 bg-white rounded border border-gray-200">
                          <div className="flex items-start justify-between p-3 hover:bg-gray-50">
                            <div className="flex items-start gap-3 flex-1">
                              {hasSubStandards ? (
                                <button
                                  onClick={() => toggleMainStandard(mainStandard.id)}
                                  className="p-1 hover:bg-gray-200 rounded mt-1"
                                >
                                  {isMainExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-6" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-blue-700">{mainStandard.code}</span>
                                  <span className="font-medium text-gray-900">{mainStandard.title}</span>
                                  {hasSubStandards && (
                                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                      {mainStandard.subStandards!.length} alt standart
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleAddSubStandard(mainStandard, category)}
                                  className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded"
                                  title="Alt Standart Ekle"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {(isSuperAdmin || isAdmin) && (
                                <button
                                  onClick={() => handleEdit('main_standard', mainStandard, category)}
                                  className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                  title={isSuperAdmin ? 'Ana Standart Düzenle' : 'Mevcut Durum Düzenle'}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleDelete('main_standard', mainStandard.id)}
                                  className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {hasSubStandards && isMainExpanded && (
                            <div className="px-3 pb-2 bg-gray-50">
                              {mainStandard.subStandards!.map(subStandard => {
                                const isSubExpanded = expandedSubStandards.has(subStandard.id);
                                const hasActions = subStandard.actions && subStandard.actions.length > 0;

                                return (
                                  <div key={subStandard.id} className="mb-2 bg-white rounded border border-gray-200">
                                    <div className="flex items-start justify-between p-2.5 hover:bg-gray-50">
                                      <div className="flex items-start gap-2 flex-1">
                                        {hasActions ? (
                                          <button
                                            onClick={() => toggleSubStandard(subStandard.id)}
                                            className="p-1 hover:bg-gray-200 rounded mt-0.5"
                                          >
                                            {isSubExpanded ? (
                                              <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                                            ) : (
                                              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                            )}
                                          </button>
                                        ) : (
                                          <div className="w-5" />
                                        )}
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-green-700">{subStandard.code}</span>
                                            <span className="text-sm text-gray-900">{subStandard.title}</span>
                                            {hasActions && (
                                              <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {subStandard.actions!.length} eylem
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        {isAdmin && !subStandard.status?.provides_reasonable_assurance && (
                                          <button
                                            onClick={() => handleAddAction(subStandard, mainStandard, category)}
                                            className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded"
                                            title="Eylem Ekle"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        )}
                                        {subStandard.status?.provides_reasonable_assurance && (
                                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                            Makul Güvence Sağlanıyor
                                          </span>
                                        )}
                                        {(isSuperAdmin || isAdmin) && (
                                          <>
                                            <button
                                              onClick={() => handleEdit('sub_standard', subStandard, mainStandard, category)}
                                              className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                              title={isSuperAdmin ? 'Alt Standart Düzenle' : 'Mevcut Durum Düzenle'}
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            {isSuperAdmin && (
                                              <button
                                                onClick={() => handleDelete('sub_standard', subStandard.id)}
                                                className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {hasActions && isSubExpanded && (
                                      <div className="px-2 pb-2">
                                        <div className="overflow-x-auto">
                                          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg text-xs">
                                            <thead className="bg-yellow-50">
                                              <tr>
                                                <th className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">
                                                  Eylem<br/>Kod No
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">
                                                  Öngörülen<br/>Eylem/Eylemler
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">
                                                  Sorumlu<br/>Birim/ler
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">
                                                  İşbirliği Yapılacak<br/>Birim
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">
                                                  Çıktı/<br/>Sonuç
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">
                                                  Tamamlanma<br/>Tarihi
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">
                                                  Durum
                                                </th>
                                                {isAdmin && (
                                                  <th className="px-2 py-2 text-right font-medium text-gray-700 uppercase tracking-wider">
                                                    İşlemler
                                                  </th>
                                                )}
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                              {subStandard.actions!.map((action, idx) => (
                                                <tr key={action.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                  <td className="px-2 py-2 whitespace-nowrap">
                                                    <span className="font-medium text-orange-700">{action.code}</span>
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <div className="max-w-xs text-gray-800">{action.description}</div>
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <div className="text-gray-600">{getDepartmentNames(action.responsible_departments, action.all_departments_responsible)}</div>
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <div className="text-gray-600">{getDepartmentNames(action.collaboration_departments, action.all_departments_collaboration)}</div>
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <div className="max-w-xs text-gray-600">{action.output_result || '-'}</div>
                                                  </td>
                                                  <td className="px-2 py-2 whitespace-nowrap text-gray-600">
                                                    {action.target_date ? new Date(action.target_date).toLocaleDateString('tr-TR') : '-'}
                                                  </td>
                                                  <td className="px-2 py-2 whitespace-nowrap">
                                                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[action.status]}`}>
                                                      {STATUS_LABELS[action.status]}
                                                    </span>
                                                  </td>
                                                  {isAdmin && (
                                                    <td className="px-2 py-2 whitespace-nowrap text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <button
                                                          onClick={() => handleEdit('action', action, subStandard, mainStandard)}
                                                          className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                                        >
                                                          <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                          onClick={() => handleDelete('action', action.id)}
                                                          className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                                        >
                                                          <Trash2 className="w-3 h-3" />
                                                        </button>
                                                      </div>
                                                    </td>
                                                  )}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={
            modalType === 'category' ? (editingId ? 'Kategori Düzenle' : 'Yeni Kategori Ekle') :
            modalType === 'main_standard' ? (editingId ? 'Ana Standart Düzenle' : 'Yeni Ana Standart Ekle') :
            modalType === 'sub_standard' ? (editingId ? 'Alt Standart Düzenle' : 'Yeni Alt Standart Ekle') :
            (editingId ? 'Eylem Düzenle' : 'Yeni Eylem Ekle')
          }
        >
          <div className="space-y-4">
            {selectedCategory && modalType !== 'category' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <strong>Kategori:</strong> {selectedCategory.code} - {selectedCategory.name}
                {selectedMainStandard && (
                  <>
                    <br />
                    <strong>Ana Standart:</strong> {selectedMainStandard.code} - {selectedMainStandard.title}
                  </>
                )}
                {selectedSubStandard && (
                  <>
                    <br />
                    <strong>Alt Standart:</strong> {selectedSubStandard.code} - {selectedSubStandard.title}
                  </>
                )}
              </div>
            )}

            {isSuperAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kod <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  placeholder={
                    modalType === 'category' ? 'örn: KOS' :
                    modalType === 'main_standard' ? 'örn: 1' :
                    modalType === 'sub_standard' ? 'örn: 1' : 'örn: 1'
                  }
                  readOnly={modalType !== 'category'}
                />
                {modalType !== 'category' && (
                  <p className="text-xs text-gray-500 mt-1">Kod otomatik oluşturulmuştur</p>
                )}
              </div>
            )}

            {modalType === 'category' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  İsim <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            {(modalType === 'main_standard' || modalType === 'sub_standard') && (
              <>
                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Başlık <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mevcut Durum
                  </label>
                  <textarea
                    value={formData.current_status}
                    onChange={(e) => setFormData({ ...formData, current_status: e.target.value })}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Belediyenin bu standart ile ilgili mevcut durumunu açıklayınız..."
                  />
                </div>

                {modalType === 'sub_standard' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={formData.provides_reasonable_assurance}
                        onChange={(e) => setFormData({
                          ...formData,
                          provides_reasonable_assurance: e.target.checked
                        })}
                        className="mt-1 mr-3 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-green-900">
                          Mevcut durum makul güvence sağlamaktadır
                        </span>
                        <p className="text-xs text-green-700 mt-1">
                          Bu seçenek işaretlendiğinde, bu alt standart için eylem planı eklenmeyecektir.
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {isSuperAdmin && departments.length > 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sorumlu Birim/Birimler
                      </label>
                      <div className="mb-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.all_departments_responsible}
                            onChange={(e) => setFormData({
                              ...formData,
                              all_departments_responsible: e.target.checked,
                              responsible_departments: e.target.checked ? [] : formData.responsible_departments
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm">Tüm Birimler</span>
                        </label>
                      </div>
                      {!formData.all_departments_responsible && (
                        <>
                          <select
                            multiple
                            value={formData.responsible_departments}
                            onChange={(e) => {
                              const values = Array.from(e.target.selectedOptions, option => option.value);
                              setFormData({ ...formData, responsible_departments: values });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            size={8}
                          >
                            {departments.filter(d => (d as any).is_system_unit).length > 0 && (
                              <optgroup label="─── Sistem Birimleri ───">
                                {departments.filter(d => (d as any).is_system_unit).map(dept => (
                                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {departments.filter(d => !(d as any).is_system_unit).length > 0 && (
                              <optgroup label="─── Organizasyon Birimleri ───">
                                {departments.filter(d => !(d as any).is_system_unit).map(dept => (
                                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd tuşu ile birden fazla seçim yapabilirsiniz</p>
                        </>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        İşbirliği Yapılacak Birim/Birimler
                      </label>
                      <div className="mb-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.all_departments_collaboration}
                            onChange={(e) => setFormData({
                              ...formData,
                              all_departments_collaboration: e.target.checked,
                              collaboration_departments: e.target.checked ? [] : formData.collaboration_departments
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm">Tüm Birimler</span>
                        </label>
                      </div>
                      {!formData.all_departments_collaboration && (
                        <select
                          multiple
                          value={formData.collaboration_departments}
                          onChange={(e) => {
                            const values = Array.from(e.target.selectedOptions, option => option.value);
                            setFormData({ ...formData, collaboration_departments: values });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          size={8}
                        >
                          {departments.filter(d => (d as any).is_system_unit).length > 0 && (
                            <optgroup label="─── Sistem Birimleri ───">
                              {departments.filter(d => (d as any).is_system_unit).map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {departments.filter(d => !(d as any).is_system_unit).length > 0 && (
                            <optgroup label="─── Organizasyon Birimleri ───">
                              {departments.filter(d => !(d as any).is_system_unit).map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {modalType === 'category' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            {modalType === 'action' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Öngörülen Eylem/Eylemler <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Yapılacak eylemleri detaylı olarak yazınız..."
                  />
                </div>

                {departments.length > 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sorumlu Birim/Birimler
                      </label>
                      <div className="mb-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.all_departments_responsible}
                            onChange={(e) => setFormData({
                              ...formData,
                              all_departments_responsible: e.target.checked,
                              responsible_departments: e.target.checked ? [] : formData.responsible_departments
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm">Tüm Birimler</span>
                        </label>
                      </div>
                      {!formData.all_departments_responsible && (
                        <>
                          <select
                            multiple
                            value={formData.responsible_departments}
                            onChange={(e) => {
                              const values = Array.from(e.target.selectedOptions, option => option.value);
                              setFormData({ ...formData, responsible_departments: values });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            size={8}
                          >
                            {departments.filter(d => (d as any).is_system_unit).length > 0 && (
                              <optgroup label="─── Sistem Birimleri ───">
                                {departments.filter(d => (d as any).is_system_unit).map(dept => (
                                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {departments.filter(d => !(d as any).is_system_unit).length > 0 && (
                              <optgroup label="─── Organizasyon Birimleri ───">
                                {departments.filter(d => !(d as any).is_system_unit).map(dept => (
                                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd tuşu ile birden fazla seçim yapabilirsiniz</p>
                        </>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        İşbirliği Yapılacak Birim/Birimler
                      </label>
                      <div className="mb-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.all_departments_collaboration}
                            onChange={(e) => setFormData({
                              ...formData,
                              all_departments_collaboration: e.target.checked,
                              collaboration_departments: e.target.checked ? [] : formData.collaboration_departments
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm">Tüm Birimler</span>
                        </label>
                      </div>
                      {!formData.all_departments_collaboration && (
                        <select
                          multiple
                          value={formData.collaboration_departments}
                          onChange={(e) => {
                            const values = Array.from(e.target.selectedOptions, option => option.value);
                            setFormData({ ...formData, collaboration_departments: values });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          size={8}
                        >
                          {departments.filter(d => (d as any).is_system_unit).length > 0 && (
                            <optgroup label="─── Sistem Birimleri ───">
                              {departments.filter(d => (d as any).is_system_unit).map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {departments.filter(d => !(d as any).is_system_unit).length > 0 && (
                            <optgroup label="─── Organizasyon Birimleri ───">
                              {departments.filter(d => !(d as any).is_system_unit).map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Çıktı/Sonuç
                  </label>
                  <textarea
                    value={formData.output_result}
                    onChange={(e) => setFormData({ ...formData, output_result: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Bu eylem sonucunda elde edilecek çıktı ve sonuçlar..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ek açıklamalar ve notlar..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hedef Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
